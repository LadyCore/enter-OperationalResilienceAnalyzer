import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Field } from "@/components/entities/field";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useOra } from "@/store/OraContext";
import { validatePassword } from "@/lib/passwordPolicy";
import { isEmailFormatError } from "@/lib/emailVerification";

type Mode = "login" | "signup";

const VERIFY_REDIRECT = `${window.location.origin}/verify-email`;

/**
 * Login / signup. Email verification is required by the auth provider, so a new
 * account has no session until the verification link is followed. Unverified
 * sign-in attempts are denied with a clear explanation and a resend option.
 */
export function LoginPage() {
  const { t } = useTranslation();
  const { signOut } = useOra();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // After signup (or unverified login) we show the verification prompt.
  const [verifyPrompt, setVerifyPrompt] = useState<{ email: string } | null>(null);
  const [resent, setResent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setEmailError(null);
    setResent(false);

    if (!email.trim() || !password) {
      setError(t("auth.enterEmailAndPassword"));
      return;
    }
    // The password policy applies when creating a new password (signup), not
    // when signing in with an existing account.
    if (mode === "signup") {
      const policyError = validatePassword(password);
      if (policyError) {
        setError(t(policyError));
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        // A session is established; the auth listener loads the workspace.
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: VERIFY_REDIRECT },
        });
        if (signUpError) {
          // "User already registered" etc. — avoid revealing whether the account exists.
          throw signUpError;
        }
        // Email verification is required: no session starts until the link is
        // followed. Direct the user to verify first.
        setVerifyPrompt({ email: email.trim() });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("auth.authenticationFailed");
      // Unverified account: the provider denies access until the email is confirmed.
      if (/not confirmed|confirm your email|email not verified/i.test(message)) {
        setVerifyPrompt({ email: email.trim() });
      } else if (isEmailFormatError(message)) {
        // Reuse the provider's rejection result: show a clear message tied to
        // the Email field instead of a generic form error.
        setEmailError(t("auth.emailInvalidFormat"));
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    if (!verifyPrompt) return;
    setError(null);
    setResent(false);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: verifyPrompt.email,
        options: { emailRedirectTo: VERIFY_REDIRECT },
      });
      if (error) throw error;
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.couldNotResendVerification"));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setError(null);
    setVerifyPrompt(null);
    setResent(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
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
            <CardTitle>
              {verifyPrompt
                ? t("auth.verifyEmailTitle")
                : mode === "login"
                  ? t("auth.signIn")
                  : t("auth.createAccount")}
            </CardTitle>
            <CardDescription>
              {verifyPrompt
                ? t("auth.verifyEmailDescription")
                : mode === "login"
                  ? t("auth.signInDescription")
                  : t("auth.createAccountDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {verifyPrompt ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("auth.verificationSentLine", { email: verifyPrompt.email })}
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
                <Button className="w-full" onClick={resendVerification} disabled={busy}>
                  {busy ? t("auth.sending") : t("auth.resendVerificationEmail")}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    void signOut();
                    setVerifyPrompt(null);
                    setError(null);
                    setResent(false);
                  }}
                >
                  {t("auth.backToSignIn")}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label={t("auth.email")}>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    placeholder={t("common.emailPlaceholder")}
                    aria-invalid={Boolean(emailError)}
                  />
                  {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                </Field>
                <Field
                  label={t("auth.password")}
                  hint={mode === "signup" ? t("auth.passwordPolicyHint") : undefined}
                >
                  <Input
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === "signup" ? t("auth.passwordPlaceholder") : t("auth.yourPassword")
                    }
                  />
                </Field>

                {mode === "login" && (
                  <div className="flex justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {t("auth.forgotPassword")}
                    </Link>
                  </div>
                )}

                {error && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy
                    ? t("auth.pleaseWait")
                    : mode === "login"
                      ? t("auth.signIn")
                      : t("auth.createAccount")}
                </Button>

                <button
                  type="button"
                  onClick={switchMode}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  {mode === "login" ? t("auth.switchToSignup") : t("auth.switchToLogin")}
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/terms" className="underline-offset-2 transition-colors hover:text-foreground hover:underline">
            {t("terms.title")}
          </Link>
        </p>
      </div>
    </div>
  );
}
