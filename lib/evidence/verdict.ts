import type { CoverageVerdict } from "./schemas";

export type ComponentCoverage = "covered" | "mismatch" | "unresolved";

export interface ComponentResult {
  id: string;
  critical: boolean;
  coverage: ComponentCoverage;
}

export function buildCoverageVerdict(components: ComponentResult[]): CoverageVerdict {
  const critical = components.filter((component) => component.critical);
  if (critical.length === 0) return "UNVERIFIED";

  const hasMismatch = critical.some((component) => component.coverage === "mismatch");
  const hasCovered = critical.some((component) => component.coverage === "covered");
  const hasUnresolved = critical.some((component) => component.coverage === "unresolved");

  if (hasMismatch && !hasCovered) return "STALE";
  if (hasMismatch || (hasCovered && hasUnresolved)) return "PARTIAL";
  if (critical.every((component) => component.coverage === "covered")) return "CURRENT";
  return "UNVERIFIED";
}
