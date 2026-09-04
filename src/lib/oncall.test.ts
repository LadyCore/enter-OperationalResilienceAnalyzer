import { describe, expect, it } from "vitest";
import type { Db } from "@/types";
import { buildOnCallMetrics, isH24 } from "@/lib/oncall";
import { seedDb } from "@/data/seed";

describe("isH24 modality detection", () => {
  it("recognizes H24 spellings", () => {
    expect(isH24("H24")).toBe(true);
    expect(isH24("h24")).toBe(true);
    expect(isH24("24x7")).toBe(true);
    expect(isH24("H24 x 7")).toBe(true);
  });

  it("does not treat shift schemes as H24", () => {
    expect(isH24("Shifts")).toBe(false);
    expect(isH24("Nights")).toBe(false);
    expect(isH24("")).toBe(false);
  });
});

describe("buildOnCallMetrics over the seeded org", () => {
  const db: Db = {
    ...seedDb,
    onCallAssignments: seedDb.onCallAssignments,
  };

  it("counts people and assignments and separates H24 from shift/custom", () => {
    const m = buildOnCallMetrics(db);
    // Seed: Carlos (Shifts/Night) + Ana (H24/H24).
    expect(m.peopleCount).toBe(2);
    expect(m.assignments).toBe(2);
    expect(m.h24Count).toBe(1);
    expect(m.customCount).toBe(1);
  });

  it("aggregates per-task coverage and flags single-person on-call", () => {
    const m = buildOnCallMetrics(db);
    const triage = m.taskCoverage.find((t) => t.taskId === "t_triage");
    // Both Carlos and Ana cover triage while on call.
    expect(triage?.people.length).toBe(2);
    // t_patch is covered only by Ana on call.
    expect(m.singlePersonTasks).toContain("Patch production servers");
  });
});

describe("org without on-call data", () => {
  it("returns zeros without errors", () => {
    const empty: Db = { ...seedDb, onCallAssignments: [] };
    const m = buildOnCallMetrics(empty);
    expect(m.assignments).toBe(0);
    expect(m.peopleCount).toBe(0);
    expect(m.taskCount).toBe(0);
    expect(m.singlePersonTasks).toEqual([]);
  });
});
