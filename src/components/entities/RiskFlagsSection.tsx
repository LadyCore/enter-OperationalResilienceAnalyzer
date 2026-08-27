import { Badge } from "@/components/ui/badge";
import { RISK_CATEGORY_LABELS, type RiskFlag } from "@/lib/analysis";
import { RiskFlagCard } from "@/components/common/RiskFlagCard";

interface RiskFlagsSectionProps {
  flags: RiskFlag[];
}

export function RiskFlagsSection({ flags }: RiskFlagsSectionProps) {
  const categories = Array.from(new Set(flags.map((f) => f.category)));

  if (flags.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No risk flags detected with the current data.
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {categories.map((category) => {
        const items = flags.filter((f) => f.category === category);
        return (
          <section key={category}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {RISK_CATEGORY_LABELS[category]}
              </h3>
              <Badge variant="secondary" className="font-mono">
                {items.length}
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((flag) => (
                <RiskFlagCard key={flag.id} flag={flag} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
