# GISP Development UAT — Custom R03 Preflight v0.1

วันที่ตรวจ: 2026-09-18 (Asia/Bangkok)  
สถานะ: **STOP ก่อนสร้างธุรกรรม R03 — ต้องมีการตัดสินใจเรื่องราคา Custom แยกต่างหาก**

## อำนาจและขอบเขต

- เจ้าของอนุมัติ D02: “อนุมัติชุดทดสอบ Custom R03 ใน Development” ตาม `GISP-APR-QC-REOPEN-D02-R03-DEVELOPMENT-UAT-20260918-v1.0.md` และแผน `GISP-PLAN-QC-REOPEN-REMAINING-UAT-20260918-v0.1.md` §3–4
- แผนกำหนดให้ใช้ราคาและต้นทุนที่มีอยู่/อนุมัติแล้ว; หาก Custom Quotation ต้องกำหนดราคาใหม่ให้หยุด ไม่ใส่ตัวเลขสมมติเอง
- รอบนี้ตรวจแบบอ่านอย่างเดียว; **ยังไม่สร้าง Project, Custom Request, Quotation, Order หรือ Shipment R03** และไม่แก้ R01/R02/Production

## สิ่งที่พบ

1. หน้า GISP Development ใน Chrome ยังล็อกอินเป็น `Logistic Tong` (บทบาท Logistics); จึงไม่ใช่บัญชีที่ใช้เริ่ม Project/Custom Request หรือจัดทำ Quotation ใน R03
2. โค้ดหน้าสร้าง Custom Quotation กำหนดช่อง `ราคาก่อน VAT` และ `ต้นทุน Supplier (ภายใน)` เป็นช่องตัวเลขบังคับกรอก (`required`, ค่าต้องมากกว่า 0) โดยไม่มีราคาเริ่มต้นจากสินค้า; ดู `src/components/admin-quotation-workspace.tsx` บรรทัด 88 และ 92
3. ค่าทั้งสองถูกส่งเข้า API โดยตรง (`subtotal`, `supplier_cost_total`) ที่ไฟล์เดียวกันบรรทัด 63 และ 67; ตัวเลขใน placeholder ของหน้าจอเป็นเพียงตัวอย่าง ไม่ใช่ราคาที่อนุมัติ
4. Custom Quotation อ้าง Custom Request ที่ผูกกับ Project; ไม่ควรนำใบเสนอราคาหรือคำขอของข้อมูลทดสอบเดิมมาแก้หรืออ้างเป็น R03 โดยไม่อนุมัติขยายขอบเขต

## ผลต่อ AC-06

- **NOT TESTED:** ยังไม่มี R03 fixture และยังไม่ทดสอบ Custom QC, Member approval, Gate หรือ Shipment
- ห้ามสรุปว่า AC-06 หรือ QC Reopen UAT ทั้งชุด PASS จากการตรวจหน้าจอ/โค้ดครั้งนี้

## การตัดสินใจที่ต้องการก่อนเดินต่อ

เจ้าของต้องระบุ **ราคาขายก่อน VAT และต้นทุน Supplier สำหรับ Custom item จำนวน 1 ชิ้น** ที่อนุมัติให้ใช้ใน Development Test หรือชี้ไปยังราคาคู่เดียวกันที่อนุมัติไว้แล้วอย่างระบุแหล่งอ้างอิงชัดเจน พร้อมยืนยันผู้อนุมัติ Custom Quotation ตาม Workflow ปัจจุบัน หากยังไม่ต้องการกำหนดราคา ให้คง R03/AC-06 เป็นค้างทดสอบ

หลังมีมติดังกล่าว ต้องสลับจาก `Logistic Tong` ไปบัญชีภายในที่มีสิทธิ์ที่เหมาะสม; ส่วนบัญชี Member ให้เจ้าของสลับเองตามแผน ไม่มีการเปลี่ยน Role/Permission

**เหลือ 3 ขั้นตอนเพื่อปิด QC Reopen UAT Slice:** (1) อนุมัติราคาทดสอบ Custom/ผู้อนุมัติและตรวจบัญชีที่ใช้ (2) ดำเนิน R03 และเก็บผล AC-06 (3) ตัดสิน UX findings และรับรอง UAT รวม; ไม่มีข้อใดเป็น Production Release Authorization
