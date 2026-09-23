import { NextResponse } from "next/server";

function deferred(..._args: unknown[]) {
  void _args;
  return NextResponse.json({ code: "LEAN_SCOPE_DEFERRED", message: "การจ่าย Supplier ใช้วิธีตรวจสอบนอกระบบในช่วงเริ่มต้น" }, { status: 404 });
}
export const GET = deferred;
export const POST = deferred;
