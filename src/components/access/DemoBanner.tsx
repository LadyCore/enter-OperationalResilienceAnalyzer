import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOra } from "@/store/OraContext";
import { formatDateDDMMYYYY, isDemoAccess } from "@/lib/access/status";
import { LicenseInfoDialog } from "./LicenseInfoDialog";

/**
 * Per-access DEMO notice rendered on the home screen while a DEMO is active.
 * Auto-computes the remaining days from the real expiry date and shows the
 * exact expiry date plus the commercially available continuation (perpetual
 * license). A mandatory, distinct warning appears from 3 days before expiry.
 */
export function DemoBanner() {
  const { t } = useTranslation();
  const { access } = useOra();
  const [licenseOpen, setLicenseOpen] = useState(false);

  if (!isDemoAccess(access)) return null;

  const expiring = access.status === "demo_expiring";
  const expiresAt = access.expires_at;
  const daysLeft = access.days_left ?? 0;
  const expiryText = expiresAt ? formatDateDDMMYYYY(expiresAt) : "—";

  return (
    <section
      className={
        expiring
          ? "flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
          : "flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
      }
      role="status"
    >
      <div className="flex items-start gap-3">
        <div
          className={
            expiring
              ? "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive"
              : "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
          }
        >
          {expiring ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            {t("demo.banner.titleLine")}
            {daysLeft > 0 && (
              <span className="ml-1 font-normal text-muted-foreground">
                {daysLeft === 1
                  ? t("demo.banner.dayLeft")
                  : t("demo.banner.daysLeft", { count: daysLeft })}
              </span>
            )}
          </p>
          {expiring ? (
            <p className="text-sm text-muted-foreground">
              {t("demo.banner.expiring", {
                when:
                  daysLeft === 3
                    ? t("demo.banner.in3Days")
                    : daysLeft > 0
                      ? t("demo.banner.inCountDays", { count: daysLeft })
                      : t("demo.banner.inLessThan3Days"),
                date: expiryText,
              })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("demo.banner.expiresOn", { date: expiryText })}
            </p>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            {t("demo.banner.perpetualHint")}
          </p>
        </div>
      </div>
      <Button variant={expiring ? "destructive" : "default"} size="sm" className="shrink-0" onClick={() => setLicenseOpen(true)}>
        {t("accessBlocked.seeLicensingOptions")}
      </Button>
      <LicenseInfoDialog open={licenseOpen} onOpenChange={setLicenseOpen} />
    </section>
  );
}
