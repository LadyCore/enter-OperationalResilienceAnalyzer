import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
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
 * Escape LIKE/ILIKE wildcards so free-text input is matched literally:
 * `%`, `_` and the escape character itself are prefixed with a backslash.
 */
export function escapeLikeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Wrap a free-text term for case-insensitive ILIKE containment. */
export function buildSearchPattern(term: string): string {
  return `%${escapeLikeLiteral(term)}%`;
}

export interface DayRange {
  /** Inclusive lower boundary (start of the day, local). */
  gte: string;
  /** Exclusive upper boundary (start of the next day, local). */
  lt: string;
}

/**
 * Calendar-day boundaries for an ISO date (YYYY-MM-DD) interpreted in the
 * client's local timezone: `gte` = start of the selected day, `lt` = start of
 * the following day. Using an exclusive upper bound avoids the 23:59:59
 * ambiguity and never shifts the day limits across timezones.
 */
export function dayRangeFrom(date: string): DayRange | null {
  if (!date) return null;
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start.toISOString(), lt: end.toISOString() };
}

/**
 * Page to show after a refresh: keep the current page while it still has rows;
 * otherwise step back to the last valid page (so removing the last row of a
 * page does not leave an empty page while earlier rows exist).
 */
export function resolvePageAfterRefresh(
  page: number,
  rowsOnPage: number,
  total: number,
  pageSize: number,
): number {
  if (total === 0) return 0;
  if (rowsOnPage > 0) return page;
  const lastValid = Math.max(0, Math.ceil(total / pageSize) - 1);
  return Math.min(page, lastValid);
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
  if (filters.search) query = query.ilike("description", buildSearchPattern(filters.search));
  const fromRange = dayRangeFrom(filters.from ?? "");
  const toRange = dayRangeFrom(filters.to ?? "");
  if (fromRange) query = query.gte("created_at", fromRange.gte);
  if (toRange) query = query.lt("created_at", toRange.lt);

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

/**
 * Extract the screenshots attached to a report from its stored context.
 *
 * H-010: legacy reports keep compressed JPEG data URLs under
 * `context.screenshots`; newer reports store private-bucket storage keys
 * (`feedback/{reportId}/{i}.jpg`) instead. Both are plain strings, so the list
 * contract is unchanged — only the rendering differs (see
 * `fetchFeedbackScreenshotUrls` for resolving storage keys).
 */
export function parseFeedbackScreenshots(context: FeedbackRow["context"]): string[] {
  if (!context || typeof context !== "object" || Array.isArray(context)) return [];
  const shots = (context as Record<string, unknown>).screenshots;
  if (!Array.isArray(shots)) return [];
  return shots.filter((s): s is string => typeof s === "string" && s.length > 0);
}

/** Reporter email stored at submit time (mandatory since H-010). */
export function parseFeedbackReporterEmail(context: FeedbackRow["context"]): string | null {
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  const email = (context as Record<string, unknown>).reporterEmail;
  return typeof email === "string" && email.length > 0 ? email : null;
}

/**
 * Resolve the private-bucket screenshots of one report into temporary signed
 * URLs for the admin viewer. The backend function re-checks the caller against
 * RLS (`feedback_select_own_or_owner`) before signing anything, so a non-owner
 * or a non-author gets an empty/denied result. Returns a map from storage key
 * to signed URL; legacy inline `data:` entries are not signed.
 */
export async function fetchFeedbackScreenshotUrls(
  reportId: string,
): Promise<Record<string, string>> {
  const { data, error } = await supabase.functions.invoke("feedback-screenshot-urls", {
    body: { reportId },
  });
  if (error) throw error;
  const payload = data as { urls?: { path: string; url: string }[] } | null;
  const map: Record<string, string> = {};
  for (const item of payload?.urls ?? []) {
    if (!item.path || !item.url) continue;
    // Older supabase-js versions return a relative path; make it absolute so it
    // works as an <img src> regardless.
    map[item.path] = item.url.startsWith("http")
      ? item.url
      : `${SUPABASE_URL}${item.url.startsWith("/") ? "" : "/"}${item.url}`;
  }
  return map;
}

export interface ScreenshotMigrationResult {
  scanned: number;
  migrated: number;
  skipped: number;
}

/**
 * Move legacy base64 screenshots of historical reports into the private
 * bucket. Owner-only (the backend function enforces is_owner()). The original
 * data URLs are preserved under context.screenshotsLegacy until verified.
 */
export async function migrateFeedbackScreenshots(): Promise<ScreenshotMigrationResult> {
  const { data, error } = await supabase.functions.invoke("feedback-migrate-screenshots", {
    body: {},
  });
  if (error) throw error;
  const payload = (data ?? {}) as Partial<ScreenshotMigrationResult>;
  return {
    scanned: payload.scanned ?? 0,
    migrated: payload.migrated ?? 0,
    skipped: payload.skipped ?? 0,
  };
}
