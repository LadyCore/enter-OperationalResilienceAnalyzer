import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { reissueDemo, describeRpcError } from "@/lib/access/api";
import { DEMO_DAYS, type TaxType } from "@/lib/access/types";
import { Field } from "@/components/entities/field";
import { cn } from "@/lib/utils";

interface ReissueDemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetEmail?: string;
  onDone: () => void;
}

/**
 * Owner action: start a 15-day DEMO for another user. The 12-month DNI/CUIT
 * reuse rule is still enforced by the backend.
 */
export function ReissueDemoDialog({ open, onOpenChange, presetEmail, onDone }: ReissueDemoDialogProps) {
  const [email, setEmail] = useState(presetEmail ?? "");
  const [kind, setKind] = useState<"individual" | "company">("individual");
  const [clientName, setClientName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(presetEmail ?? "");
      setTaxId("");
      setClientName("");
    }
  }, [open, presetEmail]);

  const taxType: TaxType = kind === "individual" ? "dni" : "cuit";
  const taxLabel = kind === "individual" ? "DNI" : "CUIT";

  const handleSubmit = async () => {
    if (!email.trim() || !taxId.trim()) return;
    setBusy(true);
    try {
      const result = await reissueDemo({
        userEmail: email,
        taxType,
        taxId: taxId.replace(/\D/g, ""),
        clientName: kind === "company" ? clientName : undefined,
      });
      if (result.ok) {
        toast.success(`${DEMO_DAYS}-day DEMO started for ${email.trim()}.`);
        onOpenChange(false);
        onDone();
      } else {
        toast.error(describeRpcError(result));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the DEMO.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a {DEMO_DAYS}-day DEMO</DialogTitle>
          <DialogDescription>
            Starts a new {DEMO_DAYS}-day DEMO for a user. The {taxLabel} eligibility rule (one DEMO
            per DNI/CUIT every 12 months) is still enforced.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="User email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-1">
            {(
              [
                { key: "individual", label: "Individual" },
                { key: "company", label: "Company" },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setKind(option.key)}
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
            <Field label="Organization name">
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Organization name" />
            </Field>
          )}

          <Field label={taxLabel}>
            <Input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder={kind === "individual" ? "e.g. 30123456" : "e.g. 20123456789"}
              inputMode="numeric"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={busy || !email.trim() || !taxId.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Start DEMO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
