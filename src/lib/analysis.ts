import type { Competency, Criticality, Db, Person, Task } from "@/types";

export type DependencyLevel = "none" | "high" | "limited" | "adequate";

export const DEPENDENCY_LEVEL_ORDER: Record<DependencyLevel, number> = {
  none: 0,
  high: 1,
  limited: 2,
  adequate: 3,
};

export const DEPENDENCY_LABELS: Record<DependencyLevel, string> = {
  none: "No coverage",
  high: "High dependency",
  limited: "Limited coverage",
  adequate: "Adequate coverage",
};

export interface TaskDependency {
  level: DependencyLevel;
  capableCount: number;
  rolesCount: number;
  reasons: string[];
}

export interface TaskAnalysisRow {
  task: Task;
  dependency: TaskDependency;
  capablePeople: Person[];
  roles: string[];
}

/* ------------------------------------------------------------------ */
/* Basic lookups                                                       */
/* ------------------------------------------------------------------ */

export function activePeople(db: Db): Person[] {
  return db.people.filter((p) => p.isActive);
}

export function capablePeople(db: Db, taskId: string): Person[] {
  return activePeople(db).filter((p) => p.taskIds.includes(taskId));
}

export function capableRoles(db: Db, taskId: string): string[] {
  const roleIds = capablePeople(db, taskId).map((p) => p.roleId);
  return Array.from(new Set(roleIds));
}

export function holdersOf(db: Db, competencyId: string): Person[] {
  return activePeople(db).filter((p) => p.competencyIds.includes(competencyId));
}

export function personByName(db: Db, id: string): string {
  return db.people.find((p) => p.id === id)?.name ?? id;
}

export function competencyById(db: Db, id: string): Competency | undefined {
  return db.competencies.find((c) => c.id === id);
}

/* ------------------------------------------------------------------ */
/* Transparent per-task dependency                                     */
/* ------------------------------------------------------------------ */

export function taskDependency(db: Db, taskId: string): TaskDependency {
  const task = db.tasks.find((t) => t.id === taskId);
  const people = capablePeople(db, taskId);
  const capableCount = people.length;
  const roleIds = Array.from(new Set(people.map((p) => p.roleId)));
  const rolesCount = roleIds.length;

  let level: DependencyLevel;
  if (capableCount === 0) level = "none";
  else if (capableCount === 1) level = "high";
  else if (capableCount === 2) level = "limited";
  else level = "adequate";

  const names = people.map((p) => p.name);
  const reasons: string[] = [];

  if (capableCount === 0) {
    reasons.push("No active person is currently capable of performing this task.");
  } else if (capableCount === 1) {
    reasons.push(`Only one active person can perform this task: ${names[0]}.`);
  } else {
    reasons.push(`${capableCount} active people can perform this task: ${names.join(", ")}.`);
  }

  if (rolesCount === 0) {
    reasons.push("No role provides coverage for this task.");
  } else if (rolesCount === 1) {
    const roleName = db.roles.find((r) => r.id === roleIds[0])?.name ?? roleIds[0];
    reasons.push(`All coverage comes from a single role (${roleName}).`);
  }

  if (task && !task.isDocumented) {
    reasons.push("The task is not documented — its knowledge is not captured for handover.");
  }

  if (task && task.requiredCompetencyIds.length > 0) {
    for (const compId of task.requiredCompetencyIds) {
      const holders = holdersOf(db, compId);
      if (holders.length === 1) {
        const compName = competencyById(db, compId)?.name ?? compId;
        reasons.push(`Required competency '${compName}' has a single active holder (${holders[0].name}).`);
      }
    }
  }

  if (task && task.criticality === "critical") {
    reasons.push("This is a critical task.");
  }

  return { level, capableCount, rolesCount, reasons };
}

export function buildTaskAnalysis(db: Db): TaskAnalysisRow[] {
  return db.tasks.map((task) => ({
    task,
    dependency: taskDependency(db, task.id),
    capablePeople: capablePeople(db, task.id),
    roles: capableRoles(db, task.id),
  }));
}

/* ------------------------------------------------------------------ */
/* Dashboard metrics                                                   */
/* ------------------------------------------------------------------ */

export interface DashboardMetrics {
  processCount: number;
  criticalProcesses: number;
  taskCount: number;
  criticalTasks: number;
  singlePersonTasks: number;
  noCoverageTasks: number;
  docGapTasks: number;
  concentratedCompetencies: number;
  coverageRatio: number;
  criticalCoverageRatio: number;
  busFactorPeople: number;
  roleConcentratedTasks: number;
}

export function computeDashboardMetrics(db: Db): DashboardMetrics {
  const criticalProcesses = db.processes.filter((p) => p.criticality === "critical").length;
  const tasks = db.tasks;
  const criticalTasks = tasks.filter((t) => t.criticality === "critical");

  const singlePersonTasks = tasks.filter(
    (t) => t.criticality === "critical" && capablePeople(db, t.id).length === 1
  ).length;

  const noCoverageTasks = tasks.filter((t) => capablePeople(db, t.id).length === 0).length;

  const docGapTasks = criticalTasks.filter((t) => !t.isDocumented).length;

  const concentratedCompetencies = computeCompetencyConcentration(db).filter(
    (c) => c.holderCount === 1
  ).length;

  const covered = tasks.filter((t) => capablePeople(db, t.id).length >= 2).length;
  const coverageRatio = tasks.length === 0 ? 0 : covered / tasks.length;

  const criticalCovered = criticalTasks.filter((t) => capablePeople(db, t.id).length >= 2).length;
  const criticalCoverageRatio = criticalTasks.length === 0 ? 0 : criticalCovered / criticalTasks.length;

  const busFactorPeople = computePersonConcentration(db).length;

  const roleConcentratedTasks = tasks.filter(
    (t) =>
      t.criticality === "critical" &&
      capablePeople(db, t.id).length >= 1 &&
      capableRoles(db, t.id).length === 1
  ).length;

  return {
    processCount: db.processes.length,
    criticalProcesses,
    taskCount: tasks.length,
    criticalTasks: criticalTasks.length,
    singlePersonTasks,
    noCoverageTasks,
    docGapTasks,
    concentratedCompetencies,
    coverageRatio,
    criticalCoverageRatio,
    busFactorPeople,
    roleConcentratedTasks,
  };
}

/* ------------------------------------------------------------------ */
/* Concentration                                                       */
/* ------------------------------------------------------------------ */

export interface CompetencyConcentration {
  competency: Competency;
  holderCount: number;
  holders: Person[];
  requiredByCriticalTasks: Task[];
}

/** Competency concentration: a competency required by at least one critical task. */
export function computeCompetencyConcentration(db: Db): CompetencyConcentration[] {
  return db.competencies
    .map((competency) => {
      const holders = holdersOf(db, competency.id);
      const requiredByCriticalTasks = db.tasks.filter(
        (t) => t.criticality === "critical" && t.requiredCompetencyIds.includes(competency.id)
      );
      return {
        competency,
        holderCount: holders.length,
        holders,
        requiredByCriticalTasks,
      };
    })
    .filter((c) => c.requiredByCriticalTasks.length > 0);
}

export interface PersonConcentration {
  person: Person;
  criticalTaskCount: number;
  criticalTasks: Task[];
}

/** Task/person concentration (bus factor): an active person capable of >= threshold critical tasks. */
export function computePersonConcentration(db: Db, threshold = 3): PersonConcentration[] {
  return activePeople(db)
    .map((person) => {
      const criticalTasks = db.tasks.filter(
        (t) => t.criticality === "critical" && person.taskIds.includes(t.id)
      );
      return { person, criticalTaskCount: criticalTasks.length, criticalTasks };
    })
    .filter((c) => c.criticalTaskCount >= threshold);
}

/* ------------------------------------------------------------------ */
/* Risk flags (explicit, explainable)                                  */
/* ------------------------------------------------------------------ */

export type RiskCategory =
  | "single-person"
  | "no-coverage"
  | "competency-concentration"
  | "person-concentration"
  | "documentation"
  | "role-concentration";

export type RiskSeverity = "critical" | "high" | "medium";

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  "single-person": "Single-person coverage",
  "no-coverage": "No coverage",
  "competency-concentration": "Competency concentration",
  "person-concentration": "Task concentration (bus factor)",
  documentation: "Documentation gaps",
  "role-concentration": "Role concentration",
};

export interface RiskFlag {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  description: string;
  taskId?: string;
  personId?: string;
  competencyId?: string;
}

export function detectRiskFlags(db: Db): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // Single-person coverage on critical tasks
  for (const task of db.tasks.filter((t) => t.criticality === "critical")) {
    const people = capablePeople(db, task.id);
    if (people.length === 1) {
      flags.push({
        id: `single-${task.id}`,
        category: "single-person",
        severity: "high",
        title: `${task.name} depends on a single person`,
        description: `This critical task can only be performed by ${people[0].name}. If they are unavailable, no one can perform it.`,
        taskId: task.id,
        personId: people[0].id,
      });
    }
  }

  // No coverage
  for (const task of db.tasks) {
    const count = capablePeople(db, task.id).length;
    if (count === 0) {
      flags.push({
        id: `nocov-${task.id}`,
        category: "no-coverage",
        severity: "critical",
        title: `${task.name} has no available coverage`,
        description: "No active person is capable of performing this task.",
        taskId: task.id,
      });
    }
  }

  // Competency concentration (single holder, required by critical tasks)
  for (const c of computeCompetencyConcentration(db)) {
    if (c.holderCount === 1) {
      const criticalNames = c.requiredByCriticalTasks.map((t) => t.name).slice(0, 3).join(", ");
      flags.push({
        id: `comp-${c.competency.id}`,
        category: "competency-concentration",
        severity: "critical",
        title: `Competency '${c.competency.name}' is concentrated`,
        description: `Only ${c.holders[0].name} holds this competency, which is required by critical tasks (${criticalNames}).`,
        competencyId: c.competency.id,
        personId: c.holders[0].id,
      });
    }
  }

  // Person concentration (bus factor)
  for (const c of computePersonConcentration(db)) {
    const taskNames = c.criticalTasks.map((t) => t.name).slice(0, 4).join(", ");
    flags.push({
      id: `person-${c.person.id}`,
      category: "person-concentration",
      severity: "high",
      title: `${c.person.name} concentrates ${c.criticalTaskCount} critical tasks`,
      description: `This person is capable of ${c.criticalTaskCount} critical tasks (${taskNames}). Their absence would strain several critical processes.`,
      personId: c.person.id,
    });
  }

  // Documentation gaps on critical tasks
  for (const task of db.tasks.filter((t) => t.criticality === "critical" && !t.isDocumented)) {
    flags.push({
      id: `doc-${task.id}`,
      category: "documentation",
      severity: "medium",
      title: `${task.name} is not documented`,
      description: "This critical task has no documentation, so its knowledge cannot be transferred easily.",
      taskId: task.id,
    });
  }

  // Role concentration on critical tasks
  for (const task of db.tasks.filter((t) => t.criticality === "critical")) {
    const roleIds = capableRoles(db, task.id);
    if (roleIds.length === 1 && capablePeople(db, task.id).length >= 1) {
      const roleName = db.roles.find((r) => r.id === roleIds[0])?.name ?? roleIds[0];
      flags.push({
        id: `role-${task.id}`,
        category: "role-concentration",
        severity: "medium",
        title: `${task.name} is covered by a single role`,
        description: `Everyone capable of this critical task belongs to the ${roleName} role.`,
        taskId: task.id,
      });
    }
  }

  return flags;
}
