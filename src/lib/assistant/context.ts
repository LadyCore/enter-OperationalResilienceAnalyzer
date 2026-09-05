import type { Db } from "@/types";
import { buildOnCallMetrics } from "@/lib/oncall";
import {
  buildTaskAnalysis,
  computeDashboardMetrics,
  detectRiskFlags,
} from "@/lib/analysis";

/**
 * Builds the compact, real screen context that is sent with every assistant
 * request. It uses ORA's own analytical engines over the active organization
 * state (already authorized by the existing app data flow) and deliberately
 * sends only aggregates and a short top-N — never full tables.
 *
 * This function must NEVER invent context: every number comes from `db` or
 * from the real analysis modules.
 */
export function buildAssistantScreenContext(db: Db, pathname: string): string {
  const parts: string[] = [];

  const orgName = db.organization.name?.trim();
  parts.push(`Organization: ${orgName || "Unnamed"}`);

  const active = db.people.filter((p) => p.isActive).length;
  parts.push(
    `Model size: ${db.processes.length} processes, ${db.functions.length} functions, ` +
      `${db.tasks.length} tasks, ${db.roles.length} roles, ` +
      `${db.competencies.length} competencies, ${db.areas.length} areas, ` +
      `${active}/${db.people.length} active people.`,
  );

  const metrics = computeDashboardMetrics(db);
  parts.push(
    `Dashboard metrics: ${metrics.processCount} processes (${metrics.criticalProcesses} critical), ` +
      `${metrics.taskCount} tasks (${metrics.criticalTasks} critical; ` +
      `${metrics.singlePersonTasks} critical with a single capable person; ` +
      `${metrics.noCoverageTasks} with no coverage; ${metrics.docGapTasks} undocumented critical), ` +
      `${metrics.busFactorPeople} bus-factor people, ${metrics.concentratedCompetencies} concentrated competencies, ` +
      `${metrics.roleConcentratedTasks} role-concentrated critical tasks. ` +
      `Task coverage ${Math.round(metrics.coverageRatio * 100)}%; ` +
      `critical coverage ${Math.round(metrics.criticalCoverageRatio * 100)}%.`,
  );

  const flags = detectRiskFlags(db);
  if (flags.length > 0) {
    const top = flags.slice(0, 6).map((f) => `${f.severity}: ${f.title}`).join(" | ");
    parts.push(`Top risk flags (${flags.length} total): ${top}`);
  } else {
    parts.push("Risk flags: none detected.");
  }

  if (pathname === "/analysis") {
    parts.push(
      `Analysis page: ${flags.length} risk flags; ` +
        `single-person critical tasks ${metrics.singlePersonTasks}; ` +
        `tasks without coverage ${metrics.noCoverageTasks}. ` +
        `The task-level table shows dependency (none/high/limited/adequate) per task with its reasons.`,
    );
  } else if (pathname === "/tasks") {
    const analysis = buildTaskAnalysis(db);
    const byLevel: Record<string, number> = { none: 0, high: 0, limited: 0, adequate: 0 };
    for (const row of analysis) byLevel[row.dependency.level] += 1;
    parts.push(
      `Task registry: ${analysis.length} tasks by dependency — ` +
        `none ${byLevel.none}, high ${byLevel.high}, limited ${byLevel.limited}, adequate ${byLevel.adequate}.`,
    );
  } else if (pathname === "/people") {
    const onCall = buildOnCallMetrics(db);
    parts.push(
      `People & roles: ${db.people.length} people, ${db.roles.length} roles. ` +
        `On-call (guardia): ${onCall.assignments} assignments, ${onCall.peopleCount} people, ` +
        `${onCall.taskCount} tasks covered (${onCall.criticalTaskCount} critical). ` +
        `Vacation coverages: ${db.vacationCoverages.length}.`,
    );
  } else if (pathname === "/simulation") {
    parts.push(
      `Simulation page: absence scenarios (vacations, medical leaves, simultaneous losses). ` +
        `Scenario rows set in the UI are NOT captured as context; ` +
        `vacation coverage applies only to planned absences categorized as Vacation, ` +
        `and passive on-call is never used as vacation coverage.`,
    );
  } else if (pathname === "/import") {
    parts.push(
      `Import page: the official template (sheet 'Organizacion') and the validation report ` +
        `are described in the ORA knowledge above; the current wizard step is not captured.`,
    );
  }

  return parts.join("\n");
}
