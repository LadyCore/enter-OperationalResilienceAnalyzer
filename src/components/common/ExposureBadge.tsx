import { Badge } from "@/components/ui/badge";
import { EXPOSURE_LABELS, type ExposureLevel } from "@/lib/exposure";
import { exposureBadgeClass } from "@/components/common/exposureBadgeClass";

type ShownLevel = Exclude<ExposureLevel, "none">;

export function ExposureBadge({ level }: { level: ShownLevel }) {
  return <Badge className={exposureBadgeClass(level)}>{EXPOSURE_LABELS[level]}</Badge>;
}
