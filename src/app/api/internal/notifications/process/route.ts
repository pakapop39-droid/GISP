import { NextResponse } from "next/server";

async function processJobs() {
  return NextResponse.json(
    { code: "LEAN_SCOPE_DEFERRED", message: "ระบบส่งการแจ้งเตือนถูกปิดในช่วงเริ่มต้นใช้งาน" },
    { status: 404 },
  );
}

export const GET = processJobs;
export const POST = processJobs;
