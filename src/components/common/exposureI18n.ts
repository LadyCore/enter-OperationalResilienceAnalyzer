import type { ExposureDescription } from "@/lib/exposure";

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

const HORIZON_KEYS: Record<ExposureDescription["horizon"], string> = {
  temporary: "exposureDesc.horizon.temporary",
  prolonged: "exposureDesc.horizon.prolonged",
  sustained: "exposureDesc.horizon.sustained",
};

const RELEVANCE_KEYS: Record<ExposureDescription["criticality"], string> = {
  critical: "exposureDesc.rel.critical",
  important: "exposureDesc.rel.important",
  standard: "exposureDesc.rel.standard",
};

/**
 * Localize an exposure description from its structured variant. The engine's
 * English title/note stay canonical (tests assert them); this reproduces the
 * same wording through i18n keys for the current UI language.
 */
export function localizeExposureDescription(
  desc: ExposureDescription,
  days: number,
  t: TFunc,
): { title: string; note: string } {
  const duration = days === 1 ? t("exposureDesc.oneDay") : t("exposureDesc.nDays", { count: days });
  const horizon = t(HORIZON_KEYS[desc.horizon]);
  const rel = t(RELEVANCE_KEYS[desc.criticality]);

  switch (desc.kind) {
    case "maintained":
      return {
        title: t("exposureDesc.maintainedTitle"),
        note: t("exposureDesc.maintainedNote"),
      };
    case "permanent-gap":
      return {
        title: t("exposureDesc.permanentGapTitle"),
        note: t("exposureDesc.permanentGapNote", { rel }),
      };
    case "permanent-dependency":
      return {
        title: t("exposureDesc.permanentDepTitle"),
        note: t("exposureDesc.permanentDepNote", { rel }),
      };
    case "gap":
      return {
        title: t("exposureDesc.gapTitle", { horizon, duration }),
        note: t(
          desc.noteLength === "short" ? "exposureDesc.gapNoteShort" : "exposureDesc.gapNoteLong",
          { rel, duration },
        ),
      };
    case "reduction":
      return {
        title:
          desc.noteLength === "short"
            ? t("exposureDesc.reductionTitle", { duration })
            : t("exposureDesc.reductionTitleHorizon", { horizon, duration }),
        note: t(
          desc.noteLength === "short"
            ? "exposureDesc.reductionNoteShort"
            : "exposureDesc.reductionNoteLong",
          { rel, duration },
        ),
      };
  }
}
