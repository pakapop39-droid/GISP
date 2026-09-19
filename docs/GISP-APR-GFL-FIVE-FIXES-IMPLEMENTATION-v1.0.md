# GISP-APR-GFL-FIVE-FIXES-IMPLEMENTATION v1.0

## Approval Record

| รายการ | รายละเอียด |
|---|---|
| `approval_level` | Scope + Implementation |
| `approved_by` | ภคภพ ช.เจริญยิ่ง (Owner/User) |
| `approval_text_or_reference` | ข้อความใน Codex Task: `PLEASE IMPLEMENT THIS PLAN:` ตามด้วยแผน GISP ทั้ง 5 รายการฉบับที่ยอมรับใน Task เดียวกัน |
| `scope_document_version` | `GISP-GFL-FIVE-FIXES-PLAN-v1.0` |
| `environment` | Local/Development code workspace (`C:\codex\GISP-five-fixes`) |
| `data_migration_authorized` | No |
| `production_allowed` | No |
| `external_service_mutation_authorized` | No |
| `development_deploy_authorized` | No |
| `approved_at` | 2026-09-19 06:58 ICT (Asia/Bangkok) |

## ขอบเขตที่อนุมัติ

1. หน้าโครงการสมาชิกแสดงรูปหลักปัจจุบันจาก Catalog ผ่าน signed URL และ fallback เมื่อไม่มีรูป โดยไม่ทำ snapshot หรือ migration
2. เพิ่ม Supplier PO PDF แบบสร้างเมื่อดาวน์โหลด สำหรับ Purchasing/Finance/Super Admin ที่มีสิทธิ์ในองค์กร พร้อมข้อมูลรายการ ต้นทุน เงื่อนไข 50/50 เลขหน้า และช่องลงนาม
3. เพิ่ม Logistics Production Timeline แบบอ่านอย่างเดียว ซึ่งไม่เปิดเผย Supplier identity, factory cost, payment หรือ Finance และดาวน์โหลดไฟล์ผ่าน route ที่ตรวจสิทธิ์/ความสัมพันธ์/องค์กร
4. เพิ่ม Warehouse Receipt PDF แบบสร้างเมื่อดาวน์โหลด สำหรับ `shipments.manage` ในองค์กร พร้อมข้อมูลรับสินค้า เลขหน้า และช่องลงนาม
5. ทำเลข Shipment เป็นข้อมูลหลัก แสดง Consolidation/ประเภท/ลำดับเที่ยว และตั้งชื่อเริ่มต้นจากเลข Order/Consolidation โดยคงหนึ่ง Consolidation ต่อหนึ่ง Shipment

## ข้อห้ามและข้อกำหนดความปลอดภัย

- ไม่แก้ Schema, Migration, ข้อมูล Development หรือ Production
- ไม่ Deploy หรือเปลี่ยน External Service/Secret/Configuration
- ไม่เปลี่ยนราคา Payment, Dispatch Gate หรือกฎ Consolidation/Shipment
- ทำงานใน branch `codex/gisp-five-fixes` จาก source snapshot `ebf80919bc0932ac47ae39e2affd1e498779a3d9`
- แยกเป็นห้า logical commits ที่ย้อนกลับได้ และส่ง QA ตรวจอิสระหลังรวม candidate

## Acceptance Criteria อ้างอิง

- รูป: Member เห็นรูปปัจจุบันเฉพาะ Project ที่ RLS อนุญาต; ไม่มีรูปใช้ placeholder
- PO: ผู้มีสิทธิ์ดาวน์โหลด PDF ภาษาไทยหลายหน้า; PO ยังไม่ออกตอบ 409; ไม่พบ/ต่างองค์กรตอบ 404
- Timeline: Logistics เห็นเฉพาะ safe projection และไฟล์แบบ read-only; ข้ามองค์กรไม่ได้
- Receipt: PDF ตรงกับ receipt และการดาวน์โหลดไม่เปลี่ยนข้อมูล
- Shipment: ชื่อซ้ำยังแยกด้วย SHP/Consolidation และไม่มีการรวม/ลบ/เปลี่ยนจำนวน

## Release Status

- Scope: **APPROVED**
- Implementation: **AUTHORIZED**
- Data/Migration: **NOT AUTHORIZED**
- Development Deploy: **NOT AUTHORIZED**
- Production Release: **NOT AUTHORIZED**

## ข้อความและแผนที่เจ้าของอนุมัติ (ฉบับเต็ม)

> PLEASE IMPLEMENT THIS PLAN:

### แผนแก้ไข GISP ทั้ง 5 รายการอย่างปลอดภัย

พัฒนาใน Git worktree ใหม่จาก commit `ebf8091` บน branch `codex/gisp-five-fixes` เพื่อไม่ปะปนกับงาน Payment/Release ที่ค้างใน checkout หลัก ใช้ Builder เพียงคนเดียวและให้ QA Guardian ตรวจแยกอิสระ แยกเป็น 5 commit ที่ย้อนกลับได้ ไม่เปลี่ยนฐานข้อมูล ไม่ลบข้อมูล และไม่เปลี่ยนกฎราคา Payment, Dispatch Gate หรือการรวม Shipment

1. **แสดงรูปสินค้าในหน้าโครงการสมาชิก:** เพิ่ม `image_url: string | null` จากรูปหลักปัจจุบันของ Catalog ผ่าน signed URL หลังตรวจ Member session/RLS; ไม่มีรูปใช้ placeholder; ไม่ทำ snapshot หรือ migration
2. **Supplier PO PDF:** เพิ่ม `GET /api/admin/supplier-orders/[id]/po/pdf` สำหรับ `supplier_payments.request`, `supplier_payments.manage` และ Super Admin ในองค์กร; สร้างเมื่อดาวน์โหลด ไม่บันทึก Storage/เปลี่ยนสถานะ; มีข้อมูล GISP, Supplier, PO/Supplier Order/Customer Order, วันที่ รายการ สเปก Option จำนวน หน่วย ต้นทุน ยอดรวม สกุลเงิน 50/50 หมายเหตุ เลขหน้า และช่องผู้จัดทำ/ผู้อนุมัติ/ผู้รับ PO; PO ยังไม่ออกตอบ 409 และไม่พบ/ต่างองค์กรตอบ 404
3. **Production Timeline สำหรับ Logistics:** เพิ่ม `viewProductionTimeline` จาก `shipments.manage` โดยไม่ให้ `production.manage`; เพิ่ม `logistics.productionTimeline` safe projection ที่มีเลข Supplier Order/PO, สถานะ, เปอร์เซ็นต์, ETA, หมายเหตุ, delay reason, เวลา และ metadata ไฟล์ โดยไม่ส่ง Supplier identity, factory cost, payment หรือ Finance; UI read-only; ดาวน์โหลดไฟล์ผ่าน endpoint ที่ตรวจ permission, Supplier Order → Customer Order และองค์กร
4. **Warehouse Receipt PDF:** เพิ่ม `GET /api/admin/warehouse-receipts/[id]/pdf` สำหรับ `shipments.manage` ในองค์กร; สร้างเมื่อดาวน์โหลดโดยไม่เปลี่ยนข้อมูล; มีข้อมูลบริษัท, WRC, วันที่/สถานะ, คลัง, Customer Order, Supplier Order/PO, รายการ สเปก จำนวนรับ/ปล่อย/พัก สภาพ หีบห่อ น้ำหนัก CBM หมายเหตุ เลขหน้า และช่องผู้ส่งมอบ/ผู้รับเข้าคลัง/ผู้ตรวจสอบ; เพิ่มปุ่มบน Receipt card
5. **ทำความสัมพันธ์ Shipment ให้ชัด:** คงหนึ่ง Consolidation ต่อหนึ่ง Shipment, Order เดียวมีหลาย Shipment และห้ามรวมหลาย Customer Orders; แสดง `shipment_number` เป็นเลขหลัก ชื่อเป็นข้อมูลรอง พร้อม Consolidation, ประเภทและลำดับเที่ยว; ชื่อเริ่มต้นใช้เลข Order/Consolidation; ชื่อซ้ำไม่ถือเป็นข้อมูลซ้ำและไม่ลบ/รวมข้อมูลเดิม

การทำงานต้องทำทีละ commit ตามลำดับ รูป → PDF engine/PO → Timeline → Receipt PDF → Shipment UI จากนั้นตรวจ targeted tests, typecheck, full tests, build, browser UAT และ Visual QA ของ PDF ทุกหน้า การ Deploy Development และ Production ต้องได้รับอนุมัติแยก โดย Production ยังคงสถานะ NO-GO ระหว่าง Slice นี้
