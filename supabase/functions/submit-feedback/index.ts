// ORA · submit-feedback — persist a feedback report end to end.
//
// H-010 responsibilities:
//  1. Server-side validation (kind, description, mandatory reporter email,
//     1–3 screenshots as JPEG data URLs, per-file byte caps).
//  2. Screenshots are decoded and uploaded to the PRIVATE bucket
//     `feedback-screenshots` under feedback/{reportId}/{i}.jpg. The report row
//     only stores the storage keys (no base64 in the DB anymore).
//  3. The report is inserted with a client-generated id and
//     `ignoreDuplicates`, so retries never create a second report.
//  4. A best-effort confirmation email is sent to the reporter's email AFTER
//     the insert succeeded. Email failures never fail the request; they are
//     logged and recorded in context.confirmation so the owner can see them.
//
// verify_jwt=false in supabase/config.toml: this function is intentionally
// callable before login (anonymous feedback is allowed). The caller identity is
// resolved from the Authorization header when a real user JWT is present;
// otherwise the report is persisted as anonymous (user_id null), mirroring the
// existing RLS insert policy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "feedback-screenshots";

const KINDS = new Set([
  "not_working",
  "error",
  "slow",
  "stuck",
  "suggestion",
  "other",
]);

const KIND_LABELS: Record<string, string> = {
  not_working: "Something isn't working",
  error: "I found an error",
  slow: "The platform is slow",
  stuck: "I can't move forward",
  suggestion: "Improvement suggestion",
  other: "Other",
};

const MIN_SCREENSHOTS = 1;
const MAX_SCREENSHOTS = 3;
const MAX_DESCRIPTION_LENGTH = 4000;
/** Upper bound (bytes) for a decoded screenshot. Compressed shots are far below this. */
const MAX_SCREENSHOT_BYTES = 4_000_000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// SMTP provider — Turbo SMTP (the same secrets the auth mail flow uses).
const SMTP_HOST = "pro.turbo-smtp.com";
const SMTP_PORT = 465;
const FROM = "no-reply@oraresilience.com";

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const badRequest = (message: string): Response => json(400, { ok: false, error: message });

/** Decode `data:image/...;base64,....` into raw bytes; rejects wrong type/format. */
function decodeScreenshotDataUrl(dataUrl: string): Uint8Array {
  if (typeof dataUrl !== "string" || dataUrl.length === 0) {
    throw new Error("A screenshot could not be read. Please try attaching it again.");
  }
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("A screenshot could not be read. Please try attaching it again.");
  }
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (bytes.byteLength > MAX_SCREENSHOT_BYTES) {
    throw new Error("A screenshot is too large. Please try attaching a smaller image.");
  }
  return bytes;
}

/** Resolve the caller user id from the Authorization JWT when present. */
async function resolveCallerUserId(adminClient: ReturnType<typeof createClient>, authHeader: string | null): Promise<string | null> {
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

// ---- minimal raw-SMTP sender (Turbo SMTP over TLS), reusing the pattern that
// smtp-diagnose proved works ------------------------------------------------
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendConfirmationEmail(opts: {
  to: string;
  reportId: string;
  createdAt: string;
  kind: string;
  module: string;
  screenshotCount: number;
}): Promise<void> {
  const user = Deno.env.get("TURBO_SMTP_USER") ?? "";
  const pass = Deno.env.get("TURBO_SMTP_PASSWORD") ?? "";
  if (!user || !pass) throw new Error("TURBO_SMTP_USER / TURBO_SMTP_PASSWORD secrets are missing");

  const kindLabel = KIND_LABELS[opts.kind] ?? opts.kind;
  const moduleLine = opts.module ? `Module: ${opts.module}` : "Module: General feedback";
  const crlf = "\r\n";
  const body =
    "Subject: ORA — We received your feedback" + crlf +
    "From: ORA <no-reply@oraresilience.com>" + crlf +
    `To: <${opts.to}>` + crlf +
    "MIME-Version: 1.0" + crlf +
    "Content-Type: text/plain; charset=utf-8" + crlf +
    "Auto-Submitted: auto-generated" + crlf + crlf +
    "Hello," + crlf + crlf +
    "We received your feedback for ORA. A member of the team will review it." + crlf + crlf +
    `Report ID: ${opts.reportId}` + crlf +
    `Date: ${opts.createdAt}` + crlf +
    `Type: ${kindLabel}` + crlf +
    moduleLine + crlf +
    `Screenshots: received with ${opts.screenshotCount} screenshot${opts.screenshotCount === 1 ? "" : "s"}` + crlf + crlf +
    "You are receiving this message because you submitted feedback in ORA." + crlf +
    "No screenshots or personal content were attached to this email." + crlf + crlf +
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
    console.log(`[smtp ${tag}] ${line}`);
    const cont = line.length > 3 && line[3] === "-";
    if (!cont) return;
  }
  throw new Error(`SMTP ${tag}: too many response lines`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const reportId = typeof payload.reportId === "string" ? payload.reportId.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId)) {
    return badRequest("A valid report id is required.");
  }

  const kind = typeof payload.kind === "string" ? payload.kind : "";
  if (!KINDS.has(kind)) return badRequest("Please choose a valid feedback type.");

  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  if (!description) return badRequest("Please describe what happened.");
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return badRequest(`The description is too long (max ${MAX_DESCRIPTION_LENGTH} characters).`);
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  if (!EMAIL_PATTERN.test(email)) return badRequest("Please provide a valid email to receive the confirmation.");
  if (email.length > 254) return badRequest("The email is too long.");

  const isGeneral = payload.isGeneral === true;
  const module = !isGeneral && typeof payload.module === "string" ? payload.module.slice(0, 120) : null;
  const screen = !isGeneral && typeof payload.screen === "string" ? payload.screen.slice(0, 300) : null;
  const stage = !isGeneral && typeof payload.stage === "string" ? payload.stage.slice(0, 300) : null;
  const rawContext = payload.context;

  // -- screenshots: 1–3 data URLs (frontend already compresses; rule re-checked here)
  const rawShots = Array.isArray(payload.screenshots) ? payload.screenshots : [];
  if (rawShots.length < MIN_SCREENSHOTS) {
    return badRequest("Please attach at least one screenshot to send the report.");
  }
  if (rawShots.length > MAX_SCREENSHOTS) {
    return badRequest(`A maximum of ${MAX_SCREENSHOTS} screenshots is allowed per report.`);
  }
  let decoded: Uint8Array[];
  try {
    decoded = rawShots.map((s) => decodeScreenshotDataUrl(String(s)));
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "A screenshot could not be read.");
  }

  // -- clients
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("submit-feedback: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return json(500, { ok: false, error: "Server configuration error." });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const userId = await resolveCallerUserId(admin, req.headers.get("authorization"));

  // -- idempotency: if the same client-generated report id is already stored,
  // do not insert again and do not re-send the confirmation email.
  const { data: existing, error: existingError } = await admin
    .from("feedback_reports")
    .select("id")
    .eq("id", reportId)
    .maybeSingle();
  if (existingError) {
    console.error("submit-feedback: existence check failed", existingError);
    return json(500, { ok: false, error: "Could not persist the report." });
  }
  if (existing) {
    return json(200, { ok: true, id: reportId, duplicate: true });
  }

  // -- private bucket (created once; keep the call cheap on later runs)
  const { error: getBucketError } = await admin.storage.getBucket(BUCKET);
  if (getBucketError) {
    const { error: createBucketError } = await admin.storage.createBucket(BUCKET, { public: false });
    if (createBucketError) {
      console.error("submit-feedback: bucket creation failed", createBucketError);
      return json(500, { ok: false, error: "Could not prepare screenshot storage." });
    }
  }

  // -- upload screenshots (upsert is safe: the same report id implies the same images)
  const storageKeys: string[] = [];
  for (let i = 0; i < decoded.length; i++) {
    const path = `feedback/${reportId}/${i}.jpg`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, decoded[i], { contentType: "image/jpeg", upsert: true });
    if (uploadError) {
      console.error("submit-feedback: screenshot upload failed", uploadError);
      return json(500, { ok: false, error: "Could not store a screenshot." });
    }
    storageKeys.push(path);
  }

  // -- persist the report (base64 never reaches the DB; only storage keys)
  const contextPayload =
    rawContext && typeof rawContext === "object" && !Array.isArray(rawContext)
      ? (rawContext as Record<string, unknown>)
      : {};
  const rowContext = {
    ...contextPayload,
    screenshots: storageKeys,
    reporterEmail: email,
  };

  const { error: insertError } = await admin
    .from("feedback_reports")
    .insert({
      id: reportId,
      user_id: userId ?? null,
      kind,
      description,
      module,
      screen,
      stage,
      is_general: isGeneral,
      context: rowContext,
    });
  if (insertError) {
    // Rare race with a parallel identical request — treat as duplicate, not failure.
    if (String(insertError.code).startsWith("23505")) {
      return json(200, { ok: true, id: reportId, duplicate: true });
    }
    console.error("submit-feedback: insert failed", insertError);
    return json(500, { ok: false, error: "Could not persist the report." });
  }

  // -- best-effort confirmation email (must not fail the request)
  const createdAt = new Date().toISOString();
  let emailState: "sent" | "failed" = "sent";
  let emailError: string | null = null;
  try {
    await sendConfirmationEmail({
      to: email,
      reportId,
      createdAt,
      kind,
      module: module ?? (isGeneral ? "General feedback" : "Not specified"),
      screenshotCount: storageKeys.length,
    });
    console.log(`submit-feedback: confirmation email sent for report ${reportId} → ${email}`);
  } catch (err) {
    emailState = "failed";
    emailError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`submit-feedback: confirmation email FAILED for report ${reportId} → ${email}`, emailError);
  }

  // Record the email outcome in the row so the owner can audit it.
  const { error: contextUpdateError } = await admin
    .from("feedback_reports")
    .update({
      context: {
        ...rowContext,
        confirmation: {
          state: emailState,
          attemptedAt: new Date().toISOString(),
          to: email,
          ...(emailError ? { error: emailError } : {}),
        },
      },
    })
    .eq("id", reportId);
  if (contextUpdateError) {
    console.error("submit-feedback: could not record email state", contextUpdateError);
  }

  return json(200, { ok: true, id: reportId, duplicate: false, emailState });
});
