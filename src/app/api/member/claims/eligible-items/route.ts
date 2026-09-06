import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { loadEligibleDeliveryItems } from "@/lib/claims/server";

export async function GET() {
  try { return NextResponse.json({ data: await loadEligibleDeliveryItems() }); }
  catch (error) { return apiError(error); }
}
