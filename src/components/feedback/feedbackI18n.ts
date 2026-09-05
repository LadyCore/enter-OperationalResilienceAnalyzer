import type { FeedbackStatus } from "@/lib/feedback/admin";
import type { FeedbackKind } from "@/lib/feedback/types";

/**
 * Static i18n keys for feedback kinds — translate at render time with t().
 * The kind value (code) is what gets stored; only the label is localized.
 */
export const feedbackKindLabelKeys: Record<FeedbackKind, string> = {
  not_working: "feedback.kind.notWorking",
  error: "feedback.kind.error",
  slow: "feedback.kind.slow",
  stuck: "feedback.kind.stuck",
  suggestion: "feedback.kind.suggestion",
  other: "feedback.kind.other",
};

/**
 * Static i18n keys for feedback statuses — translate at render time with t().
 */
export const feedbackStatusLabelKeys: Record<FeedbackStatus, string> = {
  new: "feedback.status.new",
  in_progress: "feedback.status.inProgress",
  resolved: "feedback.status.resolved",
};
