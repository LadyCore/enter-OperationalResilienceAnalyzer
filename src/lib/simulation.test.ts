import { describe, expect, it } from "vitest";
import type { Db } from "@/types";
import { simulateAbsence } from "@/lib/simulation";

/**
 * "Critical competencies left with a single holder" must evaluate the
 * POST-ABSENCE number of capable people:
 *   - 2 capable → 1 capable after = SINGLE HOLDER → counted
 *   - 1 capable → 0 capable after = NO COVERAGE → NOT counted (uncovered)
 *   - 3 capable → 2 capable after = NOT single holder → NOT counted
 *
 * Competencies:
 *   cA — held only by Sofia                → 1 → 0 (uncovered)
 *   cB — held by Sofia + One              → 2 → 1 (single holder)
 *   cC — held by Sofia + One + Two        → 3 → 2 (not single holder)
 *   cD — held only by Sofia               → 1 → 0 (uncovered)
 */
const db: Db = {
  organization: { id: "org_s", name: "Single Holder Org", description: "" },
  areas: [],
  processes: [
    { id: "p_core", name: "Core", description: "", criticality: "critical", organizationId: "org_s" },
  ],
  functions: [
    { id: "f_core", name: "Core Function", description: "", criticality: "critical", processId: "p_core" },
  ],
  tasks: [
    { id: "tA", name: "Task A", description: "", functionId: "f_core", criticality: "critical", isDocumented: true, requiredCompetencyIds: ["cA"] },
    { id: "tB", name: "Task B", description: "", functionId: "f_core", criticality: "critical", isDocumented: true, requiredCompetencyIds: ["cB"] },
    { id: "tC", name: "Task C", description: "", functionId: "f_core", criticality: "critical", isDocumented: true, requiredCompetencyIds: ["cC"] },
    { id: "tD", name: "Task D", description: "", functionId: "f_core", criticality: "critical", isDocumented: true, requiredCompetencyIds: ["cD"] },
  ],
  roles: [{ id: "r1", name: "R1", description: "" }],
  people: [
    { id: "p_sofia", name: "Sofia Mendoza", roleIds: ["r1"], isActive: true, competencyIds: ["cA", "cB", "cC", "cD"], taskIds: ["tA", "tB", "tC", "tD"] },
    { id: "p_one", name: "Uno", roleIds: ["r1"], isActive: true, competencyIds: ["cB", "cC"], taskIds: ["tB", "tC"] },
    { id: "p_two", name: "Dos", roleIds: ["r1"], isActive: true, competencyIds: ["cC"], taskIds: ["tC"] },
  ],
  competencies: [
    { id: "cA", name: "Competency A", description: "" },
    { id: "cB", name: "Competency B", description: "" },
    { id: "cC", name: "Competency C", description: "" },
    { id: "cD", name: "Competency D", description: "" },
  ],
};

describe("Critical competencies left with a single holder — post-absence semantics", () => {
  const result = simulateAbsence(db, "p_sofia", 3);

  it("counts a competency that drops 2 → 1 after the absence", () => {
    expect(result.singleHolderCriticalCompetencyIds).toContain("cB");
  });

  it("does NOT count a competency that drops 1 → 0 (it is uncovered, not single-holder)", () => {
    expect(result.singleHolderCriticalCompetencyIds).not.toContain("cA");
    expect(result.singleHolderCriticalCompetencyIds).not.toContain("cD");
    // Those competencies belong to the uncovered results instead.
    expect(result.uncoveredCriticalCompetencyIds).toContain("cA");
    expect(result.uncoveredCriticalCompetencyIds).toContain("cD");
  });

  it("does NOT count a competency that keeps 2+ holders (3 → 2)", () => {
    expect(result.singleHolderCriticalCompetencyIds).not.toContain("cC");
  });

  it("the only single-holder competency is cB", () => {
    expect(result.singleHolderCriticalCompetencyIds).toEqual(["cB"]);
    expect(result.summary.singleHolderCriticalCompetencies).toBe(1);
  });

  it("uncovered and single-holder are disjoint", () => {
    const overlap = result.singleHolderCriticalCompetencyIds.filter((cid) =>
      result.uncoveredCriticalCompetencyIds.includes(cid)
    );
    expect(overlap).toEqual([]);
  });
});

describe("single-holder definition is identical across scenarios (duration never changes it)", () => {
  it("short temporary, long planned, and permanent loss produce the same single-holder set", () => {
    const temporary = simulateAbsence(db, "p_sofia", 3);
    const planned = simulateAbsence(db, "p_sofia", 62);
    const permanent = simulateAbsence(db, "p_sofia", 365); // days param is not a scenario flag

    expect(planned.singleHolderCriticalCompetencyIds).toEqual(temporary.singleHolderCriticalCompetencyIds);
    expect(permanent.singleHolderCriticalCompetencyIds).toEqual(temporary.singleHolderCriticalCompetencyIds);
    expect(temporary.singleHolderCriticalCompetencyIds).toEqual(["cB"]);
  });
});
