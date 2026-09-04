import { useState } from "react";
import { ArrowRight, CalendarClock, ListPlus, ShieldAlert, Trash2 } from "lucide-react";
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
import { buildExposureReport, EXPOSURE_LABELS } from "@/lib/exposure";
import { Field } from "../entities/field";
import { cn } from "@/lib/utils";

const ABSENCE_TYPES = [
  "Vacation",
  "Maternity / parental leave",
  "Training",
  "Assignment / temporary duty",
  "Other",
] as const;

const KIND_LABELS: Record<AbsenceKind, string> = {
  temporary: "Temporary absence",
  planned: "Planned absence",
  permanent: "Permanent unavailability",
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
      toast.error("Add at least one person to the scenario");
      return;
    }
    const invalid = rows.find(
      (r) =>
        (r.kind === "temporary" && (!r.days || r.days <= 0)) ||
        (r.kind === "planned" && (!r.startDate || !r.endDate || inclusiveDays(r.startDate, r.endDate) <= 0)),
    );
    if (invalid) {
      toast.error(`Complete the period/duration for ${personName(invalid.personId)}`);
      return;
    }
    setResult(simulateScenario(db, buildAbsences(rows)));
  };

  const personCountByKind = (kind: AbsenceKind) => rows.filter((r) => r.kind === kind).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Absence scenario</CardTitle>
          <CardDescription>
            Build a scenario with one or several people unavailable at the same time. Every absence
            applies simultaneously — ORA analyzes the joint state of the organization, never the sum
            of individual results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Defaults for people added below */}
          <div className="grid gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field
              label="Default type for added people"
              hint="Each row can later be overridden individually."
            >
              <div className="flex h-10 items-center gap-1 rounded-md border bg-card p-1">
                {(
                  [
                    { key: "temporary", label: "Temporary" },
                    { key: "planned", label: "Planned" },
                    { key: "permanent", label: "Permanent" },
                  ] as const
                ).map(({ key, label }) => (
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
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            {globalKind === "temporary" && (
              <Field label="Default days">
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
                <Field label="Default absence type" hint="Informational except Vacation coverage.">
                  <Select value={globalCategory} onValueChange={setGlobalCategory}>
                    <SelectTrigger className="w-full sm:w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ABSENCE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Default period — from">
                  <Input type="date" value={globalStart} onChange={(e) => setGlobalStart(e.target.value)} className="sm:w-40" />
                </Field>
                <Field label="Default period — to">
                  <Input type="date" value={globalEnd} onChange={(e) => setGlobalEnd(e.target.value)} className="sm:w-40" />
                </Field>
              </>
            )}
          </div>

          {/* Person picker — adds one person per pick with the defaults above */}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="People in the scenario" hint="Pick as many people as the scenario needs — each pick adds a row.">
              <SearchableSelect
                options={personOptions.filter((o) => !usedPersonIds.has(o.value))}
                value=""
                onChange={addPerson}
                placeholder="Add a person…"
                searchPlaceholder="Search name or surname…"
                emptyText="No more people to add"
                className="w-full"
              />
            </Field>
          </div>

          {/* Included set — always visible before running */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="font-normal">
                  {rows.length} {rows.length === 1 ? "person" : "people"} in scenario
                </Badge>
                {personCountByKind("temporary") > 0 && (
                  <Badge variant="secondary" className="font-normal">
                    {personCountByKind("temporary")} temporary
                  </Badge>
                )}
                {personCountByKind("planned") > 0 && (
                  <Badge variant="secondary" className="font-normal">
                    {personCountByKind("planned")} planned
                  </Badge>
                )}
                {personCountByKind("permanent") > 0 && (
                  <Badge className="border-transparent bg-risk-high/10 text-risk-high">
                    {personCountByKind("permanent")} permanent
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
                          ? `${row.days} ${row.days === 1 ? "day" : "days"}`
                          : row.kind === "planned"
                            ? `${row.category || "Planned"} · ${rowDays} ${rowDays === 1 ? "day" : "days"} · ${row.startDate} → ${row.endDate}`
                            : "Permanent"}
                      </span>
                      <Select
                        value={row.kind}
                        onValueChange={(v) => updateRow(row.localId, { kind: v as AbsenceKind })}
                      >
                        <SelectTrigger className="h-8 w-44 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(KIND_LABELS) as AbsenceKind[]).map((k) => (
                            <SelectItem key={k} value={k}>
                              {KIND_LABELS[k]}
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
                              {ABSENCE_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
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
                        aria-label={`Remove ${personName(row.personId)}`}
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
              <CalendarClock className="h-4 w-4" /> Run scenario
            </Button>
          </div>
        </CardContent>
      </Card>

      {!result && (
        <EmptyState
          icon={ListPlus}
          title="Simulate a scenario"
          description="Add one or more people — vacations, medical leaves, simultaneous losses or any combination — and ORA recalculates the operational coverage of the whole organization with all of them unavailable at the same time."
        />
      )}

      {result && (
        <>
          {(() => {
            const exposure = buildExposureReport(db, result);
            const exposureByTask = new Map(exposure.tasks.map((t) => [t.taskId, t]));
            const titleSuffix =
              result.absences.length === 1
                ? `${result.absences[0].person.name} being unavailable`
                : `${result.absences.length} people being unavailable simultaneously`;
            return (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <StatCard
                    label="Affected tasks"
                    value={result.summary.affectedTasks}
                    tone={result.summary.affectedTasks > 0 ? "high" : "default"}
                  />
                  <StatCard
                    label="Tasks without coverage"
                    value={result.summary.uncoveredTasks}
                    hint="No other capable person"
                    tone={result.summary.uncoveredTasks > 0 ? "critical" : "low"}
                  />
                  <StatCard
                    label="Reduced to single person"
                    value={result.summary.reducedToSingle}
                    tone={result.summary.reducedToSingle > 0 ? "high" : "low"}
                  />
                  <StatCard
                    label="Affected processes"
                    value={result.summary.affectedProcesses}
                    tone={result.summary.affectedProcesses > 0 ? "medium" : "default"}
                  />
                  <StatCard
                    label="Uncovered competencies"
                    value={result.summary.uncoveredCompetencies}
                    hint={`${result.summary.uncoveredCriticalCompetencies} critical`}
                    tone={result.summary.uncoveredCriticalCompetencies > 0 ? "critical" : "default"}
                  />
                </div>

                {/* Critical impact */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label="Affected critical tasks"
                    value={result.summary.affectedCriticalTasks}
                    hint="Critical tasks the absent people can perform"
                    tone={result.summary.affectedCriticalTasks > 0 ? "high" : "default"}
                  />
                  <StatCard
                    label="Critical tasks without coverage"
                    value={result.summary.uncoveredCriticalTasks}
                    hint="No one can perform them anymore"
                    tone={result.summary.uncoveredCriticalTasks > 0 ? "critical" : "low"}
                  />
                  {result.summary.reducedToSingleCritical > 0 && (
                    <StatCard
                      label="Critical tasks reduced to one"
                      value={result.summary.reducedToSingleCritical}
                      hint="One person can still perform them"
                      tone="high"
                    />
                  )}
                  <StatCard
                    label="Affected critical processes"
                    value={result.summary.affectedCriticalProcesses}
                    hint="Essential processes losing critical coverage"
                    tone={result.summary.affectedCriticalProcesses > 0 ? "critical" : "low"}
                  />
                </div>

                {result.busFactorAtRisk && (
                  <p className="rounded-md border border-risk-high/20 bg-risk-high/5 px-3 py-2 text-xs leading-relaxed text-risk-high">
                    Bus factor: {result.busFactorPersonIds.length}{" "}
                    {result.busFactorPersonIds.length === 1 ? "person is" : "people are"} among the absent
                    that concentrate critical tasks — the scenario hits key operational capability.
                  </p>
                )}

                {/* Vacation coverage applied */}
                {result.appliedCoverages.length > 0 && (
                  <Card className="border-risk-low/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Vacation coverage applied</CardTitle>
                      <CardDescription>
                        {result.appliedCoverages.length}{" "}
                        {result.appliedCoverages.length === 1 ? "temporary coverage" : "temporary coverages"}{" "}
                        were available to cover the absent people during their vacations.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {result.vacationCoveredTaskIds.length > 0 && (
                          <Badge className="border-transparent bg-risk-low/10 text-risk-low">
                            {result.vacationCoveredTaskIds.length} task(s) kept covered
                          </Badge>
                        )}
                        {result.vacationCoveredCompetencyIds.length > 0 && (
                          <Badge className="border-transparent bg-risk-low/10 text-risk-low">
                            {result.vacationCoveredCompetencyIds.length} competency(ies) kept covered
                          </Badge>
                        )}
                      </div>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {result.appliedCoverages.map((c, i) => (
                          <li key={i}>
                            {c.covererName} covers {c.coveredName}
                            {c.taskNames.length > 0 ? `: ${c.taskNames.join(", ")}` : ""}.
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Temporal exposure */}
                {exposure.overall !== "none" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Temporal exposure</CardTitle>
                      <CardDescription>
                        How long each affected capability loses coverage. Exposure is derived per task
                        from the absences that affect it: any permanent absence is sustained; otherwise
                        the level follows the longest governing absence.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {(["short", "prolonged", "sustained"] as const).map((lv) =>
                          exposure.counts[lv] > 0 ? (
                            <Badge key={lv} className={exposureBadgeClass(lv)}>
                              {EXPOSURE_LABELS[lv]}: {exposure.counts[lv]}
                            </Badge>
                          ) : null,
                        )}
                      </div>
                      <p className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                        Exposure reflects how long the same coverage loss lasts (short → prolonged →
                        sustained) for each affected task. It is an analytical approximation and never
                        changes the task's criticality or its coverage.
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Impact of {titleSuffix}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Absent people */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Scenario set
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {result.absences.map((a) => (
                          <Badge key={a.person.id} variant="secondary" className="font-normal">
                            {a.person.name} ·{" "}
                            {a.kind === "permanent"
                              ? "Permanent"
                              : a.kind === "planned"
                                ? `${a.category || "Planned"} · ${a.days} days`
                                : `${a.days} days`}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Affected tasks */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Affected tasks (before → after)
                      </h4>
                      {result.taskChanges.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          None of the absent people are assigned to any task, so no task coverage
                          changes.
                        </p>
                      ) : (
                        <ul className="divide-y rounded-lg border">
                          {result.taskChanges.map((change) => {
                            const task = db.tasks.find((t) => t.id === change.taskId);
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
                                      ({change.before.capableCount} → {change.after.capableCount} capable)
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
                                    No coverage
                                  </Badge>
                                )}
                                {!uncovered && reduced && (
                                  <Badge className="border-transparent bg-risk-high/10 text-risk-high">
                                    Now single-person
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
                          Affected functions
                        </h4>
                        {result.affectedFunctionIds.length === 0 ? (
                          <p className="text-sm text-muted-foreground">None</p>
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
                          Affected processes
                        </h4>
                        {result.affectedProcessIds.length === 0 ? (
                          <p className="text-sm text-muted-foreground">None</p>
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
                        Competencies left without coverage
                      </h4>
                      {result.uncoveredCompetencyIds.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Every competency the absent people hold remains covered by other people.
                        </p>
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
                                {critical ? " · required by critical tasks" : ""}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Critical competencies left concentrated */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Critical competencies left with a single holder
                      </h4>
                      {result.singleHolderCriticalCompetencyIds.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No critical competency is reduced to a single holder by this scenario.
                        </p>
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
                      This simulation measures the joint change in operational dependency when all the
                      selected people are unavailable at the same time. It does not evaluate any
                      person's value. Vacation coverage only applies to planned absences categorized as
                      vacations; passive on-call is never used as vacation coverage.
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
