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
import { MultiSelect } from "@/components/common/MultiSelect";
import { useOra } from "@/store/OraContext";
import { uid } from "@/lib/id";
import type { Person } from "@/types";
import { Field } from "./field";

interface PersonFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: Person;
}

export function PersonFormDialog({ open, onOpenChange, person }: PersonFormDialogProps) {
  const { t } = useTranslation();
  const { db, upsert } = useOra();
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [managerId, setManagerId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [competencyIds, setCompetencyIds] = useState<string[]>([]);
  const [taskIds, setTaskIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName(person?.name ?? "");
      setEmployeeId(person?.employeeId ?? "");
      setRoleIds(person?.roleIds?.length ? person.roleIds : db.roles[0] ? [db.roles[0].id] : []);
      setAreaIds(person?.areaIds ?? []);
      setManagerId(person?.managerId ?? "");
      setIsActive(person?.isActive ?? true);
      setCompetencyIds(person?.competencyIds ?? []);
      setTaskIds(person?.taskIds ?? []);
    }
  }, [open, person, db.roles]);

  const roleOptions = db.roles.map((r) => ({ value: r.id, label: r.name }));
  const areaOptions = db.areas.map((a) => ({ value: a.id, label: a.name }));
  const competencyOptions = db.competencies.map((c) => ({ value: c.id, label: c.name }));
  const managerOptions = db.people
    .filter((p) => p.id !== person?.id)
    .map((p) => ({ value: p.id, label: p.name }));
  const taskOptions = db.tasks.map((task) => {
    const fn = db.functions.find((f) => f.id === task.functionId);
    const proc = fn ? db.processes.find((p) => p.id === fn.processId) : undefined;
    return { value: task.id, label: task.name, description: proc ? `${proc.name} / ${fn?.name}` : undefined };
  });

  const handleSave = () => {
    if (!name.trim() || roleIds.length === 0) return;
    upsert("people", {
      id: person?.id ?? uid("p"),
      name: name.trim(),
      employeeId: employeeId.trim() || undefined,
      roleIds,
      areaIds,
      managerId: managerId || undefined,
      isActive,
      competencyIds,
      taskIds,
    });
    toast.success(person ? t("person.updated") : t("person.created"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{person ? t("person.edit") : t("person.new")}</DialogTitle>
          <DialogDescription>{t("person.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("entity.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("person.namePlaceholder")} />
          </Field>
          <Field label={t("person.employeeId")} hint={t("person.employeeIdHint")}>
            <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder={t("person.employeeIdPlaceholder")} />
          </Field>
          <Field label={t("person.roles")} hint={t("person.rolesHint")}>
            <MultiSelect
              options={roleOptions}
              values={roleIds}
              onChange={setRoleIds}
              placeholder={t("person.rolesPlaceholder")}
            />
          </Field>
          <Field label={t("person.areas")} hint={t("person.areasHint")}>
            <MultiSelect
              options={areaOptions}
              values={areaIds}
              onChange={setAreaIds}
              placeholder={t("person.areasPlaceholder")}
            />
          </Field>
          <Field label={t("person.manager")}>
            <Select value={managerId || "none"} onValueChange={(v) => setManagerId(v === "none" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("person.noManager")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("person.noManager")}</SelectItem>
                {managerOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("person.activeStatus")} hint={t("person.activeStatusHint")}>
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <span className="text-sm">{t("person.currentlyActive")}</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </Field>
          <Field label={t("person.competenciesLabel")}>
            <MultiSelect
              options={competencyOptions}
              values={competencyIds}
              onChange={setCompetencyIds}
              placeholder={t("entity.selectCompetencies")}
            />
          </Field>
          <Field label={t("person.tasksLabel")}>
            <MultiSelect
              options={taskOptions}
              values={taskIds}
              onChange={setTaskIds}
              placeholder={t("person.tasksPlaceholder")}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || roleIds.length === 0}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
