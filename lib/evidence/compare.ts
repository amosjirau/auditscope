import { getAddress } from "viem";
import { contentHash } from "./hash";
import {
  type AuditScope,
  type ComponentResult,
  type DeploymentEvidence,
  type EvidenceItem,
  type GitHubEvidence,
} from "./types";
import { buildCoverageVerdict, verdictConfidence } from "./verdict";

export interface ComparisonOutput {
  verdict: ReturnType<typeof buildCoverageVerdict>;
  confidence: ReturnType<typeof verdictConfidence>;
  reason: string;
  components: ComponentResult[];
  evidence: EvidenceItem[];
  limitations: string[];
}

function sameAddress(left: string, right: string): boolean {
  try {
    return getAddress(left) === getAddress(right);
  } catch {
    return false;
  }
}

function sourceForPath<T extends { path: string }>(sources: T[], auditPath: string): T | undefined {
  const normalized = auditPath.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
  return sources.find((source) => {
    const candidate = source.path.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
    return candidate === normalized || candidate.endsWith(`/${normalized}`);
  });
}

function result(
  input: Omit<ComponentResult, "critical" | "decisive" | "strength">
    & Partial<Pick<ComponentResult, "critical" | "decisive" | "strength">>,
): ComponentResult {
  return { critical: true, decisive: false, strength: "strong", ...input };
}

export function compareEvidence(input: {
  audit: AuditScope;
  deployment: DeploymentEvidence;
  implementation: DeploymentEvidence | null;
  github: GitHubEvidence;
}): ComparisonOutput {
  const { audit, deployment, implementation, github } = input;
  const components: ComponentResult[] = [];
  const evidence: EvidenceItem[] = [];
  const limitations = [...audit.uncertainties];

  if (deployment.verificationStatus === "error" || !deployment.hasCode) {
    components.push(result({
      id: "live-deployment",
      label: "Live deployment available",
      coverage: "unresolved",
      detail: deployment.error ?? "Live deployment evidence could not be retrieved",
      auditValue: null,
      liveValue: deployment.requestedAddress,
    }));
  }

  const auditedImplementations = audit.implementationAddresses.value ?? [];
  const auditedAddresses = audit.contractAddresses.value ?? [];
  const addressIsScopeBoundary = audit.addressIsScopeBoundary.value === true;
  const canCompareLiveAddress = deployment.hasCode && deployment.verificationStatus !== "error";
  if (deployment.isProxy && canCompareLiveAddress) {
    if (!deployment.implementationAddress) {
      components.push(result({
        id: "implementation-address",
        label: "Proxy implementation",
        coverage: "unresolved",
        detail: "The live proxy implementation could not be resolved",
        auditValue: auditedImplementations.join(", ") || null,
        liveValue: null,
      }));
    } else if (auditedImplementations.length > 0) {
      const matched = auditedImplementations.some((address) => sameAddress(address, deployment.implementationAddress!));
      components.push(result({
        id: "implementation-address",
        label: "Audited vs live implementation",
        coverage: matched ? "covered" : "mismatch",
        critical: matched || addressIsScopeBoundary,
        decisive: !matched && addressIsScopeBoundary,
        detail: matched
          ? "The live proxy points to an implementation address explicitly listed in the audit"
          : addressIsScopeBoundary
            ? "The live proxy points to an implementation address outside the audit's explicit deployment scope"
            : "The live implementation address differs, but the audit does not make address identity a scope boundary; exact source evidence governs coverage",
        auditValue: auditedImplementations.join(", "),
        liveValue: deployment.implementationAddress,
      }));
    } else {
      components.push(result({
        id: "implementation-address",
        label: "Audited vs live implementation",
        coverage: "unresolved",
        detail: "The audit does not state an implementation address",
        auditValue: null,
        liveValue: deployment.implementationAddress,
      }));
    }
  } else if (!deployment.isProxy && canCompareLiveAddress && auditedAddresses.length > 0) {
    const matched = auditedAddresses.some((address) => sameAddress(address, deployment.requestedAddress));
    components.push(result({
      id: "contract-address",
      label: "Audited vs live contract address",
      coverage: matched ? "covered" : "mismatch",
      critical: matched || addressIsScopeBoundary,
      decisive: !matched && addressIsScopeBoundary,
      detail: matched
        ? "The requested deployment address is explicitly listed in the audit"
        : addressIsScopeBoundary
          ? "The requested deployment address is outside the audit's explicit deployment scope"
          : "The deployment address differs, but the audit does not make address identity a scope boundary; exact source evidence governs coverage",
      auditValue: auditedAddresses.join(", "),
      liveValue: deployment.requestedAddress,
    }));
  }

  components.push(result({
    id: "historical-commit",
    label: "Historical audit commit",
    coverage: github.commitVerified ? "covered" : "unresolved",
    detail: github.commitVerified
      ? `GitHub independently resolved the audit reference to ${github.resolvedSha}`
      : github.error ?? "The audit commit could not be independently resolved",
    auditValue: github.requestedRef,
    liveValue: github.resolvedSha,
  }));

  const applicableLiveContract = deployment.isProxy ? implementation : deployment;
  const liveSources = applicableLiveContract?.sources ?? [];
  const hasExactSourcifyMatch = applicableLiveContract?.match === "exact_match";
  const sourceComponents: ComponentResult[] = [];
  if (audit.sourceFiles.length === 0) {
    components.push(result({
      id: "source-scope",
      label: "Audited source scope",
      coverage: "unresolved",
      detail: "The audit does not identify source files for deterministic comparison",
      auditValue: null,
      liveValue: liveSources.length ? `${liveSources.length} verified live sources` : null,
    }));
  } else {
    for (const auditedSource of audit.sourceFiles) {
      const historical = sourceForPath(github.files, auditedSource.path);
      const live = sourceForPath(liveSources, auditedSource.path);
      const id = `source:${auditedSource.path}`;
      if (!historical || !live) {
        const component = result({
          id,
          label: auditedSource.path,
          coverage: "unresolved",
          detail: !historical
            ? "The audited file was not available at the resolved GitHub commit"
            : "No corresponding verified live source was found",
          auditValue: historical?.blobSha ?? auditedSource.path,
          liveValue: live?.contentHash ?? null,
        });
        components.push(component);
        sourceComponents.push(component);
        continue;
      }
      const historicalHash = contentHash(historical.content);
      const matched = historicalHash === live.contentHash;
      if (!hasExactSourcifyMatch) {
        const component = result({
          id,
          label: auditedSource.path,
          coverage: "unresolved",
          strength: "weak",
          detail: matched
            ? "Source text matches, but Sourcify did not establish an exact match for the applicable live contract"
            : "Sourcify did not establish an exact match for the applicable live contract, so returned source text cannot decide coverage",
          auditValue: historicalHash,
          liveValue: live.contentHash,
        });
        components.push(component);
        sourceComponents.push(component);
        continue;
      }
      const component = result({
        id,
        label: auditedSource.path,
        coverage: matched ? "covered" : "mismatch",
        detail: matched
          ? "The audited GitHub source exactly matches the Sourcify-verified live source"
          : "The audited GitHub source differs from the Sourcify-verified live source",
        auditValue: historicalHash,
        liveValue: live.contentHash,
      });
      components.push(component);
      sourceComponents.push(component);
    }

    const everyAuditedSourceDecisivelyDiffers = sourceComponents.length > 0
      && sourceComponents.every((component) => component.coverage === "mismatch");
    if (everyAuditedSourceDecisivelyDiffers) {
      for (const component of sourceComponents) component.decisive = true;
    }
  }

  for (const component of components) {
    evidence.push({
      id: component.id,
      source: component.id === "historical-commit" || component.id.startsWith("source:") ? "github" : "rpc",
      label: component.label,
      status: component.coverage === "covered" ? "match" : component.coverage === "mismatch" ? "mismatch" : "unknown",
      strength: component.strength,
      detail: component.detail,
      url: component.id === "historical-commit" && github.repositoryUrl && github.resolvedSha
        ? `${github.repositoryUrl}/commit/${github.resolvedSha}`
        : null,
    });
  }

  if (deployment.verificationStatus !== "verified") {
    limitations.push(deployment.error ?? "Sourcify did not verify the target deployment");
  }
  if (implementation && implementation.verificationStatus !== "verified") {
    limitations.push(implementation.error ?? "Sourcify did not verify the live implementation");
  }
  if (github.error) limitations.push(github.error);

  const verdict = !deployment.hasCode || deployment.verificationStatus === "error"
    ? "UNVERIFIED" as const
    : buildCoverageVerdict(components);
  const confidence = verdictConfidence(verdict, components);
  const reasonByVerdict = {
    CURRENT: "Every critical audited-to-live mapping available to AuditScope matches.",
    PARTIAL: "Some critical mappings match, but other scope evidence is missing or differs.",
    STALE: "Strong evidence shows that the live deployment differs from the audited scope.",
    UNVERIFIED: "There is not enough independently verified evidence to map this audit to the live deployment.",
  } as const;

  return { verdict, confidence, reason: reasonByVerdict[verdict], components, evidence, limitations: [...new Set(limitations)] };
}
