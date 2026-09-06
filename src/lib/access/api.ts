import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { LicenseType, MyAccess, Modality, RpcResult, TaxType } from "./types";

/** Current user's authoritative access resolution. */
export async function getMyAccess(): Promise<MyAccess> {
  const { data, error } = await supabase.rpc("get_my_access");
  if (error) throw error;
  return (data ?? { status: "none", is_owner: false }) as MyAccess;
}

/** True when the signed-in user is the ORA owner (server-checked). */
export async function isOwner(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_owner");
  if (error) throw error;
  return Boolean(data);
}

export interface ActivateDemoInput {
  taxType: TaxType;
  taxId: string;
  clientName?: string;
}

/** Activate a DEMO (2 days; 15 for internal users). Enforces the 12-month DNI/CUIT reuse rule server-side. */
export async function activateDemo({ taxType, taxId, clientName }: ActivateDemoInput): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("request_demo", {
    p_tax_type: taxType,
    p_tax_id: taxId.trim(),
    p_client_name: clientName?.trim() || undefined,
  });
  if (error) throw error;
  return data as RpcResult;
}

export interface GrantLicenseInput {
  userEmail: string;
  version?: string;
  clientName?: string;
  taxType?: TaxType | null;
  taxId?: string | null;
  /** "individual" → 1 user, "company" → up to 4 users. Defaults server-side to individual. */
  licenseType?: LicenseType | null;
}

/** Owner action: manually grant a perpetual license (no payment involved). */
export async function grantLicense(input: GrantLicenseInput): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("grant_license", {
    p_user_email: input.userEmail.trim(),
    p_modality: "perpetual" as Modality,
    p_version: input.version?.trim() || undefined,
    p_client_name: input.clientName?.trim() || undefined,
    p_tax_type: input.taxType ?? undefined,
    p_tax_id: input.taxId?.trim() || undefined,
    p_license_type: input.licenseType ?? "individual",
  });
  if (error) throw error;
  return data as RpcResult;
}

/**
 * Owner action: associate another ORA account to an existing perpetual license.
 * The seat cap (individual=1, company=4) is enforced server-side and by a DB
 * trigger on license_users.
 */
export async function addLicenseUser(licenseId: string, userEmail: string): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("license_add_user", {
    p_license_id: licenseId,
    p_user_email: userEmail.trim(),
  });
  if (error) throw error;
  return data as RpcResult;
}

/** Owner action: suspend a license. */
export async function revokeLicense(licenseId: string): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("revoke_license", { p_license_id: licenseId });
  if (error) throw error;
  return data as RpcResult;
}

/** Owner action: issue a DEMO for another user, respecting the 12-month rule. */
export async function reissueDemo(input: ActivateDemoInput & { userEmail: string }): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("admin_grant_demo", {
    p_user_email: input.userEmail.trim(),
    p_tax_type: input.taxType,
    p_tax_id: input.taxId.trim(),
    p_client_name: input.clientName?.trim() || undefined,
  });
  if (error) throw error;
  return data as RpcResult;
}

/** Owner-only message shown when a mutation is rejected by the backend. */
export function describeRpcError(result: RpcResult): string {
  switch (result.reason) {
    case "not_eligible":
      return result.eligible_after
        ? `This DNI/CUIT was used for a DEMO in the last 12 months. It becomes eligible again on ${new Date(result.eligible_after).toLocaleDateString()}.`
        : "This DNI/CUIT is not eligible for a new DEMO yet.";
    case "demo_already_active":
      return "A DEMO is already active for this account.";
    case "already_licensed":
      return "This account already has an active license.";
    case "owner":
      return "The ORA owner account does not use DEMO access.";
    case "user_not_found":
      return "No user with that email was found.";
    case "subscription_disabled":
      return "Subscription plans are not available yet.";
    case "forbidden":
      return "Only the ORA owner can perform this action.";
    case "unauthorized":
      return "You must be signed in.";
    default:
      return "The request could not be completed.";
  }
}

/* ------------------------------------------------------------------ */
/* Owner admin overview (RLS-scoped to the owner)                       */
/* ------------------------------------------------------------------ */

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type DemoRow = Database["public"]["Tables"]["demo_sessions"]["Row"];
type LicenseRow = Database["public"]["Tables"]["licenses"]["Row"];
type LicenseUserRow = Database["public"]["Tables"]["license_users"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type UsageRow = Database["public"]["Tables"]["demo_usage_history"]["Row"];

export interface AdminUserView {
  profile: ProfileRow;
  latestDemo: DemoRow | null;
  activeLicense: (LicenseRow & { user_id: string }) | null;
}

export interface AdminOverview {
  users: AdminUserView[];
  licenses: LicenseRow[];
  clients: ClientRow[];
  usageHistory: UsageRow[];
  /** license_id → number of associated users (owner admin view). */
  licenseUserCounts: Record<string, number>;
}

/** Owner-only aggregated view used by the Access & licensing admin page. */
export async function getAdminOverview(): Promise<AdminOverview> {
  const [profiles, demos, licenseUsers, licenses, clients, usageHistory] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("demo_sessions").select("*").order("started_at", { ascending: false }),
    supabase.from("license_users").select("*"),
    supabase.from("licenses").select("*"),
    supabase.from("clients").select("*"),
    supabase.from("demo_usage_history").select("*").order("used_at", { ascending: false }),
  ]);

  for (const [name, res] of Object.entries({ profiles, demos, licenseUsers, licenses, clients, usageHistory })) {
    if (res.error) throw new Error(`Failed to load ${name}: ${res.error.message}`);
  }

  const profileRows = (profiles.data ?? []) as ProfileRow[];
  const demoRows = (demos.data ?? []) as DemoRow[];
  const licenseUserRows = (licenseUsers.data ?? []) as LicenseUserRow[];
  const licenseRows = (licenses.data ?? []) as LicenseRow[];

  const demosByUser = new Map<string, DemoRow>();
  for (const d of demoRows) {
    if (!demosByUser.has(d.user_id)) demosByUser.set(d.user_id, d);
  }

  const activeByUser = new Map<string, LicenseRow & { user_id: string }>();
  for (const lu of licenseUserRows) {
    const license = licenseRows.find((l) => l.id === lu.license_id);
    if (license && license.status === "active" && !activeByUser.has(lu.user_id)) {
      activeByUser.set(lu.user_id, { ...license, user_id: lu.user_id });
    }
  }

  const users: AdminUserView[] = profileRows.map((profile) => ({
    profile,
    latestDemo: demosByUser.get(profile.id) ?? null,
    activeLicense: activeByUser.get(profile.id) ?? null,
  }));

  const licenseUserCounts: Record<string, number> = {};
  for (const lu of licenseUserRows) {
    licenseUserCounts[lu.license_id] = (licenseUserCounts[lu.license_id] ?? 0) + 1;
  }

  return {
    users,
    licenses: licenseRows,
    clients: (clients.data ?? []) as ClientRow[],
    usageHistory: (usageHistory.data ?? []) as UsageRow[],
    licenseUserCounts,
  };
}

