import type { RiskCategory, RiskFlag, RiskSeverity } from "@/lib/analysis";

/** Static i18n keys for risk categories — translate at render time with t(). */
export const riskCategoryLabelKeys: Record<RiskCategory, string> = {
  "single-person": "risk.category.singlePerson",
  "no-coverage": "risk.category.noCoverage",
  "competency-concentration": "risk.category.competencyConcentration",
  "person-concentration": "risk.category.personConcentration",
  documentation: "risk.category.documentation",
  "role-concentration": "risk.category.roleConcentration",
};

/** Static i18n keys for risk severities — translate at render time with t(). */
export const riskSeverityLabelKeys: Record<RiskSeverity, string> = {
  critical: "risk.severity.critical",
  high: "risk.severity.high",
  medium: "risk.severity.medium",
};

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Localize a risk flag's title/description from its structured fields. Falls
 * back to the raw (English) engine text when structured data is missing, so
 * no surface ever renders empty strings.
 */
export function localizeRiskFlag(flag: RiskFlag, t: TFunc): { title: string; description: string } {
  switch (flag.category) {
    case "single-person":
      if (flag.taskName && flag.personName) {
        return {
          title: t("risk.title.single", { task: flag.taskName }),
          description: t("risk.desc.single", { person: flag.personName }),
        };
      }
      break;
    case "no-coverage":
      if (flag.taskName) {
        return {
          title: t("risk.title.noCoverage", { task: flag.taskName }),
          description: t("risk.desc.noCoverage"),
        };
      }
      break;
    case "competency-concentration":
      if (flag.competencyName) {
        const tasks = (flag.refNames ?? []).join(", ");
        if (flag.holderCount === 1 && flag.personName) {
          return {
            title: t("risk.title.compOne", { competency: flag.competencyName }),
            description: t("risk.desc.compOne", { person: flag.personName, tasks }),
          };
        }
        if (flag.holderCount && flag.holderCount >= 2) {
          return {
            title: t("risk.title.compMany", { competency: flag.competencyName }),
            description: t("risk.desc.compMany", { count: flag.holderCount, tasks }),
          };
        }
      }
      break;
    case "person-concentration":
      if (flag.personName && flag.count !== undefined) {
        const tasks = (flag.refNames ?? []).join(", ");
        if (flag.exclusive && flag.exclusive > 0) {
          return {
            title: t("risk.title.person", { count: flag.count, person: flag.personName }),
            description: t("risk.desc.personExclusive", {
              tasks,
              person: flag.personName,
              exclusive: flag.exclusive,
            }),
          };
        }
        return {
          title: t("risk.title.person", { count: flag.count, person: flag.personName }),
          description: t("risk.desc.personReduced", { tasks }),
        };
      }
      break;
    case "documentation":
      if (flag.taskName) {
        return {
          title: t("risk.title.doc", { task: flag.taskName }),
          description: t("risk.desc.doc"),
        };
      }
      break;
    case "role-concentration":
      if (flag.taskName && flag.roleName) {
        return {
          title: t("risk.title.role", { task: flag.taskName }),
          description: t("risk.desc.role", { role: flag.roleName }),
        };
      }
      break;
  }
  return { title: flag.title, description: flag.description };
}
