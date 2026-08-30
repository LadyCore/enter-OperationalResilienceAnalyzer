import type { Competency, Criticality, Db, OrgFunction, Person, Process, Task } from "@/types";

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

export const CRITICALITY_RANK: Record<Criticality, number> = {
  standard: 1,
  important: 2,
  critical: 3,
};

export function rankToCriticality(rank: number): Criticality {
  if (rank >= 3) return "critical";
  if (rank >= 2) return "important";
  return "standard";
}

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
/* Derived criticality                                                 */
/* ------------------------------------------------------------------ */

export interface DerivedCriticality {
  level: Criticality;
  reasons: string[];
}

/**
 * Criticality is a purely STRUCTURAL result of the analysis. It never reads
 * the number of people capable of a task (that is the dependency dimension).
 * Criticality flows DOWN the hierarchy (process → function → task) and never
 * cascades sideways: one critical task does not make its sibling tasks or its
 * parent function/process critical. Two modes, selected automatically:
 *
 * - Declared mode: the organization carries explicit criticality data (the
 *   demo, or orgs edited in the UI). Function and process criticality are
 *   their declared values; a task inherits the highest of its own declared
 *   value, its function and its process.
 * - Derived mode: an imported org with no criticality data (all processes and
 *   functions "important", all tasks "standard"). Process criticality is then
 *   derived from operational weight — how much of the organization's
 *   functions, tasks, people and areas the process covers — and functions and
 *   tasks inherit from it. Declaring any criticality in the UI switches the
 *   org to declared mode.
 */
export function deriveTaskCriticality(db: Db, task: Task): DerivedCriticality {
  const fn = db.functions.find((f) => f.id === task.functionId);
  const proc = fn ? db.processes.find((p) => p.id === fn.processId) : undefined;

  const reasons: string[] = [];
  const fnLevel = fn ? deriveFunctionCriticality(db, fn).level : "standard";
  const procLevel = proc ? deriveProcessCriticality(db, proc).level : "standard";
  const declaredRank = CRITICALITY_RANK[task.criticality];

  if (declaredRank >= 3) reasons.push("Marked critical in the task registry.");
  else if (declaredRank === 2) reasons.push("Marked important in the task registry.");
  if (proc && procLevel === "critical") reasons.push(`Part of the critical process "${proc.name}".`);
  else if (proc && procLevel === "important") reasons.push(`Part of the important process "${proc.name}".`);
  if (fn && fnLevel === "critical") reasons.push(`Part of the critical function "${fn.name}".`);

  const score = Math.max(declaredRank, CRITICALITY_RANK[fnLevel], CRITICALITY_RANK[procLevel]);

  if (reasons.length === 0) {
    reasons.push("No structural signal elevates this task's criticality.");
  }

  return { level: rankToCriticality(score), reasons };
}

/** True when the org carries explicit criticality data instead of the import default signature. */
function hasDeclaredCriticality(db: Db): boolean {
  if (db.processes.length === 0) return true;
  const allDefault =
    db.processes.every((p) => p.criticality === "important") &&
    db.functions.every((f) => f.criticality === "important") &&
    db.tasks.every((t) => t.criticality === "standard");
  return !allDefault;
}

/**
 * Structural footprint of a process: how many functions, tasks, active people
 * and areas it spans. Used only in derived mode as a proxy for operational
 * relevance — it is a scale measure, not a coverage/redundancy measure.
 */
export function processOperationalWeight(db: Db, process: Process): number {
  const fnIds = new Set(db.functions.filter((f) => f.processId === process.id).map((f) => f.id));
  const tasks = db.tasks.filter((t) => fnIds.has(t.functionId));
  const taskIds = new Set(tasks.map((t) => t.id));
  const people = activePeople(db).filter((p) => p.taskIds.some((tid) => taskIds.has(tid)));
  const areas = new Set(
    [...tasks.map((t) => t.areaId), ...people.map((p) => p.areaId)].filter((a): a is string => Boolean(a)),
  );
  return tasks.length + fnIds.size + people.length + areas.size * 2;
}

/**
 * Derived-mode thresholds (auditable / calibratable). A process is compared
 * against the LARGEST process in the org (reference = max operational weight):
 *
 *   - critical  when its weight >= DERIVED_CRITICAL_RATIO  × reference (0.50)
 *   - important when its weight >= DERIVED_IMPORTANT_RATIO × reference (0.20)
 *   - standard  otherwise
 *
 * Rationale: operational relevance is relative to the organization's own core —
 * the largest process is the reference point. Coverage (capable people) never
 * enters this formula; criticality and dependency stay separated. Equal-weight
 * processes always land in the same tier.
 */
const DERIVED_CRITICAL_RATIO = 0.5;
const DERIVED_IMPORTANT_RATIO = 0.2;

/** Operational-weight tier used when the org carries no declared criticality. */
function structuralTier(db: Db, process: Process): { level: Criticality; reason: string } {
  const weight = processOperationalWeight(db, process);
  const reference = db.processes.reduce(
    (max, p) => Math.max(max, processOperationalWeight(db, p)),
    0,
  );
  const ratio = reference === 0 ? 0 : weight / reference;
  const pct = Math.round(ratio * 100);

  if (ratio >= DERIVED_CRITICAL_RATIO) {
    return {
      level: "critical",
      reason: `Its operational weight is ${pct}% of the largest process — a core process for continuity.`,
    };
  }
  if (ratio >= DERIVED_IMPORTANT_RATIO) {
    return {
      level: "important",
      reason: `Its operational weight is ${pct}% of the largest process.`,
    };
  }
  return {
    level: "standard",
    reason: `Its operational weight is ${pct}% of the largest process — below the important threshold.`,
  };
}

export function deriveFunctionCriticality(db: Db, fn: OrgFunction): DerivedCriticality {
  if (!hasDeclaredCriticality(db)) {
    const proc = db.processes.find((p) => p.id === fn.processId);
    if (!proc) {
      return { level: fn.criticality, reasons: ["No parent process found — using the declared value."] };
    }
    const tier = structuralTier(db, proc);
    return {
      level: tier.level,
      reasons: [`Part of the process "${proc.name}" — ${tier.reason.toLowerCase()}`],
    };
  }

  const reasons: string[] = [];
  if (fn.criticality === "critical") reasons.push("Declared as a critical function.");
  else if (fn.criticality === "important") reasons.push("Declared as an important function.");
  if (reasons.length === 0) reasons.push("Declared as a standard function.");
  return { level: fn.criticality, reasons };
}

/** A process is essential when declared critical (declared mode) or when its operational weight demands it (derived mode). */
export function deriveProcessCriticality(db: Db, process: Process): DerivedCriticality {
  if (!hasDeclaredCriticality(db)) {
    const tier = structuralTier(db, process);
    return { level: tier.level, reasons: [tier.reason] };
  }

  const reasons: string[] = [];
  if (process.criticality === "critical") reasons.push("Declared as a critical process.");
  else if (process.criticality === "important") reasons.push("Declared as an important process.");
  else reasons.push("Declared as a standard process.");
  return { level: process.criticality, reasons };
}

/** Tasks whose DERIVED criticality is critical. */
export function criticalTasks(db: Db): Task[] {
  return db.tasks.filter((t) => deriveTaskCriticality(db, t).level === "critical");
}

export function criticalProcesses(db: Db): Process[] {
  return db.processes.filter((p) => deriveProcessCriticality(db, p).level === "critical");
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

  if (task && deriveTaskCriticality(db, task).level === "critical") {
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
  const criticalProcessesCount = criticalProcesses(db).length;
  const tasks = db.tasks;
  const critical = criticalTasks(db);

  const singlePersonTasks = critical.filter(
    (t) => capablePeople(db, t.id).length === 1
  ).length;

  const noCoverageTasks = tasks.filter((t) => capablePeople(db, t.id).length === 0).length;

  const docGapTasks = critical.filter((t) => !t.isDocumented).length;

  const concentratedCompetencies = computeCompetencyConcentration(db).length;

  const covered = tasks.filter((t) => capablePeople(db, t.id).length >= 2).length;
  const coverageRatio = tasks.length === 0 ? 0 : covered / tasks.length;

  const criticalCovered = critical.filter((t) => capablePeople(db, t.id).length >= 2).length;
  const criticalCoverageRatio = critical.length === 0 ? 0 : criticalCovered / critical.length;

  const busFactorPeople = computePersonConcentration(db).length;

  const roleConcentratedTasks = critical.filter(
    (t) =>
      capablePeople(db, t.id).length >= 1 &&
      capableRoles(db, t.id).length === 1
  ).length;

  return {
    processCount: db.processes.length,
    criticalProcesses: criticalProcessesCount,
    taskCount: tasks.length,
    criticalTasks: critical.length,
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
  /** "high" = a single holder, "medium" = two holders. */
  level: "high" | "medium";
}

/**
 * Competency concentration: a critical competency (required by at least one
 * critical task) whose capability is held by a very limited number of people
 * (1–2). This is about the capability being hard to replace, not about who
 * executes which task.
 */
export function computeCompetencyConcentration(db: Db): CompetencyConcentration[] {
  const critical = criticalTasks(db);
  return db.competencies
    .map((competency) => {
      const holders = holdersOf(db, competency.id);
      const requiredByCriticalTasks = critical.filter((t) =>
        t.requiredCompetencyIds.includes(competency.id),
      );
      return {
        competency,
        holderCount: holders.length,
        holders,
        requiredByCriticalTasks,
        level: holders.length <= 1 ? "high" : "medium",
      };
    })
    .filter((c) => c.requiredByCriticalTasks.length > 0 && c.holderCount <= 2);
}

export interface PersonConcentration {
  person: Person;
  criticalTaskCount: number;
  criticalTasks: Task[];
  /** Critical tasks where this person is the ONLY capable person. */
  exclusiveCriticalTasks: Task[];
  level: "high" | "medium";
}

/**
 * Task/person concentration (bus factor): an active person capable of
 * >= threshold DERIVED-critical tasks. The level grows with the number of
 * concentrated critical tasks and with how little alternative coverage exists.
 */
export function computePersonConcentration(db: Db, threshold = 3): PersonConcentration[] {
  const criticalIds = new Set(criticalTasks(db).map((t) => t.id));
  return activePeople(db)
    .map((person) => {
      const criticalTasks = db.tasks.filter(
        (t) => criticalIds.has(t.id) && person.taskIds.includes(t.id),
      );
      const exclusiveCriticalTasks = criticalTasks.filter(
        (t) => capablePeople(db, t.id).length === 1,
      );
      const level: "high" | "medium" =
        exclusiveCriticalTasks.length >= 1 || criticalTasks.length >= 5 ? "high" : "medium";
      return { person, criticalTaskCount: criticalTasks.length, criticalTasks, exclusiveCriticalTasks, level };
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
  const critical = criticalTasks(db);

  // Single-person coverage on critical tasks
  for (const task of critical) {
    const people = capablePeople(db, task.id);
    if (people.length === 1) {
      flags.push({
        id: `single-${task.id}`,
        category: "single-person",
        severity: "high",
        title: `Coverage for "${task.name}" relies on one person`,
        description: `Only ${people[0].name} can perform this critical task. If they are unavailable, no one can perform it.`,
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

  // Competency concentration (1–2 holders, required by critical tasks)
  for (const c of computeCompetencyConcentration(db)) {
    const criticalNames = c.requiredByCriticalTasks.map((t) => t.name).slice(0, 3).join(", ");
    if (c.holderCount === 1) {
      flags.push({
        id: `comp-${c.competency.id}`,
        category: "competency-concentration",
        severity: "critical",
        title: `Competency "${c.competency.name}" is concentrated in one person`,
        description: `Only ${c.holders[0].name} holds this competency, which critical tasks require (${criticalNames}).`,
        competencyId: c.competency.id,
        personId: c.holders[0].id,
      });
    } else {
      flags.push({
        id: `comp-${c.competency.id}`,
        category: "competency-concentration",
        severity: "high",
        title: `Competency "${c.competency.name}" has limited coverage`,
        description: `Only ${c.holders.length} people hold this competency, which critical tasks require (${criticalNames}).`,
        competencyId: c.competency.id,
      });
    }
  }

  // Person concentration (bus factor) — framed as capability concentration,
  // never as the person's value
  for (const c of computePersonConcentration(db)) {
    const taskNames = c.criticalTasks.map((t) => t.name).slice(0, 4).join(", ");
    const exclusive = c.exclusiveCriticalTasks.length;
    flags.push({
      id: `person-${c.person.id}`,
      category: "person-concentration",
      severity: c.level === "high" ? "high" : "medium",
      title: `Capability for ${c.criticalTaskCount} critical tasks is concentrated in one person (${c.person.name})`,
      description:
        `These critical tasks (${taskNames}) rely on a limited number of capable people. ` +
        (exclusive > 0
          ? `If ${c.person.name} is unavailable, ${exclusive} of them would have no alternative coverage.`
          : "Their absence would leave several of them with reduced backup coverage."),
      personId: c.person.id,
    });
  }

  // Documentation gaps on critical tasks
  for (const task of critical.filter((t) => !t.isDocumented)) {
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
  for (const task of critical) {
    const roleIds = capableRoles(db, task.id);
    if (roleIds.length === 1 && capablePeople(db, task.id).length >= 1) {
      const roleName = db.roles.find((r) => r.id === roleIds[0])?.name ?? roleIds[0];
      flags.push({
        id: `role-${task.id}`,
        category: "role-concentration",
        severity: "medium",
        title: `Coverage for "${task.name}" comes from a single role`,
        description: `Everyone capable of this critical task belongs to the ${roleName} role.`,
        taskId: task.id,
      });
    }
  }

  return flags;
}
