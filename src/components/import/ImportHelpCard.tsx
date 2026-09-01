import { useState } from "react";
import { Download, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadOrganizationTemplate } from "@/lib/importer/downloadTemplate";
import { cn } from "@/lib/utils";

const flowSteps = [
  "Download template",
  "Complete the data",
  "Upload the file",
  "Review column mapping",
  "Run Validation",
  "Fix any issues",
  "Confirm import",
];

const tips = [
  {
    title: "One row per person",
    body: "Each row in the sheet represents a person. Repeat values that are shared (e.g. the same task for several people) in each row.",
  },
  {
    title: "Unique person identifier",
    body: "The person identifier (Legajo / employee id) must be unique per person and kept consistent if your organization uses them.",
  },
  {
    title: "Manager references",
    body: "Responsable / Manager ID must reference people that actually exist in the file. Leave them empty only for the root of the hierarchy.",
  },
  {
    title: "Multiple values",
    body: "When a person has several tasks, competencies or other multi-value fields, separate them with a semicolon.",
  },
  {
    title: "Documentada / Activo",
    body: "Use only the values ORA recognizes for these fields (Sí / No).",
  },
  {
    title: "Criticidad",
    body: "If your file includes a criticality column, use only the values ORA recognizes. Otherwise ORA derives criticality from the analysis.",
  },
  {
    title: "Check the mapping",
    body: "Before running Validation, review the automatic column mapping — ORA never assumes column names.",
  },
  {
    title: "Review validation issues",
    body: "Read the errors and warnings shown by Validation and resolve ambiguous references before confirming the import.",
  },
];

const multiValueExample = (
  <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
    <p className="font-medium text-foreground">Example — multiple values in one cell</p>
    <div className="space-y-1 font-mono text-xs">
      <p className="text-muted-foreground">Tareas (Tasks):</p>
      <p className="text-foreground">Tarea A; Tarea B; Tarea C</p>
      <p className="mt-2 text-muted-foreground">Competencias (Competencies):</p>
      <p className="text-foreground">Competencia A; Competencia B</p>
    </div>
  </div>
);

interface ImportHelpCardProps {
  className?: string;
}

/** Visible access to the official template and short loading instructions. */
export function ImportHelpCard({ className }: ImportHelpCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Prepare your file</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Download the official template and read the instructions before preparing your data.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void downloadOrganizationTemplate()}>
          <Download className="h-4 w-4" /> Download organization template
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
          <HelpCircle className="h-4 w-4" />
          {open ? "Hide instructions" : "How to prepare your file"}
        </Button>

        {open && (
          <div className="space-y-5 border-t pt-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Flow
              </p>
              <ol className="flex flex-wrap items-center gap-1.5 text-sm">
                {flowSteps.map((step, i) => (
                  <li key={step} className="flex items-center gap-1.5">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{i + 1}</span>
                    <span>{step}</span>
                    {i < flowSteps.length - 1 && (
                      <span className="text-muted-foreground">→</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Instructions
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {tips.map((tip) => (
                  <li key={tip.title} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{tip.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{tip.body}</p>
                  </li>
                ))}
              </ul>
            </div>

            {multiValueExample}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
