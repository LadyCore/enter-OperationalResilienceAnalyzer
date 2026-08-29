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
    toast.success(task ? "Task updated" : "Task created");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            A task is a unit of work within a function. Define the competencies it requires.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Validate customer order" />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <Field label="Function">
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
          <Field label="Criticality">
            <CriticalitySelect value={criticality} onChange={setCriticality} />
          </Field>
          <Field label="Area (optional)">
            <Select value={areaId || "none"} onValueChange={(v) => setAreaId(v === "none" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No area</SelectItem>
                {db.areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="System / resource (optional)" hint="e.g. ERP, backup platform, database.">
            <Input value={systemName} onChange={(e) => setSystemName(e.target.value)} placeholder="System or resource" />
          </Field>
          <Field label="Documentation">
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <span className="text-sm">Is this task documented?</span>
              <Switch checked={isDocumented} onCheckedChange={setIsDocumented} />
            </div>
          </Field>
          <Field label="Required competencies" hint="Competencies needed to perform this task.">
            <MultiSelect
              options={competencyOptions}
              values={competencyIds}
              onChange={setCompetencyIds}
              placeholder="Select required competencies…"
              emptyText="No competencies defined yet"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || !functionId}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
