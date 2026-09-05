import { supabase } from "@/integrations/supabase/client";
import type { FeedbackInput, FeedbackSubmitResult } from "./types";
import { assertFeedbackEmailValid, assertFeedbackScreenshotsValid } from "./screenshots";

/**
 * Persist a feedback report through the `submit-feedback` backend function.
 *
 * H-010 flow (single server-side operation):
 *  - validation (kind, description, mandatory email, 1–3 screenshots) happens
 *    again in the function;
 *  - screenshots are decoded and stored in the PRIVATE `feedback-screenshots`
 *    bucket; the report row only keeps their storage keys (no base64 in the DB);
 *  - the report id is generated here, so retries (same id) never duplicate a
 *    report — the function treats an existing id as a no-op;
 *  - after a successful insert the function sends the best-effort confirmation
 *    email to `input.email`. Email failures never fail the submission.
 *
 * The client keeps re-validating the 1–3 screenshot rule and the mandatory
 * email before calling, so a malformed payload is rejected even before the
 * network request.
 */
export async function submitFeedback(input: FeedbackInput): Promise<FeedbackSubmitResult> {
  // Validation at the point of sending — not only through the interface.
  assertFeedbackScreenshotsValid(input.screenshots);
  assertFeedbackEmailValid(input.email);

  const reportId = crypto.randomUUID();

  const { data, error } = await supabase.functions.invoke("submit-feedback", {
    body: {
      reportId,
      kind: input.kind,
      description: input.description.trim(),
      isGeneral: input.isGeneral,
      module: input.isGeneral ? null : (input.module ?? null),
      screen: input.isGeneral ? null : (input.screen ?? null),
      stage: input.isGeneral ? null : (input.stage ?? null),
      context: input.context,
      email: input.email.trim(),
      screenshots: input.screenshots,
    },
  });

  if (error) {
    // The function replies with { ok:false, error } on validation/server errors;
    // surface that message instead of a generic one.
    let message = "Could not send your feedback.";
    try {
      const ctx = error.context as { json?: () => Promise<{ error?: string }> } | undefined;
      const body = await ctx?.json?.();
      if (body?.error) message = body.error;
    } catch {
      // fall back to the generic message
    }
    throw new Error(message);
  }

  const result = data as Partial<FeedbackSubmitResult> | null;
  return {
    id: result?.id ?? reportId,
    duplicate: result?.duplicate === true,
    emailState: result?.emailState === "sent" ? "sent" : "failed",
  };
}
