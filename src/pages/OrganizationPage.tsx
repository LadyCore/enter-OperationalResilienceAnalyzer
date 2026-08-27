import { useState } from "react";
import { Building2, Eye, GitBranch, ListChecks, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { OrganizationFormDialog } from "@/components/entities/OrganizationFormDialog";
import { useOra } from "@/store/OraContext";

export function OrganizationPage() {
  const { db } = useOra();
  const [open, setOpen] = useState(false);

  const structure = [
    { icon: GitBranch, label: "Processes", value: db.processes.length },
    { icon: ListChecks, label: "Functions", value: db.functions.length },
    { icon: ListChecks, label: "Tasks", value: db.tasks.length },
    { icon: Users, label: "Roles", value: db.roles.length },
    { icon: Users, label: "People", value: db.people.length },
    { icon: Eye, label: "Competencies", value: db.competencies.length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Organization" description="The organization is the root of the operational model.">
        <Button onClick={() => setOpen(true)}>Edit organization</Button>
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>{db.organization.name}</CardTitle>
            <CardDescription>Organization profile</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">{db.organization.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model in numbers</CardTitle>
          <CardDescription>Current size of the operational model.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {structure.map((s) => (
              <div key={s.label} className="rounded-md border p-3">
                <s.icon className="h-4 w-4 text-muted-foreground" />
                <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What ORA analyzes</CardTitle>
            <CardDescription>Operational dependency and capability coverage.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Which critical activities depend on a single person or role.</li>
              <li>• Processes with insufficient operational coverage.</li>
              <li>• Where critical knowledge and competencies are concentrated.</li>
              <li>• What would happen if a person becomes temporarily unavailable.</li>
              <li>• Where documentation or training would reduce operational risk.</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What ORA does not do</CardTitle>
            <CardDescription>ORA never evaluates individual employees.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• It does not evaluate employee performance or assign ratings.</li>
              <li>• It does not recommend hiring, firing or retention decisions.</li>
              <li>• It does not rank people by "importance".</li>
              <li>• It analyzes dependency on a capability, not the value of a person.</li>
              <li>• It does not expose personal information beyond operational roles.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <OrganizationFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
