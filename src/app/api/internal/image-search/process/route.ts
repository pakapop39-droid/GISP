import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { imageSearchDatabaseEnabled } from "@/lib/catalog/image-search-server";
import { runImageSearchWorker } from "@/lib/catalog/image-search-worker";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  const secret = process.env.IMAGE_SEARCH_CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!imageSearchDatabaseEnabled()) return NextResponse.json({ message: "Disabled" }, { status: 404 });
  try { return NextResponse.json({ data: await runImageSearchWorker() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ message: "Image indexing unavailable" }, { status: 503 }); }
}
