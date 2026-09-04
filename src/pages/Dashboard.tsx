import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  FileSpreadsheet,
  FileWarning,
  GitBranch,
  ListChecks,
  PhoneCall,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Users,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/common/StatCard";
import { PageHeader } from "@/components/common/PageHeader";
import { OrganizationFormDialog } from "@/components/entities/OrganizationFormDialog";
import { useOra } from "@/store/OraContext";
import { computeDashboardMetrics, detectRiskFlags } from "@/lib/analysis";
import { buildOnCallMetrics } from "@/lib/oncall";
import { ImportHelpCard } from "@/components/import/ImportHelpCard";
import { DemoBanner } from "@/components/access/DemoBanner";

export function Dashboard() {
  const { db, resetToSeed } = useOra();
  const [orgOpen, setOrgOpen] = useState(false);
  const metrics = computeDashboardMetrics(db);
  const flags = detectRiskFlags(db);
  const onCall = buildOnCallMetrics(db);
  const isDemo = Boolean(db.organization.isDemo);

  const severityOrder = { critical: 0, high: 1, medium: 2 };
  const topFlags = [...flags].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]).slice(0, 6);

  const handleReset = () => {
    resetToSeed();
  };

  return (
    <div className="space-y-6">
      {/* DEMO notice — shown on every access to the home screen while active */}
      <DemoBanner />

      <PageHeader
        title="Operational resilience dashboard"
        description="An overview of how operational capability is distributed across the organization."
      >
        {isDemo && (
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" /> Reset demo data
          </Button>
        )}
        <Button asChild>
          <Link to="/import">
            <FileSpreadsheet className="h-4 w-4" /> Import organization
          </Link>
        </Button>
        <Button onClick={() => setOrgOpen(true)}>
          Edit organization
        </Button>
      </PageHeader>

      {/* Template download + how-to — access before the import flow */}
      <ImportHelpCard />

      {/* Organization banner */}
      <Card className="relative overflow-hidden border-primary/10">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
        <CardContent className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">{db.organization.name}</h2>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {db.organization.description}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOrgOpen(true)}>
            Edit
          </Button>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Processes" value={metrics.processCount} hint={`${metrics.criticalProcesses} critical`} icon={GitBranch} tone={metrics.criticalProcesses > 0 ? "primary" : "default"} delay={0} />
        <StatCard label="Tasks" value={metrics.taskCount} hint={`${metrics.criticalTasks} critical`} icon={ListChecks} tone="default" delay={50} />
        <StatCard label="Single-person critical tasks" value={metrics.singlePersonTasks} hint="Critical tasks with exactly one capable person" icon={UserX} tone={metrics.singlePersonTasks > 0 ? "high" : "low"} delay={100} />
        <StatCard label="No coverage" value={metrics.noCoverageTasks} hint="Tasks no active person can perform" icon={AlertTriangle} tone={metrics.noCoverageTasks > 0 ? "critical" : "low"} delay={150} />
        <StatCard label="Documentation gaps" value={metrics.docGapTasks} hint="Critical tasks that are undocumented" icon={FileWarning} tone={metrics.docGapTasks > 0 ? "medium" : "low"} delay={200} />
        <StatCard label="Concentrated competencies" value={metrics.concentratedCompetencies} hint="Critical competency held by one person" icon={Award} tone={metrics.concentratedCompetencies > 0 ? "critical" : "low"} delay={250} />
        <StatCard label="Bus-factor people" value={metrics.busFactorPeople} hint="People capable of 3+ critical tasks" icon={Users} tone={metrics.busFactorPeople > 0 ? "high" : "low"} delay={300} />
        <StatCard label="Role-concentrated tasks" value={metrics.roleConcentratedTasks} hint="Critical tasks covered by a single role" icon={ShieldAlert} tone={metrics.roleConcentratedTasks > 0 ? "high" : "low"} delay={350} />
      </div>

      {/* Coverage ratios */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Overall task coverage</CardTitle>
            <CardDescription>Tasks with at least 2 capable people</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tabular-nums">
              {Math.round(metrics.coverageRatio * 100)}%
            </p>
            <Progress value={metrics.coverageRatio * 100} className="mt-3" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Critical task coverage</CardTitle>
            <CardDescription>
              {metrics.criticalTasks > 0
                ? "Critical tasks with at least 2 capable people"
                : "No critical tasks detected"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tabular-nums">
              {Math.round(metrics.criticalCoverageRatio * 100)}%
            </p>
            <Progress value={metrics.criticalCoverageRatio * 100} className="mt-3" />
            {metrics.criticalTasks === 0 && (
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                No critical tasks were detected, so this is 0% by definition — not an
                organization with critical tasks and zero coverage. Criticality is derived
                from the process and function each task belongs to.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* On-call (guardia pasiva) — only shown when the org declares on-call data */}
      {onCall.assignments > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <PhoneCall className="h-4 w-4 text-primary" />
              Passive on-call (guardia pasiva)
            </CardTitle>
            <CardDescription>
              Permanent availability outside ordinary hours — an independent capability dimension,
              never part of the base dependency analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="People on call"
                value={onCall.peopleCount}
                hint={onCall.assignments === 1 ? "1 assignment" : `${onCall.assignments} assignments`}
                icon={Users}
                tone="primary"
              />
              <StatCard
                label="Capabilities covered on call"
                value={onCall.taskCount}
                hint={`${onCall.criticalTaskCount} critical`}
                icon={ListChecks}
                tone={onCall.criticalTaskCount > 0 ? "medium" : "default"}
              />
              <StatCard
                label="H24 assignments"
                value={onCall.h24Count}
                hint="Around-the-clock availability declared"
                icon={ShieldCheck}
                tone={onCall.h24Count > 0 ? "low" : "default"}
              />
              <StatCard
                label="Shift / custom assignments"
                value={onCall.customCount}
                hint="Shifts or the organization's own scheme"
                icon={AlertTriangle}
                tone={onCall.customCount > 0 ? "medium" : "default"}
              />
            </div>
            {onCall.singlePersonTasks.length > 0 && (
              <p className="mt-3 rounded-md border border-risk-medium/20 bg-risk-medium/5 px-3 py-2 text-xs leading-relaxed text-risk-medium">
                On-call concentration: {onCall.singlePersonTasks.length}{" "}
                {onCall.singlePersonTasks.length === 1 ? "capability is" : "capabilities are"} covered
                by a single on-call person ({onCall.singlePersonTasks.join(", ")}).
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Risk highlights */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">Resilience highlights</CardTitle>
            <CardDescription>The most significant operational dependencies detected</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/analysis">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {topFlags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No risk flags detected.</p>
          ) : (
            <ul className="divide-y">
              {topFlags.map((flag) => (
                <li key={flag.id} className="flex items-start gap-3 py-2.5">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      flag.severity === "critical"
                        ? "bg-risk-critical"
                        : flag.severity === "high"
                          ? "bg-risk-high"
                          : "bg-risk-medium"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{flag.title}</p>
                    <p className="text-sm text-muted-foreground">{flag.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <OrganizationFormDialog open={orgOpen} onOpenChange={setOrgOpen} />
    </div>
  );
}
