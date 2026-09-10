import type { MyAccess } from "@/lib/access/types";
import { isDemoLimited } from "@/lib/access/status";

/**
 * DEMO trial for the "Planned" absence simulation: 2 hours from the user's
 * FIRST access to Planned. Full-license (and internal) accounts are never
 * limited. The trial start is persisted per user (survives reload, logout and
 * re-login in the same browser) and the execution gate is validated here so a
 * DEMO cannot run Planned simply by manipulating the interface.
 */
export const PLANNED_TRIAL_MS = 2 * 60 * 60 * 1000;

export type PlannedTrialStatus = "full-license" | "not-started" | "active" | "expired";

export interface PlannedTrialState {
  status: PlannedTrialStatus;
  startedAt: number | null;
  remainingMs: number;
}

const storageKey = (userId: string) => `ora-planned-trial:${userId}`;

function readStart(userId: string): number | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(storageKey(userId));
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Current trial state. `now` is injectable so the caller can drive the countdown
 * (e.g. a periodic re-render) and tests can pin time.
 */
export function getPlannedTrialState(
  access: MyAccess | null,
  userId: string | undefined,
  now = Date.now(),
): PlannedTrialState {
  if (!isDemoLimited(access)) return { status: "full-license", startedAt: null, remainingMs: 0 };
  if (!userId) return { status: "not-started", startedAt: null, remainingMs: 0 };
  const startedAt = readStart(userId);
  if (startedAt === null) return { status: "not-started", startedAt: null, remainingMs: 0 };
  const remainingMs = PLANNED_TRIAL_MS - (now - startedAt);
  if (remainingMs <= 0) return { status: "expired", startedAt, remainingMs: 0 };
  return { status: "active", startedAt, remainingMs };
}

/**
 * Record the first access to Planned. No-op once the trial has started, so the
 * 2-hour window never restarts (re-entering Planned, reloading or re-logging in
 * keep the original start time).
 */
export function startPlannedTrial(userId: string | undefined): void {
  if (!userId || typeof localStorage === "undefined") return;
  const key = storageKey(userId);
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, String(Date.now()));
}

/**
 * Execution gate for running a Planned scenario: allowed for full-license
 * accounts and for DEMOs whose 2-hour trial is still running. Anything else
 * (never started, or trial expired) is rejected.
 */
export function validatePlannedTrialExecution(
  access: MyAccess | null,
  userId: string | undefined,
  now = Date.now(),
): boolean {
  const state = getPlannedTrialState(access, userId, now);
  return state.status === "full-license" || state.status === "active";
}
