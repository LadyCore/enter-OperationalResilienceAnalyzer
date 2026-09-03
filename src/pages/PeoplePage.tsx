import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { PersonFormDialog } from "@/components/entities/PersonFormDialog";
import { RoleFormDialog } from "@/components/entities/RoleFormDialog";
import { useOra } from "@/store/OraContext";
import { criticalTasks } from "@/lib/analysis";
import { setFeedbackStage } from "@/lib/feedback/context";
import type { Person, Role } from "@/types";

export function PeoplePage() {
  const { db, remove } = useOra();
  const [tab, setTab] = useState("people");
  const [personDialog, setPersonDialog] = useState<{ open: boolean; person?: Person }>({ open: false });
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; role?: Role }>({ open: false });
  const [deletePerson, setDeletePerson] = useState<Person | null>(null);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);

  // Report the active tab to the feedback context so reports from this screen
  // carry the section the user was in ("People" vs "Roles").
  useEffect(() => {
    setFeedbackStage(tab === "roles" ? "Roles" : "People");
    return () => setFeedbackStage(null);
  }, [tab]);

  const roleName = (id: string) => db.roles.find((r) => r.id === id)?.name ?? id;
  const roleNames = (ids: string[]) => (ids?.length ? ids.map(roleName).join(", ") : "—");
  const areaName = (id: string) => db.areas.find((a) => a.id === id)?.name ?? id;
  const areaNames = (ids: string[]) => (ids?.length ? ids.map(areaName).join(", ") : "—");
  const managerName = (id?: string) => (id ? db.people.find((p) => p.id === id)?.name ?? id : undefined);

  return (
    <div className="space-y-6">
      <PageHeader
        title="People & roles"
        description="People hold competencies and can perform tasks. Coverage is calculated from active people only."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setPersonDialog({ open: true })}>
              <Plus className="h-4 w-4" /> New person
            </Button>
          </div>
          {db.people.length === 0 ? (
            <EmptyState icon={Users} title="No people yet" description="Add people to model operational coverage." />
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden md:table-cell">Area</TableHead>
                      <TableHead className="hidden lg:table-cell">Reports to</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Competencies</TableHead>
                      <TableHead className="hidden sm:table-cell">Capable tasks</TableHead>
                      <TableHead>Critical tasks</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {db.people.map((p) => {
                      const personCriticalTasks = criticalTasks(db).filter((t) =>
                        p.taskIds.includes(t.id)
                      );
                      const busFactor = personCriticalTasks.length >= 3;
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <span className="text-sm font-medium">{p.name}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{roleNames(p.roleIds)}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-sm text-muted-foreground">{areaNames(p.areaIds)}</span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-sm text-muted-foreground">{managerName(p.managerId) ?? "—"}</span>
                          </TableCell>
                          <TableCell>
                            {p.isActive ? (
                              <Badge className="border-transparent bg-risk-low/10 text-risk-low">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-sm text-muted-foreground">{p.competencyIds.length}</span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="text-sm text-muted-foreground">{p.taskIds.length}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-sm tabular-nums">{personCriticalTasks.length}</span>
                              {busFactor && (
                                <Badge className="border-transparent bg-risk-high/10 text-risk-high">
                                  Bus factor
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setPersonDialog({ open: true, person: p })}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeletePerson(p)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setRoleDialog({ open: true })}>
              <Plus className="h-4 w-4" /> New role
            </Button>
          </div>
          {db.roles.length === 0 ? (
            <EmptyState icon={Users} title="No roles yet" description="Add roles to group competencies." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {db.roles.map((r) => {
                const peopleCount = db.people.filter((p) => p.roleIds.includes(r.id)).length;
                const comps = r.competencyIds.map((id) => db.competencies.find((c) => c.id === id)?.name ?? id);
                return (
                  <Card key={r.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{r.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {peopleCount} {peopleCount === 1 ? "person" : "people"} · {comps.length} competencies
                          </p>
                          {r.description && (
                            <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {comps.map((c) => (
                              <Badge key={c} variant="secondary" className="font-normal">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setRoleDialog({ open: true, role: r })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteRole(r)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PersonFormDialog
        open={personDialog.open}
        onOpenChange={(open) => setPersonDialog((s) => ({ ...s, open }))}
        person={personDialog.person}
      />
      <RoleFormDialog
        open={roleDialog.open}
        onOpenChange={(open) => setRoleDialog((s) => ({ ...s, open }))}
        role={roleDialog.role}
      />
      <ConfirmDeleteDialog
        open={Boolean(deletePerson)}
        onOpenChange={(open) => !open && setDeletePerson(null)}
        title={`Remove "${deletePerson?.name}"?`}
        description="The person will no longer count toward coverage for any task or competency."
        onConfirm={() => {
          if (deletePerson) {
            remove("people", deletePerson.id);
            toast.success("Person removed");
          }
        }}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleteRole)}
        onOpenChange={(open) => !open && setDeleteRole(null)}
        title={`Delete role "${deleteRole?.name}"?`}
        description="People assigned to this role will keep their tasks and competencies but lose the role reference."
        onConfirm={() => {
          if (deleteRole) {
            remove("roles", deleteRole.id);
            toast.success("Role deleted");
          }
        }}
      />
    </div>
  );
}
