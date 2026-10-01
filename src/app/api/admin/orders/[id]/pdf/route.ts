import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { buildOrderSummaryPdf } from "@/lib/orders/order-summary-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const document = await buildOrderSummaryPdf(id);
    return new NextResponse(Buffer.from(document.pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${document.reference}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
