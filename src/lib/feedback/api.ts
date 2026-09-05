import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { FeedbackInput } from "./types";
import { assertFeedbackScreenshotsValid } from "./screenshots";

type FeedbackInsert = Database["public"]["Tables"]["feedback_reports"]["Insert"];

/**
 * Persist a feedback report. Pre-login users (no session) insert an anonymous
 * row (user_id null); signed-in users report with their own id. RLS enforces the
 * same rule server-side.
 *
 * H-010: the submission entry point re-validates that 1–3 screenshots are
 * attached, so a report without a capture can never be persisted even if the UI
 * were bypassed. The captures are stored under `context.screenshots` (the table
 * schema is unchanged).
 */
export async function submitFeedback(input: FeedbackInput): Promise<void> {
  // Validation at the point of sending — not only through the interface.
  assertFeedbackScreenshotsValid(input.screenshots);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const row: FeedbackInsert = {
    user_id: user?.id ?? null,
    kind: input.kind,
    description: input.description,
    is_general: input.isGeneral,
    module: input.isGeneral ? null : (input.module ?? null),
    screen: input.isGeneral ? null : (input.screen ?? null),
    stage: input.isGeneral ? null : (input.stage ?? null),
    context: {
      ...(input.context as object),
      screenshots: input.screenshots,
    },
  };

  const { error } = await supabase.from("feedback_reports").insert(row);
  if (error) throw error;
}
