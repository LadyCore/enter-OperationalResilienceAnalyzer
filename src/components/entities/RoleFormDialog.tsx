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
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/common/MultiSelect";
import { useOra } from "@/store/OraContext";
import { uid } from "@/lib/id";
import type { Role } from "@/types";
import { Field } from "./field";

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: Role;
}

export function RoleFormDialog({ open, onOpenChange, role }: RoleFormDialogProps) {
  const { db, upsert } = useOra();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [competencyIds, setCompetencyIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName(role?.name ?? "");
      setDescription(role?.description ?? "");
      setCompetencyIds(role?.competencyIds ?? []);
    }
  }, [open, role]);

  const competencyOptions = db.competencies.map((c) => ({ value: c.id, label: c.name }));

  const handleSave = () => {
    if (!name.trim()) return;
    upsert("roles", {
      id: role?.id ?? uid("r"),
      name: name.trim(),
      description: description.trim(),
      competencyIds,
    });
    toast.success(role ? "Role updated" : "Role created");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{role ? "Edit role" : "New role"}</DialogTitle>
          <DialogDescription>
            A role bundles competencies. People are assigned to roles.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. IT Systems Administrator" />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
          <Field label="Associated competencies">
            <MultiSelect
              options={competencyOptions}
              values={competencyIds}
              onChange={setCompetencyIds}
              placeholder="Select competencies…"
              emptyText="No competencies defined yet"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
