import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Field } from "@/components/entities/field";
import { useOra } from "@/store/OraContext";

type Mode = "login" | "signup";

const VERIFY_REDIRECT = `${window.location.origin}/verify-email`;

/**
 * Login / signup. Email verification is required by the auth provider, so a new
 * account has no session until the verification link is followed. Unverified
 * sign-in attempts are denied with a clear explanation and a resend option.
 */
export function LoginPage() {
  const { signOut } = useOra();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // After signup (or unverified login) we show the verification prompt.
  const [verifyPrompt, setVerifyPrompt] = useState<{ email: string } | null>(null);
  const [resent, setResent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setResent(false);

    if (!email.trim() || password.length < 6) {
      setError("Enter a valid email and a password of at least 6 characters.");
      return;
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
      const message = err instanceof Error ? err.message : "Authentication failed.";
      // Unverified account: the provider denies access until the email is confirmed.
      if (/not confirmed|confirm your email|email not verified/i.test(message)) {
        setVerifyPrompt({ email: email.trim() });
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
      setError(err instanceof Error ? err.message : "Could not resend the verification email.");
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
            <CardTitle>
              {verifyPrompt ? "Verify your email" : mode === "login" ? "Sign in" : "Create account"}
            </CardTitle>
            <CardDescription>
              {verifyPrompt
                ? "Your email address must be verified before you can access ORA."
                : mode === "login"
                  ? "Access your organizations and their operational analysis."
                  : "Sign up to start analyzing your organization. Activate your free DEMO on first access."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {verifyPrompt ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  We sent a verification link to <span className="font-medium">{verifyPrompt.email}</span>.
                  Check your inbox and click the link to confirm your email address. You will be able to
                  sign in once your email is verified.
                </p>
                {resent && (
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Verification email sent. Check your inbox.
                  </p>
                )}
                {error && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button className="w-full" onClick={resendVerification} disabled={busy}>
                  {busy ? "Sending…" : "Resend verification email"}
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
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Email">
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </Field>
                <Field label="Password">
                  <Input
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                  />
                </Field>

                {mode === "login" && (
                  <div className="flex justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Forgot password?
                    </Link>
                  </div>
                )}

                {error && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
                </Button>

                <button
                  type="button"
                  onClick={switchMode}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  {mode === "login"
                    ? "Don't have an account? Create one"
                    : "Already have an account? Sign in"}
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
