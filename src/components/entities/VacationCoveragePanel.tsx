import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { VacationCoverageFormDialog } from "@/components/entities/VacationCoverageFormDialog";
import { useOra } from "@/store/OraContext";
import type { VacationCoverage } from "@/types";

export function VacationCoveragePanel() {
  const { db, remove } = useOra();
  const [dialog, setDialog] = useState<{ open: boolean; coverage?: VacationCoverage }>({ open: false });
  const [toDelete, setToDelete] = useState<VacationCoverage | null>(null);

  const personName = (id: string) => db.people.find((p) => p.id === id)?.name ?? id;
  const roleName = (id?: string) => (id ? db.roles.find((r) => r.id === id)?.name ?? id : undefined);
  const taskNames = (ids: string[]) => ids.map((id) => db.tasks.find((t) => t.id === id)?.name ?? id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Vacation coverage</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            People who can temporarily cover another person's tasks during a planned vacation.
            Applied only to planned-absence simulations categorized as Vacation.
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true })}>
          <Plus className="h-4 w-4" /> New coverage
        </Button>
      </CardHeader>
      <CardContent>
        {db.vacationCoverages.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No vacation coverages"
            description="Define who can cover whom during planned vacations to test those scenarios with mitigation."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Covering person</TableHead>
                  <TableHead>Covered person (on vacation)</TableHead>
                  <TableHead className="hidden md:table-cell">Role covered</TableHead>
                  <TableHead className="hidden lg:table-cell">Tasks covered</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {db.vacationCoverages.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm font-medium">{personName(c.coveringPersonId)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{personName(c.coveredPersonId)}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {roleName(c.roleId) ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {taskNames(c.taskIds).map((n) => (
                          <Badge key={n} variant="secondary" className="font-normal">
                            {n}
                          </Badge>
                        ))}
                        {c.taskIds.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, coverage: c })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setToDelete(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <VacationCoverageFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((s) => ({ ...s, open }))}
        coverage={dialog.coverage}
      />
      <ConfirmDeleteDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Remove this vacation coverage?"
        description="The coverage relation is deleted. The people involved keep their ordinary profiles unchanged."
        onConfirm={() => {
          if (toDelete) {
            remove("vacationCoverages", toDelete.id);
            toast.success("Vacation coverage removed");
          }
        }}
      />
    </Card>
  );
}
