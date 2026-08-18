"use client";

import { useState, type FormEvent } from "react";
import type { VerificationResult } from "@/lib/evidence/schemas";
import type { PublicVerificationError } from "@/lib/verification/errors";
import type { InvestigationStage } from "@/lib/verification/pipeline";

type StreamEvent =
  | { type: "stage"; data: InvestigationStage }
  | { type: "result"; data: VerificationResult }
  | { type: "error"; data: PublicVerificationError };

type DemoVerdict = "CURRENT" | "STALE";

const MAX_PDF_BYTES = 4 * 1024 * 1024;
const DEMO_REPORT_URL = "/demo/AuditScope-Test-Scope-Report.pdf";
const DEMOS: Record<DemoVerdict, { address: string; summary: string }> = {
  CURRENT: {
    address: "0xC7A79CD13dda7967588549a83110012DCc395266",
    summary: "Proxy remains on the audited VaultV1 source.",
  },
  STALE: {
    address: "0x0Bd5Dd0831139566Dc5166BA74F0891eb44A7b03",
    summary: "Proxy was upgraded from audited VaultV1 to VaultV2.",
  },
};

class VerificationRequestError extends Error {
  constructor(public readonly detail: PublicVerificationError) {
    super(detail.message);
    this.name = "VerificationRequestError";
  }
}

async function readEvents(response: Response, onEvent: (event: StreamEvent) => void) {
  if (!response.ok) throw new VerificationRequestError(await responseError(response));
  if (!response.body) {
    throw new VerificationRequestError(interrupted("The server returned no verification stream."));
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let terminalEventReceived = false;

  const consume = (line: string) => {
    if (!line.trim()) return;
    try {
      const message = JSON.parse(line) as StreamEvent;
      onEvent(message);
      if (message.type === "result" || message.type === "error") terminalEventReceived = true;
    } catch {
      throw new VerificationRequestError(interrupted("The verification stream contained an invalid event."));
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += value ?? "";
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) consume(line);
    if (done) break;
  }
  consume(buffer);

  if (!terminalEventReceived) {
    throw new VerificationRequestError(interrupted("The connection closed before AuditScope produced a verdict."));
  }
}

async function responseError(response: Response): Promise<PublicVerificationError> {
  if (response.status === 413) {
    return {
      code: "INVALID_REQUEST",
      message: "The PDF is too large for the production verification endpoint.",
      suggestion: "Use a PDF no larger than 4 MB and submit it again.",
      source: "request",
      retryable: false,
    };
  }
  if (response.status === 504) {
    return interrupted("The deployment ended the request before the evidence pipeline finished.");
  }

  try {
    const body = await response.json() as { error?: PublicVerificationError | string };
    if (body.error && typeof body.error !== "string") return body.error;
    if (typeof body.error === "string") return interrupted(body.error);
  } catch {
    // Platform-generated HTML responses have no structured AuditScope error.
  }
  return interrupted(`Verification request failed with HTTP ${response.status}.`);
}

function interrupted(message: string): PublicVerificationError {
  return {
    code: "VERIFICATION_INTERRUPTED",
    message,
    suggestion: "Try the same verification again. AuditScope did not produce or cache a verdict.",
    source: "pipeline",
    retryable: true,
  };
}

export function VerifyWorkspace() {
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<InvestigationStage[]>([]);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<PublicVerificationError | null>(null);
  const [auditFile, setAuditFile] = useState<File | null>(null);
  const [chainId, setChainId] = useState("84532");
  const [address, setAddress] = useState("");
  const [activeDemo, setActiveDemo] = useState<DemoVerdict | null>(null);

  async function verify(file: File, selectedChainId: string, selectedAddress: string, demo: DemoVerdict | null) {
    if (file.size > MAX_PDF_BYTES) {
      setError({
        code: "INVALID_REQUEST",
        message: "The selected PDF is larger than 4 MB.",
        suggestion: "Choose a smaller PDF before starting verification.",
        source: "request",
        retryable: false,
      });
      return;
    }

    setRunning(true);
    setStages([]);
    setResult(null);
    setError(null);
    setActiveDemo(demo);

    const form = new FormData();
    form.set("audit", file);
    form.set("chainId", selectedChainId);
    form.set("address", selectedAddress);

    try {
      const response = await fetch("/api/verify", { method: "POST", body: form });
      await readEvents(response, (message) => {
        if (message.type === "stage") setStages((current) => [...current, message.data]);
        if (message.type === "result") setResult(message.data);
        if (message.type === "error") setError(message.data);
      });
    } catch (caught) {
      setError(caught instanceof VerificationRequestError ? caught.detail : interrupted("Verification stopped unexpectedly."));
    } finally {
      setRunning(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auditFile) {
      setError({
        code: "INVALID_REQUEST",
        message: "Choose an audit PDF before verification.",
        suggestion: "Upload a report or run one of the controlled demo examples.",
        source: "request",
        retryable: false,
      });
      return;
    }
    await verify(auditFile, chainId, address, null);
  }

  async function runDemo(verdict: DemoVerdict) {
    const demo = DEMOS[verdict];
    try {
      const response = await fetch(DEMO_REPORT_URL, { cache: "force-cache" });
      if (!response.ok) throw new Error("Demo PDF unavailable");
      const file = new File([await response.blob()], "AuditScope-Test-Scope-Report.pdf", { type: "application/pdf" });
      setAuditFile(file);
      setChainId("84532");
      setAddress(demo.address);
      await verify(file, "84532", demo.address, verdict);
    } catch {
      setError({
        code: "VERIFICATION_INTERRUPTED",
        message: "The controlled demo report could not be loaded.",
        suggestion: "Refresh the page or upload the synthetic report manually. No verdict was produced.",
        source: "pipeline",
        retryable: true,
      });
    }
  }

  return (
    <section className="workspace" id="verify" aria-labelledby="verify-title">
      <div className="workspace-heading">
        <div>
          <p className="section-index">01 / verification docket</p>
          <h2 id="verify-title">Map an audit to live code.</h2>
        </div>
        <p>One document. One Base address. Independently checked evidence.</p>
      </div>

      <section className="demo-presets" aria-labelledby="demo-title">
        <div className="preset-intro">
          <p className="section-index">Controlled live examples</p>
          <h3 id="demo-title">Run the proven Base Sepolia fixtures</h3>
          <p>Each preset sends the synthetic scope PDF through Gemini, GitHub, Base RPC, Sourcify, and the production comparison engine.</p>
        </div>
        {(Object.keys(DEMOS) as DemoVerdict[]).map((verdict, index) => (
          <button
            className="preset"
            data-verdict={verdict}
            disabled={running}
            key={verdict}
            onClick={() => void runDemo(verdict)}
            type="button"
          >
            <span>0{index + 1}</span>
            <strong>Run {verdict} demo</strong>
            <small>{DEMOS[verdict].summary}</small>
            <code>{shortAddress(DEMOS[verdict].address)}</code>
          </button>
        ))}
      </section>

      <form className="verification-form" onSubmit={submit} aria-busy={running}>
        <div className="form-heading">
          <div><span>Manual verification</span><strong>Supply your own evidence target</strong></div>
          <small>PDF contents and credentials remain server-side during processing.</small>
        </div>
        <div className="field file-field">
          <label htmlFor="audit">Audit report</label>
          <input
            id="audit"
            name="audit"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              setAuditFile(event.currentTarget.files?.[0] ?? null);
              setActiveDemo(null);
            }}
          />
          <small>{auditFile ? `${auditFile.name} · ${formatBytes(auditFile.size)}` : "PDF, up to 4 MB"}</small>
        </div>
        <div className="field">
          <label htmlFor="chainId">Network</label>
          <select id="chainId" name="chainId" value={chainId} onChange={(event) => setChainId(event.currentTarget.value)}>
            <option value="8453">Base Mainnet</option>
            <option value="84532">Base Sepolia</option>
          </select>
        </div>
        <div className="field address-field">
          <label htmlFor="address">Contract or proxy address</label>
          <input
            id="address"
            name="address"
            value={address}
            onChange={(event) => { setAddress(event.currentTarget.value); setActiveDemo(null); }}
            placeholder="0x…"
            pattern="0x[a-fA-F0-9]{40}"
            required
          />
        </div>
        <button className="verify-button" disabled={running} type="submit">
          <span>{running ? "Evidence pipeline running" : "Verify coverage"}</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>

      {(running || stages.length > 0) && <Investigation stages={stages} running={running} demo={activeDemo} />}
      {error && <ErrorPanel error={error} />}
      {result && <Result result={result} />}
    </section>
  );
}

function Investigation({ stages, running, demo }: { stages: InvestigationStage[]; running: boolean; demo: DemoVerdict | null }) {
  return <section className="progress" aria-live="polite">
    <div className="progress-heading">
      <div><p className="section-index">Live investigation</p><h2>{demo ? `${demo} fixture` : "Evidence collection"}</h2></div>
      <span className={running ? "live-indicator" : "complete-indicator"}>{running ? "Running" : "Complete"}</span>
    </div>
    <ol>
      {stages.map((stage, index) => <li key={stage.id} data-status={stage.status}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <div><strong>{stage.label}</strong><p>{stage.detail}</p></div>
        <em>{stage.status}</em>
      </li>)}
      {running && <li className="active">
        <span>{String(stages.length + 1).padStart(2, "0")}</span>
        <div><strong>Awaiting evidence</strong><p>Gemini and external evidence sources can take up to several minutes.</p></div>
        <em>working</em>
      </li>}
    </ol>
  </section>;
}

function ErrorPanel({ error }: { error: PublicVerificationError }) {
  return <section className="error" role="alert">
    <div className="error-code"><span>{error.source}</span><code>{error.code}</code></div>
    <div><strong>{error.message}</strong><p>{error.suggestion}</p></div>
    <span className="fail-closed">No verdict issued</span>
  </section>;
}

function Result({ result }: { result: VerificationResult }) {
  const applicable = result.implementation ?? result.deployment;
  const sourceComponents = result.components.filter((component) => component.id.startsWith("source:"));
  const proof = sourceComponents.find((component) => component.coverage === "mismatch")
    ?? sourceComponents.find((component) => component.coverage === "unresolved")
    ?? sourceComponents[0];
  const sourcePaths = result.auditScope.sourceFiles.map((source) => source.path);

  return <article className="result" id="result">
    <header className="verdict" data-verdict={result.verdict}>
      <div className="verdict-code"><span>Deterministic coverage verdict</span><strong>{result.verdict}</strong></div>
      <div className="verdict-copy"><p>{result.reason}</p><span>{result.confidence} confidence · rule-derived</span></div>
    </header>

    <section className="proof-grid" aria-label="Audited and live proof summary">
      <div className="proof-block audited-proof">
        <span>Audited scope</span>
        <h3>Historical commit and source</h3>
        <dl>
          <div><dt>Commit</dt><dd>{result.github.resolvedSha ?? result.github.requestedRef ?? "Not established"}</dd></div>
          <div><dt>Source</dt><dd>{sourcePaths.length > 0 ? sourcePaths.join(", ") : "Not identified"}</dd></div>
        </dl>
      </div>
      <div className="proof-block live-proof">
        <span>Live deployment</span>
        <h3>{applicable.contractName ?? (result.deployment.isProxy ? "Resolved implementation" : "Contract target")}</h3>
        <dl>
          <div><dt>Implementation</dt><dd>{result.deployment.implementationAddress ?? result.deployment.requestedAddress}</dd></div>
          <div><dt>Sourcify</dt><dd>{applicable.match ?? applicable.verificationStatus}</dd></div>
        </dl>
      </div>
      <div className="proof-block correspondence-proof" data-coverage={proof?.coverage ?? "unresolved"}>
        <span>Deterministic comparison</span>
        <h3>{proofLabel(proof?.coverage)}</h3>
        <p>{proof?.detail ?? "No exact source correspondence could be established."}</p>
        <div className="hash-pair">
          <code>A {compactHash(proof?.auditValue)}</code>
          <span aria-hidden="true">↔</span>
          <code>L {compactHash(proof?.liveValue)}</code>
        </div>
      </div>
    </section>

    <section className="evidence-timeline" aria-labelledby="timeline-title">
      <div className="section-heading"><div><p className="section-index">02 / evidence trail</p><h3 id="timeline-title">How the verdict was established</h3></div><span>{result.stages.length} checks</span></div>
      <ol>{result.stages.map((stage, index) => <li key={stage.id} data-status={stage.status}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <div><strong>{stage.label}</strong><p>{stage.detail}</p></div>
      </li>)}</ol>
    </section>

    <section className="limitations" data-empty={result.limitations.length === 0}>
      <div><p className="section-index">03 / limitations</p><h3>What this verdict does not establish</h3></div>
      {result.limitations.length > 0
        ? <ul>{result.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
        : <p>No evidence limitations were recorded for this audit-to-deployment mapping.</p>}
      <p className="disclaimer">AuditScope verifies audit-to-deployment coverage. It does not determine whether a contract is secure or free of vulnerabilities.</p>
    </section>

    <details className="evidence-details" open>
      <summary>Inspect deterministic evidence matrix</summary>
      <div className="matrix">{result.components.map((component) => <div className="matrix-row" key={component.id}>
        <span className={`status ${component.coverage}`}>{component.coverage}</span>
        <div><strong>{component.label}</strong><p>{component.detail}</p></div>
        <span className="strength">{component.strength} evidence</span>
      </div>)}</div>
    </details>
    <AuditClaims scope={result.auditScope} />
  </article>;
}

function AuditClaims({ scope }: { scope: VerificationResult["auditScope"] }) {
  const claims = [
    ...claim("Auditor", scope.auditor.value, scope.auditor.evidence),
    ...claim("Report title", scope.title.value, scope.title.evidence),
    ...claim("Audit date", scope.auditDate.value, scope.auditDate.evidence),
    ...claim("Repository", scope.repositoryUrl.value, scope.repositoryUrl.evidence),
    ...claim("Commit", scope.commitSha.value, scope.commitSha.evidence),
    ...claim("Tag", scope.tag.value, scope.tag.evidence),
    ...claim("Contract addresses", scope.contractAddresses.value, scope.contractAddresses.evidence),
    ...claim("Implementation addresses", scope.implementationAddresses.value, scope.implementationAddresses.evidence),
    ...claim("Address is a scope boundary", scope.addressIsScopeBoundary.value, scope.addressIsScopeBoundary.evidence),
    ...scope.sourceFiles.flatMap((source) => claim(`Source file: ${source.path}`, source.contractName ?? source.path, source.evidence)),
    ...scope.exclusions.flatMap((exclusion) => claim("Exclusion", exclusion.text, exclusion.evidence)),
  ];

  return <details className="evidence-details">
    <summary>Inspect AI-extracted claims and PDF citations</summary>
    <p className="claim-warning">Schema validation confirms structure, not truth. These claims become strong only when GitHub, Sourcify, RPC, or exact source correspondence corroborates them.</p>
    <div className="citations">{claims.map((item, index) => <div className="citation" key={`${item.label}-${item.page}-${index}`}>
      <span>{item.page ? `Page ${item.page}` : "Page not identified"}</span>
      <strong>{item.label}: {item.value}</strong>
      <q>{item.excerpt}</q>
    </div>)}</div>
  </details>;
}

function claim(
  label: string,
  value: string | string[] | boolean | null,
  evidence: Array<{ page: number | null; excerpt: string }>,
) {
  if (value === null || (Array.isArray(value) && value.length === 0)) return [];
  const rendered = Array.isArray(value) ? value.join(", ") : String(value);
  return evidence.map((citation) => ({ label, value: rendered, ...citation }));
}

function shortAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function compactHash(value: string | null | undefined) {
  if (!value) return "not established";
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function proofLabel(coverage?: "covered" | "mismatch" | "unresolved") {
  if (coverage === "covered") return "Exact source match";
  if (coverage === "mismatch") return "Exact source mismatch";
  return "Source correspondence unresolved";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
