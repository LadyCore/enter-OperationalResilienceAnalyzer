import { describe, expect, it } from "vitest";
import type { Db } from "@/types";
import { simulateScenario } from "@/lib/simulation";
import { seedDb } from "@/data/seed";

// Seed org: Diana (t_validate, t_quote) is covered by Elena during vacation
// (vc_elena_diana). Franco (t_payroll, t_filings) is covered by Gabriela
// (vc_gabriela_franco covers t_filings).
const db: Db = seedDb;

describe("multi-person scenarios are joint states, never sums", () => {
  it("single vacation with coverage keeps the covered tasks available", () => {
    const result = simulateScenario(db, [
      { personId: "p_diana", kind: "planned", category: "Vacation", days: 15 },
    ]);
    // t_quote is otherwise single-person (Diana) → without coverage it would be
    // uncovered. With the Elena coverage it stays covered.
    expect(result.uncoveredTaskIds).not.toContain("t_quote");
    expect(result.appliedCoverages.some((c) => c.coveredName === "Diana Nunes")).toBe(true);
    expect(result.vacationCoveredTaskIds).toContain("t_quote");
  });

  it("an absent coverer cannot cover another absent person in the same scenario", () => {
    // Elena (the coverer for Diana) is ALSO absent → the coverage must NOT apply.
    const result = simulateScenario(db, [
      { personId: "p_diana", kind: "planned", category: "Vacation", days: 15 },
      { personId: "p_elena", kind: "temporary", days: 5 },
    ]);
    expect(result.appliedCoverages.length).toBe(0);
    expect(result.vacationCoveredTaskIds).toEqual([]);
  });

  it("joint absence of two single-person-task owners uncovers both simultaneously", () => {
    // Diana owns t_quote alone; Franco owns t_filings alone. Removing both at
    // once must flag both as uncovered (joint state).
    const result = simulateScenario(db, [
      { personId: "p_diana", kind: "temporary", days: 7 },
      { personId: "p_franco", kind: "temporary", days: 7 },
    ]);
    // t_quote: Diana only → uncovered. t_filings: Franco only → uncovered.
    expect(result.uncoveredTaskIds).toEqual(
      expect.arrayContaining(["t_quote", "t_filings"]),
    );
    expect(result.uncoveredCompetencyIds.length).toBeGreaterThan(0);
    // Both absent people are in the resolved absence set.
    expect(result.absences.map((a) => a.person.name)).toEqual(
      expect.arrayContaining(["Diana Nunes", "Franco Bianchi"]),
    );
  });

  it("permanent loss coexists with an eligible vacation coverage", () => {
    // Diana on vacation (eligible for coverage), Bruno permanent. Elena still
    // available → Diana's coverage applies; Bruno's is permanent.
    const result = simulateScenario(db, [
      { personId: "p_diana", kind: "planned", category: "Vacation", days: 15 },
      { personId: "p_bruno", kind: "permanent" },
    ]);
    expect(result.appliedCoverages.some((c) => c.coveredName === "Diana Nunes")).toBe(true);
  });
});

describe("vacation coverage is gated on category Vacation", () => {
  it("planned absence with a non-vacation category does NOT use coverages", () => {
    const result = simulateScenario(db, [
      { personId: "p_diana", kind: "planned", category: "Training", days: 15 },
    ]);
    expect(result.appliedCoverages.length).toBe(0);
    expect(result.vacationCoveredTaskIds).toEqual([]);
    // t_quote is Diana-only → uncovered without the vacation-coverage gate.
    expect(result.uncoveredTaskIds).toContain("t_quote");
  });

  it("a plain temporary absence never uses vacation coverages", () => {
    const result = simulateScenario(db, [{ personId: "p_diana", kind: "temporary", days: 7 }]);
    expect(result.appliedCoverages.length).toBe(0);
    expect(result.uncoveredTaskIds).toContain("t_quote");
  });
});
