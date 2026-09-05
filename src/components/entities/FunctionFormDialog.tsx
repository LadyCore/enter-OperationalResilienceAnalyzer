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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOra } from "@/store/OraContext";
import { uid } from "@/lib/id";
import type { Criticality, OrgFunction } from "@/types";
import { CriticalitySelect } from "./CriticalitySelect";
import { Field } from "./field";

interface FunctionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fn?: OrgFunction;
  presetProcessId?: string;
}

export function FunctionFormDialog({ open, onOpenChange, fn, presetProcessId }: FunctionFormDialogProps) {
  const { t } = useTranslation();
  const { db, upsert } = useOra();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [processId, setProcessId] = useState("");
  const [criticality, setCriticality] = useState<Criticality>("standard");

  useEffect(() => {
    if (open) {
      setName(fn?.name ?? "");
      setDescription(fn?.description ?? "");
      setProcessId(fn?.processId ?? presetProcessId ?? db.processes[0]?.id ?? "");
      setCriticality(fn?.criticality ?? "standard");
    }
  }, [open, fn, presetProcessId, db.processes]);

  const handleSave = () => {
    if (!name.trim() || !processId) return;
    upsert("functions", {
      id: fn?.id ?? uid("f"),
      name: name.trim(),
      description: description.trim(),
      processId,
      criticality,
    });
    toast.success(fn ? t("function.updated") : t("function.created"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{fn ? t("function.edit") : t("function.new")}</DialogTitle>
          <DialogDescription>{t("function.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("entity.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("function.namePlaceholder")} />
          </Field>
          <Field label={t("entity.description")}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
          <Field label={t("entity.process")}>
            <Select value={processId} onValueChange={setProcessId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {db.processes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("entity.criticality")}>
            <CriticalitySelect value={criticality} onChange={setCriticality} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || !processId}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
