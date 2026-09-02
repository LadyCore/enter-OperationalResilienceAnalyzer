import type { MyAccess } from "./types";

/**
 * Calendar days remaining until an expiry date. 15 days of DEMO = ceil of the
 * remaining interval, so the banner shows "15" on day one and "1" on the last
 * day. Never negative.
 */
export function daysLeft(expiresAt: string | Date, now: Date = new Date()): number {
  const exp = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const diffMs = exp.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/** Formats an ISO date (or Date) as DD/MM/YYYY — e.g. 10/09/2026. */
export function formatDateDDMMYYYY(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** A DEMO is "about to expire" when 3 or fewer calendar days remain. */
export function isExpiring(days: number): boolean {
  return days > 0 && days <= 3;
}

export type GateState = "unlocked" | "activate_demo" | "blocked";

/** What the access gate should do for a given resolved access. */
export function gateState(access: MyAccess | null): GateState {
  if (!access) return "blocked";
  switch (access.status) {
    case "owner":
    case "perpetual_active":
    case "subscription_active":
    case "demo_active":
    case "demo_expiring":
      return "unlocked";
    case "none":
      return "activate_demo";
    default:
      return "blocked";
  }
}

/** True while a DEMO banner must be shown on the home screen. */
export function isDemoAccess(access: MyAccess | null): access is MyAccess & { status: "demo_active" | "demo_expiring" } {
  return access?.status === "demo_active" || access?.status === "demo_expiring";
}

/** True for the DEMO-expiring variant (mandatory 3-day warning). */
export function isExpiringAccess(access: MyAccess | null): boolean {
  return access?.status === "demo_expiring";
}
