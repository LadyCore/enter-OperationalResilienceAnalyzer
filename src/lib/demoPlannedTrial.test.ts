import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MyAccess } from "@/lib/access/types";
import {
  getPlannedTrialState,
  PLANNED_TRIAL_MS,
  startPlannedTrial,
  validatePlannedTrialExecution,
} from "./demoPlannedTrial";

/** Minimal in-memory localStorage for the node test environment. */
const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
});
afterEach(() => {
  delete (globalThis as Record<string, unknown>).localStorage;
});

const demoAccess: MyAccess = { status: "demo_active", is_owner: false, demo_limited: true };
const licenseAccess: MyAccess = { status: "perpetual_active", is_owner: false };

describe("getPlannedTrialState — 2 hours from the first access to Planned", () => {
  it("full-license accounts are never limited", () => {
    const s = getPlannedTrialState(licenseAccess, "u1", Date.now());
    expect(s.status).toBe("full-license");
    expect(s.remainingMs).toBe(0);
  });

  it("a DEMO before the first access is not-started (no timer yet)", () => {
    const s = getPlannedTrialState(demoAccess, "u1", Date.now());
    expect(s.status).toBe("not-started");
    expect(s.startedAt).toBeNull();
  });

  it("after the first access the trial is active with ~2h remaining", () => {
    const start = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    memory.set("ora-planned-trial:u1", String(start));
    const s = getPlannedTrialState(demoAccess, "u1", Date.now());
    expect(s.status).toBe("active");
    expect(s.startedAt).toBe(start);
    expect(s.remainingMs).toBe(PLANNED_TRIAL_MS - 10 * 60 * 1000);
  });

  it("is expired once 2 hours have passed", () => {
    const start = Date.now() - (2 * 60 * 60 * 1000 + 1);
    memory.set("ora-planned-trial:u1", String(start));
    const s = getPlannedTrialState(demoAccess, "u1", Date.now());
    expect(s.status).toBe("expired");
    expect(s.remainingMs).toBe(0);
  });
});

describe("startPlannedTrial — the window is recorded once and never restarts", () => {
  it("stores the start time on first access", () => {
    startPlannedTrial("u1");
    expect(memory.get("ora-planned-trial:u1")).toBeTruthy();
  });

  it("is a no-op once already started (re-entering Planned does not restart it)", () => {
    startPlannedTrial("u1");
    const first = memory.get("ora-planned-trial:u1");
    startPlannedTrial("u1");
    startPlannedTrial("u1");
    expect(memory.get("ora-planned-trial:u1")).toBe(first);
  });

  it("ignores a missing user id", () => {
    startPlannedTrial(undefined);
    expect(memory.size).toBe(0);
  });
});

describe("validatePlannedTrialExecution — the run gate", () => {
  it("allows full-license execution always", () => {
    expect(validatePlannedTrialExecution(licenseAccess, "u1")).toBe(true);
  });

  it("rejects a DEMO that never started the trial", () => {
    expect(validatePlannedTrialExecution(demoAccess, "u1")).toBe(false);
  });

  it("allows a DEMO while the trial is active", () => {
    memory.set("ora-planned-trial:u1", String(Date.now()));
    expect(validatePlannedTrialExecution(demoAccess, "u1")).toBe(true);
  });

  it("rejects a DEMO after the 2 hours expired (even via another access path)", () => {
    memory.set("ora-planned-trial:u1", String(Date.now() - (PLANNED_TRIAL_MS + 1)));
    expect(validatePlannedTrialExecution(demoAccess, "u1")).toBe(false);
  });
});
