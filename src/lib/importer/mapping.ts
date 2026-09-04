import type { ColumnMapping, ImportField } from "./types";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Keyword lists per ORA field, in Spanish and English. Iteration order matters:
 * more specific identifiers are processed first so e.g. "ResponsableID" maps to
 * managerId and not to responsable.
 */
const KEYWORDS: Partial<Record<ImportField, string[]>> = {
  employeeId: ["legajo", "employeeid", "employee id", "id persona", "identificador persona", "employee code", "codigo empleado", "numero empleado"],
  managerId: ["responsableid", "managerid", "manager id", "id responsable", "supervisorid", "supervisor id", "codigo responsable"],
  roleId: ["rol id", "roleid", "role id", "codigo rol", "puesto id", "cargo id", "id rol", "id puesto"],
  persona: ["empleado", "persona", "nombre", "name", "employee", "colaborador", "staff", "usuario", "full name"],
  responsable: ["responsable", "superior", "manager", "jefe", "leader", "boss", "reporta a", "reports to", "jefe directo", "lider"],
  area: ["sector", "área", "area", "departamento", "department", "division", "gerencia", "unidad", "direccion"],
  rol: ["puesto", "rol", "cargo", "job title", "position", "role", "posicion"],
  proceso: ["proceso", "process", "macroproceso"],
  funcion: ["función", "funcion", "function", "actividad", "proceso interno"],
  tarea: ["tarea", "task", "actividades", "responsabilidades", "tareas", "funciones del puesto"],
  competencia: ["competencia", "competency", "skill", "habilidad", "conocimiento", "knowledge", "competencias", "skills"],
  documentada: ["documentada", "documentado", "documented", "tiene documentacion", "documentacion", "doc"],
  activo: ["activo", "active", "estado", "alta", "baja", "status"],
  criticidad: ["criticidad", "criticality", "critico", "critical", "prioridad", "criticidad tarea"],
  guardiaActiva: ["guardia pasiva", "guardia activa", "on call", "on-call", "guardia", "disponibilidad guardia", "tiene guardia"],
  guardiaModalidad: ["modalidad guardia", "modalidad de guardia", "guardia modalidad", "cobertura guardia", "modalidad on call", "on call modality"],
  guardiaPeriodo: ["turno guardia", "periodo guardia", "período guardia", "periodo de guardia", "turno de guardia", "guardia periodo", "guardia turno", "horario guardia"],
  guardiaTareas: ["tareas de guardia", "capacidades en guardia", "funcion de guardia", "funciones de guardia", "guardia tareas", "on call tasks", "tareas on call"],
  guardiaCompetencias: ["competencias de guardia", "competencias guardia", "guardia competencias", "on call skills", "competencias on call"],
  coverageObjetivo: ["cubre ausencias de", "cubre a", "cobertura ausencias", "cubre vacaciones de", "reemplaza en vacaciones a", "cubre a (legajo", "cubre a persona", "backup de", "cubridor de"],
  coverageRol: ["rol que cubre", "rol cubierto", "puesto que cubre", "cargo que cubre", "funcion que cubre", "coverage role"],
  coverageTareas: ["tareas que cubre", "tareas de cobertura", "tareas cubiertas", "cobertura tareas", "tasks covered", "tasks que cubre"],
  coverageCompetencias: ["competencias de cobertura", "competencias cobertura", "competencias que habilitan la cobertura", "coverage skills", "competencias habilitantes"],
};

export function suggestMapping(columns: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    persona: null,
    employeeId: null,
    area: null,
    responsable: null,
    managerId: null,
    rol: null,
    roleId: null,
    proceso: null,
    funcion: null,
    tarea: null,
    competencia: null,
    documentada: null,
    activo: null,
    criticidad: null,
    guardiaActiva: null,
    guardiaModalidad: null,
    guardiaPeriodo: null,
    guardiaTareas: null,
    guardiaCompetencias: null,
    coverageObjetivo: null,
    coverageRol: null,
    coverageTareas: null,
    coverageCompetencias: null,
  };

  const used = new Set<string>();
  const normalizedHeaders = columns.map((c) => normalize(c));

  for (const field of Object.keys(KEYWORDS) as ImportField[]) {
    const keywords = KEYWORDS[field]!.map(normalize);
    let best: string | null = null;
    let bestScore = 0;

    columns.forEach((column, i) => {
      if (used.has(column)) return;
      const header = normalizedHeaders[i];
      if (!header) return;
      const exact = keywords.includes(header) ? 4 : 0;
      // Only count when the header contains a keyword (e.g. "ID Responsable" -> "responsable").
      // The reverse (keyword containing the header, e.g. "responsableid" vs "Responsable")
      // must NOT score, or a generic header like "Responsable" outranks the exact "Manager ID"
      // for the managerId field and the whole hierarchy validation breaks.
      const contained = keywords.filter((kw) => header.includes(kw)).length;
      const score = contained * 2 + exact;
      if (score > bestScore) {
        bestScore = score;
        best = column;
      }
    });

    if (best && bestScore > 0) {
      mapping[field] = best;
      used.add(best);
    }
  }

  return mapping;
}
