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
            <CardDescription>Tasks with 2+ capable people</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tabular-nums">
              {Math.round(metrics.criticalCoverageRatio * 100)}%
            </p>
          </CardContent>
        </Card>
      </div>

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
