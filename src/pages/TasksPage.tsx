import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { TaskDependencyTable } from "@/components/entities/TaskDependencyTable";
import { TaskFormDialog } from "@/components/entities/TaskFormDialog";

export function TasksPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Task registry"
        description="Every task with its criticality, required competencies, capable people and dependency level. Expand a row to see why it is rated that way."
      >
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New task
        </Button>
      </PageHeader>
      <TaskDependencyTable />
      <TaskFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
