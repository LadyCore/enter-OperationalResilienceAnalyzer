import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/common/PageHeader";
import { ProcessTree } from "@/components/entities/ProcessTree";

export function ProcessesPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.processes.title")}
        description={t("page.processes.description")}
      />
      <ProcessTree />
    </div>
  );
}
