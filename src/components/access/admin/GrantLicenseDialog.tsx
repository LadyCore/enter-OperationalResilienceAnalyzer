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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { grantLicense } from "@/lib/access/api";
import { CURRENT_VERSION, type LicenseType, type TaxType } from "@/lib/access/types";
import { useRpcError } from "@/hooks/useRpcError";
import { Field } from "@/components/entities/field";

interface GrantLicenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetEmail?: string;
  onDone: () => void;
}

/** Owner action: record a perpetual license for a user (no payment involved). */
export function GrantLicenseDialog({ open, onOpenChange, presetEmail, onDone }: GrantLicenseDialogProps) {
  const { t } = useTranslation();
  const rpcError = useRpcError();
  const [email, setEmail] = useState(presetEmail ?? "");
  const [version, setVersion] = useState(CURRENT_VERSION);
  const [clientName, setClientName] = useState("");
  const [taxType, setTaxType] = useState<TaxType | "">("");
  const [taxId, setTaxId] = useState("");
  const [licenseType, setLicenseType] = useState<LicenseType>("individual");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setEmail(presetEmail ?? "");
  }, [open, presetEmail]);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const result = await grantLicense({
        userEmail: email,
        version,
        clientName: clientName || undefined,
        taxType: (taxType || null) as TaxType | null,
        taxId: taxId.trim() || null,
        licenseType,
      });
      if (result.ok) {
        toast.success(t("license.grantedToast"));
        onOpenChange(false);
        onDone();
      } else {
        toast.error(rpcError(result));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("license.couldNotGrant"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("license.grantTitle")}</DialogTitle>
          <DialogDescription>{t("license.grantDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("auth.email")}>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" autoFocus />
          </Field>
          <Field label={t("license.version")}>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} />
          </Field>
          <Field label={t("license.type")} hint={t("license.typeHint")}>
            <Select value={licenseType} onValueChange={(v) => setLicenseType(v as LicenseType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">{t("license.type.individual")}</SelectItem>
                <SelectItem value="company">{t("license.type.company")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("license.clientName")} hint={t("license.clientNameHint")}>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder={t("license.clientNamePlaceholder")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("license.taxType")} hint={t("common.optional")}>
              <Select value={taxType || undefined} onValueChange={(v) => setTaxType(v as TaxType)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.select")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dni">DNI</SelectItem>
                  <SelectItem value="cuit">CUIT</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("license.taxId")} hint={t("common.optional")}>
              <Input
                value={taxId}
                onChange={(e) => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder={t("license.digitsOnly")}
                inputMode="numeric"
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={busy || !email.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("license.grantAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
