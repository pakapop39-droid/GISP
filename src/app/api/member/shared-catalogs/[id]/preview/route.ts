import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { loadMemberSharedCatalogPreview, requireMember } from "@/lib/shared-catalog/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const context = await requireMember(); const { id } = await params;
    const data = await loadMemberSharedCatalogPreview(id, context.memberProfileId ?? "", {
      search: request.nextUrl.searchParams.get("search") ?? "",
      category: request.nextUrl.searchParams.get("category") ?? "",
      page: Number(request.nextUrl.searchParams.get("page") ?? 1),
      pageSize: Number(request.nextUrl.searchParams.get("pageSize") ?? 24),
    });
    if (!data) return NextResponse.json({ message: "ไม่พบ Catalog" }, { status: 404 });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
