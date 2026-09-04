export type Criticality = "critical" | "important" | "standard";

export const CRITICALITY_LABELS: Record<Criticality, string> = {
  critical: "Critical",
  important: "Important",
  standard: "Standard",
};

export interface Organization {
  id: string;
  name: string;
  description: string;
  /** True for the seeded Meridian Group demo; demo orgs can never be deleted. */
  isDemo?: boolean;
}

export interface Area {
  id: string;
  name: string;
  description?: string;
}

export interface Process {
  id: string;
  name: string;
  description: string;
  criticality: Criticality;
  organizationId: string;
}

export interface OrgFunction {
  id: string;
  name: string;
  description: string;
  processId: string;
  criticality: Criticality;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  functionId: string;
  areaId?: string;
  criticality: Criticality;
  isDocumented: boolean;
  systemName?: string;
  requiredCompetencyIds: string[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  competencyIds: string[];
}

export interface Person {
  id: string;
  name: string;
  /** Optional source identifier (e.g. payroll/employee id) used during imports. */
  employeeId?: string;
  /** Roles this person holds (one per sector when the person spans several). */
  roleIds: string[];
  /** Sectors/areas the person belongs to. */
  areaIds: string[];
  /** Direct manager/superior, referencing another person in the same organization. */
  managerId?: string;
  isActive: boolean;
  competencyIds: string[];
  taskIds: string[];
}

export interface Competency {
  id: string;
  name: string;
  description: string;
}

/**
 * Vacation coverage: person B (coveringPersonId) can temporarily perform
 * concrete tasks of person A (coveredPersonId) while A is on a planned
 * vacation. It is a relation between two people, never a change to either
 * person's ordinary profile, and it only applies to planned-absence
 * simulations whose category is "Vacation".
 */
export interface VacationCoverage {
  id: string;
  coveringPersonId: string;
  coveredPersonId: string;
  /** Role of the covered dependency that B can cover (optional). */
  roleId?: string;
  /** Concrete tasks of A that B can perform during the absence. */
  taskIds: string[];
  /** Competencies that enable B for this coverage. */
  competencyIds: string[];
}

/**
 * Passive on-call (guardia pasiva): permanent operational availability of a
 * person outside ordinary hours. It is an independent permanent capability —
 * it never replaces anyone and never feeds vacation-coverage simulations or
 * the base holdersOf/capablePeople analysis.
 */
export interface OnCallAssignment {
  id: string;
  personId: string;
  /** Free text coverage scheme: "H24", "Shifts", an organization's own scheme. */
  modality: string;
  /** Free text shift/period: "Night", "Weekend", "Semana 2", … */
  period: string;
  /** Functions/capabilities covered while on call, as concrete tasks. */
  taskIds: string[];
  /** Competencies that enable the person for this on-call function. */
  competencyIds: string[];
}

export interface Db {
  organization: Organization;
  areas: Area[];
  processes: Process[];
  functions: OrgFunction[];
  tasks: Task[];
  roles: Role[];
  people: Person[];
  competencies: Competency[];
  vacationCoverages: VacationCoverage[];
  onCallAssignments: OnCallAssignment[];
}

export type CollectionKey =
  | "processes"
  | "functions"
  | "tasks"
  | "roles"
  | "people"
  | "competencies"
  | "areas"
  | "vacationCoverages"
  | "onCallAssignments";

export type Entity =
  | Process
  | OrgFunction
  | Task
  | Role
  | Person
  | Competency
  | Area
  | VacationCoverage
  | OnCallAssignment;
