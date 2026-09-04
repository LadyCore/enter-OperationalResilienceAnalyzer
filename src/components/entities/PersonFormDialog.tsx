import { useEffect, useState } from "react";
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
  const taskOptions = db.tasks.map((t) => {
    const fn = db.functions.find((f) => f.id === t.functionId);
    const proc = fn ? db.processes.find((p) => p.id === fn.processId) : undefined;
    return { value: t.id, label: t.name, description: proc ? `${proc.name} / ${fn?.name}` : undefined };
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
    toast.success(person ? "Person updated" : "Person created");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{person ? "Edit person" : "New person"}</DialogTitle>
          <DialogDescription>
            A person holds competencies and is capable of performing certain tasks. Active status
            controls whether they count toward operational coverage.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ana Silva" />
          </Field>
          <Field label="Person identifier (optional)" hint="Source identifier such as a payroll/employee id.">
            <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="e.g. EMP-1024" />
          </Field>
          <Field label="Roles" hint="A person may hold several roles (one per sector).">
            <MultiSelect
              options={roleOptions}
              values={roleIds}
              onChange={setRoleIds}
              placeholder="Select roles…"
            />
          </Field>
          <Field label="Areas / sectors" hint="A person may belong to several sectors.">
            <MultiSelect
              options={areaOptions}
              values={areaIds}
              onChange={setAreaIds}
              placeholder="Select areas…"
            />
          </Field>
          <Field label="Manager / responsible">
            <Select value={managerId || "none"} onValueChange={(v) => setManagerId(v === "none" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No manager</SelectItem>
                {managerOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Active status" hint="Inactive people are excluded from coverage calculations.">
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <span className="text-sm">Currently active</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </Field>
          <Field label="Competencies">
            <MultiSelect
              options={competencyOptions}
              values={competencyIds}
              onChange={setCompetencyIds}
              placeholder="Select competencies…"
            />
          </Field>
          <Field label="Capable of performing tasks">
            <MultiSelect
              options={taskOptions}
              values={taskIds}
              onChange={setTaskIds}
              placeholder="Select tasks this person can perform…"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || roleIds.length === 0}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
