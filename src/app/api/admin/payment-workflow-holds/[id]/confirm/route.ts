import { NextResponse } from "next/server";
export async function POST(..._args: unknown[]) { void _args; return NextResponse.json({ code: "LEAN_SCOPE_DEFERRED", message: "Payment Hold ถูกเลื่อนออกจากช่วงเริ่มต้น" }, { status: 404 }); }
