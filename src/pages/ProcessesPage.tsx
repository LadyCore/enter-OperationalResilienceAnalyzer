import { PageHeader } from "@/components/common/PageHeader";
import { ProcessTree } from "@/components/entities/ProcessTree";

export function ProcessesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Process structure"
        description="Model the organization as processes, functions and tasks. Click any row to expand a task's dependency explanation."
      />
      <ProcessTree />
    </div>
  );
}
