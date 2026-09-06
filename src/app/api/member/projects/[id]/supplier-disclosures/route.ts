import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ message: "Supplier จะเปิดเผยอัตโนมัติเมื่อการเยี่ยมชมเสร็จสิ้น ไม่ต้องส่งคำขอแยก" }, { status: 410 });
}
