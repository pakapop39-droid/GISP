import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { buildQuotationPdf } from "@/lib/custom-quotation/pdf";
import { loadAdminQuotationDetail, loadMemberQuotationDetail } from "@/lib/custom-quotation/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireAppAccess({ active: true });
    const detail = context.roles.includes("MEMBER")
      ? await loadMemberQuotationDetail(id)
      : await loadAdminQuotationDetail(id);
    const bytes = await buildQuotationPdf(detail);
    const filename = `${detail.quotation.quotation_number}-R${detail.quotation.version}.pdf`.replace(/[^A-Za-z0-9._-]/g, "-");
    return new Response(Uint8Array.from(bytes).buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) { return apiError(error); }
}
