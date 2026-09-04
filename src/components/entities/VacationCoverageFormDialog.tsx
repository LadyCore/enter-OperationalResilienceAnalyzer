import { useEffect, useMemo, useState } from "react";
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
    () =>
      db.people.filter(
        (p) => p.id !== coveringPersonId && p.isActive,
      ),
    [db.people, coveringPersonId],
  );

  const availableTasks = useMemo(() => {
    // A vacation coverage covers concrete tasks of the covered person.
    const base = coveredPersonId
      ? (db.people.find((p) => p.id === coveredPersonId)?.taskIds ?? [])
      : [];
    const baseSet = new Set(base);
    return db.tasks
      .filter((t) => baseSet.has(t.id))
      .map((t) => {
        const fn = db.functions.find((f) => f.id === t.functionId);
        const proc = fn ? db.processes.find((p) => p.id === fn.processId) : undefined;
        return { value: t.id, label: t.name, description: proc ? `${proc.name} / ${fn?.name}` : undefined };
      });
  }, [db, coveredPersonId]);

  const competencyOptions = db.competencies.map((c) => ({ value: c.id, label: c.name }));

  const handleSave = () => {
    if (!coveringPersonId || !coveredPersonId || coveringPersonId === coveredPersonId) {
      toast.error("Select two different people");
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
    toast.success(coverage ? "Coverage updated" : "Coverage created");
    onOpenChange(false);
  };

  const valid = Boolean(coveringPersonId) && Boolean(coveredPersonId) && coveringPersonId !== coveredPersonId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{coverage ? "Edit vacation coverage" : "New vacation coverage"}</DialogTitle>
          <DialogDescription>
            {personName(coveringPersonId) || "This person"} can temporarily cover concrete tasks of another
            person while that person is on a planned vacation. It never changes anyone's ordinary profile.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Covering person (who covers)">
            <SearchableSelect
              options={peopleOptions}
              value={coveringPersonId}
              onChange={setCoveringPersonId}
              placeholder="Select a person…"
              searchPlaceholder="Search name or surname…"
              className="w-full"
            />
          </Field>
          <Field label="Covered person (on vacation)" hint="The original dependency this coverage supports.">
            <SearchableSelect
              options={availableCovered.map((p) => ({
                value: p.id,
                label: p.name,
                searchTerms: p.name.split(/\s+/).filter(Boolean),
              }))}
              value={coveredPersonId}
              onChange={setCoveredPersonId}
              placeholder="Select a person…"
              searchPlaceholder="Search name or surname…"
              className="w-full"
            />
          </Field>
          <Field label="Covered role (optional)" hint="The role/puesto of the covered dependency.">
            <Select value={roleId || "none"} onValueChange={(v) => setRoleId(v === "none" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No specific role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific role</SelectItem>
                {roleOptions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Concrete tasks covered"
            hint={
              coveredPersonId
                ? "Tasks of the covered person this coverage enables."
                : "Select the covered person first to see their tasks."
            }
          >
            <MultiSelect
              options={availableTasks}
              values={taskIds}
              onChange={setTaskIds}
              placeholder="Select tasks…"
              emptyText="No tasks for the covered person"
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
          <Button onClick={handleSave} disabled={!valid}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
