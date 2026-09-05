import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { VacationCoveragePanel } from "@/components/entities/VacationCoveragePanel";
import { OnCallPanel } from "@/components/entities/OnCallPanel";
import { useOra } from "@/store/OraContext";
import { criticalTasks } from "@/lib/analysis";
import { setFeedbackStage } from "@/lib/feedback/context";
import type { Person, Role } from "@/types";

export function PeoplePage() {
  const { t } = useTranslation();
  const { db, remove } = useOra();
  const [tab, setTab] = useState("people");
  const [personDialog, setPersonDialog] = useState<{ open: boolean; person?: Person }>({ open: false });
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; role?: Role }>({ open: false });
  const [deletePerson, setDeletePerson] = useState<Person | null>(null);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);

  // Report the active tab to the feedback context so reports from this screen
  // carry the section the user was in ("People" vs "Roles"). The labels are
  // stored context values, intentionally kept in the source language.
  useEffect(() => {
    setFeedbackStage(
      tab === "roles" ? "Roles" : tab === "coverage" ? "Coverage & on-call" : "People",
    );
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
        title={t("peoplePage.title")}
        description={t("peoplePage.description")}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="people">{t("nav.people")}</TabsTrigger>
          <TabsTrigger value="roles">{t("peoplePage.tab.roles")}</TabsTrigger>
          <TabsTrigger value="coverage">{t("peoplePage.tab.coverage")}</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setPersonDialog({ open: true })}>
              <Plus className="h-4 w-4" /> {t("person.new")}
            </Button>
          </div>
          {db.people.length === 0 ? (
            <EmptyState icon={Users} title={t("peoplePage.peopleEmptyTitle")} description={t("peoplePage.peopleEmptyDescription")} />
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("entity.name")}</TableHead>
                      <TableHead>{t("peoplePage.th.role")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("peoplePage.th.area")}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t("peoplePage.th.reportsTo")}</TableHead>
                      <TableHead>{t("peoplePage.th.status")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("peoplePage.th.competencies")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("peoplePage.th.capableTasks")}</TableHead>
                      <TableHead>{t("peoplePage.th.criticalTasks")}</TableHead>
                      <TableHead className="w-24 text-right">{t("peoplePage.th.actions")}</TableHead>
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
                              <Badge className="border-transparent bg-risk-low/10 text-risk-low">{t("peoplePage.status.active")}</Badge>
                            ) : (
                              <Badge variant="secondary">{t("peoplePage.status.inactive")}</Badge>
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
                                  {t("peoplePage.busFactor")}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setPersonDialog({ open: true, person: p })} aria-label={t("peoplePage.editPerson", { name: p.name })}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeletePerson(p)}
                                aria-label={t("peoplePage.removePerson", { name: p.name })}
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
              <Plus className="h-4 w-4" /> {t("role.new")}
            </Button>
          </div>
          {db.roles.length === 0 ? (
            <EmptyState icon={Users} title={t("peoplePage.rolesEmptyTitle")} description={t("peoplePage.rolesEmptyDescription")} />
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
                            {peopleCount === 1
                              ? t("peoplePage.roleSummaryOne", { competencies: comps.length })
                              : t("peoplePage.roleSummaryMany", { people: peopleCount, competencies: comps.length })}
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
                          <Button variant="ghost" size="icon" onClick={() => setRoleDialog({ open: true, role: r })} aria-label={t("peoplePage.editRole", { name: r.name })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteRole(r)}
                            aria-label={t("peoplePage.deleteRole", { name: r.name })}
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

        <TabsContent value="coverage" className="space-y-4">
          <VacationCoveragePanel />
          <OnCallPanel />
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
        title={t("peoplePage.removePersonTitle", { name: deletePerson?.name ?? "" })}
        description={t("peoplePage.removePersonDescription")}
        onConfirm={() => {
          if (deletePerson) {
            remove("people", deletePerson.id);
            toast.success(t("peoplePage.personRemoved"));
          }
        }}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleteRole)}
        onOpenChange={(open) => !open && setDeleteRole(null)}
        title={t("peoplePage.deleteRoleTitle", { name: deleteRole?.name ?? "" })}
        description={t("peoplePage.deleteRoleDescription")}
        onConfirm={() => {
          if (deleteRole) {
            remove("roles", deleteRole.id);
            toast.success(t("peoplePage.roleDeleted"));
          }
        }}
      />
    </div>
  );
}
