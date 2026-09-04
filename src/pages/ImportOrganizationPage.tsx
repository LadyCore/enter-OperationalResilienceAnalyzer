import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { setFeedbackStage } from "@/lib/feedback/context";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/common/PageHeader";
import { Field } from "@/components/entities/field";
import { ColumnMappingEditor } from "@/components/import/ColumnMappingEditor";
import { ValidationReport } from "@/components/import/ValidationReport";
import { useOra } from "@/store/OraContext";
import { parseWorkbookFile } from "@/lib/importer/parseFile";
import { suggestMapping } from "@/lib/importer/mapping";
import { validateImport } from "@/lib/importer/validate";
import { buildOrganization } from "@/lib/importer/buildOrganization";
import type { ColumnMapping, NormalizedImport, ParsedFile } from "@/lib/importer/types";

const STEPS = ["Organization & file", "Column mapping", "Validation", "Confirmation"];

export function ImportOrganizationPage() {
  const { addOrganization } = useOra();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [normalized, setNormalized] = useState<NormalizedImport | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinueFromStep1 = name.trim().length > 0 && file !== null;

  // Report the active wizard step to the feedback context (read-only: it does
  // not alter the import flow).
  useEffect(() => {
    const label = STEPS[step - 1];
    setFeedbackStage(label ? `Step ${step} · ${label}` : null);
    return () => setFeedbackStage(null);
  }, [step]);

  const handleNextFromStep1 = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const parsedFile = await parseWorkbookFile(file);
      setParsed(parsedFile);
      setMapping(suggestMapping(parsedFile.columns));
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the file.");
    } finally {
      setBusy(false);
    }
  };

  const handleValidate = () => {
    if (!parsed || !mapping) return;
    setNormalized(validateImport(parsed, mapping, resolutions));
    setStep(3);
  };

  const handleResolve = (kind: "manager" | "coverage", sourceRow: number, personName: string | null) => {
    const next = { ...resolutions, [`${kind}:${sourceRow}`]: personName };
    setResolutions(next);
    if (parsed && mapping) setNormalized(validateImport(parsed, mapping, next));
  };

  const handleConfirm = async () => {
    if (!normalized) return;
    setBusy(true);
    setError(null);
    try {
      const newDb = buildOrganization(name, description, normalized);
      await addOrganization(newDb);
      toast.success(`Organization "${newDb.organization.name}" created and activated.`);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the organization.");
      setBusy(false);
    }
  };

  const nextDbPreview = useMemo(
    () => (normalized ? buildOrganization(name, description, normalized) : null),
    [normalized, name, description],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import organization"
        description="Create a real organization from an Excel/CSV file: load, map, validate and activate it for analysis."
      />

      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              <span className={active ? "font-medium" : "text-muted-foreground"}>{label}</span>
              {n < STEPS.length && <span className="text-muted-foreground">→</span>}
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization and file</CardTitle>
            <CardDescription>
              One row per person. Multiple values in a cell are separated by ";"
              (e.g. Tasks = "Liquidación;Legajos;Atención").
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Organization name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corporation"
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What does this organization do?"
              />
            </Field>
            <Field label="File (Excel or CSV)">
              <label
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors hover:bg-muted/50"
                htmlFor="import-file"
              >
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                {file ? (
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB — click to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium">Choose a file or drag it here</p>
                    <p className="text-xs text-muted-foreground">.xlsx, .xls or .csv</p>
                  </div>
                )}
                <Button variant="outline" size="sm" type="button">
                  <Upload className="h-4 w-4" /> Browse
                </Button>
              </label>
              <input
                id="import-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
          </CardContent>
          <div className="flex justify-end p-6 pt-0">
            <Button onClick={handleNextFromStep1} disabled={!canContinueFromStep1 || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Load file
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && parsed && mapping && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Map columns to ORA fields</CardTitle>
            <CardDescription>
              ORA never assumes column names. The suggestions are automatic — adjust any of them before
              validating.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColumnMappingEditor columns={parsed.columns} mapping={mapping} onChange={setMapping} />
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleValidate} disabled={!mapping.persona}>
                Validate <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 */}
      {step === 3 && normalized && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Validation summary</CardTitle>
            <CardDescription>
              Review the detected entities and resolve any ambiguous references before importing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ValidationReport
              summary={normalized.summary}
              resolutions={resolutions}
              onResolve={handleResolve}
            />
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4" /> Back to mapping
              </Button>
              <Button onClick={() => setStep(4)} disabled={normalized.summary.blocking}>
                Continue to confirmation <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 */}
      {step === 4 && nextDbPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confirm import</CardTitle>
            <CardDescription>This creates a new organization with its own data and activates it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <p className="font-display text-lg font-semibold">{nextDbPreview.organization.name}</p>
              </div>
              {nextDbPreview.organization.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {nextDbPreview.organization.description}
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><p className="font-mono text-xl font-semibold tabular-nums">{nextDbPreview.people.length}</p><p className="text-xs text-muted-foreground">People</p></div>
                <div><p className="font-mono text-xl font-semibold tabular-nums">{nextDbPreview.areas.length}</p><p className="text-xs text-muted-foreground">Areas</p></div>
                <div><p className="font-mono text-xl font-semibold tabular-nums">{nextDbPreview.roles.length}</p><p className="text-xs text-muted-foreground">Roles</p></div>
                <div><p className="font-mono text-xl font-semibold tabular-nums">{nextDbPreview.tasks.length}</p><p className="text-xs text-muted-foreground">Tasks</p></div>
                <div><p className="font-mono text-xl font-semibold tabular-nums">{nextDbPreview.processes.length}</p><p className="text-xs text-muted-foreground">Processes</p></div>
                <div><p className="font-mono text-xl font-semibold tabular-nums">{nextDbPreview.functions.length}</p><p className="text-xs text-muted-foreground">Functions</p></div>
                <div><p className="font-mono text-xl font-semibold tabular-nums">{nextDbPreview.competencies.length}</p><p className="text-xs text-muted-foreground">Competencies</p></div>
                <div><p className="font-mono text-xl font-semibold tabular-nums">{nextDbPreview.people.filter((p) => p.managerId).length}</p><p className="text-xs text-muted-foreground">Hierarchy links</p></div>
                <div><p className="font-mono text-xl font-semibold tabular-nums">{nextDbPreview.onCallAssignments.length}</p><p className="text-xs text-muted-foreground">On-call (guardia)</p></div>
                <div><p className="font-mono text-xl font-semibold tabular-nums">{nextDbPreview.vacationCoverages.length}</p><p className="text-xs text-muted-foreground">Vacation coverages</p></div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(3)} disabled={busy}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleConfirm} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Create organization
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
