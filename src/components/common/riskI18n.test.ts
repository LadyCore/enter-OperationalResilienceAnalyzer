import { describe, expect, it } from "vitest";
import { localizeRiskFlag } from "./riskI18n";
import type { RiskFlag } from "@/lib/analysis";

const stubT =
  (key: string, opts?: Record<string, unknown>) => `${key}:${JSON.stringify(opts ?? {})}`;

describe("localizeRiskFlag", () => {
  it("localizes single-person flags with task/person interpolation", () => {
    const flag: RiskFlag = {
      id: "s1",
      category: "single-person",
      severity: "high",
      title: "raw",
      description: "raw",
      taskName: "Quote custom pricing",
      personName: "Diana Nunes",
    };
    const result = localizeRiskFlag(flag, stubT);
    expect(result.title).toContain("risk.title.single");
    expect(result.title).toContain("Quote custom pricing");
    expect(result.description).toContain("risk.desc.single");
    expect(result.description).toContain("Diana Nunes");
  });

  it("localizes competency flags (two-holder variant uses count)", () => {
    const flag: RiskFlag = {
      id: "c1",
      category: "competency-concentration",
      severity: "high",
      title: "raw",
      description: "raw",
      competencyName: "Database Administration",
      holderCount: 2,
      refNames: ["Perform database backups", "Restore from backup"],
    };
    const result = localizeRiskFlag(flag, stubT);
    expect(result.title).toContain("risk.title.compMany");
    expect(result.description).toContain("risk.desc.compMany");
    expect(result.description).toContain('"count":2');
  });

  it("localizes person concentration with exclusive variant", () => {
    const flag: RiskFlag = {
      id: "p1",
      category: "person-concentration",
      severity: "high",
      title: "raw",
      description: "raw",
      personName: "Ana Silva",
      count: 3,
      refNames: ["A", "B"],
      exclusive: 1,
    };
    const result = localizeRiskFlag(flag, stubT);
    expect(result.title).toContain("risk.title.person");
    expect(result.description).toContain("risk.desc.personExclusive");
    expect(result.description).toContain('"exclusive":1');
  });

  it("falls back to raw engine text when structured data is missing", () => {
    const flag: RiskFlag = {
      id: "x",
      category: "documentation",
      severity: "medium",
      title: "Raw title",
      description: "Raw description",
    };
    expect(localizeRiskFlag(flag, stubT)).toEqual({
      title: "Raw title",
      description: "Raw description",
    });
  });
});
