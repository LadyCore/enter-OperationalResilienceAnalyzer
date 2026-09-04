import { describe, expect, it } from "vitest";
import { isEmailVerified } from "@/lib/emailVerification";

describe("isEmailVerified — authoritative gate for protected routes", () => {
  it("returns true only when email_confirmed_at is set", () => {
    expect(isEmailVerified({ email_confirmed_at: "2026-09-04T12:00:00Z" })).toBe(true);
  });

  it("returns false for a user without a confirmation timestamp", () => {
    expect(isEmailVerified({ email_confirmed_at: null })).toBe(false);
    expect(isEmailVerified({ email_confirmed_at: undefined })).toBe(false);
  });

  it("returns false for null/undefined user", () => {
    expect(isEmailVerified(null)).toBe(false);
    expect(isEmailVerified(undefined)).toBe(false);
  });
});
