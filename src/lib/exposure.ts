import type { Criticality, Db } from "@/types";
import { deriveTaskCriticality } from "@/lib/analysis";
import type { SimulationResult } from "@/lib/simulation";

export type ExposureLevel = "none" | "critical" | "prolonged" | "sustained";

/**
 * Temporal-exposure thresholds — centralized here so they are auditable and easy
 * to recalibrate. They are ORA's analytical approximation of how long a coverage
 * loss lasts during an absence. They are NOT claims about how many days the
 * organization can tolerate a task being down (that data does not exist in the
 * model) and they never change a task's criticality or coverage.
 *
 *   - a short absence lasts <= SHORT_MAX_DAYS
 *   - a prolonged absence lasts <= PROLONGED_MAX_DAYS
 *   - anything longer is treated as sustained / ongoing
 */
export const SHORT_MAX_DAYS = 3;
export const PROLONGED_MAX_DAYS = 14;

export const EXPOSURE_LABELS: Record<ExposureLevel, string> = {
  none: "No exposure",
  critical: "Critical exposure",
  prolonged: "Prolonged exposure",
  sustained: "Sustained exposure",
};

/** Coverage impact of the absence on a task (reuses the existing 1→0 / 2+→1 logic). */
export type CoverageImpact = "none" | "reduced-to-single" | "uncovered";

function durationRank(days: number): number {
  if (days > PROLONGED_MAX_DAYS) return 2;
  if (days > SHORT_MAX_DAYS) return 1;
  return 0;
}

/**
 * Temporal exposure of a single task from the duration of the absence.
 *
 * Only tasks that actually LOSE coverage are exposed. Relevance comes from the
 * task's derived criticality (standard tasks never create a temporal exposure
 * flag), and the duration escalates the SAME coverage loss over time:
 *
 *   criticality: critical=2, important=1, standard=0  (0 → no exposure)
 *   impact:      uncovered (1→0)=2, reduced-to-single (2+→1)=1
 *   duration:    short=0, prolonged=1, sustained=2
 *   score = criticality + impact + duration
 *   score >= 6 → sustained; >= 5 → prolonged; >= 3 → critical; else none
 *
 * This is interpretation only: it never changes the task's criticality nor its
 * coverage/dependency.
 */
export function computeTaskExposure(
  criticality: Criticality,
  impact: CoverageImpact,
  days: number,
): ExposureLevel {
  if (impact === "none") return "none";

  const relevance = criticality === "critical" ? 2 : criticality === "important" ? 1 : 0;
  if (relevance === 0) return "none";

  const impactScore = impact === "uncovered" ? 2 : 1;
  const score = relevance + impactScore + durationRank(days);

  if (score >= 6) return "sustained";
  if (score >= 5) return "prolonged";
  if (score >= 3) return "critical";
  return "none";
}

export interface TaskExposure {
  taskId: string;
  taskName: string;
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
 */
export function buildExposureReport(db: Db, result: SimulationResult): ExposureReport {
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
      level: computeTaskExposure(criticality, impact, result.days),
    };
  });

  const counts: ExposureReport["counts"] = { critical: 0, prolonged: 0, sustained: 0 };
  for (const t of tasks) {
    if (t.level !== "none") counts[t.level] += 1;
  }
  const overall: ExposureLevel =
    counts.sustained > 0
      ? "sustained"
      : counts.prolonged > 0
        ? "prolonged"
        : counts.critical > 0
          ? "critical"
          : "none";

  return { tasks, counts, overall };
}
