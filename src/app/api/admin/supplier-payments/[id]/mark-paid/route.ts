import { NextResponse } from "next/server";
// Lean fail-closed occurs before any organization_id lookup or
// assertOrganizationPermission call; the deferred path performs no read/write.
export async function POST(..._args: unknown[]) { void _args; return NextResponse.json({ code: "LEAN_SCOPE_DEFERRED", message: "การบันทึกจ่าย Supplier ถูกเลื่อนออกจากช่วงเริ่มต้น" }, { status: 404 }); }
