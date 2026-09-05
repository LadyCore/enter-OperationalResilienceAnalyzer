import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Award, FilterX, Plus, Trash2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { CompetencyFormDialog } from "@/components/entities/CompetencyFormDialog";
import { useOra } from "@/store/OraContext";
import { holdersOf, criticalTasks } from "@/lib/analysis";
import { taskProcess } from "@/lib/relational";
import type { Competency } from "@/types";

export function CompetenciesPage() {
  const { t } = useTranslation();
  const { db, remove } = useOra();
  const [dialog, setDialog] = useState<{ open: boolean; competency?: Competency }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Competency | null>(null);
  const [search, setSearch] = useState("");
  const [processId, setProcessId] = useState("all");
  const [taskId, setTaskId] = useState("all");
  const [personId, setPersonId] = useState("all");

  const filtersActive =
    search.trim() !== "" || processId !== "all" || taskId !== "all" || personId !== "all";

  const requiredByCritical = (compId: string) =>
    criticalTasks(db).filter((t) => t.requiredCompetencyIds.includes(compId));

  const filteredCompetencies = useMemo(() => {
    if (!filtersActive) return db.competencies;
    const q = search.trim().toLowerCase();
    return db.competencies.filter((competency) => {
      if (
        q &&
        !competency.name.toLowerCase().includes(q) &&
        !competency.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (processId !== "all") {
        const related = db.tasks.some(
          (task) =>
            task.requiredCompetencyIds.includes(competency.id) &&
            taskProcess(db, task).process?.id === processId,
        );
        if (!related) return false;
      }
      if (taskId !== "all") {
        const task = db.tasks.find((t) => t.id === taskId);
        if (!task || !task.requiredCompetencyIds.includes(competency.id)) return false;
      }
      if (personId !== "all") {
        const person = db.people.find((p) => p.id === personId);
        if (!person || !person.competencyIds.includes(competency.id)) return false;
      }
      return true;
    });
  }, [db, search, processId, taskId, personId, filtersActive]);

  // Real processes whose tasks require each competency (relational exploration).
  const processesOfCompetency = (compId: string): string[] => {
    const names = new Set<string>();
    for (const task of db.tasks) {
      if (!task.requiredCompetencyIds.includes(compId)) continue;
      const process = taskProcess(db, task).process;
      if (process) names.add(process.name);
    }
    return [...names].slice(0, 3);
  };

  const clearFilters = () => {
    setSearch("");
    setProcessId("all");
    setTaskId("all");
    setPersonId("all");
  };

  if (db.competencies.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("nav.competencies")} description={t("compPage.headerHintEmpty")}>
          <Button onClick={() => setDialog({ open: true })}>
            <Plus className="h-4 w-4" /> {t("competency.new")}
          </Button>
        </PageHeader>
        <EmptyState
          icon={Award}
          title={t("compPage.emptyTitle")}
          description={t("compPage.emptyDescription")}
        />
        <CompetencyFormDialog open={dialog.open} onOpenChange={(open) => setDialog((s) => ({ ...s, open }))} competency={dialog.competency} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.competencies")} description={t("compPage.headerHint")}>
        <Button onClick={() => setDialog({ open: true })}>
          <Plus className="h-4 w-4" /> {t("competency.new")}
        </Button>
      </PageHeader>

      {/* Relational filters */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("relational.search")}</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("common.search")} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("entity.process")}</label>
            <Select value={processId} onValueChange={setProcessId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("relational.anyProcess")}</SelectItem>
                {db.processes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("entity.task")}</label>
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("relational.anyTask")}</SelectItem>
                {db.tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("entity.person")}</label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("relational.anyPerson")}</SelectItem>
                {db.people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            {filtersActive && (
              <Button variant="outline" size="sm" className="w-full" onClick={clearFilters}>
                <FilterX className="h-4 w-4" /> {t("relational.clearFilters")}
              </Button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("relational.results", { count: filteredCompetencies.length })}
        </p>
      </Card>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("compPage.table.competency")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("entity.description")}</TableHead>
                <TableHead>{t("compPage.table.holders")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("compPage.table.requiredByCritical")}</TableHead>
                <TableHead>{t("compPage.table.status")}</TableHead>
                <TableHead className="w-24 text-right">{t("compPage.table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompetencies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    {t("relational.noResults")}
                  </TableCell>
                </TableRow>
              )}
              {filteredCompetencies.map((c) => {
                const holders = holdersOf(db, c.id);
                const criticalTasksOf = requiredByCritical(c.id);
                const singleHolder = criticalTasksOf.length > 0 && holders.length === 1;
                const limitedCoverage = criticalTasksOf.length > 0 && holders.length === 2;
                const relatedProcesses = processesOfCompetency(c.id);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{c.name}</span>
                      </div>
                      {relatedProcesses.length > 0 && (
                        <p className="mt-0.5 pl-6 text-xs text-muted-foreground">
                          {t("relational.processesLabel")}: {relatedProcesses.join(", ")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden max-w-xs md:table-cell">
                      <span className="text-sm text-muted-foreground">{c.description}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {holders.length === 0 && <span className="text-xs text-muted-foreground">{t("taskTable.noOne")}</span>}
                        {holders.map((h) => (
                          <Badge key={h.id} variant="outline" className="font-normal">
                            {h.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex max-w-[240px] flex-wrap gap-1">
                        {criticalTasksOf.length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {criticalTasksOf.map((task) => (
                          <Badge key={task.id} variant="secondary" className="font-normal">
                            {task.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {singleHolder ? (
                        <Badge className="border-transparent bg-risk-critical/10 text-risk-critical">
                          {t("compPage.status.concentrated")}
                        </Badge>
                      ) : limitedCoverage ? (
                        <Badge className="border-transparent bg-risk-high/10 text-risk-high">
                          {t("compPage.status.limited")}
                        </Badge>
                      ) : criticalTasksOf.length > 0 ? (
                        <Badge className="border-transparent bg-risk-low/10 text-risk-low">
                          {t("compPage.status.covered")}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("compPage.status.notUsed")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, competency: c })} aria-label={t("compPage.editCompetency", { name: c.name })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(c)}
                          aria-label={t("compPage.deleteCompetency", { name: c.name })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <CompetencyFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((s) => ({ ...s, open }))}
        competency={dialog.competency}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("compPage.deleteTitle", { name: deleteTarget?.name ?? "" })}
        description={t("compPage.deleteDescription")}
        onConfirm={() => {
          if (deleteTarget) {
            remove("competencies", deleteTarget.id);
            toast.success(t("compPage.deletedToast"));
          }
        }}
      />
    </div>
  );
}
