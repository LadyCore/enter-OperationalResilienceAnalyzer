import type { ImportField } from "@/lib/importer/types";

/**
 * Static i18n keys for import field labels — translate at render time with t().
 * The ImportField code is what gets stored/parsed; only the label is localized.
 */
export const importFieldLabelKeys: Record<ImportField, string> = {
  persona: "importField.persona",
  employeeId: "importField.employeeId",
  area: "importField.area",
  responsable: "importField.responsable",
  managerId: "importField.managerId",
  rol: "importField.rol",
  roleId: "importField.roleId",
  proceso: "importField.proceso",
  funcion: "importField.funcion",
  tarea: "importField.tarea",
  competencia: "importField.competencia",
  documentada: "importField.documentada",
  activo: "importField.activo",
  criticidad: "importField.criticidad",
  guardiaActiva: "importField.guardiaActiva",
  guardiaModalidad: "importField.guardiaModalidad",
  guardiaPeriodo: "importField.guardiaPeriodo",
  guardiaTareas: "importField.guardiaTareas",
  guardiaCompetencias: "importField.guardiaCompetencias",
  coverageObjetivo: "importField.coverageObjetivo",
  coverageRol: "importField.coverageRol",
  coverageTareas: "importField.coverageTareas",
  coverageCompetencias: "importField.coverageCompetencias",
};
