import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, UserPlus } from "lucide-react";
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
import { addLicenseUser } from "@/lib/access/api";
import { useRpcError } from "@/hooks/useRpcError";
import { Field } from "@/components/entities/field";

interface AddLicenseUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseId: string;
  onDone: () => void;
}

/** Owner action: associate an existing ORA account to a perpetual license. */
export function AddLicenseUserDialog({ open, onOpenChange, licenseId, onDone }: AddLicenseUserDialogProps) {
  const { t } = useTranslation();
  const rpcError = useRpcError();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setEmail("");
  }, [open]);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const result = await addLicenseUser(licenseId, email);
      if (result.ok) {
        onOpenChange(false);
        onDone();
      } else {
        // Also surface the seat limit directly (clear, specific message).
        const message = result.reason === "seat_exceeded" ? t("access.error.seatExceeded") : rpcError(result);
        throw new Error(message);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("access.error.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("license.addUserTitle")}</DialogTitle>
          <DialogDescription>{t("license.addUserDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("auth.email")}>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("common.emailPlaceholder")}
              autoFocus
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={busy || !email.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {t("license.addUser")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
