import { useState } from "react";
import { ArrowRight, CalendarClock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CriticalityBadge } from "@/components/common/CriticalityBadge";
import { DependencyBadge } from "@/components/common/DependencyBadge";
import { useOra } from "@/store/OraContext";
import { simulateAbsence, type SimulationResult } from "@/lib/simulation";
import { Field } from "../entities/field";

export function SimulationPanel() {
  const { db } = useOra();
  const [personId, setPersonId] = useState("");
  const [days, setDays] = useState(60);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const activePeople = db.people.filter((p) => p.isActive);

  const run = () => {
    if (!personId) {
      toast.error("Select a person to simulate");
      return;
    }
    if (!days || days <= 0) {
      toast.error("Enter a positive number of days");
      return;
    }
    setResult(simulateAbsence(db, personId, days));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Absence scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field label="Person" hint="Select who is temporarily unavailable.">
              <Select value={personId} onValueChange={setPersonId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a person…" />
                </SelectTrigger>
                <SelectContent>
                  {activePeople.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Absence (days)">
              <Input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="sm:w-28"
              />
            </Field>
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
          description="Select a person and the length of their absence. ORA recalculates operational coverage with that person unavailable and shows what would be affected."
        />
      )}

      {result && (
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Impact of {result.person.name} being absent for {result.days} days
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
                      return (
                        <li key={change.taskId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{change.taskName}</span>
                              {task && <CriticalityBadge criticality={task.criticality} />}
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

              <p className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                This simulation measures changes in operational dependency — which tasks lose coverage
                and which capabilities become single-person. It does not evaluate the person's value.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
