import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { FeedbackTechnicalContext } from "./types";

type FeedbackRow = Database["public"]["Tables"]["feedback_reports"]["Row"];

/** Feedback lifecycle states managed by the owner. */
export const FEEDBACK_STATUSES = ["new", "in_progress", "resolved"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface FeedbackFilters {
  status?: FeedbackStatus | null;
  kind?: string | null;
  module?: string | null;
  /** Free-text search over the description. */
  search?: string | null;
  /** ISO date (YYYY-MM-DD) lower bound for created_at, inclusive. */
  from?: string | null;
  /** ISO date (YYYY-MM-DD) upper bound for created_at, inclusive. */
  to?: string | null;
}

export interface FeedbackPage {
  rows: FeedbackRow[];
  total: number;
  /** user_id → profile email (owner can read profiles via existing RLS). */
  emails: Record<string, string>;
}

/**
 * Owner-only list of feedback reports, newest first, with server-side filters
 * and pagination. The existing SELECT policy (`feedback_select_own_or_owner`)
 * already scopes rows: non-owners only ever see their own reports.
 */
export async function listFeedback(
  filters: FeedbackFilters,
  page: number,
  pageSize: number,
): Promise<FeedbackPage> {
  let query = supabase
    .from("feedback_reports")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.module) query = query.eq("module", filters.module);
  if (filters.search) query = query.ilike("description", `%${filters.search}%`);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59`);

  const { data, count, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as FeedbackRow[];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((id): id is string => Boolean(id))));

  const emails: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    if (profileError) throw profileError;
    for (const p of profiles ?? []) {
      if (p.email) emails[p.id] = p.email;
    }
  }

  return { rows, total: count ?? 0, emails };
}

/**
 * Owner-only status update. RLS `feedback_update_owner` restricts the write to
 * is_owner(); a non-owner update is rejected server-side.
 */
export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  const { error } = await supabase.from("feedback_reports").update({ status }).eq("id", id);
  if (error) throw error;
}

/** Parse the stored JSON context into a typed shape for the detail view. */
export function parseFeedbackContext(context: FeedbackRow["context"]): Partial<FeedbackTechnicalContext> {
  if (!context || typeof context !== "object" || Array.isArray(context)) return {};
  return context as Partial<FeedbackTechnicalContext>;
}
