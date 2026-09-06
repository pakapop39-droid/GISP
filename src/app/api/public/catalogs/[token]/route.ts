import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { loadPublicSharedCatalog } from "@/lib/shared-catalog/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };
    if (!/^[a-f0-9]{48}$/.test(token)) return NextResponse.json({ message: "ไม่พบ Catalog" }, { status: 404, headers });
    const data = await loadPublicSharedCatalog(token, {
      search: _request.nextUrl.searchParams.get("search") ?? "",
      category: _request.nextUrl.searchParams.get("category") ?? "",
      page: Number(_request.nextUrl.searchParams.get("page") ?? 1),
      pageSize: Number(_request.nextUrl.searchParams.get("pageSize") ?? 24),
    });
    if (!data) return NextResponse.json({ message: "Catalog นี้ไม่มีให้เปิดดูแล้ว" }, { status: 404, headers });
    return NextResponse.json({ data }, { headers });
  } catch (error) {
    return apiError(error);
  }
}
