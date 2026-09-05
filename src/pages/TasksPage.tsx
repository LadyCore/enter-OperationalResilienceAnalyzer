import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { TaskDependencyTable } from "@/components/entities/TaskDependencyTable";
import { TaskFormDialog } from "@/components/entities/TaskFormDialog";

export function TasksPage() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.tasks.title")}
        description={t("page.tasks.description")}
      >
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {t("page.tasks.new")}
        </Button>
      </PageHeader>
      <TaskDependencyTable />
      <TaskFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
