# Slice 11 — Samples & Partner Warranty Human UAT

**สถานะ:** `HUMAN UAT PASSED · OWNER APPROVED`  
**Backend Branch:** `slice-11-samples-warranty`  
**Preview:** https://kit6y4pj-tvr.insforge.site  
**Production:** ไม่ได้เปลี่ยนแปลง

## บัญชีทดสอบ

- Admin: `uat-admin-all@gisp.example.com`
- Member: `uat-member-all@gisp.example.com`
- ใช้รหัส UAT กลางเดียวกับ Slice ก่อนหน้า ซึ่งเก็บใน Secret `GISP_UAT_PASSWORD`

> หากเปลี่ยนจาก Admin เป็น Member ให้กดออกจากระบบก่อน เพื่อไม่ให้ Cookie ของสองบทบาทปะปนกัน

## ข้อมูลที่เตรียมไว้

- Material: ค้นหา SKU ขึ้นต้น `S11-MAT-`
- Built-in: ค้นหา SKU ขึ้นต้น `S11-BIN-`
- ตัวอย่าง 2 แบบ: `ตัวอย่างวัสดุ` และ `ชุดตัวอย่าง Built-in`
- Warranty V1: Active 24 เดือน
- Warranty V2: Draft 36 เดือน รอทดสอบ Activate

## UAT Admin

1. เปิด [หน้าตัวอย่างสินค้าและการรับประกัน](https://kit6y4pj-tvr.insforge.site/admin/catalog/samples-warranty) แล้วล็อกอิน Admin
2. ยืนยันว่าเห็นตัวอย่าง 2 รายการ และแต่ละรายการมีชื่อ ประเภท สินค้า สถานที่ และสถานะ
3. เปลี่ยนสถานะตัวอย่างรายการหนึ่งเป็น `ถูกยืม` แล้วเปลี่ยนกลับเป็น `พร้อมให้บริการ`
4. ในแบบฟอร์มลงทะเบียนตัวอย่าง เลือกสินค้า Material และยืนยันว่า `ชุดตัวอย่าง Built-in` เลือกไม่ได้
5. ตรวจรายการ Warranty: V1 ต้องเป็น `ใช้งานอยู่` และ V2 ต้องเป็น `ฉบับร่าง`
6. กด `Activate` ที่ V2 แล้วยืนยันว่า V2 เป็น `ใช้งานอยู่` และ V1 เป็น `ยกเลิกใช้แล้ว`

## UAT Member

7. ออกจากระบบ Admin แล้วล็อกอิน Member เปิด [Member Catalog](https://kit6y4pj-tvr.insforge.site/member/catalog)
8. ค้นหา SKU ขึ้นต้น `S11-BIN-` เปิดสินค้า และตรวจว่าเห็น:
   - ชุดตัวอย่าง Built-in พร้อมสถานที่สาธารณะและสถานะ
   - Warranty V2 ระยะ 36 เดือนและเงื่อนไขฉบับเต็ม
9. ยืนยันว่าไม่เห็นชื่อ Supplier, ที่อยู่จริง, ผู้ติดต่อ, เบอร์โทร, อีเมล, ตำแหน่งชั้นวาง หรือหมายเหตุภายใน
10. กลับ Catalog ค้นหา SKU ขึ้นต้น `S11-MAT-` และยืนยันว่าเห็น `ตัวอย่างวัสดุ` ไม่ใช่ Built-in Display

## สิ่งที่ Automated Test ยืนยันแทนการแก้ข้อมูลด้วยคน

- Built-in Display ผูกได้เฉพาะสินค้า `BUILT_IN`
- Member เรียก Action เปลี่ยนสถานะตัวอย่างไม่ได้
- Activate Warranty ใหม่จะ Retire ฉบับเดิมอัตโนมัติ
- Order Item เก็บ Warranty Snapshot ณ เวลาสั่งซื้อและแก้ย้อนหลังไม่ได้
- Claim ใช้ Snapshot จาก Order แม้ Warranty ปัจจุบันเปลี่ยนแล้ว
- การเปิด Claim ไม่อนุมัติ Compensation อัตโนมัติ

เมื่อตรวจครบ ให้ตอบในแชตว่า **“ทำครบแล้ว”** หรือแจ้งจุดที่ต้องแก้พร้อมภาพหน้าจอ

## ผลตรวจรับ

- Human UAT ผ่านครบ Admin และ Member เมื่อ 2 กันยายน 2569
- เจ้าของระบบอนุมัติโดยแจ้ง “ทำครบแล้ว อนุมัติผล UAT Slice 11”
- หลักฐาน: [Slice 11 Samples & Partner Warranty](../evidence/2026-09-02-slice-11-samples-warranty.md)
- Development Release ผ่านแล้ว: `SLICE_11_ACCEPTED` / `DONE`
- Production ไม่ถูกเปลี่ยนแปลง
