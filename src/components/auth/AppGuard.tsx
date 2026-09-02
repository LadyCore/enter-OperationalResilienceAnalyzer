import { Loader2 } from "lucide-react";
import { useOra } from "@/store/OraContext";
import { LoginPage } from "./LoginPage";
import { AppShell } from "@/components/layout/AppShell";
import { AccessGate } from "@/components/access/AccessGate";

/**
 * Guards the authenticated application. Renders the login screen when there is
 * no session, and the ORA shell once the user's workspace has loaded and their
 * access (owner / license / DEMO) has been resolved.
 */
export function AppGuard() {
  const { user, isLoading, db } = useOra();

  if (isLoading || (user && !db)) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Loading your organizations…</span>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <AccessGate>
      <AppShell />
    </AccessGate>
  );
}
