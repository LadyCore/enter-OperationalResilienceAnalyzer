import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/common/MultiSelect";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { useOra } from "@/store/OraContext";
import { uid } from "@/lib/id";
import type { VacationCoverage } from "@/types";
import { Field } from "./field";

interface VacationCoverageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coverage?: VacationCoverage;
}

export function VacationCoverageFormDialog({
  open,
  onOpenChange,
  coverage,
}: VacationCoverageFormDialogProps) {
  const { t } = useTranslation();
  const { db, upsert } = useOra();
  const [coveringPersonId, setCoveringPersonId] = useState("");
  const [coveredPersonId, setCoveredPersonId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [competencyIds, setCompetencyIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setCoveringPersonId(coverage?.coveringPersonId ?? "");
      setCoveredPersonId(coverage?.coveredPersonId ?? "");
      setRoleId(coverage?.roleId ?? "");
      setTaskIds(coverage?.taskIds ?? []);
      setCompetencyIds(coverage?.competencyIds ?? []);
    }
  }, [open, coverage]);

  const peopleOptions = db.people.map((p) => ({
    value: p.id,
    label: p.name,
    searchTerms: p.name.split(/\s+/).filter(Boolean),
  }));
  const personName = (id: string) => db.people.find((p) => p.id === id)?.name ?? "";
  const roleOptions = db.roles.map((r) => ({ value: r.id, label: r.name }));

  const availableCovered = useMemo(
    () => db.people.filter((p) => p.id !== coveringPersonId && p.isActive),
    [db.people, coveringPersonId],
  );

  const availableTasks = useMemo(() => {
    // A vacation coverage covers concrete tasks of the covered person.
    const base = coveredPersonId
      ? (db.people.find((p) => p.id === coveredPersonId)?.taskIds ?? [])
      : [];
    const baseSet = new Set(base);
    return db.tasks
      .filter((task) => baseSet.has(task.id))
      .map((task) => {
        const fn = db.functions.find((f) => f.id === task.functionId);
        const proc = fn ? db.processes.find((p) => p.id === fn.processId) : undefined;
        return { value: task.id, label: task.name, description: proc ? `${proc.name} / ${fn?.name}` : undefined };
      });
  }, [db, coveredPersonId]);

  const competencyOptions = db.competencies.map((c) => ({ value: c.id, label: c.name }));

  const handleSave = () => {
    if (!coveringPersonId || !coveredPersonId || coveringPersonId === coveredPersonId) {
      toast.error(t("coverage.errorSamePerson"));
      return;
    }
    upsert("vacationCoverages", {
      id: coverage?.id ?? uid("vc"),
      coveringPersonId,
      coveredPersonId,
      roleId: roleId || undefined,
      taskIds,
      competencyIds,
    });
    toast.success(coverage ? t("coverage.updated") : t("coverage.created"));
    onOpenChange(false);
  };

  const valid = Boolean(coveringPersonId) && Boolean(coveredPersonId) && coveringPersonId !== coveredPersonId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{coverage ? t("coverage.dialog.edit") : t("coverage.dialog.new")}</DialogTitle>
          <DialogDescription>
            {t("coverage.dialog.description", {
              person: personName(coveringPersonId) || t("coverage.thisPerson"),
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("coverage.coveringLabel")}>
            <SearchableSelect
              options={peopleOptions}
              value={coveringPersonId}
              onChange={setCoveringPersonId}
              placeholder={t("entity.selectPerson")}
              searchPlaceholder={t("entity.searchPerson")}
              className="w-full"
            />
          </Field>
          <Field label={t("coverage.coveredLabel")} hint={t("coverage.coveredHint")}>
            <SearchableSelect
              options={availableCovered.map((p) => ({
                value: p.id,
                label: p.name,
                searchTerms: p.name.split(/\s+/).filter(Boolean),
              }))}
              value={coveredPersonId}
              onChange={setCoveredPersonId}
              placeholder={t("entity.selectPerson")}
              searchPlaceholder={t("entity.searchPerson")}
              className="w-full"
            />
          </Field>
          <Field label={t("coverage.coveredRole")} hint={t("coverage.coveredRoleHint")}>
            <Select value={roleId || "none"} onValueChange={(v) => setRoleId(v === "none" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("coverage.noSpecificRole")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("coverage.noSpecificRole")}</SelectItem>
                {roleOptions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={t("coverage.tasksLabel")}
            hint={coveredPersonId ? t("coverage.tasksHint") : t("coverage.selectCoveredFirst")}
          >
            <MultiSelect
              options={availableTasks}
              values={taskIds}
              onChange={setTaskIds}
              placeholder={t("entity.selectTasks")}
              emptyText={t("coverage.noTasksForPerson")}
            />
          </Field>
          <Field label={t("coverage.competenciesLabel")}>
            <MultiSelect
              options={competencyOptions}
              values={competencyIds}
              onChange={setCompetencyIds}
              placeholder={t("entity.selectCompetencies")}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!valid}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
