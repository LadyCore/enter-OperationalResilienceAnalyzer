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
import { useOra } from "@/store/OraContext";
import { uid } from "@/lib/id";
import type { Criticality, Process } from "@/types";
import { CriticalitySelect } from "./CriticalitySelect";
import { Field } from "./field";

interface ProcessFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  process?: Process;
}

export function ProcessFormDialog({ open, onOpenChange, process }: ProcessFormDialogProps) {
  const { db, upsert } = useOra();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [criticality, setCriticality] = useState<Criticality>("standard");

  useEffect(() => {
    if (open) {
      setName(process?.name ?? "");
      setDescription(process?.description ?? "");
      setCriticality(process?.criticality ?? "standard");
    }
  }, [open, process]);

  const handleSave = () => {
    if (!name.trim()) return;
    upsert("processes", {
      id: process?.id ?? uid("p"),
      name: name.trim(),
      description: description.trim(),
      criticality,
      organizationId: db.organization.id,
    });
    toast.success(process ? "Process updated" : "Process created");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{process ? "Edit process" : "New process"}</DialogTitle>
          <DialogDescription>
            A process groups related functions and tasks under the organization.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Customer Order Management" />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What does this process cover?" />
          </Field>
          <Field label="Criticality">
            <CriticalitySelect value={criticality} onChange={setCriticality} />
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
