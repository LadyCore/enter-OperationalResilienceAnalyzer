import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MailCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useOra } from "@/store/OraContext";

/**
 * Shown when a signed-in session's email is not confirmed yet. The account must
 * verify its email address before it can reach any protected route. Access and
 * the workspace are suppressed at the store level; this screen is the only thing
 * the user sees until email_confirmed_at is set.
 */
export function EmailVerificationScreen() {
  const { t } = useTranslation();
  const { user, signOut } = useOra();
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    if (!user?.email) return;
    setBusy(true);
    setError(null);
    setResent(false);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
        options: { emailRedirectTo: `${window.location.origin}/verify-email` },
      });
      if (resendError) throw resendError;
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.couldNotResendVerification"));
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
          <p className="text-sm text-muted-foreground">{t("brand.subtitle")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("auth.verifyEmailTitle")}</CardTitle>
            <CardDescription>{t("auth.verifyEmailDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("auth.verificationSentDescription", { email: user?.email })}
            </p>
            {resent && (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {t("auth.verificationEmailSent")}
              </p>
            )}
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button className="w-full" onClick={resend} disabled={busy}>
              <MailCheck className="h-4 w-4" />
              {busy ? t("auth.sending") : t("auth.resendVerificationEmail")}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => void signOut()}
              disabled={busy}
            >
              {t("auth.signOut")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
