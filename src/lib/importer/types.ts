import type { Criticality } from "@/types";

/** ORA fields that can be mapped from source columns. */
export type ImportField =
  | "persona"
  | "employeeId"
  | "area"
  | "responsable"
  | "managerId"
  | "rol"
  | "roleId"
  | "proceso"
  | "funcion"
  | "tarea"
  | "competencia"
  | "documentada"
  | "activo"
  | "criticidad"
  | "guardiaActiva"
  | "guardiaModalidad"
  | "guardiaPeriodo"
  | "guardiaTareas"
  | "guardiaCompetencias"
  | "coverageObjetivo"
  | "coverageRol"
  | "coverageTareas"
  | "coverageCompetencias";

export const IMPORT_FIELDS: ImportField[] = [
  "persona",
  "employeeId",
  "area",
  "responsable",
  "managerId",
  "rol",
  "roleId",
  "proceso",
  "funcion",
  "tarea",
  "competencia",
  "documentada",
  "activo",
  "criticidad",
  "guardiaActiva",
  "guardiaModalidad",
  "guardiaPeriodo",
  "guardiaTareas",
  "guardiaCompetencias",
  "coverageObjetivo",
  "coverageRol",
  "coverageTareas",
  "coverageCompetencias",
];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  persona: "Person (name)",
  employeeId: "Person identifier",
  area: "Area / department",
  responsable: "Manager (name)",
  managerId: "Manager identifier",
  rol: "Role / job title",
  roleId: "Role identifier",
  proceso: "Process",
  funcion: "Function",
  tarea: "Tasks",
  competencia: "Competencies",
  documentada: "Documented",
  activo: "Active",
  criticidad: "Criticality",
  guardiaActiva: "On-call (guardia) — has passive on-call?",
  guardiaModalidad: "On-call modality (free text: H24, Shifts…)",
  guardiaPeriodo: "On-call shift / period (free text)",
  guardiaTareas: "On-call capabilities (task names, ;)",
  guardiaCompetencias: "On-call enabling competencies (;)",
  coverageObjetivo: "Covers vacations of (Legajo/name of the absent person)",
  coverageRol: "Covered role (optional)",
  coverageTareas: "Tasks covered during the absence (;)",
  coverageCompetencias: "Competencies enabling the coverage (;)",
};

export type ColumnMapping = Record<ImportField, string | null>;

export function emptyMapping(): ColumnMapping {
  return {
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
}

export interface ParsedFile {
  columns: string[];
  rows: Record<string, string>[];
}

export type ImportIssueSeverity = "error" | "warning";

export interface ImportIssue {
  severity: ImportIssueSeverity;
  code: string;
  message: string;
  row?: number;
  /** Raw value the engine could not interpret (e.g. an unrecognized criticality). */
  value?: string;
  /** Person name referenced by the message (duplicate / manager by name). */
  name?: string;
  /** Referenced person name for ambiguous/not-found messages. */
  refName?: string;
  /** Match count for ambiguous references. */
  count?: number;
}

/** An ambiguous person reference that the user must resolve before importing. */
export interface AmbiguousPersonRef {
  sourceRow: number;
  /** "manager" when the row's manager is ambiguous, "coverage" for the covered person. */
  kind: "manager" | "coverage";
  personName: string;
  refName: string;
  candidates: string[];
  resolvedTo: string | null;
}

export interface ValidationSummary {
  totalRows: number;
  excludedRows: number;
  people: number;
  areas: number;
  roles: number;
  processes: number;
  functions: number;
  tasks: number;
  competencies: number;
  hierarchyRelations: number;
  onCallAssignments: number;
  vacationCoverages: number;
  incompleteRows: number;
  possibleDuplicates: number;
  missingReferences: number;
  ambiguousReferences: number;
  unmappedColumns: string[];
  unusableValues: string[];
  issues: ImportIssue[];
  ambiguousPersons: AmbiguousPersonRef[];
  /** True when error-level issues remain and the import must not be confirmed. */
  blocking: boolean;
}

/** Normalized per-person record produced by validation. */
export interface NormalizedRow {
  sourceRow: number;
  persona: string;
  employeeId?: string;
  area?: string;
  rol?: string;
  roleId?: string;
  proceso?: string;
  funcion?: string;
  tareas: string[];
  competencias: string[];
  documentada?: boolean;
  activo?: boolean;
  criticidad?: Criticality;
  responsable?: string;
  managerId?: string;
  /** Resolved manager person name (by id, unique name, or user override). */
  managerResolved?: string;
  /** Identity key of the resolved manager (id:legajo / name:name), when known. */
  managerResolvedKey?: string;
  /** Optional passive on-call (guardia) data carried by this row. */
  guardia?: {
    hasGuardia?: boolean;
    modality?: string;
    period?: string;
    tareas: string[];
    competencias: string[];
  };
  /** Optional vacation-coverage data: this person (B) covers the referenced person (A). */
  coverage?: {
    /** Legajo or name of the covered person (A). */
    objetivo?: string;
    rol?: string;
    tareas: string[];
    competencias: string[];
    /** Resolved covered person name (by id, unique name, or user override). */
    objetivoResolved?: string;
    /** Identity key of the resolved covered person, when known. */
    objetivoResolvedKey?: string;
  };
}

export interface NormalizedImport {
  rows: NormalizedRow[];
  summary: ValidationSummary;
}
