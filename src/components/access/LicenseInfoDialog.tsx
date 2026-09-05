import { useTranslation } from "react-i18next";
import { BadgeCheck, Clock3, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OWNER_EMAIL } from "@/lib/access/types";

interface LicenseInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Explains the commercially available modality (perpetual license). The
 * subscription is architected but not available yet, so it is shown as future.
 * No payment flow is implemented.
 */
export function LicenseInfoDialog({ open, onOpenChange }: LicenseInfoDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("license.continueTitle")}</DialogTitle>
          <DialogDescription>{t("license.chooseModality")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">{t("license.perpetual")}</p>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {t("license.available")}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("license.perpetualDescription")}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4 opacity-70">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">{t("license.subscription")}</p>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("license.comingSoon")}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("license.subscriptionDescription")}
            </p>
          </div>
        </div>

        <div className="rounded-md bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
          {t("license.contactLine")}{" "}
          <a href={`mailto:${OWNER_EMAIL}`} className="font-medium text-foreground underline underline-offset-2">
            {OWNER_EMAIL}
          </a>{" "}
          {t("license.requestPerpetual")}
        </div>

        <Button variant="outline" asChild>
          <a href={`mailto:${OWNER_EMAIL}`}>
            <Mail className="h-4 w-4" /> {t("license.contactTeam")}
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
