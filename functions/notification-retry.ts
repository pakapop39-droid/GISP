import { createAdminClient } from "npm:@insforge/sdk@1.5.1";

type NotificationJob = {
  id: string;
  recipient: string;
  subject: string | null;
  html_body: string | null;
  attempts: number;
};

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Cron-Secret",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export default async function notificationRetry(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ message: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("CRON_SECRET");
  const authorization = req.headers.get("authorization");
  const suppliedSecret =
    req.headers.get("x-cron-secret") ?? authorization?.replace(/^Bearer\s+/i, "");

  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return jsonResponse({ message: "Unauthorized" }, 401);
  }

  const baseUrl = Deno.env.get("INSFORGE_BASE_URL");
  const apiKey = Deno.env.get("API_KEY");
  if (!baseUrl || !apiKey) {
    return jsonResponse({ message: "Runtime configuration is incomplete" }, 500);
  }

  const admin = createAdminClient({ baseUrl, apiKey });
  const { data, error } = await admin.database
    .from("notification_jobs")
    .select("id,recipient,subject,html_body,attempts")
    .in("status", ["PENDING", "FAILED"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    return jsonResponse({ message: error.message ?? "Cannot load jobs" }, 500);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of (data ?? []) as NotificationJob[]) {
    const claim = await admin.database
      .from("notification_jobs")
      .update({ status: "PROCESSING" })
      .eq("id", job.id)
      .in("status", ["PENDING", "FAILED"])
      .select("id");

    if (claim.error || !claim.data?.length) {
      skipped += 1;
      continue;
    }

    const result = await admin.emails.send({
      to: job.recipient,
      subject: job.subject ?? "GISP Notification",
      html: job.html_body ?? "<p>GISP Notification</p>",
      from: "GISP Operations",
    });

    if (result.error) {
      failed += 1;
      const attempts = job.attempts + 1;
      const retryMinutes = Math.min(2 ** attempts * 5, 360);
      await admin.database
        .from("notification_jobs")
        .update({
          status: attempts >= 5 ? "DEAD" : "FAILED",
          attempts,
          last_error: result.error.message,
          next_attempt_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
        })
        .eq("id", job.id);
      continue;
    }

    sent += 1;
    const sentData = result.data as { id?: string } | null;
    await admin.database
      .from("notification_jobs")
      .update({
        status: "SENT",
        attempts: job.attempts + 1,
        provider_message_id: sentData?.id ?? null,
        sent_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", job.id);
  }

  return jsonResponse({ processed: (data ?? []).length, sent, failed, skipped });
}
