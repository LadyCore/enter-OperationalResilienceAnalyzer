import { useState } from "react";
import { CheckCircle2, Loader2, MessageSquareText, Send } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { submitFeedback } from "@/lib/feedback/api";
import { FEEDBACK_KINDS, type FeedbackContext, type FeedbackKind, type FeedbackTechnicalContext } from "@/lib/feedback/types";
import { cn } from "@/lib/utils";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: FeedbackContext;
  technical: FeedbackTechnicalContext;
}

type Status = "idle" | "sending" | "sent";

/**
 * Integrated feedback form. The user picks a kind, writes a description, sees
 * the detected functional context (and technical context stored silently) and
 * submits without leaving the current screen. "Feedback general" avoids forcing
 * a module association. No personal data is captured automatically.
 */
export function FeedbackDialog({ open, onOpenChange, context, technical }: FeedbackDialogProps) {
  const [kind, setKind] = useState<FeedbackKind>("not_working");
  const [description, setDescription] = useState("");
  const [isGeneral, setIsGeneral] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = description.trim().length > 0 && status !== "sending";

  const reset = () => {
    setKind("not_working");
    setDescription("");
    setIsGeneral(false);
    setStatus("idle");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && status === "sending") return;
    onOpenChange(next);
    if (!next) reset();
  };

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setStatus("sending");
    setError(null);
    try {
      await submitFeedback({
        kind,
        description: description.trim(),
        isGeneral,
        module: context.module,
        screen: context.screen,
        stage: context.stage,
        context: technical,
      });
      setStatus("sent");
    } catch (err) {
      console.error("Feedback submission failed:", err);
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Could not send your feedback.");
    }
  };

  const contextLabel = isGeneral
    ? "General feedback (no module associated)"
    : context.breadcrumb ?? context.screen;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {status === "sent" ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogHeader className="items-center">
              <DialogTitle>Thank you for your feedback</DialogTitle>
              <DialogDescription className="text-center">
                Your report was received and will help us improve ORA. You can continue
                working where you left off.
              </DialogDescription>
            </DialogHeader>
            <Button
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-primary" />
                Feedback
              </DialogTitle>
              <DialogDescription>
                Report a problem, an error, slowness, a navigation issue or a suggestion
                about ORA. This is not a question about your analysis results.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Kind */}
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  What do you want to report?
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
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Description */}
              <div className="space-y-1.5">
                <label htmlFor="feedback-description" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Description
                </label>
                <Textarea
                  id="feedback-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us what happened. If you add contact details here, they become part of the content you choose to send."
                  rows={4}
                  autoFocus
                />
                {error && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                    {error}
                  </p>
                )}
              </div>

              {/* Detected context */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Detected context
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
                  General feedback <span className="text-muted-foreground/70">(not related to this screen)</span>
                </span>
              </label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={status === "sending"}>
                Cancel
              </Button>
              <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Send feedback
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
