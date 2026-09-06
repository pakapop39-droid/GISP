import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { loadAdminOrderDetail } from "@/lib/orders/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ data: await loadAdminOrderDetail(id) });
  } catch (error) {
    return apiError(error);
  }
}
