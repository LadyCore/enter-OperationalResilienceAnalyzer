import type { Db, Person } from "@/types";
import {
  capablePeople,
  computePersonConcentration,
  criticalTasks,
  deriveProcessCriticality,
  holdersOf,
  taskDependency,
  type TaskDependency,
} from "@/lib/analysis";

export type AbsenceKind = "temporary" | "planned" | "permanent";

/** A person declared unavailable in a scenario, before resolution. */
export interface ScenarioAbsence {
  personId: string;
  kind: AbsenceKind;
  /** Planned-only category (e.g. "Vacation"); informational except Vacation coverage. */
  category?: string;
  /** Effective duration (temporary / planned). Ignored for permanent. */
  days?: number;
  startDate?: string;
  endDate?: string;
}

/** A resolved absence with its person record. */
export interface ResolvedAbsence {
  person: Person;
  kind: AbsenceKind;
  category?: string;
  days: number;
}

export interface TaskChange {
  taskId: string;
  taskName: string;
  before: TaskDependency;
  after: TaskDependency;
}

/** One segment of a task's capability timeline during a dated scenario. */
export interface TaskTimelineSegment {
  /** UTC day numbers of the segment (inclusive). */
  startDay: number;
  endDay: number;
  /** Calendar days in the segment. */
  days: number;
  /** Capable people before the scenario. */
  beforeCount: number;
  /** Capable people during this segment. */
  capableCount: number;
}

export interface ScenarioResult {
  absences: ResolvedAbsence[];
  /** Active people NOT in the scenario (stays available with its ordinary profile). */
  availablePeople: Person[];
  affectedTaskIds: string[];
  uncoveredTaskIds: string[];
  reducedToSingleTaskIds: string[];
  affectedFunctionIds: string[];
  affectedProcessIds: string[];
  uncoveredCompetencyIds: string[];
  uncoveredCriticalCompetencyIds: string[];
  affectedCriticalTaskIds: string[];
  uncoveredCriticalTaskIds: string[];
  reducedToSingleCriticalTaskIds: string[];
  affectedCriticalProcessIds: string[];
  singleHolderCriticalCompetencyIds: string[];
  /** Absent people that individually concentrate critical tasks (bus factor). */
  busFactorAtRisk: boolean;
  busFactorPersonIds: string[];
  criticalTasksLosingBackup: number;
  taskChanges: TaskChange[];
  /** Absences whose absence changed each affected task (used by the exposure view). */
  governingAbsencesByTask: Record<string, ResolvedAbsence[]>;
  /**
   * Interval-derived coverage-loss facts for scenarios with calendar dates:
   * per affected task, the days its coverage fell below the original level
   * (lossDays), the days with zero capability (uncoveredDays), and the longest
   * continuous runs of each (longestLossRun / longestUncoveredRun). Absent for
   * scenarios without dates, where the exposure view falls back to absence
   * durations.
   */
  coverageLossDaysByTask?: Record<
    string,
    {
      lossDays: number;
      uncoveredDays: number;
      longestLossRun: number;
      longestUncoveredRun: number;
    }
  >;
  /**
   * Per affected task, the capability over time: one segment per interval with
   * a constant absent set, so periods with full capability (e.g. a day with no
   * absence) remain visible. Absent for scenarios without calendar dates.
   */
  taskTimelines?: Record<string, TaskTimelineSegment[]>;
  /**
   * Greatest number of distinct people actually absent in any single time
   * interval. Reflects real simultaneity for dated scenarios (e.g. 1 for two
   * non-overlapping planned absences, 2 for a genuine overlap).
   */
  maxSimultaneousAbsences: number;
  /** Tasks of absent people kept covered only thanks to vacation coverage. */
  vacationCoveredTaskIds: string[];
  vacationCoveredCompetencyIds: string[];
  appliedCoverages: { covererName: string; coveredName: string; taskNames: string[] }[];
  summary: {
    affectedTasks: number;
    uncoveredTasks: number;
    reducedToSingle: number;
    affectedFunctions: number;
    affectedProcesses: number;
    uncoveredCompetencies: number;
    uncoveredCriticalCompetencies: number;
    affectedCriticalTasks: number;
    uncoveredCriticalTasks: number;
    reducedToSingleCritical: number;
    affectedCriticalProcesses: number;
    singleHolderCriticalCompetencies: number;
    levelChangedTasks: number;
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** People that lose coverage when the listed absences are applied. */
function absentPersonIdsOf(absences: ScenarioAbsence[]): string[] {
  return Array.from(new Set(absences.map((a) => a.personId)));
}

/** Resolve absences against the db, deduplicating by person (worst kind wins). */
function resolveAbsences(db: Db, absences: ScenarioAbsence[]): ResolvedAbsence[] {
  const byId = new Map<string, ResolvedAbsence>();
  for (const a of absences) {
    const person = db.people.find((p) => p.id === a.personId);
    if (!person) continue; // unknown person → ignored silently
    const days = a.kind === "permanent" ? 0 : Math.max(0, a.days ?? 0);
    const rank = { permanent: 3, planned: 2, temporary: 1 } as const;
    const existing = byId.get(a.personId);
    if (!existing || rank[a.kind] > rank[existing.kind]) {
      byId.set(a.personId, { person, kind: a.kind, category: a.category, days });
    }
  }
  return [...byId.values()];
}

function isVacationAbsence(a: ScenarioAbsence | ResolvedAbsence): boolean {
  return a.kind === "planned" && (a.category ?? "").toLowerCase().replace(/[^a-z]/g, "") === "vacation";
}

/** Whole days (UTC) of an ISO date ("2026-09-07"), used as interval boundaries. */
function dayOf(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
}

/**
 * Run a multi-person absence scenario over a temporal timeline.
 *
 * Planned absences carry individual dates (person, start, end). The scenario
 * is decomposed into contiguous time intervals whose absent set is constant,
 * so non-overlapping absences are never treated as simultaneous: capability is
 * computed per interval and aggregated into per-task facts. Absences without
 * dates (temporary, permanent, or undated planned) apply to the whole scenario
 * exactly as before. Vacation coverage (B → A, only for A's planned Vacation
 * absence) applies only in the intervals where both conditions hold.
 */
export function simulateScenario(db: Db, absences: ScenarioAbsence[]): ScenarioResult {
  const resolved = resolveAbsences(db, absences);
  const absentIds = new Set(resolved.map((r) => r.person.id));
  const byAbsentId = new Map(resolved.map((r) => [r.person.id, r]));

  /*
   * Per-person absence windows. Planned absences with dates become real day
   * intervals; everything else spans the whole scenario. A person can have
   * several dated windows (e.g. two separate leave periods).
   */
  const windowsByPerson = new Map<string, { startDay: number | null; endDay: number | null }[]>();
  const boundaries = new Set<number>();
  for (const a of absences) {
    if (!db.people.some((p) => p.id === a.personId)) continue;
    let startDay: number | null = null;
    let endDay: number | null = null;
    if (a.kind === "planned" && a.startDate && a.endDate) {
      startDay = dayOf(a.startDate);
      endDay = dayOf(a.endDate);
      boundaries.add(startDay);
      boundaries.add(endDay + 1);
    }
    const list = windowsByPerson.get(a.personId) ?? [];
    list.push({ startDay, endDay });
    windowsByPerson.set(a.personId, list);
  }

  const sortedBoundaries = Array.from(boundaries).sort((x, y) => x - y);
  const hasCalendar = sortedBoundaries.length >= 2;
  const intervals: { startDay: number; endDay: number; days: number | null }[] = [];
  if (hasCalendar) {
    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      intervals.push({
        startDay: sortedBoundaries[i]!,
        endDay: sortedBoundaries[i + 1]! - 1,
        days: sortedBoundaries[i + 1]! - sortedBoundaries[i]!,
      });
    }
  } else {
    intervals.push({ startDay: 0, endDay: 0, days: null });
  }

  const absentInInterval = (
    personId: string,
    iv: { startDay: number; endDay: number; days: number | null },
  ): boolean => {
    const windows = windowsByPerson.get(personId) ?? [];
    if (windows.length === 0) return false;
    if (iv.days === null) return true; // symbolic scenario → all absent people apply
    for (const w of windows) {
      if (w.startDay === null) return true; // whole-scenario absence
      if (w.endDay! >= iv.startDay && w.startDay! <= iv.endDay) return true;
    }
    return false;
  };

  /*
   * Per-interval simulated people: interval-absent people are inactive; the
   * vacation coverage is grafted only in the intervals where the covered person
   * is absent and the coverer is available.
   */
  const appliedCoverages: ScenarioResult["appliedCoverages"] = [];
  const appliedCoverageKeys = new Set<string>();
  const vacationCoveredTaskIds = new Set<string>();
  const vacationCoveredCompetencyIds = new Set<string>();

  const simulatedByInterval: Db[] = intervals.map((iv) => {
    const people = db.people.map((p) =>
      absentInInterval(p.id, iv) ? { ...p, isActive: false } : { ...p },
    );
    for (const cov of db.vacationCoverages ?? []) {
      if (!absentInInterval(cov.coveredPersonId, iv)) continue;
      const covered = byAbsentId.get(cov.coveredPersonId);
      if (!covered || !isVacationAbsence(covered)) continue;
      if (!cov.coveringPersonId || absentInInterval(cov.coveringPersonId, iv)) continue;
      const coverer = people.find((p) => p.id === cov.coveringPersonId);
      if (!coverer || !coverer.isActive) continue;
      if (cov.taskIds.length === 0 && cov.competencyIds.length === 0) continue;
      people[people.indexOf(coverer)] = {
        ...coverer,
        taskIds: Array.from(new Set([...coverer.taskIds, ...cov.taskIds])),
        competencyIds: Array.from(new Set([...coverer.competencyIds, ...cov.competencyIds])),
      };
      const key = `${cov.coveringPersonId}:${cov.coveredPersonId}`;
      if (!appliedCoverageKeys.has(key)) {
        appliedCoverageKeys.add(key);
        cov.taskIds.forEach((t) => vacationCoveredTaskIds.add(t));
        cov.competencyIds.forEach((c) => vacationCoveredCompetencyIds.add(c));
        appliedCoverages.push({
          covererName: coverer.name,
          coveredName: covered.person.name,
          taskNames: cov.taskIds
            .map((tid) => db.tasks.find((t) => t.id === tid)?.name ?? tid),
        });
      }
    }
    return { ...db, people };
  });

  const taskIdsOfAbsent = resolved.flatMap((r) => r.person.taskIds);
  const affectedTaskIds = Array.from(new Set(
    taskIdsOfAbsent.filter((tid) => db.tasks.some((t) => t.id === tid))
  ));

  /* Per-task interval aggregation. */
  const uncoveredTaskIds: string[] = [];
  const reducedToSingleTaskIds: string[] = [];
  const coverageLossDaysByTask: ScenarioResult["coverageLossDaysByTask"] = {};
  const taskTimelines: ScenarioResult["taskTimelines"] = {};
  const taskChanges: TaskChange[] = [];
  const governingAbsencesByTask: Record<string, ResolvedAbsence[]> = {};

  for (const tid of affectedTaskIds) {
    const task = db.tasks.find((t) => t.id === tid)!;
    const before = taskDependency(db, tid);
    const capableBefore = new Set(capablePeople(db, tid).map((p) => p.id));
    governingAbsencesByTask[tid] = resolved.filter((r) => capableBefore.has(r.person.id));

    const counts = simulatedByInterval.map((sim) => capablePeople(sim, tid).length);
    const minCount = counts.length ? Math.min(...counts) : before.capableCount;
    const hasUncovered = counts.some((c) => c === 0);
    const isReduced = before.capableCount >= 2 && !hasUncovered && minCount === 1;

    if (hasUncovered) uncoveredTaskIds.push(tid);
    else if (isReduced) reducedToSingleTaskIds.push(tid);

    if (hasCalendar) {
      let lossDays = 0;
      let uncoveredDays = 0;
      let longestLossRun = 0;
      let longestUncoveredRun = 0;
      let curLoss = 0;
      let curUncovered = 0;
      const segments: TaskTimelineSegment[] = [];
      for (let i = 0; i < intervals.length; i++) {
        const iv = intervals[i]!;
        const d = iv.days!;
        const c = counts[i]!;
        segments.push({
          startDay: iv.startDay,
          endDay: iv.endDay,
          days: d,
          beforeCount: before.capableCount,
          capableCount: c,
        });
        if (c < before.capableCount) {
          lossDays += d;
          curLoss += d;
          longestLossRun = Math.max(longestLossRun, curLoss);
        } else {
          curLoss = 0;
        }
        if (c === 0) {
          uncoveredDays += d;
          curUncovered += d;
          longestUncoveredRun = Math.max(longestUncoveredRun, curUncovered);
        } else {
          curUncovered = 0;
        }
      }
      coverageLossDaysByTask[tid] = { lossDays, uncoveredDays, longestLossRun, longestUncoveredRun };
      taskTimelines[tid] = segments;
    }

    // "after" = the task's dependency at its worst moment in the scenario.
    let after: TaskDependency = before;
    if (minCount !== before.capableCount) {
      const worstIndex = counts.indexOf(minCount);
      after = taskDependency(simulatedByInterval[worstIndex]!, tid);
    }
    taskChanges.push({ taskId: tid, taskName: task.name, before, after });
  }

  const uncoveredCompetencyIds = competenciesOfAbsent(resolved).filter(
    (cid) => simulatedByInterval.some((sim) => holdersOf(sim, cid).length === 0)
  );

  const criticalCompetencyIds = new Set(
    criticalTasks(db).flatMap((t) => t.requiredCompetencyIds)
  );
  const uncoveredCriticalCompetencyIds = uncoveredCompetencyIds.filter((cid) =>
    criticalCompetencyIds.has(cid)
  );

  // Critical competencies left with exactly one holder in some interval.
  const singleHolderCriticalCompetencyIds = competenciesOfAbsent(resolved).filter(
    (cid) =>
      criticalCompetencyIds.has(cid) &&
      !uncoveredCompetencyIds.includes(cid) &&
      simulatedByInterval.some((sim) => holdersOf(sim, cid).length === 1)
  );

  const criticalIds = new Set(criticalTasks(db).map((t) => t.id));
  const affectedCriticalTaskIds = affectedTaskIds.filter((tid) => criticalIds.has(tid));
  const uncoveredCriticalTaskIds = uncoveredTaskIds.filter((tid) => criticalIds.has(tid));
  const reducedToSingleCriticalTaskIds = reducedToSingleTaskIds.filter((tid) => criticalIds.has(tid));
  const criticalTasksLosingBackup =
    reducedToSingleCriticalTaskIds.length + uncoveredCriticalTaskIds.length;

  const affectedFunctionIds = Array.from(
    new Set(
      affectedTaskIds
        .map((tid) => db.tasks.find((t) => t.id === tid)?.functionId)
        .filter((f): f is string => Boolean(f))
    )
  );

  const affectedProcessIds = Array.from(
    new Set(
      affectedFunctionIds
        .map((fid) => db.functions.find((f) => f.id === fid)?.processId)
        .filter((p): p is string => Boolean(p))
    )
  );

  const affectedCriticalProcessIds = Array.from(
    new Set(
      affectedCriticalTaskIds
        .map((tid) => db.tasks.find((t) => t.id === tid)?.functionId)
        .filter((f): f is string => Boolean(f))
        .map((fid) => db.functions.find((f) => f.id === fid)?.processId)
        .filter((p): p is string => Boolean(p))
        .filter(
          (pid) =>
            deriveProcessCriticality(db, db.processes.find((p) => p.id === pid)!).level === "critical"
        )
    )
  );

  const concentration = computePersonConcentration(db);
  const busFactorPersonIds = resolved
    .filter((r) => concentration.some((c) => c.person.id === r.person.id))
    .map((r) => r.person.id);

  const levelChangedTasks = taskChanges.filter(
    (c) => c.before.level !== c.after.level
  ).length;

  const availablePeople = db.people.filter((p) => p.isActive && !absentIds.has(p.id));

  const maxSimultaneousAbsences = Math.max(
    0,
    ...intervals.map((iv) => {
      let n = 0;
      for (const personId of windowsByPerson.keys()) {
        if (absentInInterval(personId, iv)) n += 1;
      }
      return n;
    }),
  );

  return {
    absences: resolved,
    availablePeople,
    affectedTaskIds,
    uncoveredTaskIds,
    reducedToSingleTaskIds,
    affectedFunctionIds,
    affectedProcessIds,
    uncoveredCompetencyIds,
    uncoveredCriticalCompetencyIds,
    affectedCriticalTaskIds,
    uncoveredCriticalTaskIds,
    reducedToSingleCriticalTaskIds,
    affectedCriticalProcessIds,
    singleHolderCriticalCompetencyIds,
    busFactorAtRisk: busFactorPersonIds.length > 0,
    busFactorPersonIds,
    criticalTasksLosingBackup,
    taskChanges,
    governingAbsencesByTask,
    coverageLossDaysByTask,
    taskTimelines,
    maxSimultaneousAbsences,
    vacationCoveredTaskIds: Array.from(vacationCoveredTaskIds),
    vacationCoveredCompetencyIds: Array.from(vacationCoveredCompetencyIds),
    appliedCoverages,
    summary: {
      affectedTasks: affectedTaskIds.length,
      uncoveredTasks: uncoveredTaskIds.length,
      reducedToSingle: reducedToSingleTaskIds.length,
      affectedFunctions: affectedFunctionIds.length,
      affectedProcesses: affectedProcessIds.length,
      uncoveredCompetencies: uncoveredCompetencyIds.length,
      uncoveredCriticalCompetencies: uncoveredCriticalCompetencyIds.length,
      affectedCriticalTasks: affectedCriticalTaskIds.length,
      uncoveredCriticalTasks: uncoveredCriticalTaskIds.length,
      reducedToSingleCritical: reducedToSingleCriticalTaskIds.length,
      affectedCriticalProcesses: affectedCriticalProcessIds.length,
      singleHolderCriticalCompetencies: singleHolderCriticalCompetencyIds.length,
      levelChangedTasks,
    },
  };
}

/** Competency ids held by at least one resolved absent person. */
function competenciesOfAbsent(resolved: ResolvedAbsence[]): string[] {
  return Array.from(new Set(resolved.flatMap((r) => r.person.competencyIds)));
}

/**
 * Single-person temporary absence — compatibility wrapper over the scenario
 * engine (a scenario of exactly one temporary absence).
 */
export function simulateAbsence(db: Db, personId: string, days: number): ScenarioResult {
  return simulateScenario(db, [{ personId, kind: "temporary", days }]);
}
