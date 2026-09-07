# Development Test Product Cleanup — 7 กันยายน 2569

## ขอบเขต

- ดำเนินการเฉพาะ InsForge Project `gisp-mvp-development` (`kit6y4pj`)
- Production Release A ไม่ถูกแก้ไข
- เกณฑ์ระบุสินค้าทดสอบยืนยันจาก SKU/ชื่อและสคริปต์ UAT ต้นทางของ Slice 2, 3 และ 6

## ผลตรวจสอบก่อนลบ

- สินค้ารวม 726 รายการ
- สินค้าจริงรหัส `CN01-*` จำนวน 722 รายการ
- สินค้าทดสอบที่ไม่ใช่ `CN01-*` จำนวน 4 รายการ

รายการที่ลบ:

1. `S6-UAT-1787994622162` — เก้าอี้ทดสอบ Slice 6
2. `S2-1788402155936` — เก้าอี้ทดสอบ Pricing
3. `S3-UAT-1788402172513` — โซฟา Slice 3 UAT
4. `S6-UAT-1788402217298` — เก้าอี้ทดสอบ Slice 6

## การสำรองและจัดการข้อมูลที่เกี่ยวข้อง

- สำรองสินค้าและข้อมูลที่อ้างถึงทั้งหมดก่อนลบไว้ที่
  `output/backups/pre-delete-development-test-products-2026-09-07.json`
- SHA-256: `1a3f0367f9d1130b9f583e67934141d34b472adc5f126dd014ed984951a57138`
- ยกเลิกการผูกสินค้าออกจาก Project Item ทดสอบ 3 รายการ โดยเก็บ Snapshot และ Order History เดิมไว้
- ลบ Showroom Visit Request ทดสอบ 2 รายการและ Disclosure Grant ทดสอบ 1 รายการที่บังคับให้อ้างถึงสินค้า
- ลบ Product Media Metadata 1 รายการและไฟล์ทดสอบจาก Storage สำเร็จ
- ตารางลูกที่ผูกกับ Product โดย `ON DELETE CASCADE` ถูกล้างพร้อมสินค้า เช่น ราคา ต้นทุน Variant และ Option

## ผลตรวจสอบหลังลบ

- สินค้าเหลือ 722 รายการ และทุก SKU เป็น `CN01-*`
- ค้นด้วย `ทดสอบ`, `UAT` และ SKU ทดสอบเดิมใน Hosted Full Catalog API ได้ HTTP 200 และสินค้า 0 รายการ
- Full Catalog แสดงสินค้าพร้อมขาย 631 รายการ จากเดิม 635 รายการ ตรงกับการลบสินค้า UAT 4 รายการ
- Public API ยังคงตอบ `Cache-Control: no-store`
- Test Product Remaining = 0

ผลคำสั่งฉบับเครื่องอ่านได้:

- `output/development-test-product-cleanup-result-2026-09-07.json`
- `output/hosted-test-product-cleanup-verification-2026-09-07.json`

## สถานะ Slice

- การล้างข้อมูลนี้เป็นงานดูแล Development หลัง UAT และไม่เปลี่ยนขอบเขตของ Slice 12.1
- คงเหลือ 0 ขั้นตอนเพื่อปิด Slice 12.1

