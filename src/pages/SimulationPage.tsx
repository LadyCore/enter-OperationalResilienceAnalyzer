import { PageHeader } from "@/components/common/PageHeader";
import { SimulationPanel } from "@/components/entities/SimulationPanel";

export function SimulationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Absence simulation"
        description="Select a person and simulate their temporary absence. ORA recalculates coverage with that person unavailable and shows what changes."
      />
      <SimulationPanel />
    </div>
  );
}
