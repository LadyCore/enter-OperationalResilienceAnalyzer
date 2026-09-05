import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { activateDemo } from "@/lib/access/api";
import { DEMO_DAYS, type TaxType } from "@/lib/access/types";
import { useRpcError } from "@/hooks/useRpcError";
import { Field } from "@/components/entities/field";
import { cn } from "@/lib/utils";
import { useOra } from "@/store/OraContext";
import { formatDateDDMMYYYY } from "@/lib/access/status";

type TaxKind = "individual" | "company";

/**
 * Mandatory first-access step for users with no license and no DEMO: they must
 * activate their 15-day DEMO (individual → DNI, company → CUIT) before using
 * ORA. The 12-month reuse rule is enforced by the backend via request_demo.
 */
export function DemoActivationScreen() {
  const { t } = useTranslation();
  const rpcError = useRpcError();
  const { refreshAccess, applyAccess, signOut } = useOra();
  const [kind, setKind] = useState<TaxKind>("individual");
  const [clientName, setClientName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eligibleAfter, setEligibleAfter] = useState<string | null>(null);

  // Preload the Dashboard chunk while the user is still on this screen, so the
  // transition into the app does not pay the module download afterwards.
  useEffect(() => {
    void import("@/pages/Dashboard");
  }, []);

  const taxType: TaxType = kind === "individual" ? "dni" : "cuit";
  const taxLabel = kind === "individual" ? "DNI" : "CUIT";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setEligibleAfter(null);

    const digits = taxId.replace(/\D/g, "");
    if (kind === "individual" && (digits.length < 7 || digits.length > 8)) {
      setError(t("demo.activate.invalidDni"));
      return;
    }
    if (kind === "company" && digits.length !== 11) {
      setError(t("demo.activate.invalidCuit"));
      return;
    }

    setBusy(true);
    try {
      const result = await activateDemo({
        taxType,
        taxId: digits,
        clientName: kind === "company" ? clientName : undefined,
      });
      if (result.ok) {
        toast.success(t("demo.activate.welcomeToast", { days: DEMO_DAYS }));
        // request_demo already returns the authoritative demo_active access
        // state — apply it directly and skip the extra get_my_access round trip.
        if (result.access) {
          applyAccess(result.access);
        } else {
          await refreshAccess();
        }
      } else {
        if (result.reason === "not_eligible") {
          setEligibleAfter(result.eligible_after ?? null);
        }
        setError(rpcError(result));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("demo.activate.couldNotActivate"));
    } finally {
      setBusy(false);
    }
  };

  const eligibilityDate = eligibleAfter
    ? formatDateDDMMYYYY(new Date(eligibleAfter))
    : null;

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

        <Card>
          <CardHeader>
            <CardTitle>{t("demo.activate.title", { days: DEMO_DAYS })}</CardTitle>
            <CardDescription>{t("demo.activate.description", { days: DEMO_DAYS })}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-1">
                {(
                  [
                    { key: "individual", labelKey: "demo.activate.individual" },
                    { key: "company", labelKey: "demo.activate.company" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setKind(option.key);
                      setError(null);
                      setEligibleAfter(null);
                    }}
                    className={cn(
                      "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                      kind === option.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>

              {kind === "company" && (
                <Field label={t("demo.activate.organizationName")} hint={t("demo.activate.organizationNameHint")}>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder={t("demo.activate.organizationNamePlaceholder")}
                    autoComplete="organization"
                  />
                </Field>
              )}

              <Field
                label={taxLabel}
                hint={kind === "individual" ? t("demo.activate.dniHint") : t("demo.activate.cuitHint")}
              >
                <Input
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder={
                    kind === "individual"
                      ? t("demo.activate.dniPlaceholder")
                      : t("demo.activate.cuitPlaceholder")
                  }
                  inputMode="numeric"
                  autoFocus
                />
              </Field>

              {eligibilityDate && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  <p className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {t("demo.activate.notEligibleUntil", {
                        taxLabel,
                        date: eligibilityDate,
                      })}
                    </span>
                  </p>
                </div>
              )}

              {error && !eligibilityDate && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("demo.activate.activating")}
                  </>
                ) : (
                  t("demo.activate.action", { days: DEMO_DAYS })
                )}
              </Button>

              <button
                type="button"
                onClick={() => void signOut()}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                {t("auth.signOut")}
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
