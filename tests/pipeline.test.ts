import { describe, expect, it, vi } from "vitest";
import { verifyAuditCoverage, type PipelineDependencies } from "../lib/verification/pipeline";
import { contentHash } from "../lib/evidence/hash";
import type { AuditScope, DeploymentEvidence, GitHubEvidence } from "../lib/evidence/schemas";

const proxy = "0x1111111111111111111111111111111111111111";
const implementation = "0x2222222222222222222222222222222222222222";
const code = "contract VaultV1 {}";

const audit: AuditScope = {
  auditor: { value: "Auditor", confidence: "high", evidence: [{ page: 1, excerpt: "Auditor" }] },
  title: { value: "Vault", confidence: "high", evidence: [{ page: 1, excerpt: "Vault" }] },
  auditDate: { value: null, confidence: "low", evidence: [] },
  repositoryUrl: { value: "https://github.com/example/vault", confidence: "high", evidence: [{ page: 2, excerpt: "github" }] },
  commitSha: { value: "a".repeat(40), confidence: "high", evidence: [{ page: 2, excerpt: "commit" }] },
  tag: { value: null, confidence: "low", evidence: [] },
  contractAddresses: { value: [proxy], confidence: "high", evidence: [{ page: 2, excerpt: proxy }] },
  implementationAddresses: { value: [implementation], confidence: "high", evidence: [{ page: 2, excerpt: implementation }] },
  sourceFiles: [{ path: "contracts/Vault.sol", contractName: "VaultV1", evidence: [{ page: 2, excerpt: "Vault.sol" }] }],
  exclusions: [], uncertainties: [],
};

function deployment(address: string, isProxy: boolean): DeploymentEvidence {
  return {
    chainId: 84532, requestedAddress: address, hasCode: true, verificationStatus: "verified",
    match: "exact_match", contractName: isProxy ? "Proxy" : "VaultV1", isProxy,
    proxyType: isProxy ? "EIP-1967/UUPS" : null,
    implementationAddress: isProxy ? implementation : null,
    proxyResolutionSource: isProxy ? "eip1967" : "none",
    sources: isProxy ? [] : [{ path: "contracts/Vault.sol", content: code, contentHash: contentHash(code) }],
    error: null,
  };
}

const github: GitHubEvidence = {
  repositoryUrl: "https://github.com/example/vault", owner: "example", repository: "vault",
  requestedRef: "a".repeat(40), resolvedSha: "a".repeat(40), commitVerified: true,
  files: [{ path: "contracts/Vault.sol", content: code, blobSha: "blob", url: "https://github.com/example/vault/blob/a/contracts/Vault.sol" }],
  error: null,
};

describe("verifyAuditCoverage", () => {
  it("runs the bounded proxy pipeline and reports real stage completion", async () => {
    const dependencies: PipelineDependencies = {
      extract: vi.fn().mockResolvedValue(audit),
      deployment: vi.fn(async (_chainId, address) => deployment(address, address === proxy)),
      github: vi.fn().mockResolvedValue(github),
    };
    const observed: string[] = [];
    const result = await verifyAuditCoverage({
      pdf: new Uint8Array([1]), chainId: 84532, address: proxy, dependencies,
      onStage: (stage) => observed.push(stage.id),
    });
    expect(result.verdict).toBe("CURRENT");
    expect(observed).toEqual(["audit", "deployment", "implementation", "github", "comparison"]);
    expect(dependencies.deployment).toHaveBeenCalledTimes(2);
  });
});
