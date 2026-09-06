import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AtSign, Camera, CheckCircle2, ImagePlus, Loader2, MailWarning, MessageSquareText, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { submitFeedback } from "@/lib/feedback/api";
import { FEEDBACK_KINDS, type FeedbackContext, type FeedbackKind, type FeedbackTechnicalContext } from "@/lib/feedback/types";
import { feedbackKindLabelKeys } from "./feedbackI18n";
import { localizeFeedbackContext } from "./feedbackContextI18n";
import {
  fileToCompressedDataUrl,
  MAX_FEEDBACK_SCREENSHOTS,
} from "@/lib/feedback/screenshots";
import { cn } from "@/lib/utils";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: FeedbackContext;
  technical: FeedbackTechnicalContext;
  /** Reporter email to prefill (session account); the field is always required. */
  initialEmail?: string;
}

type Status = "idle" | "sending" | "sent";

/**
 * Integrated feedback form. The user picks a kind, writes a description, gives
 * an email to receive the confirmation copy, sees the detected functional
 * context (and technical context stored silently) and submits without leaving
 * the current screen. "Feedback general" avoids forcing a module association.
 * No personal data is captured automatically beyond the email the user types.
 *
 * H-010: at least one and at most three screenshots are required per report and
 * a reporter email is mandatory (also for anonymous reporters). The rules are
 * enforced both here (UI) and again at the submission entry point (api.ts) and
 * in the backend function, so an invalid report can never be persisted.
 */
export function FeedbackDialog({ open, onOpenChange, context, technical, initialEmail = "" }: FeedbackDialogProps) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<FeedbackKind>("not_working");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [isGeneral, setIsGeneral] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [emailState, setEmailState] = useState<"sent" | "failed" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    description.trim().length > 0 && email.trim().length > 0 && status !== "sending";
  const atMaxScreenshots = screenshots.length >= MAX_FEEDBACK_SCREENSHOTS;

  const reset = () => {
    setKind("not_working");
    setDescription("");
    setEmail(initialEmail);
    setIsGeneral(false);
    setScreenshots([]);
    setStatus("idle");
    setError(null);
    setEmailState(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && status === "sending") return;
    onOpenChange(next);
    if (!next) reset();
  };

  const addScreenshots = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    // Reject any attempt to exceed the maximum of three captures.
    if (atMaxScreenshots) {
      toast.error(t("feedback.maxToast", { count: MAX_FEEDBACK_SCREENSHOTS }));
      return;
    }
    const remaining = MAX_FEEDBACK_SCREENSHOTS - screenshots.length;
    const selected = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      toast.error(t("feedback.maxToast", { count: MAX_FEEDBACK_SCREENSHOTS }));
    }
    try {
      const converted = await Promise.all(selected.map((f) => fileToCompressedDataUrl(f)));
      setScreenshots((prev) => [...prev, ...converted].slice(0, MAX_FEEDBACK_SCREENSHOTS));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("feedback.screenshotAddFailed"));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!description.trim()) return;
    // H-010 block: a report without at least one capture must not be sent.
    if (screenshots.length === 0) {
      setError(t("feedback.requireScreenshot"));
      return;
    }
    if (!email.trim()) {
      setError(t("feedback.requireEmail"));
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      const result = await submitFeedback({
        kind,
        description: description.trim(),
        isGeneral,
        module: context.module,
        screen: context.screen,
        stage: context.stage,
        context: technical,
        email,
        screenshots,
      });
      setEmailState(result.emailState);
      setStatus("sent");
    } catch (err) {
      console.error("Feedback submission failed:", err);
      setStatus("idle");
      setError(err instanceof Error ? err.message : t("feedback.sendFailed"));
    }
  };

  const contextLabel = isGeneral
    ? t("feedback.generalContext")
    : localizeFeedbackContext(context, t);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {status === "sent" ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogHeader className="items-center">
              <DialogTitle>{t("feedback.sentTitle")}</DialogTitle>
              <DialogDescription className="text-center">
                {t(screenshots.length === 1 ? "feedback.sentDescOne" : "feedback.sentDescMany", {
                  count: screenshots.length,
                })}
              </DialogDescription>
            </DialogHeader>
            {emailState === "failed" ? (
              <p className="mx-auto flex max-w-sm items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-700">
                <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t("feedback.emailFailed", { email: email.trim() })}</span>
              </p>
            ) : (
              <p className="mx-auto max-w-sm text-xs text-muted-foreground">
                {t("feedback.emailSent", { email: email.trim() })}
              </p>
            )}
            <Button
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              {t("feedback.done")}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-primary" />
                {t("nav.feedback")}
              </DialogTitle>
              <DialogDescription>
                {t("feedback.dialogDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Kind */}
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("feedback.kindQuestion")}
                </legend>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {FEEDBACK_KINDS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setKind(option.value)}
                      className={cn(
                        "flex items-center rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        kind === option.value
                          ? "border-primary/40 bg-primary/5 font-medium"
                          : "border-border bg-background text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                      )}
                    >
                      {t(feedbackKindLabelKeys[option.value])}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Description */}
              <div className="space-y-1.5">
                <label htmlFor="feedback-description" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("feedback.description")}
                </label>
                <Textarea
                  id="feedback-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("feedback.descriptionPlaceholder")}
                  rows={4}
                  autoFocus
                />
                {error && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                    {error}
                  </p>
                )}
              </div>

              {/* Reporter email — H-010 mandatory */}
              <div className="space-y-1.5">
                <label htmlFor="feedback-email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("feedback.yourEmail")}
                </label>
                <div className="relative">
                  <AtSign className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="feedback-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("feedback.emailPlaceholder")}
                    className="pl-8"
                    autoComplete="email"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t("feedback.emailHint")}
                </p>
              </div>

              {/* Screenshots — H-010 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("feedback.screenshotsLabel")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {screenshots.length}/{MAX_FEEDBACK_SCREENSHOTS}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void addScreenshots(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={atMaxScreenshots}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm transition-colors",
                    atMaxScreenshots
                      ? "cursor-not-allowed border-muted bg-muted/30 text-muted-foreground"
                      : "border-muted-foreground/40 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {atMaxScreenshots ? (
                    <>
                      <X className="h-4 w-4" />
                      {t("feedback.maxScreenshots", { count: MAX_FEEDBACK_SCREENSHOTS })}
                    </>
                  ) : (
                    <>
                      <ImagePlus className="h-4 w-4" />
                      {t(screenshots.length === 0 ? "feedback.addShotRequired" : "feedback.addShotOptional")}
                    </>
                  )}
                </button>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Camera className="h-3.5 w-3.5" />
                  {t("feedback.screenshotsHint")}
                </p>
                {screenshots.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {screenshots.map((shot, index) => (
                      <div key={index} className="group relative overflow-hidden rounded-md border">
                        <img src={shot} alt={t("feedback.screenshotAlt", { number: index + 1 })} className="h-20 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeScreenshot(index)}
                          aria-label={t("feedback.removeScreenshot", { number: index + 1 })}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-90 transition-opacity hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Detected context */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("feedback.detectedContext")}
                </p>
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {contextLabel}
                </div>
              </div>

              {/* General toggle */}
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <Checkbox
                  checked={isGeneral}
                  onCheckedChange={(v) => setIsGeneral(v === true)}
                  className="mt-0.5"
                />
                <span className="text-muted-foreground">
                  {t("feedback.generalLabel")}{" "}
                  <span className="text-muted-foreground/70">{t("feedback.generalNote")}</span>
                </span>
              </label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={status === "sending"}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("auth.sending")}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> {t("feedback.send")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
