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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { grantLicense, describeRpcError } from "@/lib/access/api";
import { CURRENT_VERSION, type TaxType } from "@/lib/access/types";
import { Field } from "@/components/entities/field";

interface GrantLicenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetEmail?: string;
  onDone: () => void;
}

/** Owner action: record a perpetual license for a user (no payment involved). */
export function GrantLicenseDialog({ open, onOpenChange, presetEmail, onDone }: GrantLicenseDialogProps) {
  const [email, setEmail] = useState(presetEmail ?? "");
  const [version, setVersion] = useState(CURRENT_VERSION);
  const [clientName, setClientName] = useState("");
  const [taxType, setTaxType] = useState<TaxType | "">("");
  const [taxId, setTaxId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setEmail(presetEmail ?? "");
  }, [open, presetEmail]);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const result = await grantLicense({
        userEmail: email,
        version,
        clientName: clientName || undefined,
        taxType: (taxType || null) as TaxType | null,
        taxId: taxId.trim() || null,
      });
      if (result.ok) {
        toast.success("Perpetual license granted.");
        onOpenChange(false);
        onDone();
      } else {
        toast.error(describeRpcError(result));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not grant the license.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant perpetual license</DialogTitle>
          <DialogDescription>
            Registers a perpetual license (one-time payment, permanent access to this version) for
            a user. The license belongs to the client.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="User email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" autoFocus />
          </Field>
          <Field label="Version">
            <Input value={version} onChange={(e) => setVersion(e.target.value)} />
          </Field>
          <Field label="Client name" hint="Leave empty to use the user's email.">
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client / organization name" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tax type" hint="Optional">
              <Select value={taxType || undefined} onValueChange={(v) => setTaxType(v as TaxType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dni">DNI</SelectItem>
                  <SelectItem value="cuit">CUIT</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tax ID" hint="Optional">
              <Input
                value={taxId}
                onChange={(e) => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="Digits only"
                inputMode="numeric"
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={busy || !email.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Grant license
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
