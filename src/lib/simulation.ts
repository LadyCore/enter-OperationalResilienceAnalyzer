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

/**
 * Run a multi-person absence scenario: all selected people are unavailable
 * SIMULTANEOUSLY, vacation coverage (B → A, only for A's planned Vacation
 * absence, only when B is not absent) can keep some of A's capabilities covered,
 * and the whole organization is re-analyzed as a single joint state. The result
 * is never the sum of individual simulations.
 */
export function simulateScenario(db: Db, absences: ScenarioAbsence[]): ScenarioResult {
  const resolved = resolveAbsences(db, absences);
  const absentIds = new Set(resolved.map((r) => r.person.id));
  const byAbsentId = new Map(resolved.map((r) => [r.person.id, r]));

  // A copy of the db where the absent people are inactive (their ordinary
  // profile is untouched; availability is what changes).
  const simulatedPeople = db.people.map((p) =>
    absentIds.has(p.id) ? { ...p, isActive: false } : p
  );

  /*
   * Vacation coverage. Only for people absent on a planned Vacation; the
   * coverer must be active and must NOT be absent in the same scenario. The
   * covered task/competency sets are grafted onto the coverer only inside this
   * simulated copy — the base analysis never sees them.
   */
  const appliedCoverages: ScenarioResult["appliedCoverages"] = [];
  const vacationCoveredTaskIds = new Set<string>();
  const vacationCoveredCompetencyIds = new Set<string>();

  for (const cov of db.vacationCoverages ?? []) {
    const covered = byAbsentId.get(cov.coveredPersonId);
    if (!covered) continue;
    if (!isVacationAbsence(covered)) continue;
    if (!cov.coveringPersonId || absentIds.has(cov.coveringPersonId)) continue;
    const coverer = simulatedPeople.find((p) => p.id === cov.coveringPersonId);
    if (!coverer || !coverer.isActive) continue;
    if (cov.taskIds.length === 0 && cov.competencyIds.length === 0) continue;

    simulatedPeople[simulatedPeople.indexOf(coverer)] = {
      ...coverer,
      taskIds: Array.from(new Set([...coverer.taskIds, ...cov.taskIds])),
      competencyIds: Array.from(new Set([...coverer.competencyIds, ...cov.competencyIds])),
    };
    cov.taskIds.forEach((t) => vacationCoveredTaskIds.add(t));
    cov.competencyIds.forEach((c) => vacationCoveredCompetencyIds.add(c));
    appliedCoverages.push({
      covererName: coverer.name,
      coveredName: covered.person.name,
      taskNames: cov.taskIds
        .map((tid) => db.tasks.find((t) => t.id === tid)?.name ?? tid),
    });
  }

  const simulated: Db = { ...db, people: simulatedPeople };

  const taskIdsOfAbsent = resolved.flatMap((r) => r.person.taskIds);
  const affectedTaskIds = Array.from(new Set(
    taskIdsOfAbsent.filter((tid) => db.tasks.some((t) => t.id === tid))
  ));

  const uncoveredTaskIds = affectedTaskIds.filter(
    (tid) => capablePeople(simulated, tid).length === 0
  );
  const reducedToSingleTaskIds = affectedTaskIds.filter(
    (tid) => capablePeople(db, tid).length >= 2 && capablePeople(simulated, tid).length === 1
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

  /*
   * Competencies: a competency is uncovered when at least one absent person held
   * it and after the scenario NO ONE holds it (the base profile of the
   * remaining people is unchanged; vacation coverage can keep one alive).
   */
  const competenciesOfAbsent = Array.from(new Set(resolved.flatMap((r) => r.person.competencyIds)));
  const uncoveredCompetencyIds = competenciesOfAbsent.filter(
    (cid) => holdersOf(simulated, cid).length === 0
  );

  const criticalCompetencyIds = new Set(
    criticalTasks(db).flatMap((t) => t.requiredCompetencyIds)
  );
  const uncoveredCriticalCompetencyIds = uncoveredCompetencyIds.filter((cid) =>
    criticalCompetencyIds.has(cid)
  );

  // Critical competencies left with exactly one holder after the scenario.
  const singleHolderCriticalCompetencyIds = competenciesOfAbsent.filter(
    (cid) => criticalCompetencyIds.has(cid) && holdersOf(simulated, cid).length === 1
  );

  const concentration = computePersonConcentration(db);
  const busFactorPersonIds = resolved
    .filter((r) => concentration.some((c) => c.person.id === r.person.id))
    .map((r) => r.person.id);

  const taskChanges: TaskChange[] = affectedTaskIds.map((tid) => {
    const task = db.tasks.find((t) => t.id === tid)!;
    return {
      taskId: tid,
      taskName: task.name,
      before: taskDependency(db, tid),
      after: taskDependency(simulated, tid),
    };
  });

  // Which resolved absences changed each affected task (capable before the
  // scenario). Drives the per-task temporal exposure.
  const governingAbsencesByTask: Record<string, ResolvedAbsence[]> = {};
  for (const tid of affectedTaskIds) {
    const capableBefore = new Set(capablePeople(db, tid).map((p) => p.id));
    governingAbsencesByTask[tid] = resolved.filter((r) => capableBefore.has(r.person.id));
  }

  const levelChangedTasks = taskChanges.filter(
    (c) => c.before.level !== c.after.level
  ).length;

  const availablePeople = db.people.filter((p) => p.isActive && !absentIds.has(p.id));

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

/**
 * Single-person temporary absence — compatibility wrapper over the scenario
 * engine (a scenario of exactly one temporary absence).
 */
export function simulateAbsence(db: Db, personId: string, days: number): ScenarioResult {
  return simulateScenario(db, [{ personId, kind: "temporary", days }]);
}
