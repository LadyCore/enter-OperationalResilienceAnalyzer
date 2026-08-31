import type { Criticality, Db } from "@/types";
import { deriveTaskCriticality } from "@/lib/analysis";
import type { SimulationResult } from "@/lib/simulation";

export type ExposureLevel = "none" | "short" | "prolonged" | "sustained";

/**
 * Temporal-exposure thresholds — centralized here so they are auditable and easy
 * to recalibrate. They are ORA's analytical approximation of how long a coverage
 * change lasts. They are NOT claims about how many days the organization can
 * tolerate a task being down (that data does not exist in the model).
 *
 *   - Short:     1 day .. SHORT_MAX_DAYS
 *   - Prolonged: SHORT_MAX_DAYS+1 .. PROLONGED_MAX_DAYS
 *   - Sustained: > PROLONGED_MAX_DAYS, or any Permanent loss
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
 * Temporal exposure of a task. This dimension is driven by BOTH the scenario
 * type (isPermanent) and the duration — it never changes the underlying
 * coverage or criticality.
 *
 *   - impact "none" (coverage maintained)          → no exposure
 *   - Permanent loss (any impact)                  → sustained (no return expected)
 *   - otherwise (uncovered 1→0 OR reduced 2+→1)    → by duration: short / prolonged / sustained
 *
 * A 2+→1 reduction is therefore NOT treated as "no coverage": it is classified
 * as a single-person dependency whose severity depends on how long it lasts.
 */
export function computeTaskExposure(
  impact: CoverageImpact,
  isPermanent: boolean,
  days: number,
): ExposureLevel {
  if (impact === "none") return "none";

  if (isPermanent) return "sustained";

  if (days <= SHORT_MAX_DAYS) return "short";
  if (days <= PROLONGED_MAX_DAYS) return "prolonged";
  return "sustained";
}

export interface ExposureDescription {
  /** Short human phrase, e.g. "Prolonged single-person dependency — 62 days". */
  title: string;
  /** Why this is (or is not) serious. */
  note: string;
}

const pluralDays = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

/**
 * Human interpretation of a task's exposure. The same structural impact is
 * described differently depending on scenario type and duration.
 */
export function describeExposure(
  impact: CoverageImpact,
  isPermanent: boolean,
  days: number,
  criticality: Criticality,
): ExposureDescription {
  if (impact === "none") {
    return { title: "Coverage maintained", note: "Other capable people keep this task covered." };
  }

  const relevance =
    criticality === "critical"
      ? "critical "
      : criticality === "important"
        ? "important "
        : "";

  if (isPermanent) {
    return impact === "uncovered"
      ? {
          title: "Permanent coverage gap",
          note: `No one can perform this ${relevance}task and the person will not return — a permanent gap.`,
        }
      : {
          title: "Permanent single-person dependency",
          note: `Only one capable person remains for this ${relevance}task and the person will not return — a persistent structural dependency.`,
        };
  }

  const level = computeTaskExposure(impact, false, days);
  const duration = pluralDays(days);

  if (impact === "uncovered") {
    const horizon = level === "short" ? "Temporary" : level === "prolonged" ? "Prolonged" : "Sustained";
    return {
      title: `${horizon} coverage gap — ${duration}`,
      note:
        level === "short"
          ? `No one can perform this ${relevance}task for ${duration}.`
          : `No one can perform this ${relevance}task for ${duration}; the longer the gap, the greater the operational risk.`,
    };
  }

  if (level === "short") {
    return {
      title: `Temporary reduction to single-person coverage — ${duration}`,
      note: `Only one capable person remains for this ${relevance}task for ${duration}.`,
    };
  }
  const horizon = level === "prolonged" ? "Prolonged" : "Sustained";
  return {
    title: `${horizon} single-person dependency — ${duration}`,
    note: `Only one capable person remains for this ${relevance}task for ${duration}; the organization stays exposed to that person for a long period.`,
  };
}

export interface TaskExposure {
  taskId: string;
  taskName: string;
  /** Shown for context only — exposure never derives from or changes this. */
  criticality: Criticality;
  impact: CoverageImpact;
  days: number;
  level: ExposureLevel;
  description: ExposureDescription;
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
 * the chosen scenario/duration and never mutates the task, its criticality or
 * coverage.
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
    const level = computeTaskExposure(impact, isPermanent, result.days);
    return {
      taskId: change.taskId,
      taskName: change.taskName,
      criticality,
      impact,
      days: result.days,
      level,
      description: describeExposure(impact, isPermanent, result.days, criticality),
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
