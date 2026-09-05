import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { Criticality } from "@/types";

const styles: Record<Criticality, string> = {
  critical: "border-transparent bg-risk-critical/10 text-risk-critical",
  important: "border-transparent bg-risk-medium/10 text-risk-medium",
  standard: "border-transparent bg-muted text-muted-foreground",
};

const labelKeys: Record<Criticality, string> = {
  critical: "criticality.critical",
  important: "criticality.important",
  standard: "criticality.standard",
};

export function CriticalityBadge({ criticality }: { criticality: Criticality }) {
  const { t } = useTranslation();
  return <Badge className={styles[criticality]}>{t(labelKeys[criticality])}</Badge>;
}
