type TFunc = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Localize a derived reason string produced by the analysis engine
 * (deriveTaskCriticality / taskDependency). The engine keeps its English
 * templates — tests assert them — so each template is matched back here and
 * rendered through i18n keys. Unmatched (future) strings fall back to the
 * original English text, never to an empty string.
 */
export function localizeReason(reason: string, t: TFunc): string {
  // Static one-to-one templates.
  const statics: Array<[string, string]> = [
    ["Marked critical in the task registry.", "taskReasons.markedCriticalRegistry"],
    ["Marked important in the task registry.", "taskReasons.markedImportantRegistry"],
    ["No structural signal elevates this task's criticality.", "taskReasons.noStructuralSignal"],
    ["No active person is currently capable of performing this task.", "taskReasons.noPersonCapable"],
    ["No role provides coverage for this task.", "taskReasons.noRoleCoverage"],
    ["The task is not documented — its knowledge is not captured for handover.", "taskReasons.notDocumented"],
    ["This is a critical task.", "taskReasons.isCriticalTask"],
  ];
  for (const [english, key] of statics) {
    if (reason === english) return t(key);
  }

  // Templates with embedded data extracted by a capture group.
  const dynamic: Array<{
    re: RegExp;
    key: string;
    params: (m: RegExpMatchArray) => Record<string, string>;
  }> = [
    {
      re: /^Part of the critical process "(.+)"\.$/,
      key: "taskReasons.partOfCriticalProcess",
      params: (m) => ({ name: m[1]! }),
    },
    {
      re: /^Part of the important process "(.+)"\.$/,
      key: "taskReasons.partOfImportantProcess",
      params: (m) => ({ name: m[1]! }),
    },
    {
      re: /^Part of the critical function "(.+)"\.$/,
      key: "taskReasons.partOfCriticalFunction",
      params: (m) => ({ name: m[1]! }),
    },
    {
      re: /^Only one active person can perform this task: (.+)\.$/,
      key: "taskReasons.onlyOnePerson",
      params: (m) => ({ name: m[1]! }),
    },
    {
      re: /^(\d+) active people can perform this task: (.+)\.$/,
      key: "taskReasons.manyPeople",
      params: (m) => ({ count: m[1]!, names: m[2]! }),
    },
    {
      re: /^All coverage comes from a single role \((.+)\)\.$/,
      key: "taskReasons.singleRole",
      params: (m) => ({ name: m[1]! }),
    },
    {
      re: /^Required competency '(.+)' has a single active holder \((.+)\)\.$/,
      key: "taskReasons.singleHolderCompetency",
      params: (m) => ({ competency: m[1]!, holder: m[2]! }),
    },
  ];
  for (const p of dynamic) {
    const match = reason.match(p.re);
    if (match) return t(p.key, p.params(match));
  }

  return reason;
}
