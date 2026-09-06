import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { loadMemberQuotationDetail } from "@/lib/custom-quotation/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json({ data: await loadMemberQuotationDetail(id) });
  } catch (error) { return apiError(error); }
}
