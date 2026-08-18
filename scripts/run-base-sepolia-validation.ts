import { readFile, writeFile } from "node:fs/promises";
import { extractAuditScope } from "../lib/audit/extract";
import { lookupDeployment } from "../lib/adapters/base";
import { lookupGitHubEvidence } from "../lib/adapters/github";
import type { CoverageVerdict, VerificationResult } from "../lib/evidence/schemas";
import { verifyAuditCoverage, type PipelineDependencies } from "../lib/verification/pipeline";

const expectedRepository = "https://github.com/amosjirau/auditscope";
const expectedCommit = "740eebbb21af164209331eae15e8c9bc2a86ec86";
const expectedSource = "fixtures/base-sepolia/contracts/VaultV1.sol";
const FULL_RUN_PACING_MS = 65_000;

type DeploymentFixture = {
  current: { proxy: { address: string } };
  stale: { proxy: { address: string } };
  partial: { proxy: { address: string } };
  unverified: { address: string };
};

type RunRecord = {
  sequence: number;
  fixture: string;
  expectedVerdict: CoverageVerdict;
  actualVerdict: CoverageVerdict | null;
  success: boolean;
  totalLatencyMs: number;
  geminiExtractionLatencyMs: number | null;
  errors: string[];
  result: ReturnType<typeof summarizeResult> | null;
};

async function main() {
  const [pdfPath, deploymentsPath, outputPath, mode = "full"] = process.argv.slice(2);
  if (!pdfPath || !deploymentsPath || !outputPath || !["smoke", "full"].includes(mode)) {
    throw new Error("Usage: run-base-sepolia-validation.ts <scope.pdf> <deployments.json> <output.json> [smoke|full]");
  }
  const pdf = await readFile(pdfPath);
  const deployments = JSON.parse(await readFile(deploymentsPath, "utf8")) as DeploymentFixture;
  const cases = mode === "smoke"
    ? [{ fixture: "CURRENT", address: deployments.current.proxy.address, expected: "CURRENT" as const }]
    : [
        ...Array.from({ length: 5 }, () => ({ fixture: "CURRENT", address: deployments.current.proxy.address, expected: "CURRENT" as const })),
        ...Array.from({ length: 5 }, () => ({ fixture: "STALE", address: deployments.stale.proxy.address, expected: "STALE" as const })),
        { fixture: "PARTIAL", address: deployments.partial.proxy.address, expected: "PARTIAL" as const },
        { fixture: "UNVERIFIED", address: deployments.unverified.address, expected: "UNVERIFIED" as const },
      ];
  const runs: RunRecord[] = [];

  for (const [index, testCase] of cases.entries()) {
    let extractionLatencyMs: number | null = null;
    const dependencies: PipelineDependencies = {
      extract: async (input) => {
        const startedAt = performance.now();
        try {
          return await extractAuditScope(input);
        } finally {
          extractionLatencyMs = Math.round(performance.now() - startedAt);
        }
      },
      deployment: lookupDeployment,
      github: lookupGitHubEvidence,
    };
    const startedAt = performance.now();
    let result: VerificationResult | null = null;
    const errors: string[] = [];
    try {
      result = await verifyAuditCoverage({
        pdf,
        chainId: 84532,
        address: testCase.address,
        dependencies,
      });
      errors.push(...collectErrors(result));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown pipeline failure");
    }
    const totalLatencyMs = Math.round(performance.now() - startedAt);
    const success = result?.verdict === testCase.expected;
    const record: RunRecord = {
      sequence: index + 1,
      fixture: testCase.fixture,
      expectedVerdict: testCase.expected,
      actualVerdict: result?.verdict ?? null,
      success,
      totalLatencyMs,
      geminiExtractionLatencyMs: extractionLatencyMs,
      errors,
      result: result ? summarizeResult(result) : null,
    };
    runs.push(record);
    console.log(JSON.stringify({
      sequence: record.sequence,
      fixture: record.fixture,
      expected: record.expectedVerdict,
      actual: record.actualVerdict,
      success: record.success,
      totalLatencyMs,
      geminiExtractionLatencyMs: extractionLatencyMs,
      errors,
    }));
    await writeSanitized(outputPath, mode, runs);
    if (mode === "full" && index < cases.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, FULL_RUN_PACING_MS));
    }
  }

  if (runs.some((run) => !run.success)) process.exitCode = 1;
}

function collectErrors(result: VerificationResult): string[] {
  return [
    result.deployment.error,
    result.implementation?.error,
    result.github.error,
  ].filter((value): value is string => Boolean(value));
}

function summarizeResult(result: VerificationResult) {
  return {
    verdict: result.verdict,
    confidence: result.confidence,
    reason: result.reason,
    extractedScope: {
      repositoryUrl: result.auditScope.repositoryUrl,
      commitSha: result.auditScope.commitSha,
      sourceFiles: result.auditScope.sourceFiles,
      contractAddresses: result.auditScope.contractAddresses,
      implementationAddresses: result.auditScope.implementationAddresses,
      addressIsScopeBoundary: result.auditScope.addressIsScopeBoundary,
      scopeMatchesFixture:
        result.auditScope.repositoryUrl.value === expectedRepository
        && result.auditScope.commitSha.value === expectedCommit
        && result.auditScope.sourceFiles.some((source) => source.path.replace(/^\.\//, "") === expectedSource),
    },
    deployment: {
      address: result.deployment.requestedAddress,
      hasCode: result.deployment.hasCode,
      verificationStatus: result.deployment.verificationStatus,
      match: result.deployment.match,
      isProxy: result.deployment.isProxy,
      implementationAddress: result.deployment.implementationAddress,
      proxyResolutionSource: result.deployment.proxyResolutionSource,
      error: result.deployment.error,
    },
    implementation: result.implementation ? {
      address: result.implementation.requestedAddress,
      verificationStatus: result.implementation.verificationStatus,
      match: result.implementation.match,
      contractName: result.implementation.contractName,
      sourcePaths: result.implementation.sources.map((source) => source.path),
      error: result.implementation.error,
    } : null,
    github: {
      repositoryUrl: result.github.repositoryUrl,
      requestedRef: result.github.requestedRef,
      resolvedSha: result.github.resolvedSha,
      commitVerified: result.github.commitVerified,
      filePaths: result.github.files.map((file) => file.path),
      error: result.github.error,
    },
    components: result.components,
    limitations: result.limitations,
  };
}

async function writeSanitized(outputPath: string, mode: string, runs: RunRecord[]) {
  const output = {
    fixtureVersion: 1,
    generatedAt: new Date().toISOString(),
    model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
    mode,
    usesProductionPipeline: true,
    usesInjectedEvidenceFixtures: false,
    chainId: 84532,
    scope: { repository: expectedRepository, commit: expectedCommit, source: expectedSource },
    summary: {
      totalRuns: runs.length,
      successfulRuns: runs.filter((run) => run.success).length,
      allPassed: runs.length > 0 && runs.every((run) => run.success),
    },
    runs,
  };
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  const secrets = [
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.BASE_SEPOLIA_FIXTURE_PRIVATE_KEY,
    process.env.GITHUB_TOKEN,
  ].filter((value): value is string => Boolean(value));
  if (secrets.some((secret) => serialized.includes(secret))) {
    throw new Error("Refusing to write validation output containing a configured secret");
  }
  await writeFile(outputPath, serialized, "utf8");
}

void main();
