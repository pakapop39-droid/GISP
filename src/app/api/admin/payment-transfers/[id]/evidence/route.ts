import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAppAccess({ active: true, permissions: ["payments.verify"] });
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "รายการสลิปไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const admin = createInsForgeAdminClient();
    const transfer = await admin.database
      .from("payment_transfers")
      .select("id,evidence_file_id")
      .eq("id", id)
      .maybeSingle();
    if (transfer.error) throw transfer.error;
    if (!transfer.data?.evidence_file_id) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "ไม่พบหลักฐานการโอน" },
        { status: 404 },
      );
    }

    const file = await admin.database
      .from("file_metadata")
      .select("id,bucket,object_key,entity_type")
      .eq("id", transfer.data.evidence_file_id)
      .eq("entity_type", "CUSTOMER_PAYMENT_EVIDENCE")
      .maybeSingle();
    if (file.error) throw file.error;
    if (!file.data) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "ไม่พบไฟล์หลักฐานการโอน" },
        { status: 404 },
      );
    }

    const signed = await admin.storage
      .from(file.data.bucket)
      .createSignedUrl(file.data.object_key, 300);
    if (signed.error || !signed.data) {
      throw signed.error ?? new Error("SIGNED_URL_FAILED");
    }
    return NextResponse.redirect(signed.data.signedUrl);
  } catch (error) {
    return apiError(error);
  }
}
