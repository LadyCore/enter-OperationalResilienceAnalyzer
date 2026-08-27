import { Badge } from "@/components/ui/badge";
import { CRITICALITY_LABELS, type Criticality } from "@/types";

const styles: Record<Criticality, string> = {
  critical: "border-transparent bg-risk-critical/10 text-risk-critical",
  important: "border-transparent bg-risk-medium/10 text-risk-medium",
  standard: "border-transparent bg-muted text-muted-foreground",
};

export function CriticalityBadge({ criticality }: { criticality: Criticality }) {
  return <Badge className={styles[criticality]}>{CRITICALITY_LABELS[criticality]}</Badge>;
}
