import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/common/MultiSelect";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { useOra } from "@/store/OraContext";
import { uid } from "@/lib/id";
import type { OnCallAssignment } from "@/types";
import { Field } from "./field";

interface OnCallFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment?: OnCallAssignment;
}

export function OnCallFormDialog({ open, onOpenChange, assignment }: OnCallFormDialogProps) {
  const { t } = useTranslation();
  const { db, upsert } = useOra();
  const [personId, setPersonId] = useState("");
  const [modality, setModality] = useState("");
  const [period, setPeriod] = useState("");
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [competencyIds, setCompetencyIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setPersonId(assignment?.personId ?? "");
      setModality(assignment?.modality ?? "");
      setPeriod(assignment?.period ?? "");
      setTaskIds(assignment?.taskIds ?? []);
      setCompetencyIds(assignment?.competencyIds ?? []);
    }
  }, [open, assignment]);

  const activePeople = db.people.filter((p) => p.isActive);
  const personOptions = activePeople.map((p) => ({
    value: p.id,
    label: p.name,
    searchTerms: p.name.split(/\s+/).filter(Boolean),
  }));
  const taskOptions = db.tasks.map((t2) => {
    const fn = db.functions.find((f) => f.id === t2.functionId);
    const proc = fn ? db.processes.find((p) => p.id === fn.processId) : undefined;
    return { value: t2.id, label: t2.name, description: proc ? `${proc.name} / ${fn?.name}` : undefined };
  });
  const competencyOptions = db.competencies.map((c) => ({ value: c.id, label: c.name }));

  const handleSave = () => {
    if (!personId || !modality.trim()) {
      toast.error(t("onCall.errorRequired"));
      return;
    }
    upsert("onCallAssignments", {
      id: assignment?.id ?? uid("oc"),
      personId,
      modality: modality.trim(),
      period: period.trim(),
      taskIds,
      competencyIds,
    });
    toast.success(assignment ? t("onCall.updated") : t("onCall.created"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{assignment ? t("onCall.edit") : t("onCall.new")}</DialogTitle>
          <DialogDescription>{t("onCall.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("onCall.personLabel")}>
            <SearchableSelect
              options={personOptions}
              value={personId}
              onChange={setPersonId}
              placeholder={t("entity.selectPerson")}
              searchPlaceholder={t("entity.searchPerson")}
              className="w-full"
            />
          </Field>
          <Field label={t("onCall.modalityLabel")} hint={t("onCall.modalityHint")}>
            <Input value={modality} onChange={(e) => setModality(e.target.value)} placeholder={t("onCall.modalityPlaceholder")} />
          </Field>
          <Field label={t("onCall.periodLabel")} hint={t("onCall.periodHint")}>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder={t("onCall.periodPlaceholder")} />
          </Field>
          <Field label={t("onCall.tasksLabel")} hint={t("onCall.tasksHint")}>
            <MultiSelect
              options={taskOptions}
              values={taskIds}
              onChange={setTaskIds}
              placeholder={t("entity.selectTasks")}
            />
          </Field>
          <Field label={t("onCall.competenciesLabel")}>
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
          <Button onClick={handleSave} disabled={!personId || !modality.trim()}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
