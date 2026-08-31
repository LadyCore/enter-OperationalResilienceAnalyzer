import type { ExposureLevel } from "@/lib/exposure";

type ShownLevel = Exclude<ExposureLevel, "none">;

const styles: Record<ShownLevel, string> = {
  critical: "border-transparent bg-risk-medium/10 text-risk-medium",
  prolonged: "border-transparent bg-risk-high/10 text-risk-high",
  sustained: "border-transparent bg-risk-critical/10 text-risk-critical",
};

export function exposureBadgeClass(level: ShownLevel): string {
  return styles[level];
}
