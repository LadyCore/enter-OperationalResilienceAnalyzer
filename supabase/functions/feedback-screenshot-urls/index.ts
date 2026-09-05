// ORA · feedback-screenshot-urls — signed, expiring URLs for viewing the
// screenshots of one feedback report.
//
// Security model:
//  - verify_jwt = true (default) → the caller must present a real user JWT.
//  - A client bound to the caller's token queries the report: RLS
//    (`feedback_select_own_or_owner`) decides whether the caller may see it
//    (the reporter themself or the owner). Unknown/unrelated callers get 404.
//  - Storage keys of that report are signed with the service-role client and
//    returned with a short expiry, so no permanent public URL ever exists for
//    a capture. Legacy base64 entries (`data:...`) are returned untouched and
//    need no signature.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "feedback-screenshots";
const SIGNED_URL_TTL_SECONDS = 3600; // 1h, refreshed every time the detail opens

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("feedback-screenshot-urls: missing env configuration");
    return json(500, { ok: false, error: "Server configuration error." });
  }

  let payload: { reportId?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body." });
  }
  const reportId = typeof payload.reportId === "string" ? payload.reportId.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId)) {
    return json(400, { ok: false, error: "A valid report id is required." });
  }

  // Client bound to the CALLER's token → RLS decides visibility of the report.
  const authHeader = req.headers.get("authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: row, error } = await userClient
    .from("feedback_reports")
    .select("context")
    .eq("id", reportId)
    .maybeSingle();
  if (error) {
    console.error("feedback-screenshot-urls: read failed", error);
    return json(500, { ok: false, error: "Could not read the report." });
  }
  if (!row) return json(404, { ok: false, error: "Report not found." });

  const ctx = row.context as Record<string, unknown> | null;
  const shots = Array.isArray(ctx?.screenshots)
    ? (ctx.screenshots as unknown[]).filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];
  const storagePaths = shots.filter((s) => !s.startsWith("data:"));

  const urls: { path: string; url: string }[] = [];
  if (storagePaths.length > 0) {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    for (const path of storagePaths) {
      const { data, error: signError } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signError) {
        console.error(`feedback-screenshot-urls: sign failed for ${path}`, signError);
        continue;
      }
      urls.push({ path, url: data?.signedUrl ?? "" });
    }
  }

  return json(200, { ok: true, reportId, urls, storageCount: storagePaths.length });
});
