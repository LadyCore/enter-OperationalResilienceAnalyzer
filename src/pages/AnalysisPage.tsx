import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskFlagsSection } from "@/components/entities/RiskFlagsSection";
import { TaskDependencyTable } from "@/components/entities/TaskDependencyTable";
import { useOra } from "@/store/OraContext";
import { computeDashboardMetrics, detectRiskFlags } from "@/lib/analysis";

export function AnalysisPage() {
  const { t } = useTranslation();
  const { db } = useOra();
  const metrics = computeDashboardMetrics(db);
  const flags = detectRiskFlags(db);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("analysis.title")}
        description={t("analysis.subtitle")}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("analysis.flagsTitle")}</CardTitle>
            <CardDescription>{t("analysis.flagsAcrossCategories")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tabular-nums">{flags.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("dash.card.singlePerson")}</CardTitle>
            <CardDescription>{t("analysis.highestDependency")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tabular-nums text-risk-high">{metrics.singlePersonTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("analysis.noCoverageTitle")}</CardTitle>
            <CardDescription>{t("analysis.noCoverageHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tabular-nums text-risk-critical">{metrics.noCoverageTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("dash.criticalCoverageTitle")}</CardTitle>
            <CardDescription>
              {metrics.criticalTasks > 0
                ? t("analysis.criticalCoverageHint")
                : t("dash.noCriticalTasksHint")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tabular-nums">
              {Math.round(metrics.criticalCoverageRatio * 100)}%
            </p>
            {metrics.criticalTasks === 0 && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {t("analysis.noCriticalNote")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">{t("analysis.howCriticalityTitle")}</span>{" "}
            {t("analysis.howCriticalityBody")}
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("analysis.detectedDependencies")}
        </h2>
        <RiskFlagsSection flags={flags} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("analysis.taskLevelTitle")}
        </h2>
        <Card className="p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("analysis.taskLevelBody")}
          </p>
        </Card>
        <TaskDependencyTable />
      </section>
    </div>
  );
}
