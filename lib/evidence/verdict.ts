import type { ComponentResult, CoverageVerdict } from "./schemas";

export type ComponentCoverage = "covered" | "mismatch" | "unresolved";

export function buildCoverageVerdict(components: ComponentResult[]): CoverageVerdict {
  const critical = components.filter((component) => component.critical);
  if (critical.length === 0) return "UNVERIFIED";

  const hasDecisiveMismatch = critical.some(
    (component) => component.coverage === "mismatch" && component.decisive,
  );
  const mismatches = critical.filter((component) => component.coverage === "mismatch");
  const hasCovered = critical.some((component) => component.coverage === "covered");
  const hasUnresolved = critical.some((component) => component.coverage === "unresolved");

  if (hasDecisiveMismatch) return "STALE";
  if (mismatches.length > 0 && !hasCovered) return "STALE";
  if (mismatches.length > 0 || (hasCovered && hasUnresolved)) return "PARTIAL";
  if (critical.every((component) => component.coverage === "covered")) return "CURRENT";
  return "UNVERIFIED";
}

export function verdictConfidence(
  verdict: CoverageVerdict,
  components: ComponentResult[],
): "high" | "medium" | "low" {
  const critical = components.filter((component) => component.critical);
  if (verdict === "UNVERIFIED" || critical.length === 0) return "low";
  if (critical.some((component) => component.coverage === "unresolved")) return "medium";
  return "high";
}
