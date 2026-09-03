/** Kinds of feedback a user can report. */
export type FeedbackKind =
  | "not_working"
  | "error"
  | "slow"
  | "stuck"
  | "suggestion"
  | "other";

export const FEEDBACK_KINDS: { value: FeedbackKind; label: string }[] = [
  { value: "not_working", label: "Something isn't working" },
  { value: "error", label: "I found an error" },
  { value: "slow", label: "The platform is slow" },
  { value: "stuck", label: "I can't move forward" },
  { value: "suggestion", label: "Improvement suggestion" },
  { value: "other", label: "Other" },
];

/** Functional + technical context captured when the report is opened. */
export interface FeedbackContext {
  /** Human-readable module derived from the current route (e.g. "People"). */
  module: string | null;
  /** Route path (e.g. "/people"). */
  screen: string;
  /** Instrumented stage/section when available (e.g. "Step 2 · Column mapping"). */
  stage: string | null;
  /** Detected breadcrumb shown to the user (module → stage). */
  breadcrumb: string | null;
}

/** Technical detail attached to the report. No personal data is stored here. */
export interface FeedbackTechnicalContext {
  /** ISO timestamp at capture time. */
  capturedAt: string;
  /** Active organization id/name when authenticated (functional context). */
  organizationId: string | null;
  organizationName: string | null;
  /** True when the user was signed in. */
  authenticated: boolean;
  /** Path the user was on. */
  screen: string;
  /** Viewport size, useful to reproduce layout issues. */
  viewport: { width: number; height: number } | null;
  /** Basic environment info. */
  userAgent: string | null;
  /** Recent JS errors/rejections captured in this session (message + stack). */
  recentErrors: { at: string; message: string; stack?: string }[];
}

/** What the UI sends to the API. */
export interface FeedbackInput {
  kind: FeedbackKind;
  description: string;
  isGeneral: boolean;
  /** Functional context; omitted/cleared when isGeneral. */
  module?: string | null;
  screen?: string | null;
  stage?: string | null;
  /** Technical context (no personal data). */
  context: FeedbackTechnicalContext;
}
