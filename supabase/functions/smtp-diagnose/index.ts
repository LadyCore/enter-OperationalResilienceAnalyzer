// SMTP diagnostic — completes a full send and reports the final server verdict.
// Defaults to Turbo SMTP (the working provider). Credentials come from secrets:
//   TURBO_SMTP_USER = Turbo Consumer Key
//   TURBO_SMTP_PASSWORD = Turbo Consumer Secret
const SMTP_HOST = "pro.turbo-smtp.com";
const SMTP_PORT = 465;
const FROM = "no-reply@oraresilience.com";
const TO = "ladyqa12@gmail.com";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

Deno.serve(async () => {
  const log: string[] = [];
  let conn: Deno.Conn | null = null;
  try {
    conn = await Deno.connectTls({ hostname: SMTP_HOST, port: SMTP_PORT });

    const reader = { buffer: "" };
    const readRawLine = async (): Promise<string> => {
      const chunk = new Uint8Array(4096);
      for (;;) {
        const idx = reader.buffer.indexOf("\n");
        if (idx >= 0) {
          const out = reader.buffer.slice(0, idx).replace(/\r$/, "");
          reader.buffer = reader.buffer.slice(idx + 1);
          return out;
        }
        const n = await conn!.read(chunk);
        if (n === null) throw new Error("connection closed");
        reader.buffer += decoder.decode(chunk.slice(0, n));
      }
    };
    const drainReply = async (tag: string): Promise<void> => {
      for (let i = 0; i < 30; i++) {
        const line = await readRawLine();
        log.push(`${tag} <- ${line}`);
        const cont = line.length > 3 && line[3] === "-";
        if (!cont) return;
      }
    };

    log.push(`CONNECT (banner) to ${SMTP_HOST}:${SMTP_PORT}`);
    await drainReply("banner");

    const ehloHost = (Deno.env.get("SUPABASE_URL") ?? "https://ora.local").replace(/^https?:\/\//, "");
    await conn.write(encoder.encode(`EHLO ${ehloHost}\r\n`));
    await drainReply("EHLO");

    const user = Deno.env.get("TURBO_SMTP_USER") ?? "";
    const pass = Deno.env.get("TURBO_SMTP_PASSWORD") ?? "";
    if (!user || !pass) {
      return new Response(JSON.stringify({ ok: false, log: [...log, "ERROR: missing TURBO_SMTP_USER / TURBO_SMTP_PASSWORD secrets"] }, null, 2), { headers: { "content-type": "application/json" } });
    }

    await conn.write(encoder.encode("AUTH LOGIN\r\n"));
    await drainReply("AUTH");
    await conn.write(encoder.encode(btoa(user) + "\r\n"));
    await drainReply("USER");
    await conn.write(encoder.encode(btoa(pass) + "\r\n"));
    await drainReply("PASS");

    await conn.write(encoder.encode(`MAIL FROM:<${FROM}>\r\n`));
    await drainReply("MAIL");

    await conn.write(encoder.encode(`RCPT TO:<${TO}>\r\n`));
    await drainReply("RCPT");

    await conn.write(encoder.encode("DATA\r\n"));
    await drainReply("DATA");

    const CRLF = "\r\n";
    const body =
      "Subject: ORA account verification test" + CRLF +
      "From: ORA <no-reply@oraresilience.com>" + CRLF +
      "To: <ladyqa12@gmail.com>" + CRLF +
      "MIME-Version: 1.0" + CRLF +
      "Content-Type: text/plain; charset=utf-8" + CRLF + CRLF +
      "Please confirm your ORA account by opening the link below." + CRLF +
      "https://ora.example/confirm" + CRLF + CRLF +
      "If you did not create this account, ignore this message." + CRLF +
      "ORA — Resilience Analyzer" + CRLF +
      "." + CRLF;
    await conn.write(encoder.encode(body));
    await drainReply("DATA END (final verdict)");

    try { await conn.write(encoder.encode("QUIT\r\n")); } catch { /* noop */ }
  } catch (e) {
    log.push(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    try { conn?.close(); } catch { /* noop */ }
  }
  return new Response(JSON.stringify({ ok: true, log }, null, 2), {
    headers: { "content-type": "application/json" },
  });
});
