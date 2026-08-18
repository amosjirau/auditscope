import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyGeminiFailure, extractAuditScope } from "../lib/audit/extract";
import { lookupGitHubEvidence, normalizeGitHubRepository } from "../lib/adapters/github";
import type { AuditScope } from "../lib/evidence/schemas";
import { auditScopeSchema } from "../lib/evidence/schemas";

function emptyAudit(repositoryUrl: string | null, commitSha: string | null): AuditScope {
  const field = (value: string | null) => ({ value, confidence: "high" as const, evidence: [] });
  return {
    auditor: field(null), title: field(null), auditDate: field(null), repositoryUrl: field(repositoryUrl),
    commitSha: field(commitSha), tag: field(null),
    contractAddresses: { value: null, confidence: "high", evidence: [] },
    implementationAddresses: { value: null, confidence: "high", evidence: [] },
    addressIsScopeBoundary: { value: null, confidence: "low", evidence: [] },
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

  it("rejects model values without citations and malformed extracted addresses", () => {
    const uncited = emptyAudit("https://github.com/openai/example", null);
    expect(auditScopeSchema.safeParse(uncited).success).toBe(false);
    const malformed = emptyAudit(null, null);
    malformed.contractAddresses = { value: ["0x123"], confidence: "high", evidence: [{ page: 1, excerpt: "0x123" }] };
    expect(auditScopeSchema.safeParse(malformed).success).toBe(false);
  });

  it("classifies Gemini quota, rate-limit, timeout, and schema failures without exposing raw provider errors", () => {
    expect(classifyGeminiFailure(new Error("generate_content_free_tier_requests quota exceeded"))).toMatchObject({
      code: "GEMINI_QUOTA", retryable: false,
    });
    expect(classifyGeminiFailure(new Error("HTTP 429 rate limit"))).toMatchObject({
      code: "GEMINI_RATE_LIMIT", retryable: true,
    });
    expect(classifyGeminiFailure(new Error("Connect Timeout Error"))).toMatchObject({
      code: "GEMINI_TIMEOUT", retryable: true,
    });
    expect(classifyGeminiFailure(new Error("No object generated: response did not match schema"))).toMatchObject({
      code: "GEMINI_INVALID_OUTPUT", retryable: true,
    });
  });
});
