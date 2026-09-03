import { Suspense, lazy } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useOra } from "@/store/OraContext";
import { LoginPage } from "./LoginPage";
import { gateState } from "@/lib/access/status";

// AppShell (the whole authenticated layout: nav, dropdowns, dialogs) and the
// access gate screens (DEMO activation, blocked, licensing) are only needed
// after a session exists. Lazy-loading keeps them out of the initial bundle so
// an anonymous visitor who reaches the login screen downloads far less JS.
const AppShell = lazy(() =>
  import("@/components/layout/AppShell").then((m) => ({ default: m.AppShell }))
);
const AccessGate = lazy(() =>
  import("@/components/access/AccessGate").then((m) => ({ default: m.AccessGate }))
);

function FullPageSpinner({ label }: { label: string }) {
  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="ml-2 text-sm">{label}</span>
    </div>
  );
}

function LazyGate() {
  return (
    <Suspense fallback={<FullPageSpinner label="Checking access…" />}>
      <AccessGate />
    </Suspense>
  );
}

/**
 * Guards the authenticated application.
 *
 * Order matters for startup performance and for security:
 *  1. Wait only for the session/access restore (fast single RPC).
 *  2. A pending PASSWORD_RECOVERY session can NEVER reach the app: while
 *     `pendingRecovery` is true every protected route (including "/") redirects
 *     to /reset-password, regardless of access/license/DEMO state.
 *  3. If access is not unlocked (DEMO activation required / blocked), render the
 *     gate screen immediately — no organization data is fetched or created.
 *  4. Only once access is unlocked do we wait for the workspace (db) and render
 *     the ORA shell.
 */
export function AppGuard() {
  const { user, isLoading, db, access, accessFailed, pendingRecovery, workspaceFailed, retryWorkspace } = useOra();

  // Session restore in progress (initial getSession / auth listener).
  if (isLoading) {
    return <FullPageSpinner label="Loading ORA…" />;
  }

  if (!user) return <LoginPage />;

  // SECURITY: a recovery session must never unlock the dashboard. Force the
  // password reset flow even if the user navigates to "/" or a protected route.
  if (pendingRecovery) {
    return <Navigate to="/reset-password" replace />;
  }

  // Access still resolving.
  if (!access && !accessFailed) {
    return <FullPageSpinner label="Checking access…" />;
  }

  // Access resolution failed or access is not unlocked → gate screens handle
  // retry / DEMO activation / blocked.
  if (accessFailed && !access) {
    return <LazyGate />;
  }

  if (gateState(access) !== "unlocked") {
    return <LazyGate />;
  }

  // Access is unlocked but the workspace failed to load → allow a retry.
  if (workspaceFailed) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-center">
          <h2 className="font-display text-base font-semibold">Could not load your organizations</h2>
          <p className="mt-2 text-sm text-muted-foreground">Please retry to continue.</p>
          <button
            type="button"
            onClick={retryWorkspace}
            className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Access is unlocked but the workspace is still loading.
  if (!db) {
    return <FullPageSpinner label="Loading your organizations…" />;
  }

  return (
    <Suspense fallback={<FullPageSpinner label="Loading ORA…" />}>
      <AccessGate>
        <AppShell />
      </AccessGate>
    </Suspense>
  );
}
