import { describe, expect, it } from "vitest";
import {
  assertFeedbackEmailValid,
  assertFeedbackScreenshotsValid,
  isLegacyDataUrl,
  MAX_FEEDBACK_SCREENSHOTS,
  MIN_FEEDBACK_SCREENSHOTS,
} from "@/lib/feedback/screenshots";

const shot = () => "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

describe("H-010 screenshot requirements", () => {
  it("0 screenshots → submission is rejected", () => {
    expect(() => assertFeedbackScreenshotsValid([])).toThrow(/at least one screenshot/i);
  });

  it("1, 2 and 3 screenshots → submission is allowed", () => {
    expect(() => assertFeedbackScreenshotsValid([shot()])).not.toThrow();
    expect(() => assertFeedbackScreenshotsValid([shot(), shot()])).not.toThrow();
    expect(() =>
      assertFeedbackScreenshotsValid([shot(), shot(), shot()])
    ).not.toThrow();
  });

  it("4 screenshots → submission is rejected", () => {
    expect(() =>
      assertFeedbackScreenshotsValid([shot(), shot(), shot(), shot()])
    ).toThrow(/maximum of 3/i);
  });

  it("exposes the configured limits", () => {
    expect(MIN_FEEDBACK_SCREENSHOTS).toBe(1);
    expect(MAX_FEEDBACK_SCREENSHOTS).toBe(3);
  });

  it("rejects empty or non-string entries", () => {
    expect(() => assertFeedbackScreenshotsValid([""])).toThrow(/could not be read/i);
  });
});

describe("assertFeedbackEmailValid — mandatory reporter email", () => {
  it("accepts a well-formed email", () => {
    expect(() => assertFeedbackEmailValid("user@example.com")).not.toThrow();
    expect(() => assertFeedbackEmailValid("  user@example.com  ")).not.toThrow();
  });

  it("rejects empty or malformed emails", () => {
    expect(() => assertFeedbackEmailValid("")).toThrow(/valid email/i);
    expect(() => assertFeedbackEmailValid("   ")).toThrow(/valid email/i);
    expect(() => assertFeedbackEmailValid("not-an-email")).toThrow(/valid email/i);
    expect(() => assertFeedbackEmailValid("user@")).toThrow(/valid email/i);
    expect(() => assertFeedbackEmailValid("@example.com")).toThrow(/valid email/i);
  });
});

describe("isLegacyDataUrl — distinguish legacy inline captures from storage keys", () => {
  it("flags data URLs as legacy inline captures", () => {
    expect(isLegacyDataUrl("data:image/jpeg;base64,/9j/")).toBe(true);
  });

  it("treats storage keys as non-legacy (new H-010 format)", () => {
    expect(isLegacyDataUrl("feedback/abc/0.jpg")).toBe(false);
    expect(isLegacyDataUrl("")).toBe(false);
  });
});
