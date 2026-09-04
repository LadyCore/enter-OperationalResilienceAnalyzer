import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/access/api";
import { gateState } from "@/lib/access/status";
import type { MyAccess } from "@/lib/access/types";
import {
  createOrganization,
  deleteOrganization,
  ensureDemoOrganization,
  listOrganizations,
  loadOrganization,
  resetDemoOrganization,
  updateOrganization,
  upsertRow,
  deleteRow,
  type OrgSummary,
} from "@/integrations/ora/api";
import type { CollectionKey, Db, Entity, Organization } from "@/types";

const ACTIVE_ORG_KEY = "ora-active-org";
const PASSWORD_RECOVERY_KEY = "ora-password-recovery-pending";

const EMPTY_DB: Db = {
  organization: { id: "", name: "", description: "" },
  areas: [],
  processes: [],
  functions: [],
  tasks: [],
  roles: [],
  people: [],
  competencies: [],
  vacationCoverages: [],
  onCallAssignments: [],
};

interface OraApi {
  // Session
  user: User | null;
  session: Session | null;
  /** True while the session/workspace is being restored or first-loaded. */
  isLoading: boolean;
  signOut: () => Promise<void>;
  /**
   * True while a PASSWORD_RECOVERY session is pending (the user opened a
   * recovery link but has not changed their password yet). While true the app
   * must NOT give access to the dashboard: access/license/DEMO resolution and
   * the workspace load are suppressed and every protected route redirects to
   * /reset-password.
   */
  pendingRecovery: boolean;
  /** Clears the pending-recovery marker (called after the password is updated). */
  clearPendingRecovery: () => void;

  // Access & licensing
  access: MyAccess | null;
  accessFailed: boolean;
  isOwner: boolean;
  refreshAccess: () => Promise<void>;
  /** Apply a server-computed access state without a second round trip. */
  applyAccess: (next: MyAccess) => void;

  // Multi-organization
  organizations: OrgSummary[];
  activeOrganizationId: string | null;
  addOrganization: (db: Db) => Promise<void>;
  setActiveOrganization: (id: string) => Promise<void>;
  removeOrganization: (id: string) => Promise<void>;
  /** True when the workspace failed to load (unlocked access, no data). */
  workspaceFailed: boolean;
  retryWorkspace: () => void;

  // Active organization data + existing synchronous API (forms keep working)
  db: Db;
  setOrganization: (org: Organization) => void;
  upsert: (collection: CollectionKey, entity: Entity) => void;
  remove: (collection: CollectionKey, id: string) => void;
  resetToSeed: () => void;
}

const OraContext = createContext<OraApi | null>(null);

export function OraProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRecovery, setPendingRecovery] = useState(false);
  const [access, setAccess] = useState<MyAccess | null>(null);
  const [accessFailed, setAccessFailed] = useState(false);
  const [workspaceFailed, setWorkspaceFailed] = useState(false);
  const [organizations, setOrganizations] = useState<OrgSummary[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [db, setDb] = useState<Db | null>(null);

  const activeOrgIdRef = useRef<string | null>(null);
  // Chained promise that preserves write order to the backend.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  // Ensures the workspace is loaded only once per signed-in session, right after
  // access has been resolved to an unlocked state.
  const workspaceStartedRef = useRef(false);

  const enqueue = useCallback((task: () => Promise<void>) => {
    queueRef.current = queueRef.current.then(task).catch((err) => {
      console.error("ORA persistence failed:", err);
      toast.error("Could not save changes. Please retry.");
    });
  }, []);

  const refreshAccess = useCallback(async () => {
    setAccessFailed(false);
    try {
      const next = await getMyAccess();
      setAccess(next);
    } catch (err) {
      console.error("Failed to resolve access:", err);
      setAccessFailed(true);
    } finally {
      // Access has been resolved (success or failure): the initial spinner ends
      // here. The workspace load (if needed) is driven separately by the access
      // state, so blocked/activation screens never wait for organization data.
      setIsLoading(false);
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    try {
      setWorkspaceFailed(false);
      let orgs = await listOrganizations();
      if (orgs.length === 0) {
        const created = await ensureDemoOrganization();
        if (created) {
          // The fresh demo Db is already fully materialized: use it directly
          // instead of re-listing and re-loading what we just created.
          setOrganizations([{ id: created.organization.id, name: created.organization.name, isDemo: true }]);
          activeOrgIdRef.current = created.organization.id;
          setActiveOrganizationId(created.organization.id);
          localStorage.setItem(ACTIVE_ORG_KEY, created.organization.id);
          setDb(created);
          return;
        }
        orgs = await listOrganizations();
      }
      setOrganizations(orgs);

      const saved = localStorage.getItem(ACTIVE_ORG_KEY);
      const initial = orgs.find((o) => o.id === saved) ?? orgs[0] ?? null;
      if (initial) {
        activeOrgIdRef.current = initial.id;
        setActiveOrganizationId(initial.id);
        setDb(await loadOrganization(initial.id));
      } else {
        activeOrgIdRef.current = null;
        setActiveOrganizationId(null);
        setDb(EMPTY_DB);
      }
    } catch (err) {
      console.error("Failed to load workspace:", err);
      workspaceStartedRef.current = false;
      setWorkspaceFailed(true);
      toast.error("Could not load your organizations.");
    }
  }, []);

  const retryWorkspace = useCallback(() => {
    if (!user) return;
    workspaceStartedRef.current = false;
    void loadWorkspace();
  }, [user, loadWorkspace]);

  /** Called after the password is successfully updated to release the gate. */
  const clearPendingRecovery = useCallback(() => {
    setPendingRecovery(false);
    try {
      localStorage.removeItem(PASSWORD_RECOVERY_KEY);
    } catch { /* ignore */ }
  }, []);

  /** Apply a server-computed access state (e.g. returned by request_demo). */
  const applyAccess = useCallback((next: MyAccess) => {
    setAccessFailed(false);
    setAccess(next);
  }, []);

  // Register the auth listener BEFORE checking for an existing session, so the
  // initial session restore can never be missed. No async callback here; supabase
  // calls inside the listener are deferred with setTimeout(…, 0).
  useEffect(() => {
    const setFlag = (on: boolean) => {
      setPendingRecovery(on);
      try {
        if (on) localStorage.setItem(PASSWORD_RECOVERY_KEY, "1");
        else localStorage.removeItem(PASSWORD_RECOVERY_KEY);
      } catch {
        /* storage unavailable — the in-memory flag still gates this session */
      }
    };

    // Enter the password-recovery gate: no access resolution, no workspace load,
    // no dashboard, until the password is actually updated.
    const enterRecoveryGate = () => {
      workspaceStartedRef.current = false;
      setAccess(null);
      setAccessFailed(false);
      setWorkspaceFailed(false);
      setDb(null);
      setOrganizations([]);
      setActiveOrganizationId(null);
      activeOrgIdRef.current = null;
      setFlag(true);
      setIsLoading(false);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        // Sign-out / no session: the recovery gate no longer applies.
        setFlag(false);
        workspaceStartedRef.current = false;
        setWorkspaceFailed(false);
        setDb(null);
        setOrganizations([]);
        setActiveOrganizationId(null);
        activeOrgIdRef.current = null;
        setAccess(null);
        setAccessFailed(false);
        setIsLoading(false);
        return;
      }

      // Supabase emits PASSWORD_RECOVERY when the recovery link is processed.
      // That session must NOT be treated as a normal authenticated session.
      if (event === "PASSWORD_RECOVERY") {
        enterRecoveryGate();
        return;
      }

      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        let flagOn = false;
        try {
          flagOn = localStorage.getItem(PASSWORD_RECOVERY_KEY) === "1";
        } catch { /* ignore */ }
        // A real, explicit sign-in (SIGNED_IN) always clears a stale marker from
        // an earlier session. INITIAL_SESSION with a marker means we are
        // restoring a still-pending recovery session (e.g. after a reload).
        const isRealSignIn = event === "SIGNED_IN";
        if (flagOn && !isRealSignIn) {
          enterRecoveryGate();
          return;
        }
        if (isRealSignIn) setFlag(false);

        // Resolve access on initial restore and on sign-in only; token refreshes
        // must not reload anything while the user is editing. The workspace load
        // is started by a separate effect once access is known to be unlocked.
        setTimeout(() => {
          void refreshAccess();
        }, 0);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setIsLoading(false);
      // With a session, the INITIAL_SESSION event from the listener above drives
      // the workspace load; nothing extra to do here.
    });

    return () => subscription.subscription.unsubscribe();
  }, [refreshAccess]);

  // Load the workspace as soon as the session is restored AND access is resolved
  // to an unlocked state (owner / license / active or expiring DEMO). Users whose
  // access is "none" or blocked only see the activation/blocked screens, which do
  // not need any organization data — so nothing is created or fetched for them.
  // A pending password recovery never loads the workspace.
  useEffect(() => {
    if (!user || !access || pendingRecovery || workspaceStartedRef.current) return;
    const state = gateState(access);
    if (state !== "unlocked") return;
    workspaceStartedRef.current = true;
    void loadWorkspace();
  }, [user, access, pendingRecovery, loadWorkspace]);

  /* ------------------------------------------------ */
  /* Existing synchronous mutations (optimistic + queue) */
  /* ------------------------------------------------ */

  const setOrganization = useCallback(
    (org: Organization) => {
      setDb((prev) => (prev ? { ...prev, organization: org } : prev));
      enqueue(() => updateOrganization(org));
    },
    [enqueue],
  );

  const upsert = useCallback(
    (collection: CollectionKey, entity: Entity) => {
      const orgId = activeOrgIdRef.current;
      if (!orgId) return;
      setDb((prev) => {
        if (!prev) return prev;
        const list = prev[collection] as { id: string }[];
        const exists = list.some((e) => e.id === (entity as { id: string }).id);
        const next = exists
          ? list.map((e) => (e.id === (entity as { id: string }).id ? entity : e))
          : [...list, entity];
        return { ...prev, [collection]: next };
      });
      enqueue(() => upsertRow(collection, entity, orgId));
    },
    [enqueue],
  );

  const remove = useCallback(
    (collection: CollectionKey, id: string) => {
      const orgId = activeOrgIdRef.current;
      if (!orgId) return;
      setDb((prev) =>
        prev
          ? { ...prev, [collection]: (prev[collection] as { id: string }[]).filter((e) => e.id !== id) }
          : prev,
      );
      enqueue(() => deleteRow(collection, id, orgId));
    },
    [enqueue],
  );

  const resetToSeed = useCallback(() => {
    const orgId = activeOrgIdRef.current;
    if (!orgId || !db?.organization.isDemo) {
      toast.error("Reset demo data is only available for the demo organization.");
      return;
    }
    enqueue(async () => {
      const fresh = await resetDemoOrganization(orgId);
      setDb(fresh);
      toast.success("Demo data restored");
    });
  }, [db, enqueue]);

  /* ------------------------------------------------ */
  /* New actions                                       */
  /* ------------------------------------------------ */

  const addOrganization = useCallback(
    async (newDb: Db) => {
      if (!user) throw new Error("Not authenticated");
      await createOrganization(newDb, user.id);
      const orgs = await listOrganizations();
      setOrganizations(orgs);
      activeOrgIdRef.current = newDb.organization.id;
      setActiveOrganizationId(newDb.organization.id);
      localStorage.setItem(ACTIVE_ORG_KEY, newDb.organization.id);
      setDb(newDb);
    },
    [user],
  );

  const setActiveOrganization = useCallback(async (id: string) => {
    if (id === activeOrgIdRef.current) return;
    activeOrgIdRef.current = id;
    setActiveOrganizationId(id);
    localStorage.setItem(ACTIVE_ORG_KEY, id);
    setDb(await loadOrganization(id));
  }, []);

  const removeOrganization = useCallback(async (id: string) => {
    await deleteOrganization(id); // throws for the demo org
    const orgs = await listOrganizations();
    setOrganizations(orgs);

    if (activeOrgIdRef.current === id) {
      const next = orgs[0] ?? null;
      if (next) {
        activeOrgIdRef.current = next.id;
        setActiveOrganizationId(next.id);
        localStorage.setItem(ACTIVE_ORG_KEY, next.id);
        setDb(await loadOrganization(next.id));
      } else {
        activeOrgIdRef.current = null;
        setActiveOrganizationId(null);
        setDb(EMPTY_DB);
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // The auth listener clears session/user/workspace state.
  }, []);

  const api = useMemo<OraApi>(
    () => ({
      user,
      session,
      isLoading,
      signOut,
      pendingRecovery,
      clearPendingRecovery,
      access,
      accessFailed,
      isOwner: access?.is_owner === true,
      refreshAccess,
      applyAccess,
      organizations,
      activeOrganizationId,
      addOrganization,
      setActiveOrganization,
      removeOrganization,
      workspaceFailed,
      retryWorkspace,
      db: db ?? EMPTY_DB,
      setOrganization,
      upsert,
      remove,
      resetToSeed,
    }),
    [
      user,
      session,
      isLoading,
      signOut,
      pendingRecovery,
      clearPendingRecovery,
      access,
      accessFailed,
      refreshAccess,
      applyAccess,
      organizations,
      activeOrganizationId,
      addOrganization,
      setActiveOrganization,
      removeOrganization,
      workspaceFailed,
      retryWorkspace,
      db,
      setOrganization,
      upsert,
      remove,
      resetToSeed,
    ],
  );

  return <OraContext.Provider value={api}>{children}</OraContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOra(): OraApi {
  const ctx = useContext(OraContext);
  if (!ctx) {
    throw new Error("useOra must be used within an OraProvider");
  }
  return ctx;
}
