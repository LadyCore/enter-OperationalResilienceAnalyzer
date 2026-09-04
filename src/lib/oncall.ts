import type { Db } from "@/types";
import { criticalTasks } from "@/lib/analysis";

export interface OnCallTaskCoverage {
  taskId: string;
  taskName: string;
  /** People whose on-call covers this task. */
  people: string[];
}

export interface OnCallMetrics {
  assignments: number;
  /** Distinct people with at least one on-call assignment. */
  peopleCount: number;
  people: string[];
  /** Distinct tasks with on-call coverage. */
  taskCount: number;
  criticalTaskCount: number;
  /** Per-task on-call coverage (drives single-person-on-call detection). */
  taskCoverage: OnCallTaskCoverage[];
  /** Assignments whose modality is H24 (case/accent-insensitive). */
  h24Count: number;
  /** All other modalities (shifts, custom schemes). */
  customCount: number;
  /** Tasks covered by exactly one on-call person — a concentration signal. */
  singlePersonTasks: string[];
}

const normalize = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function isH24(modality: string): boolean {
  const v = normalize(modality).replace(/[^a-z0-9]/g, "");
  return v === "h24" || v === "24" || v === "24x7" || v === "247" || v === "h24x7";
}

/**
 * Passive on-call (guardia pasiva) view. These metrics describe permanent
 * availability outside ordinary hours. They NEVER feed the base coverage
 * analysis (capablePeople/holdersOf) nor vacation-coverage simulations — they
 * are a separate, permanent capability indicator.
 */
export function buildOnCallMetrics(db: Db): OnCallMetrics {
  const assignments = db.onCallAssignments ?? [];
  const peopleIds = Array.from(new Set(assignments.map((a) => a.personId)));
  const people = peopleIds
    .map((id) => db.people.find((p) => p.id === id)?.name ?? id);

  const criticalIds = new Set(criticalTasks(db).map((t) => t.id));

  // Per-task on-call coverage.
  const taskPeople = new Map<string, Set<string>>();
  for (const a of assignments) {
    for (const tid of a.taskIds) {
      if (!taskPeople.has(tid)) taskPeople.set(tid, new Set());
      taskPeople.get(tid)!.add(a.personId);
    }
  }
  const taskCoverage: OnCallTaskCoverage[] = [...taskPeople.entries()]
    .map(([taskId, personSet]) => ({
      taskId,
      taskName: db.tasks.find((t) => t.id === taskId)?.name ?? taskId,
      people: [...personSet].map((id) => db.people.find((p) => p.id === id)?.name ?? id),
    }))
    .sort((a, b) => a.taskName.localeCompare(b.taskName));

  const coveredTaskIds = new Set<string>();
  for (const a of assignments) for (const tid of a.taskIds) coveredTaskIds.add(tid);
  const taskCount = coveredTaskIds.size;
  const criticalTaskCount = [...coveredTaskIds].filter((id) => criticalIds.has(id)).length;

  const h24Count = assignments.filter((a) => isH24(a.modality)).length;
  const customCount = assignments.length - h24Count;

  const singlePersonTasks = taskCoverage
    .filter((t) => t.people.length === 1)
    .map((t) => t.taskName);

  return {
    assignments: assignments.length,
    peopleCount: peopleIds.length,
    people,
    taskCount,
    criticalTaskCount,
    taskCoverage,
    h24Count,
    customCount,
    singlePersonTasks,
  };
}

