# GISP — แผนปิด UAT ที่ค้างของ QC Reopen (AC-05/AC-06) v0.1

วันที่จัดทำ: 2026-09-18 (Asia/Bangkok)  
สถานะ: **เสนอให้เจ้าของตัดสินใจ / Planning only** — เอกสารนี้ไม่อนุญาตให้สร้างบัญชี เปลี่ยนสิทธิ์ สร้างธุรกรรม แก้โค้ด Apply Migration หรือ Deploy

## 1. เป้าหมายและฐานที่ตรวจแล้ว

- เป้าหมาย: ปิดเฉพาะช่องว่าง AC-05 เรื่อง “ต่างองค์กร” และ AC-06 เรื่อง Custom Member approval/Shipment ปกติ จาก `GISP-PLAN-QC-REOPEN-DR024-R02-20260918-v0.1.md`
- Development R02 (`ORD-2026-000011`, `SHP-2026-000005`) ทดสอบ AC-02 กดซ้ำ, AC-05 หลัง Dispatch/คำสั่งแข่งกัน และ AC-06 เส้นทาง STANDARD บางส่วนแล้ว; Shipment R02 เป็น `DISPATCHED` แบบจำลอง ห้ามย้อนหรือลบ
- บัญชี `Logistic Tong` ซึ่งไม่มี `qc.manage` ถูก API ปฏิเสธ HTTP 403 และไม่เกิด Audit/QC ใหม่; หลักฐานใน `GISP-UAT-QC-REOPEN-DR024-R02-20260918-v0.3-AC05-PERMISSION-ADDENDUM.md`
- ตรวจแบบอ่านอย่างเดียวพบ Custom order item เดิม 2 รายการเป็น `MEMBER_APPROVED` แล้ว ทั้งสองเป็นข้อมูลทดสอบ Slice 7 เดิม **ไม่ใช่ fixture ที่อนุมัติให้แก้ในรอบนี้**
- Source of Truth `docs/active/MVP BUSINESS MASTER PLAN.md` §0.5, §17 กำหนด Gate 4 ข้อและให้ Member อนุมัติ Custom หลังทีม QC ผ่าน โดยไม่อนุมัติอัตโนมัติ

## 2. ประเด็น D01 — ความหมาย “QC ผิดองค์กร” ใน AC-05

**ข้อเท็จจริงที่มีผลต่อการตัดสินใจ:** `public.has_permission(permission_code, target_organization_id)` อนุญาต role ที่ `organization_id IS NULL` ใช้งานข้ามองค์กรตามแบบ Global; `assign_production_role` ในหน้าจอจัดการบทบาทสร้าง role แบบ Global; บัญชี QC ที่ Active ใน Development ไม่มี role แบบจำกัดองค์กรเลย ขณะที่ `reopen_qc_inspection` ตรวจ `qc.manage` เทียบกับองค์กรของ Order จริง ดังนั้น “ผู้มี QC แต่ผิดองค์กร” ไม่มีตัวแทนอยู่ในรูปแบบบัญชีที่ App ใช้อยู่ปัจจุบัน การเพิ่มบัญชีแบบ scoped เพื่อให้ทดสอบได้ไม่ใช่แค่สลับ Login

| ทางเลือก | ความหมายและผลต่อ Slice |
|---|---|
| **D01-A (แนะนำเพื่อยึด App baseline)** | เจ้าของยืนยันว่า QC ภายในแบบ Global ทำงานได้กับทุกองค์กร; ปรับคำอธิบาย AC-05 ว่า “บัญชีที่ไม่มี `qc.manage` ต้องถูกปฏิเสธ และบทบาทแบบจำกัดองค์กร *ถ้ามีในอนาคต* ต้องไม่ข้ามองค์กร” กรณีไม่มีสิทธิ์มี UAT PASS แล้ว; cross-org scoped = **N/A สำหรับการตั้งค่าปัจจุบัน**, ไม่เรียกว่า PASS และเก็บเป็น Future security test. ไม่เปลี่ยน App/Role/Permission |
| **D01-B (คง AC เดิมและพิสูจน์ scoped role)** | จัดทำแผนแยกสำหรับ fixture ทดสอบใน backend branch/สภาพแวดล้อมแยก: test organization A/B, test user ที่มี QC เฉพาะ A, positive control ใน A และ negative request ต่อ B ที่ต้องได้ 403 โดยไม่มี Audit. ต้องตรวจความพร้อมของ auth/branch และขอ Implementation Authorization สำหรับ fixture/cleanup ก่อน; ผล branch ไม่เท่ากับ Hosted Development UAT โดยอัตโนมัติ. หากต้องพิสูจน์บน Hosted Development จริง ต้องอนุมัติบัญชี/องค์กร/role แบบ scoped และวิธีจัดการที่ App ปัจจุบันยังไม่รองรับแยกต่างหาก |

**ข้อห้าม:** ห้ามเอา Global QC account ไปเรียกว่า “ผิดองค์กร”; ห้ามเพิ่มสิทธิ์ให้บัญชีจริงหรือแก้ `role_permissions` เพื่อทำให้ผลทดสอบผ่าน; ห้ามใช้ SQL `project_admin` จำลองเป็นหลักฐาน authenticated UAT

## 3. ประเด็น D02 — ชุดทดสอบ Custom สำหรับ AC-06

เสนอสร้างชุดใหม่ **R03** ใน GISP Development เท่านั้น เพื่อไม่แตะ R01/R02 หรือ Custom orders เดิม:

- ป้ายอ้างอิง: `DRYRUN-R03-PRJ-001`, `DRYRUN-R03-CUSTOM-001`, `DRYRUN-R03-ORD-001`, `DRYRUN-R03-SHP-001`; ใช้ Custom item **1 ชิ้น** และ Member/Supplier ทดสอบเดิมที่ตรวจสิทธิ์ได้
- สร้างผ่าน Workflow ของ App: Project → Custom Request → Quotation ที่อนุมัติ → Order → Deposit 50% → Supplier PO → Production/QC → Member decision → Balance 50%/Dispatch Gate → Shipment
- ใช้ราคา ภาษี Payment Term และ Freight ที่ระบบมีอยู่/อนุมัติแล้ว; **ถ้าการออก Custom Quotation ต้องกำหนดราคาใหม่หรือผู้อนุมัติใหม่ ให้หยุดและขอเจ้าของตัดสิน ไม่ใส่ตัวเลขสมมติแทน**; ไม่มีเงินจริงหรือสินค้าจริง
- ผลิต/QC/หลักฐานทุกอย่างต้องระบุ `Development Test` ชัดเจน และใช้ข้อมูลจำลองที่ไม่อ้างว่า Supplier หรือ Member ภายนอกตอบรับจริง; ผู้ใช้เป็นผู้สลับบัญชี Member เท่านั้น ส่วนบัญชีภายในให้ใช้บัญชีที่ได้รับอนุญาตเดิม

### จุดตรวจรับ AC-06 (เก็บหน้าจอและ Audit/DB แบบอ่านอย่างเดียวก่อน–หลัง)

1. Custom item มี `item_type=CUSTOM`; เมื่อ QC บันทึก `PASSED` ต้องเป็น `WAITING_MEMBER_APPROVAL`, ส่ง Notification ตามระบบ และ Gate ยังไม่ผ่าน
2. Member เจ้าของ Order กดอนุมัติเองในบัญชี Member; เก็บ `qc_member_decisions`, ผู้ตัดสินและเวลา; หลังอนุมัติเป็น `MEMBER_APPROVED` ไม่มี auto-approval
3. ถ้าทดสอบ Reopen ของ Custom ด้วย: Reopen **ก่อน Dispatch** ต้องคืน QC เป็น `IN_PROGRESS`, ล้าง approval เดิมและปิด Gate; QC ผ่านใหม่ต้องรอ Member อนุมัติใหม่ ไม่ใช้ approval เก่า (ทดสอบได้เฉพาะเมื่อ fixture พร้อมและอนุมัติชัด)
4. หลัง Customer Balance ถูก Finance ตรวจและ Supplier Balance จ่ายแบบ Development Test จนครบทั้ง 4 Gate จึงสร้าง Shipment และ Dispatch จำลองได้; ก่อนครบต้องถูกบล็อก; เก็บ Audit/สถานะและยืนยันไม่แตะ R02
5. หาก Payment Evidence ใช้ไฟล์จำลอง ให้แยก “App รับไฟล์” จาก “ตรวจเนื้อหาที่เก็บบนเซิร์ฟเวอร์”; ไม่สรุป PDF UAT PASS หากไม่ได้เปิดตรวจจริง

**Stop conditions:** Member/Supplier/Custom quotation ที่เหมาะสมไม่พร้อม, ต้องเปลี่ยนราคา/สูตร/ภาษี/Payment Term, ต้องเปลี่ยน Role/Permission, App สร้าง Order/Shipment ไม่ได้ตามทางที่อนุมัติ, หรือพบผลกระทบต่อข้อมูลเดิม/Production ให้หยุดและรายงานก่อน ไม่สร้างข้อมูลลัดทางฐานข้อมูล

## 4. ขอบเขตที่ต้องขออนุมัติก่อนลงมือ

| เรื่อง | ขออนุมัติอะไร | ยังไม่อนุญาตจากแผนนี้ |
|---|---|---|
| D01 | เลือก A หรือ B และยืนยันถ้อยคำ AC-05 ที่จะรับรอง; ถ้า B ต้องมีแผน fixture และอำนาจสร้าง/คืนค่าที่เจาะจงอีกชั้น | เปลี่ยน Role/Permission, สร้างบัญชี/องค์กร, เขียน DB, เปลี่ยน AC เอง |
| D02 | อนุญาตสร้างและแก้เฉพาะชุดทดสอบ R03 ใน Development ผ่าน App, จำนวน 1 ชิ้น, ใช้ Member/Supplier เดิมและค่าปัจจุบัน; ระบุให้สร้าง Audit/Notification อัตโนมัติได้ และให้ Member สลับบัญชีเอง | ราคาใหม่, สูตร, ภาษี, Payment Term, Master Data, Code/Schema, Data Migration, ข้อมูล R01/R02/เดิม, Production,เงินจริง |
| UX findings | ตัดสินต่างหากหลังผล AC-06: แก้ข้อความ Dispatch Gate และซ่อน/ปิดปุ่ม Reopen หลัง Dispatch หรือรับเป็น Known Issue ที่มีความเสี่ยง/ผู้รับผิดชอบ | แก้โค้ดหรือ Deploy โดยอัตโนมัติ |

การอนุมัติแผนไม่ใช่การอนุมัติเปลี่ยน Production; ทุกการทดสอบต้องมี Approval Record ระบุผู้อนุมัติ ข้อความ/เวอร์ชัน Environment ขอบเขตข้อมูล/การย้ายข้อมูล Production=No และเวลาอนุมัติ

## 5. ลำดับถัดไปและสถานะ Slice

1. เจ้าของเลือก **D01-A หรือ D01-B** และอนุมัติ/ไม่อนุมัติ **D02-R03** อย่างชัดเจน
2. ถ้า D02 ได้รับอนุมัติ ตรวจ fixture และทำ AC-06 ใน Development ตามจุดตรวจ; ถ้าติดราคา/สิทธิ์/ข้อมูล ให้หยุดก่อน
3. สรุป UAT AC-01–06 รวม, ตัดสิน UX findings และออก Owner UAT acceptance แยกจาก Production Release

**ยังเหลือ 3 ขั้นตอนเพื่อปิด Slice; ไม่มี AC-05 cross-org PASS หรือ AC-06 Custom PASS จากการจัดทำแผนฉบับนี้**
