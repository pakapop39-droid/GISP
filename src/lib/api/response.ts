import { NextResponse } from "next/server";
import { AppAccessError } from "@/lib/auth/session";
import { isExistingAuthUserError } from "@/lib/auth/auth-errors";

const databaseCodeMap: Record<string, string> = {
  INVALID_INPUT: "INVALID_INPUT",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  LAST_SUPER_ADMIN_PROTECTED: "INVALID_TRANSITION",
  PRODUCT_NOT_READY: "PRODUCT_NOT_READY",
  FILE_LIMIT_REACHED: "FILE_LIMIT_REACHED",
  INVALID_FILE: "INVALID_FILE",
  NOT_FOUND: "NOT_FOUND",
  QUOTATION_NOT_EDITABLE: "INVALID_TRANSITION",
  QUOTATION_NOT_SENDABLE: "INVALID_TRANSITION",
  QUOTATION_NOT_AVAILABLE: "NOT_FOUND",
  CUSTOM_REQUEST_NOT_READY_FOR_QUOTE: "INVALID_TRANSITION",
  ACCEPTED_QUOTATION_IMMUTABLE: "INVALID_TRANSITION",
  REJECTION_REASON_REQUIRED: "INVALID_INPUT",
  SUPPLIER_CANDIDATE_REQUIRED: "INVALID_INPUT",
  QUOTATION_NOT_EXPIRED: "INVALID_TRANSITION",
};

export function apiError(error: unknown) {
  if (error instanceof AppAccessError) {
    return NextResponse.json(
      { code: error.code, message: error.message },
      { status: error.status },
    );
  }
  const sourceMessage =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  const normalizedMessage = sourceMessage.toLowerCase();
  if (isExistingAuthUserError(sourceMessage)) {
    return NextResponse.json(
      {
        code: "ACCOUNT_ALREADY_EXISTS",
        message: "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาใช้อีเมลอื่น หรือจัดการบัญชีเดิมแทนการสร้างซ้ำ",
      },
      { status: 409 },
    );
  }
  if (normalizedMessage.includes("production must be completed before qc")) {
    return NextResponse.json(
      {
        code: "INVALID_TRANSITION",
        message: "ยังบันทึก QC ไม่ได้ กรุณาบันทึกสถานะการผลิตเป็น “ผลิตเสร็จ 100%” ก่อน",
      },
      { status: 409 },
    );
  }
  if (normalizedMessage.includes("permission denied")) {
    return NextResponse.json(
      {
        code: "PERMISSION_DENIED",
        message: "Session ปัจจุบันไม่มีสิทธิ์ทำรายการนี้ กรุณาเข้าสู่ระบบ Admin ใหม่ แล้วโหลดหน้านี้อีกครั้ง",
      },
      { status: 403 },
    );
  }
  const matched = Object.keys(databaseCodeMap).find((code) =>
    sourceMessage.includes(code),
  );
  if (matched) {
    if (matched === "INVALID_INPUT") {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง" },
        { status: 400 },
      );
    }
    const details: Record<string, { message: string; status: number }> = {
      PRODUCT_NOT_READY: { message: "ข้อมูลสินค้ายังไม่ครบ กรุณาตรวจรายการที่ต้องแก้", status: 409 },
      FILE_LIMIT_REACHED: { message: "จำนวนไฟล์ถึงขีดจำกัดแล้ว", status: 409 },
      INVALID_FILE: { message: "ไฟล์ไม่ถูกต้องหรือไม่รองรับ", status: 400 },
      NOT_FOUND: { message: "ไม่พบข้อมูลที่ต้องการ", status: 404 },
    };
    if (details[matched]) {
      return NextResponse.json(
        { code: databaseCodeMap[matched], message: details[matched].message },
        { status: details[matched].status },
      );
    }
    return NextResponse.json(
      {
        code: databaseCodeMap[matched],
        message:
          matched === "LAST_SUPER_ADMIN_PROTECTED"
            ? "ไม่สามารถระงับหรือถอดสิทธิ์ Super Admin คนสุดท้ายได้"
            : matched === "INVALID_TRANSITION"
              ? "สถานะปัจจุบันไม่รองรับการทำรายการนี้"
              : "ไม่มีสิทธิ์ทำรายการนี้",
      },
      { status: matched === "INVALID_TRANSITION" ? 409 : 403 },
    );
  }
  return NextResponse.json(
    { code: "SERVER_ERROR", message: "ระบบไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง" },
    { status: 500 },
  );
}

export function invalidInput(fields?: unknown) {
  return NextResponse.json(
    { code: "INVALID_INPUT", message: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง", fields },
    { status: 400 },
  );
}
