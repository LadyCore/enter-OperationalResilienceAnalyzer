import * as XLSX from "xlsx";
import JSZip from "jszip";

/**
 * Official ORA import template — generated as a real, formatted XLSX.
 *
 * Data contract (unchanged, must never drift from what the importer accepts):
 *   - Sheet 1 "Organizacion": one row per person, header row first, with the
 *     exact column set and order the parser expects.
 *   - Multi-value cells (Tareas, Competencias) separated by ";".
 *   - Sheet 2 "Instrucciones": brief how-to, ignored by the parser (the importer
 *     reads only the FIRST sheet).
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
  "Guardia pasiva",
  "Modalidad guardia",
  "Turno/Período guardia",
  "Tareas de guardia",
  "Competencias de guardia",
  "Cubre ausencias de",
  "Rol que cubre",
  "Tareas que cubre",
  "Competencias de cobertura",
] as const;

/** Fictional, clearly-marked example rows — never real data. */
const EXAMPLE_ROWS: string[][] = [
  [
    "EJEMPLO: Ana García",
    "EMP-0001",
    "Tecnología",
    "",
    "",
    "Jefe de Área",
    "ROL-001",
    "Gestión Tecnológica",
    "Controlar operaciones",
    "Planificación operativa; Soporte interno",
    "Análisis; Comunicación",
    "Sí",
    "Sí",
    "Sí",
    "H24",
    "H24",
    "Controlar operaciones",
    "Análisis",
    "",
    "",
    "",
    "",
  ],
  [
    "EJEMPLO: Juan Pérez",
    "EMP-0002",
    "Administración",
    "Ana García",
    "EMP-0001",
    "Analista",
    "ROL-002",
    "Gestión Documental",
    "Gestionar solicitudes",
    "Control de documentación; Seguimiento de expedientes",
    "Organización; Excel",
    "No",
    "Sí",
    "",
    "",
    "",
    "",
    "",
    "EMP-0001",
    "Jefe de Área",
    "Planificación operativa",
    "Comunicación",
  ],
];

const INSTRUCCIONES_HEADERS = ["Campo", "¿Qué es?", "¿Necesario?", "Ejemplo válido"];

const INSTRUCCIONES_ROWS: string[][] = [
  ["Empleado", "Nombre de la persona. Una fila = una persona.", "Sí", "Ana García"],
  ["Legajo", "Identificador único de la persona (si la organización lo usa).", "Recomendado", "EMP-0001"],
  ["Sector", "Área o departamento. Se reutiliza y normaliza.", "No", "Tecnología"],
  ["Responsable", "Nombre del responsable. Debe existir en el archivo.", "No", "Ana García"],
  ["Manager ID", "Identificador del responsable. Vacío solo para la raíz de la jerarquía.", "No", "EMP-0001"],
  ["Rol", "Puesto o rol del puesto.", "No", "Jefe de Área"],
  ["Role ID", "Identificador del rol.", "No", "ROL-001"],
  ["Proceso", "Proceso al que pertenece la tarea. Se reutiliza.", "No", "Gestión Tecnológica"],
  ["Función", "Función dentro del proceso.", "No", "Controlar operaciones"],
  ["Tareas", "Tareas de la persona. Varios valores separados por ;", "No", "Planificación operativa; Soporte interno"],
  ["Competencias", "Competencias de la persona. Varios valores separados por ;", "No", "Análisis; Comunicación"],
  ["Documentada", "¿La tarea está documentada? Valores admitidos: Sí / No.", "No", "Sí"],
  ["Activo", "¿La persona está activa? Valores admitidos: Sí / No.", "No", "Sí"],
  ["Guardia pasiva", "¿La persona está en guardia pasiva (on-call)? Vacío = sin guardia. Campos opcionales.", "No", "Sí"],
  ["Modalidad guardia", "Esquema de cobertura, texto libre: H24, turnos u otro propio.", "No", "H24"],
  ["Turno/Período guardia", "Turno o período, texto libre (no se impone una estructura fija).", "No", "Noche"],
  ["Tareas de guardia", "Funciones/capacidades cubiertas en guardia (tareas existentes, ;).", "No", "Controlar operaciones"],
  ["Competencias de guardia", "Competencias que habilitan la guardia (;).", "No", "Análisis"],
  ["Cubre ausencias de", "La persona de esta fila cubre vacaciones de la persona referida (Legajo o nombre).", "No", "EMP-0001"],
  ["Rol que cubre", "Rol/puesto cubierto durante la ausencia (opcional).", "No", "Jefe de Área"],
  ["Tareas que cubre", "Tareas concretas que puede realizar durante la ausencia (;).", "No", "Planificación operativa"],
  ["Competencias de cobertura", "Competencias que habilitan esa cobertura (;).", "No", "Comunicación"],
];

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const HEADER_FILL = "1F4E79"; // dark blue
const HEADER_FONT = { color: { rgb: "FFFFFFFF" }, bold: true, sz: 11 };
const EXAMPLE_FILL = "FFF2CC"; // light yellow (clearly an example)
const EXAMPLE_FONT = { italic: true, color: { rgb: "FF7F6000" } };

const HEADER_ALIGN = { horizontal: "center" as const, vertical: "center" as const, wrapText: true };
const WRAP_ALIGN = { vertical: "top" as const, wrapText: true };

const COL_WIDTHS = [20, 12, 16, 18, 14, 16, 12, 22, 24, 34, 30, 12, 10, 12, 14, 16, 24, 24, 18, 16, 26, 26];

function cellStyle(opts: {
  fill?: string;
  font?: Record<string, unknown>;
  align?: Record<string, unknown>;
  border?: boolean;
}) {
  const style: Record<string, unknown> = {};
  if (opts.fill) {
    style.fill = { fgColor: { rgb: opts.fill } };
  }
  if (opts.font) style.font = opts.font;
  if (opts.align) style.alignment = opts.align;
  if (opts.border) {
    const side = { style: "thin" as const, color: { rgb: "FFBFBFBF" } };
    style.border = { top: side, bottom: side, left: side, right: side };
  }
  return style;
}

function buildOrganizacionSheet(): XLSX.WorkSheet {
  const rows: string[][] = [ [...ORGANIZACION_HEADERS], ...EXAMPLE_ROWS ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = COL_WIDTHS.map((wch) => ({ wch }));
  ws["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(ORGANIZACION_HEADERS.length - 1)}${rows.length}` };

  // Header styling
  ORGANIZACION_HEADERS.forEach((_, i) => {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
    if (cell) cell.s = cellStyle({ fill: HEADER_FILL, font: HEADER_FONT, align: HEADER_ALIGN, border: true });
  });
  // Example rows styling + fixed height for wrapped text
  EXAMPLE_ROWS.forEach((_, rIdx) => {
    const r = rIdx + 1;
    ORGANIZACION_HEADERS.forEach((_, cIdx) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c: cIdx })];
      if (cell) {
        cell.s = cellStyle({ fill: EXAMPLE_FILL, font: EXAMPLE_FONT, align: WRAP_ALIGN, border: true });
      }
    });
  });

  return ws;
}

function buildInstruccionesSheet(): XLSX.WorkSheet {
  const rows: string[][] = [
    [
      "PLANTILLA ORA — INSTRUCCIONES",
      "",
      "",
      "Una fila = una persona. Valores múltiples separados por ;",
    ],
    [...INSTRUCCIONES_HEADERS],
    ...INSTRUCCIONES_ROWS,
    [],
    ["Las filas 'EJEMPLO:' son ficticias. Reemplazalas con datos reales o eliminálas antes de importar.", "", "", ""],
    ["Revisá el mapeo automático de columnas y los errores/advertencias de validación antes de confirmar.", "", "", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [20, 46, 14, 40];

  // Title row
  const title = ws["A1"];
  if (title) title.s = cellStyle({ fill: HEADER_FILL, font: { color: { rgb: "FFFFFFFF" }, bold: true, sz: 13 }, border: true });
  // Header row (row 3 in 1-indexed = r 2)
  INSTRUCCIONES_HEADERS.forEach((_, i) => {
    const cell = ws[XLSX.utils.encode_cell({ r: 2, c: i })];
    if (cell) cell.s = cellStyle({ fill: HEADER_FILL, font: HEADER_FONT, align: HEADER_ALIGN, border: true });
  });
  INSTRUCCIONES_ROWS.forEach((_, rIdx) => {
    const r = rIdx + 3;
    INSTRUCCIONES_HEADERS.forEach((_, cIdx) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c: cIdx })];
      if (cell) cell.s = cellStyle({ align: WRAP_ALIGN, border: true });
    });
  });
  // Note rows styling
  [[5, 0], [6, 0]].forEach(([r, c]) => {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell) cell.s = cellStyle({ font: { italic: true }, align: WRAP_ALIGN });
  });

  return ws;
}

/**
 * Build a formatted, valid .xlsx template with two sheets: "Organizacion"
 * (the data template) and "Instrucciones" (how to fill it in).
 */
export function buildTemplateWorkbook(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildOrganizacionSheet(), "Organizacion");
  XLSX.utils.book_append_sheet(workbook, buildInstruccionesSheet(), "Instrucciones");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

/**
 * Freeze the first row of the Organizacion sheet. SheetJS CE does not emit the
 * <pane> element, so we post-process the XLSX package (a ZIP) with JSZip.
 */
async function freezeFirstRow(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);
  const sheetPath = "xl/worksheets/sheet1.xml";
  const xml = await zip.file(sheetPath)?.async("string");
  if (!xml) return buffer;

  const frozen = xml.replace(
    /<sheetView workbookViewId="0"\/>/,
    '<sheetView workbookViewId="0" tabSelected="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView>'
  );
  zip.file(sheetPath, frozen);
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

function isRealWorkbook(buffer: ArrayBuffer): boolean {
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    return workbook.SheetNames.includes("Organizacion");
  } catch {
    return false;
  }
}

/**
 * Download the official ORA template as a valid, formatted .xlsx file.
 * Prefers the real template file shipped with the project; if the server
 * answers with the SPA page instead of the file (some preview hosts do),
 * it falls back to the client-side generated workbook.
 */
export async function downloadOrganizationTemplate(): Promise<void> {
  let payload: ArrayBuffer | null = null;

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
    try {
      payload = await freezeFirstRow(payload);
    } catch {
      // freezing is cosmetic; keep the valid workbook if post-processing fails
    }
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
