import { useState } from "react";
import { toast } from "sonner";
import { Award, Plus, Trash2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { CompetencyFormDialog } from "@/components/entities/CompetencyFormDialog";
import { useOra } from "@/store/OraContext";
import { holdersOf, criticalTasks } from "@/lib/analysis";
import type { Competency } from "@/types";

export function CompetenciesPage() {
  const { db, remove } = useOra();
  const [dialog, setDialog] = useState<{ open: boolean; competency?: Competency }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Competency | null>(null);

  const requiredByCritical = (compId: string) =>
    criticalTasks(db).filter((t) => t.requiredCompetencyIds.includes(compId));

  if (db.competencies.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Competencies" description="Capabilities that tasks require and people hold.">
          <Button onClick={() => setDialog({ open: true })}>
            <Plus className="h-4 w-4" /> New competency
          </Button>
        </PageHeader>
        <EmptyState
          icon={Award}
          title="No competencies yet"
          description="Create competencies so tasks can require them and people can hold them."
        />
        <CompetencyFormDialog open={dialog.open} onOpenChange={(open) => setDialog((s) => ({ ...s, open }))} competency={dialog.competency} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Competencies"
        description="Competencies are the capabilities behind tasks. A competency concentrated in one person is a resilience risk when critical tasks require it."
      >
        <Button onClick={() => setDialog({ open: true })}>
          <Plus className="h-4 w-4" /> New competency
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competency</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead>Holders</TableHead>
                <TableHead className="hidden lg:table-cell">Required by critical tasks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {db.competencies.map((c) => {
                const holders = holdersOf(db, c.id);
                const criticalTasks = requiredByCritical(c.id);
                const singleHolder = criticalTasks.length > 0 && holders.length === 1;
                const limitedCoverage = criticalTasks.length > 0 && holders.length === 2;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-xs md:table-cell">
                      <span className="text-sm text-muted-foreground">{c.description}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {holders.length === 0 && <span className="text-xs text-muted-foreground">No one</span>}
                        {holders.map((h) => (
                          <Badge key={h.id} variant="outline" className="font-normal">
                            {h.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex max-w-[240px] flex-wrap gap-1">
                        {criticalTasks.length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {criticalTasks.map((t) => (
                          <Badge key={t.id} variant="secondary" className="font-normal">
                            {t.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {singleHolder ? (
                        <Badge className="border-transparent bg-risk-critical/10 text-risk-critical">
                          Concentrated (1 holder)
                        </Badge>
                      ) : limitedCoverage ? (
                        <Badge className="border-transparent bg-risk-high/10 text-risk-high">
                          Limited (2 holders)
                        </Badge>
                      ) : criticalTasks.length > 0 ? (
                        <Badge className="border-transparent bg-risk-low/10 text-risk-low">
                          Covered
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not used by critical tasks</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, competency: c })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(c)}
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

      <CompetencyFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((s) => ({ ...s, open }))}
        competency={dialog.competency}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete competency "${deleteTarget?.name}"?`}
        description="Tasks and people that referenced it will no longer match this competency."
        onConfirm={() => {
          if (deleteTarget) {
            remove("competencies", deleteTarget.id);
            toast.success("Competency deleted");
          }
        }}
      />
    </div>
  );
}
