// SMTP diagnostic — logs the raw server conversation line by line.
const SMTP_HOST = "smtp.hostinger.com";
const SMTP_PORT = 465;
const FROM = "no-reply@oraresilience.com";
const TO = "ladyqa12@gmail.com";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

Deno.serve(async () => {
  const log: string[] = ["MARKER-v5"];
  let conn: Deno.Conn | null = null;
  try {
    conn = await Deno.connectTls({ hostname: SMTP_HOST, port: SMTP_PORT });

    // Read one raw line from the connection.
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
    // Drain a full reply: read lines until one does NOT end with "-".
    const drainReply = async (tag: string): Promise<string[]> => {
      const lines: string[] = [];
      for (let i = 0; i < 30; i++) {
        const line = await readRawLine();
        lines.push(`${tag} <- ${line}`);
        const cont = line.length > 3 && line[3] === "-";
        if (!cont) break;
      }
      return lines;
    };

    log.push("CONNECT (banner)");
    log.push(...(await drainReply("banner")));

    const ehloHost = (Deno.env.get("SUPABASE_URL") ?? "https://ora.local").replace(/^https?:\/\//, "");
    await conn.write(encoder.encode(`EHLO ${ehloHost}\r\n`));
    log.push(...(await drainReply("EHLO")));

    const user = FROM;
    const pass = Deno.env.get("HOSTINGER_SMTP_PASSWORD") ?? "";

    await conn.write(encoder.encode("AUTH LOGIN\r\n"));
    log.push(...(await drainReply("AUTH")));

    await conn.write(encoder.encode(btoa(user) + "\r\n"));
    log.push(...(await drainReply("USER")));

    await conn.write(encoder.encode(btoa(pass) + "\r\n"));
    log.push(...(await drainReply("PASS")));

    await conn.write(encoder.encode(`MAIL FROM:<${FROM}>\r\n`));
    log.push(...(await drainReply("MAIL")));

    await conn.write(encoder.encode(`RCPT TO:<${TO}>\r\n`));
    log.push(...(await drainReply("RCPT")));

    await conn.write(encoder.encode("DATA\r\n"));
    log.push(...(await drainReply("DATA")));
  } catch (e) {
    log.push(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    try { conn?.close(); } catch { /* noop */ }
  }
  return new Response(JSON.stringify({ log }, null, 2), {
    headers: { "content-type": "application/json" },
  });
});
