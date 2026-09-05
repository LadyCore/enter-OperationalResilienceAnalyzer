import { describe, expect, it } from "vitest";
import {
  assertFeedbackScreenshotsValid,
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
