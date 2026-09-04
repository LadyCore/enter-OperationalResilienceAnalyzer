import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";
import { FEEDBACK_KINDS } from "@/lib/feedback/types";
import { FEEDBACK_STATUSES, parseFeedbackContext, type FeedbackStatus } from "@/lib/feedback/admin";

type FeedbackRow = Database["public"]["Tables"]["feedback_reports"]["Row"];

interface FeedbackDetailDialogProps {
  feedback: FeedbackRow | null;
  /** Profile email when the reporter is a known signed-in user. */
  email?: string;
  onClose: () => void;
  onStatusChange: (next: FeedbackStatus) => void;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-3">
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words font-medium">{value}</span>
    </div>
  );
}

export function FeedbackDetailDialog({
  feedback,
  email,
  onClose,
  onStatusChange,
}: FeedbackDetailDialogProps) {
  if (!feedback) return null;
  const ctx = parseFeedbackContext(feedback.context);
  const kindLabel = FEEDBACK_KINDS.find((k) => k.value === feedback.kind)?.label ?? feedback.kind;

  return (
    <Dialog open={Boolean(feedback)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Feedback detail
            <Badge variant="secondary" className="font-normal">
              {kindLabel}
            </Badge>
          </DialogTitle>
          <DialogDescription>Full report as sent by the user.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Main info */}
          <div className="space-y-2 rounded-lg border p-4">
            <InfoRow label="ID" value={feedback.id} />
            <InfoRow label="Date & time" value={new Date(feedback.created_at).toLocaleString()} />
            <InfoRow label="Type" value={kindLabel} />
            <InfoRow label="Module" value={feedback.module ?? "—"} />
            <InfoRow label="Screen" value={feedback.screen ?? "—"} />
            <InfoRow label="Stage" value={feedback.stage ?? "—"} />
            <InfoRow label="General feedback" value={feedback.is_general ? "Yes" : "No"} />
            <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-3">
              <span className="w-40 shrink-0 text-muted-foreground">Status</span>
              <Select value={feedback.status} onValueChange={(v) => onStatusChange(v as FeedbackStatus)}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "new" ? "New" : s === "in_progress" ? "In progress" : "Resolved"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Description
            </p>
            <p className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed">
              {feedback.description}
            </p>
          </div>

          {/* Reporter */}
          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Reporter
            </p>
            {feedback.user_id ? (
              <>
                <InfoRow label="Signed in" value="Yes" />
                <InfoRow label="User ID" value={feedback.user_id} />
                <InfoRow label="Email" value={email ?? "Not available in the profiles registry"} />
              </>
            ) : (
              <>
                <InfoRow label="Signed in" value="No" />
                <InfoRow label="User" value="Anónimo" />
              </>
            )}
          </div>

          {/* Technical context — admin-only */}
          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Technical context
            </p>
            {Object.keys(ctx).length === 0 ? (
              <p className="text-sm text-muted-foreground">No technical context was captured.</p>
            ) : (
              <>
                <InfoRow label="Captured at" value={ctx.capturedAt ?? "—"} />
                <InfoRow label="Authenticated" value={ctx.authenticated ? "Yes" : "No"} />
                <InfoRow label="Organization ID" value={ctx.organizationId ?? "—"} />
                <InfoRow label="Organization" value={ctx.organizationName ?? "—"} />
                <InfoRow label="Screen" value={ctx.screen ?? "—"} />
                <InfoRow
                  label="Viewport"
                  value={ctx.viewport ? `${ctx.viewport.width} × ${ctx.viewport.height}` : "—"}
                />
                <InfoRow label="User agent" value={ctx.userAgent ?? "—"} />
              </>
            )}
          </div>

          {/* Recent errors */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Recent errors ({ctx.recentErrors?.length ?? 0})
            </p>
            {!ctx.recentErrors || ctx.recentErrors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent JavaScript errors captured.</p>
            ) : (
              <ul className="space-y-2">
                {ctx.recentErrors.map((e, i) => (
                  <li key={i} className="rounded-lg border p-3">
                    <p className="font-mono text-xs text-foreground">{e.message}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{e.at}</p>
                    {e.stack && (
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted/60 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                        {e.stack}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
