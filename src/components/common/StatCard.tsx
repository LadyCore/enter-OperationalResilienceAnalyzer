import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "primary" | "low" | "medium" | "high" | "critical";

const valueTones: Record<StatTone, string> = {
  default: "text-foreground",
  primary: "text-primary",
  low: "text-risk-low",
  medium: "text-risk-medium",
  high: "text-risk-high",
  critical: "text-risk-critical",
};

const iconTones: Record<StatTone, string> = {
  default: "text-muted-foreground",
  primary: "text-primary",
  low: "text-risk-low",
  medium: "text-risk-medium",
  high: "text-risk-high",
  critical: "text-risk-critical",
};

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  delay?: number;
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default", delay = 0 }: StatCardProps) {
  return (
    <Card
      className="animate-rise p-5 shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-2 font-mono text-3xl font-semibold leading-none tabular-nums",
              valueTones[tone]
            )}
          >
            {value}
          </p>
          {hint && <p className="mt-2 text-xs leading-snug text-muted-foreground">{hint}</p>}
        </div>
        {Icon && <Icon className={cn("h-5 w-5 shrink-0", iconTones[tone])} />}
      </div>
    </Card>
  );
}
