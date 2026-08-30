import { describe, expect, it } from "vitest";
import type { Db } from "@/types";
import {
  computeDashboardMetrics,
  computeCompetencyConcentration,
  computePersonConcentration,
  criticalTasks,
  deriveProcessCriticality,
  deriveTaskCriticality,
  detectRiskFlags,
} from "@/lib/analysis";
import { simulateAbsence } from "@/lib/simulation";

/**
 * Deliberate test organization (declared criticality → "declared mode"):
 * - a critical process (p_core) concentrating several critical tasks
 * - critical tasks covered by 1, 2 and 3+ people
 * - people concentrating critical tasks (p1 with 5, p4 with 3)
 * - critical competencies concentrated in one person (c_tax, c_signon)
 * - critical undocumented tasks (t_taxtax, t_inc)
 * - single-role covered critical tasks (t_bak, t_signon)
 * - an important task with a single capable person (t_cheque → important, NOT critical)
 * - an important task with strong redundancy (t_po → important, adequate)
 * - standard tasks with a single capable person (t_supplies, t_rec → standard, NOT critical)
 */
const db: Db = {
  organization: { id: "org_t", name: "Test Org", description: "" },
  areas: [],
  processes: [
    { id: "p_core", name: "Core Production", description: "", criticality: "critical", organizationId: "org_t" },
    { id: "p_hr", name: "Payroll & Compliance", description: "", criticality: "important", organizationId: "org_t" },
    { id: "p_support", name: "Support", description: "", criticality: "standard", organizationId: "org_t" },
  ],
  functions: [
    { id: "f_payroll", name: "Payroll Execution", description: "", criticality: "critical", processId: "p_core" },
    { id: "f_backup", name: "Backup & Recovery", description: "", criticality: "important", processId: "p_core" },
    { id: "f_payadmin", name: "Payroll Administration", description: "", criticality: "important", processId: "p_hr" },
    { id: "f_office", name: "Office", description: "", criticality: "standard", processId: "p_support" },
  ],
  tasks: [
    { id: "t_payrun", name: "Run payroll run", description: "", functionId: "f_payroll", criticality: "critical", isDocumented: true, requiredCompetencyIds: ["c_payroll"] },
    { id: "t_taxtax", name: "File tax returns", description: "", functionId: "f_payroll", criticality: "critical", isDocumented: false, requiredCompetencyIds: ["c_tax"] },
    { id: "t_inc", name: "Triage incidents", description: "", functionId: "f_backup", criticality: "critical", isDocumented: false, requiredCompetencyIds: ["c_incident"] },
    { id: "t_restore", name: "Restore systems", description: "", functionId: "f_backup", criticality: "critical", isDocumented: true, requiredCompetencyIds: ["c_dr", "c_db"] },
    { id: "t_bak", name: "Execute database backups", description: "", functionId: "f_backup", criticality: "important", isDocumented: true, requiredCompetencyIds: ["c_db", "c_dr"] },
    { id: "t_signon", name: "Authorize payments", description: "", functionId: "f_payadmin", criticality: "critical", isDocumented: true, requiredCompetencyIds: ["c_signon"] },
    { id: "t_cheque", name: "Sign pay cheques", description: "", functionId: "f_payadmin", criticality: "important", isDocumented: true, requiredCompetencyIds: ["c_cheque"] },
    { id: "t_po", name: "Raise purchase orders", description: "", functionId: "f_payadmin", criticality: "important", isDocumented: true, requiredCompetencyIds: [] },
    { id: "t_supplies", name: "Order supplies", description: "", functionId: "f_office", criticality: "standard", isDocumented: true, requiredCompetencyIds: ["c_facilities"] },
    { id: "t_rec", name: "Maintain records", description: "", functionId: "f_office", criticality: "standard", isDocumented: true, requiredCompetencyIds: ["c_facilities"] },
  ],
  roles: [
    { id: "r_ops", name: "Operations", description: "" },
    { id: "r_dba", name: "Database Admin", description: "" },
    { id: "r_audit", name: "Audit", description: "" },
    { id: "r_it", name: "IT Support", description: "" },
    { id: "r_admin", name: "Admin", description: "" },
  ],
  people: [
    { id: "p1", name: "Uno", roleId: "r_ops", isActive: true, competencyIds: ["c_payroll", "c_tax", "c_incident", "c_db", "c_cheque", "c_signon"], taskIds: ["t_payrun", "t_taxtax", "t_inc", "t_restore", "t_signon", "t_cheque", "t_po"] },
    { id: "p2", name: "Dos", roleId: "r_dba", isActive: true, competencyIds: ["c_db", "c_dr"], taskIds: ["t_bak", "t_restore"] },
    { id: "p3", name: "Tres", roleId: "r_audit", isActive: true, competencyIds: [], taskIds: ["t_taxtax"] },
    { id: "p4", name: "Cuatro", roleId: "r_it", isActive: true, competencyIds: ["c_payroll", "c_incident"], taskIds: ["t_payrun", "t_inc", "t_restore", "t_po"] },
    { id: "p5", name: "Cinco", roleId: "r_admin", isActive: true, competencyIds: ["c_incident", "c_facilities"], taskIds: ["t_inc", "t_supplies", "t_rec", "t_po"] },
  ],
  competencies: [
    { id: "c_payroll", name: "Payroll execution", description: "" },
    { id: "c_tax", name: "Tax compliance", description: "" },
    { id: "c_incident", name: "Incident management", description: "" },
    { id: "c_db", name: "Databases", description: "" },
    { id: "c_dr", name: "Disaster recovery", description: "" },
    { id: "c_cheque", name: "Cheque authorization", description: "" },
    { id: "c_signon", name: "Payment authorization", description: "" },
    { id: "c_facilities", name: "Facilities", description: "" },
  ],
};

const task = (id: string) => db.tasks.find((t) => t.id === id)!;
const process = (id: string) => db.processes.find((p) => p.id === id)!;

describe("criticality is structural, never driven by coverage", () => {
  it("a critical task with strong redundancy stays critical", () => {
    expect(deriveTaskCriticality(db, task("t_inc")).level).toBe("critical"); // 3 capable
  });

  it("a critical task with a single capable person stays critical", () => {
    expect(deriveTaskCriticality(db, task("t_bak")).level).toBe("critical"); // 1 capable
  });

  it("an important task with a single capable person stays important, NOT critical", () => {
    expect(deriveTaskCriticality(db, task("t_cheque")).level).toBe("important");
  });

  it("an important task with strong redundancy stays important", () => {
    expect(deriveTaskCriticality(db, task("t_po")).level).toBe("important");
  });

  it("a standard task with a single capable person stays standard, NOT important", () => {
    expect(deriveTaskCriticality(db, task("t_supplies")).level).toBe("standard");
  });

  it("explains why a task is critical", () => {
    const derived = deriveTaskCriticality(db, task("t_signon"));
    expect(derived.level).toBe("critical");
    expect(derived.reasons.length).toBeGreaterThan(0);
    expect(derived.reasons.some((r) => r.toLowerCase().includes("critical"))).toBe(true);
  });
});

describe("dashboard indicators are NOT zero", () => {
  const metrics = computeDashboardMetrics(db);

  it("detects critical tasks and critical processes", () => {
    expect(criticalTasks(db).length).toBeGreaterThan(0);
    expect(metrics.criticalTasks).toBe(criticalTasks(db).length);
    expect(metrics.criticalProcesses).toBeGreaterThan(0);
    expect(deriveProcessCriticality(db, process("p_core")).level).toBe("critical");
  });

  it("detects single-person and role-concentrated critical tasks", () => {
    expect(metrics.singlePersonTasks).toBeGreaterThan(0);
    expect(metrics.roleConcentratedTasks).toBeGreaterThan(0);
  });

  it("detects documentation gaps only on critical tasks", () => {
    expect(metrics.docGapTasks).toBeGreaterThan(0);
    const criticalIds = new Set(criticalTasks(db).map((t) => t.id));
    const flags = detectRiskFlags(db).filter((f) => f.category === "documentation");
    for (const f of flags) {
      expect(f.taskId).toBeDefined();
      expect(criticalIds.has(f.taskId!)).toBe(true);
    }
  });

  it("detects concentrated critical competencies", () => {
    expect(metrics.concentratedCompetencies).toBeGreaterThan(0);
    const singleHolder = computeCompetencyConcentration(db).filter((c) => c.level === "high");
    expect(singleHolder.length).toBeGreaterThan(0);
  });

  it("computes critical coverage strictly between 0 and 1", () => {
    expect(metrics.criticalCoverageRatio).toBeGreaterThan(0);
    expect(metrics.criticalCoverageRatio).toBeLessThan(1);
  });
});

describe("bus factor reflects concentration AND lack of alternative coverage", () => {
  it("flags a person concentrating critical tasks with little redundancy", () => {
    const people = computePersonConcentration(db);
    const p1 = people.find((c) => c.person.id === "p1")!;
    expect(p1.criticalTaskCount).toBeGreaterThanOrEqual(3);
    expect(p1.exclusiveCriticalTasks.length).toBeGreaterThan(0);
    expect(p1.level).toBe("high");
  });

  it("does not flag a person with many tasks but good alternative coverage", () => {
    const people = computePersonConcentration(db);
    const p4 = people.find((c) => c.person.id === "p4")!;
    expect(p4.criticalTaskCount).toBeGreaterThanOrEqual(3); // many critical tasks…
    expect(p4.exclusiveCriticalTasks.length).toBe(0); // …but every one has alternatives
    expect(p4.level).toBe("medium");
  });
});

describe("absence simulation distinguishes 2+→1 from 1→0 on critical tasks", () => {
  it("single-person critical task loses all coverage (1→0)", () => {
    const res = simulateAbsence(db, "p2", 14);
    expect(res.uncoveredCriticalTaskIds).toContain("t_bak");
    expect(res.affectedCriticalTaskIds).toContain("t_restore");
  });

  it("critical tasks with two people drop to one (2→1)", () => {
    const res = simulateAbsence(db, "p1", 14);
    expect(res.reducedToSingleCriticalTaskIds).toContain("t_payrun");
    expect(res.reducedToSingleCriticalTaskIds).toContain("t_taxtax");
    expect(res.uncoveredCriticalTaskIds).toContain("t_signon");
    expect(res.summary.reducedToSingleCritical).toBeGreaterThan(0);
    expect(res.summary.uncoveredCriticalTasks).toBeGreaterThan(0);
  });

  it("reports bus-factor impact and critical process impact", () => {
    const res = simulateAbsence(db, "p1", 14);
    expect(res.busFactorAtRisk).toBe(true);
    expect(res.criticalTasksLosingBackup).toBeGreaterThan(0);
    expect(res.affectedCriticalProcessIds).toContain("p_core");
  });
});

describe("derived mode: orgs imported without criticality data", () => {
  // Import default signature: every process/function "important", every task "standard".
  const imported: Db = {
    organization: { id: "org_i", name: "Imported Org", description: "" },
    areas: [],
    processes: [
      { id: "pa", name: "Core Ops", description: "", criticality: "important", organizationId: "org_i" },
      { id: "pb", name: "Small Support", description: "", criticality: "important", organizationId: "org_i" },
    ],
    functions: [
      { id: "fa1", name: "Core Function", description: "", criticality: "important", processId: "pa" },
      { id: "fb1", name: "Minor Function", description: "", criticality: "important", processId: "pb" },
    ],
    tasks: [
      { id: "ta1", name: "Core task 1", description: "", functionId: "fa1", criticality: "standard", isDocumented: true, requiredCompetencyIds: [] },
      { id: "ta2", name: "Core task 2", description: "", functionId: "fa1", criticality: "standard", isDocumented: true, requiredCompetencyIds: [] },
      { id: "tb1", name: "Minor task", description: "", functionId: "fb1", criticality: "standard", isDocumented: false, requiredCompetencyIds: [] },
    ],
    roles: [
      { id: "r1", name: "R1", description: "" },
      { id: "r2", name: "R2", description: "" },
    ],
    people: [
      { id: "pa1", name: "A1", roleId: "r1", isActive: true, competencyIds: [], taskIds: ["ta1", "ta2"] },
      { id: "pa2", name: "A2", roleId: "r1", isActive: true, competencyIds: [], taskIds: ["ta1", "ta2"] },
      { id: "pa3", name: "A3", roleId: "r1", isActive: true, competencyIds: [], taskIds: ["ta1", "ta2"] },
      { id: "pa4", name: "A4", roleId: "r1", isActive: true, competencyIds: [], taskIds: ["ta1", "ta2"] },
      { id: "pa5", name: "A5", roleId: "r1", isActive: true, competencyIds: [], taskIds: ["ta1", "ta2"] },
      { id: "pa6", name: "A6", roleId: "r1", isActive: true, competencyIds: [], taskIds: ["ta1", "ta2"] },
      { id: "pa7", name: "A7", roleId: "r1", isActive: true, competencyIds: [], taskIds: ["ta1", "ta2"] },
      { id: "pa8", name: "A8", roleId: "r1", isActive: true, competencyIds: [], taskIds: ["ta1", "ta2"] },
      { id: "pb1", name: "B1", roleId: "r2", isActive: true, competencyIds: [], taskIds: ["tb1"] },
    ],
    competencies: [],
  };

  it("tiers processes by operational weight and inherits down to tasks", () => {
    // pa: 1 fn + 2 tasks + 8 people = 11; pb: 1 fn + 1 task + 1 person = 3 → pa critical, pb important.
    expect(deriveProcessCriticality(imported, imported.processes.find((p) => p.id === "pa")!).level).toBe("critical");
    expect(deriveProcessCriticality(imported, imported.processes.find((p) => p.id === "pb")!).level).toBe("important");
    // Tasks inherit their process tier.
    expect(deriveTaskCriticality(imported, imported.tasks.find((t) => t.id === "ta1")!).level).toBe("critical");
    expect(deriveTaskCriticality(imported, imported.tasks.find((t) => t.id === "tb1")!).level).toBe("important");
  });

  it("never raises criticality because a task has a single capable person", () => {
    // tb1 has exactly one capable person (pb1) but sits in an "important" process → important, not critical.
    expect(deriveTaskCriticality(imported, imported.tasks.find((t) => t.id === "tb1")!).level).toBe("important");
    // And the derived indicators are non-zero: critical tasks exist.
    expect(criticalTasks(imported).length).toBeGreaterThan(0);
    expect(computeDashboardMetrics(imported).criticalTasks).toBeGreaterThan(0);
  });
});
