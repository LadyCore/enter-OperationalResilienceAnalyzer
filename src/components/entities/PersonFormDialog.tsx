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
  const [roleId, setRoleId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [competencyIds, setCompetencyIds] = useState<string[]>([]);
  const [taskIds, setTaskIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName(person?.name ?? "");
      setRoleId(person?.roleId ?? db.roles[0]?.id ?? "");
      setIsActive(person?.isActive ?? true);
      setCompetencyIds(person?.competencyIds ?? []);
      setTaskIds(person?.taskIds ?? []);
    }
  }, [open, person, db.roles]);

  const competencyOptions = db.competencies.map((c) => ({ value: c.id, label: c.name }));
  const taskOptions = db.tasks.map((t) => {
    const fn = db.functions.find((f) => f.id === t.functionId);
    const proc = fn ? db.processes.find((p) => p.id === fn.processId) : undefined;
    return { value: t.id, label: t.name, description: proc ? `${proc.name} / ${fn?.name}` : undefined };
  });

  const handleSave = () => {
    if (!name.trim() || !roleId) return;
    upsert("people", {
      id: person?.id ?? uid("p"),
      name: name.trim(),
      roleId,
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
          <Field label="Role">
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {db.roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
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
          <Button onClick={handleSave} disabled={!name.trim() || !roleId}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
