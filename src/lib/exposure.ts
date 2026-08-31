import type { Criticality, Db } from "@/types";
import { deriveTaskCriticality } from "@/lib/analysis";
import type { SimulationResult } from "@/lib/simulation";

export type ExposureLevel = "none" | "short" | "prolonged" | "sustained";

/**
 * Temporal-exposure thresholds — centralized here so they are auditable and easy
 * to recalibrate. They are ORA's analytical approximation of how long a coverage
 * loss lasts during an absence. They are NOT claims about how many days the
 * organization can tolerate a task being down (that data does not exist in the
 * model).
 *
 *   - Short:     1 day .. SHORT_MAX_DAYS
 *   - Prolonged: SHORT_MAX_DAYS+1 .. PROLONGED_MAX_DAYS
 *   - Sustained: > PROLONGED_MAX_DAYS, or any Permanent loss with coverage lost
 */
export const SHORT_MAX_DAYS = 3;
export const PROLONGED_MAX_DAYS = 14;

export const EXPOSURE_LABELS: Record<ExposureLevel, string> = {
  none: "No exposure",
  short: "Short exposure",
  prolonged: "Prolonged exposure",
  sustained: "Sustained exposure",
};

/** Coverage impact of the absence on a task (reuses the existing 1→0 / 2+→1 logic). */
export type CoverageImpact = "none" | "reduced-to-single" | "uncovered";

/**
 * Temporal exposure of a task.
 *
 * Exposure is DURATION-ONLY. It is a separate dimension from criticality:
 *
 *   - only a task that actually LOSES coverage (1 → 0 capable) has exposure;
 *   - 2+ → 1 (reduced redundancy) is NOT a total loss and has no exposure level;
 *   - a Permanent loss with coverage lost is Sustained by definition (no return
 *     expected — ORA does not invent a duration for it);
 *   - otherwise the duration maps to Short / Prolonged / Sustained.
 *
 * Criticality (Standard/Important/Critical) is never an input and never changes.
 */
export function computeTaskExposure(
  impact: CoverageImpact,
  isPermanent: boolean,
  days: number,
): ExposureLevel {
  if (impact !== "uncovered") return "none";

  if (isPermanent) return "sustained";

  if (days <= SHORT_MAX_DAYS) return "short";
  if (days <= PROLONGED_MAX_DAYS) return "prolonged";
  return "sustained";
}

export interface TaskExposure {
  taskId: string;
  taskName: string;
  /** Shown for context only — exposure never derives from or changes this. */
  criticality: Criticality;
  impact: CoverageImpact;
  days: number;
  level: ExposureLevel;
}

export interface ExposureReport {
  /** Every affected task with its temporal exposure (including "none"). */
  tasks: TaskExposure[];
  /** Counts of exposed tasks per non-none level. */
  counts: Record<Exclude<ExposureLevel, "none">, number>;
  /** The highest exposure present (or "none"). */
  overall: ExposureLevel;
}

/**
 * Interpret a completed absence simulation as a temporal-exposure view. This is
 * presentation/interpretation only: it reads the existing coverage results and
 * the chosen duration and never mutates the task, its criticality or coverage.
 *
 * @param isPermanent true when the scenario is a Permanent loss (no return).
 */
export function buildExposureReport(
  db: Db,
  result: SimulationResult,
  isPermanent = false,
): ExposureReport {
  const tasks: TaskExposure[] = result.taskChanges.map((change) => {
    const task = db.tasks.find((t) => t.id === change.taskId);
    const criticality = task ? deriveTaskCriticality(db, task).level : "standard";
    const uncovered = result.uncoveredTaskIds.includes(change.taskId);
    const reduced = result.reducedToSingleTaskIds.includes(change.taskId);
    const impact: CoverageImpact = uncovered ? "uncovered" : reduced ? "reduced-to-single" : "none";
    return {
      taskId: change.taskId,
      taskName: change.taskName,
      criticality,
      impact,
      days: result.days,
      level: computeTaskExposure(impact, isPermanent, result.days),
    };
  });

  const counts: ExposureReport["counts"] = { short: 0, prolonged: 0, sustained: 0 };
  for (const t of tasks) {
    if (t.level !== "none") counts[t.level] += 1;
  }
  const overall: ExposureLevel =
    counts.sustained > 0
      ? "sustained"
      : counts.prolonged > 0
        ? "prolonged"
        : counts.short > 0
          ? "short"
          : "none";

  return { tasks, counts, overall };
}
