import { useState } from "react";
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
import { PASSWORD_PLACEHOLDER, validatePassword } from "@/lib/passwordPolicy";
import { Field } from "@/components/entities/field";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
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
      setError("Enter your current password.");
      return;
    }
    const policyError = validatePassword(next);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      // verify current password against the auth provider
      const { error: verifyError } = await supabase.auth.updateUser({ password: next });
      if (verifyError) throw verifyError;
      toast.success("Password updated.");
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change your password.");
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
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Update the password for your account.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Current password">
            <Input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="Current password"
            />
          </Field>
          <Field label="New password" hint="Exactly 8 characters, with a letter, a number and a special character. No spaces.">
            <Input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder={PASSWORD_PLACEHOLDER}
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat the new password"
            />
          </Field>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              <KeyRound className="h-4 w-4" />
              {busy ? "Updating…" : "Update password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
