import { describe, expect, it } from "vitest";
import type { Db } from "@/types";
import { simulateScenario } from "@/lib/simulation";

/**
 * H-018 fixture: two people capable of the same task ("Onboard new hires"),
 * with planned absences that can be combined in different time windows.
 */
const db: Db = {
  organization: { id: "org_h", name: "H018 Org", description: "" },
  areas: [],
  processes: [
    { id: "p_h", name: "People", description: "", criticality: "critical", organizationId: "org_h" },
  ],
  functions: [
    { id: "f_h", name: "People Function", description: "", criticality: "critical", processId: "p_h" },
  ],
  tasks: [
    {
      id: "t_onboard",
      name: "Onboard new hires",
      description: "",
      functionId: "f_h",
      criticality: "critical",
      isDocumented: true,
      requiredCompetencyIds: [],
    },
  ],
  roles: [{ id: "r1", name: "R1", description: "" }],
  people: [
    { id: "p_jorge", name: "Jorge Ferreira", roleIds: ["r1"], isActive: true, competencyIds: [], taskIds: ["t_onboard"] },
    { id: "p_gabriela", name: "Gabriela Duarte", roleIds: ["r1"], isActive: true, competencyIds: [], taskIds: ["t_onboard"] },
  ],
  competencies: [],
  vacationCoverages: [],
  onCallAssignments: [],
};

describe("H-018 — planned absences are evaluated per time interval", () => {
  it("non-overlapping absences never create a simultaneous 2 → 0 gap", () => {
    const result = simulateScenario(db, [
      { personId: "p_jorge", kind: "planned", startDate: "2026-09-07", endDate: "2026-09-14", days: 8 },
      { personId: "p_gabriela", kind: "planned", startDate: "2026-09-16", endDate: "2026-09-30", days: 15 },
    ]);

    // At most one person is absent at any moment.
    expect(result.maxSimultaneousAbsences).toBe(1);
    expect(result.absences.length).toBe(2);

    // The task is NEVER without coverage.
    expect(result.uncoveredTaskIds).not.toContain("t_onboard");
    // It is reduced to a single capable person during each absence window.
    expect(result.reducedToSingleTaskIds).toContain("t_onboard");

    // Worst moment is 1 capable → "2 → 1", never "2 → 0".
    const change = result.taskChanges.find((c) => c.taskId === "t_onboard")!;
    expect(change.before.capableCount).toBe(2);
    expect(change.after.capableCount).toBe(1);
    expect(change.after.level).toBe("high");

    // Calendar-accurate loss: 07–14 (8d) + 16–30 (15d) reduced, 0 days uncovered.
    const facts = result.coverageLossDaysByTask!["t_onboard"];
    expect(facts.uncoveredDays).toBe(0);
    expect(facts.lossDays).toBe(23);
  });

  it("genuinely overlapping absences still detect a real simultaneous gap", () => {
    const result = simulateScenario(db, [
      { personId: "p_jorge", kind: "planned", startDate: "2026-09-07", endDate: "2026-09-14", days: 8 },
      { personId: "p_gabriela", kind: "planned", startDate: "2026-09-10", endDate: "2026-09-20", days: 11 },
    ]);

    expect(result.maxSimultaneousAbsences).toBe(2);
    expect(result.uncoveredTaskIds).toContain("t_onboard");

    const change = result.taskChanges.find((c) => c.taskId === "t_onboard")!;
    expect(change.after.capableCount).toBe(0);
    expect(change.after.level).toBe("none");

    // Overlap 10–14 = 5 uncovered days; coverage is below full (2) for the
    // whole span: 07–09 (3d) + 10–14 (5d) + 15–20 (6d) = 14 loss days.
    const facts = result.coverageLossDaysByTask!["t_onboard"];
    expect(facts.uncoveredDays).toBe(5);
    expect(facts.lossDays).toBe(14);
  });

  it("a person with two separate planned absences is handled as two windows", () => {
    const result = simulateScenario(db, [
      { personId: "p_jorge", kind: "planned", startDate: "2026-09-07", endDate: "2026-09-14", days: 8 },
      { personId: "p_jorge", kind: "planned", startDate: "2026-09-20", endDate: "2026-09-24", days: 5 },
      { personId: "p_gabriela", kind: "planned", startDate: "2026-09-16", endDate: "2026-09-30", days: 15 },
    ]);

    // Jorge 20–24 overlaps Gabriela 16–30 → a real simultaneous gap there.
    expect(result.maxSimultaneousAbsences).toBe(2);
    expect(result.uncoveredTaskIds).toContain("t_onboard");
    const facts = result.coverageLossDaysByTask!["t_onboard"];
    expect(facts.uncoveredDays).toBe(5); // 20–24 inclusive
  });

  it("a day with nobody absent (15/09) is a separate full-capacity interval", () => {
    const result = simulateScenario(db, [
      { personId: "p_jorge", kind: "planned", startDate: "2026-09-07", endDate: "2026-09-14", days: 8 },
      { personId: "p_gabriela", kind: "planned", startDate: "2026-09-16", endDate: "2026-09-30", days: 15 },
    ]);

    // lossDays == 23 of 24 scenario days: exactly one day (15/09) has both.
    const facts = result.coverageLossDaysByTask!["t_onboard"];
    expect(facts.lossDays).toBe(23);
    expect(result.maxSimultaneousAbsences).toBe(1);
  });
});
