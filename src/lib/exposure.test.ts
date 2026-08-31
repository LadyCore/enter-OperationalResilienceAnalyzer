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
 * Fixture with critical / important / standard tasks and coverage setups for
 * 1→0, 2+→1 and maintained-coverage cases.
 */
const db: Db = {
  organization: { id: "org_e", name: "Exposure Org", description: "" },
  areas: [],
  processes: [
    { id: "p_core", name: "Core", description: "", criticality: "critical", organizationId: "org_e" },
    { id: "p_imp", name: "Important", description: "", criticality: "important", organizationId: "org_e" },
    { id: "p_sup", name: "Support", description: "", criticality: "standard", organizationId: "org_e" },
  ],
  functions: [
    { id: "f_core", name: "Core Function", description: "", criticality: "critical", processId: "p_core" },
    { id: "f_imp", name: "Important Function", description: "", criticality: "important", processId: "p_imp" },
    { id: "f_std", name: "Standard Function", description: "", criticality: "standard", processId: "p_sup" },
  ],
  tasks: [
    { id: "t_crit_uncovered", name: "Critical uncovered", description: "", functionId: "f_core", criticality: "critical", isDocumented: true, requiredCompetencyIds: [] },
    { id: "t_crit_reduced", name: "Critical reduced", description: "", functionId: "f_core", criticality: "critical", isDocumented: true, requiredCompetencyIds: [] },
    { id: "t_crit_covered", name: "Critical covered", description: "", functionId: "f_core", criticality: "critical", isDocumented: true, requiredCompetencyIds: [] },
    { id: "t_imp_uncovered", name: "Important uncovered", description: "", functionId: "f_imp", criticality: "important", isDocumented: true, requiredCompetencyIds: [] },
    { id: "t_imp", name: "Important covered", description: "", functionId: "f_imp", criticality: "important", isDocumented: true, requiredCompetencyIds: [] },
    { id: "t_std", name: "Standard task", description: "", functionId: "f_std", criticality: "standard", isDocumented: true, requiredCompetencyIds: [] },
  ],
  roles: [{ id: "r1", name: "R1", description: "" }],
  people: [
    { id: "p1", name: "Uno", roleId: "r1", isActive: true, competencyIds: [], taskIds: ["t_crit_uncovered", "t_crit_reduced", "t_crit_covered", "t_imp_uncovered", "t_imp", "t_std"] },
    { id: "p2", name: "Dos", roleId: "r1", isActive: true, competencyIds: [], taskIds: ["t_crit_reduced", "t_crit_covered", "t_imp"] },
    { id: "p3", name: "Tres", roleId: "r1", isActive: true, competencyIds: [], taskIds: ["t_crit_covered", "t_imp"] },
  ],
  competencies: [],
};

describe("computeTaskExposure — duration-only, never derived from criticality", () => {
  it("1→0 + 2 days = Short; +10 days = Prolonged; +30 days = Sustained", () => {
    expect(computeTaskExposure("uncovered", false, 2)).toBe("short");
    expect(computeTaskExposure("uncovered", false, 10)).toBe("prolonged");
    expect(computeTaskExposure("uncovered", false, 30)).toBe("sustained");
  });

  it("boundaries follow SHORT_MAX_DAYS and PROLONGED_MAX_DAYS", () => {
    expect(computeTaskExposure("uncovered", false, SHORT_MAX_DAYS)).toBe("short");
    expect(computeTaskExposure("uncovered", false, SHORT_MAX_DAYS + 1)).toBe("prolonged");
    expect(computeTaskExposure("uncovered", false, PROLONGED_MAX_DAYS)).toBe("prolonged");
    expect(computeTaskExposure("uncovered", false, PROLONGED_MAX_DAYS + 1)).toBe("sustained");
  });

  it("exposure is identical for Critical, Important and Standard (criticality is not an input)", () => {
    // computeTaskExposure has no criticality parameter — same duration → same exposure
    // for every task, regardless of its Standard/Important/Critical level.
    expect(computeTaskExposure("uncovered", false, 2)).toBe("short");
  });

  it("2+ → 1 (reduced redundancy) is NOT a coverage loss → no exposure", () => {
    expect(computeTaskExposure("reduced-to-single", false, 2)).toBe("none");
    expect(computeTaskExposure("reduced-to-single", false, 30)).toBe("none");
    expect(computeTaskExposure("reduced-to-single", true, 30)).toBe("none");
  });

  it("coverage maintained → no exposure regardless of duration", () => {
    expect(computeTaskExposure("none", false, 1)).toBe("none");
    expect(computeTaskExposure("none", false, 90)).toBe("none");
  });

  it("Permanent loss + 1→0 = Sustained by definition, any days", () => {
    expect(computeTaskExposure("uncovered", true, 2)).toBe("sustained");
    expect(computeTaskExposure("uncovered", true, 10)).toBe("sustained");
    expect(computeTaskExposure("uncovered", true, 365)).toBe("sustained");
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

  it("2+→1 is reported as reduced redundancy, NOT as coverage loss", () => {
    const result = simulateAbsence(db, "p1", 30);
    const report = buildExposureReport(db, result);

    // t_crit_reduced: capable p1,p2 → p1 absent → 1 (2+ → 1).
    const reduced = report.tasks.find((t) => t.taskId === "t_crit_reduced")!;
    expect(reduced.impact).toBe("reduced-to-single");
    expect(reduced.level).toBe("none"); // never "uncovered" / no exposure level
    // t_crit_covered: capable p1,p2,p3 → p1 absent → 2 (maintained).
    expect(report.tasks.find((t) => t.taskId === "t_crit_covered")!.level).toBe("none");
  });

  it("temporary overall exposure: 1 day → short, 10 days → prolonged, 30 days → sustained", () => {
    expect(buildExposureReport(db, simulateAbsence(db, "p1", 1)).overall).toBe("short");
    expect(buildExposureReport(db, simulateAbsence(db, "p1", 10)).overall).toBe("prolonged");
    expect(buildExposureReport(db, simulateAbsence(db, "p1", 30)).overall).toBe("sustained");
  });

  it("permanent loss → sustained for coverage-lost tasks, regardless of days", () => {
    const permanent = buildExposureReport(db, simulateAbsence(db, "p1", 1), true);
    expect(permanent.overall).toBe("sustained");
    expect(permanent.tasks.find((t) => t.taskId === "t_crit_uncovered")!.level).toBe("sustained");
    // Coverage-maintained tasks still have no exposure.
    expect(permanent.tasks.find((t) => t.taskId === "t_crit_covered")!.level).toBe("none");
  });

  it("duration never changes Critical / Important / Standard", () => {
    const short = buildExposureReport(db, simulateAbsence(db, "p1", 2));
    const long = buildExposureReport(db, simulateAbsence(db, "p1", 30));
    for (const t of short.tasks) {
      const same = long.tasks.find((x) => x.taskId === t.taskId)!;
      expect(same.criticality).toBe(t.criticality);
    }
    const crit = short.tasks.find((t) => t.taskId === "t_crit_uncovered")!;
    const imp = short.tasks.find((t) => t.taskId === "t_imp_uncovered")!;
    const std = short.tasks.find((t) => t.taskId === "t_std")!;
    expect(crit.criticality).toBe("critical");
    expect(imp.criticality).toBe("important");
    expect(std.criticality).toBe("standard");
  });
});
