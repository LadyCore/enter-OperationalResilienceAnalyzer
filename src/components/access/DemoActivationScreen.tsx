import { useEffect, useState } from "react";
import { CalendarDays, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { activateDemo, describeRpcError } from "@/lib/access/api";
import { DEMO_DAYS, type TaxType } from "@/lib/access/types";
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
      setError("Enter a valid DNI (7–8 digits).");
      return;
    }
    if (kind === "company" && digits.length !== 11) {
      setError("Enter a valid CUIT (11 digits).");
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
        toast.success("Your 15-day DEMO is active. Welcome to ORA.");
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
        setError(describeRpcError(result));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate the DEMO.");
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
          <p className="text-sm text-muted-foreground">Organizational Resilience Analyzer</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activate your {DEMO_DAYS}-day DEMO</CardTitle>
            <CardDescription>
              To start using ORA you need to activate a free {DEMO_DAYS}-day DEMO. Provide your
              DNI (individual) or CUIT (company). Each DNI/CUIT is eligible for one DEMO every 12
              months.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-1">
                {(
                  [
                    { key: "individual", label: "Individual" },
                    { key: "company", label: "Company / organization" },
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
                    {option.label}
                  </button>
                ))}
              </div>

              {kind === "company" && (
                <Field label="Organization name" hint="Optional, used as the client name.">
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Acme S.A."
                    autoComplete="organization"
                  />
                </Field>
              )}

              <Field label={taxLabel} hint={kind === "individual" ? "Your national ID number." : "Your organization tax ID (11 digits)."}>
                <Input
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder={kind === "individual" ? "e.g. 30123456" : "e.g. 20123456789"}
                  inputMode="numeric"
                  autoFocus
                />
              </Field>

              {eligibilityDate && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  <p className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      This {taxLabel} was used for a DEMO in the last 12 months. A new DEMO for it
                      becomes available on <strong>{eligibilityDate}</strong>.
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
                    <Loader2 className="h-4 w-4 animate-spin" /> Activating…
                  </>
                ) : (
                  `Activate ${DEMO_DAYS}-day DEMO`
                )}
              </Button>

              <button
                type="button"
                onClick={() => void signOut()}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
