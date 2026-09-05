import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/common/PageHeader";
import { SimulationPanel } from "@/components/entities/SimulationPanel";

export function SimulationPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.simulation.title")}
        description={t("page.simulation.description")}
      />
      <SimulationPanel />
    </div>
  );
}
