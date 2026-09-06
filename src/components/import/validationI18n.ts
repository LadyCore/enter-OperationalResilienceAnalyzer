import type { ImportIssue } from "@/lib/importer/types";

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Localize a validation issue from its stable `code` + structured fields. The
 * engine keeps its English messages (tests assert them); unknown codes fall
 * back to the original message.
 */
export function localizeIssue(issue: ImportIssue, t: TFunc): string {
  const { row } = issue;
  switch (issue.code) {
    case "missing-person":
      return t("validation.issue.missingPerson", { row });
    case "guardia-no-modality":
      return t("validation.issue.guardiaNoModality", { row });
    case "coverage-no-target":
      return t("validation.issue.coverageNoTarget", { row });
    case "coverage-self":
      return t("validation.issue.coverageSelf", { row });
    case "duplicate-person":
      return issue.name !== undefined
        ? t("validation.issue.duplicatePerson", { name: issue.name })
        : issue.message;
    case "manager-ambiguous":
      return issue.refName !== undefined && issue.count !== undefined
        ? t("validation.issue.managerAmbiguous", { row, ref: issue.refName, count: issue.count })
        : issue.message;
    case "coverage-ambiguous":
      return issue.refName !== undefined && issue.count !== undefined
        ? t("validation.issue.coverageAmbiguous", { row, ref: issue.refName, count: issue.count })
        : issue.message;
    case "manager-not-found":
      if (issue.value !== undefined) {
        return t("validation.issue.managerNotFoundId", { row, value: issue.value });
      }
      if (issue.name !== undefined) {
        return t("validation.issue.managerNotFoundName", { row, name: issue.name });
      }
      return issue.message;
    case "coverage-not-found":
      return issue.refName !== undefined
        ? t("validation.issue.coverageNotFound", { row, name: issue.refName })
        : issue.message;
    default:
      return issue.message;
  }
}

const UNUSABLE_PATTERNS: Array<{
  re: RegExp;
  key: string;
  params: (m: RegExpMatchArray) => Record<string, unknown>;
}> = [
  {
    re: /^Row (\d+): criticality "(.+)" is not recognized\.$/,
    key: "validation.unusable.criticality",
    params: (m) => ({ row: m[1]!, value: m[2]! }),
  },
  {
    re: /^Row (\d+): guardia value "(.+)" is not recognized \(use Sí\/No\)\.$/,
    key: "validation.unusable.guardia",
    params: (m) => ({ row: m[1]!, value: m[2]! }),
  },
];

/** Localize an unusable-value string, falling back to the original text. */
export function localizeUnusableValue(value: string, t: TFunc): string {
  for (const p of UNUSABLE_PATTERNS) {
    const match = value.match(p.re);
    if (match) return t(p.key, p.params(match));
  }
  return value;
}
