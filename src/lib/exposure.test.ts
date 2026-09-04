import { describe, expect, it } from "vitest";
import type { Db } from "@/types";
import {
  buildExposureReport,
  computeTaskExposure,
  describeExposure,
  SHORT_MAX_DAYS,
  PROLONGED_MAX_DAYS,
} from "@/lib/exposure";
import { simulateAbsence, simulateScenario } from "@/lib/simulation";
import { seedDb } from "@/data/seed";

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
    { id: "p1", name: "Uno", roleIds: ["r1"], isActive: true, competencyIds: [], taskIds: ["t_crit_uncovered", "t_crit_reduced", "t_crit_covered", "t_imp_uncovered", "t_imp", "t_std"] },
    { id: "p2", name: "Dos", roleIds: ["r1"], isActive: true, competencyIds: [], taskIds: ["t_crit_reduced", "t_crit_covered", "t_imp"] },
    { id: "p3", name: "Tres", roleIds: ["r1"], isActive: true, competencyIds: [], taskIds: ["t_crit_covered", "t_imp"] },
  ],
  competencies: [],
  vacationCoverages: [],
  onCallAssignments: [],
};

describe("computeTaskExposure — scenario + duration drive exposure, never criticality/coverage", () => {
  it("1→0: 2 days = Short, 10 days = Prolonged, 30 days = Sustained", () => {
    expect(computeTaskExposure("uncovered", false, 2)).toBe("short");
    expect(computeTaskExposure("uncovered", false, 10)).toBe("prolonged");
    expect(computeTaskExposure("uncovered", false, 30)).toBe("sustained");
  });

  it("2+→1 is now exposed as a single-person dependency that escalates with duration", () => {
    expect(computeTaskExposure("reduced-to-single", false, 2)).toBe("short");
    expect(computeTaskExposure("reduced-to-single", false, 10)).toBe("prolonged");
    expect(computeTaskExposure("reduced-to-single", false, 62)).toBe("sustained");
  });

  it("coverage maintained → no exposure regardless of duration", () => {
    expect(computeTaskExposure("none", false, 1)).toBe("none");
    expect(computeTaskExposure("none", false, 90)).toBe("none");
  });

  it("Permanent loss is always sustained (1→0 and 2+→1)", () => {
    expect(computeTaskExposure("uncovered", true, 2)).toBe("sustained");
    expect(computeTaskExposure("reduced-to-single", true, 62)).toBe("sustained");
  });

  it("boundaries follow SHORT_MAX_DAYS and PROLONGED_MAX_DAYS", () => {
    expect(computeTaskExposure("reduced-to-single", false, SHORT_MAX_DAYS)).toBe("short");
    expect(computeTaskExposure("reduced-to-single", false, SHORT_MAX_DAYS + 1)).toBe("prolonged");
    expect(computeTaskExposure("reduced-to-single", false, PROLONGED_MAX_DAYS)).toBe("prolonged");
    expect(computeTaskExposure("reduced-to-single", false, PROLONGED_MAX_DAYS + 1)).toBe("sustained");
  });
});

describe("describeExposure — the same structural impact is interpreted differently by scenario", () => {
  it("3-day temporary 2+→1 → temporary reduction to single-person coverage", () => {
    const d = describeExposure("reduced-to-single", false, 3, "critical");
    expect(d.title).toBe("Temporary reduction to single-person coverage — 3 days");
  });

  it("62-day planned 2+→1 → sustained single-person dependency", () => {
    const d = describeExposure("reduced-to-single", false, 62, "critical");
    expect(d.title).toBe("Sustained single-person dependency — 62 days");
  });

  it("permanent 2+→1 → permanent single-person dependency (structural, not temporary)", () => {
    const d = describeExposure("reduced-to-single", true, 62, "critical");
    expect(d.title).toBe("Permanent single-person dependency");
  });

  it("permanent 1→0 → permanent coverage gap", () => {
    const d = describeExposure("uncovered", true, 62, "critical");
    expect(d.title).toBe("Permanent coverage gap");
  });
});

describe("buildExposureReport over a real simulation", () => {
  it("1→0 critical task escalates with the chosen duration; criticality stays unchanged", () => {
    const result = simulateAbsence(db, "p1", 30);
    expect(result.uncoveredCriticalTaskIds).toContain("t_crit_uncovered");
    expect(result.reducedToSingleCriticalTaskIds).not.toContain("t_crit_uncovered");

    const report = buildExposureReport(db, result);
    const exposure = report.tasks.find((t) => t.taskId === "t_crit_uncovered")!;
    expect(exposure.impact).toBe("uncovered");
    expect(exposure.criticality).toBe("critical");
    expect(exposure.days).toBe(30);
    expect(exposure.level).toBe("sustained");
  });

  it("2+→1 is a reduced-redundancy exposure, never a coverage loss", () => {
    const result = simulateAbsence(db, "p1", 30);
    const report = buildExposureReport(db, result);

    const reduced = report.tasks.find((t) => t.taskId === "t_crit_reduced")!;
    expect(reduced.impact).toBe("reduced-to-single"); // structural fact preserved
    expect(reduced.level).toBe("sustained"); // exposure: 30 days → sustained dependency
    expect(result.uncoveredCriticalTaskIds).not.toContain("t_crit_reduced"); // never "no coverage"

    const covered = report.tasks.find((t) => t.taskId === "t_crit_covered")!;
    expect(covered.level).toBe("none");
  });

  it("temporary overall exposure: 1 day → short, 10 days → prolonged, 30 days → sustained", () => {
    expect(buildExposureReport(db, simulateAbsence(db, "p1", 1)).overall).toBe("short");
    expect(buildExposureReport(db, simulateAbsence(db, "p1", 10)).overall).toBe("prolonged");
    expect(buildExposureReport(db, simulateAbsence(db, "p1", 30)).overall).toBe("sustained");
  });

  it("permanent loss → sustained for every affected coverage change", () => {
    const permanent = buildExposureReport(db, simulateScenario(db, [{ personId: "p1", kind: "permanent" }]));
    expect(permanent.overall).toBe("sustained");
    expect(permanent.tasks.find((t) => t.taskId === "t_crit_uncovered")!.level).toBe("sustained");
    expect(permanent.tasks.find((t) => t.taskId === "t_crit_reduced")!.level).toBe("sustained");
    expect(permanent.tasks.find((t) => t.taskId === "t_crit_covered")!.level).toBe("none");
  });

  it("duration never changes Critical / Important / Standard", () => {
    const short = buildExposureReport(db, simulateAbsence(db, "p1", 2));
    const long = buildExposureReport(db, simulateAbsence(db, "p1", 30));
    for (const t of short.tasks) {
      const same = long.tasks.find((x) => x.taskId === t.taskId)!;
      expect(same.criticality).toBe(t.criticality);
    }
    expect(short.tasks.find((t) => t.taskId === "t_crit_uncovered")!.criticality).toBe("critical");
    expect(short.tasks.find((t) => t.taskId === "t_imp_uncovered")!.criticality).toBe("important");
    expect(short.tasks.find((t) => t.taskId === "t_std")!.criticality).toBe("standard");
  });
});

describe("validation A/B/C — Carlos Mendes", () => {
  const carlos = seedDb.people.find((p) => p.id === "p_carlos")!;
  // Carlos is capable of t_triage, which Ana also covers → 2 capable → 1 when Carlos is absent.
  const triage = seedDb.tasks.find((t) => t.id === "t_triage")!;

  it("structural coverage is the same, but interpretation differs between scenarios", () => {
    const a = buildExposureReport(seedDb, simulateAbsence(seedDb, carlos.id, 3)); // Temporary 3d
    const b = buildExposureReport(seedDb, simulateScenario(seedDb, [{ personId: carlos.id, kind: "planned", days: 62 }])); // Planned 62d
    const c = buildExposureReport(seedDb, simulateScenario(seedDb, [{ personId: carlos.id, kind: "permanent" }])); // Permanent

    const aTask = a.tasks.find((t) => t.taskId === triage.id)!;
    const bTask = b.tasks.find((t) => t.taskId === triage.id)!;
    const cTask = c.tasks.find((t) => t.taskId === triage.id)!;

    // Same structural impact across all three.
    expect(aTask.impact).toBe("reduced-to-single");
    expect(bTask.impact).toBe("reduced-to-single");
    expect(cTask.impact).toBe("reduced-to-single");
    expect(aTask.criticality).toBe("critical");
    expect(bTask.criticality).toBe("critical");
    expect(cTask.criticality).toBe("critical");

    // But materially different interpretations.
    expect(aTask.level).toBe("short");
    expect(aTask.description.title).toBe("Temporary reduction to single-person coverage — 3 days");
    expect(bTask.level).toBe("sustained");
    expect(bTask.description.title).toBe("Sustained single-person dependency — 62 days");
    expect(cTask.level).toBe("sustained");
    expect(cTask.description.title).toBe("Permanent single-person dependency");

    const titles = new Set([aTask.description.title, bTask.description.title, cTask.description.title]);
    expect(titles.size).toBe(3);
  });
});

describe("mixed scenarios classify exposure per task by its governing absences", () => {
  it("a 10-day vacation and a permanent loss coexist: permanent only marks its own tasks", () => {
    // Diana owns t_quote alone; Franco owns t_filings alone. One planned 10-day
    // absence plus one permanent loss in the SAME scenario.
    const result = simulateScenario(seedDb, [
      { personId: "p_diana", kind: "planned", days: 10 },
      { personId: "p_franco", kind: "permanent" },
    ]);
    const report = buildExposureReport(seedDb, result);

    // t_quote governed by Diana's 10-day absence → prolonged, not sustained.
    const quote = report.tasks.find((t) => t.taskId === "t_quote")!;
    expect(quote.impact).toBe("uncovered");
    expect(quote.days).toBe(10);
    expect(quote.level).toBe("prolonged");

    // t_filings governed by Franco's permanent loss → sustained.
    const filings = report.tasks.find((t) => t.taskId === "t_filings")!;
    expect(filings.impact).toBe("uncovered");
    expect(filings.level).toBe("sustained");
  });
});
