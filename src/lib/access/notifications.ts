/**
 * Email notification architecture for DEMO lifecycle.
 *
 * The database already schedules the notices: when a DEMO starts, the
 * `demo_notifications_on_insert` trigger writes two `pending` rows into
 * `public.notification_outbox`:
 *   - `demo_expiring_3days` planned for `expires_at - 3 days`
 *   - `demo_expired` planned for `expires_at`
 *
 * A future backend function (cron / scheduled) will read pending rows whose
 * `planned_for <= now()` and send them through the configured mail server,
 * marking each row `sent` (or `failed`) with `sent_at`.
 *
 * Nothing is sent or simulated today: no mail server is configured yet. The
 * in-app DEMO banner and the 3-day warning complement, never replace, this
 * email notice.
 *
 * Integration point (future, do NOT enable yet):
 *
 *   export async function sendDueNotifications() {
 *     const due = await db
 *       .from("notification_outbox")
 *       .select("id, kind, user_id, planned_for")
 *       .eq("status", "pending")
 *       .lte("planned_for", new Date().toISOString());
 *     for (const n of due.data ?? []) {
 *       // email = profiles.email for n.user_id
 *       // subject/body by n.kind, then update status to "sent"
 *     }
 *   }
 */
export {};
