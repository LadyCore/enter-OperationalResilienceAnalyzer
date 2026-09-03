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
  | "criticidad";

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
}

/** An ambiguous manager reference that the user must resolve before importing. */
export interface AmbiguousManagerRef {
  sourceRow: number;
  personName: string;
  managerName: string;
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
  incompleteRows: number;
  possibleDuplicates: number;
  missingReferences: number;
  ambiguousReferences: number;
  unmappedColumns: string[];
  unusableValues: string[];
  issues: ImportIssue[];
  ambiguousManagers: AmbiguousManagerRef[];
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
}

export interface NormalizedImport {
  rows: NormalizedRow[];
  summary: ValidationSummary;
}
