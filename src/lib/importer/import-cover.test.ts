import { describe, expect, it } from "vitest";
import type { ColumnMapping, ParsedFile } from "@/lib/importer/types";
import { validateImport } from "@/lib/importer/validate";
import { buildOrganization } from "@/lib/importer/buildOrganization";

function makeMapping(): ColumnMapping {
  return {
    persona: "Empleado",
    employeeId: "Legajo",
    area: "Sector",
    responsable: "Responsable",
    managerId: "Manager ID",
    rol: "Rol",
    roleId: null,
    proceso: "Proceso",
    funcion: "Función",
    tarea: "Tareas",
    competencia: "Competencias",
    documentada: "Documentada",
    activo: "Activo",
    criticidad: null,
    guardiaActiva: "Guardia pasiva",
    guardiaModalidad: "Modalidad guardia",
    guardiaPeriodo: "Turno guardia",
    guardiaTareas: "Tareas de guardia",
    guardiaCompetencias: "Competencias de guardia",
    coverageObjetivo: "Cubre ausencias de",
    coverageRol: "Rol que cubre",
    coverageTareas: "Tareas que cubre",
    coverageCompetencias: "Competencias de cobertura",
  };
}

const baseFile: ParsedFile = {
  columns: [
    "Empleado",
    "Legajo",
    "Sector",
    "Responsable",
    "Manager ID",
    "Rol",
    "Proceso",
    "Función",
    "Tareas",
    "Competencias",
    "Documentada",
    "Activo",
    "Guardia pasiva",
    "Modalidad guardia",
    "Turno guardia",
    "Tareas de guardia",
    "Competencias de guardia",
    "Cubre ausencias de",
    "Rol que cubre",
    "Tareas que cubre",
    "Competencias de cobertura",
  ],
  rows: [
    {
      Empleado: "Ana García",
      Legajo: "100",
      Sector: "IT",
      Responsable: "",
      "Manager ID": "",
      Rol: "Sysadmin",
      Proceso: "IT Ops",
      Función: "Infra",
      Tareas: "Parchear servidores; Monitorear",
      Competencias: "Linux; Redes",
      Documentada: "Sí",
      Activo: "Sí",
      "Guardia pasiva": "",
      "Modalidad guardia": "",
      "Turno guardia": "",
      "Tareas de guardia": "",
      "Competencias de guardia": "",
      "Cubre ausencias de": "",
      "Rol que cubre": "",
      "Tareas que cubre": "",
      "Competencias de cobertura": "",
    },
    {
      Empleado: "Bruno Costa",
      Legajo: "101",
      Sector: "IT",
      Responsable: "Ana García",
      "Manager ID": "100",
      Rol: "DBA",
      Proceso: "IT Ops",
      Función: "Data",
      Tareas: "Monitorear",
      Competencias: "Bases de datos",
      Documentada: "No",
      Activo: "Sí",
      "Guardia pasiva": "Sí",
      "Modalidad guardia": "H24",
      "Turno guardia": "H24",
      "Tareas de guardia": "Parchear servidores",
      "Competencias de guardia": "Linux",
      "Cubre ausencias de": "100",
      "Rol que cubre": "Sysadmin",
      "Tareas que cubre": "Parchear servidores",
      "Competencias de cobertura": "Linux",
    },
  ],
};

describe("optional on-call and vacation-coverage columns", () => {
  it("empty optional columns import cleanly (no errors/warnings) and build no relations", () => {
    const file: ParsedFile = {
      ...baseFile,
      rows: [baseFile.rows[0]],
    };
    const normalized = validateImport(file, makeMapping());
    expect(normalized.summary.blocking).toBe(false);
    expect(normalized.summary.onCallAssignments).toBe(0);
    expect(normalized.summary.vacationCoverages).toBe(0);
    expect(normalized.summary.issues.length).toBe(0);

    const db = buildOrganization("Test", "", normalized);
    expect(db.onCallAssignments).toHaveLength(0);
    expect(db.vacationCoverages).toHaveLength(0);
  });

  it("maps guardia + coverage rows into the new collections", () => {
    const normalized = validateImport(baseFile, makeMapping());
    expect(normalized.summary.blocking).toBe(false);
    expect(normalized.summary.onCallAssignments).toBe(1);
    expect(normalized.summary.vacationCoverages).toBe(1);

    const db = buildOrganization("Test", "", normalized);
    // Person + on-call assignment, referencing the existing task.
    expect(db.onCallAssignments).toHaveLength(1);
    const oc = db.onCallAssignments[0];
    const bruno = db.people.find((p) => p.name === "Bruno Costa")!;
    expect(oc.personId).toBe(bruno.id);
    expect(oc.modality).toBe("H24");
    const patched = db.tasks.find((t) => t.name === "Parchear servidores")!;
    expect(oc.taskIds).toContain(patched.id);
    expect(oc.competencyIds).toContain(
      db.competencies.find((c) => c.name === "Linux")!.id,
    );

    // Vacation coverage: Bruno (row) covers Ana (legajo 100).
    expect(db.vacationCoverages).toHaveLength(1);
    const vc = db.vacationCoverages[0];
    const ana = db.people.find((p) => p.name === "Ana García")!;
    expect(vc.coveringPersonId).toBe(bruno.id);
    expect(vc.coveredPersonId).toBe(ana.id);
    expect(vc.taskIds).toContain(patched.id);
  });

  it("unknown covered person is a blocking error", () => {
    const file: ParsedFile = {
      ...baseFile,
      rows: [
        baseFile.rows[0],
        { ...baseFile.rows[1], "Cubre ausencias de": "999" },
      ],
    };
    const normalized = validateImport(file, makeMapping());
    expect(normalized.summary.blocking).toBe(true);
    expect(
      normalized.summary.issues.some((i) => i.code === "coverage-not-found"),
    ).toBe(true);
  });
});
