import { useState } from "react";
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
          <p className="text-sm text-muted-foreground">Organizational Resilience Analyzer</p>
        </div>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <CalendarX2 className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-lg font-semibold">
            {isSubscription ? "Your subscription has ended" : "Your DEMO has ended"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSubscription ? (
              "The subscription access period is over."
            ) : (
              <>
                The {expiredAt ? `DEMO that ended on ${formatDateDDMMYYYY(expiredAt)}` : "DEMO"} has
                expired. Your account and its data are preserved.
              </>
            )}{" "}
            To keep working in ORA, acquire a perpetual license of the current version.
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <Button onClick={() => setLicenseOpen(true)}>See licensing options</Button>
            {!isSubscription && (
              <Button variant="outline" onClick={() => setRequestingDemo(true)}>
                Request a new DEMO
              </Button>
            )}
            <Button variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your organizations and analysis remain safe — access is restored as soon as a license
          is associated with your account.
        </p>
      </div>

      <LicenseInfoDialog open={licenseOpen} onOpenChange={setLicenseOpen} />
    </div>
  );
}
