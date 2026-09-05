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
import type { Competency } from "@/types";
import { Field } from "./field";

interface CompetencyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competency?: Competency;
}

export function CompetencyFormDialog({ open, onOpenChange, competency }: CompetencyFormDialogProps) {
  const { t } = useTranslation();
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
    toast.success(competency ? t("competency.updated") : t("competency.created"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{competency ? t("competency.edit") : t("competency.new")}</DialogTitle>
          <DialogDescription>{t("competency.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("entity.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("competency.namePlaceholder")} />
          </Field>
          <Field label={t("entity.description")}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
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
