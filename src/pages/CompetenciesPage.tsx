import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { db, remove } = useOra();
  const [dialog, setDialog] = useState<{ open: boolean; competency?: Competency }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Competency | null>(null);

  const requiredByCritical = (compId: string) =>
    criticalTasks(db).filter((t) => t.requiredCompetencyIds.includes(compId));

  if (db.competencies.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("nav.competencies")} description={t("compPage.headerHintEmpty")}>
          <Button onClick={() => setDialog({ open: true })}>
            <Plus className="h-4 w-4" /> {t("competency.new")}
          </Button>
        </PageHeader>
        <EmptyState
          icon={Award}
          title={t("compPage.emptyTitle")}
          description={t("compPage.emptyDescription")}
        />
        <CompetencyFormDialog open={dialog.open} onOpenChange={(open) => setDialog((s) => ({ ...s, open }))} competency={dialog.competency} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.competencies")}
        description={t("compPage.headerHint")}
      >
        <Button onClick={() => setDialog({ open: true })}>
          <Plus className="h-4 w-4" /> {t("competency.new")}
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("compPage.table.competency")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("entity.description")}</TableHead>
                <TableHead>{t("compPage.table.holders")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("compPage.table.requiredByCritical")}</TableHead>
                <TableHead>{t("compPage.table.status")}</TableHead>
                <TableHead className="w-24 text-right">{t("compPage.table.actions")}</TableHead>
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
                        {holders.length === 0 && <span className="text-xs text-muted-foreground">{t("taskTable.noOne")}</span>}
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
                          {t("compPage.status.concentrated")}
                        </Badge>
                      ) : limitedCoverage ? (
                        <Badge className="border-transparent bg-risk-high/10 text-risk-high">
                          {t("compPage.status.limited")}
                        </Badge>
                      ) : criticalTasks.length > 0 ? (
                        <Badge className="border-transparent bg-risk-low/10 text-risk-low">
                          {t("compPage.status.covered")}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("compPage.status.notUsed")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, competency: c })} aria-label={t("compPage.editCompetency", { name: c.name })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(c)}
                          aria-label={t("compPage.deleteCompetency", { name: c.name })}
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
        title={t("compPage.deleteTitle", { name: deleteTarget?.name ?? "" })}
        description={t("compPage.deleteDescription")}
        onConfirm={() => {
          if (deleteTarget) {
            remove("competencies", deleteTarget.id);
            toast.success(t("compPage.deletedToast"));
          }
        }}
      />
    </div>
  );
}
