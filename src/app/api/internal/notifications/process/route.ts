import { NextResponse, type NextRequest } from "next/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

type NotificationJob = {
  id: string;
  recipient: string;
  subject: string | null;
  html_body: string | null;
  attempts: number;
};

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return (
    Boolean(secret) &&
    (request.headers.get("authorization") === `Bearer ${secret}` ||
      request.headers.get("x-cron-secret") === secret)
  );
}

async function processJobs(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const admin = createInsForgeAdminClient();
  const { data, error } = await admin.database
    .from("notification_jobs")
    .select("id, recipient, subject, html_body, attempts")
    .in("status", ["PENDING", "FAILED"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { message: error.message ?? "Cannot load jobs" },
      { status: 500 },
    );
  }

  let sent = 0;
  let failed = 0;
  for (const job of (data ?? []) as NotificationJob[]) {
    await admin.database
      .from("notification_jobs")
      .update({ status: "PROCESSING" })
      .eq("id", job.id);

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
          next_attempt_at: new Date(
            Date.now() + retryMinutes * 60_000,
          ).toISOString(),
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

  return NextResponse.json({
    processed: (data ?? []).length,
    sent,
    failed,
  });
}

export const GET = processJobs;
export const POST = processJobs;
