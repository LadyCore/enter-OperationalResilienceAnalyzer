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
import type { Competency } from "@/types";
import { Field } from "./field";

interface CompetencyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competency?: Competency;
}

export function CompetencyFormDialog({ open, onOpenChange, competency }: CompetencyFormDialogProps) {
  const { upsert } = useOra();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setName(competency?.name ?? "");
      setDescription(competency?.description ?? "");
    }
  }, [open, competency]);

  const handleSave = () => {
    if (!name.trim()) return;
    upsert("competencies", {
      id: competency?.id ?? uid("c"),
      name: name.trim(),
      description: description.trim(),
    });
    toast.success(competency ? "Competency updated" : "Competency created");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{competency ? "Edit competency" : "New competency"}</DialogTitle>
          <DialogDescription>
            A competency is a capability that tasks require and people hold.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Disaster Recovery" />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
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
