import type { Competency, Criticality, Db, Person, Process, Task } from "@/types";
import { deriveProcessCriticality, deriveTaskCriticality } from "@/lib/analysis";

/**
 * Relational helpers for the exploratory filters in Processes, Tasks and
 * Competencies. Every helper derives exclusively from real ORA relationships:
 *
 *   Process → Function (function.processId)
 *   Function → Task (task.functionId)
 *   Task → Competency (task.requiredCompetencyIds)
 *   Person → Task (person.taskIds)
 *   Person → Competency (person.competencyIds)
 *
 * Criticality filters reuse ORA's real derived-criticality engine
 * (deriveTaskCriticality / deriveProcessCriticality).
 */

export function functionsOfProcess(db: Db, processId: string) {
  return db.functions.filter((f) => f.processId === processId);
}

export function tasksForProcess(db: Db, processId: string): Task[] {
  const fnIds = new Set(functionsOfProcess(db, processId).map((f) => f.id));
  return db.tasks.filter((t) => fnIds.has(t.functionId));
}

export function taskProcess(db: Db, task: Task): { fn: { id: string; name: string } | undefined; process: Process | undefined } {
  const fn = db.functions.find((f) => f.id === task.functionId);
  const process = fn ? db.processes.find((p) => p.id === fn.processId) : undefined;
  return { fn: fn ? { id: fn.id, name: fn.name } : undefined, process };
}

export function tasksForTaskIds(db: Db, taskIds: string[]): Task[] {
  const set = new Set(taskIds);
  return db.tasks.filter((t) => set.has(t.id));
}

export function peopleAssignedTo(db: Db, taskIds: string[]): Person[] {
  const set = new Set(taskIds);
  return db.people.filter((p) => p.taskIds.some((id) => set.has(id)));
}

export function peopleHolding(db: Db, competencyIds: string[]): Person[] {
  const set = new Set(competencyIds);
  return db.people.filter((p) => p.competencyIds.some((id) => set.has(id)));
}

export function competenciesRequiredBy(db: Db, taskIds: string[]): Competency[] {
  const ids = new Set<string>();
  for (const t of db.tasks) {
    if (taskIds.includes(t.id)) t.requiredCompetencyIds.forEach((id) => ids.add(id));
  }
  return db.competencies.filter((c) => ids.has(c.id));
}

export function processesOfTasks(db: Db, taskIds: string[]): Process[] {
  const set = new Set(taskIds);
  const procIds = new Set<string>();
  for (const t of db.tasks) {
    if (!set.has(t.id)) continue;
    const { process } = taskProcess(db, t);
    if (process) procIds.add(process.id);
  }
  return db.processes.filter((p) => procIds.has(p.id));
}

/** Derived criticality of a task (real engine). */
export function taskCriticality(db: Db, task: Task): Criticality {
  return deriveTaskCriticality(db, task).level;
}

/** Derived criticality of a process (real engine). */
export function processCriticality(db: Db, process: Process): Criticality {
  return deriveProcessCriticality(db, process).level;
}

export interface RelatedPerson {
  person: Person;
  /** Distinct tasks of the current process set this person is assigned to. */
  taskCount: number;
  /** Processes of the current set this person is related to (via tasks or competencies). */
  processes: string[];
  /** Distinct required competencies of the current set that this person holds. */
  competencyCount: number;
}

/**
 * People related to a set of processes (impact view): people assigned to the
 * processes' tasks plus people who hold competencies required by those tasks.
 * Everything is derived from real relationships only.
 */
export function relatedPeopleForProcesses(db: Db, processIds: string[]): RelatedPerson[] {
  const tasks = processIds.flatMap((pid) => tasksForProcess(db, pid));
  const taskIds = tasks.map((t) => t.id);
  const competencies = competenciesRequiredBy(db, taskIds);
  const compIds = new Set(competencies.map((c) => c.id));
  const taskIdSet = new Set(taskIds);

  const processesOfTaskIds = (ids: string[]): string[] => {
    const names = new Set<string>();
    for (const t of db.tasks) {
      if (!ids.includes(t.id)) continue;
      const { process } = taskProcess(db, t);
      if (process && processIds.includes(process.id)) names.add(process.name);
    }
    return [...names];
  };

  const byId = new Map<string, RelatedPerson>();

  // Primary: people assigned to the processes' tasks.
  for (const person of peopleAssignedTo(db, taskIds)) {
    const owned = person.taskIds.filter((id) => taskIdSet.has(id));
    byId.set(person.id, {
      person,
      taskCount: owned.length,
      processes: processesOfTaskIds(owned),
      competencyCount: person.competencyIds.filter((id) => compIds.has(id)).length,
    });
  }

  // Secondary: holders of competencies required by those tasks (if not already listed).
  for (const person of peopleHolding(db, [...compIds])) {
    if (byId.has(person.id)) continue;
    const heldComps = person.competencyIds.filter((id) => compIds.has(id));
    const relatedTaskIds = db.tasks
      .filter((t) => taskIdSet.has(t.id) && t.requiredCompetencyIds.some((id) => heldComps.includes(id)))
      .map((t) => t.id);
    byId.set(person.id, {
      person,
      taskCount: 0,
      processes: processesOfTaskIds(relatedTaskIds),
      competencyCount: heldComps.length,
    });
  }

  return [...byId.values()].sort((a, b) => a.person.name.localeCompare(b.person.name));
}
