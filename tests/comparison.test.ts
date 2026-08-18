import { describe, expect, it } from "vitest";
import { compareEvidence } from "../lib/evidence/compare";
import { contentHash } from "../lib/evidence/hash";
import type { AuditScope, DeploymentEvidence, GitHubEvidence } from "../lib/evidence/schemas";

const address = "0x1111111111111111111111111111111111111111";
const implementation = "0x2222222222222222222222222222222222222222";
const source = "contract Vault { function version() external pure returns(uint) { return 1; } }";

function extracted<T>(value: T) {
  return { value, confidence: "high" as const, evidence: [{ page: 2, excerpt: "scope" }] };
}

function audit(overrides: Partial<AuditScope> = {}): AuditScope {
  return {
    auditor: extracted("Auditor"), title: extracted("Vault audit"), auditDate: extracted("2026-01-01"),
    repositoryUrl: extracted("https://github.com/example/vault"), commitSha: extracted("a".repeat(40)),
    tag: extracted(null), contractAddresses: extracted([address]), implementationAddresses: extracted(null),
    sourceFiles: [{ path: "contracts/Vault.sol", contractName: "Vault", evidence: [{ page: 2, excerpt: "Vault.sol" }] }],
    exclusions: [], uncertainties: [], ...overrides,
  };
}

function deployment(overrides: Partial<DeploymentEvidence> = {}): DeploymentEvidence {
  return {
    chainId: 84532, requestedAddress: address, hasCode: true, verificationStatus: "verified",
    match: "exact_match", contractName: "Vault", isProxy: false, proxyType: null,
    implementationAddress: null, proxyResolutionSource: "none",
    sources: [{ path: "contracts/Vault.sol", content: source, contentHash: contentHash(source) }],
    error: null, ...overrides,
  };
}

function github(overrides: Partial<GitHubEvidence> = {}): GitHubEvidence {
  return {
    repositoryUrl: "https://github.com/example/vault", owner: "example", repository: "vault",
    requestedRef: "a".repeat(40), resolvedSha: "a".repeat(40), commitVerified: true,
    files: [{ path: "contracts/Vault.sol", content: source, blobSha: "blob", url: "https://github.com/example/vault/blob/a/contracts/Vault.sol" }],
    error: null, ...overrides,
  };
}

describe("compareEvidence", () => {
  it("returns CURRENT for exact address, commit, and source evidence", () => {
    expect(compareEvidence({ audit: audit(), deployment: deployment(), implementation: null, github: github() }).verdict).toBe("CURRENT");
  });

  it("returns STALE for a live proxy implementation not covered by the audit", () => {
    const result = compareEvidence({
      audit: audit({ implementationAddresses: extracted(["0x3333333333333333333333333333333333333333"]) }),
      deployment: deployment({ isProxy: true, implementationAddress: implementation, proxyResolutionSource: "eip1967" }),
      implementation: deployment({ requestedAddress: implementation }),
      github: github(),
    });
    expect(result.verdict).toBe("STALE");
  });

  it("returns PARTIAL when a matched address has unresolved source evidence", () => {
    expect(compareEvidence({
      audit: audit(), deployment: deployment({ sources: [] }), implementation: null, github: github(),
    }).verdict).toBe("PARTIAL");
  });

  it("returns STALE when every exact historical source differs from verified live source", () => {
    const changed = `${source}\n// upgraded`;
    expect(compareEvidence({
      audit: audit({ contractAddresses: extracted(null) }),
      deployment: deployment({ sources: [{ path: "contracts/Vault.sol", content: changed, contentHash: contentHash(changed) }] }),
      implementation: null,
      github: github(),
    }).verdict).toBe("STALE");
  });

  it("returns UNVERIFIED when every critical mapping is unresolved", () => {
    const emptyAudit = audit({ contractAddresses: extracted(null), sourceFiles: [] });
    expect(compareEvidence({
      audit: emptyAudit,
      deployment: deployment({ verificationStatus: "error", hasCode: false, error: "RPC unavailable", sources: [] }),
      implementation: null,
      github: github({ commitVerified: false, resolvedSha: null, files: [], error: "GitHub unavailable" }),
    }).verdict).toBe("UNVERIFIED");
  });

  it("never returns CURRENT when GitHub fails", () => {
    const result = compareEvidence({
      audit: audit(), deployment: deployment(), implementation: null,
      github: github({ commitVerified: false, resolvedSha: null, files: [], error: "rate limited" }),
    });
    expect(result.verdict).not.toBe("CURRENT");
  });

  it("returns UNVERIFIED rather than STALE when no live bytecode exists", () => {
    const result = compareEvidence({
      audit: audit({ contractAddresses: extracted(["0x9999999999999999999999999999999999999999"]) }),
      deployment: deployment({ hasCode: false, verificationStatus: "unverified", sources: [], error: "No contract bytecode exists" }),
      implementation: null,
      github: github({ files: [] }),
    });
    expect(result.verdict).toBe("UNVERIFIED");
  });
});
