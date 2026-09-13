import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isPdfCatalogImportEnabled } from "@/lib/catalog/pdf-import";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export const runtime = "nodejs";
export const maxDuration = 1_600;

const runSeconds = 25 * 60;

function authorized(request: NextRequest) {
  const secret = process.env.PDF_WORKER_WAKE_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return !!secret && Buffer.byteLength(supplied) === Buffer.byteLength(expected)
    && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isPdfCatalogImportEnabled()) return NextResponse.json({ message: "Disabled" }, { status: 404 });
  const workerUrl = process.env.PDF_WORKER_URL?.replace(/\/$/, "");
  const workerToken = process.env.PDF_WORKER_TOKEN;
  const hourlyRate = Number(process.env.PDF_COMPUTE_USD_PER_HOUR);
  if (!workerUrl || !workerToken || !Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    return NextResponse.json({ code: "COMPUTE_CAP_UNVERIFIED", message: "ยังไม่เปิดปลุก Worker จนกว่าจะกำหนดอัตราค่า Compute ที่ตรวจสอบได้" }, { status: 503 });
  }
  const reservationUsd = Number(((hourlyRate * runSeconds) / 3_600).toFixed(6));
  if (reservationUsd <= 0 || reservationUsd > 20) return NextResponse.json({ code: "COMPUTE_CAP_UNVERIFIED", message: "ค่า Compute reservation ไม่ปลอดภัย" }, { status: 503 });
  const admin = createInsForgeAdminClient();
  const action = request.nextUrl.searchParams.get("action") === "cleanup" ? "cleanup" : "run";
  if (action === "run") {
    const [pending, expired] = await Promise.all([
      admin.database.from("catalog_import_pages").select("id").eq("status", "PENDING").limit(1),
      admin.database.from("catalog_import_pages").select("id").eq("status", "LEASED").lt("lease_expires_at", new Date().toISOString()).limit(1),
    ]);
    if (pending.error || expired.error) return NextResponse.json({ code: "QUEUE_CHECK_FAILED", message: "ตรวจคิว PDF ไม่สำเร็จ" }, { status: 503 });
    if (!pending.data?.length && !expired.data?.length) return NextResponse.json({ data: { claimed: 0, wakeSkipped: true } }, { headers: { "Cache-Control": "no-store" } });
  }
  const workerId = `wake-${crypto.randomUUID()}`;
  const reserved = await admin.database.rpc("reserve_catalog_pdf_compute_run", { worker_id_input: workerId, reserved_usd_input: reservationUsd });
  if (reserved.error || !reserved.data?.runId) {
    return NextResponse.json({ code: "COMPUTE_BUDGET_EXCEEDED", message: "งบ Compute รายเดือนไม่พอสำหรับรอบใหม่" }, { status: 429 });
  }
  const started = performance.now();
  let succeeded = false;
  let jobIds: string[] = [];
  let result: Record<string, unknown> = {};
  try {
    const response = await fetch(`${workerUrl}/${action}`, { method: "POST", headers: { Authorization: `Bearer ${workerToken}` }, signal: AbortSignal.timeout((runSeconds + 30) * 1_000) });
    if (!response.ok) throw new Error(`WORKER_${response.status}`);
    result = await response.json() as Record<string, unknown>;
    jobIds = Array.isArray(result.jobIds) ? result.jobIds.filter((value): value is string => typeof value === "string") : [];
    succeeded = true;
    return NextResponse.json({ data: { ...result, computeWarning80Percent: reserved.data.warning80Percent, computeProjectedUsd: reserved.data.projectedUsd } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ code: "WORKER_UNAVAILABLE", message: "Worker PDF ไม่พร้อมใช้งาน" }, { status: 503 });
  } finally {
    const elapsedUsd = Number(((Math.max(performance.now() - started, 1_000) / 3_600_000) * hourlyRate).toFixed(6));
    const actualUsd = succeeded ? Math.min(reservationUsd, elapsedUsd) : reservationUsd;
    await admin.database.rpc("finalize_catalog_pdf_compute_run", { run_id_input: reserved.data.runId, actual_usd_input: actualUsd, succeeded_input: succeeded, job_ids_input: jobIds });
  }
}
