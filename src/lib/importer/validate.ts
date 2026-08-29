import type { Criticality } from "@/types";
import type {
  AmbiguousManagerRef,
  ColumnMapping,
  ImportField,
  NormalizedImport,
  NormalizedRow,
  ParsedFile,
  ValidationSummary,
} from "./types";

const normalize = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const splitList = (value?: string): string[] =>
  (value ?? "")
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean);

const parseBool = (value?: string): boolean | undefined => {
  if (!value) return undefined;
  const v = normalize(value);
  if (["si", "sí", "yes", "true", "1", "activo", "active", "alta", "documentada", "documentado", "documented"].includes(v)) {
    return true;
  }
  if (["no", "false", "0", "inactivo", "inactive", "baja"].includes(v)) {
    return false;
  }
  return undefined;
};

const parseCriticality = (value?: string): Criticality | undefined => {
  if (!value) return undefined;
  const v = normalize(value);
  if (["critical", "critico", "crítico", "alta", "alto", "1", "c"].includes(v)) return "critical";
  if (["important", "importante", "media", "2", "i"].includes(v)) return "important";
  if (["standard", "normal", "estandar", "estándar", "baja", "bajo", "3", "s"].includes(v)) return "standard";
  return undefined;
};

/**
 * Validate the parsed flat table against the column mapping.
 * Strict rule: one row = one person. Rows without a person name are excluded
 * and counted as incomplete; repeated names are flagged as possible duplicates.
 *
 * `resolutions` maps a source row (ambiguous manager reference) to the chosen
 * person name, or null to leave it unresolved.
 */
export function validateImport(
  file: ParsedFile,
  mapping: ColumnMapping,
  resolutions: Record<number, string | null> = {},
): NormalizedImport {
  const rows: NormalizedRow[] = [];
  const issues: ValidationSummary["issues"] = [];
  const unusableValues: string[] = [];
  const seenNames = new Map<string, number>();
  const seenEmployeeIds = new Map<string, number>();
  let excluded = 0;
  let incomplete = 0;

  const value = (row: Record<string, string>, field: ImportField): string =>
    mapping[field] ? (row[mapping[field]!] ?? "").trim() : "";

  file.rows.forEach((row, idx) => {
    const sourceRow = idx + 2; // 1-based, header is row 1
    const persona = value(row, "persona");

    if (!persona) {
      excluded += 1;
      incomplete += 1;
      issues.push({
        severity: "warning",
        code: "missing-person",
        message: `Row ${sourceRow} has no person name and was excluded.`,
        row: sourceRow,
      });
      return;
    }

    const nameKey = normalize(persona);
    seenNames.set(nameKey, (seenNames.get(nameKey) ?? 0) + 1);

    const employeeId = value(row, "employeeId") || undefined;
    if (employeeId) {
      seenEmployeeIds.set(normalize(employeeId), (seenEmployeeIds.get(normalize(employeeId)) ?? 0) + 1);
    }

    const tareas = splitList(value(row, "tarea"));
    const competencias = splitList(value(row, "competencia"));
    const activo = parseBool(value(row, "activo"));
    const documentada = parseBool(value(row, "documentada"));
    const criticidad = parseCriticality(value(row, "criticidad"));

    if (value(row, "criticidad") && !criticidad) {
      unusableValues.push(`Row ${sourceRow}: criticality "${value(row, "criticidad")}" is not recognized.`);
    }

    const hasContent =
      tareas.length > 0 ||
      competencias.length > 0 ||
      Boolean(
        value(row, "area") ||
          value(row, "rol") ||
          value(row, "proceso") ||
          value(row, "funcion") ||
          value(row, "responsable") ||
          value(row, "managerId"),
      );
    if (!hasContent) incomplete += 1;

    rows.push({
      sourceRow,
      persona,
      employeeId,
      area: value(row, "area") || undefined,
      rol: value(row, "rol") || undefined,
      roleId: value(row, "roleId") || undefined,
      proceso: value(row, "proceso") || undefined,
      funcion: value(row, "funcion") || undefined,
      tareas,
      competencias,
      documentada,
      activo,
      criticidad,
      responsable: value(row, "responsable") || undefined,
      managerId: value(row, "managerId") || undefined,
    });
  });

  /* Possible duplicates — flagged, never silently ignored */
  let possibleDuplicates = 0;
  for (const [name, count] of seenNames) {
    if (count > 1) {
      possibleDuplicates += 1;
      issues.push({
        severity: "warning",
        code: "duplicate-person",
        message: `The person "${name}" appears in ${count} rows — possible duplicate.`,
      });
    }
  }
  const duplicatedEmployeeIds = new Set(
    [...seenEmployeeIds.entries()].filter(([, c]) => c > 1).map(([id]) => id),
  );

  /* Manager resolution: by source identifier first, then by name. */
  let hierarchyRelations = 0;
  let missingReferences = 0;
  let ambiguousReferences = 0;
  const ambiguousManagers: AmbiguousManagerRef[] = [];

  for (const row of rows) {
    if (!row.managerId && !row.responsable) continue;

    const managerIdRaw = row.managerId;
    const managerName = row.responsable;
    let resolved: string | null = null;

    if (managerIdRaw) {
      const matches = rows.filter(
        (r) => r.employeeId && normalize(r.employeeId) === normalize(managerIdRaw),
      );
      const isDuplicateId = duplicatedEmployeeIds.has(normalize(managerIdRaw));
      if (isDuplicateId || matches.length > 1) {
        ambiguousReferences += 1;
        ambiguousManagers.push({
          sourceRow: row.sourceRow,
          personName: row.persona,
          managerName: managerIdRaw,
          candidates: [...new Set(matches.map((m) => m.persona))],
          resolvedTo: null,
        });
        issues.push({
          severity: "error",
          code: "manager-ambiguous",
          message: `Row ${row.sourceRow}: manager identifier "${managerIdRaw}" is ambiguous. Review it before importing.`,
          row: row.sourceRow,
        });
        continue;
      }
      if (matches.length === 1) {
        resolved = matches[0].persona;
      } else {
        missingReferences += 1;
        issues.push({
          severity: "error",
          code: "manager-not-found",
          message: `Row ${row.sourceRow}: manager identifier "${managerIdRaw}" does not match any imported person.`,
          row: row.sourceRow,
        });
        continue;
      }
    } else if (managerName) {
      const matches = rows.filter(
        (r) => r.persona !== row.persona && normalize(r.persona) === normalize(managerName),
      );
      if (matches.length > 1) {
        ambiguousReferences += 1;
        ambiguousManagers.push({
          sourceRow: row.sourceRow,
          personName: row.persona,
          managerName,
          candidates: matches.map((m) => m.persona),
          resolvedTo: null,
        });
        issues.push({
          severity: "error",
          code: "manager-ambiguous",
          message: `Row ${row.sourceRow}: manager "${managerName}" matches ${matches.length} people. Review it before importing.`,
          row: row.sourceRow,
        });
        continue;
      }
      if (matches.length === 1) {
        resolved = matches[0].persona;
      } else {
        missingReferences += 1;
        issues.push({
          severity: "error",
          code: "manager-not-found",
          message: `Row ${row.sourceRow}: manager "${managerName}" does not match any imported person.`,
          row: row.sourceRow,
        });
        continue;
      }
    }

    if (resolved) {
      row.managerResolved = resolved;
      hierarchyRelations += 1;
    }
  }

  /* Apply user resolutions to ambiguous references */
  for (const ref of ambiguousManagers) {
    const choice = resolutions[ref.sourceRow];
    if (choice && ref.candidates.includes(choice)) {
      ref.resolvedTo = choice;
      const target = rows.find((r) => r.sourceRow === ref.sourceRow);
      if (target) target.managerResolved = choice;
      hierarchyRelations += 1;
      ambiguousReferences -= 1;
    }
  }

  /* Drop the error issues of references the user already resolved. */
  const resolvedRows = new Set(
    ambiguousManagers.filter((r) => r.resolvedTo).map((r) => r.sourceRow),
  );
  if (resolvedRows.size > 0) {
    const remaining = issues.filter(
      (i) => !(i.code === "manager-ambiguous" && i.row !== undefined && resolvedRows.has(i.row)),
    );
    issues.splice(0, issues.length, ...remaining);
  }

  const areas = new Set(rows.map((r) => r.area).filter(Boolean)).size;
  const roles = new Set(rows.map((r) => r.rol).filter(Boolean)).size;
  const processes = new Set(rows.map((r) => r.proceso).filter(Boolean)).size;
  const functions = new Set(
    rows.map((r) => (r.funcion ? `${r.proceso ?? ""}::${r.funcion}` : "")).filter(Boolean),
  ).size;
  const tasks = new Set(rows.flatMap((r) => r.tareas)).size;
  const competencies = new Set(rows.flatMap((r) => r.competencias)).size;

  const mappedColumns = Object.values(mapping).filter((c): c is string => Boolean(c));
  const unmappedColumns = file.columns.filter((c) => !mappedColumns.includes(c));

  const blocking = ambiguousReferences > 0 || missingReferences > 0;

  const summary: ValidationSummary = {
    totalRows: file.rows.length,
    excludedRows: excluded,
    people: rows.length,
    areas,
    roles,
    processes,
    functions,
    tasks,
    competencies,
    hierarchyRelations,
    incompleteRows: incomplete,
    possibleDuplicates,
    missingReferences,
    ambiguousReferences,
    unmappedColumns,
    unusableValues,
    issues,
    ambiguousManagers,
    blocking,
  };

  return { rows, summary };
}
