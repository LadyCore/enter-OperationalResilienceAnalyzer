import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PhoneCall, Pencil, Plus, Trash2 } from "lucide-react";
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
import { OnCallFormDialog } from "@/components/entities/OnCallFormDialog";
import { useOra } from "@/store/OraContext";
import type { OnCallAssignment } from "@/types";

export function OnCallPanel() {
  const { t } = useTranslation();
  const { db, remove } = useOra();
  const [dialog, setDialog] = useState<{ open: boolean; assignment?: OnCallAssignment }>({ open: false });
  const [toDelete, setToDelete] = useState<OnCallAssignment | null>(null);

  const personName = (id: string) => db.people.find((p) => p.id === id)?.name ?? id;
  const taskNames = (ids: string[]) => ids.map((id) => db.tasks.find((tt) => tt.id === id)?.name ?? id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{t("onCallPanel.title")}</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("onCallPanel.subtitle")}</p>
        </div>
        <Button onClick={() => setDialog({ open: true })}>
          <Plus className="h-4 w-4" /> {t("onCallPanel.add")}
        </Button>
      </CardHeader>
      <CardContent>
        {db.onCallAssignments.length === 0 ? (
          <EmptyState
            icon={PhoneCall}
            title={t("onCallPanel.empty.title")}
            description={t("onCallPanel.empty.description")}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("entity.person")}</TableHead>
                  <TableHead>{t("entity.modality")}</TableHead>
                  <TableHead>{t("entity.shiftPeriod")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("entity.capabilitiesCovered")}</TableHead>
                  <TableHead className="w-24 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {db.onCallAssignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm font-medium">{personName(a.personId)}</TableCell>
                    <TableCell>
                      <Badge className="border-transparent bg-primary/10 text-primary">{a.modality || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.period || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {taskNames(a.taskIds).map((n) => (
                          <Badge key={n} variant="secondary" className="font-normal">
                            {n}
                          </Badge>
                        ))}
                        {a.taskIds.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, assignment: a })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setToDelete(a)}
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

      <OnCallFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((s) => ({ ...s, open }))}
        assignment={dialog.assignment}
      />
      <ConfirmDeleteDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("onCallPanel.deleteTitle")}
        description={t("onCallPanel.deleteDescription")}
        onConfirm={() => {
          if (toDelete) {
            remove("onCallAssignments", toDelete.id);
            toast.success(t("onCallPanel.removed"));
          }
        }}
      />
    </Card>
  );
}
