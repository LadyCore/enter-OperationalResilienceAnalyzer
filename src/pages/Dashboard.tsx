import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { localizeRiskFlag } from "@/components/common/riskI18n";

export function Dashboard() {
  const { t } = useTranslation();
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
        title={t("dash.title")}
        description={t("dash.subtitle")}
      >
        {isDemo && (
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" /> {t("dash.resetDemo")}
          </Button>
        )}
        <Button asChild>
          <Link to="/import">
            <FileSpreadsheet className="h-4 w-4" /> {t("common.importOrganization")}
          </Link>
        </Button>
        <Button onClick={() => setOrgOpen(true)}>
          {t("organization.edit")}
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
            {t("dash.edit")}
          </Button>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("nav.processes")}
          value={metrics.processCount}
          hint={t("dash.hint.criticalProcesses", { count: metrics.criticalProcesses })}
          icon={GitBranch}
          tone={metrics.criticalProcesses > 0 ? "primary" : "default"}
          delay={0}
        />
        <StatCard
          label={t("nav.tasks")}
          value={metrics.taskCount}
          hint={t("dash.hint.criticalTasks", { count: metrics.criticalTasks })}
          icon={ListChecks}
          tone="default"
          delay={50}
        />
        <StatCard
          label={t("dash.card.singlePerson")}
          value={metrics.singlePersonTasks}
          hint={t("dash.card.singlePersonHint")}
          icon={UserX}
          tone={metrics.singlePersonTasks > 0 ? "high" : "low"}
          delay={100}
        />
        <StatCard
          label={t("dash.card.noCoverage")}
          value={metrics.noCoverageTasks}
          hint={t("dash.card.noCoverageHint")}
          icon={AlertTriangle}
          tone={metrics.noCoverageTasks > 0 ? "critical" : "low"}
          delay={150}
        />
        <StatCard
          label={t("dash.card.docGaps")}
          value={metrics.docGapTasks}
          hint={t("dash.card.docGapsHint")}
          icon={FileWarning}
          tone={metrics.docGapTasks > 0 ? "medium" : "low"}
          delay={200}
        />
        <StatCard
          label={t("dash.card.concComp")}
          value={metrics.concentratedCompetencies}
          hint={t("dash.card.concCompHint")}
          icon={Award}
          tone={metrics.concentratedCompetencies > 0 ? "critical" : "low"}
          delay={250}
        />
        <StatCard
          label={t("dash.card.busFactor")}
          value={metrics.busFactorPeople}
          hint={t("dash.card.busFactorHint")}
          icon={Users}
          tone={metrics.busFactorPeople > 0 ? "high" : "low"}
          delay={300}
        />
        <StatCard
          label={t("dash.card.roleConc")}
          value={metrics.roleConcentratedTasks}
          hint={t("dash.card.roleConcHint")}
          icon={ShieldAlert}
          tone={metrics.roleConcentratedTasks > 0 ? "high" : "low"}
          delay={350}
        />
      </div>

      {/* Coverage ratios */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("dash.overallCoverageTitle")}</CardTitle>
            <CardDescription>{t("dash.overallCoverageHint")}</CardDescription>
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
            <CardTitle className="text-sm">{t("dash.criticalCoverageTitle")}</CardTitle>
            <CardDescription>
              {metrics.criticalTasks > 0
                ? t("dash.criticalCoverageHint")
                : t("dash.noCriticalTasksHint")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tabular-nums">
              {Math.round(metrics.criticalCoverageRatio * 100)}%
            </p>
            <Progress value={metrics.criticalCoverageRatio * 100} className="mt-3" />
            {metrics.criticalTasks === 0 && (
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {t("dash.noCriticalTasksNote")}
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
              {t("dash.onCall.title")}
            </CardTitle>
            <CardDescription>
              {t("dash.onCall.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={t("dash.onCall.people")}
                value={onCall.peopleCount}
                hint={
                  onCall.assignments === 1
                    ? t("dash.onCall.assignOne")
                    : t("dash.onCall.assignMany", { count: onCall.assignments })
                }
                icon={Users}
                tone="primary"
              />
              <StatCard
                label={t("dash.onCall.capabilities")}
                value={onCall.taskCount}
                hint={t("dash.hint.criticalTasks", { count: onCall.criticalTaskCount })}
                icon={ListChecks}
                tone={onCall.criticalTaskCount > 0 ? "medium" : "default"}
              />
              <StatCard
                label={t("dash.onCall.h24")}
                value={onCall.h24Count}
                hint={t("dash.onCall.h24Hint")}
                icon={ShieldCheck}
                tone={onCall.h24Count > 0 ? "low" : "default"}
              />
              <StatCard
                label={t("dash.onCall.custom")}
                value={onCall.customCount}
                hint={t("dash.onCall.customHint")}
                icon={AlertTriangle}
                tone={onCall.customCount > 0 ? "medium" : "default"}
              />
            </div>
            {onCall.singlePersonTasks.length > 0 && (
              <p className="mt-3 rounded-md border border-risk-medium/20 bg-risk-medium/5 px-3 py-2 text-xs leading-relaxed text-risk-medium">
                {onCall.singlePersonTasks.length === 1
                  ? t("dash.onCall.concOne", { names: onCall.singlePersonTasks.join(", ") })
                  : t("dash.onCall.concMany", {
                      count: onCall.singlePersonTasks.length,
                      names: onCall.singlePersonTasks.join(", "),
                    })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Risk highlights */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">{t("dash.highlights.title")}</CardTitle>
            <CardDescription>{t("dash.highlights.description")}</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/analysis">
              {t("dash.viewAll")} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {topFlags.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dash.noFlags")}</p>
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
                    <p className="text-sm font-medium">{localizeRiskFlag(flag, t).title}</p>
                    <p className="text-sm text-muted-foreground">{localizeRiskFlag(flag, t).description}</p>
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
