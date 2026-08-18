"use client";

import { useState, type FormEvent } from "react";
import type { VerificationResult } from "@/lib/evidence/schemas";
import type { InvestigationStage } from "@/lib/verification/pipeline";

type StreamEvent = { type: "stage"; data: InvestigationStage } | { type: "result"; data: VerificationResult } | { type: "error"; data: { message: string } };

async function readEvents(response: Response, onEvent: (event: StreamEvent) => void) {
  if (!response.ok) {
    const body = await response.json() as { error?: string };
    throw new Error(body.error ?? `Request failed with HTTP ${response.status}`);
  }
  if (!response.body) throw new Error("The server returned no response stream");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += value ?? "";
    const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as StreamEvent);
    if (done) break;
  }
}

export function VerifyWorkspace() {
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<InvestigationStage[]>([]);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setRunning(true); setStages([]); setResult(null); setError(null);
    try {
      const response = await fetch("/api/verify", { method: "POST", body: new FormData(event.currentTarget) });
      await readEvents(response, (message) => {
        if (message.type === "stage") setStages((current) => [...current, message.data]);
        if (message.type === "result") setResult(message.data);
        if (message.type === "error") setError(message.data.message);
      });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Verification failed"); }
    finally { setRunning(false); }
  }

  return (
    <section className="workspace" aria-label="Verify an audit">
      <form onSubmit={submit}>
        <div className="field wide"><label htmlFor="audit">Audit report</label><input id="audit" name="audit" type="file" accept="application/pdf,.pdf" required /><small>PDF, up to 12 MB</small></div>
        <div className="field"><label htmlFor="chainId">Network</label><select id="chainId" name="chainId" defaultValue="84532"><option value="8453">Base Mainnet</option><option value="84532">Base Sepolia</option></select></div>
        <div className="field address-field"><label htmlFor="address">Contract or proxy address</label><input id="address" name="address" placeholder="0x…" pattern="0x[a-fA-F0-9]{40}" required /></div>
        <button disabled={running} type="submit">{running ? "Investigating…" : "Verify coverage"}</button>
      </form>
      {(running || stages.length > 0) && <section className="progress" aria-live="polite"><h2>Investigation</h2><ol>
        {stages.map((stage) => <li key={stage.id} data-status={stage.status}><span>{stage.status === "complete" ? "✓" : stage.status === "failed" ? "×" : "!"}</span><div><strong>{stage.label}</strong><p>{stage.detail}</p></div></li>)}
        {running && <li className="active"><span>·</span><div><strong>Working</strong><p>Waiting for the next evidence source…</p></div></li>}
      </ol></section>}
      {error && <div className="error" role="alert"><strong>Verification stopped</strong><p>{error}</p></div>}
      {result && <Result result={result} />}
    </section>
  );
}

function Result({ result }: { result: VerificationResult }) {
  return <article className="result">
    <div className="verdict" data-verdict={result.verdict}><div><p className="eyebrow">Coverage verdict</p><h2>{result.verdict}</h2></div><span>{result.confidence} confidence</span></div>
    <p className="reason">{result.reason}</p>
    <dl className="addresses"><div><dt>Audited reference</dt><dd>{result.github.resolvedSha ?? result.github.requestedRef ?? "Not established"}</dd></div><div><dt>Live target</dt><dd>{result.deployment.implementationAddress ?? result.deployment.requestedAddress}</dd></div></dl>
    <details open><summary>Evidence matrix</summary><div className="matrix">{result.components.map((component) => <div className="matrix-row" key={component.id}><span className={`status ${component.coverage}`}>{component.coverage}</span><div><strong>{component.label}</strong><p>{component.detail}</p></div></div>)}</div></details>
    {result.limitations.length > 0 && <div className="limitations"><strong>Limitations</strong><ul>{result.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    <p className="disclaimer">AuditScope verifies audit-to-deployment coverage. It does not determine whether a contract is secure or free of vulnerabilities.</p>
  </article>;
}
