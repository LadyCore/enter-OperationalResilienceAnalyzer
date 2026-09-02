import { useState } from "react";
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
            You are using ORA in DEMO version.
            {daysLeft > 0 && (
              <span className="ml-1 font-normal text-muted-foreground">
                {daysLeft === 1 ? "1 day" : `${daysLeft} days`} of access left.
              </span>
            )}
          </p>
          {expiring ? (
            <p className="text-sm text-muted-foreground">
              Your DEMO expires in{" "}
              <span className="font-semibold text-destructive">
                {daysLeft === 3 ? "3 days" : daysLeft > 0 ? `${daysLeft} days` : "less than 3 days"}
              </span>{" "}
              — on <span className="font-semibold">{expiryText}</span>. After that date your
              DEMO access ends.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your DEMO expires on <span className="font-semibold text-foreground">{expiryText}</span>.
            </p>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            To keep using ORA after it expires you can acquire a{" "}
            <span className="font-medium text-foreground">Perpetual license</span> of the
            current version.
          </p>
        </div>
      </div>
      <Button variant={expiring ? "destructive" : "default"} size="sm" className="shrink-0" onClick={() => setLicenseOpen(true)}>
        See licensing options
      </Button>
      <LicenseInfoDialog open={licenseOpen} onOpenChange={setLicenseOpen} />
    </section>
  );
}
