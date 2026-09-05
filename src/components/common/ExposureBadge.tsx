import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { ExposureLevel } from "@/lib/exposure";
import { exposureBadgeClass } from "@/components/common/exposureBadgeClass";

type ShownLevel = Exclude<ExposureLevel, "none">;

const labelKeys: Record<ShownLevel, string> = {
  short: "exposure.short",
  prolonged: "exposure.prolonged",
  sustained: "exposure.sustained",
};

export function ExposureBadge({ level }: { level: ShownLevel }) {
  const { t } = useTranslation();
  return <Badge className={exposureBadgeClass(level)}>{t(labelKeys[level])}</Badge>;
}
