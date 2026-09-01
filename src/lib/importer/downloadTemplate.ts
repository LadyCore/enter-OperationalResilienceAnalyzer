import * as XLSX from "xlsx";

/**
 * Official ORA import template. The workbook mirrors the real template file
 * shipped in `public/PLANTILLA DE DATOS.xlsx`:
 *
 *   - Sheet "Organizacion": one row per person, with the exact column set ORA
 *     expects when importing (header order is part of the contract).
 *   - Sheet "Estructura": a quick field reference for whoever prepares the file.
 *
 * This structure must NOT drift from what the importer accepts — it is the
 * source of truth for the downloaded file when the real file cannot be served.
 */

const ORGANIZACION_HEADERS = [
  "Empleado",
  "Legajo",
  "Sector",
  "Responsable",
  "Manager ID",
  "Rol",
  "Role ID",
  "Proceso",
  "Función",
  "Tareas",
  "Competencias",
  "Documentada",
  "Activo",
] as const;

const ESTRUCTURA_HEADERS = ["Campo", "Uso en ORA", "Regla de prueba"] as const;

const ESTRUCTURA_ROWS: string[][] = [
  ["Empleado", "Person (name)", "Nombre no vacío"],
  ["Legajo", "Person identifier", "Único por persona"],
  ["Sector", "Area / department", "Área reutilizable y normalizable"],
  ["Responsable", "Manager (name)", "Nombre del responsable"],
  ["Manager ID", "Manager identifier", "ID de una persona existente; vacío solo para raíz"],
  ["Rol", "Role / job title", "Nombre del rol"],
  ["Role ID", "Role identifier", "Identificador del rol"],
  ["Proceso", "Process", "Proceso reutilizable"],
  ["Función", "Function", "Función reutilizable"],
  ["Tareas", "Tasks", "Múltiples valores separados por ';'"],
  ["Competencias", "Competencies", "Múltiples valores separados por ';'"],
  ["Documentada", "Documented", "Sí / No"],
  ["Activo", "Active", "Sí / No"],
];

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Build a fresh, valid .xlsx workbook with the official template structure. */
function buildTemplateWorkbook(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();

  const organizacion = XLSX.utils.aoa_to_sheet([[...ORGANIZACION_HEADERS]]);
  XLSX.utils.book_append_sheet(workbook, organizacion, "Organizacion");

  const estructura = XLSX.utils.aoa_to_sheet([[...ESTRUCTURA_HEADERS], ...ESTRUCTURA_ROWS]);
  XLSX.utils.book_append_sheet(workbook, estructura, "Estructura");

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

function isRealWorkbook(buffer: ArrayBuffer): boolean {
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    return workbook.SheetNames.includes("Organizacion");
  } catch {
    return false;
  }
}

/** Download the official template as a valid .xlsx file. */
export async function downloadOrganizationTemplate(): Promise<void> {
  let payload: ArrayBuffer | null = null;

  // Prefer the real template file shipped with the project. If the server
  // answers with the SPA page instead of the file (some preview hosts do),
  // fall back to generating an identical valid workbook client-side.
  try {
    const response = await fetch("/PLANTILLA DE DATOS.xlsx");
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      if (isRealWorkbook(buffer)) payload = buffer;
    }
  } catch {
    // network/parse failure → fall through to generation
  }

  if (!payload) {
    payload = buildTemplateWorkbook();
  }

  const blob = new Blob([payload], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "PLANTILLA DE DATOS.xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
