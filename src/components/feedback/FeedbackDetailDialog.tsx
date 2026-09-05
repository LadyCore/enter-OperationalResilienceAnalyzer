import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { FEEDBACK_KINDS } from "@/lib/feedback/types";
import { feedbackKindLabelKeys, feedbackStatusLabelKeys } from "./feedbackI18n";
import { isLegacyDataUrl } from "@/lib/feedback/screenshots";
import {
  FEEDBACK_STATUSES,
  fetchFeedbackScreenshotUrls,
  parseFeedbackContext,
  parseFeedbackReporterEmail,
  parseFeedbackScreenshots,
  resolveFeedback,
  type FeedbackStatus,
  type ResolveFeedbackResult,
} from "@/lib/feedback/admin";

type FeedbackRow = Database["public"]["Tables"]["feedback_reports"]["Row"];

interface FeedbackDetailDialogProps {
  feedback: FeedbackRow | null;
  /** Profile email when the reporter is a known signed-in user. */
  email?: string;
  onClose: () => void;
  onStatusChange: (next: FeedbackStatus) => void;
  /** Called after a successful resolution so the parent can refresh and inform. */
  onResolved?: (result: ResolveFeedbackResult) => void;
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
  onResolved,
}: FeedbackDetailDialogProps) {
  const { t } = useTranslation();
  const ctx = feedback ? parseFeedbackContext(feedback.context) : {};
  const screenshots = feedback ? parseFeedbackScreenshots(feedback.context) : [];
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingShots, setLoadingShots] = useState(false);
  const [shotError, setShotError] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [resolving, setResolving] = useState(false);

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
  const kindEntry = FEEDBACK_KINDS.find((k) => k.value === feedback.kind);
  const kindLabel = kindEntry ? t(feedbackKindLabelKeys[kindEntry.value]) : feedback.kind;
  const reporterEmail = email ?? parseFeedbackReporterEmail(feedback.context) ?? undefined;
  const resolvedAt = typeof ctx.resolvedAt === "string" && ctx.resolvedAt ? ctx.resolvedAt : null;
  const isResolved = feedback.status === "resolved" || Boolean(resolvedAt);

  const resolveShotSrc = (shot: string): string | null => {
    if (isLegacyDataUrl(shot)) return shot;
    return signedUrls[shot] ?? null;
  };

  const handleResolve = async () => {
    if (!feedback) return;
    setResolving(true);
    try {
      const result = await resolveFeedback(feedback.id);
      setConfirmResolve(false);
      onResolved?.(result);
    } catch (err) {
      setConfirmResolve(false);
      toast.error(err instanceof Error ? err.message : t("feedback.resolve.failed"));
    } finally {
      setResolving(false);
    }
  };

  return (
    <Dialog open={Boolean(feedback)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {t("feedback.detailTitle")}
            <Badge variant="secondary" className="font-normal">
              {kindLabel}
            </Badge>
          </DialogTitle>
          <DialogDescription>{t("feedback.detailDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Main info */}
          <div className="space-y-2 rounded-lg border p-4">
            <InfoRow label="ID" value={feedback.id} />
            <InfoRow label={t("feedback.fields.dateTime")} value={new Date(feedback.created_at).toLocaleString()} />
            <InfoRow label={t("feedback.fields.type")} value={kindLabel} />
            <InfoRow label={t("feedback.fields.module")} value={feedback.module ?? "—"} />
            <InfoRow label={t("feedback.fields.screen")} value={feedback.screen ?? "—"} />
            <InfoRow label={t("feedback.fields.stage")} value={feedback.stage ?? "—"} />
            <InfoRow
              label={t("feedback.generalLabel")}
              value={feedback.is_general ? t("feedback.yes") : t("feedback.no")}
            />
            <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-3">
              <span className="w-40 shrink-0 text-muted-foreground">{t("feedback.fields.status")}</span>
              <Select value={feedback.status} onValueChange={(v) => onStatusChange(v as FeedbackStatus)}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(feedbackStatusLabelKeys[s])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Resolution record — kept with the report after resolving */}
          {isResolved && (
            <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("feedback.resolve.title")}
              </p>
              {resolvedAt && (
                <InfoRow
                  label={t("feedback.resolve.resolvedAt")}
                  value={new Date(resolvedAt).toLocaleString()}
                />
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("feedback.description")}
            </p>
            <p className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed">
              {feedback.description}
            </p>
          </div>

          {/* Screenshots — H-010 captures (private bucket; signed URLs for the admin) */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("feedback.screenshotsLabel")} ({screenshots.length})
            </p>
            {isResolved ? (
              <p className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {t("feedback.resolve.screenshotsDeleted")}
              </p>
            ) : screenshots.length === 0 ? (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {t("feedback.noScreenshots")}
              </p>
            ) : loadingShots ? (
              <p className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("feedback.resolvingScreenshots")}
              </p>
            ) : shotError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {t("feedback.screenshotResolveError")}
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
                        {t("feedback.screenshotUnavailable", { number: index + 1 })}
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
                        alt={t("feedback.screenshotAlt", { number: index + 1 })}
                        className="max-h-64 w-full object-contain"
                      />
                      <p className="border-t px-3 py-1.5 text-center text-xs text-muted-foreground">
                        {t("feedback.screenshotOpenFull", { number: index + 1 })}
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
              {t("feedback.section.reporter")}
            </p>
            {feedback.user_id ? (
              <>
                <InfoRow
                  label={t("feedback.fields.signedIn")}
                  value={t("feedback.yes")}
                />
                <InfoRow label={t("feedback.fields.userId")} value={feedback.user_id} />
                <InfoRow
                  label={t("feedback.fields.email")}
                  value={reporterEmail ?? t("feedback.fields.emailUnavailable")}
                />
              </>
            ) : (
              <>
                <InfoRow
                  label={t("feedback.fields.signedIn")}
                  value={t("feedback.no")}
                />
                <InfoRow
                  label={t("feedback.fields.email")}
                  value={reporterEmail ?? t("feedback.fields.emailNotProvided")}
                />
              </>
            )}
          </div>

          {/* Technical context — admin-only */}
          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("feedback.section.technicalContext")}
            </p>
            {Object.keys(ctx).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("feedback.noTechnicalContext")}</p>
            ) : (
              <>
                <InfoRow label={t("feedback.fields.capturedAt")} value={ctx.capturedAt ?? "—"} />
                <InfoRow
                  label={t("feedback.fields.authenticated")}
                  value={ctx.authenticated ? t("feedback.yes") : t("feedback.no")}
                />
                <InfoRow label={t("feedback.fields.organizationId")} value={ctx.organizationId ?? "—"} />
                <InfoRow label={t("feedback.fields.organization")} value={ctx.organizationName ?? "—"} />
                <InfoRow label={t("feedback.fields.screen")} value={ctx.screen ?? "—"} />
                <InfoRow
                  label={t("feedback.fields.viewport")}
                  value={ctx.viewport ? `${ctx.viewport.width} × ${ctx.viewport.height}` : "—"}
                />
                <InfoRow label={t("feedback.fields.userAgent")} value={ctx.userAgent ?? "—"} />
              </>
            )}
          </div>

          {/* Recent errors */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("feedback.section.recentErrors")} ({ctx.recentErrors?.length ?? 0})
            </p>
            {!ctx.recentErrors || ctx.recentErrors.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("feedback.noRecentErrors")}</p>
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

        {!isResolved && (
          <div className="flex justify-end border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmResolve(true)}
              disabled={resolving}
            >
              {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {t("feedback.resolve.action")}
            </Button>
          </div>
        )}
      </DialogContent>

      <AlertDialog open={confirmResolve} onOpenChange={setConfirmResolve}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("feedback.resolve.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("feedback.resolve.confirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resolving}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleResolve()} disabled={resolving}>
              {t("feedback.resolve.action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
