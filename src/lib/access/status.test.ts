import { describe, expect, it } from "vitest";
import {
  daysLeft,
  formatDateDDMMYYYY,
  gateState,
  isDemoAccess,
  isDemoLimited,
  isExpiring,
  isExpiringAccess,
} from "@/lib/access/status";
import type { MyAccess } from "@/lib/access/types";

const NOW = new Date("2026-09-02T12:00:00Z");

const iso = (d: Date) => d.toISOString();

const base = (over: Partial<MyAccess>): MyAccess => ({
  status: "demo_active",
  is_owner: false,
  ...over,
});

describe("daysLeft", () => {
  it("returns 15 for a freshly started demo", () => {
    const exp = new Date(NOW.getTime() + 15 * 24 * 60 * 60 * 1000);
    expect(daysLeft(iso(exp), NOW)).toBe(15);
  });

  it("returns 8 mid-demo", () => {
    const exp = new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000);
    expect(daysLeft(iso(exp), NOW)).toBe(8);
  });

  it("returns 3 exactly at the 3-day boundary", () => {
    const exp = new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000);
    expect(daysLeft(iso(exp), NOW)).toBe(3);
  });

  it("returns 1 on the last day", () => {
    const exp = new Date(NOW.getTime() + 20 * 60 * 60 * 1000);
    expect(daysLeft(iso(exp), NOW)).toBe(1);
  });

  it("returns 0 after expiry", () => {
    const exp = new Date(NOW.getTime() - 60 * 1000);
    expect(daysLeft(iso(exp), NOW)).toBe(0);
  });
});

describe("formatDateDDMMYYYY", () => {
  it("formats as DD/MM/YYYY", () => {
    expect(formatDateDDMMYYYY("2026-09-10T00:00:00Z")).toBe("10/09/2026");
  });

  it("pads day and month", () => {
    expect(formatDateDDMMYYYY("2026-03-05T00:00:00Z")).toBe("05/03/2026");
  });
});

describe("isExpiring", () => {
  it("is true for 1, 2 and 3 days left", () => {
    expect(isExpiring(3)).toBe(true);
    expect(isExpiring(2)).toBe(true);
    expect(isExpiring(1)).toBe(true);
  });

  it("is false for 4+ days and for 0", () => {
    expect(isExpiring(4)).toBe(false);
    expect(isExpiring(8)).toBe(false);
    expect(isExpiring(0)).toBe(false);
  });
});

describe("gateState", () => {
  it("unlocks the owner and active license holders", () => {
    expect(gateState(base({ status: "owner", is_owner: true }))).toBe("unlocked");
    expect(gateState(base({ status: "perpetual_active" }))).toBe("unlocked");
    expect(gateState(base({ status: "subscription_active" }))).toBe("unlocked");
  });

  it("unlocks while a demo is active or expiring", () => {
    expect(gateState(base({ status: "demo_active", days_left: 8 }))).toBe("unlocked");
    expect(gateState(base({ status: "demo_expiring", days_left: 2 }))).toBe("unlocked");
  });

  it("requires activation when no access exists", () => {
    expect(gateState(base({ status: "none" }))).toBe("activate_demo");
  });

  it("blocks expired access", () => {
    expect(gateState(base({ status: "demo_expired" }))).toBe("blocked");
    expect(gateState(base({ status: "subscription_expired" }))).toBe("blocked");
    expect(gateState(null)).toBe("blocked");
  });
});

describe("demo banner predicates", () => {
  it("isDemoAccess matches active and expiring demo only", () => {
    expect(isDemoAccess(base({ status: "demo_active" }))).toBe(true);
    expect(isDemoAccess(base({ status: "demo_expiring" }))).toBe(true);
    expect(isDemoAccess(base({ status: "perpetual_active" }))).toBe(false);
    expect(isDemoAccess(null)).toBe(false);
  });

  it("isExpiringAccess matches only the expiring variant", () => {
    expect(isExpiringAccess(base({ status: "demo_expiring" }))).toBe(true);
    expect(isExpiringAccess(base({ status: "demo_active" }))).toBe(false);
  });

  it("isDemoLimited is true only for the server-computed limited DEMO flag", () => {
    expect(isDemoLimited(base({ status: "demo_active", demo_limited: true }))).toBe(true);
    expect(isDemoLimited(base({ status: "demo_expiring", demo_limited: true }))).toBe(true);
    expect(isDemoLimited(base({ status: "demo_active", demo_limited: false }))).toBe(false);
    expect(isDemoLimited(base({ status: "perpetual_active" }))).toBe(false);
    expect(isDemoLimited(base({ status: "demo_active" }))).toBe(false);
    expect(isDemoLimited(null)).toBe(false);
  });
});
