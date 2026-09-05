import type { RiskCategory, RiskSeverity } from "@/lib/analysis";

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
