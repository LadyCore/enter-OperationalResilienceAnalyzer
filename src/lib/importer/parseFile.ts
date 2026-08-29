import * as XLSX from "xlsx";
import type { ParsedFile } from "./types";

/**
 * Parse the first sheet of an Excel/CSV file. The first row is treated as the
 * header; each following row becomes a { column: value } record.
 */
export async function parseWorkbookFile(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  if (workbook.SheetNames.length === 0) {
    throw new Error("The file has no sheets.");
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (matrix.length === 0) {
    throw new Error("The sheet is empty.");
  }

  const header = matrix[0].map((cell) => String(cell ?? "").trim());
  if (header.every((h) => !h)) {
    throw new Error("The first row must contain column headers.");
  }

  const rows: ParsedFile["rows"] = [];
  matrix.slice(1).forEach((raw) => {
    const record: Record<string, string> = {};
    header.forEach((h, i) => {
      const cell = raw[i];
      record[h] = cell !== undefined && cell !== null ? String(cell).trim() : "";
    });
    if (Object.values(record).some((v) => v !== "")) {
      rows.push(record);
    }
  });

  return { columns: header, rows };
}
