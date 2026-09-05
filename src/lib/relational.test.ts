import { describe, expect, it } from "vitest";
import { seedDb } from "@/data/seed";
import {
  competenciesRequiredBy,
  peopleAssignedTo,
  relatedPeopleForProcesses,
  tasksForProcess,
  taskProcess,
} from "@/lib/relational";

const db = seedDb;

describe("relational filter helpers (real ORA relationships)", () => {
  it("tasksForProcess returns tasks whose functions belong to the process", () => {
    for (const process of db.processes) {
      const fnIds = new Set(db.functions.filter((f) => f.processId === process.id).map((f) => f.id));
      const tasks = tasksForProcess(db, process.id);
      expect(tasks.every((task) => fnIds.has(task.functionId))).toBe(true);
    }
  });

  it("taskProcess resolves the real parent process", () => {
    for (const task of db.tasks) {
      const fn = db.functions.find((f) => f.id === task.functionId);
      const expected = fn ? db.processes.find((p) => p.id === fn.processId) : undefined;
      expect(taskProcess(db, task).process?.id).toBe(expected?.id);
    }
  });

  it("peopleAssignedTo returns only people whose taskIds intersect the given tasks", () => {
    const allTaskIds = db.tasks.map((t) => t.id);
    const people = peopleAssignedTo(db, allTaskIds);
    expect(people.every((p) => p.taskIds.some((id) => allTaskIds.includes(id)))).toBe(true);
  });

  it("competenciesRequiredBy returns only competencies required by the given tasks", () => {
    const allTaskIds = db.tasks.map((t) => t.id);
    const comps = competenciesRequiredBy(db, allTaskIds);
    const requiredIds = new Set(db.tasks.flatMap((t) => t.requiredCompetencyIds));
    expect(comps.every((c) => requiredIds.has(c.id))).toBe(true);
  });

  it("relatedPeopleForProcesses only returns people linked via real relationships", () => {
    const processIds = db.processes.map((p) => p.id);
    const related = relatedPeopleForProcesses(db, processIds);
    const knownIds = new Set(db.people.map((p) => p.id));
    expect(related.every((r) => knownIds.has(r.person.id))).toBe(true);
    // Every related person is either assigned to a task of a process or holds a
    // competency required by one of those tasks.
    for (const r of related) {
      const viaTask = r.person.taskIds.some((tid) =>
        db.tasks.some(
          (task) => task.id === tid && db.functions.some((f) => f.id === task.functionId && processIds.includes(f.processId)),
        ),
      );
      const viaCompetency = r.person.competencyIds.some((cid) =>
        db.tasks.some((task) => task.requiredCompetencyIds.includes(cid)),
      );
      expect(viaTask || viaCompetency).toBe(true);
    }
  });

  it("an empty process set yields no related people (clear/restore behavior)", () => {
    expect(relatedPeopleForProcesses(db, [])).toEqual([]);
  });
});
