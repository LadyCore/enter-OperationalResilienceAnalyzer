/**
 * Access, DEMO and licensing domain types.
 *
 * The backend is the source of truth: the RPC `get_my_access` resolves the
 * signed-in user's status from the database. These types mirror its response.
 */

export type AccessStatus =
  | "owner"
  | "perpetual_active"
  | "subscription_active"
  | "subscription_expired"
  | "demo_active"
  | "demo_expiring"
  | "demo_expired"
  | "none"
  | "anonymous";

export type Modality = "perpetual" | "subscription";
export type TaxType = "dni" | "cuit";
/**
 * License kind that determines the seat cap:
 * "individual" → 1 user, "company" → 4 users. The client document (DNI/CUIT)
 * does NOT determine the kind.
 */
export type LicenseType = "individual" | "company";

export interface MyAccess {
  status: AccessStatus;
  is_owner: boolean;
  user_id?: string;
  email?: string | null;
  modality?: Modality;
  version?: string;
  license_id?: string;
  demo_id?: string;
  days_left?: number;
  started_at?: string;
  expires_at?: string;
  renewal_date?: string | null;
  available_modalities?: Modality[];
  subscription_enabled?: boolean;
}

/** Raw result of the mutation RPCs (request_demo, grant_license, …). */
export interface RpcResult {
  ok: boolean;
  reason?: string;
  demo_id?: string;
  license_id?: string;
  expires_at?: string;
  eligible_after?: string;
  /** Present when the mutation unlocks access (server-computed access state). */
  access?: MyAccess;
}

/* Commercial constants — single source of truth for the UI. */
/** Internal owner account email (used to identify the platform owner). */
export const OWNER_EMAIL = "mariaeugeniasaldi@gmail.com";
/** Public contact address shown for license requests and general contact. */
export const LICENSE_CONTACT_EMAIL = "hola@oraresilience.com";
export const DEMO_DAYS = 15;
export const ELIGIBILITY_MONTHS = 12;
/** Subscription is architected but not enabled commercially yet. */
export const SUBSCRIPTION_ENABLED = false;
export const CURRENT_VERSION = "current";

export const TAX_ID_LABELS: Record<TaxType, string> = {
  dni: "DNI",
  cuit: "CUIT",
};
