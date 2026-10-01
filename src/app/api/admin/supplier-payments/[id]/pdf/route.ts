import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { buildSupplierPaymentPdf, SupplierPaymentDocumentError } from "@/lib/orders/supplier-payment-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const document = await buildSupplierPaymentPdf(id);
    return new NextResponse(Buffer.from(document.pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${document.reference}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof SupplierPaymentDocumentError) return NextResponse.json({ code: "NOT_FOUND", message: error.message }, { status: error.status });
    return apiError(error);
  }
}
