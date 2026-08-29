import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type {
  Area,
  CollectionKey,
  Competency,
  Criticality,
  Db,
  Entity,
  OrgFunction,
  Organization,
  Person,
  Process,
  Role,
  Task,
} from "@/types";
import { remapSeedIds, seedDb } from "@/data/seed";

export interface OrgSummary {
  id: string;
  name: string;
  isDemo: boolean;
}

type TableName =
  | "areas"
  | "competencies"
  | "roles"
  | "people"
  | "processes"
  | "org_functions"
  | "tasks";

const COLLECTION_TABLE: Record<CollectionKey, TableName> = {
  areas: "areas",
  competencies: "competencies",
  roles: "roles",
  people: "people",
  processes: "processes",
  functions: "org_functions",
  tasks: "tasks",
};

const CHILD_TABLES: TableName[] = [
  "people",
  "tasks",
  "org_functions",
  "processes",
  "roles",
  "competencies",
  "areas",
];

/* ------------------------------------------------------------------ */
/* Serialization                                                       */
/* ------------------------------------------------------------------ */

type Tables = Database["public"]["Tables"];

function payloadFor(collection: CollectionKey, entity: Entity, orgId: string): Record<string, unknown> {
  switch (collection) {
    case "processes": {
      const e = entity as Process;
      return { id: e.id, organization_id: orgId, name: e.name, description: e.description, criticality: e.criticality };
    }
    case "functions": {
      const e = entity as OrgFunction;
      return { id: e.id, organization_id: orgId, process_id: e.processId, name: e.name, description: e.description, criticality: e.criticality };
    }
    case "tasks": {
      const e = entity as Task;
      return {
        id: e.id,
        organization_id: orgId,
        function_id: e.functionId,
        area_id: e.areaId ?? null,
        name: e.name,
        description: e.description,
        criticality: e.criticality,
        is_documented: e.isDocumented,
        system_name: e.systemName ?? null,
        required_competency_ids: e.requiredCompetencyIds,
      };
    }
    case "roles": {
      const e = entity as Role;
      return { id: e.id, organization_id: orgId, name: e.name, description: e.description, competency_ids: e.competencyIds };
    }
    case "people": {
      const e = entity as Person;
      return {
        id: e.id,
        organization_id: orgId,
        name: e.name,
        employee_id: e.employeeId ?? null,
        role_id: e.roleId,
        area_id: e.areaId ?? null,
        manager_id: e.managerId ?? null,
        is_active: e.isActive,
        competency_ids: e.competencyIds,
        task_ids: e.taskIds,
      };
    }
    case "competencies": {
      const e = entity as Competency;
      return { id: e.id, organization_id: orgId, name: e.name, description: e.description };
    }
    case "areas": {
      const e = entity as Area;
      return { id: e.id, organization_id: orgId, name: e.name, description: e.description ?? "" };
    }
  }
}

const toOrganization = (r: Tables["organizations"]["Row"]): Organization => ({
  id: r.id,
  name: r.name,
  description: r.description,
  isDemo: r.is_demo,
});

const toProcess = (r: Tables["processes"]["Row"]): Process => ({
  id: r.id,
  name: r.name,
  description: r.description,
  criticality: r.criticality as Criticality,
  organizationId: r.organization_id,
});

const toFunction = (r: Tables["org_functions"]["Row"]): OrgFunction => ({
  id: r.id,
  name: r.name,
  description: r.description,
  criticality: r.criticality as Criticality,
  processId: r.process_id,
});

const toTask = (r: Tables["tasks"]["Row"]): Task => ({
  id: r.id,
  name: r.name,
  description: r.description,
  functionId: r.function_id,
  areaId: r.area_id ?? undefined,
  criticality: r.criticality as Criticality,
  isDocumented: r.is_documented,
  systemName: r.system_name ?? undefined,
  requiredCompetencyIds: r.required_competency_ids,
});

const toRole = (r: Tables["roles"]["Row"]): Role => ({
  id: r.id,
  name: r.name,
  description: r.description,
  competencyIds: r.competency_ids,
});

const toPerson = (r: Tables["people"]["Row"]): Person => ({
  id: r.id,
  name: r.name,
  employeeId: r.employee_id ?? undefined,
  roleId: r.role_id ?? "",
  areaId: r.area_id ?? undefined,
  managerId: r.manager_id ?? undefined,
  isActive: r.is_active,
  competencyIds: r.competency_ids,
  taskIds: r.task_ids,
});

const toCompetency = (r: Tables["competencies"]["Row"]): Competency => ({
  id: r.id,
  name: r.name,
  description: r.description,
});

const toArea = (r: Tables["areas"]["Row"]): Area => ({
  id: r.id,
  name: r.name,
  description: r.description,
});

/* ------------------------------------------------------------------ */
/* Organizations                                                      */
/* ------------------------------------------------------------------ */

export async function listOrganizations(): Promise<OrgSummary[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, is_demo")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, isDemo: r.is_demo }));
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data ? toOrganization(data) : null;
}

export async function updateOrganization(org: Organization): Promise<void> {
  const { error } = await supabase
    .from("organizations")
    .update({ name: org.name, description: org.description, is_demo: org.isDemo ?? false })
    .eq("id", org.id);
  if (error) throw error;
}

/**
 * Insert the full org with all children, respecting foreign keys:
 * processes → org_functions → areas → competencies → roles → tasks → people
 * (tasks reference functions and areas; people reference roles and areas).
 * People are inserted with manager_id null first, then a second pass resolves
 * the hierarchy (people reference people).
 */
export async function createOrganization(db: Db, ownerId: string): Promise<void> {
  const { error: orgErr } = await supabase.from("organizations").insert({
    id: db.organization.id,
    name: db.organization.name,
    description: db.organization.description,
    is_demo: db.organization.isDemo ?? false,
    owner_id: ownerId,
  } as never);
  if (orgErr) throw orgErr;
  await insertChildren(db);
}

async function insertChildren(db: Db): Promise<void> {
  const orgId = db.organization.id;
  const insertAll = async (collection: CollectionKey, entities: Entity[]) => {
    if (entities.length === 0) return;
    const { error } = await supabase
      .from(COLLECTION_TABLE[collection])
      .insert(entities.map((e) => payloadFor(collection, e, orgId)) as never);
    if (error) throw error;
  };

  await insertAll("processes", db.processes);
  await insertAll("functions", db.functions);
  await insertAll("areas", db.areas);
  await insertAll("competencies", db.competencies);
  await insertAll("roles", db.roles);
  await insertAll("tasks", db.tasks);
  await insertAll("people", db.people);

  for (const p of db.people) {
    if (!p.managerId) continue;
    const { error } = await supabase
      .from("people")
      .update({ manager_id: p.managerId })
      .eq("id", p.id)
      .eq("organization_id", orgId);
    if (error) throw error;
  }
}

/** Delete an organization. The demo is protected both here and by a DB trigger. */
export async function deleteOrganization(orgId: string): Promise<void> {
  const org = await getOrganization(orgId);
  if (org?.isDemo) throw new Error("The demo organization cannot be deleted.");
  const { error } = await supabase.from("organizations").delete().eq("id", orgId);
  if (error) throw error;
}

export async function loadOrganization(orgId: string): Promise<Db> {
  const [org, areas, processes, functions, tasks, roles, people, competencies] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
    supabase.from("areas").select("*").eq("organization_id", orgId),
    supabase.from("processes").select("*").eq("organization_id", orgId),
    supabase.from("org_functions").select("*").eq("organization_id", orgId),
    supabase.from("tasks").select("*").eq("organization_id", orgId),
    supabase.from("roles").select("*").eq("organization_id", orgId),
    supabase.from("people").select("*").eq("organization_id", orgId),
    supabase.from("competencies").select("*").eq("organization_id", orgId),
  ]);
  for (const [name, res] of Object.entries({ org, areas, processes, functions, tasks, roles, people, competencies })) {
    if (res.error) throw res.error;
  }
  if (!org.data) throw new Error("Organization not found");

  return {
    organization: toOrganization(org.data),
    areas: (areas.data ?? []).map(toArea),
    processes: (processes.data ?? []).map(toProcess),
    functions: (functions.data ?? []).map(toFunction),
    tasks: (tasks.data ?? []).map(toTask),
    roles: (roles.data ?? []).map(toRole),
    people: (people.data ?? []).map(toPerson),
    competencies: (competencies.data ?? []).map(toCompetency),
  };
}

/**
 * Reset a demo organization to a fresh copy of the seed (new child ids, org id
 * preserved — the demo row itself can never be deleted). Imported organizations
 * are never touched.
 */
export async function resetDemoOrganization(orgId: string): Promise<Db> {
  const seeded = remapSeedIds(seedDb);
  const { error: orgErr } = await supabase
    .from("organizations")
    .update({ name: seeded.organization.name, description: seeded.organization.description, is_demo: true })
    .eq("id", orgId);
  if (orgErr) throw orgErr;

  for (const table of CHILD_TABLES) {
    const { error } = await supabase.from(table).delete().eq("organization_id", orgId);
    if (error) throw error;
  }

  const fresh: Db = { ...seeded, organization: { ...seeded.organization, id: orgId, isDemo: true } };
  await insertChildren(fresh);
  return fresh;
}

/**
 * Idempotent demo creation for a new user. If the user already has any
 * organization nothing happens. The partial unique index (one demo per owner)
 * guards against concurrent initializations from multiple tabs.
 */
export async function ensureDemoOrganization(ownerId: string): Promise<Db | null> {
  const { count, error: countErr } = await supabase
    .from("organizations")
    .select("id", { count: "exact", head: true });
  if (countErr) throw countErr;
  if ((count ?? 0) > 0) return null;

  const db = remapSeedIds(seedDb);
  const { error } = await supabase.from("organizations").insert({
    id: db.organization.id,
    name: db.organization.name,
    description: db.organization.description,
    is_demo: true,
    owner_id: ownerId,
  } as never);
  if (error) {
    // 23505 = unique violation on organizations_one_demo_per_owner from a
    // concurrent initialization; another tab already created the demo.
    if (error.code === "23505") return null;
    throw error;
  }
  await insertChildren(db);
  return db;
}

/* ------------------------------------------------------------------ */
/* Row-level CRUD (used by the store's write queue)                    */
/* ------------------------------------------------------------------ */

export async function upsertRow(collection: CollectionKey, entity: Entity, orgId: string): Promise<void> {
  const { error } = await supabase
    .from(COLLECTION_TABLE[collection])
    .upsert(payloadFor(collection, entity, orgId) as never);
  if (error) throw error;
}

export async function deleteRow(collection: CollectionKey, id: string, orgId: string): Promise<void> {
  const { error } = await supabase
    .from(COLLECTION_TABLE[collection])
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) throw error;
}
