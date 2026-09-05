import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FilterX, Plus } from "lucide-react";
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
import { PageHeader } from "@/components/common/PageHeader";
import { TaskDependencyTable } from "@/components/entities/TaskDependencyTable";
import { TaskFormDialog } from "@/components/entities/TaskFormDialog";
import { useOra } from "@/store/OraContext";
import { taskCriticality, taskProcess } from "@/lib/relational";
import type { Criticality, Task } from "@/types";

const CRITICALITY_KEYS: Record<Criticality, string> = {
  critical: "criticality.critical",
  important: "criticality.important",
  standard: "criticality.standard",
};

export function TasksPage() {
  const { t } = useTranslation();
  const { db } = useOra();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [processId, setProcessId] = useState("all");
  const [criticality, setCriticality] = useState<"all" | Criticality>("all");
  const [competencyId, setCompetencyId] = useState("all");
  const [personId, setPersonId] = useState("all");

  const filtersActive =
    search.trim() !== "" ||
    processId !== "all" ||
    criticality !== "all" ||
    competencyId !== "all" ||
    personId !== "all";

  const filter = useMemo(
    () => (task: Task): boolean => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!task.name.toLowerCase().includes(q) && !task.description.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (processId !== "all") {
        const process = taskProcess(db, task).process;
        if (!process || process.id !== processId) return false;
      }
      if (criticality !== "all" && taskCriticality(db, task) !== criticality) return false;
      if (competencyId !== "all" && !task.requiredCompetencyIds.includes(competencyId)) return false;
      if (personId !== "all") {
        const person = db.people.find((p) => p.id === personId);
        if (!person || !person.taskIds.includes(task.id)) return false;
      }
      return true;
    },
    [db, search, processId, criticality, competencyId, personId],
  );

  const visibleCount = useMemo(() => db.tasks.filter(filter).length, [db, filter]);

  const clearFilters = () => {
    setSearch("");
    setProcessId("all");
    setCriticality("all");
    setCompetencyId("all");
    setPersonId("all");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.tasks.title")}
        description={t("page.tasks.description")}
      >
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {t("page.tasks.new")}
        </Button>
      </PageHeader>

      {/* Relational filters — combined with AND over real ORA relationships */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("relational.search")}</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
            />
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
            <label className="text-xs font-medium text-muted-foreground">{t("entity.criticality")}</label>
            <Select
              value={criticality}
              onValueChange={(v) => setCriticality(v as "all" | Criticality)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("relational.anyCriticality")}</SelectItem>
                {Object.entries(CRITICALITY_KEYS).map(([value, key]) => (
                  <SelectItem key={value} value={value}>
                    {t(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("compPage.table.competency")}</label>
            <Select value={competencyId} onValueChange={setCompetencyId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("relational.anyCompetency")}</SelectItem>
                {db.competencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
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
          {t("relational.results", { count: visibleCount })}
        </p>
      </Card>

      <TaskDependencyTable filter={filtersActive ? filter : undefined} />
      <TaskFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
