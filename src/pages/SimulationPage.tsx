import { PageHeader } from "@/components/common/PageHeader";
import { SimulationPanel } from "@/components/entities/SimulationPanel";

export function SimulationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Scenario simulation"
        description="Select one or more people who become unavailable at the same time — vacations, medical leaves, simultaneous losses or mixed scenarios. ORA recalculates the coverage of the whole organization as a single joint state."
      />
      <SimulationPanel />
    </div>
  );
}
