import { describe, expect, it, vi } from "vitest";

// The pure helpers under test live in admin.ts, which also imports the supabase
// client (browser-only, uses localStorage). Stub the client so the helpers can
// be tested in the node environment without executing any real HTTP code.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  buildSearchPattern,
  dayRangeFrom,
  escapeLikeLiteral,
  resolvePageAfterRefresh,
} from "@/lib/feedback/admin";

describe("escapeLikeLiteral — user input is matched literally", () => {
  it("escapes %", () => {
    expect(escapeLikeLiteral("%")).toBe("\\%");
    expect(escapeLikeLiteral("error")).toBe("error");
  });

  it("escapes _", () => {
    expect(escapeLikeLiteral("_")).toBe("\\_");
    expect(escapeLikeLiteral("error_1")).toBe("error\\_1");
  });

  it("escapes the escape character itself", () => {
    expect(escapeLikeLiteral("\\")).toBe("\\\\");
  });

  it("buildSearchPattern wraps and escapes the term", () => {
    expect(buildSearchPattern("100%_")).toBe("%100\\%\\_%");
    expect(buildSearchPattern("error")).toBe("%error%");
  });
});

describe("dayRangeFrom — calendar-day boundaries", () => {
  it("returns gte = start of day and lt = start of next day", () => {
    const range = dayRangeFrom("2026-09-04")!;
    expect(range).not.toBeNull();
    const gte = new Date(range.gte);
    const lt = new Date(range.lt);
    // Same calendar day, 24h apart, upper bound exclusive.
    expect(lt.getTime() - gte.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(gte.toISOString().startsWith("2026-09-04")).toBe(true);
  });

  it("handles month boundaries", () => {
    const range = dayRangeFrom("2026-09-30")!;
    const lt = new Date(range.lt);
    expect(lt.toISOString().startsWith("2026-10-01")).toBe(true);
  });

  it("returns null for empty or invalid input", () => {
    expect(dayRangeFrom("")).toBeNull();
    expect(dayRangeFrom("not-a-date")).toBeNull();
  });
});

describe("resolvePageAfterRefresh — list refresh after a status change", () => {
  const PAGE_SIZE = 20;

  it("keeps the current page while it still has rows", () => {
    expect(resolvePageAfterRefresh(2, 5, 45, PAGE_SIZE)).toBe(2);
  });

  it("steps back one page when the current page became empty but earlier rows exist", () => {
    // Page 3 (rows 60..79) was the last page with 5 rows; removing them all
    // leaves 60 rows → valid pages 0..2, so we step back to page 2.
    expect(resolvePageAfterRefresh(3, 0, 60, PAGE_SIZE)).toBe(2);
  });

  it("stays on page 0 when the list is empty", () => {
    expect(resolvePageAfterRefresh(0, 0, 0, PAGE_SIZE)).toBe(0);
  });

  it("returns to page 0 when no rows remain anywhere", () => {
    expect(resolvePageAfterRefresh(3, 0, 0, PAGE_SIZE)).toBe(0);
  });
});
