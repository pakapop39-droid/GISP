# Slice 11 — Material Samples and Partner Warranty

วันที่เริ่ม: 1 กันยายน 2569  
Backend Branch: `slice-11-samples-warranty`  
Production: ไม่อยู่ในขอบเขต

## เป้าหมาย

ปิดช่องว่าง Core MVP สองเรื่องสุดท้ายที่เชื่อมกับ Catalog, Order และ Claim:

1. Material Sample และ Built-in Display
2. Partner Warranty แบบ Version และ Immutable Order Snapshot

## Business Rules ที่ล็อกใช้

- Sample มีเพียง `MATERIAL_SWATCH` และ `BUILT_IN_DISPLAY`
- Built-in Display ต้องผูกกับ Product ประเภท `BUILT_IN`; ห้ามนำเฟอร์นิเจอร์ทั่วไปมาใช้แทน
- Member เห็นเฉพาะชื่อ Sample, ประเภท, สถานะ, ประเทศ/เมือง และ Public Location Label
- Member ต้องไม่เห็น Supplier ID/Name, ที่อยู่, Contact, Shelf Location หรือ Internal Note
- Warranty เริ่มเป็น Draft และต้องกด Activate โดยผู้มีสิทธิ์ก่อนใช้งาน
- ต่อ Supplier/Product มี Active Warranty ได้เพียงหนึ่ง Version
- การ Activate Version ใหม่ทำให้ Version เดิมเป็น Retired โดยไม่แก้ประวัติเดิม
- เมื่อสร้าง Order Item ระบบเก็บ Warranty Version และ Terms Snapshot ทันที
- Snapshot ของ Order Item และ Claim ห้ามแก้ย้อนหลัง แม้ Warranty Master เปลี่ยน
- Claim ใช้ Snapshot จาก Order Item เป็นหลัก ไม่ดึง Active Warranty ใหม่
- ระบบแนะนำผู้รับผิดชอบได้ แต่ Order Admin ต้องยืนยัน และไม่มี Automatic Compensation

## Definition of Done

- Admin สร้าง Location, Sample และ Warranty Draft ได้
- Admin เปลี่ยนสถานะ Sample และ Activate/Retire Warranty ได้พร้อม Audit Trail
- Member เปิด Product แล้วเห็น Sample/Location แบบ Member-safe และ Active Warranty
- Order Item ใหม่มี Immutable Warranty Snapshot
- Claim ใหม่คัดลอก Snapshot จาก Order Item เดิม
- RLS/Permission และ Confidential-field Isolation ผ่าน Integration Test
- TypeScript, Unit Test, Lint และ Production Build ผ่าน
- Branch Preview และ Hosted Smoke ผ่านก่อนส่ง Human UAT

## Human UAT ที่จะส่งมอบ

- Admin: สร้าง Material Swatch, Built-in Display และ Warranty Version ใหม่
- Admin: Activate Warranty และตรวจ Version เดิมถูก Retire
- Member: ตรวจ Sample/Location และ Warranty โดยไม่เห็นข้อมูล Supplier ภายใน
- ตรวจ Order/Claim Fixture ว่า Snapshot เดิมไม่เปลี่ยนหลัง Activate Warranty Version ใหม่

