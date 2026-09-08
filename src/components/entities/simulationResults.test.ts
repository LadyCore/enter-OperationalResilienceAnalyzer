import { describe, expect, it } from "vitest";
import { criticalUncoveredDays } from "./simulationResults";

const base = {
  taskId: "t1",
  uncoveredTaskIds: ["t1"],
  criticality: "critical" as const,
  exposureDays: 7,
};

describe("criticalUncoveredDays — presentation rule for uncovered critical tasks", () => {
  it("returns the gap duration for a critical task with zero capable people", () => {
    expect(criticalUncoveredDays(base)).toBe(7);
  });

  it("returns null when the task is NOT uncovered (e.g. reduced to one person)", () => {
    expect(criticalUncoveredDays({ ...base, uncoveredTaskIds: [] })).toBeNull();
    expect(criticalUncoveredDays({ ...base, taskId: "other" })).toBeNull();
  });

  it("does NOT flag non-critical uncovered tasks as critical-uncovered", () => {
    expect(criticalUncoveredDays({ ...base, criticality: "important" })).toBeNull();
    expect(criticalUncoveredDays({ ...base, criticality: "standard" })).toBeNull();
  });

  it("returns null when no exposure duration is available (defensive)", () => {
    expect(criticalUncoveredDays({ ...base, exposureDays: undefined })).toBeNull();
  });
});
