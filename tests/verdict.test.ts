import { describe, expect, it } from "vitest";
import { buildCoverageVerdict } from "../lib/evidence/verdict";

describe("buildCoverageVerdict", () => {
  it("returns CURRENT when every critical component is covered", () => {
    expect(buildCoverageVerdict([{ id: "implementation", critical: true, coverage: "covered" }])).toBe("CURRENT");
  });

  it("returns STALE when the only critical evidence is a decisive mismatch", () => {
    expect(buildCoverageVerdict([{ id: "implementation", critical: true, coverage: "mismatch" }])).toBe("STALE");
  });

  it("returns PARTIAL for mixed covered and unresolved evidence", () => {
    expect(buildCoverageVerdict([
      { id: "proxy", critical: true, coverage: "covered" },
      { id: "implementation", critical: true, coverage: "unresolved" },
    ])).toBe("PARTIAL");
  });

  it("returns UNVERIFIED when no critical component is resolved", () => {
    expect(buildCoverageVerdict([{ id: "implementation", critical: true, coverage: "unresolved" }])).toBe("UNVERIFIED");
  });
});
