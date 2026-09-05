// ORA · resolve-feedback — mark a feedback report as resolved and delete its
// screenshots.
//
// Behaviour:
//  1. Owner-only (is_owner() RPC evaluated server-side with the caller's JWT;
//     verify_jwt defaults to true).
//  2. Reads the report under RLS (feedback_select_own_or_owner) — never trusts
//     anything from the client except the report id.
//  3. Deletes the report's screenshots from the PRIVATE `feedback-screenshots`
//     bucket. Only storage keys read from that report's `context.screenshots`
//     and scoped to `feedback/{reportId}/` are removed. Legacy inline `data:`
//     entries are not storage objects; they are simply dropped from the context.
//  4. Sets status = 'resolved', clears context.screenshots and records
//     resolvedAt / resolvedBy in the context (no schema change; types.ts is
//     generated and must not be edited).
//  5. Sends a best-effort notification email ONLY to the reporter email stored
//     in the report's context (never from the request). No email → skip.
//  6. Idempotent: re-running after a successful resolution does not re-send
//     the email and treats already-missing objects as success.
//  7. The report row (text/metadata) is preserved as the record of the issue.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "feedback-screenshots";
const SMTP_HOST = "pro.turbo-smtp.com";
const SMTP_PORT = 465;
const FROM = "no-reply@oraresilience.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REPORT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const badRequest = (message: string): Response => json(400, { ok: false, error: message });
const forbidden = (message: string): Response => json(403, { ok: false, error: message });

async function resolveCallerUserId(
  adminClient: ReturnType<typeof createClient>,
  authHeader: string | null,
): Promise<string | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const { data, error } = await adminClient.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

// ---- minimal raw-SMTP sender (Turbo SMTP over TLS) — same mechanism the
// submit-feedback confirmation email uses --------------------------------
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type LineReader = { (): Promise<string> };

async function createLineReader(conn: Deno.Conn): Promise<LineReader> {
  const buffer: string[] = [];
  let pending = "";
  const reader = async (): Promise<string> => {
    for (;;) {
      if (buffer.length > 0) return buffer.shift() as string;
      const nl = pending.indexOf("\n");
      if (nl >= 0) {
        const line = pending.slice(0, nl).replace(/\r$/, "");
        pending = pending.slice(nl + 1);
        if (line) return line;
        continue;
      }
      const chunk = new Uint8Array(4096);
      const n = await conn.read(chunk);
      if (n === null) throw new Error("connection closed by SMTP server");
      pending += decoder.decode(chunk.slice(0, n));
    }
  };
  return reader;
}

async function drainReply(readLine: LineReader, tag: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const line = await readLine();
    console.log(`[resolve-feedback smtp ${tag}] ${line}`);
    const cont = line.length > 3 && line[3] === "-";
    if (!cont) return;
  }
  throw new Error(`SMTP ${tag}: too many response lines`);
}

async function sendResolvedEmail(opts: { to: string; reportId: string }): Promise<void> {
  const user = Deno.env.get("TURBO_SMTP_USER") ?? "";
  const pass = Deno.env.get("TURBO_SMTP_PASSWORD") ?? "";
  if (!user || !pass) throw new Error("TURBO_SMTP_USER / TURBO_SMTP_PASSWORD secrets are missing");

  const crlf = "\r\n";
  const body =
    "Subject: ORA — Your feedback was resolved / Tu comentario fue resuelto" + crlf +
    "From: ORA <no-reply@oraresilience.com>" + crlf +
    `To: <${opts.to}>` + crlf +
    "MIME-Version: 1.0" + crlf +
    "Content-Type: text/plain; charset=utf-8" + crlf +
    "Auto-Submitted: auto-generated" + crlf + crlf +
    "Hello / Hola," + crlf + crlf +
    "Your ORA feedback has been reviewed and marked as resolved." + crlf +
    "Tu comentario de ORA fue revisado y marcado como resuelto." + crlf + crlf +
    `Report ID / ID del informe: ${opts.reportId}` + crlf +
    "The screenshots attached to the report have been deleted." + crlf +
    "Las capturas adjuntas al informe fueron eliminadas." + crlf + crlf +
    "Thank you for helping improve ORA." + crlf +
    "Gracias por ayudar a mejorar ORA." + crlf + crlf +
    "— ORA · Resilience Analyzer" + crlf;

  const conn = await Deno.connectTls({ hostname: SMTP_HOST, port: SMTP_PORT });
  try {
    const readRawLine = await createLineReader(conn);
    await drainReply(readRawLine, "banner");
    const ehloHost = (Deno.env.get("SUPABASE_URL") ?? "ora.local").replace(/^https?:\/\//, "");
    await conn.write(encoder.encode(`EHLO ${ehloHost}${crlf}`));
    await drainReply(readRawLine, "EHLO");

    await conn.write(encoder.encode("AUTH LOGIN" + crlf));
    await drainReply(readRawLine, "AUTH");
    await conn.write(encoder.encode(btoa(user) + crlf));
    await drainReply(readRawLine, "USER");
    await conn.write(encoder.encode(btoa(pass) + crlf));
    await drainReply(readRawLine, "PASS");

    await conn.write(encoder.encode(`MAIL FROM:<${FROM}>${crlf}`));
    await drainReply(readRawLine, "MAIL");
    await conn.write(encoder.encode(`RCPT TO:<${opts.to}>${crlf}`));
    await drainReply(readRawLine, "RCPT");

    await conn.write(encoder.encode("DATA" + crlf));
    await drainReply(readRawLine, "DATA");
    await conn.write(encoder.encode(body + "." + crlf));
    await drainReply(readRawLine, "DATA END");
    try { await conn.write(encoder.encode("QUIT" + crlf)); } catch { /* noop */ }
  } finally {
    try { conn.close(); } catch { /* noop */ }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("resolve-feedback: missing env configuration");
    return json(500, { ok: false, error: "Server configuration error." });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  // Owner gate — never decided on the client.
  let owner = false;
  try {
    const { data } = await callerClient.rpc("is_owner");
    owner = data === true;
  } catch (err) {
    console.error("resolve-feedback: is_owner check failed", err);
  }
  if (!owner) {
    return forbidden("Only the ORA owner can resolve feedback.");
  }

  let payload: { reportId?: unknown };
  try {
    payload = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const reportId = typeof payload.reportId === "string" ? payload.reportId.trim() : "";
  if (!REPORT_ID_PATTERN.test(reportId)) {
    return badRequest("A valid report id is required.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // Report read under RLS (own or owner) — the owner gate above already limits
  // callers, so this is a second, data-level confirmation.
  const { data: row, error: readError } = await callerClient
    .from("feedback_reports")
    .select("id, status, context")
    .eq("id", reportId)
    .maybeSingle();
  if (readError) {
    console.error("resolve-feedback: report read failed", readError);
    return json(500, { ok: false, error: "Could not read the report." });
  }
  if (!row) {
    return json(404, { ok: false, error: "Report not found." });
  }

  const ctx =
    row.context && typeof row.context === "object" && !Array.isArray(row.context)
      ? (row.context as Record<string, unknown>)
      : {};
  const shots = Array.isArray(ctx.screenshots)
    ? (ctx.screenshots as unknown[]).filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];
  const storageKeys = shots.filter((s) => !s.startsWith("data:") && s.startsWith(`feedback/${reportId}/`));
  const reporterEmail = typeof ctx.reporterEmail === "string" ? ctx.reporterEmail.trim() : "";
  const alreadyResolved = typeof ctx.resolvedAt === "string" && ctx.resolvedAt.length > 0;

  // Ensure the private bucket exists (submit-feedback may not have run for legacy rows).
  const { error: getBucketError } = await admin.storage.getBucket(BUCKET);
  if (getBucketError) {
    const { error: createBucketError } = await admin.storage.createBucket(BUCKET, { public: false });
    if (createBucketError) {
      console.error("resolve-feedback: bucket preparation failed", createBucketError);
      return json(500, { ok: false, error: "Could not prepare screenshot storage." });
    }
  }

  const deleteResult = await (async () => {
    if (storageKeys.length === 0) return { removed: 0, ok: true };
    try {
      const { error: removeError } = await admin.storage.from(BUCKET).remove(storageKeys);
      if (removeError) {
        const msg = String(removeError.message ?? removeError).toLowerCase();
        if (msg.includes("not found") || msg.includes("404")) return { removed: storageKeys.length, ok: true };
        console.error("resolve-feedback: storage removal failed", removeError);
        return { removed: 0, ok: false, error: "Could not delete the screenshots." };
      }
      return { removed: storageKeys.length, ok: true };
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      if (msg.includes("not found") || msg.includes("404")) return { removed: storageKeys.length, ok: true };
      console.error("resolve-feedback: storage removal threw", err);
      return { removed: 0, ok: false, error: "Could not delete the screenshots." };
    }
  })();

  if (!deleteResult.ok) {
    return json(500, { ok: false, error: deleteResult.error });
  }

  // Clear dangling references even on an idempotent re-run.
  const needsClear = shots.some((s) => s.startsWith("data:") || s.startsWith(`feedback/${reportId}/`));

  if (alreadyResolved && !needsClear) {
    return json(200, {
      ok: true,
      alreadyResolved: true,
      emailState: "skipped",
      screenshotsRemoved: 0,
    });
  }

  const userId = await resolveCallerUserId(admin, authHeader);
  const nextContext: Record<string, unknown> = {
    ...ctx,
    screenshots: [],
    resolvedAt: new Date().toISOString(),
    resolvedBy: userId ?? null,
  };

  const { error: updateError } = await callerClient
    .from("feedback_reports")
    .update({ status: "resolved", context: nextContext })
    .eq("id", reportId);
  if (updateError) {
    console.error("resolve-feedback: status update failed", updateError);
    return json(500, { ok: false, error: "Could not mark the report as resolved." });
  }

  let emailState: "sent" | "failed" | "none" = "none";
  let emailError: string | null = null;
  if (reporterEmail && EMAIL_PATTERN.test(reporterEmail)) {
    try {
      await sendResolvedEmail({ to: reporterEmail, reportId });
      emailState = "sent";
      console.log(`resolve-feedback: resolved email sent for ${reportId} → ${reporterEmail}`);
    } catch (err) {
      emailState = "failed";
      emailError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error(`resolve-feedback: resolved email FAILED for ${reportId} → ${reporterEmail}`, emailError);
    }
  }

  const { error: emailContextError } = await callerClient
    .from("feedback_reports")
    .update({
      context: {
        ...nextContext,
        emailResult: {
          state: emailState,
          attemptedAt: new Date().toISOString(),
          to: emailState === "none" ? null : reporterEmail,
          ...(emailError ? { error: emailError } : {}),
        },
      },
    })
    .eq("id", reportId);
  if (emailContextError) {
    console.error("resolve-feedback: could not record email state", emailContextError);
  }

  return json(200, {
    ok: true,
    alreadyResolved: false,
    emailState,
    screenshotsRemoved: deleteResult.removed,
  });
});
