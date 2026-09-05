import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Field } from "@/components/entities/field";

type Status = "checking" | "verified" | "expired";

/**
 * Landing page for the email-verification callback. The Supabase client
 * processes the tokens embedded in the URL; this page reports the outcome:
 * verified (email confirmed) or expired/invalid, with a resend option.
 */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("checking");
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (data.user?.email_confirmed_at) {
        setStatus("verified");
        return;
      }
      attempts += 1;
      // The client may still be exchanging the URL token; give it a moment.
      if (attempts < 5) {
        setTimeout(() => void check(), 800);
      } else {
        setStatus("expired");
      }
    };

    void check();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session?.user.email_confirmed_at) setStatus("verified");
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const resend = async () => {
    if (!email.trim()) {
      setError(t("auth.enterRegisteredEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    setResent(false);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
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
            <CardDescription>
              {status === "checking"
                ? t("auth.confirmingEmail")
                : status === "verified"
                  ? t("auth.emailVerified")
                  : t("auth.verificationLinkInvalid")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === "checking" && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="ml-2 text-sm">{t("auth.checking")}</span>
              </div>
            )}

            {status === "verified" && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-md border border-risk-low/30 bg-risk-low/10 p-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-risk-low" />
                  <div>
                    <p className="font-medium text-foreground">{t("auth.emailVerified")}</p>
                    <p className="mt-0.5 text-muted-foreground">{t("auth.emailVerifiedNote")}</p>
                  </div>
                </div>
                <Button className="w-full" onClick={() => navigate("/")}>
                  {t("auth.continueToOra")}
                </Button>
              </div>
            )}

            {status === "expired" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("auth.verificationLinkInvalidNote")}</p>
                <Field label={t("auth.email")}>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("common.emailPlaceholder")}
                  />
                </Field>
                {error && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
                {resent && (
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    {t("auth.verificationEmailSent")}
                  </p>
                )}
                <Button className="w-full" onClick={resend} disabled={busy}>
                  <MailCheck className="h-4 w-4" />
                  {busy ? t("auth.sending") : t("auth.resendVerificationEmail")}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>
                  {t("auth.backToSignIn")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
