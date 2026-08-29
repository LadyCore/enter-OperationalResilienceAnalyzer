import type { Area, Competency, Criticality, Db, OrgFunction, Person, Process, Role, Task } from "@/types";
import { uid } from "@/lib/id";
import type { NormalizedImport } from "./types";

const normalize = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Build a complete ORA Db from normalized import rows. The flat table is only
 * the input format: entities (areas, roles, processes, functions, tasks,
 * competencies) are deduplicated by name within the organization, so the same
 * value appearing in several rows yields a single entity. Fallback role /
 * process / function are created only when a row needs them and none is mapped.
 * Manager relations are resolved by the already-validated person name.
 */
export function buildOrganization(
  name: string,
  description: string,
  normalized: NormalizedImport,
): Db {
  const orgId = uid("org");
  const organization = { id: orgId, name: name.trim(), description: description.trim() };

  const areaByName = new Map<string, Area>();
  const roleByName = new Map<string, Role>();
  const processByName = new Map<string, Process>();
  const functionByKey = new Map<string, OrgFunction>();
  const taskByKey = new Map<string, Task>();
  const competencyByName = new Map<string, Competency>();

  let fallbackRole: Role | null = null;
  let fallbackProcess: Process | null = null;
  let fallbackFunction: OrgFunction | null = null;

  const ensureArea = (n: string): Area => {
    const key = normalize(n);
    let area = areaByName.get(key);
    if (!area) {
      area = { id: uid("area"), name: n, description: "" };
      areaByName.set(key, area);
    }
    return area;
  };

  const ensureRole = (n: string): Role => {
    const key = normalize(n);
    let role = roleByName.get(key);
    if (!role) {
      role = { id: uid("r"), name: n, description: "", competencyIds: [] };
      roleByName.set(key, role);
    }
    return role;
  };

  const ensureProcess = (n: string): Process => {
    const key = normalize(n);
    let process = processByName.get(key);
    if (!process) {
      process = { id: uid("proc"), name: n, description: "", criticality: "important", organizationId: orgId };
      processByName.set(key, process);
    }
    return process;
  };

  const ensureFunction = (fnName: string, processName?: string): OrgFunction => {
    const process = processName ? ensureProcess(processName) : ensureFallbackProcess();
    const key = `${process.id}::${normalize(fnName)}`;
    let fn = functionByKey.get(key);
    if (!fn) {
      fn = { id: uid("fn"), name: fnName, description: "", criticality: "important", processId: process.id };
      functionByKey.set(key, fn);
    }
    return fn;
  };

  const ensureTask = (
    taskName: string,
    functionName?: string,
    processName?: string,
    criticidad?: Criticality,
    documentada?: boolean,
  ): Task => {
    const fn = functionName ? ensureFunction(functionName, processName) : ensureFallbackFunction();
    const key = `${fn.id}::${normalize(taskName)}`;
    let task = taskByKey.get(key);
    if (!task) {
      task = {
        id: uid("task"),
        name: taskName,
        description: "",
        functionId: fn.id,
        criticality: criticidad ?? "standard",
        isDocumented: documentada ?? false,
        requiredCompetencyIds: [],
      };
      taskByKey.set(key, task);
    }
    return task;
  };

  const ensureCompetency = (n: string): Competency => {
    const key = normalize(n);
    let competency = competencyByName.get(key);
    if (!competency) {
      competency = { id: uid("comp"), name: n, description: "" };
      competencyByName.set(key, competency);
    }
    return competency;
  };

  const ensureFallbackRole = (): Role => {
    if (!fallbackRole) {
      fallbackRole = {
        id: uid("r"),
        name: "Unassigned",
        description: "Auto-created role for people without one in the source data.",
        competencyIds: [],
      };
    }
    return fallbackRole;
  };

  const ensureFallbackProcess = (): Process => {
    if (!fallbackProcess) {
      fallbackProcess = {
        id: uid("proc"),
        name: "General",
        description: "Auto-created process for tasks without one in the source data.",
        criticality: "important",
        organizationId: orgId,
      };
    }
    return fallbackProcess;
  };

  const ensureFallbackFunction = (): OrgFunction => {
    if (!fallbackFunction) {
      fallbackFunction = {
        id: uid("fn"),
        name: "General",
        description: "Auto-created function for tasks without one in the source data.",
        criticality: "important",
        processId: ensureFallbackProcess().id,
      };
    }
    return fallbackFunction;
  };

  const people: Person[] = normalized.rows.map((row) => {
    const role = row.rol ? ensureRole(row.rol) : ensureFallbackRole();
    const area = row.area ? ensureArea(row.area) : undefined;
    const tasks = row.tareas.map((t) => ensureTask(t, row.funcion, row.proceso, row.criticidad, row.documentada));
    const competencies = row.competencias.map(ensureCompetency);
    return {
      id: uid("p"),
      name: row.persona,
      employeeId: row.employeeId,
      roleId: role.id,
      areaId: area?.id,
      isActive: row.activo ?? true,
      competencyIds: competencies.map((c) => c.id),
      taskIds: tasks.map((t) => t.id),
    };
  });

  // Second pass: resolve manager references by validated person name.
  const personByKey = new Map(people.map((p) => [normalize(p.name), p]));
  people.forEach((person, i) => {
    const row = normalized.rows[i];
    if (!row.managerResolved) return;
    const manager = personByKey.get(normalize(row.managerResolved));
    if (manager && manager.id !== person.id) {
      person.managerId = manager.id;
    }
  });

  const roles = [...roleByName.values()];
  if (fallbackRole) roles.push(fallbackRole);
  const processes = [...processByName.values()];
  if (fallbackProcess) processes.push(fallbackProcess);
  const functions = [...functionByKey.values()];
  if (fallbackFunction) functions.push(fallbackFunction);

  return {
    organization,
    areas: [...areaByName.values()],
    processes,
    functions,
    tasks: [...taskByKey.values()],
    roles,
    people,
    competencies: [...competencyByName.values()],
  };
}
