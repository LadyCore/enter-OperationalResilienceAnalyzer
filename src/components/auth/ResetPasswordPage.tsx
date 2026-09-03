import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useOra } from "@/store/OraContext";
import { PASSWORD_PLACEHOLDER, validatePassword } from "@/lib/passwordPolicy";
import { Field } from "@/components/entities/field";

type Status = "checking" | "ready" | "invalid";

/**
 * Landing page for the password-reset callback. The recovery token in the URL
 * is processed by the Supabase client into a recovery session; once present,
 * the user can set a new password.
 *
 * While the recovery session is pending, OraContext keeps `pendingRecovery`
 * true so AppGuard never grants access to the dashboard; after a successful
 * password update this page clears the marker and signs out so the user logs
 * back in with their new password.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { clearPendingRecovery, signOut } = useOra();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setStatus("ready");
        return;
      }
      attempts += 1;
      if (attempts < 5) {
        setTimeout(() => void check(), 800);
      } else {
        setStatus("invalid");
      }
    };

    void check();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const policyError = validatePassword(password);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      // The recovery gate can now be released: the password was changed.
      clearPendingRecovery();
      // Sign out so the user logs in again with their new password.
      await signOut();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">ORA</h1>
          <p className="text-sm text-muted-foreground">Organizational Resilience Analyzer</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
            <CardDescription>
              {status === "checking"
                ? "Checking your reset link…"
                : status === "ready"
                  ? "Choose a new password for your account."
                  : done
                    ? "Password updated"
                    : "This reset link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === "checking" && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="ml-2 text-sm">Checking…</span>
              </div>
            )}

            {status === "invalid" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This password reset link is invalid or has expired. Request a new link to continue.
                </p>
                <Button className="w-full" onClick={() => navigate("/forgot-password")}>
                  Request a new link
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>
                  Back to sign in
                </Button>
              </div>
            )}

            {status === "ready" && done && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-md border border-risk-low/30 bg-risk-low/10 p-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-risk-low" />
                  <div>
                    <p className="font-medium text-foreground">Password updated</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Your password has been changed. You can now sign in with your new password.
                    </p>
                  </div>
                </div>
                <Button className="w-full" onClick={() => navigate("/")}>
                  Sign in
                </Button>
              </div>
            )}

            {status === "ready" && !done && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="New password" hint="Exactly 8 characters, with a letter, a number and a special character. No spaces.">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

                <Button type="submit" className="w-full" disabled={busy}>
                  <KeyRound className="h-4 w-4" />
                  {busy ? "Updating…" : "Reset password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
