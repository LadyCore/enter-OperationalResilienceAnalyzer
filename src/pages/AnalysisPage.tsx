import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskFlagsSection } from "@/components/entities/RiskFlagsSection";
import { TaskDependencyTable } from "@/components/entities/TaskDependencyTable";
import { useOra } from "@/store/OraContext";
import { computeDashboardMetrics, detectRiskFlags } from "@/lib/analysis";

export function AnalysisPage() {
  const { db } = useOra();
  const metrics = computeDashboardMetrics(db);
  const flags = detectRiskFlags(db);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Operational coverage analysis"
        description="A transparent, rule-based view of dependency. Every level is derived from visible facts — capable people, roles, competencies and documentation — and each row explains why."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Detected risk flags</CardTitle>
            <CardDescription>Across all categories</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tabular-nums">{flags.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Single-person critical tasks</CardTitle>
            <CardDescription>Highest operational dependency</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tabular-nums text-risk-high">{metrics.singlePersonTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tasks with no coverage</CardTitle>
            <CardDescription>No active person capable</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tabular-nums text-risk-critical">{metrics.noCoverageTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Critical task coverage</CardTitle>
            <CardDescription>
              {metrics.criticalTasks > 0
                ? "Critical tasks with 2+ capable people"
                : "No critical tasks detected"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tabular-nums">
              {Math.round(metrics.criticalCoverageRatio * 100)}%
            </p>
            {metrics.criticalTasks === 0 && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                0% because no critical tasks were detected, not because critical coverage is null.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">How criticality works.</span> Criticality is
            structural: a task inherits the criticality of its function and process, and organizations
            without criticality data (imports without that column) get process criticality derived from
            operational weight — how many functions, tasks, people and areas each process covers,
            compared against the organization's largest process. Coverage and redundancy never change
            criticality: a critical task can be well covered or single-person, and a single-person task is
            not automatically critical. Vulnerability lives in the dependency dimension below.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Detected dependencies
        </h2>
        <RiskFlagsSection flags={flags} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Task-level dependency
        </h2>
        <Card className="p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Dependency is derived from the number of active people capable of the task: 0 = no coverage,
            1 = high, 2 = limited, 3+ = adequate. Documentation status, role spread and single-holder
            competencies are reported as additional factors. Expand a row to read the explanation.
          </p>
        </Card>
        <TaskDependencyTable />
      </section>
    </div>
  );
}
