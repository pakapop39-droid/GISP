import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { loadClaimDetail } from "@/lib/claims/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return NextResponse.json({ data: await loadClaimDetail(id, "member") }); }
  catch (error) { return apiError(error); }
}
