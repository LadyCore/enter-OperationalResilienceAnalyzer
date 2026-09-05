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
import { Field } from "./field";

interface OrganizationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrganizationFormDialog({ open, onOpenChange }: OrganizationFormDialogProps) {
  const { t } = useTranslation();
  const { db, setOrganization } = useOra();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setName(db.organization.name);
      setDescription(db.organization.description);
    }
  }, [open, db.organization]);

  const handleSave = () => {
    if (!name.trim()) return;
    setOrganization({ ...db.organization, name: name.trim(), description: description.trim() });
    toast.success(t("organization.updated"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("organization.edit")}</DialogTitle>
          <DialogDescription>{t("organization.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("entity.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("organization.namePlaceholder")} />
          </Field>
          <Field label={t("entity.description")}>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("organization.descriptionPlaceholder")}
              rows={4}
            />
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
