import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { loadPublicSharedCatalogItem } from "@/lib/shared-catalog/server";

const publicHeaders = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; itemId: string }> },
) {
  try {
    const { token, itemId } = await params;
    if (!/^[a-f0-9]{48}$/.test(token) || !/^[0-9a-f-]{36}$/.test(itemId)) {
      return NextResponse.json({ message: "ไม่พบสินค้า" }, { status: 404, headers: publicHeaders });
    }
    const data = await loadPublicSharedCatalogItem(token, itemId);
    if (!data) {
      return NextResponse.json({ message: "ไม่พบสินค้า" }, { status: 404, headers: publicHeaders });
    }
    return NextResponse.json({ data }, { headers: publicHeaders });
  } catch (error) {
    return apiError(error);
  }
}
