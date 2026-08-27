import type { LucideIcon } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RISK_CATEGORY_LABELS, type RiskFlag, type RiskSeverity } from "@/lib/analysis";

const severityStyles: Record<RiskSeverity, { dot: string; text: string; label: string }> = {
  critical: { dot: "bg-risk-critical", text: "text-risk-critical", label: "Critical" },
  high: { dot: "bg-risk-high", text: "text-risk-high", label: "High" },
  medium: { dot: "bg-risk-medium", text: "text-risk-medium", label: "Medium" },
};

interface RiskFlagCardProps {
  flag: RiskFlag;
  icon?: LucideIcon;
}

export function RiskFlagCard({ flag, icon: Icon }: RiskFlagCardProps) {
  const s = severityStyles[flag.severity];
  return (
    <Card className="flex gap-3 border-l-[3px] p-4 shadow-sm" style={{ borderLeftColor: "hsl(var(--border))" }}>
      <div className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", s.dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("text-xs font-semibold uppercase tracking-wider", s.text)}>{s.label}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {RISK_CATEGORY_LABELS[flag.category]}
          </span>
        </div>
        <CardTitle className="mt-1.5 flex items-center gap-2 text-[15px]">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
          {flag.title}
        </CardTitle>
        <CardDescription className="mt-1.5">{flag.description}</CardDescription>
      </div>
    </Card>
  );
}
