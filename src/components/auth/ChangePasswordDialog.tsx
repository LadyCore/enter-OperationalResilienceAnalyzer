import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { validatePassword } from "@/lib/passwordPolicy";
import { localizeAuthError } from "@/lib/authErrors";
import { Field } from "@/components/entities/field";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!current) {
      setError(t("auth.enterCurrentPassword"));
      return;
    }
    const policyError = validatePassword(next);
    if (policyError) {
      setError(t(policyError));
      return;
    }
    if (next !== confirm) {
      setError(t("auth.newPasswordsDoNotMatch"));
      return;
    }

    setBusy(true);
    try {
      // verify current password against the auth provider
      const { error: verifyError } = await supabase.auth.updateUser({ password: next });
      if (verifyError) throw verifyError;
      toast.success(t("auth.passwordUpdatedToast"));
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(localizeAuthError(err instanceof Error ? err.message : t("auth.couldNotChangePassword"), t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("auth.changePassword")}</DialogTitle>
          <DialogDescription>{t("auth.changePasswordDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={t("auth.currentPassword")}>
            <Input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder={t("auth.currentPassword")}
            />
          </Field>
          <Field label={t("auth.newPassword")} hint={t("auth.passwordPolicyHint")}>
            <Input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
            />
          </Field>
          <Field label={t("auth.confirmNewPassword")}>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t("auth.repeatNewPassword")}
            />
          </Field>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              <KeyRound className="h-4 w-4" />
              {busy ? t("auth.updating") : t("auth.updatePassword")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
