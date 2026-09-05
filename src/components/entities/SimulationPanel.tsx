import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, CalendarClock, ListPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { StatCard } from "@/components/common/StatCard";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { CriticalityBadge } from "@/components/common/CriticalityBadge";
import { DependencyBadge } from "@/components/common/DependencyBadge";
import { ExposureBadge } from "@/components/common/ExposureBadge";
import { exposureBadgeClass } from "@/components/common/exposureBadgeClass";
import { useOra } from "@/store/OraContext";
import { simulateScenario, type AbsenceKind, type ScenarioAbsence, type ScenarioResult } from "@/lib/simulation";
import { deriveTaskCriticality } from "@/lib/analysis";
import { buildExposureReport } from "@/lib/exposure";
import { Field } from "../entities/field";
import { cn } from "@/lib/utils";

/**
 * Planned-absence categories. Values stay as stable English codes because the
 * engine detects vacation coverage by matching the normalized "Vacation" value;
 * only the displayed labels are localized.
 */
const ABSENCE_CATEGORIES = [
  { value: "Vacation", labelKey: "sim.category.vacation" },
  { value: "Maternity / parental leave", labelKey: "sim.category.maternity" },
  { value: "Training", labelKey: "sim.category.training" },
  { value: "Assignment / temporary duty", labelKey: "sim.category.assignment" },
  { value: "Other", labelKey: "sim.category.other" },
] as const;

const CATEGORY_LABEL_KEYS: Record<string, string> = Object.fromEntries(
  ABSENCE_CATEGORIES.map((c) => [c.value, c.labelKey]),
);

const KIND_LABEL_KEYS: Record<AbsenceKind, string> = {
  temporary: "sim.kind.temporary",
  planned: "sim.kind.planned",
  permanent: "sim.kind.permanent",
};

const KIND_TOGGLE_KEYS: Record<AbsenceKind, string> = {
  temporary: "sim.toggle.temporary",
  planned: "sim.toggle.planned",
  permanent: "sim.toggle.permanent",
};

interface Row {
  localId: number;
  personId: string;
  kind: AbsenceKind;
  days: number;
  category: string;
  startDate: string;
  endDate: string;
}

let nextLocalId = 1;

/** Inclusive number of calendar days between two ISO dates. */
function inclusiveDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  return Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1);
}

export function SimulationPanel() {
  const { t } = useTranslation();
  const { db } = useOra();
  const [rows, setRows] = useState<Row[]>([]);
  const [globalKind, setGlobalKind] = useState<AbsenceKind>("temporary");
  const [globalDays, setGlobalDays] = useState(60);
  const [globalCategory, setGlobalCategory] = useState("Vacation");
  const [globalStart, setGlobalStart] = useState("");
  const [globalEnd, setGlobalEnd] = useState("");
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const activePeople = db.people.filter((p) => p.isActive);
  const personOptions = activePeople.map((p) => ({
    value: p.id,
    label: p.name,
    // Allow matching by surname or any part of the name, not only the first word.
    searchTerms: p.name.split(/\s+/).filter(Boolean),
  }));
  const personName = (id: string) => db.people.find((p) => p.id === id)?.name ?? id;
  const usedPersonIds = new Set(rows.map((r) => r.personId));

  const dayCountLabel = (n: number) => (n === 1 ? t("sim.oneDay") : t("sim.nDays", { count: n }));
  const categoryLabel = (cat?: string) =>
    cat ? (CATEGORY_LABEL_KEYS[cat] ? t(CATEGORY_LABEL_KEYS[cat]) : cat) : "";

  /** Absence list passed to the engine (only rows with a chosen person). */
  const buildAbsences = (list: Row[]): ScenarioAbsence[] =>
    list
      .filter((r) => r.personId)
      .map((r) => {
        const days =
          r.kind === "temporary"
            ? r.days
            : r.kind === "planned"
              ? inclusiveDays(r.startDate, r.endDate)
              : 0;
        return {
          personId: r.personId,
          kind: r.kind,
          category: r.kind === "planned" ? r.category || undefined : undefined,
          days: r.kind === "permanent" ? 0 : Math.max(0, days || 0),
          startDate: r.kind === "planned" ? r.startDate || undefined : undefined,
          endDate: r.kind === "planned" ? r.endDate || undefined : undefined,
        };
      });

  const addPerson = (personId: string) => {
    if (!personId || usedPersonIds.has(personId)) return;
    setRows((prev) => [
      ...prev,
      {
        localId: nextLocalId++,
        personId,
        kind: globalKind,
        days: globalDays,
        category: globalKind === "planned" ? globalCategory : "",
        startDate: globalKind === "planned" ? globalStart : "",
        endDate: globalKind === "planned" ? globalEnd : "",
      },
    ]);
  };

  const updateRow = (localId: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  };

  const removeRow = (localId: number) => {
    setRows((prev) => prev.filter((r) => r.localId !== localId));
    setResult((prev) => null); // the included set changed → previous result no longer valid
  };

  const run = () => {
    if (rows.length === 0) {
      toast.error(t("sim.errorEmpty"));
      return;
    }
    const invalid = rows.find(
      (r) =>
        (r.kind === "temporary" && (!r.days || r.days <= 0)) ||
        (r.kind === "planned" && (!r.startDate || !r.endDate || inclusiveDays(r.startDate, r.endDate) <= 0)),
    );
    if (invalid) {
      toast.error(t("sim.errorIncomplete", { person: personName(invalid.personId) }));
      return;
    }
    setResult(simulateScenario(db, buildAbsences(rows)));
  };

  const personCountByKind = (kind: AbsenceKind) => rows.filter((r) => r.kind === kind).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sim.title")}</CardTitle>
          <CardDescription>{t("sim.titleDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Defaults for people added below */}
          <div className="grid gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field
              label={t("sim.defaultType")}
              hint={t("sim.defaultHint")}
            >
              <div className="flex h-10 items-center gap-1 rounded-md border bg-card p-1">
                {(["temporary", "planned", "permanent"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setGlobalKind(key);
                      setResult(null);
                    }}
                    aria-pressed={globalKind === key}
                    className={cn(
                      "h-7 rounded px-3 text-xs font-medium transition-colors",
                      globalKind === key
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(KIND_TOGGLE_KEYS[key])}
                  </button>
                ))}
              </div>
            </Field>
            {globalKind === "temporary" && (
              <Field label={t("sim.defaultDays")}>
                <Input
                  type="number"
                  min={1}
                  value={globalDays}
                  onChange={(e) => setGlobalDays(Number(e.target.value))}
                  className="sm:w-32"
                />
              </Field>
            )}
            {globalKind === "planned" && (
              <>
                <Field label={t("sim.defaultCategory")} hint={t("sim.defaultCategoryHint")}>
                  <Select value={globalCategory} onValueChange={setGlobalCategory}>
                    <SelectTrigger className="w-full sm:w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ABSENCE_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {t(c.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("sim.periodFrom")}>
                  <Input type="date" value={globalStart} onChange={(e) => setGlobalStart(e.target.value)} className="sm:w-40" />
                </Field>
                <Field label={t("sim.periodTo")}>
                  <Input type="date" value={globalEnd} onChange={(e) => setGlobalEnd(e.target.value)} className="sm:w-40" />
                </Field>
              </>
            )}
          </div>

          {/* Person picker — adds one person per pick with the defaults above */}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label={t("sim.peopleLabel")} hint={t("sim.peopleHint")}>
              <SearchableSelect
                options={personOptions.filter((o) => !usedPersonIds.has(o.value))}
                value=""
                onChange={addPerson}
                placeholder={t("sim.addPersonPlaceholder")}
                searchPlaceholder={t("entity.searchPerson")}
                emptyText={t("sim.noMorePeople")}
                className="w-full"
              />
            </Field>
          </div>

          {/* Included set — always visible before running */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="font-normal">
                  {rows.length === 1 ? t("sim.inScenarioOne") : t("sim.inScenarioMany", { count: rows.length })}
                </Badge>
                {personCountByKind("temporary") > 0 && (
                  <Badge variant="secondary" className="font-normal">
                    {t("sim.countTemporary", { count: personCountByKind("temporary") })}
                  </Badge>
                )}
                {personCountByKind("planned") > 0 && (
                  <Badge variant="secondary" className="font-normal">
                    {t("sim.countPlanned", { count: personCountByKind("planned") })}
                  </Badge>
                )}
                {personCountByKind("permanent") > 0 && (
                  <Badge className="border-transparent bg-risk-high/10 text-risk-high">
                    {t("sim.countPermanent", { count: personCountByKind("permanent") })}
                  </Badge>
                )}
              </div>
              <ul className="divide-y rounded-lg border bg-card">
                {rows.map((row) => {
                  const rowDays =
                    row.kind === "planned" ? inclusiveDays(row.startDate, row.endDate) : row.kind === "temporary" ? row.days : 0;
                  return (
                    <li key={row.localId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {personName(row.personId)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.kind === "temporary"
                          ? dayCountLabel(row.days)
                          : row.kind === "planned"
                            ? `${categoryLabel(row.category) || t("sim.toggle.planned")} · ${dayCountLabel(rowDays)} · ${row.startDate} → ${row.endDate}`
                            : t("sim.toggle.permanent")}
                      </span>
                      <Select
                        value={row.kind}
                        onValueChange={(v) => updateRow(row.localId, { kind: v as AbsenceKind })}
                      >
                        <SelectTrigger className="h-8 w-44 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(KIND_LABEL_KEYS) as AbsenceKind[]).map((k) => (
                            <SelectItem key={k} value={k}>
                              {t(KIND_LABEL_KEYS[k])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {row.kind === "temporary" && (
                        <Input
                          type="number"
                          min={1}
                          className="h-8 w-20 text-xs"
                          value={row.days}
                          onChange={(e) => updateRow(row.localId, { days: Number(e.target.value) })}
                        />
                      )}
                      {row.kind === "planned" && (
                        <>
                          <Select
                            value={row.category}
                            onValueChange={(v) => updateRow(row.localId, { category: v })}
                          >
                            <SelectTrigger className="h-8 w-40 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ABSENCE_CATEGORIES.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {t(c.labelKey)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="date"
                            className="h-8 w-36 text-xs"
                            value={row.startDate}
                            onChange={(e) => updateRow(row.localId, { startDate: e.target.value })}
                          />
                          <Input
                            type="date"
                            className="h-8 w-36 text-xs"
                            value={row.endDate}
                            onChange={(e) => updateRow(row.localId, { endDate: e.target.value })}
                          />
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(row.localId)}
                        aria-label={t("sim.removeAria", { person: personName(row.personId) })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={run} disabled={rows.length === 0}>
              <CalendarClock className="h-4 w-4" /> {t("sim.run")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!result && (
        <EmptyState
          icon={ListPlus}
          title={t("sim.emptyTitle")}
          description={t("sim.emptyDescription")}
        />
      )}

      {result && (
        <>
          {(() => {
            const exposure = buildExposureReport(db, result);
            const exposureByTask = new Map(exposure.tasks.map((task) => [task.taskId, task]));
            const titleSuffix =
              result.absences.length === 1
                ? t("sim.unavailableSingle", { person: result.absences[0].person.name })
                : t("sim.unavailableMany", { count: result.absences.length });
            const total = result.busFactorPersonIds.length;
            return (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <StatCard
                    label={t("sim.affectedTasks")}
                    value={result.summary.affectedTasks}
                    tone={result.summary.affectedTasks > 0 ? "high" : "default"}
                  />
                  <StatCard
                    label={t("sim.tasksWithoutCoverage")}
                    value={result.summary.uncoveredTasks}
                    hint={t("sim.noOtherCapable")}
                    tone={result.summary.uncoveredTasks > 0 ? "critical" : "low"}
                  />
                  <StatCard
                    label={t("sim.reducedToSingle")}
                    value={result.summary.reducedToSingle}
                    tone={result.summary.reducedToSingle > 0 ? "high" : "low"}
                  />
                  <StatCard
                    label={t("sim.affectedProcesses")}
                    value={result.summary.affectedProcesses}
                    tone={result.summary.affectedProcesses > 0 ? "medium" : "default"}
                  />
                  <StatCard
                    label={t("sim.uncoveredCompetencies")}
                    value={result.summary.uncoveredCompetencies}
                    hint={t("sim.criticalCount", { count: result.summary.uncoveredCriticalCompetencies })}
                    tone={result.summary.uncoveredCriticalCompetencies > 0 ? "critical" : "default"}
                  />
                </div>

                {/* Critical impact */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label={t("sim.affectedCriticalTasks")}
                    value={result.summary.affectedCriticalTasks}
                    hint={t("sim.criticalTasksAbsentCanPerform")}
                    tone={result.summary.affectedCriticalTasks > 0 ? "high" : "default"}
                  />
                  <StatCard
                    label={t("sim.criticalTasksWithoutCoverage")}
                    value={result.summary.uncoveredCriticalTasks}
                    hint={t("sim.noOneCanPerform")}
                    tone={result.summary.uncoveredCriticalTasks > 0 ? "critical" : "low"}
                  />
                  {result.summary.reducedToSingleCritical > 0 && (
                    <StatCard
                      label={t("sim.criticalTasksReducedToOne")}
                      value={result.summary.reducedToSingleCritical}
                      hint={t("sim.onePersonStillPerforms")}
                      tone="high"
                    />
                  )}
                  <StatCard
                    label={t("sim.affectedCriticalProcesses")}
                    value={result.summary.affectedCriticalProcesses}
                    hint={t("sim.essentialProcessesLosing")}
                    tone={result.summary.affectedCriticalProcesses > 0 ? "critical" : "low"}
                  />
                </div>

                {result.busFactorAtRisk && (
                  <p className="rounded-md border border-risk-high/20 bg-risk-high/5 px-3 py-2 text-xs leading-relaxed text-risk-high">
                    {total === 1 ? t("sim.busFactorOne") : t("sim.busFactorMany", { count: total })}
                  </p>
                )}

                {/* Vacation coverage applied */}
                {result.appliedCoverages.length > 0 && (
                  <Card className="border-risk-low/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{t("sim.coveredTitle")}</CardTitle>
                      <CardDescription>
                        {result.appliedCoverages.length === 1
                          ? t("sim.coveredDescriptionOne")
                          : t("sim.coveredDescriptionMany", { count: result.appliedCoverages.length })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {result.vacationCoveredTaskIds.length > 0 && (
                          <Badge className="border-transparent bg-risk-low/10 text-risk-low">
                            {result.vacationCoveredTaskIds.length === 1
                              ? t("sim.coveredTaskOne")
                              : t("sim.coveredTaskMany", { count: result.vacationCoveredTaskIds.length })}
                          </Badge>
                        )}
                        {result.vacationCoveredCompetencyIds.length > 0 && (
                          <Badge className="border-transparent bg-risk-low/10 text-risk-low">
                            {result.vacationCoveredCompetencyIds.length === 1
                              ? t("sim.coveredCompOne")
                              : t("sim.coveredCompMany", { count: result.vacationCoveredCompetencyIds.length })}
                          </Badge>
                        )}
                      </div>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {result.appliedCoverages.map((c, i) => {
                          const line = c.taskNames.length
                            ? t("sim.coveredLineTasks", { coverer: c.covererName, covered: c.coveredName, tasks: c.taskNames.join(", ") })
                            : t("sim.coveredLine", { coverer: c.covererName, covered: c.coveredName });
                          return <li key={i}>{line}</li>;
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Temporal exposure */}
                {exposure.overall !== "none" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t("sim.exposureTitle")}</CardTitle>
                      <CardDescription>{t("sim.exposureDescription")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {(["short", "prolonged", "sustained"] as const).map((lv) => {
                          const fullKey =
                            lv === "short"
                              ? "sim.exposureFullShort"
                              : lv === "prolonged"
                                ? "sim.exposureFullProlonged"
                                : "sim.exposureFullSustained";
                          return exposure.counts[lv] > 0 ? (
                            <Badge key={lv} className={exposureBadgeClass(lv)}>
                              {t(fullKey)}: {exposure.counts[lv]}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                      <p className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                        {t("sim.exposureFootnote")}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("sim.impactTitle", { suffix: titleSuffix })}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Absent people */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {t("sim.scenarioSet")}
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {result.absences.map((a) => (
                          <Badge key={a.person.id} variant="secondary" className="font-normal">
                            {a.person.name} ·{" "}
                            {a.kind === "permanent"
                              ? t("sim.toggle.permanent")
                              : a.kind === "planned"
                                ? `${categoryLabel(a.category) || t("sim.toggle.planned")} · ${dayCountLabel(a.days)}`
                                : dayCountLabel(a.days)}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Affected tasks */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {t("sim.affectedTasksBefore")}
                      </h4>
                      {result.taskChanges.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("sim.noTaskChange")}</p>
                      ) : (
                        <ul className="divide-y rounded-lg border">
                          {result.taskChanges.map((change) => {
                            const task = db.tasks.find((tt) => tt.id === change.taskId);
                            const uncovered = result.uncoveredTaskIds.includes(change.taskId);
                            const reduced = result.reducedToSingleTaskIds.includes(change.taskId);
                            const taskExposure = exposureByTask.get(change.taskId);
                            return (
                              <li key={change.taskId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium">{change.taskName}</span>
                                    {task && (
                                      <CriticalityBadge criticality={deriveTaskCriticality(db, task).level} />
                                    )}
                                    {taskExposure && taskExposure.level !== "none" && (
                                      <ExposureBadge level={taskExposure.level} />
                                    )}
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    <DependencyBadge level={change.before.level} />
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                    <DependencyBadge level={change.after.level} />
                                    <span className="text-xs text-muted-foreground">
                                      {t("sim.capableCounts", {
                                        before: change.before.capableCount,
                                        after: change.after.capableCount,
                                      })}
                                    </span>
                                  </div>
                                  {taskExposure && taskExposure.level !== "none" && (
                                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                                      <span className="font-medium text-foreground">
                                        {taskExposure.description.title}.
                                      </span>{" "}
                                      {taskExposure.description.note}
                                    </p>
                                  )}
                                </div>
                                {uncovered && (
                                  <Badge className="border-transparent bg-risk-critical/10 text-risk-critical">
                                    {t("sim.noCoverageBadge")}
                                  </Badge>
                                )}
                                {!uncovered && reduced && (
                                  <Badge className="border-transparent bg-risk-high/10 text-risk-high">
                                    {t("sim.nowSinglePerson")}
                                  </Badge>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {/* Affected functions & processes */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {t("sim.affectedFunctions")}
                        </h4>
                        {result.affectedFunctionIds.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("sim.noneFunctions")}</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {result.affectedFunctionIds.map((fid) => (
                              <Badge key={fid} variant="secondary" className="font-normal">
                                {db.functions.find((f) => f.id === fid)?.name ?? fid}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {t("sim.affectedProcesses")}
                        </h4>
                        {result.affectedProcessIds.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("sim.noneProcesses")}</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {result.affectedProcessIds.map((pid) => (
                              <Badge key={pid} variant="secondary" className="font-normal">
                                {db.processes.find((p) => p.id === pid)?.name ?? pid}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Uncovered competencies */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {t("sim.competenciesUncovered")}
                      </h4>
                      {result.uncoveredCompetencyIds.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("sim.everyCompetencyCovered")}</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {result.uncoveredCompetencyIds.map((cid) => {
                            const comp = db.competencies.find((c) => c.id === cid);
                            const critical = result.uncoveredCriticalCompetencyIds.includes(cid);
                            return (
                              <Badge
                                key={cid}
                                className={
                                  critical
                                    ? "border-transparent bg-risk-critical/10 text-risk-critical"
                                    : "border-transparent bg-risk-high/10 text-risk-high"
                                }
                              >
                                {comp?.name ?? cid}
                                {critical ? t("sim.requiredByCritical") : ""}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Critical competencies left concentrated */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {t("sim.singleHolder")}
                      </h4>
                      {result.singleHolderCriticalCompetencyIds.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("sim.noSingleHolder")}</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {result.singleHolderCriticalCompetencyIds.map((cid) => {
                            const comp = db.competencies.find((c) => c.id === cid);
                            return (
                              <Badge
                                key={cid}
                                className="border-transparent bg-risk-high/10 text-risk-high"
                              >
                                {comp?.name ?? cid}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <p className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                      {t("sim.simulationFootnote")}
                    </p>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
