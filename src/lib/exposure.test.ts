import { describe, expect, it } from "vitest";
import type { Db } from "@/types";
import {
  buildExposureReport,
  computeTaskExposure,
  SHORT_MAX_DAYS,
  PROLONGED_MAX_DAYS,
} from "@/lib/exposure";
import { simulateAbsence } from "@/lib/simulation";

/**
 * Fixture with a single critical process/function so tasks resolve as critical,
 * plus one important and one standard task to validate all validation cases.
 */
const db: Db = {
  organization: { id: "org_e", name: "Exposure Org", description: "" },
  areas: [],
  processes: [
    { id: "p_core", name: "Core", description: "", criticality: "critical", organizationId: "org_e" },
    { id: "p_sup", name: "Support", description: "", criticality: "standard", organizationId: "org_e" },
  ],
  functions: [
    { id: "f_core", name: "Core Function", description: "", criticality: "critical", processId: "p_core" },
    { id: "f_imp", name: "Important Function", description: "", criticality: "important", processId: "p_core" },
    { id: "f_std", name: "Standard Function", description: "", criticality: "standard", processId: "p_sup" },
  ],
  tasks: [
    { id: "t_crit_uncovered", name: "Critical uncovered", description: "", functionId: "f_core", criticality: "critical", isDocumented: true, requiredCompetencyIds: [] },
    { id: "t_crit_reduced", name: "Critical reduced", description: "", functionId: "f_core", criticality: "critical", isDocumented: true, requiredCompetencyIds: [] },
    { id: "t_crit_covered", name: "Critical covered", description: "", functionId: "f_core", criticality: "critical", isDocumented: true, requiredCompetencyIds: [] },
    { id: "t_imp", name: "Important task", description: "", functionId: "f_imp", criticality: "important", isDocumented: true, requiredCompetencyIds: [] },
    { id: "t_std", name: "Standard task", description: "", functionId: "f_std", criticality: "standard", isDocumented: true, requiredCompetencyIds: [] },
  ],
  roles: [{ id: "r1", name: "R1", description: "" }],
  people: [
    { id: "p1", name: "Uno", roleId: "r1", isActive: true, competencyIds: [], taskIds: ["t_crit_uncovered", "t_crit_reduced", "t_crit_covered", "t_imp", "t_std"] },
    { id: "p2", name: "Dos", roleId: "r1", isActive: true, competencyIds: [], taskIds: ["t_crit_reduced", "t_crit_covered", "t_imp"] },
    { id: "p3", name: "Tres", roleId: "r1", isActive: true, competencyIds: [], taskIds: ["t_crit_covered", "t_imp"] },
  ],
  competencies: [],
};

const task = (id: string) => db.tasks.find((t) => t.id === id)!;

describe("computeTaskExposure — duration escalates exposure without touching criticality/coverage", () => {
  const short = SHORT_MAX_DAYS;
  const prolonged = PROLONGED_MAX_DAYS;

  it("Critical 1→0: brief → critical, prolonged → prolonged, sustained → sustained", () => {
    expect(computeTaskExposure("critical", "uncovered", 1)).toBe("critical");
    expect(computeTaskExposure("critical", "uncovered", short)).toBe("critical");
    expect(computeTaskExposure("critical", "uncovered", short + 1)).toBe("prolonged");
    expect(computeTaskExposure("critical", "uncovered", prolonged)).toBe("prolonged");
    expect(computeTaskExposure("critical", "uncovered", prolonged + 1)).toBe("sustained");
  });

  it("Critical 2+ → 1 is exposed (still one capable person)", () => {
    expect(computeTaskExposure("critical", "reduced-to-single", 1)).toBe("critical");
  });

  it("Critical with 2+ people keeping coverage has no exposure regardless of duration", () => {
    expect(computeTaskExposure("critical", "none", 1)).toBe("none");
    expect(computeTaskExposure("critical", "none", 90)).toBe("none");
  });

  it("Important task losing coverage is exposed but never reaches sustained", () => {
    expect(computeTaskExposure("important", "uncovered", 1)).toBe("critical");
    expect(computeTaskExposure("important", "uncovered", prolonged + 1)).toBe("prolonged");
  });

  it("Standard task is never flagged for temporal exposure", () => {
    expect(computeTaskExposure("standard", "uncovered", 1)).toBe("none");
    expect(computeTaskExposure("standard", "uncovered", 90)).toBe("none");
  });
});

describe("buildExposureReport over a real simulation", () => {
  it("1→0 critical task escalates with the chosen duration; criticality stays unchanged", () => {
    const result = simulateAbsence(db, "p1", 30);

    // t_crit_uncovered has exactly one capable person (p1) → 1 → 0.
    expect(result.uncoveredCriticalTaskIds).toContain("t_crit_uncovered");
    expect(result.reducedToSingleCriticalTaskIds).not.toContain("t_crit_uncovered");

    const report = buildExposureReport(db, result);
    const exposure = report.tasks.find((t) => t.taskId === "t_crit_uncovered")!;
    expect(exposure.impact).toBe("uncovered");
    expect(exposure.criticality).toBe("critical"); // criticality unchanged
    expect(exposure.days).toBe(30);
    expect(exposure.level).toBe("sustained");
  });

  it("2+→1 critical task and coverage-maintained critical task are distinguished", () => {
    const result = simulateAbsence(db, "p1", 30);
    const report = buildExposureReport(db, result);

    // t_crit_reduced: capable p1,p2 → p1 absent → 1 (2+ → 1).
    expect(report.tasks.find((t) => t.taskId === "t_crit_reduced")!.impact).toBe("reduced-to-single");
    // t_crit_covered: capable p1,p2,p3 → p1 absent → 2 (coverage maintained → no exposure).
    expect(report.tasks.find((t) => t.taskId === "t_crit_covered")!.level).toBe("none");
  });

  it("the absence duration drives the overall exposure", () => {
    const brief = buildExposureReport(db, simulateAbsence(db, "p1", 1));
    const long = buildExposureReport(db, simulateAbsence(db, "p1", 30));
    expect(brief.overall).toBe("critical");
    expect(long.overall).toBe("sustained");
  });
});
