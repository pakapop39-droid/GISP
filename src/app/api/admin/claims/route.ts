import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { loadAdminClaims } from "@/lib/claims/server";

export async function GET() {
  try { return NextResponse.json({ data: await loadAdminClaims() }); }
  catch (error) { return apiError(error); }
}
