import { describe, expect, it } from "vitest";
import type { ColumnMapping, ParsedFile } from "@/lib/importer/types";
import { validateImport } from "@/lib/importer/validate";
import { buildOrganization } from "@/lib/importer/buildOrganization";

const mapping: ColumnMapping = {
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
};

/**
 * Reproduction of ORA_test_bug_manager_multiarea.xlsx: one person (Diego
 * Correa, Legajo 2001) spans two sectors with a different role in each, and
 * Lucía/Martín/Valeria all report to manager id 2001 (Diego).
 */
const file: ParsedFile = {
  columns: [
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
  ],
  rows: [
    {
      Empleado: "Ana Bianchi",
      Legajo: "2000",
      Sector: "Dirección General",
      Responsable: "",
      "Manager ID": "",
      Rol: "CEO",
      "Role ID": "R-DIR-CEO",
      Proceso: "Executive Governance",
      Función: "Definir estrategia general",
      Tareas: "Fijar objetivos anuales",
      Competencias: "Liderazgo ejecutivo",
      Documentada: "Sí",
      Activo: "Sí",
    },
    {
      Empleado: "Diego Correa",
      Legajo: "2001",
      Sector: "IT Infrastructure",
      Responsable: "Ana Bianchi",
      "Manager ID": "2000",
      Rol: "Director de IT",
      "Role ID": "R-IT-DIR",
      Proceso: "IT Infrastructure Operations",
      Función: "Administrar servidores de producción",
      Tareas: "Monitorear disponibilidad de servicios",
      Competencias: "Administración de servidores Linux",
      Documentada: "Sí",
      Activo: "Sí",
    },
    {
      Empleado: "Diego Correa",
      Legajo: "2001",
      Sector: "Sales",
      Responsable: "Ana Bianchi",
      "Manager ID": "2000",
      Rol: "Ejecutivo de Cuentas",
      "Role ID": "R-SAL-EJEC",
      Proceso: "Customer Order Management",
      Función: "Gestionar cartera de clientes",
      Tareas: "Mantener relación con clientes activos",
      Competencias: "CRM",
      Documentada: "No",
      Activo: "Sí",
    },
    {
      Empleado: "Lucía Fernández",
      Legajo: "2002",
      Sector: "IT Infrastructure",
      Responsable: "Diego Correa",
      "Manager ID": "2001",
      Rol: "Analista de Soporte Técnico",
      "Role ID": "R-IT-ANL",
      Proceso: "IT Infrastructure Operations",
      Función: "Soporte técnico interno",
      Tareas: "Atender tickets de soporte",
      Competencias: "Soporte técnico",
      Documentada: "Sí",
      Activo: "Sí",
    },
    {
      Empleado: "Martín Suárez",
      Legajo: "2003",
      Sector: "IT Infrastructure",
      Responsable: "Diego Correa",
      "Manager ID": "2001",
      Rol: "Técnico de Soporte Nivel 1",
      "Role ID": "R-IT-TEC",
      Proceso: "IT Infrastructure Operations",
      Función: "Soporte técnico interno",
      Tareas: "Configurar puestos de trabajo",
      Competencias: "Soporte técnico",
      Documentada: "Sí",
      Activo: "Sí",
    },
    {
      Empleado: "Valeria Gómez",
      Legajo: "2004",
      Sector: "Sales",
      Responsable: "Diego Correa",
      "Manager ID": "2001",
      Rol: "Vendedor",
      "Role ID": "R-SAL-VEN",
      Proceso: "Customer Order Management",
      Función: "Gestionar cartera de clientes",
      Tareas: "Prospectar nuevos clientes",
      Competencias: "Ventas consultivas",
      Documentada: "Sí",
      Activo: "Sí",
    },
  ],
};

describe("import: multi-area person + shared manager by id", () => {
  const normalized = validateImport(file, mapping);

  it("does not flag Diego as a duplicate and resolves the hierarchy", () => {
    expect(normalized.summary.blocking).toBe(false);
    expect(normalized.summary.possibleDuplicates).toBe(0);
    expect(normalized.summary.ambiguousReferences).toBe(0);
    expect(normalized.summary.missingReferences).toBe(0);
    // 5 unique people (Diego appears twice but is one person).
    expect(normalized.summary.people).toBe(5);
    expect(normalized.summary.hierarchyRelations).toBe(5);
  });

  it("builds Diego as ONE person with both sectors and both roles", () => {
    const db = buildOrganization("Test Org", "", normalized);
    const diego = db.people.filter((p) => p.name === "Diego Correa");
    expect(diego).toHaveLength(1);
    const diegoAreas = diego[0].areaIds.map((id) => db.areas.find((a) => a.id === id)?.name);
    expect(diegoAreas).toEqual(expect.arrayContaining(["IT Infrastructure", "Sales"]));
    const diegoRoles = diego[0].roleIds.map((id) => db.roles.find((r) => r.id === id)?.name);
    expect(diegoRoles).toEqual(expect.arrayContaining(["Director de IT", "Ejecutivo de Cuentas"]));
    // Manager of Lucía/Martín/Valeria resolves to the unique Diego (legajo 2001).
    for (const name of ["Lucía Fernández", "Martín Suárez", "Valeria Gómez"]) {
      const person = db.people.find((p) => p.name === name);
      expect(person?.managerId).toBe(diego[0].id);
    }
    expect(db.people.find((p) => p.name === "Diego Correa")?.managerId).toBe(
      db.people.find((p) => p.name === "Ana Bianchi")?.id,
    );
  });
});
