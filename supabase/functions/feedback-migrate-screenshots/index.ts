// ORA · feedback-migrate-screenshots — move legacy base64 screenshots (stored
// as data URLs in feedback_reports.context.screenshots) into the private
// `feedback-screenshots` bucket, replacing each entry with its storage key.
//
// The original data URLs are preserved under `context.screenshotsLegacy` so
// nothing is destroyed until the owner has verified the migrated images in the
// admin panel (H-010). Re-running is idempotent: rows with no `data:` entry
// are skipped, and uploads use upsert so the same key is simply rewritten.
//
// Owner-only: the caller's JWT is used to evaluate the is_owner() RPC before
// anything is read or written. verify_jwt defaults to true (config.toml).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "feedback-screenshots";
const BATCH_SIZE = 25; // rows processed per invocation

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function decodeScreenshotDataUrl(dataUrl: string): Uint8Array {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Not a supported image data URL");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("feedback-migrate-screenshots: missing env configuration");
    return json(500, { ok: false, error: "Server configuration error." });
  }

  // Owner gate via the caller's token (never decided on the client).
  const authHeader = req.headers.get("authorization") ?? "";
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  let owner = false;
  try {
    const { data } = await callerClient.rpc("is_owner");
    owner = data === true;
  } catch (err) {
    console.error("feedback-migrate-screenshots: is_owner check failed", err);
  }
  if (!owner) return json(403, { ok: false, error: "Only the ORA owner can migrate screenshots." });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // Ensure the private bucket exists before writing.
  const { error: getBucketError } = await admin.storage.getBucket(BUCKET);
  if (getBucketError) {
    const { error: createBucketError } = await admin.storage.createBucket(BUCKET, { public: false });
    if (createBucketError) {
      console.error("feedback-migrate-screenshots: bucket creation failed", createBucketError);
      return json(500, { ok: false, error: "Could not prepare screenshot storage." });
    }
  }

  const { data: rows, error: listError } = await admin
    .from("feedback_reports")
    .select("id, context")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (listError) {
    console.error("feedback-migrate-screenshots: list failed", listError);
    return json(500, { ok: false, error: "Could not read the reports." });
  }

  let scanned = 0;
  let migrated = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    scanned += 1;
    const ctx = row.context as Record<string, unknown> | null;
    const shots = Array.isArray(ctx?.screenshots)
      ? (ctx.screenshots as unknown[]).filter((s): s is string => typeof s === "string")
      : [];
    const hasLegacy = shots.some((s) => s.startsWith("data:"));
    if (!hasLegacy) {
      skipped += 1;
      continue;
    }

    // Upload every legacy data URL at its original index; non-data entries
    // (already migrated keys) are kept untouched.
    const next: string[] = [];
    let ok = true;
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      if (!shot.startsWith("data:")) {
        next.push(shot);
        continue;
      }
      try {
        const path = `feedback/${row.id}/${i}.jpg`;
        const { error: uploadError } = await admin.storage
          .from(BUCKET)
          .upload(path, decodeScreenshotDataUrl(shot), { contentType: "image/jpeg", upsert: true });
        if (uploadError) throw uploadError;
        next.push(path);
      } catch (err) {
        ok = false;
        console.error(`feedback-migrate-screenshots: upload failed for report ${row.id} shot ${i}`, err);
        break;
      }
    }
    if (!ok) {
      skipped += 1;
      continue;
    }

    const updatedContext = {
      ...ctx,
      screenshots: next,
      screenshotsLegacy: shots.filter((s) => s.startsWith("data:")),
    };
    const { error: updateError } = await admin
      .from("feedback_reports")
      .update({ context: updatedContext })
      .eq("id", row.id);
    if (updateError) {
      console.error(`feedback-migrate-screenshots: update failed for report ${row.id}`, updateError);
      skipped += 1;
      continue;
    }
    migrated += 1;
  }

  return json(200, { ok: true, scanned, migrated, skipped, batchSize: BATCH_SIZE });
});
