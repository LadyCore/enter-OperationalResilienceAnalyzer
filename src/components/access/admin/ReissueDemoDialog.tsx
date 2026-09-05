import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
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
import { reissueDemo } from "@/lib/access/api";
import { DEMO_DAYS, type TaxType } from "@/lib/access/types";
import { useRpcError } from "@/hooks/useRpcError";
import { Field } from "@/components/entities/field";
import { cn } from "@/lib/utils";

interface ReissueDemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetEmail?: string;
  onDone: () => void;
}

/**
 * Owner action: start a 15-day DEMO for another user. The 12-month DNI/CUIT
 * reuse rule is still enforced by the backend.
 */
export function ReissueDemoDialog({ open, onOpenChange, presetEmail, onDone }: ReissueDemoDialogProps) {
  const { t } = useTranslation();
  const rpcError = useRpcError();
  const [email, setEmail] = useState(presetEmail ?? "");
  const [kind, setKind] = useState<"individual" | "company">("individual");
  const [clientName, setClientName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(presetEmail ?? "");
      setTaxId("");
      setClientName("");
    }
  }, [open, presetEmail]);

  const taxType: TaxType = kind === "individual" ? "dni" : "cuit";
  const taxLabel = kind === "individual" ? "DNI" : "CUIT";

  const handleSubmit = async () => {
    if (!email.trim() || !taxId.trim()) return;
    setBusy(true);
    try {
      const result = await reissueDemo({
        userEmail: email,
        taxType,
        taxId: taxId.replace(/\D/g, ""),
        clientName: kind === "company" ? clientName : undefined,
      });
      if (result.ok) {
        toast.success(t("license.demoStartedToast", { days: DEMO_DAYS, email: email.trim() }));
        onOpenChange(false);
        onDone();
      } else {
        toast.error(rpcError(result));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("license.couldNotStartDemo"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("license.startDemoTitle", { days: DEMO_DAYS })}</DialogTitle>
          <DialogDescription>
            {t("license.startDemoDescription", { days: DEMO_DAYS, taxLabel })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("auth.email")}>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-1">
            {(
              [
                { key: "individual", labelKey: "demo.activate.individual" },
                { key: "company", labelKey: "license.company" },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setKind(option.key)}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  kind === option.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>

          {kind === "company" && (
            <Field label={t("license.organizationName")}>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder={t("license.organizationNamePlaceholder")} />
            </Field>
          )}

          <Field label={taxLabel}>
            <Input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder={
                kind === "individual"
                  ? t("demo.activate.dniPlaceholder")
                  : t("demo.activate.cuitPlaceholder")
              }
              inputMode="numeric"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={busy || !email.trim() || !taxId.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("license.startDemoAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
