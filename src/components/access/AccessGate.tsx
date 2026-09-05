import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOra } from "@/store/OraContext";
import { gateState } from "@/lib/access/status";
import { DemoActivationScreen } from "./DemoActivationScreen";
import { AccessBlockedScreen } from "./AccessBlockedScreen";

/**
 * Product-level access gate. Resolves the signed-in user's access (owner,
 * license, DEMO, none) and only renders the ORA shell when access is unlocked:
 *  - owner / active license / active or expiring DEMO  → app
 *  - no access                                        → mandatory DEMO activation
 *  - expired DEMO / lapsed subscription               → blocked screen
 * The backend (get_my_access) is authoritative; this layer enforces it in the UI.
 */
export function AccessGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { access, accessFailed, refreshAccess } = useOra();

  if (accessFailed && !access) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-center">
          <h2 className="font-display text-base font-semibold">{t("access.couldNotVerify")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("access.couldNotVerifyNote")}</p>
          <Button className="mt-4 w-full" onClick={() => void refreshAccess()}>
            <RefreshCw className="h-4 w-4" /> {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  if (!access) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">{t("auth.checkingAccess")}</span>
      </div>
    );
  }

  switch (gateState(access)) {
    case "activate_demo":
      return <DemoActivationScreen />;
    case "blocked":
      return <AccessBlockedScreen />;
    default:
      return <>{children}</>;
  }
}
