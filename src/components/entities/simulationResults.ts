import type { Criticality } from "@/types";

/**
 * Presentation rule for simulation results: when a CRITICAL task ends with zero
 * capable people (uncovered), the results must call it out explicitly with the
 * coverage-gap duration. Returns the gap days when the rule applies, otherwise
 * null. Pure — it never changes simulation facts or competency metrics.
 */
export function criticalUncoveredDays(opts: {
  taskId: string;
  uncoveredTaskIds: string[];
  criticality: Criticality;
  exposureDays?: number;
}): number | null {
  if (!opts.uncoveredTaskIds.includes(opts.taskId)) return null;
  if (opts.criticality !== "critical") return null;
  return opts.exposureDays ?? null;
}
