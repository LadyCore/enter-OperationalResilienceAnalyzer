import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ValidationSummary } from "@/lib/importer/types";

interface ValidationReportProps {
  summary: ValidationSummary;
  resolutions: Record<string, string | null>;
  onResolve: (kind: "manager" | "coverage", sourceRow: number, personName: string | null) => void;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function ValidationReport({ summary, resolutions, onResolve }: ValidationReportProps) {
  const { t } = useTranslation();
  const errors = summary.issues.filter((i) => i.severity === "error");
  const warnings = summary.issues.filter((i) => i.severity === "warning");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("validation.stat.totalRows")} value={summary.totalRows} />
        <Stat label={t("validation.stat.people")} value={summary.people} />
        <Stat label={t("validation.stat.excluded")} value={summary.excludedRows} />
        <Stat label={t("validation.stat.hierarchy")} value={summary.hierarchyRelations} />
        <Stat label={t("validation.stat.areas")} value={summary.areas} />
        <Stat label={t("validation.stat.roles")} value={summary.roles} />
        <Stat label={t("validation.stat.processes")} value={summary.processes} />
        <Stat label={t("validation.stat.functions")} value={summary.functions} />
        <Stat label={t("validation.stat.tasks")} value={summary.tasks} />
        <Stat label={t("validation.stat.competencies")} value={summary.competencies} />
        <Stat label={t("validation.stat.onCall")} value={summary.onCallAssignments} />
        <Stat label={t("validation.stat.vacationCoverages")} value={summary.vacationCoverages} />
        <Stat label={t("validation.stat.possibleDuplicates")} value={summary.possibleDuplicates} />
        <Stat label={t("validation.stat.incomplete")} value={summary.incompleteRows} />
      </div>

      {(errors.length > 0 || summary.blocking) && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {t("validation.blockingTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.ambiguousPersons.length > 0 && (
              <div className="space-y-2">
                {summary.ambiguousPersons.map((ref) => {
                  const key = `${ref.kind}:${ref.sourceRow}`;
                  const label =
                    ref.kind === "manager"
                      ? t("validation.ref.manager", { name: ref.refName })
                      : t("validation.ref.coverage", { name: ref.refName });
                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 text-sm">
                        <p className="font-medium">
                          {t("validation.ambiguousLine", {
                            person: ref.personName,
                            target: label,
                          })}
                        </p>
                        <p className="text-muted-foreground">
                          {t("validation.ambiguousHint", { count: ref.candidates.length })}
                        </p>
                      </div>
                      <Select
                        value={resolutions[key] ?? "unresolved"}
                        onValueChange={(v) =>
                          onResolve(ref.kind, ref.sourceRow, v === "unresolved" ? null : v)
                        }
                      >
                        <SelectTrigger className="w-full sm:w-64">
                          <SelectValue placeholder={t("validation.choosePerson")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unresolved">{t("validation.leaveUnresolved")}</SelectItem>
                          {ref.candidates.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}

            <ul className="space-y-1.5">
              {errors.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-destructive">
                  <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {warnings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-risk-medium" />
              {t("validation.warnings")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {warnings.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-risk-medium" />
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {summary.unmappedColumns.length > 0 && (
        <div className="rounded-md border p-3 text-sm">
          <p className="font-medium">{t("validation.unmappedTitle")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {summary.unmappedColumns.map((c) => (
              <Badge key={c} variant="secondary" className="font-normal">
                {c}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {summary.unusableValues.length > 0 && (
        <div className="rounded-md border border-risk-medium/30 p-3 text-sm">
          <p className="font-medium text-risk-medium">{t("validation.unusableTitle")}</p>
          <ul className="mt-1.5 space-y-1 text-muted-foreground">
            {summary.unusableValues.map((v, i) => (
              <li key={i}>• {v}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.issues.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("validation.clean")}</p>
      )}
    </div>
  );
}
