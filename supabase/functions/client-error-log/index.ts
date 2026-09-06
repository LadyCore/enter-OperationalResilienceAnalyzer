// ORA · client-error-log — persist sanitized client-side error reports.
//
// verify_jwt = false (config.toml): errors can happen on public routes before
// login, so the endpoint must accept anonymous calls too. The payload is
// strictly validated/truncated server-side and stored in `client_error_logs`,
// readable only by the ORA owner.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clip = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("client-error-log: missing env configuration");
    return json(500, { ok: false, error: "Server configuration error." });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body." });
  }

  // Resolve the caller user id (best-effort) so owner can correlate accounts.
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  let userId: string | null = null;
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (token) {
      const { data } = await admin.auth.getUser(token);
      userId = data.user?.id ?? null;
    }
  } catch {
    userId = null;
  }

  const row = {
    user_id: userId,
    route: clip(payload.route, 200),
    url: clip(payload.url, 500),
    source: clip(payload.source, 30),
    message: clip(payload.message, 2000),
    stack: clip(payload.stack, 8000),
    user_agent: clip(payload.userAgent, 400),
  };

  const { error } = await admin.from("client_error_logs").insert(row);
  if (error) {
    console.error("client-error-log: insert failed", error);
    return json(500, { ok: false, error: "Could not store the error report." });
  }
  return json(200, { ok: true });
});
