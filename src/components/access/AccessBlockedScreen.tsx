import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarX2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOra } from "@/store/OraContext";
import { formatDateDDMMYYYY } from "@/lib/access/status";
import { LicenseInfoDialog } from "./LicenseInfoDialog";
import { DemoActivationScreen } from "./DemoActivationScreen";

/**
 * Full access block shown once the DEMO has expired (or a subscription has
 * lapsed in the future). The user's account and data remain intact; access is
 * restored when a license is granted, or a new DEMO can be requested when the
 * 12-month DNI/CUIT reuse rule allows it (validated by the backend).
 */
export function AccessBlockedScreen() {
  const { t } = useTranslation();
  const { access, signOut } = useOra();
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [requestingDemo, setRequestingDemo] = useState(false);
  const expiredAt = access?.expires_at;
  const isSubscription = access?.status === "subscription_expired";

  if (requestingDemo) return <DemoActivationScreen />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">ORA</h1>
          <p className="text-sm text-muted-foreground">{t("brand.subtitle")}</p>
        </div>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <CalendarX2 className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-lg font-semibold">
            {isSubscription ? t("accessBlocked.subscriptionEnded") : t("accessBlocked.demoEnded")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSubscription
              ? t("accessBlocked.subscriptionAccessEnded")
              : expiredAt
                ? t("accessBlocked.demoEndedWithDate", { date: formatDateDDMMYYYY(expiredAt) })
                : t("accessBlocked.demoExpired")}{" "}
            {t("accessBlocked.keepWorking")}
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <Button onClick={() => setLicenseOpen(true)}>{t("accessBlocked.seeLicensingOptions")}</Button>
            {!isSubscription && (
              <Button variant="outline" onClick={() => setRequestingDemo(true)}>
                {t("accessBlocked.requestNewDemo")}
              </Button>
            )}
            <Button variant="ghost" onClick={() => void signOut()}>
              {t("auth.signOut")}
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("accessBlocked.safetyNote")}
        </p>
      </div>

      <LicenseInfoDialog open={licenseOpen} onOpenChange={setLicenseOpen} />
    </div>
  );
}
