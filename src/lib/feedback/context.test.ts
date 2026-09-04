import { describe, expect, it } from "vitest";
import {
  FEEDBACK_MODULES,
  getFeedbackContext,
  moduleForRoute,
  ROUTE_MODULES,
} from "@/lib/feedback/context";

describe("moduleForRoute — index route is resolved by the session state", () => {
  it("maps / to Dashboard when authenticated", () => {
    expect(moduleForRoute("/", true)).toBe("Dashboard");
  });

  it("maps / to Sign in when anonymous", () => {
    expect(moduleForRoute("/", false)).toBe("Sign in");
  });

  it("maps other real routes independently of auth", () => {
    expect(moduleForRoute("/people", true)).toBe("People");
    expect(moduleForRoute("/people", false)).toBe("People");
    expect(moduleForRoute("/analysis", true)).toBe("Analysis");
    expect(moduleForRoute("/simulation", true)).toBe("Simulation");
  });

  it("returns null for unknown routes (no arbitrary fallback)", () => {
    expect(moduleForRoute("/not-a-route", true)).toBeNull();
  });
});

describe("getFeedbackContext — captures the real screen where Feedback was opened", () => {
  it("Dashboard (route /) reports Dashboard, never Sign in", () => {
    const ctx = getFeedbackContext("/", true);
    expect(ctx.module).toBe("Dashboard");
    expect(ctx.screen).toBe("/");
    expect(ctx.module).not.toBe("Sign in");
  });

  it("another authenticated screen keeps its own route/module", () => {
    const ctx = getFeedbackContext("/people", true);
    expect(ctx.module).toBe("People");
    expect(ctx.screen).toBe("/people");
    expect(ctx.module).not.toBe("Sign in");
    expect(ctx.screen).not.toBe("/");
  });

  it("anonymous login screen still reports Sign in", () => {
    const ctx = getFeedbackContext("/", false);
    expect(ctx.module).toBe("Sign in");
    expect(ctx.screen).toBe("/");
  });

  it("context is deterministic for the same inputs (stable while the form is open)", () => {
    // Freezing happens by capturing once at open time (FeedbackFab stores the
    // values in state); this asserts the resolution itself is stable so the
    // captured snapshot cannot drift between renders.
    const first = getFeedbackContext("/analysis", true);
    const second = getFeedbackContext("/analysis", true);
    expect(second).toEqual(first);
  });
});

describe("FEEDBACK_MODULES — admin filter options", () => {
  it("includes Dashboard alongside the route modules", () => {
    expect(FEEDBACK_MODULES).toContain("Dashboard");
    expect(FEEDBACK_MODULES).toContain("Sign in");
    expect(FEEDBACK_MODULES).toContain("People");
    // Every real module label is represented.
    for (const label of Object.values(ROUTE_MODULES)) {
      expect(FEEDBACK_MODULES).toContain(label);
    }
  });
});
