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
  const { t } = useTranslation();
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
    toast.success(process ? t("process.updated") : t("process.created"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{process ? t("process.edit") : t("process.new")}</DialogTitle>
          <DialogDescription>{t("process.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("entity.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("process.namePlaceholder")} />
          </Field>
          <Field label={t("entity.description")}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t("process.descriptionPlaceholder")} />
          </Field>
          <Field label={t("entity.criticality")}>
            <CriticalitySelect value={criticality} onChange={setCriticality} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
