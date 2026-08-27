import { Badge } from "@/components/ui/badge";
import {
  DEPENDENCY_LABELS,
  type DependencyLevel,
} from "@/lib/analysis";

const styles: Record<DependencyLevel, string> = {
  none: "border-transparent bg-risk-critical text-white",
  high: "border-transparent bg-risk-high text-white",
  limited: "border-transparent bg-risk-medium text-white",
  adequate: "border-transparent bg-risk-low text-white",
};

export function DependencyBadge({ level }: { level: DependencyLevel }) {
  return <Badge className={styles[level]}>{DEPENDENCY_LABELS[level]}</Badge>;
}
