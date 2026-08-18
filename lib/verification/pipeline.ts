import { extractAuditScope } from "../audit/extract";
import { lookupDeployment } from "../adapters/base";
import { lookupGitHubEvidence } from "../adapters/github";
import { compareEvidence } from "../evidence/compare";
import {
  verificationResultSchema,
  type AuditScope,
  type DeploymentEvidence,
  type GitHubEvidence,
  type SupportedChainId,
  type VerificationResult,
} from "../evidence/schemas";

export type InvestigationStage = VerificationResult["stages"][number];

export interface PipelineDependencies {
  extract: (pdf: Uint8Array) => Promise<AuditScope>;
  deployment: (chainId: SupportedChainId, address: string) => Promise<DeploymentEvidence>;
  github: (scope: AuditScope) => Promise<GitHubEvidence>;
}

const defaults: PipelineDependencies = {
  extract: extractAuditScope,
  deployment: lookupDeployment,
  github: lookupGitHubEvidence,
};

export async function verifyAuditCoverage(input: {
  pdf: Uint8Array;
  chainId: SupportedChainId;
  address: string;
  onStage?: (stage: InvestigationStage) => void;
  dependencies?: PipelineDependencies;
}): Promise<VerificationResult> {
  const dependencies = input.dependencies ?? defaults;
  const stages: InvestigationStage[] = [];
  const report = (stage: InvestigationStage) => {
    stages.push(stage);
    input.onStage?.(stage);
  };

  const auditScope = await dependencies.extract(input.pdf);
  report({ id: "audit", label: "Audit parsed", status: "complete", detail: "Gemini output passed the strict AuditScope schema" });

  const deployment = await dependencies.deployment(input.chainId, input.address);
  report({
    id: "deployment",
    label: "Deployment resolved",
    status: deployment.verificationStatus === "error" ? "failed" : deployment.verificationStatus === "verified" ? "complete" : "warning",
    detail: deployment.error ?? `${deployment.match} Sourcify verification found`,
  });

  let implementation: DeploymentEvidence | null = null;
  if (deployment.implementationAddress) {
    implementation = await dependencies.deployment(input.chainId, deployment.implementationAddress);
    report({
      id: "implementation",
      label: "Implementation checked",
      status: implementation.verificationStatus === "error" ? "failed" : implementation.verificationStatus === "verified" ? "complete" : "warning",
      detail: `Live ${deployment.proxyType ?? "proxy"} implementation: ${deployment.implementationAddress}`,
    });
  } else {
    report({
      id: "implementation",
      label: "Implementation checked",
      status: deployment.isProxy ? "warning" : "complete",
      detail: deployment.isProxy ? "Proxy implementation could not be resolved" : "The target is not a supported proxy",
    });
  }

  const github = await dependencies.github(auditScope);
  report({
    id: "github",
    label: "Historical scope resolved",
    status: github.commitVerified ? (github.error ? "warning" : "complete") : "warning",
    detail: github.error ?? `Audit reference resolved to ${github.resolvedSha}`,
  });

  const comparison = compareEvidence({ audit: auditScope, deployment, implementation, github });
  report({
    id: "comparison",
    label: "Deterministic verdict built",
    status: comparison.verdict === "UNVERIFIED" ? "warning" : "complete",
    detail: comparison.reason,
  });

  const evidence = [
    {
      id: "audit-extraction", source: "audit" as const, label: "Validated audit scope",
      status: "observed" as const, strength: "strong" as const,
      detail: `${auditScope.sourceFiles.length} source file(s), ${(auditScope.contractAddresses.value?.length ?? 0) + (auditScope.implementationAddresses.value?.length ?? 0)} address(es) extracted`,
      url: null,
    },
    {
      id: "sourcify-verification", source: "sourcify" as const, label: "Live source verification",
      status: deployment.verificationStatus === "verified" ? "observed" as const : deployment.verificationStatus === "error" ? "error" as const : "unknown" as const,
      strength: "strong" as const,
      detail: deployment.error ?? `${deployment.match} at ${deployment.requestedAddress}`,
      url: deployment.verificationStatus === "verified" ? `https://repo.sourcify.dev/${deployment.chainId}/${deployment.requestedAddress}` : null,
    },
    ...comparison.evidence,
  ];

  return verificationResultSchema.parse({
    ...comparison, auditScope, deployment, implementation, github, evidence, stages,
  });
}
