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

const EMPTY_DB: Db = {
  organization: { id: "", name: "", description: "" },
  areas: [],
  processes: [],
  functions: [],
  tasks: [],
  roles: [],
  people: [],
  competencies: [],
};

interface OraApi {
  // Session
  user: User | null;
  session: Session | null;
  /** True while the session/workspace is being restored or first-loaded. */
  isLoading: boolean;
  signOut: () => Promise<void>;

  // Multi-organization
  organizations: OrgSummary[];
  activeOrganizationId: string | null;
  addOrganization: (db: Db) => Promise<void>;
  setActiveOrganization: (id: string) => Promise<void>;
  removeOrganization: (id: string) => Promise<void>;

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
  const [organizations, setOrganizations] = useState<OrgSummary[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [db, setDb] = useState<Db | null>(null);

  const activeOrgIdRef = useRef<string | null>(null);
  // Chained promise that preserves write order to the backend.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const enqueue = useCallback((task: () => Promise<void>) => {
    queueRef.current = queueRef.current.then(task).catch((err) => {
      console.error("ORA persistence failed:", err);
      toast.error("Could not save changes. Please retry.");
    });
  }, []);

  const loadWorkspace = useCallback(async (userId: string) => {
    try {
      let orgs = await listOrganizations();
      if (orgs.length === 0) {
        await ensureDemoOrganization(userId);
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
      toast.error("Could not load your organizations.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Register the auth listener BEFORE checking for an existing session, so the
  // initial session restore can never be missed. No async callback here; supabase
  // calls inside the listener are deferred with setTimeout(…, 0).
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        // Load the workspace on initial restore and on sign-in only; token
        // refreshes must not reload data while the user is editing.
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
          setTimeout(() => {
            void loadWorkspace(nextSession.user!.id);
          }, 0);
        }
      } else {
        setDb(null);
        setOrganizations([]);
        setActiveOrganizationId(null);
        activeOrgIdRef.current = null;
        setIsLoading(false);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setIsLoading(false);
      // With a session, the INITIAL_SESSION event from the listener above drives
      // the workspace load; nothing extra to do here.
    });

    return () => subscription.subscription.unsubscribe();
  }, [loadWorkspace]);

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
      organizations,
      activeOrganizationId,
      addOrganization,
      setActiveOrganization,
      removeOrganization,
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
      organizations,
      activeOrganizationId,
      addOrganization,
      setActiveOrganization,
      removeOrganization,
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
