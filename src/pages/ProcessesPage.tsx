import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FilterX, Users } from "lucide-react";
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
import { PageHeader } from "@/components/common/PageHeader";
import { ProcessTree } from "@/components/entities/ProcessTree";
import { useOra } from "@/store/OraContext";
import { processCriticality, relatedPeopleForProcesses } from "@/lib/relational";
import type { Criticality } from "@/types";

const CRITICALITY_KEYS: Record<Criticality, string> = {
  critical: "criticality.critical",
  important: "criticality.important",
  standard: "criticality.standard",
};

export function ProcessesPage() {
  const { t } = useTranslation();
  const { db } = useOra();
  const [search, setSearch] = useState("");
  const [criticality, setCriticality] = useState<"all" | Criticality>("all");

  const filtersActive = search.trim() !== "" || criticality !== "all";

  const visibleProcessIds = useMemo(() => {
    if (!filtersActive) return null;
    const q = search.trim().toLowerCase();
    const ids = new Set<string>();
    for (const process of db.processes) {
      const matchesSearch =
        !q ||
        process.name.toLowerCase().includes(q) ||
        process.description.toLowerCase().includes(q);
      const matchesCriticality =
        criticality === "all" || processCriticality(db, process) === criticality;
      if (matchesSearch && matchesCriticality) ids.add(process.id);
    }
    return ids;
  }, [db, search, criticality, filtersActive]);

  // People as impact data, derived from the currently visible processes
  // (task assignments + competency holders — real relationships only).
  const relatedPeople = useMemo(
    () =>
      relatedPeopleForProcesses(
        db,
        visibleProcessIds ? [...visibleProcessIds] : db.processes.map((p) => p.id),
      ),
    [db, visibleProcessIds],
  );

  const clearFilters = () => {
    setSearch("");
    setCriticality("all");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.processes.title")}
        description={t("page.processes.description")}
      />

      {/* Relational filters */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("relational.search")}</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("entity.criticality")}</label>
            <Select value={criticality} onValueChange={(v) => setCriticality(v as "all" | Criticality)}>
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
          <div className="flex items-end">
            {filtersActive && (
              <Button variant="outline" size="sm" className="w-full" onClick={clearFilters}>
                <FilterX className="h-4 w-4" /> {t("relational.clearFilters")}
              </Button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("relational.results", { count: visibleProcessIds ? visibleProcessIds.size : db.processes.length })}
        </p>
      </Card>

      <ProcessTree visibleProcessIds={visibleProcessIds} />

      {/* People as impact data of the filtered processes */}
      {filtersActive && (
        <Card>
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t("relational.relatedPeople")}</h2>
            <Badge variant="secondary" className="font-mono">
              {relatedPeople.length}
            </Badge>
          </div>
          {relatedPeople.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">{t("relational.noPeople")}</p>
          ) : (
            <ul className="divide-y">
              {relatedPeople.map(({ person, taskCount, processes, competencyCount }) => (
                <li key={person.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                  <Link
                    to="/people"
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {person.name}
                  </Link>
                  {person.isActive ? (
                    <Badge variant="outline" className="border-risk-low/40 text-risk-low">
                      {t("peoplePage.status.active")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{t("peoplePage.status.inactive")}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {t("relational.tasksCount", { count: taskCount })}
                    {competencyCount > 0 &&
                      ` · ${t("relational.competenciesCount", { count: competencyCount })}`}
                  </span>
                  {processes.length > 0 && (
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {processes.join(", ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
