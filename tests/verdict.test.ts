import { describe, expect, it } from "vitest";
import { buildCoverageVerdict } from "../lib/evidence/verdict";

function component(
  coverage: "covered" | "mismatch" | "unresolved",
  decisive = false,
) {
  return {
    id: "implementation",
    label: "Implementation",
    critical: true,
    coverage,
    decisive,
    detail: "test evidence",
    auditValue: null,
    liveValue: null,
  } as const;
}

describe("buildCoverageVerdict", () => {
  it("returns CURRENT when every critical component is covered", () => {
    expect(buildCoverageVerdict([component("covered")])).toBe("CURRENT");
  });

  it("returns STALE when the only critical evidence is a decisive mismatch", () => {
    expect(buildCoverageVerdict([component("mismatch")])).toBe("STALE");
  });

  it("returns PARTIAL for mixed covered and unresolved evidence", () => {
    expect(buildCoverageVerdict([
      { ...component("covered"), id: "proxy" },
      component("unresolved"),
    ])).toBe("PARTIAL");
  });

  it("returns UNVERIFIED when no critical component is resolved", () => {
    expect(buildCoverageVerdict([component("unresolved")])).toBe("UNVERIFIED");
  });

  it("returns STALE for a decisive implementation mismatch even with other coverage", () => {
    expect(buildCoverageVerdict([
      { ...component("covered"), id: "proxy" },
      component("mismatch", true),
    ])).toBe("STALE");
  });
});
