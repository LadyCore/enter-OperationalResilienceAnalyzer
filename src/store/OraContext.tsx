import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { CollectionKey, Db, Entity, Organization } from "@/types";
import { cloneDb, seedDb } from "@/data/seed";

const STORAGE_KEY = "ora-data-v1";

interface OraState {
  db: Db;
}

type Action =
  | { type: "setOrganization"; org: Organization }
  | { type: "upsert"; collection: CollectionKey; entity: Entity }
  | { type: "remove"; collection: CollectionKey; id: string }
  | { type: "reset" };

function loadInitial(): OraState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (
        parsed &&
        parsed.organization &&
        Array.isArray(parsed.tasks) &&
        Array.isArray(parsed.people) &&
        Array.isArray(parsed.competencies)
      ) {
        return { db: parsed };
      }
    }
  } catch {
    /* fall through to seed */
  }
  return { db: cloneDb(seedDb) };
}

function reducer(state: OraState, action: Action): OraState {
  switch (action.type) {
    case "setOrganization":
      return { db: { ...state.db, organization: action.org } };
    case "upsert": {
      const collection = state.db[action.collection] as { id: string }[];
      const exists = collection.some((e) => e.id === (action.entity as { id: string }).id);
      const next = exists
        ? collection.map((e) => (e.id === (action.entity as { id: string }).id ? action.entity : e))
        : [...collection, action.entity];
      return { db: { ...state.db, [action.collection]: next } };
    }
    case "remove": {
      const collection = state.db[action.collection] as { id: string }[];
      return {
        db: { ...state.db, [action.collection]: collection.filter((e) => e.id !== action.id) },
      };
    }
    case "reset":
      return { db: cloneDb(seedDb) };
    default:
      return state;
  }
}

interface OraApi {
  db: Db;
  setOrganization: (org: Organization) => void;
  upsert: (collection: CollectionKey, entity: Entity) => void;
  remove: (collection: CollectionKey, id: string) => void;
  resetToSeed: () => void;
}

const OraContext = createContext<OraApi | null>(null);

export function OraProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.db));
    } catch {
      /* storage may be unavailable; ignore */
    }
  }, [state.db]);

  const api = useMemo<OraApi>(
    () => ({
      db: state.db,
      setOrganization: (org) => dispatch({ type: "setOrganization", org }),
      upsert: (collection, entity) => dispatch({ type: "upsert", collection, entity }),
      remove: (collection, id) => dispatch({ type: "remove", collection, id }),
      resetToSeed: () => dispatch({ type: "reset" }),
    }),
    [state.db]
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
