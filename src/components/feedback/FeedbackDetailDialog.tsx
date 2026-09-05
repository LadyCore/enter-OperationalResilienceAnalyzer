import { useEffect, useState } from "react";
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
import { Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { FEEDBACK_KINDS } from "@/lib/feedback/types";
import { isLegacyDataUrl } from "@/lib/feedback/screenshots";
import {
  FEEDBACK_STATUSES,
  fetchFeedbackScreenshotUrls,
  parseFeedbackContext,
  parseFeedbackReporterEmail,
  parseFeedbackScreenshots,
  type FeedbackStatus,
} from "@/lib/feedback/admin";

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
  const ctx = feedback ? parseFeedbackContext(feedback.context) : {};
  const screenshots = feedback ? parseFeedbackScreenshots(feedback.context) : [];
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingShots, setLoadingShots] = useState(false);
  const [shotError, setShotError] = useState(false);

  // Resolve private-bucket screenshots to temporary signed URLs every time the
  // dialog opens with a report (legacy inline data: entries need no resolution).
  useEffect(() => {
    setSignedUrls({});
    setShotError(false);
    if (!feedback) return;
    const needsSigning = screenshots.some((s) => !isLegacyDataUrl(s));
    if (!needsSigning) return;
    let active = true;
    setLoadingShots(true);
    fetchFeedbackScreenshotUrls(feedback.id)
      .then((map) => {
        if (active) setSignedUrls(map);
      })
      .catch((err) => {
        console.error("Failed to resolve feedback screenshots:", err);
        if (active) setShotError(true);
      })
      .finally(() => {
        if (active) setLoadingShots(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback?.id]);

  if (!feedback) return null;
  const kindLabel = FEEDBACK_KINDS.find((k) => k.value === feedback.kind)?.label ?? feedback.kind;
  const reporterEmail = email ?? parseFeedbackReporterEmail(feedback.context) ?? undefined;

  const resolveShotSrc = (shot: string): string | null => {
    if (isLegacyDataUrl(shot)) return shot;
    return signedUrls[shot] ?? null;
  };

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

          {/* Screenshots — H-010 captures (private bucket; signed URLs for the admin) */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Screenshots ({screenshots.length})
            </p>
            {screenshots.length === 0 ? (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                No screenshots attached to this report.
              </p>
            ) : loadingShots ? (
              <p className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Resolving screenshots…
              </p>
            ) : shotError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                The screenshots could not be resolved. They are stored securely and can be
                reviewed again in a moment.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {screenshots.map((shot, index) => {
                  const src = resolveShotSrc(shot);
                  if (!src) {
                    return (
                      <div
                        key={index}
                        className="flex h-40 items-center justify-center rounded-lg border bg-muted/40 px-3 text-center text-xs text-muted-foreground"
                      >
                        Screenshot {index + 1} is not available right now (it is stored securely and
                        can be reviewed again in a moment).
                      </div>
                    );
                  }
                  return (
                    <a
                      key={index}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-lg border bg-muted/40 transition-opacity hover:opacity-90"
                    >
                      <img
                        src={src}
                        alt={`Screenshot ${index + 1}`}
                        className="max-h-64 w-full object-contain"
                      />
                      <p className="border-t px-3 py-1.5 text-center text-xs text-muted-foreground">
                        Screenshot {index + 1} — open full size
                      </p>
                    </a>
                  );
                })}
              </div>
            )}
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
                <InfoRow label="Email" value={reporterEmail ?? "Not available in the profiles registry"} />
              </>
            ) : (
              <>
                <InfoRow label="Signed in" value="No" />
                <InfoRow label="Email" value={reporterEmail ?? "Not provided"} />
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
