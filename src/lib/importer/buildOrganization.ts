import type { Area, Competency, Criticality, Db, OrgFunction, Person, Process, Role, Task } from "@/types";
import { uid } from "@/lib/id";
import type { NormalizedImport } from "./types";

const normalize = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Identity key of a person: the Legajo/employee id when present, else the name.
 * Rows sharing this key describe the SAME person across several sectors/roles.
 */
function personKey(employeeId?: string, name?: string): string {
  if (employeeId) return `id:${normalize(employeeId)}`;
  return `name:${normalize(name ?? "")}`;
}

/**
 * Build a complete ORA Db from normalized import rows. The flat table is only
 * the input format: entities (areas, roles, processes, functions, tasks,
 * competencies) are deduplicated by name within the organization, so the same
 * value appearing in several rows yields a single entity. Fallback role /
 * process / function are created only when a row needs them and none is mapped.
 *
 * People are grouped by identity (Legajo if present, otherwise name): one person
 * may span several rows (several sectors/roles) and accumulates the union of
 * roles, areas, competencies and capable tasks. Manager relations are resolved
 * by the already-validated person name (group name).
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

  /*
   * First pass: create all the entities (processes, functions, tasks, areas,
   * roles, competencies) referenced by any row. Entities dedupe by name; each
   * person row maps its task list / competency list onto the shared entities.
   */
  for (const row of normalized.rows) {
    row.tareas.forEach((t) => ensureTask(t, row.funcion, row.proceso, row.criticidad, row.documentada));
    row.competencias.forEach(ensureCompetency);
    if (row.area) ensureArea(row.area);
    if (row.rol) ensureRole(row.rol);
  }

  /*
   * Second pass: group rows by person identity and build one Person per group.
   * A person spanning several sectors accumulates roleIds, areaIds and the union
   * of capable tasks/competencies. fallback role/area are only used when a row
   * has none.
   */
  const groupOrder: string[] = [];
  const groups = new Map<
    string,
    {
      name: string;
      employeeId?: string;
      roleIds: Set<string>;
      areaIds: Set<string>;
      competencyIds: Set<string>;
      taskIds: Set<string>;
      isActive: boolean;
      managerKey?: string;
      managerName?: string;
    }
  >();

  for (const row of normalized.rows) {
    const key = personKey(row.employeeId, row.persona);
    let group = groups.get(key);
    if (!group) {
      group = {
        name: row.persona,
        employeeId: row.employeeId,
        roleIds: new Set(),
        areaIds: new Set(),
        competencyIds: new Set(),
        taskIds: new Set(),
        isActive: row.activo ?? true,
        managerKey: row.managerResolvedKey,
        managerName: row.managerResolved,
      };
      groups.set(key, group);
      groupOrder.push(key);
    }
    const role = row.rol ? ensureRole(row.rol) : ensureFallbackRole();
    const area = row.area ? ensureArea(row.area) : undefined;
    const tasks = row.tareas.map((t) => ensureTask(t, row.funcion, row.proceso, row.criticidad, row.documentada));
    const competencies = row.competencias.map(ensureCompetency);
    group.roleIds.add(role.id);
    if (area) group.areaIds.add(area.id);
    tasks.forEach((t) => group.taskIds.add(t.id));
    competencies.forEach((c) => group.competencyIds.add(c.id));
    // Keep the manager reference of the first row (validation already resolved
    // ambiguous/not-found cases, so rows of the same person agree).
    group.managerKey = group.managerKey ?? row.managerResolvedKey;
    group.managerName = group.managerName ?? row.managerResolved;
  }

  /*
   * Build one Person per group, then resolve managers against existing people.
   * Manager references are matched by identity key (id:legajo / name:name) and
   * fall back to the display name, so people keyed by Legajo are still found.
   */
  const people: Person[] = groupOrder.map((key) => {
    const group = groups.get(key)!;
    return {
      id: uid("p"),
      name: group.name,
      employeeId: group.employeeId,
      roleIds: [...group.roleIds],
      areaIds: [...group.areaIds],
      isActive: group.isActive,
      competencyIds: [...group.competencyIds],
      taskIds: [...group.taskIds],
    };
  });
  const peopleByKey = new Map<string, Person>();
  groupOrder.forEach((key, i) => peopleByKey.set(key, people[i]));

  groupOrder.forEach((key, i) => {
    const group = groups.get(key)!;
    const person = people[i];
    const manager =
      (group.managerKey && peopleByKey.get(group.managerKey)) ||
      (group.managerName ? peopleByKey.get(personKey(undefined, group.managerName)) : undefined);
    if (manager && manager.id !== person.id) person.managerId = manager.id;
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
