import type { Competency, Db, OnCallAssignment, OrgFunction, Person, Process, Role, Task, VacationCoverage } from "@/types";
import { uid } from "@/lib/id";

export const SEED_ORG = {
  id: "org_meridian",
  name: "Meridian Group",
  description:
    "A mid-sized services organization that runs customer operations, IT infrastructure, finance and internal support functions. This fictional dataset demonstrates how ORA surfaces hidden operational dependencies — where critical capability concentrates in a single person or role.",
  isDemo: true,
};

export const SEED_PROCESSES: Process[] = [
  { id: "p_orders", name: "Customer Order Management", description: "Handles customer orders from intake through billing.", criticality: "critical", organizationId: "org_meridian" },
  { id: "p_it", name: "IT Infrastructure Operations", description: "Keeps production systems, data and incident response running.", criticality: "critical", organizationId: "org_meridian" },
  { id: "p_payroll", name: "Payroll & HR Administration", description: "Processes payroll and manages the employee lifecycle.", criticality: "important", organizationId: "org_meridian" },
  { id: "p_procurement", name: "Procurement & Supplier Management", description: "Sourcing, purchasing and supplier contracting.", criticality: "important", organizationId: "org_meridian" },
  { id: "p_facilities", name: "Facilities & Support", description: "Physical office operations and day-to-day support.", criticality: "standard", organizationId: "org_meridian" },
];

export const SEED_FUNCTIONS: OrgFunction[] = [
  { id: "f_orderintake", name: "Order Intake", description: "Receiving and validating customer orders.", criticality: "critical", processId: "p_orders" },
  { id: "f_billing", name: "Billing & Invoicing", description: "Invoicing and credit management.", criticality: "critical", processId: "p_orders" },
  { id: "f_prodsys", name: "Production Systems", description: "Operations of production infrastructure and data.", criticality: "critical", processId: "p_it" },
  { id: "f_incident", name: "Incident Response", description: "Detection, triage and recovery from incidents.", criticality: "critical", processId: "p_it" },
  { id: "f_payroll", name: "Payroll Processing", description: "Running payroll and statutory filings.", criticality: "important", processId: "p_payroll" },
  { id: "f_empadmin", name: "Employee Administration", description: "Onboarding and personnel records.", criticality: "important", processId: "p_payroll" },
  { id: "f_purchasing", name: "Purchasing", description: "Purchase orders and supplier contracts.", criticality: "important", processId: "p_procurement" },
  { id: "f_office", name: "Office Operations", description: "Supplies, reception and office support.", criticality: "standard", processId: "p_facilities" },
];

export const SEED_TASKS: Task[] = [
  { id: "t_validate", name: "Validate customer order", description: "Verify order details, pricing and credit terms before acceptance.", criticality: "critical", functionId: "f_orderintake", isDocumented: true, systemName: "Order Management System", requiredCompetencyIds: ["c_order"] },
  { id: "t_quote", name: "Quote custom pricing", description: "Build custom quotes for non-standard orders.", criticality: "critical", functionId: "f_orderintake", isDocumented: false, systemName: "Pricing Tool", requiredCompetencyIds: ["c_pricing", "c_order"] },
  { id: "t_invoice", name: "Generate invoices", description: "Produce and send customer invoices.", criticality: "critical", functionId: "f_billing", isDocumented: true, systemName: "ERP Finance Module", requiredCompetencyIds: ["c_invoicing"] },
  { id: "t_creditnote", name: "Process credit notes", description: "Issue credit notes for returns and corrections.", criticality: "important", functionId: "f_billing", isDocumented: false, systemName: "ERP Finance Module", requiredCompetencyIds: ["c_invoicing"] },
  { id: "t_backup", name: "Perform database backups", description: "Run and verify scheduled database backups.", criticality: "critical", functionId: "f_prodsys", isDocumented: true, systemName: "Backup Platform", requiredCompetencyIds: ["c_db", "c_dr"] },
  { id: "t_patch", name: "Patch production servers", description: "Apply security patches to production servers in the maintenance window.", criticality: "critical", functionId: "f_prodsys", isDocumented: false, systemName: "Production Infrastructure", requiredCompetencyIds: ["c_server"] },
  { id: "t_triage", name: "Triage major incidents", description: "Assess severity, coordinate response and escalate major incidents.", criticality: "critical", functionId: "f_incident", isDocumented: false, systemName: "Monitoring & Alerting", requiredCompetencyIds: ["c_incident", "c_network"] },
  { id: "t_restore", name: "Restore from backup", description: "Restore databases and systems from backup after an incident.", criticality: "critical", functionId: "f_incident", isDocumented: true, systemName: "Backup Platform", requiredCompetencyIds: ["c_db", "c_dr"] },
  { id: "t_payroll", name: "Run monthly payroll", description: "Calculate and submit monthly payroll for all employees.", criticality: "critical", functionId: "f_payroll", isDocumented: true, systemName: "Payroll System", requiredCompetencyIds: ["c_payroll", "c_payrollcomp"] },
  { id: "t_filings", name: "Process statutory filings", description: "Prepare and submit statutory payroll filings to authorities.", criticality: "critical", functionId: "f_payroll", isDocumented: false, systemName: "Tax Portal", requiredCompetencyIds: ["c_payrollcomp"] },
  { id: "t_onboard", name: "Onboard new hires", description: "Set up accounts, contracts and training for new employees.", criticality: "important", functionId: "f_empadmin", isDocumented: true, systemName: "HRIS", requiredCompetencyIds: ["c_onboarding"] },
  { id: "t_records", name: "Maintain personnel records", description: "Keep employee records and documentation up to date.", criticality: "standard", functionId: "f_empadmin", isDocumented: true, systemName: "HRIS", requiredCompetencyIds: ["c_onboarding"] },
  { id: "t_po", name: "Raise purchase orders", description: "Create and route purchase orders for approval.", criticality: "important", functionId: "f_purchasing", isDocumented: true, systemName: "Procurement Platform", requiredCompetencyIds: ["c_procurement"] },
  { id: "t_contracts", name: "Approve supplier contracts", description: "Review and approve supplier contract terms.", criticality: "critical", functionId: "f_purchasing", isDocumented: false, systemName: "Contract Management", requiredCompetencyIds: ["c_contract"] },
  { id: "t_supplies", name: "Manage office supplies", description: "Order and manage office supplies.", criticality: "standard", functionId: "f_office", isDocumented: true, requiredCompetencyIds: ["c_facilities"] },
  { id: "t_reception", name: "Handle reception", description: "Reception, visitors and general front-desk support.", criticality: "standard", functionId: "f_office", isDocumented: true, requiredCompetencyIds: ["c_facilities"] },
];

export const SEED_COMPETENCIES: Competency[] = [
  { id: "c_order", name: "Customer Order Processing", description: "Understanding and executing customer order workflows." },
  { id: "c_pricing", name: "Pricing & Quoting", description: "Building custom quotes and pricing structures." },
  { id: "c_invoicing", name: "Invoicing & Billing", description: "Invoicing, billing and credit operations." },
  { id: "c_db", name: "Database Administration", description: "Managing and operating production databases." },
  { id: "c_server", name: "Server Administration", description: "Configuring, patching and operating production servers." },
  { id: "c_dr", name: "Disaster Recovery", description: "Backup and recovery planning and execution." },
  { id: "c_incident", name: "Incident Management", description: "Detecting, triaging and coordinating incidents." },
  { id: "c_network", name: "Network Operations", description: "Operating and troubleshooting the network." },
  { id: "c_payroll", name: "Payroll Processing", description: "Calculating and submitting payroll." },
  { id: "c_payrollcomp", name: "Payroll Compliance & Statutory", description: "Statutory payroll filings and compliance." },
  { id: "c_onboarding", name: "HR Onboarding", description: "Employee onboarding and record keeping." },
  { id: "c_procurement", name: "Procurement", description: "Purchasing and supplier management." },
  { id: "c_contract", name: "Contract & Compliance Review", description: "Reviewing contracts and compliance terms." },
  { id: "c_facilities", name: "Facility & Office Support", description: "Physical office operations and support." },
];

export const SEED_ROLES: Role[] = [
  { id: "r_ops", name: "Operations Manager", description: "Oversees operations across processes.", competencyIds: ["c_order", "c_invoicing", "c_incident", "c_procurement", "c_onboarding"] },
  { id: "r_order", name: "Order Specialist", description: "Handles order intake and quoting.", competencyIds: ["c_order", "c_pricing"] },
  { id: "r_billing", name: "Billing Analyst", description: "Manages invoicing and credit.", competencyIds: ["c_invoicing"] },
  { id: "r_sysadmin", name: "IT Systems Administrator", description: "Administers production servers and recovery.", competencyIds: ["c_server", "c_dr", "c_incident"] },
  { id: "r_itsupport", name: "IT Support Engineer", description: "Supports incidents and network operations.", competencyIds: ["c_incident", "c_network"] },
  { id: "r_dba", name: "Database Administrator", description: "Operates production databases and recovery.", competencyIds: ["c_db", "c_dr"] },
  { id: "r_payroll", name: "HR & Payroll Specialist", description: "Runs payroll and statutory filings.", competencyIds: ["c_payroll", "c_payrollcomp"] },
  { id: "r_hradmin", name: "HR Administrator", description: "Onboarding and personnel records.", competencyIds: ["c_onboarding", "c_payroll"] },
  { id: "r_procurement", name: "Procurement Officer", description: "Runs purchasing.", competencyIds: ["c_procurement"] },
  { id: "r_compliance", name: "Compliance Officer", description: "Reviews contracts and compliance.", competencyIds: ["c_contract"] },
  { id: "r_facilities", name: "Facilities Coordinator", description: "Coordinates office operations.", competencyIds: ["c_facilities"] },
  { id: "r_reception", name: "Receptionist", description: "Front desk and reception.", competencyIds: ["c_facilities"] },
];

export const SEED_PEOPLE: Person[] = [
  { id: "p_ana", name: "Ana Silva", roleIds: ["r_sysadmin"], areaIds: [], isActive: true, competencyIds: ["c_server", "c_dr", "c_incident"], taskIds: ["t_patch", "t_backup", "t_triage"] },
  { id: "p_bruno", name: "Bruno Costa", roleIds: ["r_dba"], areaIds: [], isActive: true, competencyIds: ["c_db", "c_dr"], taskIds: ["t_backup", "t_restore"] },
  { id: "p_carlos", name: "Carlos Mendes", roleIds: ["r_itsupport"], areaIds: [], isActive: true, competencyIds: ["c_incident", "c_network"], taskIds: ["t_triage"] },
  { id: "p_diana", name: "Diana Nunes", roleIds: ["r_order"], areaIds: [], isActive: true, competencyIds: ["c_order", "c_pricing"], taskIds: ["t_validate", "t_quote"] },
  { id: "p_elena", name: "Elena Rossi", roleIds: ["r_billing"], areaIds: [], isActive: true, competencyIds: ["c_invoicing"], taskIds: ["t_invoice", "t_creditnote"] },
  { id: "p_franco", name: "Franco Bianchi", roleIds: ["r_payroll"], areaIds: [], isActive: true, competencyIds: ["c_payroll", "c_payrollcomp"], taskIds: ["t_payroll", "t_filings"] },
  { id: "p_gabriela", name: "Gabriela Duarte", roleIds: ["r_hradmin"], areaIds: [], isActive: true, competencyIds: ["c_onboarding", "c_payroll"], taskIds: ["t_payroll", "t_onboard", "t_records"] },
  { id: "p_hugo", name: "Hugo Pereira", roleIds: ["r_procurement"], areaIds: [], isActive: true, competencyIds: ["c_procurement"], taskIds: ["t_po"] },
  { id: "p_ines", name: "Ines Almeida", roleIds: ["r_compliance"], areaIds: [], isActive: true, competencyIds: ["c_contract"], taskIds: ["t_contracts"] },
  { id: "p_jorge", name: "Jorge Ferreira", roleIds: ["r_ops"], areaIds: [], isActive: true, competencyIds: ["c_order", "c_invoicing", "c_incident", "c_procurement", "c_onboarding"], taskIds: ["t_validate", "t_invoice", "t_creditnote", "t_onboard", "t_records", "t_po"] },
  { id: "p_katia", name: "Katia Sousa", roleIds: ["r_facilities"], areaIds: [], isActive: true, competencyIds: ["c_facilities"], taskIds: ["t_supplies", "t_reception"] },
  { id: "p_luis", name: "Luis Martins", roleIds: ["r_reception"], areaIds: [], isActive: true, competencyIds: ["c_facilities"], taskIds: ["t_reception", "t_supplies"] },
  { id: "p_nadia", name: "Nadia Ferreira", roleIds: ["r_billing"], areaIds: [], isActive: false, competencyIds: ["c_invoicing"], taskIds: ["t_invoice"] },
];

/**
 * Example vacation coverages (B covers A during A's vacation). Only used in
 * planned-absence simulations whose category is Vacation. Examples are chosen
 * so the coverer is NOT normally capable of the covered tasks — the coverage is
 * a temporary capability that must not leak into the base analysis.
 */
export const SEED_VACATION_COVERAGES: VacationCoverage[] = [
  // Elena (billing) covers Diana's order-intake tasks while Diana is away.
  { id: "vc_elena_diana", coveringPersonId: "p_elena", coveredPersonId: "p_diana", roleId: "r_order", taskIds: ["t_validate", "t_quote"], competencyIds: ["c_order", "c_pricing"] },
  // Gabriela (HR admin) covers Franco's statutory-filings task on vacation.
  { id: "vc_gabriela_franco", coveringPersonId: "p_gabriela", coveredPersonId: "p_franco", roleId: "r_payroll", taskIds: ["t_filings"], competencyIds: ["c_payrollcomp"] },
];

/**
 * Example passive on-call assignments (guardia pasiva) — permanent availability
 * outside ordinary hours. Independent of the base analysis.
 */
export const SEED_ON_CALL: OnCallAssignment[] = [
  { id: "oc_carlos_night", personId: "p_carlos", modality: "Shifts", period: "Night", taskIds: ["t_triage"], competencyIds: ["c_incident", "c_network"] },
  { id: "oc_ana_h24", personId: "p_ana", modality: "H24", period: "H24", taskIds: ["t_patch", "t_triage"], competencyIds: ["c_server", "c_incident"] },
];

export const seedDb: Db = {
  organization: SEED_ORG,
  areas: [],
  processes: SEED_PROCESSES,
  functions: SEED_FUNCTIONS,
  tasks: SEED_TASKS,
  roles: SEED_ROLES,
  people: SEED_PEOPLE,
  competencies: SEED_COMPETENCIES,
  vacationCoverages: SEED_VACATION_COVERAGES,
  onCallAssignments: SEED_ON_CALL,
};

/** Deep clone helper used to avoid mutating shared seed objects. */
export function cloneDb(db: Db): Db {
  return JSON.parse(JSON.stringify(db)) as Db;
}

/**
 * Reassign every id in a seed Db to fresh uid()s, preserving all internal
 * relations (process → function → task, role/person/competency references).
 * The seed uses fixed ids (org_meridian, p_ana…) that would collide across
 * users because primary keys are global, so each user's demo gets its own set.
 */
export function remapSeedIds(db: Db): Db {
  const map = new Map<string, string>();
  const remap = (id: string, prefix: string): string => {
    const existing = map.get(id);
    if (existing) return existing;
    const next = uid(prefix);
    map.set(id, next);
    return next;
  };

  const organization = { ...db.organization, id: remap(db.organization.id, "org") };
  const processes = db.processes.map((p) => ({
    ...p,
    id: remap(p.id, "proc"),
    organizationId: organization.id,
  }));
  const functions = db.functions.map((f) => ({
    ...f,
    id: remap(f.id, "fn"),
    organizationId: organization.id,
    processId: remap(f.processId, "proc"),
  }));
  const areas = db.areas.map((a) => ({ ...a, id: remap(a.id, "area") }));
  const competencies = db.competencies.map((c) => ({ ...c, id: remap(c.id, "comp") }));
  const roles = db.roles.map((r) => ({
    ...r,
    id: remap(r.id, "role"),
    competencyIds: r.competencyIds.map((c) => remap(c, "comp")),
  }));
  const tasks = db.tasks.map((t) => ({
    ...t,
    id: remap(t.id, "task"),
    organizationId: organization.id,
    functionId: remap(t.functionId, "fn"),
    areaId: t.areaId ? remap(t.areaId, "area") : undefined,
    requiredCompetencyIds: t.requiredCompetencyIds.map((c) => remap(c, "comp")),
  }));
  const people = db.people.map((p) => {
    const legacyRole = (p as Person & { roleId?: string }).roleId;
    const legacyArea = (p as Person & { areaId?: string }).areaId;
    const roleIds = (p.roleIds?.length ? p.roleIds : legacyRole ? [legacyRole] : []).map((id) =>
      remap(id, "role")
    );
    const areaIds = (p.areaIds?.length ? p.areaIds : legacyArea ? [legacyArea] : []).map((id) =>
      remap(id, "area")
    );
    return {
      ...p,
      id: remap(p.id, "p"),
      roleIds,
      areaIds,
      managerId: p.managerId ? remap(p.managerId, "p") : undefined,
      competencyIds: p.competencyIds.map((c) => remap(c, "comp")),
      taskIds: p.taskIds.map((t) => remap(t, "task")),
    };
  });
  const vacationCoverages = (db.vacationCoverages ?? []).map((c) => ({
    ...c,
    id: remap(c.id, "vc"),
    coveringPersonId: remap(c.coveringPersonId, "p"),
    coveredPersonId: remap(c.coveredPersonId, "p"),
    roleId: c.roleId ? remap(c.roleId, "role") : undefined,
    taskIds: c.taskIds.map((t) => remap(t, "task")),
    competencyIds: c.competencyIds.map((k) => remap(k, "comp")),
  }));
  const onCallAssignments = (db.onCallAssignments ?? []).map((a) => ({
    ...a,
    id: remap(a.id, "oc"),
    personId: remap(a.personId, "p"),
    taskIds: a.taskIds.map((t) => remap(t, "task")),
    competencyIds: a.competencyIds.map((k) => remap(k, "comp")),
  }));

  return { organization, areas, processes, functions, tasks, roles, people, competencies, vacationCoverages, onCallAssignments };
}
