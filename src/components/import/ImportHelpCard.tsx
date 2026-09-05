import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadOrganizationTemplate } from "@/lib/importer/downloadTemplate";
import { cn } from "@/lib/utils";

const flowStepKeys = [
  "importHelp.step.download",
  "importHelp.step.completeData",
  "importHelp.step.upload",
  "importHelp.step.reviewMapping",
  "importHelp.step.runValidation",
  "importHelp.step.fixIssues",
  "importHelp.step.confirmImport",
] as const;

const tips: { titleKey: string; bodyKey: string }[] = [
  {
    titleKey: "importHelp.tip.oneRow.title",
    bodyKey: "importHelp.tip.oneRow.body",
  },
  {
    titleKey: "importHelp.tip.uniqueId.title",
    bodyKey: "importHelp.tip.uniqueId.body",
  },
  {
    titleKey: "importHelp.tip.managerRefs.title",
    bodyKey: "importHelp.tip.managerRefs.body",
  },
  {
    titleKey: "importHelp.tip.multiValues.title",
    bodyKey: "importHelp.tip.multiValues.body",
  },
  {
    titleKey: "importHelp.tip.documentada.title",
    bodyKey: "importHelp.tip.documentada.body",
  },
  {
    titleKey: "importHelp.tip.criticidad.title",
    bodyKey: "importHelp.tip.criticidad.body",
  },
  {
    titleKey: "importHelp.tip.guardia.title",
    bodyKey: "importHelp.tip.guardia.body",
  },
  {
    titleKey: "importHelp.tip.coverage.title",
    bodyKey: "importHelp.tip.coverage.body",
  },
  {
    titleKey: "importHelp.tip.checkMapping.title",
    bodyKey: "importHelp.tip.checkMapping.body",
  },
  {
    titleKey: "importHelp.tip.reviewIssues.title",
    bodyKey: "importHelp.tip.reviewIssues.body",
  },
];

interface ImportHelpCardProps {
  className?: string;
}

/** Visible access to the official template and short loading instructions. */
export function ImportHelpCard({ className }: ImportHelpCardProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">{t("importHelp.prepareTitle")}</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("importHelp.prepareSubtitle")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void downloadOrganizationTemplate()}>
          <Download className="h-4 w-4" /> {t("importHelp.downloadTemplate")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
          <HelpCircle className="h-4 w-4" />
          {open ? t("importHelp.hideInstructions") : t("importHelp.howTo")}
        </Button>

        {open && (
          <div className="space-y-5 border-t pt-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("importHelp.flow")}
              </p>
              <ol className="flex flex-wrap items-center gap-1.5 text-sm">
                {flowStepKeys.map((stepKey, i) => (
                  <li key={stepKey} className="flex items-center gap-1.5">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{i + 1}</span>
                    <span>{t(stepKey)}</span>
                    {i < flowStepKeys.length - 1 && (
                      <span className="text-muted-foreground">→</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("importHelp.instructions")}
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {tips.map((tip) => (
                  <li key={tip.titleKey} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{t(tip.titleKey)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{t(tip.bodyKey)}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium text-foreground">{t("importHelp.exampleTitle")}</p>
              <div className="space-y-1 font-mono text-xs">
                <p className="text-muted-foreground">{t("importHelp.exampleTareasLabel")}</p>
                <p className="text-foreground">Tarea A; Tarea B; Tarea C</p>
                <p className="mt-2 text-muted-foreground">{t("importHelp.exampleCompetenciasLabel")}</p>
                <p className="text-foreground">Competencia A; Competencia B</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
