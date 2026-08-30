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
 * Deliberate test organization (requirement 9):
 * - a critical process (p_core) concentrating several critical tasks
 * - critical tasks covered by 1, 2 and 3+ people
 * - people concentrating critical tasks (p1 with 5, p4 with 3)
 * - critical competencies concentrated in one person (c_tax, c_cheque)
 * - a critical undocumented task (t_taxtax, t_inc)
 * - a single-role covered critical task (t_bak, t_cheque)
 * - an important task in an important process that becomes critical because
 *   its coverage depends on a single person (t_cheque)
 * - a standard task with a single capable person that must NOT become critical
 *   (t_supplies)
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
    { id: "t_cheque", name: "Sign pay cheques", description: "", functionId: "f_payadmin", criticality: "important", isDocumented: true, requiredCompetencyIds: ["c_cheque"] },
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
    { id: "p1", name: "Uno", roleId: "r_ops", isActive: true, competencyIds: ["c_payroll", "c_tax", "c_incident", "c_db", "c_cheque"], taskIds: ["t_payrun", "t_taxtax", "t_inc", "t_restore", "t_cheque"] },
    { id: "p2", name: "Dos", roleId: "r_dba", isActive: true, competencyIds: ["c_db", "c_dr"], taskIds: ["t_bak", "t_restore"] },
    { id: "p3", name: "Tres", roleId: "r_audit", isActive: true, competencyIds: [], taskIds: ["t_taxtax"] },
    { id: "p4", name: "Cuatro", roleId: "r_it", isActive: true, competencyIds: ["c_payroll", "c_incident"], taskIds: ["t_payrun", "t_inc", "t_restore"] },
    { id: "p5", name: "Cinco", roleId: "r_admin", isActive: true, competencyIds: ["c_incident", "c_facilities"], taskIds: ["t_inc", "t_supplies", "t_rec"] },
  ],
  competencies: [
    { id: "c_payroll", name: "Payroll execution", description: "" },
    { id: "c_tax", name: "Tax compliance", description: "" },
    { id: "c_incident", name: "Incident management", description: "" },
    { id: "c_db", name: "Databases", description: "" },
    { id: "c_dr", name: "Disaster recovery", description: "" },
    { id: "c_cheque", name: "Cheque authorization", description: "" },
    { id: "c_facilities", name: "Facilities", description: "" },
  ],
};

describe("derived criticality", () => {
  it("keeps criticality and coverage as separate dimensions", () => {
    // Standard task + single capable person → important, never critical.
    const supplies = db.tasks.find((t) => t.id === "t_supplies")!;
    expect(deriveTaskCriticality(db, supplies).level).toBe("important");
    // Critical task with adequate coverage (3 capable) stays critical.
    const inc = db.tasks.find((t) => t.id === "t_inc")!;
    expect(deriveTaskCriticality(db, inc).level).toBe("critical");
    // Important task in an important function with a single capable person → critical.
    const cheque = db.tasks.find((t) => t.id === "t_cheque")!;
    expect(deriveTaskCriticality(db, cheque).level).toBe("critical");
  });

  it("explains why a task is critical", () => {
    const cheque = db.tasks.find((t) => t.id === "t_cheque")!;
    const derived = deriveTaskCriticality(db, cheque);
    expect(derived.level).toBe("critical");
    expect(derived.reasons.length).toBeGreaterThan(0);
    expect(derived.reasons.some((r) => r.toLowerCase().includes("single person"))).toBe(true);
  });
});

describe("dashboard indicators are NOT zero (requirement 9)", () => {
  const metrics = computeDashboardMetrics(db);

  it("detects critical tasks and critical processes", () => {
    expect(criticalTasks(db).length).toBeGreaterThan(0);
    expect(metrics.criticalTasks).toBe(criticalTasks(db).length);
    expect(metrics.criticalProcesses).toBeGreaterThan(0);
    expect(deriveProcessCriticality(db, db.processes.find((p) => p.id === "p_core")!)).toBe("critical");
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

  it("detects bus-factor people (3+ critical tasks) with alternative coverage", () => {
    expect(metrics.busFactorPeople).toBeGreaterThan(0);
    const people = computePersonConcentration(db);
    const p1 = people.find((c) => c.person.id === "p1")!;
    expect(p1.criticalTaskCount).toBeGreaterThanOrEqual(3);
    expect(p1.exclusiveCriticalTasks.length).toBeGreaterThan(0);
  });

  it("computes critical coverage strictly between 0 and 1", () => {
    expect(metrics.criticalCoverageRatio).toBeGreaterThan(0);
    expect(metrics.criticalCoverageRatio).toBeLessThan(1);
  });
});

describe("absence simulation distinguishes 2+→1 from 1→0", () => {
  it("single-person critical task loses all coverage (1→0)", () => {
    const res = simulateAbsence(db, "p2", 14);
    expect(res.uncoveredCriticalTaskIds).toContain("t_bak");
    expect(res.affectedCriticalTaskIds).toContain("t_restore");
  });

  it("critical tasks with two people drop to one (2→1)", () => {
    const res = simulateAbsence(db, "p1", 14);
    expect(res.reducedToSingleCriticalTaskIds).toContain("t_payrun");
    expect(res.reducedToSingleCriticalTaskIds).toContain("t_taxtax");
    expect(res.uncoveredCriticalTaskIds).toContain("t_cheque");
    expect(res.summary.reducedToSingleCritical).toBeGreaterThan(0);
    expect(res.summary.uncoveredCriticalTasks).toBeGreaterThan(0);
  });

  it("reports bus-factor impact and critical process impact", () => {
    const res = simulateAbsence(db, "p1", 14);
    expect(res.busFactorAtRisk).toBe(true);
    expect(res.criticalTasksLosingBackup).toBeGreaterThan(0);
    expect(res.affectedCriticalProcessIds.length).toBeGreaterThan(0);
  });
});
