import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { DependencyLevel } from "@/lib/analysis";

const styles: Record<DependencyLevel, string> = {
  none: "border-transparent bg-risk-critical text-white",
  high: "border-transparent bg-risk-high text-white",
  limited: "border-transparent bg-risk-medium text-white",
  adequate: "border-transparent bg-risk-low text-white",
};

const labelKeys: Record<DependencyLevel, string> = {
  none: "dependencyLevel.none",
  high: "dependencyLevel.high",
  limited: "dependencyLevel.limited",
  adequate: "dependencyLevel.adequate",
};

export function DependencyBadge({ level }: { level: DependencyLevel }) {
  const { t } = useTranslation();
  return <Badge className={styles[level]}>{t(labelKeys[level])}</Badge>;
}
