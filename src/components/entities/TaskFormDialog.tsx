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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/common/MultiSelect";
import { useOra } from "@/store/OraContext";
import { uid } from "@/lib/id";
import type { Criticality, Task } from "@/types";
import { CriticalitySelect } from "./CriticalitySelect";
import { Field } from "./field";

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  presetFunctionId?: string;
}

export function TaskFormDialog({ open, onOpenChange, task, presetFunctionId }: TaskFormDialogProps) {
  const { t } = useTranslation();
  const { db, upsert } = useOra();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [functionId, setFunctionId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [criticality, setCriticality] = useState<Criticality>("standard");
  const [isDocumented, setIsDocumented] = useState(false);
  const [systemName, setSystemName] = useState("");
  const [competencyIds, setCompetencyIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName(task?.name ?? "");
      setDescription(task?.description ?? "");
      setFunctionId(task?.functionId ?? presetFunctionId ?? db.functions[0]?.id ?? "");
      setAreaId(task?.areaId ?? "");
      setCriticality(task?.criticality ?? "standard");
      setIsDocumented(task?.isDocumented ?? false);
      setSystemName(task?.systemName ?? "");
      setCompetencyIds(task?.requiredCompetencyIds ?? []);
    }
  }, [open, task, presetFunctionId, db.functions]);

  const competencyOptions = db.competencies.map((c) => ({ value: c.id, label: c.name }));

  const handleSave = () => {
    if (!name.trim() || !functionId) return;
    upsert("tasks", {
      id: task?.id ?? uid("t"),
      name: name.trim(),
      description: description.trim(),
      functionId,
      areaId: areaId || undefined,
      criticality,
      isDocumented,
      systemName: systemName.trim() || undefined,
      requiredCompetencyIds: competencyIds,
    });
    toast.success(task ? t("task.updated") : t("task.created"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? t("task.edit") : t("task.new")}</DialogTitle>
          <DialogDescription>{t("task.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("entity.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("task.namePlaceholder")} />
          </Field>
          <Field label={t("entity.description")}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <Field label={t("entity.function")}>
            <Select value={functionId} onValueChange={setFunctionId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {db.functions.map((f) => {
                  const proc = db.processes.find((p) => p.id === f.processId);
                  return (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                      {proc ? ` — ${proc.name}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("entity.criticality")}>
            <CriticalitySelect value={criticality} onChange={setCriticality} />
          </Field>
          <Field label={t("task.areaOptional")}>
            <Select value={areaId || "none"} onValueChange={(v) => setAreaId(v === "none" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("task.noArea")}</SelectItem>
                {db.areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("task.systemLabel")} hint={t("task.systemHint")}>
            <Input value={systemName} onChange={(e) => setSystemName(e.target.value)} placeholder={t("task.systemPlaceholder")} />
          </Field>
          <Field label={t("task.documentationLabel")}>
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <span className="text-sm">{t("task.documentedQuestion")}</span>
              <Switch checked={isDocumented} onCheckedChange={setIsDocumented} />
            </div>
          </Field>
          <Field label={t("task.requiredCompetenciesLabel")} hint={t("task.requiredHint")}>
            <MultiSelect
              options={competencyOptions}
              values={competencyIds}
              onChange={setCompetencyIds}
              placeholder={t("task.requiredPlaceholder")}
              emptyText={t("entity.noCompetencies")}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || !functionId}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
