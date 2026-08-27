import type { Db, Person } from "@/types";
import {
  capablePeople,
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
  taskChanges: TaskChange[];
  summary: {
    affectedTasks: number;
    uncoveredTasks: number;
    reducedToSingle: number;
    affectedFunctions: number;
    affectedProcesses: number;
    uncoveredCompetencies: number;
    uncoveredCriticalCompetencies: number;
    levelChangedTasks: number;
  };
}

/**
 * Simulate the temporary absence of a person by recomputing analysis with
 * that person set inactive, then diffing the results.
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

  const uncoveredCompetencyIds = person.competencyIds.filter(
    (cid) => holdersOf(simulated, cid).length === 0
  );

  const criticalCompetencyIds = new Set(
    db.tasks
      .filter((t) => t.criticality === "critical")
      .flatMap((t) => t.requiredCompetencyIds)
  );
  const uncoveredCriticalCompetencyIds = uncoveredCompetencyIds.filter((cid) =>
    criticalCompetencyIds.has(cid)
  );

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
    taskChanges,
    summary: {
      affectedTasks: affectedTaskIds.length,
      uncoveredTasks: uncoveredTaskIds.length,
      reducedToSingle: reducedToSingleTaskIds.length,
      affectedFunctions: affectedFunctionIds.length,
      affectedProcesses: affectedProcessIds.length,
      uncoveredCompetencies: uncoveredCompetencyIds.length,
      uncoveredCriticalCompetencies: uncoveredCriticalCompetencyIds.length,
      levelChangedTasks,
    },
  };
}
