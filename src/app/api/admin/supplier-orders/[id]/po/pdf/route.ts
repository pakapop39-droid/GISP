import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { buildSupplierPoPdf, loadSupplierPoDocument, SupplierPoError } from "@/lib/orders/supplier-po";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const detail = await loadSupplierPoDocument(id);
    const pdf = await buildSupplierPoPdf(detail);
    return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${detail.supplierOrder.po_number}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof SupplierPoError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status });
    return apiError(error);
  }
}
