import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Building2, Check, Eye, GitBranch, ListChecks, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { OrganizationFormDialog } from "@/components/entities/OrganizationFormDialog";
import { useOra } from "@/store/OraContext";

export function OrganizationPage() {
  const { db, organizations, activeOrganizationId, setActiveOrganization, removeOrganization } = useOra();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const structure = [
    { icon: GitBranch, label: "Processes", value: db.processes.length },
    { icon: ListChecks, label: "Functions", value: db.functions.length },
    { icon: ListChecks, label: "Tasks", value: db.tasks.length },
    { icon: Users, label: "Roles", value: db.roles.length },
    { icon: Users, label: "People", value: db.people.length },
    { icon: Eye, label: "Competencies", value: db.competencies.length },
    { icon: Building2, label: "Areas", value: db.areas.length },
  ];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeOrganization(deleteTarget.id);
      toast.success(`Organization "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the organization.");
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Organization" description="Manage your organizations and the structure of the active one.">
        <Button onClick={() => setOpen(true)}>Edit organization</Button>
        <Button onClick={() => navigate("/import")}>
          <Plus className="h-4 w-4" /> Import organization
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Organizations</CardTitle>
          <CardDescription>Switch the active organization. The demo organization can never be deleted.</CardDescription>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations yet.</p>
          ) : (
            <ul className="divide-y">
              {organizations.map((org) => {
                const isActive = org.id === activeOrganizationId;
                return (
                  <li key={org.id} className="flex items-center gap-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => void setActiveOrganization(org.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1 text-left transition-colors hover:bg-muted/60"
                    >
                      <Building2 className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{org.name}</span>
                      {org.isDemo && (
                        <Badge variant="secondary" className="shrink-0 px-1.5 text-[10px] font-medium">
                          Demo
                        </Badge>
                      )}
                      {isActive && (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-primary">
                          <Check className="h-3.5 w-3.5" /> Active
                        </span>
                      )}
                    </button>
                    {!org.isDemo && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ id: org.id, name: org.name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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

      <OrganizationFormDialog open={open} onOpenChange={setOpen} />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This removes the organization and all of its data. The demo organization is never affected."
        onConfirm={handleDelete}
      />
    </div>
  );
}
