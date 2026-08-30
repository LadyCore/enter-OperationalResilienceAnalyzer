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

export interface TaskChange {
  taskId: string;
  taskName: string;
  before: TaskDependency;
  after: TaskDependency;
}

export interface SimulationResult {
  person: Person;
  days: number;
  affectedTaskIds: string[];
  uncoveredTaskIds: string[];
  reducedToSingleTaskIds: string[];
  affectedFunctionIds: string[];
  affectedProcessIds: string[];
  uncoveredCompetencyIds: string[];
  uncoveredCriticalCompetencyIds: string[];
  /** Critical tasks (derived) the absent person can perform. */
  affectedCriticalTaskIds: string[];
  /** Critical tasks that drop to zero capable people (1 → 0). */
  uncoveredCriticalTaskIds: string[];
  /** Critical tasks that drop from two or more to exactly one (2+ → 1). */
  reducedToSingleCriticalTaskIds: string[];
  /** Essential processes (containing critical tasks) that lose coverage. */
  affectedCriticalProcessIds: string[];
  /** Critical competencies that end up with exactly one holder after the absence. */
  singleHolderCriticalCompetencyIds: string[];
  /** True when the absent person is a bus-factor candidate (concentrates critical tasks). */
  busFactorAtRisk: boolean;
  /** Critical tasks of this person that lose all backup coverage. */
  criticalTasksLosingBackup: number;
  taskChanges: TaskChange[];
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

/**
 * Simulate the temporary absence of a person by recomputing analysis with
 * that person set inactive, then diffing the results. Coverage changes are
 * always shown as "capability lost" — never as the person's value.
 */
export function simulateAbsence(db: Db, personId: string, days: number): SimulationResult {
  const person = db.people.find((p) => p.id === personId);
  if (!person) {
    throw new Error("Person not found");
  }

  const simulated: Db = {
    ...db,
    people: db.people.map((p) => (p.id === personId ? { ...p, isActive: false } : p)),
  };

  const affectedTaskIds = person.taskIds.filter((tid) => db.tasks.some((t) => t.id === tid));
  const uncoveredTaskIds = affectedTaskIds.filter((tid) => capablePeople(simulated, tid).length === 0);
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

  const uncoveredCompetencyIds = person.competencyIds.filter(
    (cid) => holdersOf(simulated, cid).length === 0
  );

  const criticalCompetencyIds = new Set(
    criticalTasks(db).flatMap((t) => t.requiredCompetencyIds)
  );
  const uncoveredCriticalCompetencyIds = uncoveredCompetencyIds.filter((cid) =>
    criticalCompetencyIds.has(cid)
  );

  // Critical competencies left with exactly one holder after the absence.
  const singleHolderCriticalCompetencyIds = person.competencyIds.filter(
    (cid) => criticalCompetencyIds.has(cid) && holdersOf(simulated, cid).length === 1
  );

  const busFactorAtRisk = computePersonConcentration(db).some((c) => c.person.id === personId);

  const taskChanges: TaskChange[] = affectedTaskIds.map((tid) => {
    const task = db.tasks.find((t) => t.id === tid)!;
    return {
      taskId: tid,
      taskName: task.name,
      before: taskDependency(db, tid),
      after: taskDependency(simulated, tid),
    };
  });

  const levelChangedTasks = taskChanges.filter(
    (c) => c.before.level !== c.after.level
  ).length;

  return {
    person,
    days,
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
    busFactorAtRisk,
    criticalTasksLosingBackup,
    taskChanges,
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
