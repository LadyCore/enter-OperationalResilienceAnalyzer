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
  roleId: string;
  isActive: boolean;
  competencyIds: string[];
  taskIds: string[];
}

export interface Competency {
  id: string;
  name: string;
  description: string;
}

export interface Db {
  organization: Organization;
  processes: Process[];
  functions: OrgFunction[];
  tasks: Task[];
  roles: Role[];
  people: Person[];
  competencies: Competency[];
}

export type CollectionKey =
  | "processes"
  | "functions"
  | "tasks"
  | "roles"
  | "people"
  | "competencies";

export type Entity = Process | OrgFunction | Task | Role | Person | Competency;
