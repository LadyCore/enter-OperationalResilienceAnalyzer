import { useState } from "react";
import { ArrowRight, CalendarClock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/EmptyState";
import { StatCard } from "@/components/common/StatCard";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { CriticalityBadge } from "@/components/common/CriticalityBadge";
import { DependencyBadge } from "@/components/common/DependencyBadge";
import { ExposureBadge } from "@/components/common/ExposureBadge";
import { exposureBadgeClass } from "@/components/common/exposureBadgeClass";
import { useOra } from "@/store/OraContext";
import { simulateAbsence, type SimulationResult } from "@/lib/simulation";
import { deriveTaskCriticality } from "@/lib/analysis";
import { buildExposureReport, EXPOSURE_LABELS } from "@/lib/exposure";
import { Field } from "../entities/field";
import { cn } from "@/lib/utils";

export function SimulationPanel() {
  const { db } = useOra();
  const [personId, setPersonId] = useState("");
  const [days, setDays] = useState(60);
  const [scenario, setScenario] = useState<"temporary" | "permanent">("temporary");
  const [result, setResult] = useState<SimulationResult | null>(null);

  const activePeople = db.people.filter((p) => p.isActive);

  const personOptions = activePeople.map((p) => ({
    value: p.id,
    label: p.name,
    // Allow matching by surname or any part of the name, not only the first word.
    searchTerms: p.name.split(/\s+/).filter(Boolean),
  }));

  /** Holders of a competency when the simulated person is unavailable. */
  const remainingHolders = (competencyId: string) =>
    db.people.filter(
      (p) => p.isActive && p.id !== (result?.person.id ?? "") && p.competencyIds.includes(competencyId),
    );

  const run = () => {
    if (!personId) {
      toast.error("Select a person to simulate");
      return;
    }
    if (scenario === "temporary" && (!days || days <= 0)) {
      toast.error("Enter a positive number of days");
      return;
    }
    // For permanent loss the duration is not used to derive coverage (the person
    // simply never returns); we still pass the field value to the shared sim.
    setResult(simulateAbsence(db, personId, scenario === "temporary" ? days : 365));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Absence scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <Field label="Person" hint="Search by name or surname.">
              <SearchableSelect
                options={personOptions}
                value={personId}
                onChange={setPersonId}
                placeholder="Select a person…"
                searchPlaceholder="Search name or surname…"
                emptyText="No matches"
                className="w-full sm:w-64"
              />
            </Field>
            <Field label="Scenario" hint={scenario === "permanent" ? "No return expected." : "Temporary unavailability."}>
              <div className="flex h-10 items-center gap-1 rounded-md border bg-muted/40 p-1">
                {(["temporary", "permanent"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScenario(s)}
                    aria-pressed={scenario === s}
                    className={cn(
                      "h-7 rounded px-3 text-xs font-medium transition-colors",
                      scenario === s
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {s === "temporary" ? "Temporary absence" : "Permanent loss"}
                  </button>
                ))}
              </div>
            </Field>
            {scenario === "temporary" && (
              <Field label="Absence (days)">
                <Input
                  type="number"
                  min={1}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="sm:w-28"
                />
              </Field>
            )}
            <Button onClick={run} className="sm:mb-0.5">
              <CalendarClock className="h-4 w-4" /> Run simulation
            </Button>
          </div>
        </CardContent>
      </Card>

      {!result && (
        <EmptyState
          icon={ShieldAlert}
          title="Simulate an absence"
          description="Select a person, choose between a temporary absence or a permanent loss, and set the length. ORA recalculates operational coverage with that person unavailable and shows what would be affected."
        />
      )}

      {result && (
        <>
          {(() => {
            const exposure = buildExposureReport(db, result, scenario === "permanent");
            const exposureByTask = new Map(exposure.tasks.map((t) => [t.taskId, t.level]));
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
              hint="Critical tasks this person can perform"
              tone={result.summary.affectedCriticalTasks > 0 ? "high" : "default"}
            />
            <StatCard
              label="Critical tasks without coverage"
              value={result.summary.uncoveredCriticalTasks}
              hint="No one can perform them anymore (1 → 0 capable)"
              tone={result.summary.uncoveredCriticalTasks > 0 ? "critical" : "low"}
            />
            {result.summary.reducedToSingleCritical > 0 && (
              <StatCard
                label="Critical tasks reduced to one"
                value={result.summary.reducedToSingleCritical}
                hint="One person can still perform them (2+ → 1 capable)"
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
              Bus factor: this person concentrates {result.summary.affectedCriticalTasks} critical
              tasks, of which {result.criticalTasksLosingBackup} lose all backup coverage during the
              absence.
            </p>
          )}

          {/* Temporal exposure */}
          {exposure.overall !== "none" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Temporal exposure</CardTitle>
                <CardDescription>
                  {scenario === "permanent"
                    ? "Permanent loss — capabilities left without coverage are exposed for as long as the person is gone."
                    : `How the ${result.days}-day absence exposes affected capabilities over time — separate from each task's criticality.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(["short", "prolonged", "sustained"] as const).map((lv) =>
                    exposure.counts[lv] > 0 ? (
                      <Badge key={lv} className={exposureBadgeClass(lv)}>
                        {EXPOSURE_LABELS[lv]}: {exposure.counts[lv]}
                      </Badge>
                    ) : null
                  )}
                </div>
                <p className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  Exposure reflects how long the same coverage loss lasts (short → prolonged → sustained)
                  for each affected task. It is an analytical approximation and never changes the task's
                  criticality or its coverage.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Impact of {result.person.name}
                {scenario === "permanent" ? " being permanently lost" : ` being absent for ${result.days} days`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Affected tasks */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Affected tasks (before → after)
                </h4>
                {result.taskChanges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This person is not assigned to any tasks, so no task coverage changes.
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
                              {taskExposure && taskExposure !== "none" && (
                                <ExposureBadge level={taskExposure} />
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
                          </div>
                          {uncovered && (
                            <Badge className="border-transparent bg-risk-critical/10 text-risk-critical">
                              No coverage (1 → 0 capable)
                            </Badge>
                          )}
                          {!uncovered && reduced && (
                            <Badge className="border-transparent bg-risk-high/10 text-risk-high">
                              Now single-person (2+ → 1 capable)
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
                    No competency loses all of its holders — the capabilities this person holds remain
                    covered by other people.
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
                    No critical competency is reduced to a single holder by this absence.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {result.singleHolderCriticalCompetencyIds.map((cid) => {
                      const comp = db.competencies.find((c) => c.id === cid);
                      const holder = remainingHolders(cid)[0];
                      return (
                        <Badge
                          key={cid}
                          className="border-transparent bg-risk-high/10 text-risk-high"
                        >
                          {comp?.name ?? cid}
                          {holder ? ` · sole remaining holder: ${holder.name}` : ""}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                This simulation measures changes in operational dependency — which tasks lose coverage
                and which capabilities become single-person. It does not evaluate the person's value.
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
