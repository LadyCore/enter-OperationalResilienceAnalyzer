import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOra } from "@/store/OraContext";
import { LoginPage } from "./LoginPage";
import { AppShell } from "@/components/layout/AppShell";
import { AccessGate } from "@/components/access/AccessGate";
import { gateState } from "@/lib/access/status";

/**
 * Guards the authenticated application.
 *
 * Order matters for startup performance:
 *  1. Wait only for the session/access restore (fast single RPC).
 *  2. If access is not unlocked (DEMO activation required / blocked), render the
 *     gate screen immediately — no organization data is fetched or created.
 *  3. Only once access is unlocked do we wait for the workspace (db) and render
 *     the ORA shell.
 */
export function AppGuard() {
  const { user, isLoading, db, access, accessFailed, workspaceFailed, retryWorkspace } = useOra();

  // Session restore in progress (initial getSession / auth listener).
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Loading ORA…</span>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  // Access still resolving.
  if (!access && !accessFailed) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Checking access…</span>
      </div>
    );
  }

  // Access resolution failed → AccessGate renders its own retry state.
  if (accessFailed && !access) {
    return <AccessGate />;
  }

  // DEMO activation / blocked screens need no organization data at all.
  if (gateState(access) !== "unlocked") {
    return <AccessGate />;
  }

  // Access is unlocked but the workspace failed to load → allow a retry.
  if (workspaceFailed) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-center">
          <h2 className="font-display text-base font-semibold">Could not load your organizations</h2>
          <p className="mt-2 text-sm text-muted-foreground">Please retry to continue.</p>
          <Button className="mt-4 w-full" onClick={retryWorkspace}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  // Access is unlocked but the workspace is still loading.
  if (!db) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Loading your organizations…</span>
      </div>
    );
  }

  return (
    <AccessGate>
      <AppShell />
    </AccessGate>
  );
}
