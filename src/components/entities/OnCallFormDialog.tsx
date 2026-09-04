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
  const taskOptions = db.tasks.map((t) => {
    const fn = db.functions.find((f) => f.id === t.functionId);
    const proc = fn ? db.processes.find((p) => p.id === fn.processId) : undefined;
    return { value: t.id, label: t.name, description: proc ? `${proc.name} / ${fn?.name}` : undefined };
  });
  const competencyOptions = db.competencies.map((c) => ({ value: c.id, label: c.name }));

  const handleSave = () => {
    if (!personId || !modality.trim()) {
      toast.error("Select a person and enter an on-call modality");
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
    toast.success(assignment ? "On-call assignment updated" : "On-call assignment created");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{assignment ? "Edit on-call assignment" : "New on-call assignment"}</DialogTitle>
          <DialogDescription>
            Passive on-call (guardia pasiva): permanent operational availability outside ordinary
            hours. The person keeps their usual role and dependency — this never counts as vacation
            coverage and never changes the base analysis.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Person on call">
            <SearchableSelect
              options={personOptions}
              value={personId}
              onChange={setPersonId}
              placeholder="Select a person…"
              searchPlaceholder="Search name or surname…"
              className="w-full"
            />
          </Field>
          <Field label="Modality" hint="Free text — H24, Shifts or the organization's own scheme.">
            <Input value={modality} onChange={(e) => setModality(e.target.value)} placeholder="e.g. H24 or Shifts" />
          </Field>
          <Field label="Shift / period" hint="Free text — no fixed structure is imposed.">
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. Night, Weekend, Week 2…" />
          </Field>
          <Field label="Capabilities covered on call" hint="Concrete tasks this availability responds to.">
            <MultiSelect
              options={taskOptions}
              values={taskIds}
              onChange={setTaskIds}
              placeholder="Select tasks…"
            />
          </Field>
          <Field label="Enabling competencies">
            <MultiSelect
              options={competencyOptions}
              values={competencyIds}
              onChange={setCompetencyIds}
              placeholder="Select competencies…"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!personId || !modality.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
