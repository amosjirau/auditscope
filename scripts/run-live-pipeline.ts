import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { verificationResultSchema } from "../lib/evidence/schemas";
import { verifyAuditCoverage } from "../lib/verification/pipeline";

async function main() {
  const [pdfArgument, address, outputArgument] = process.argv.slice(2);
  if (!pdfArgument || !address || !outputArgument) {
    throw new Error("Usage: run-live-pipeline.ts <audit.pdf> <base-address> <fixture.json>");
  }

  const pdfPath = resolve(pdfArgument);
  const outputPath = resolve(outputArgument);
  const pdf = await readFile(pdfPath);
  const startedAt = performance.now();
  const result = verificationResultSchema.parse(await verifyAuditCoverage({
    pdf,
    chainId: 8453,
    address,
    onStage: (stage) => console.error(`${stage.label}: ${stage.detail}`),
  }));
  const latencyMs = Math.round(performance.now() - startedAt);
  const fixture = {
    fixtureVersion: 1,
    generatedAt: new Date().toISOString(),
    model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
    source: {
      title: "Moonwell Multichain Governance Audit",
      publisher: "Kauz Security Services",
      url: "https://github.com/moonwell-fi/moonwell-contracts-v2/blob/main/audits/Kauz_Cross-Chain-Governance_Audit.pdf",
      sha256: createHash("sha256").update(pdf).digest("hex"),
      chainId: 8453,
      address,
      addressDocumentation: "https://docs.moonwell.fi/moonwell/protocol-information/contracts",
    },
    latencyMs,
    result,
  };
  const serialized = `${JSON.stringify(fixture, null, 2)}\n`;
  const secrets = [process.env.GOOGLE_GENERATIVE_AI_API_KEY, process.env.GITHUB_TOKEN]
    .filter((value): value is string => Boolean(value));
  if (secrets.some((secret) => serialized.includes(secret))) {
    throw new Error("Refusing to write a fixture containing a configured secret");
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
  console.log(JSON.stringify({
    outputPath,
    latencyMs,
    verdict: result.verdict,
    reason: result.reason,
    repositoryUrl: result.auditScope.repositoryUrl.value,
    commitSha: result.auditScope.commitSha.value,
    sourceFileCount: result.auditScope.sourceFiles.length,
    sourcifyMatch: result.implementation?.match ?? result.deployment.match,
  }, null, 2));
}

void main();
