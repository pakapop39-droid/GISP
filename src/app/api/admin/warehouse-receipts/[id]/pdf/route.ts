import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { buildWarehouseReceiptPdf, loadWarehouseReceiptDocument, WarehouseReceiptError } from "@/lib/orders/warehouse-receipt";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const detail = await loadWarehouseReceiptDocument(id);
    const pdf = await buildWarehouseReceiptPdf(detail);
    return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${detail.receipt.receipt_number}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof WarehouseReceiptError) return NextResponse.json({ code: "NOT_FOUND", message: error.message }, { status: error.status });
    return apiError(error);
  }
}
