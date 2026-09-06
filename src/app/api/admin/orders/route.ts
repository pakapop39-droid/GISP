import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { loadAdminOrders } from "@/lib/orders/server";

export async function GET() {
  try {
    return NextResponse.json({ data: await loadAdminOrders() });
  } catch (error) {
    return apiError(error);
  }
}
