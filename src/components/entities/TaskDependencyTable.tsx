import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, FileText, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useOra } from "@/store/OraContext";
import { buildTaskAnalysis, deriveTaskCriticality } from "@/lib/analysis";
import { CriticalityBadge } from "@/components/common/CriticalityBadge";
import { DependencyBadge } from "@/components/common/DependencyBadge";

export function TaskDependencyTable() {
  const { t } = useTranslation();
  const { db } = useOra();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rows = buildTaskAnalysis(db);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const roleName = (id: string) => db.roles.find((r) => r.id === id)?.name ?? id;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>{t("entity.task")}</TableHead>
              <TableHead>{t("entity.criticality")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("taskTable.requiredCompetencies")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("taskTable.capablePeople")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("taskTable.roles")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("taskTable.documented")}</TableHead>
              <TableHead>{t("taskTable.dependency")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ task, dependency, capablePeople, roles }) => {
              const fn = db.functions.find((f) => f.id === task.functionId);
              const proc = fn ? db.processes.find((p) => p.id === fn.processId) : undefined;
              const derived = deriveTaskCriticality(db, task);
              const isOpen = expanded.has(task.id);
              const comps = task.requiredCompetencyIds
                .map((id) => db.competencies.find((c) => c.id === id)?.name ?? id);
              return (
                <Fragment key={task.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => toggle(task.id)}
                  >
                    <TableCell>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          isOpen && "rotate-180"
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{task.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {fn?.name}
                        {proc ? ` · ${proc.name}` : ""}
                        {task.systemName ? ` · ${task.systemName}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <CriticalityBadge criticality={derived.level} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {comps.map((c) => (
                          <Badge key={c} variant="secondary" className="font-normal">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex max-w-[180px] flex-wrap gap-1">
                        {capablePeople.length === 0 && (
                          <span className="text-xs text-risk-critical">{t("taskTable.noOne")}</span>
                        )}
                        {capablePeople.map((p) => (
                          <Badge key={p.id} variant="outline" className="font-normal">
                            {p.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {roles.length === 0
                          ? "—"
                          : roles.map(roleName).join(", ")}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {task.isDocumented ? (
                        <span className="inline-flex items-center gap-1 text-xs text-risk-low">
                          <FileText className="h-3.5 w-3.5" /> {t("taskTable.documentedYes")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-risk-high">
                          <FileWarning className="h-3.5 w-3.5" /> {t("taskTable.documentedGap")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DependencyBadge level={dependency.level} />
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow key={`${task.id}-detail`} className="bg-muted/40">
                      <TableCell />
                      <TableCell colSpan={7}>
                        <div className="space-y-3 py-1 pr-6">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {t("taskTable.whyCriticality")}
                            </p>
                            <ul className="mt-1 space-y-1">
                              {derived.reasons.map((r, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {t("taskTable.whyDependency")}
                            </p>
                            <ul className="mt-1 space-y-1">
                              {dependency.reasons.map((r, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
