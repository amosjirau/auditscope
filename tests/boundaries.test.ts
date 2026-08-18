import { afterEach, describe, expect, it, vi } from "vitest";
import { extractAuditScope } from "../lib/audit/extract";
import { lookupGitHubEvidence, normalizeGitHubRepository } from "../lib/adapters/github";
import type { AuditScope } from "../lib/evidence/schemas";

function emptyAudit(repositoryUrl: string | null, commitSha: string | null): AuditScope {
  const field = (value: string | null) => ({ value, confidence: "high" as const, evidence: [] });
  return {
    auditor: field(null), title: field(null), auditDate: field(null), repositoryUrl: field(repositoryUrl),
    commitSha: field(commitSha), tag: field(null),
    contractAddresses: { value: null, confidence: "high", evidence: [] },
    implementationAddresses: { value: null, confidence: "high", evidence: [] },
    sourceFiles: [], exclusions: [], uncertainties: [],
  };
}

describe("untrusted input boundaries", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects non-PDF bytes before contacting Gemini", async () => {
    await expect(extractAuditScope(new TextEncoder().encode("not a pdf"))).rejects.toThrow("not a valid PDF");
  });

  it("only normalizes HTTPS github.com repository roots", () => {
    expect(normalizeGitHubRepository("https://github.com/openai/example.git")).toEqual({
      url: "https://github.com/openai/example", owner: "openai", repository: "example",
    });
    expect(normalizeGitHubRepository("https://evil.example/openai/example")).toBeNull();
    expect(normalizeGitHubRepository("https://github.com/openai/example/issues/1")).toBeNull();
  });

  it("returns explicit unresolved GitHub evidence for a missing audit ref without a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const evidence = await lookupGitHubEvidence(emptyAudit("https://github.com/openai/example", null));
    expect(evidence.commitVerified).toBe(false);
    expect(evidence.error).toContain("does not identify a commit or tag");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
