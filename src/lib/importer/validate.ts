import type { Criticality } from "@/types";
import type {
  AmbiguousPersonRef,
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

/** Identity key of a person: the Legajo/employee id when present, else the name. */
function personKey(employeeId?: string, name?: string): string {
  if (employeeId) return `id:${normalize(employeeId)}`;
  return `name:${normalize(name ?? "")}`;
}

/**
 * Validate the parsed flat table against the column mapping.
 *
 * A person is identified by their Legajo/employee id (Manager ID references use
 * it), falling back to their normalized name when no id is present. One person
 * may span several rows — one row per sector/role — so repeated identifiers are
 * NOT duplicates unless a row repeats the exact same signature (area + role +
 * optional on-call/coverage data).
 *
 * Optional per-row data:
 *  - Guardia (passive on-call): when any guardia column is mapped and filled,
 *    the row describes one on-call assignment of this person.
 *  - Coverage (B covers A during A's vacation): when coverage columns are
 *    filled, this person (B) covers the referenced person (A). The covered
 *    person is resolved by Legajo first, then by unique name.
 *
 * `resolutions` maps an ambiguity key (`manager:<row>` / `coverage:<row>`) to
 * the chosen person name, or null to leave it unresolved.
 */
export function validateImport(
  file: ParsedFile,
  mapping: ColumnMapping,
  resolutions: Record<string, string | null> = {},
): NormalizedImport {
  const rows: NormalizedRow[] = [];
  const issues: ValidationSummary["issues"] = [];
  const unusableValues: string[] = [];
  const seenKeys = new Map<string, { name: string; employeeId?: string; rowIndexes: number[] }>();
  let excluded = 0;
  let incomplete = 0;

  const value = (row: Record<string, string>, field: ImportField): string =>
    mapping[field] ? (row[mapping[field]!] ?? "").trim() : "";

  const list = (row: Record<string, string>, field: ImportField): string[] =>
    splitList(value(row, field));

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

    const employeeId = value(row, "employeeId") || undefined;
    const key = personKey(employeeId, persona);
    const existing = seenKeys.get(key);
    if (existing) {
      existing.rowIndexes.push(rows.length);
    } else {
      seenKeys.set(key, { name: persona, employeeId, rowIndexes: [rows.length] });
    }

    const tareas = list(row, "tarea");
    const competencias = list(row, "competencia");
    const activo = parseBool(value(row, "activo"));
    const documentada = parseBool(value(row, "documentada"));
    const criticidad = parseCriticality(value(row, "criticidad"));

    if (value(row, "criticidad") && !criticidad) {
      unusableValues.push(`Row ${sourceRow}: criticality "${value(row, "criticidad")}" is not recognized.`);
    }

    /*
     * Optional guardia (passive on-call) block. The row describes ONE
     * assignment when any guardia column is filled. "hasGuardia" defaults to
     * true when any other guardia value exists; a plain Sí/No with no other
     * data is informational only.
     */
    const guardiaTareas = list(row, "guardiaTareas");
    const guardiaCompetencias = list(row, "guardiaCompetencias");
    const guardiaModalidad = value(row, "guardiaModalidad");
    const guardiaPeriodo = value(row, "guardiaPeriodo");
    const guardiaActivaRaw = value(row, "guardiaActiva");
    const guardiaActiva = parseBool(guardiaActivaRaw);
    const guardiaHasContent =
      Boolean(guardiaActivaRaw || guardiaModalidad || guardiaPeriodo) ||
      guardiaTareas.length > 0 ||
      guardiaCompetencias.length > 0;
    let guardia: NormalizedRow["guardia"];
    if (guardiaHasContent) {
      const hasGuardia = guardiaActiva ?? true;
      if (guardiaActivaRaw && !guardiaActiva) {
        unusableValues.push(
          `Row ${sourceRow}: guardia value "${guardiaActivaRaw}" is not recognized (use Sí/No).`,
        );
      }
      if (hasGuardia) {
        guardia = {
          hasGuardia: true,
          modality: guardiaModalidad || undefined,
          period: guardiaPeriodo || undefined,
          tareas: guardiaTareas,
          competencias: guardiaCompetencias,
        };
      }
      if (guardiaTareas.length > 0 && !guardiaModalidad) {
        issues.push({
          severity: "warning",
          code: "guardia-no-modality",
          message: `Row ${sourceRow}: the person has on-call tasks but no modality was provided — fill H24, Shifts or the organization's own scheme.`,
          row: sourceRow,
        });
      }
    }

    /*
     * Optional coverage block (B covers A during A's vacation). The person in
     * the row is the coverer (B); `coverage.objetivo` references the covered
     * person (A) by Legajo or name.
     */
    const coverageTareas = list(row, "coverageTareas");
    const coverageCompetencias = list(row, "coverageCompetencias");
    const coverageObjetivo = value(row, "coverageObjetivo");
    const coverageRol = value(row, "coverageRol");
    let coverage: NormalizedRow["coverage"];
    if (coverageObjetivo || coverageRol || coverageTareas.length > 0 || coverageCompetencias.length > 0) {
      if (!coverageObjetivo) {
        issues.push({
          severity: "warning",
          code: "coverage-no-target",
          message: `Row ${sourceRow}: coverage data was provided but no covered person was referenced (Cubre ausencias de). The coverage was ignored.`,
          row: sourceRow,
        });
      } else {
        coverage = {
          objetivo: coverageObjetivo,
          rol: coverageRol || undefined,
          tareas: coverageTareas,
          competencias: coverageCompetencias,
        };
      }
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
      guardia,
      coverage,
    });
  });

  /*
   * Possible duplicates: a person spanning several sectors/roles (or adding
   * distinct on-call/coverage data) is valid. Only rows that repeat the exact
   * same signature for the same person are real duplicates and are flagged.
   */
  let possibleDuplicates = 0;
  for (const [key, person] of seenKeys) {
    const signatures = new Set<string>();
    for (const rowIndex of person.rowIndexes) {
      const r = rows[rowIndex];
      const sig = [
        normalize(r.area ?? ""),
        normalize(r.rol ?? ""),
        normalize(r.guardia?.modality ?? ""),
        normalize(r.guardia?.period ?? ""),
        normalize(r.coverage?.objetivo ?? ""),
      ].join("|");
      signatures.add(sig);
    }
    if (signatures.size < person.rowIndexes.length) {
      possibleDuplicates += 1;
      issues.push({
        severity: "warning",
        code: "duplicate-person",
        message: `The person "${person.name}" appears more than once with the same area, role and optional on-call/coverage — possible duplicate.`,
      });
    }
  }

  /*
   * Reference resolution. Two kinds of person-to-person references:
   *  - manager (the row's responsable): resolved by Manager ID first.
   *  - coverage (the row's covered person A): resolved by Legajo first, then name.
   */
  let hierarchyRelations = 0;
  let missingReferences = 0;
  let ambiguousReferences = 0;
  let onCallAssignments = 0;
  let vacationCoverages = 0;
  const ambiguousPersons: AmbiguousPersonRef[] = [];

  const peopleByEmployeeId = new Map<string, string>();
  const peopleByName = new Map<string, string[]>();
  for (const [key, person] of seenKeys) {
    if (person.employeeId) peopleByEmployeeId.set(normalize(person.employeeId), key);
    const nameKey = normalize(person.name);
    peopleByName.set(nameKey, [...(peopleByName.get(nameKey) ?? []), key]);
  }

  const noteAmbiguous = (
    row: NormalizedRow,
    kind: "manager" | "coverage",
    refName: string,
    matches: string[],
  ) => {
    ambiguousReferences += 1;
    ambiguousPersons.push({
      sourceRow: row.sourceRow,
      kind,
      personName: row.persona,
      refName,
      candidates: matches.map((k) => seenKeys.get(k)!.name),
      resolvedTo: null,
    });
    issues.push({
      severity: "error",
      code: kind === "manager" ? "manager-ambiguous" : "coverage-ambiguous",
      message: `Row ${row.sourceRow}: ${refName} matches ${matches.length} people. Review it before importing.`,
      row: row.sourceRow,
    });
  };

  /* ---- Manager resolution (source of truth: Manager ID) ---- */
  for (const row of rows) {
    if (!row.managerId && !row.responsable) continue;
    const selfKey = personKey(row.employeeId, row.persona);
    let resolvedKey: string | null = null;

    if (row.managerId) {
      const targetKey = peopleByEmployeeId.get(normalize(row.managerId));
      if (targetKey && targetKey !== selfKey) {
        resolvedKey = targetKey;
      } else if (!targetKey) {
        missingReferences += 1;
        issues.push({
          severity: "error",
          code: "manager-not-found",
          message: `Row ${row.sourceRow}: manager identifier "${row.managerId}" does not match any imported person.`,
          row: row.sourceRow,
        });
        continue;
      }
    } else if (row.responsable) {
      const matches = (peopleByName.get(normalize(row.responsable)) ?? []).filter(
        (k) => k !== selfKey,
      );
      if (matches.length > 1) {
        noteAmbiguous(row, "manager", row.responsable, matches);
        continue;
      }
      resolvedKey = matches[0] ?? null;
      if (!resolvedKey) {
        missingReferences += 1;
        issues.push({
          severity: "error",
          code: "manager-not-found",
          message: `Row ${row.sourceRow}: manager "${row.responsable}" does not match any imported person.`,
          row: row.sourceRow,
        });
        continue;
      }
    }

    if (resolvedKey) {
      row.managerResolved = seenKeys.get(resolvedKey)!.name;
      row.managerResolvedKey = resolvedKey;
      hierarchyRelations += 1;
    }
  }

  /* ---- Coverage target resolution (B covers A) ---- */
  for (const row of rows) {
    if (!row.coverage) continue;
    const selfKey = personKey(row.employeeId, row.persona);
    const refName = row.coverage.objetivo!;
    let resolvedKey: string | null = null;

    // Legajo wins: an exact employee-id match is unambiguous by construction.
    const byId = peopleByEmployeeId.get(normalize(refName));
    if (byId) {
      if (byId === selfKey) {
        issues.push({
          severity: "warning",
          code: "coverage-self",
          message: `Row ${row.sourceRow}: a person cannot cover their own absence. The coverage was ignored.`,
          row: row.sourceRow,
        });
        row.coverage = undefined;
      } else {
        resolvedKey = byId;
      }
      if (resolvedKey) {
        row.coverage!.objetivoResolved = seenKeys.get(resolvedKey)!.name;
        row.coverage!.objetivoResolvedKey = resolvedKey;
      }
      continue;
    }

    // Fallback: unique normalized name.
    const matches = (peopleByName.get(normalize(refName)) ?? []).filter((k) => k !== selfKey);
    if (matches.length > 1) {
      noteAmbiguous(row, "coverage", refName, matches);
      continue;
    }
    resolvedKey = matches[0] ?? null;
    if (resolvedKey) {
      row.coverage.objetivoResolved = seenKeys.get(resolvedKey)!.name;
      row.coverage.objetivoResolvedKey = resolvedKey;
    } else {
      missingReferences += 1;
      issues.push({
        severity: "error",
        code: "coverage-not-found",
        message: `Row ${row.sourceRow}: the covered person "${refName}" does not match any imported person.`,
        row: row.sourceRow,
      });
    }
  }

  /* ---- Apply user resolutions to ambiguous references ---- */
  for (const ref of ambiguousPersons) {
    const choice = resolutions[`${ref.kind}:${ref.sourceRow}`];
    if (choice && ref.candidates.includes(choice)) {
      ref.resolvedTo = choice;
      const target = rows.find((r) => r.sourceRow === ref.sourceRow);
      if (target) {
        const keyOf = (name: string): string | null => {
          for (const [k, person] of seenKeys) {
            if (normalize(person.name) === normalize(name)) return k;
          }
          return null;
        };
        const chosenKey = keyOf(choice);
        if (ref.kind === "manager" && chosenKey) {
          target.managerResolved = choice;
          target.managerResolvedKey = chosenKey;
          hierarchyRelations += 1;
        } else if (ref.kind === "coverage" && target.coverage && chosenKey) {
          target.coverage.objetivoResolved = choice;
          target.coverage.objetivoResolvedKey = chosenKey;
        }
      }
      ambiguousReferences -= 1;
    }
  }

  /* Drop the error issues of references the user already resolved. */
  const resolvedRows = new Set(
    ambiguousPersons.filter((r) => r.resolvedTo).map((r) => `${r.kind}:${r.sourceRow}`),
  );
  const remaining = issues.filter((i) => {
    if (i.row === undefined) return true;
    if (i.code === "manager-ambiguous") return !resolvedRows.has(`manager:${i.row}`);
    if (i.code === "coverage-ambiguous") return !resolvedRows.has(`coverage:${i.row}`);
    return true;
  });
  issues.splice(0, issues.length, ...remaining);

  /* ---- Counts ---- */
  const guardSignatures = new Set<string>();
  const coverageSignatures = new Set<string>();
  for (const row of rows) {
    if (row.guardia) {
      guardSignatures.add(
        [
          personKey(row.employeeId, row.persona),
          normalize(row.guardia.modality ?? ""),
          normalize(row.guardia.period ?? ""),
          row.guardia.tareas.map(normalize).join(","),
          row.guardia.competencias.map(normalize).join(","),
        ].join("|"),
      );
    }
    if (row.coverage && row.coverage.objetivoResolvedKey) {
      coverageSignatures.add(
        [
          personKey(row.employeeId, row.persona),
          row.coverage.objetivoResolvedKey,
          row.coverage.tareas.map(normalize).join(","),
          row.coverage.competencias.map(normalize).join(","),
        ].join("|"),
      );
    }
  }
  onCallAssignments = guardSignatures.size;
  vacationCoverages = coverageSignatures.size;

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
    people: seenKeys.size,
    areas,
    roles,
    processes,
    functions,
    tasks,
    competencies,
    hierarchyRelations,
    onCallAssignments,
    vacationCoverages,
    incompleteRows: incomplete,
    possibleDuplicates,
    missingReferences,
    ambiguousReferences,
    unmappedColumns,
    unusableValues,
    issues,
    ambiguousPersons,
    blocking,
  };

  return { rows, summary };
}
