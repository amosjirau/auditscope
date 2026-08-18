import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { extractAuditScope } from "../lib/audit/extract";
import { auditScopeSchema, type AuditScope } from "../lib/evidence/schemas";

const source = {
  title: "Security Audit of the POLKADOT CLAIMS Smart Contract",
  publisher: "ChainSecurity",
  url: "https://chainsecurity.com/wp-content/uploads/2019/08/ChainSecurity_W3F.pdf",
};

async function main() {
  const [pdfArgument, outputArgument] = process.argv.slice(2);
  if (!pdfArgument || !outputArgument) {
    throw new Error("Usage: run-live-extraction.ts <audit.pdf> <fixture.json>");
  }

  const pdfPath = resolve(pdfArgument);
  const outputPath = resolve(outputArgument);
  const pdf = await readFile(pdfPath);
  const scope = auditScopeSchema.parse(await extractAuditScope(pdf));
  const checks = validateKnownDocument(scope);
  const fixture = {
    fixtureVersion: 1,
    generatedAt: new Date().toISOString(),
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    source: {
      ...source,
      sha256: createHash("sha256").update(pdf).digest("hex"),
    },
    validation: {
      schemaPassed: true,
      allChecksPassed: Object.values(checks).every(Boolean),
      checks,
    },
    scope,
  };

  const serialized = `${JSON.stringify(fixture, null, 2)}\n`;
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (apiKey && serialized.includes(apiKey)) throw new Error("Refusing to write a fixture containing the API key");

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
  console.log(JSON.stringify({ outputPath, validation: fixture.validation, summary: summarize(scope) }, null, 2));

  if (!fixture.validation.allChecksPassed) process.exitCode = 1;
}

void main();

function validateKnownDocument(scope: AuditScope) {
  const repository = scope.repositoryUrl.value?.replace(/[.)]+$/, "") ?? null;
  const sourcePaths = scope.sourceFiles.map((file) => file.path.replace(/^\.\//, ""));
  return {
    repositoryUrlExplicitlyExtracted: repository === "https://github.com/w3f/polkadot-claims",
    absentCommitRemainsNull: scope.commitSha.value === null,
    absentTagRemainsNull: scope.tag.value === null,
    onlyExplicitSourceFileExtracted: sourcePaths.length === 1 && sourcePaths[0] === "Claims.sol",
    absentContractAddressesRemainNull: scope.contractAddresses.value === null,
    absentImplementationAddressesRemainNull: scope.implementationAddresses.value === null,
    citedCriticalValues: criticalValuesHaveCitations(scope),
    addressScopeBoundaryRemainsNull: scope.addressIsScopeBoundary.value === null,
  };
}

function criticalValuesHaveCitations(scope: AuditScope): boolean {
  const scalarFields = [
    scope.auditor,
    scope.title,
    scope.auditDate,
    scope.repositoryUrl,
    scope.commitSha,
    scope.tag,
    scope.addressIsScopeBoundary,
  ];
  const listFields = [scope.contractAddresses, scope.implementationAddresses];
  return scalarFields.every((field) => field.value === null || field.evidence.length > 0)
    && listFields.every((field) => field.value === null || field.value.length === 0 || field.evidence.length > 0)
    && scope.sourceFiles.every((file) => file.evidence.length > 0)
    && scope.exclusions.every((exclusion) => exclusion.evidence.length > 0);
}

function summarize(scope: AuditScope) {
  return {
    repositoryUrl: scope.repositoryUrl.value,
    commitSha: scope.commitSha.value,
    tag: scope.tag.value,
    sourceFiles: scope.sourceFiles.map((file) => file.path),
    contractAddresses: scope.contractAddresses.value,
    implementationAddresses: scope.implementationAddresses.value,
    addressIsScopeBoundary: scope.addressIsScopeBoundary.value,
  };
}
