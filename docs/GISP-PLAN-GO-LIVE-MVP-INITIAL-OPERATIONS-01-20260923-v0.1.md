# GO-LIVE-MVP-INITIAL-OPERATIONS-01 v0.1

## 1. Document Control

| Field | Value |
| --- | --- |
| Document ID | `GO-LIVE-MVP-INITIAL-OPERATIONS-01` |
| Version | `v0.1` |
| Date | 2026-09-23 (Asia/Bangkok) |
| Status | **Proposed — Awaiting Scope Approval** |
| Product owner / intended approver | ภคภพ ช.เจริญยิ่ง |
| Local implementation target | Isolated worktree `C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP` |
| Branch | `codex/full-flow-go-live-01` |
| Source baseline at document creation | Commit `88b8b6d992cc2e91b3526312dc21cbc96f05b97d` |
| Source tree at document creation | `71b80afb5c328a9be521af34129f3c82e8101053` |
| Approval artifact checksum | Companion `.sha256` file generated after final review |
| Data authority in this document | None |
| Migration authority in this document | None; planning only |
| Staging authority in this document | No |
| Production authority in this document | No |
| `production_allowed` | `No` |

เอกสารนี้เป็นแผนและขอบเขตเพื่อขอ **Scope Approval เท่านั้น** การอนุมัติเอกสารยังไม่อนุญาตให้แก้โค้ด สร้าง Migration, Deploy, Apply Migration, เขียนข้อมูล Backend/Staging หรือเปลี่ยน Production ต้องจัดทำ Implementation Addendum ที่ระบุ exact file/component ownership และขอ Local Implementation Authorization แยกตามหัวข้อ 15

## 2. เป้าหมายทางธุรกิจ

ทำให้ GISP รุ่นเริ่มต้นเปิดใช้งานจริงกับสมาชิกประมาณ 20 คนได้ โดยเน้นให้เป็นเครื่องมือสำหรับ:

1. เลือกสินค้าจาก Catalog หรือส่งคำขอสินค้านอก Catalog
2. สร้าง Project, ขอราคา, ยืนยันราคา และสร้างคำสั่งซื้อ
3. ชำระเงินด้วยการโอนเงินภายนอกระบบ แล้วแนบหลักฐานให้ฝ่ายการเงินตรวจด้วยคน
4. ออก PO และติดตามงานจัดหา/ผลิต, QC, คลัง, ขนส่ง และส่งมอบ
5. แจ้งสมาชิกเฉพาะเหตุการณ์สำคัญของคำสั่งซื้อ
6. ให้ทีมงานเพิ่ม แก้ไข และเผยแพร่สินค้าใน Catalog ได้ต่อเนื่องหลังเปิดใช้งาน

หลักการสำคัญของรุ่นนี้คือ **เปิดใช้ความสามารถหลักให้ครบก่อน** และเลื่อนระบบการเงินขั้นสูงหรือระบบที่ยังไม่จำเป็นต่อการเริ่มดำเนินงานออกไป โดยไม่อ้างว่าฟังก์ชันที่เลื่อนนั้นผ่านการเปิดใช้งานแล้ว

> ขอบเขตนี้ไม่ใช่เพียง “สั่งซื้อและดูสถานะพื้นฐาน” แต่เป็น Operations launch ตั้งแต่ Catalog/Custom RFQ จนถึง Production, QC, Warehouse, Shipment และ Delivery จึงมีเวลาและความเสี่ยงมากกว่ารุ่น Basic Status แต่ทำให้ทีมใช้แอปติดตามงานจนส่งมอบได้ตามเป้าหมายของเจ้าของ

## 3. การปรับฐานจากแผนเดิม

เอกสาร `FULL-FLOW-GO-LIVE-01 v0.1` เดิมวางเป้าหมายกว้างถึง Release C และ Release D หลายส่วน รวมถึง Supplier Payment, Claims และ Advanced Reports ซึ่งเพิ่มภาระการทดสอบและทำให้การเปิดใช้รุ่นเริ่มต้นล่าช้า

เมื่อเอกสารนี้ได้รับอนุมัติ จะใช้เป็น Source of Truth สำหรับ **ขอบเขต Go-live รุ่นเริ่มต้น** ดังนี้:

- เปิด Release C เฉพาะส่วนที่สมาชิกใช้สั่งซื้อ ชำระเงินให้ GISP และยกเลิก Order ตามกฎที่กำหนด
- เปิด Release D Slice 7 และ Slice 8 สำหรับ Production/QC และ Warehouse/Shipment/Delivery
- ปิด Supplier Payment ในแอป, Release D Slice 9 Claims และ Slice 10 Advanced Reports สำหรับ Candidate นี้
- ฟังก์ชัน Release B ที่เปิดอยู่ก่อนแล้ว เช่น Shared Catalog, Sourcing Intake และ Showroom **คงทำงานตามเดิม** แต่ไม่ใช่เกณฑ์ตรวจรับใหม่ของ Slice นี้ และห้ามปิด/เปลี่ยนสิทธิ์โดยอาศัยเอกสารนี้
- ไม่ใช้ผล UAT ที่ยังไม่ครบของแผนเดิมเป็นเหตุบังคับให้ต้องกู้บัญชีทดสอบเดิม
- เก็บหลักฐานที่ผ่านแล้วไว้เป็นประวัติ แต่ Candidate ใหม่ต้องผ่าน Regression และ UAT ตามขอบเขตเอกสารนี้

เอกสารนี้ไม่เปลี่ยนย้อนหลังว่าการทดสอบเดิมเคยเกิดอะไรขึ้น และไม่ถือว่า Full Flow เดิมปิดครบทุกส่วน

## 4. ขอบเขตที่อนุมัติให้เสนอพัฒนา

### 4.1 In Scope

#### A. Catalog และ Project

- สมาชิกดูและค้นหา Catalog ได้
- สมาชิกเลือกสินค้าที่เผยแพร่และมีราคาสมาชิกที่ Active เพื่อเพิ่มเข้า Project/Order
- ทีมงานที่มีสิทธิ์ `catalog.manage` เพิ่มและแก้สินค้าได้
- ทีมงานที่มีสิทธิ์ `catalog.publish` เผยแพร่หรือหยุดเผยแพร่สินค้าได้
- การเพิ่มสินค้าใหม่หลัง Go-live เป็นงานประจำ ไม่ต้อง Deploy ใหม่ หากโครงสร้างข้อมูลและกฎราคาไม่เปลี่ยน
- เมื่อสร้าง Order ระบบต้องบันทึก Snapshot ชื่อสินค้า, SKU, รายละเอียด และราคา ณ เวลาสั่ง เพื่อไม่ให้การแก้ Catalog ภายหลังเปลี่ยน Order เดิม

#### B. สินค้านอก Catalog / Custom RFQ

- สมาชิกสร้างคำขอสินค้านอก Catalog ผ่าน Custom RFQ ได้; สำหรับรุ่นนี้คำว่า “นอก Catalog” หมายถึงงาน custom/งานที่ต้องให้ทีมจัดทำ Quotation โดยเฉพาะ
- สมาชิกแนบได้เฉพาะ PDF, JPEG/JPG และ PNG สูงสุด 10 ไฟล์ต่อ Custom Request และไม่เกิน 25 MB ต่อไฟล์
- ทีมงานจัดทำใบเสนอราคาในแอป สมาชิกยอมรับราคา แล้วนำไปสร้าง Order ได้
- ไฟล์ต้องตรวจทั้งนามสกุล, MIME type และ file signature; DWG/DXF ที่ระบบเดิมเคยรับจะไม่รับใน Go-live path นี้
- ไฟล์ที่ไม่ผ่านต้องไม่ถูกผูกกับ Request หรือเปิดให้ผู้ใช้เข้าถึง ต้องถูก Quarantine และมี durable cleanup retry/dead-letter หากลบทันทีไม่สำเร็จ
- สิทธิ์อ่านไฟล์ต้องจำกัดตาม Organization/ผู้เกี่ยวข้อง และใช้ลิงก์ที่มีอายุจำกัดเมื่อเหมาะสม

#### C. Order และการรับชำระเงินจากสมาชิก

- สมาชิกสร้าง Order จากสินค้า Catalog, Custom Quotation หรือทั้งสองแบบตามกฎปัจจุบัน
- การชำระเงินจริงเกิดนอกแอปด้วยการโอนเงินผ่านธนาคาร
- GISP แจ้งบัญชีธนาคารแก่สมาชิกนอกระบบ เช่น LINE, โทรศัพท์ หรือเอกสาร
- สมาชิกบันทึกยอดและวันเวลาที่โอน พร้อมแนบสลิปในแอป รุ่นนี้ยังไม่เพิ่มช่อง Bank Reference แยกต่างหาก
- Finance ตรวจหลักฐานและเลือก Verify หรือ Reject ด้วยคน
- การ Verify ต้องทำโดยผู้มีสิทธิ์ที่แยกจากผู้ขอเมื่อกฎปัจจุบันกำหนด
- ออก PO ได้เมื่อยอดรับชำระที่ผ่านการ Verify ตรงตามเงื่อนไขที่กำหนด
- รองรับการแก้ไขเชิงบัญชีที่มีอยู่แล้ว เช่น Adjustment, Reversal และ Hold โดยต้องมี Audit Trail
- ห้ามแก้หรือลบประวัติการรับชำระที่ Verify แล้วแบบทำลายหลักฐาน
- ไม่เชื่อม Payment Gateway, Card หรือ Bank API ในรุ่นนี้

#### D. Cancellation และ Refund Boundary

- สมาชิกขอยกเลิก Order ได้ตาม Cancellation workflow เดิม
- ก่อนรับเงิน ระบบอาจยกเลิกตามกฎเดิม; หลังรับเงินต้องผ่านผู้มีสิทธิ์ตัดสินและบันทึก refund/deduction decision
- การคืนเงินจริงทำภายนอกแอป รุ่นนี้บันทึกเฉพาะคำขอ ผลอนุมัติ จำนวนที่อนุมัติ เหตุผล และ Audit; ห้ามแสดงว่าโอนคืนสำเร็จจากข้อมูลที่ระบบพิสูจน์ไม่ได้
- การแก้ยอดต้องผ่าน Adjustment/Reversal ที่มีเหตุผลและ actor ห้ามแก้ Verified transfer โดยตรง

#### E. Operations หลังออก PO

- Production: เปิดงาน, อัปเดตสถานะผลิต และบันทึกหลักฐานที่เกี่ยวข้อง
- QC: ตรวจ, ผ่าน, ไม่ผ่าน, ส่งแก้ และตรวจซ้ำตาม Workflow
- Warehouse: รับเข้า, จัดเก็บ และรวมรายการตามกฎระบบ
- Shipment: สร้างการจัดส่ง, บันทึกเลขติดตามและสถานะเดินทาง
- Delivery: นัดหมาย/เลื่อนนัด, Out for Delivery, Delivered และ Delivered with Issue
- สมาชิกเห็นสถานะที่เหมาะกับสมาชิก โดยไม่เห็นข้อมูลภายในหรือข้อมูลของ Organization อื่น
- Supplier payment ทำภายนอกแอปทั้งหมด ดังนั้น Candidate นี้ต้องเปลี่ยน Dispatch gate ไม่ให้พึ่ง `supplier_balance_paid_at` หรือการเรียก Supplier Payment RPC
- Dispatch gate ใหม่ต้องคงเงื่อนไข **Customer Balance payment schedule = VERIFIED โดย Finance**, PO, Production/QC, quantity และ Hold ที่เกี่ยวข้อง โดยมี Audit และ Regression tests; Deposit หรือ payment บางส่วนไม่พอสำหรับ Dispatch
- แอปจะไม่ตรวจหรือเก็บหลักฐานว่าโรงงาน/Supplier ได้รับเงินแล้ว ก่อน Dispatch ผู้มีบทบาท `PURCHASING` ต้องตรวจและอนุมัติเรื่องนี้ผ่านวิธี Manual ภายนอกแอป เจ้าของยอมรับความเสี่ยงว่าระบบไม่สามารถบังคับหรือพิสูจน์ขั้นตอนนี้ได้ การอนุมัติ Scope นี้ถือเป็นการอนุมัติให้ถอดเฉพาะเงื่อนไข “บันทึก Supplier paid ในแอป” ออกจาก Dispatch แต่ยังไม่อนุญาต Implement จนกว่าจะมี Authorization แยก
- Product Order total ใช้สูตรและ snapshot เดิม ไม่เพิ่มสูตร Freight ใหม่; ค่า Freight estimate ใน Catalog เป็นข้อมูลประมาณการและไม่ถือเป็นยอดชำระจริง
- หลังทราบต้นทุนขนส่งจริง ผู้มี `freight.manage` บันทึก Actual Logistics Cost และออก Freight Invoice แยกตาม D8; Invoice นี้ไม่อยู่ในตาราง Deposit/Balance 50/50 ของสินค้า และใช้ currency/VAT/tax rules เดิมโดยไม่สร้างสูตรภาษีใหม่
- สมาชิกชำระ Freight ด้วยการโอนภายนอกและแนบหลักฐาน จากนั้น Finance Verify/Reject แบบ Manual ในแอป หากค่าจริงต่างจาก estimate ให้ใช้ยอด Actual Freight Invoice โดยต้องไม่แก้ Product Order snapshot
- เพิ่ม Minimal Delivery Issue Resolution ใน D8: ผู้มีสิทธิ์ Operations บันทึกเหตุผล วิธีแก้ และหลักฐาน จากนั้น Member Order Owner ที่เข้าสู่ระบบต้องกดยืนยัน Resolution ด้วยตนเองพร้อม Audit; Operations ห้ามยืนยันแทน Member และไม่มี compensation, refund หรือ Claim adjudication ในรุ่นนี้ หาก Member ยังไม่ยืนยัน Order ต้องคงสถานะมีปัญหาและยังไม่ Completed
- Order เปลี่ยนเป็น Completed เมื่อส่งมอบครบ, Delivery issue ทุกเรื่องมี Resolution/Member confirmation, Freight Invoice ที่ต้องชำระผ่านการ Verify และไม่มี Hold ที่ยังเปิด โดยไม่พึ่ง Supplier Payment record ในแอป

#### F. Notification ที่จำเป็น

ส่งอีเมลเฉพาะ Member Order Owner ของ Order นั้นในเหตุการณ์ต่อไปนี้:

1. Payment Verified
2. Payment Rejected
3. PO Issued
4. Shipment Dispatched
5. Delivery Scheduled
6. Delivery Rescheduled
7. Out for Delivery
8. Delivered
9. Delivered with Issue

ระบบต้องสร้าง Outbox ใน transaction เดียวกับ domain transition, ระบุและบันทึก recipient snapshot จากฝั่ง Server, และใช้ unique idempotency key อย่างน้อย `event_type + entity_id + event_version + recipient` รองรับ Retry/Dead Letter โดยไม่ส่งอีเมลทั่วไปหลังทุก RPC หาก owner/email ไม่ผ่าน guard ต้องไม่สร้างงานส่ง

### 4.2 Out of Scope สำหรับ Go-live รอบนี้

- Supplier Payment/การบันทึกว่าจ่าย Supplier แล้วในแอป
- การอนุมัติหรือ Workflow การเงินฝั่ง Supplier
- Payment Gateway, Card, QR Payment automation หรือ Bank API
- Claims (Release D Slice 9)
- Advanced Reports (Release D Slice 10)
- การเปลี่ยนแปลง Shared Catalog, Sourcing Intake และ Showroom ใน Slice นี้ (ฟังก์ชัน Release B เดิมยังคงทำงานและต้องไม่ Regression)
- OCR/PDF auto-import สำหรับสร้างสินค้าอัตโนมัติ
- การส่ง Notification ให้ Supplier, Finance, Admin หรือ Internal teams นอกเหนือรายการที่อนุมัติ
- Claim adjudication/compensation/refund workflow, Bulk import รุ่นใหม่, pricing formula ใหม่, discount/subscription ใหม่
- การเปลี่ยน roles, permissions หรือ authentication model ที่ไม่จำเป็นต่อขอบเขตนี้

เฉพาะ **Disabled capabilities ของ Candidate นี้** ได้แก่ Supplier Payment, Claims และ Advanced Reports ต้องถูกปิดทั้งหน้า UI, Route/API และ Direct RPC ไม่ใช่เพียงซ่อนเมนู ส่วน Release B เดิมที่ไม่ได้แก้ต้องคง ACL/พฤติกรรมเดิมและผ่าน no-regression checks

## 5. ผู้ใช้งานและขอบเขตสิทธิ์

| Role/Capability | ทำได้ในรุ่นนี้ | ต้องห้าม/ควบคุม |
| --- | --- | --- |
| Member | ดู Catalog, สร้าง Project/Custom RFQ/Order, แนบสลิป, ติดตามสถานะ | เห็นเฉพาะข้อมูล Organization/Order ที่มีสิทธิ์ |
| Catalog Manager | เพิ่ม/แก้ข้อมูลสินค้า | เผยแพร่ไม่ได้หากไม่มี `catalog.publish` |
| Catalog Publisher | เผยแพร่/หยุดเผยแพร่สินค้า | Order เก่าต้องไม่เปลี่ยนตาม Catalog |
| Sales/Operations | ทำ Quotation, PO และงานปฏิบัติการตามสิทธิ์ | ห้าม Verify payment หากไม่มีสิทธิ์ Finance |
| Finance | Verify/Reject การรับชำระของสมาชิก, ตัดสิน Cancellation/Refund record และทำรายการแก้ไขที่อนุญาต | ไม่มี Supplier Payment หรือการยืนยันว่าโอนคืนจริงในรุ่นนี้ |
| Production/QC/Warehouse/Shipment | ทำงานเฉพาะขั้นตอนและ Organization ที่ได้รับสิทธิ์ | ห้ามเห็นข้อมูลการเงิน/ข้าม Organization เกินสิทธิ์ |

ทุกการตรวจสิทธิ์ที่มีผลต่อข้อมูลหรือการเงินต้องบังคับจาก Server/Database ไม่พึ่ง UI เพียงอย่างเดียว

## 6. Functional Requirements

- `MVP-REQ-001` สมาชิกที่ได้รับอนุญาตต้องสมัคร/เข้าสู่ระบบและเข้าถึง Organization ของตนได้
- `MVP-REQ-002` สมาชิกต้องค้นหาและเลือก Published Catalog item ที่มี Active Member Price ได้
- `MVP-REQ-003` ผู้มีสิทธิ์ Catalog ต้องเพิ่ม แก้ และเผยแพร่สินค้าได้ต่อเนื่องหลัง Go-live
- `MVP-REQ-004` Order ต้องเก็บ immutable commercial snapshot ของสินค้าและราคา
- `MVP-REQ-005` สมาชิกต้องสร้าง Custom RFQ พร้อมไฟล์ที่ปลอดภัยและรับ/ยอมรับ Quotation ได้
- `MVP-REQ-006` สมาชิกต้องสร้าง Order และระบบต้องป้องกัน Order ซ้ำจากการกดซ้ำหรือ Request ซ้ำ
- `MVP-REQ-007` สมาชิกต้องส่งหลักฐานโอนเงิน และ Finance ต้อง Verify/Reject ได้โดยมี Audit Trail
- `MVP-REQ-008` PO ต้องออกได้เมื่อ financial gate ผ่านเท่านั้น
- `MVP-REQ-009` ทีมงานต้องอัปเดต Production และ QC จนครบเงื่อนไขได้
- `MVP-REQ-010` ทีมงานต้องรับเข้า Warehouse และสร้าง Shipment/Delivery ได้
- `MVP-REQ-011` สมาชิกต้องเห็น Timeline ที่ถูกต้องถึง Delivered/Delivered with Issue
- `MVP-REQ-012` Notification ต้องส่งเฉพาะ 9 เหตุการณ์และถึง Member Order Owner ที่ Server ยืนยันแล้ว
- `MVP-REQ-013` Supplier Payment, Claims และ Advanced Reports ซึ่งเป็น Disabled capabilities ของ Candidate ต้อง Fail Closed
- `MVP-REQ-014` ทุก Flow ต้องป้องกัน Cross-organization access และบันทึก Audit ที่จำเป็น
- `MVP-REQ-015` Emergency Stop ต้องหยุดธุรกรรมใหม่ได้โดยยังอ่านและ Reconcile ข้อมูลเดิมได้
- `MVP-REQ-016` Cancellation ต้องแยกก่อน/หลังรับเงิน และการคืนเงินจริงอยู่นอกแอปพร้อม decision/audit record
- `MVP-REQ-017` Dispatch ต้องไม่พึ่ง Supplier Payment record แต่ต้องผ่าน Customer Balance VERIFIED, PO, QC, quantity และ Hold gates; Completion ต้องผ่าน Delivery issue resolution และ verified Freight Invoice ที่เกี่ยวข้อง
- `MVP-REQ-018` Release B capabilities ที่ไม่อยู่ในเกณฑ์ตรวจรับใหม่ต้องไม่ถูกปิดหรือ Regression
- `MVP-REQ-019` D8 ต้องมี Minimal Delivery Issue Resolution พร้อม evidence, Member confirmation และ audit โดยไม่เปิด Claim adjudication/compensation

## 7. แนวทาง Implementation

### 7.1 Reuse

- ใช้ Catalog, Project, Custom RFQ/Quotation, Order และ Customer Payment flow ที่มีอยู่
- ใช้ Release stage gate และ permission model เดิม
- ใช้ Production/QC จาก D7 และ Warehouse/Shipment/Delivery จาก D8
- ใช้ notification queue/retry infrastructure เดิมเฉพาะส่วนที่ผ่านการปรับให้เป็น event-specific outbox
- ใช้ existing Audit/financial adjustment controls ที่อยู่ใน Candidate และยังตรงกับ Scope

### 7.2 Modify

- เพิ่ม server-side scope เช่น `MVP_SCOPE=INITIAL_OPERATIONS` เพื่อกำหนดขอบเขต Go-live นี้
- ค่า `MVP_SCOPE` ที่หายหรือไม่ถูกต้องต้อง Fail Closed สำหรับ domain writes, outbox enqueue และ notification process/send; อนุญาตเฉพาะ health และ read-only reconciliation; health/release attestation ต้องแสดงค่า Scope และ Production preflight ต้องเทียบกับค่าใน Authorization
- Environment gate ใช้ปิด Direct RPC ไม่ได้ จึงต้องมี ACL และ server/database enforcement แยก
- ขยาย gate ให้ครอบคลุม UI, Route/API, server action และ direct RPC
- ปิด Supplier Payment และตัดข้อมูล/Action ที่เกี่ยวข้องออกจาก Member/API projection
- เปลี่ยน Dispatch/Completion gate ตาม `MVP-REQ-017` โดยไม่ลด Customer payment, PO, QC, quantity หรือ Hold safeguards
- เปลี่ยน notification จาก “ส่งหลังทุก RPC” เป็นรายการเหตุการณ์อนุญาตในหัวข้อ 4.1F
- เพิ่มการตรวจไฟล์ Custom RFQ ที่เนื้อหาไฟล์และ cleanup เมื่อไม่ผ่าน
- เพิ่ม durable server/database idempotency สำหรับการสร้าง Order; UI disable อย่างเดียวไม่ถือว่าผ่าน
- เพิ่ม/ปรับ tests สำหรับ snapshot, concurrency, finance, file security, cross-org และ operations

### 7.3 New

- Event-specific notification outbox/idempotency/recipient resolver
- Scoped migration สำหรับ financial hold/private executor controls ที่ยังจำเป็น พร้อม revoke Supplier Payment RPC
- Scoped migration สำหรับ notification outbox และข้อบังคับที่จำเป็น
- Scoped forward migration สำหรับ Dispatch gate ที่ไม่พึ่ง Supplier payment record และ Minimal Delivery Issue Resolution
- Exact-candidate manifest, migration allow-list, staging runbook, rollback/recovery package และ UAT evidence

ก่อนขอ Local Implementation Authorization ต้องมี Implementation Addendum ที่ระบุ exact owned files/components, exact RPC function signatures และ expected ACL ของ `PUBLIC`, `anon`, `authenticated` และ privileged role สำหรับ Supplier Payment, Claims และ Advanced Reports พร้อมยืนยันว่า Shared Catalog/Sourcing/Showroom คง ACL เดิม ห้ามแตะ `.codex-tmp` หรือ ignored UAT/Auth-reset artifacts ที่เป็นงานเดิม

## 8. Migration Strategy

### 8.1 หลักการ

- สร้างไฟล์ Migration ได้เฉพาะหลังได้รับ Local Implementation Authorization
- ห้าม Apply Migration จากเอกสารฉบับนี้
- Production ต้องเริ่มจาก Baseline ที่ตรวจยืนยันจริงก่อนสร้างรายการ Apply
- ห้ามใช้ `up --all`
- Apply ได้เฉพาะไฟล์ใน allow-list ที่ผูกกับ exact commit/tree/hash และได้รับ Staging หรือ Production Authorization แยกกัน
- สร้าง scoped forward migrations ใหม่จาก Production baseline; ห้ามแก้ชื่อ เนื้อหา หรือ hash ของ Migration ที่เคย Apply แล้ว

### 8.2 Candidate ที่เสนอ

- นำ Release C migrations ที่จำเป็นต่อ Catalog/Custom RFQ/Order/Customer Payment มาใช้
- นำ Release D7 และ D8 migrations ที่จำเป็นต่อ Operations มาใช้
- ไม่นำ D9 Claims, D10 Advanced Reports และ Sourcing migration มาใช้
- ไม่ Apply migration แก้ Private Executor รุ่นเดิมแบบแยกส่วนโดยอัตโนมัติ แต่สร้าง forward repair ใหม่และพิสูจน์ลำดับ dependency `C → D7 → D8 → scoped controls → private-executor repair` จาก baseline
- เพิ่ม Migration เพื่อ revoke สิทธิ์ Direct RPC ของ Supplier Payment อย่างชัดเจน
- เพิ่ม Migration สำหรับ notification outbox/idempotency เฉพาะเมื่อ schema ปัจจุบันไม่เพียงพอ
- สร้าง Stop/Resume/Reconcile package ใหม่ให้ตรง Candidate นี้ ห้ามนำ hash จาก Candidate เก่ามาใช้โดยอนุมาน

รายการชื่อไฟล์และ SHA-256 สุดท้ายต้องบันทึกใน Candidate Manifest หลัง Implementation เสร็จ และก่อนขอ Staging Authorization

## 9. Security และ Financial Controls

- Cross-org access ต้องถูกปฏิเสธทั้ง read และ write
- Private verifier/executor ต้องไม่เปิดให้ `PUBLIC`, `anon` หรือ `authenticated` เรียกตรง
- เฉพาะ role ที่ได้รับอนุญาตจึง Verify/Reject payment ได้
- ตรวจยอดแบบ exact arithmetic ตามหน่วยเงินของระบบและกฎปัจจุบัน
- รองรับ Partial, Exact, Rejected, Replacement และ Overpayment ตามกฎที่ทดสอบและบันทึกไว้
- Verified payment ต้อง immutable; การแก้ต้องใช้ Adjustment/Reversal ที่มีเหตุผลและ actor
- Financial Hold ต้องหยุดขั้นถัดไปที่เสี่ยงจนกว่าจะ Resolve
- Supplier Payment RPC ต้องเรียกไม่ได้ใน Go-live scope นี้
- Uploaded payment evidence และ Custom RFQ files ต้องมี ownership check และ private access
- Audit ต้องระบุ actor, เวลา, record, action และผลลัพธ์ที่เพียงพอต่อการตรวจย้อนหลัง
- Secret, token, password, SMTP credential และข้อมูลธุรกิจจริงห้ามอยู่ใน source/evidence

## 10. Acceptance Criteria

### 10.1 Local Candidate Gate

- `AC-L01` Typecheck ผ่าน
- `AC-L02` Lint ผ่านตาม policy ของ repository
- `AC-L03` Full automated test suite ผ่าน
- `AC-L04` Production build ผ่าน
- `AC-L05` Dependency/security audit ไม่มี Critical/High ที่ยังไม่ยอมรับเป็นลายลักษณ์อักษร
- `AC-L06` Route/UI/API/RPC gates ตรงกับ In Scope และ Out of Scope
- `AC-L07` Catalog create/edit/publish และ immutable order snapshot ผ่าน
- `AC-L08` File MIME/signature/size/count/ownership/cleanup tests ผ่าน
- `AC-L09` Payment partial/exact/reject/replacement/overpay/adjustment/reversal/hold tests ผ่าน
- `AC-L10` Production/QC/Warehouse/Shipment/Delivery workflow tests ผ่าน
- `AC-L11` Notification allow-list, owner resolution, idempotency, retry และ dead-letter tests ผ่าน
- `AC-L12` Cross-org, duplicate request และ concurrency tests ผ่าน
- `AC-L13` Supplier Payment/Claims/Advanced Reports/direct RPC ถูกปิดแบบ Fail Closed
- `AC-L14` Release attestation แสดง `MVP_SCOPE` และ missing/invalid scope ปิด domain writes, outbox enqueue และ notification process/send โดย health/read-only reconciliation ยังทำได้
- `AC-L15` Cancellation ก่อน/หลังรับเงิน, refund decision record และ external-refund boundary ผ่าน
- `AC-L16` Dispatch ผ่านโดยไม่ใช้ Supplier Payment record และยังบังคับ Customer Balance VERIFIED/PO/QC/quantity/Hold; Completion บังคับ issue resolution/Freight verification/Hold
- `AC-L17` Shared Catalog/Sourcing/Showroom เดิมผ่าน no-regression และไม่ถูกเปลี่ยน ACL
- `AC-L18` Minimal Delivery Issue Resolution บังคับสิทธิ์/evidence/audit และ Member Order Owner ที่ authenticated ต้องยืนยันเอง; Operations ยืนยันแทนไม่ได้และไม่มี Claim compensation action

### 10.2 Temporary Staging Gate

- `AC-S01` เป็น standalone staging ที่ identity/region/host ตรงกับ Authorization และไม่ใช่ Production
- `AC-S02` Active Schedule เป็น 0 ก่อน Apply/fixture เว้นแต่ Authorization ระบุเป็นอย่างอื่น
- `AC-S03` Backup ก่อนเปลี่ยนแปลงเสร็จสถานะ `completed`
- `AC-S04` Baseline migration history ตรง และ Apply เฉพาะ allow-list ทีละไฟล์
- `AC-S05` Deploy exact commit/tree และตรวจ runtime marker ตรง
- `AC-S06` ใช้ synthetic fixtures และ owner-controlled test email เท่านั้น
- `AC-S07` UAT Catalog → Order/Custom → Payment → PO → Production/QC → Warehouse/Shipment → Delivery ผ่าน
- `AC-S08` Security/Financial assertions และ concurrency profile: synthetic members 20 ราย ส่งคำขอสร้าง Order คนละ 2 ครั้งด้วย idempotency key เดียวกันภายใน 60 วินาที ต้องได้ Order คนละ 1 รายการ, duplicate 0, cross-org leak 0 และ unexpected server error 0
- `AC-S09` Notification SMTP/Schedule เปิดเฉพาะตามขั้นตอนที่ได้รับอนุมัติ และผู้รับอยู่ใน allow-list
- `AC-S10` Backup/Restore และ Emergency Stop/Reconcile/Resume rehearsal ผ่านตาม Authority ที่อนุมัติ
- `AC-S11` Independent QA ออกรายงาน GO สำหรับ exact candidate

### 10.3 Production Release Gate

- `AC-P01` มี Production Release Authorization ที่ระบุ exact commit/tree/migration hashes/config
- `AC-P02` Production identity, baseline, backup, schedule และ rollback package ผ่าน read-only preflight
- `AC-P03` Apply/Deploy ตาม allow-list และลำดับที่อนุมัติเท่านั้น
- `AC-P04` Smoke test แบบไม่ทำลายข้อมูลผ่านก่อนเปิดสมาชิก
- `AC-P05` เปิดตามลำดับ C → D7 → D8 ใน release window เดียว โดยตรวจ gate ทุกช่วง
- `AC-P06` เปิด Notification Schedule หลัง event tests และ recipient guard ผ่าน
- `AC-P07` เปิดสมาชิกประมาณ 20 คนเมื่อ smoke และ monitoring พร้อม
- `AC-P08` เฝ้าระวังเข้ม 24 ชั่วโมงแรกและมีผู้รับผิดชอบ Emergency Stop

## 11. UAT Matrix ที่ต้องมีหลักฐาน

| Area | กรณีหลัก |
| --- | --- |
| Member access | สมัคร/เข้าใช้, Organization membership, denied cross-org |
| Catalog | เพิ่ม/แก้/เผยแพร่, Active price, member browse, order snapshot หลังแก้ Catalog |
| Custom RFQ | สร้าง, แนบ PDF/JPEG/PNG, reject spoofed/oversize/excess files, quotation acceptance |
| Order | Catalog/custom/mixed ตามกฎ, double-click/idempotency, concurrent request |
| Customer payment | partial, exact, reject, replacement, overpay, private evidence, adjustment, reversal, hold |
| Cancellation/refund | ก่อนรับเงิน, หลังรับเงิน, approve/reject, refund/deduction record, ไม่มีการอ้างว่าโอนคืนจริงโดยไม่มีหลักฐาน |
| PO | ปฏิเสธก่อน financial gate, ออกได้เมื่อ gate ผ่าน, audit actor |
| Production/QC | start/update, fail, rework, re-inspect, member-visible projection |
| Warehouse/Shipment | receive, consolidate, dispatch, tracking, freight fields ที่อยู่ใน D8 |
| Delivery | schedule, reschedule, out for delivery, delivered, delivered with issue, POD |
| Completion/freight | product total ไม่เปลี่ยนสูตร, actual freight invoice แยกจาก 50/50, external transfer/manual verify, issue/hold ต้องปิดก่อน Completed |
| Notification | 9 events only, correct owner, duplicate suppression, retry/dead-letter, no internal leak |
| Scope closure | supplier payment, claims, advanced reports และ direct RPC เรียกไม่ได้ |
| Load/concurrency | synthetic members ประมาณ 20 รายทำงานพร้อมกันโดยไม่สร้างข้อมูลซ้ำหรือข้ามสิทธิ์ |

ผล PASS เดิมอาจใช้เป็น supporting evidence ได้ แต่ต้อง rerun เมื่อโค้ด, migration, config หรือ scope ที่เกี่ยวข้องเปลี่ยนจนหลักฐานเดิม stale

## 12. Rollout Plan

1. Freeze exact candidate และสร้าง Manifest พร้อม commit/tree/file hashes
2. ทำ Independent QA กับ candidate เดียวกัน
3. ขอและทำ Temporary Staging rehearsal ตาม Authorization แยก
4. แก้เฉพาะ blocker ที่พบ แล้วสร้าง candidate/QA/staging evidence ใหม่ส่วนที่ stale
5. ขอ Production Release Authorization แยกโดยแนบ Go-live readiness summary
6. Production read-only preflight และ backup
7. Apply scoped migrations และ Deploy exact candidate
8. เปิด Release C แล้วทำ smoke และบันทึก Go/No-Go; หาก C ไม่ผ่านให้ Stop/Rollback และไม่เปิด D7/D8
9. เปิด D7 แล้วทำ Production/QC smoke และบันทึก Go/No-Go; หาก D7 ไม่ผ่านให้ปิด D7/D8 โดย C จะคงเปิดได้เฉพาะเมื่อ QA ยืนยันว่าแยกผลกระทบได้
10. เปิด D8 แล้วทำ Warehouse/Shipment/Delivery smoke และบันทึก Go/No-Go; หาก D8 ไม่ผ่านให้ปิด D8 และตัดสินแยกว่าคง C/D7 ได้อย่างปลอดภัยหรือไม่
11. เปิด Notification Schedule เมื่อ recipient/idempotency gate ผ่าน; หากไม่ผ่านให้แอปทำงานต่อโดยปิด Email และแจ้งสมาชิกผ่านช่องทาง Manual
12. เปิดให้สมาชิกประมาณ 20 คนใช้งานทันทีเมื่อทุก Go gate ผ่าน และ monitor 24 ชั่วโมงแรก

ไม่มี Pilot subgroup แยกตามการตัดสินใจของเจ้าของ แต่ยังคงการเปิดความสามารถเป็นลำดับเพื่อให้ Emergency Stop ได้รวดเร็ว

## 13. Rollback และ Emergency Stop

เมื่อพบความเสี่ยงร้ายแรง:

1. ปิด Notification Schedule ก่อนเพื่อหยุดการส่งซ้ำ และตั้ง outbox cutover marker/TTL เพื่อ Quarantine งานเก่า
2. ปิด transaction entry ที่มีปัญหาและลด Release gate กลับสู่สถานะปลอดภัยตาม runbook
3. เรียกเฉพาะ hash-pinned Stop C/D7/D8 controls ที่ QA รับรอง
4. ทำ SELECT-only reconciliation เพื่อระบุ Order/Payment/Shipment ที่ได้รับผลกระทบ
5. เก็บข้อมูลและ Audit ไว้ ห้าม Cleanup/Delete เพื่อซ่อนปัญหา
6. Reconcile pending/retry/dead-letter outbox ก่อน Resume เพื่อไม่ส่งอีเมลเก่าหรือซ้ำ
7. Restore เฉพาะเมื่อมี Authorization แยกและพิสูจน์ว่าการแก้แบบ forward/reconcile ไม่ปลอดภัยกว่า
8. Resume ได้หลัง root cause, fix, regression และ owner decision ครบ

## 14. Monitoring และความเสี่ยงที่ยอมรับได้/ต้องตัดสินใจ

### 14.1 Monitoring 24 ชั่วโมงแรก

- API/Server error rate และ failed RPC
- Login/authorization failures ที่ผิดปกติ
- Payment amount/status mismatch
- Duplicate Order/Transfer/Outbox item
- Notification queue backlog, retry และ dead letter
- Cross-org denial/attempt และ private file access failure
- Production/QC/Shipment status ที่ค้างผิดปกติ

### 14.2 Known Risks

| Risk | การควบคุม |
| --- | --- |
| เปิด 20 คนทันทีโดยไม่มี Pilot | staged capability smoke, monitoring 24 ชม., emergency stop owner |
| การเงินเป็น Manual | separation of duties, immutable verified record, audit, reconcile checklist |
| แอปไม่ตรวจการจ่าย Supplier ก่อน Dispatch | `PURCHASING` ตรวจและอนุมัตินอกระบบก่อนส่ง; เจ้าของยอมรับว่าแอปบังคับ/พิสูจน์ขั้นตอนนี้ไม่ได้ |
| สมาชิกได้รับเลขบัญชีนอกแอป | ใช้ช่องทางเจ้าของควบคุมและยืนยันชื่อบัญชีก่อนโอน |
| Catalog เปลี่ยนตลอด | permission แยก manage/publish และ immutable order snapshot |
| Email ซ้ำ/ผิดคน | event allow-list, server-side owner resolver, idempotency, schedule gate |
| Migration history จาก staging เดิมไม่ตรง | สร้าง standalone staging ใหม่จาก Production baseline; หยุดหากโควตาไม่พอ |
| Custom file ปลอมชนิด | MIME + signature validation, private storage, cleanup failure |
| Catalog จำนวนมาก | ตรวจ pagination/limit และ capacity preflight ก่อน Production |

Notification retry policy ต้องกำหนดจำนวนครั้ง, backoff, TTL และ terminal dead-letter ใน Implementation Addendum; ก่อนกำหนดและทดสอบ ห้ามเปิด Production Schedule

## 15. Approval Boundaries

### 15.1 Approval A — Scope Only

Approval นี้ยืนยันขอบเขตธุรกิจ รวมถึงการทำ Supplier payment ภายนอกแอป, การถอดเฉพาะ Supplier Payment record ออกจาก Dispatch gate, การคง Customer Balance VERIFIED ก่อน Dispatch, การคง Actual Freight Invoice VERIFIED ก่อน Completion และการคง Release B เดิม แต่ยังไม่อนุญาตแก้ไฟล์หรือระบบใด ๆ

ข้อความอนุมัติที่เสนอ:

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 v0.1` และ checksum companion ที่แนบ รวม proposed business boundaries เรื่อง Customer Payment, external Supplier Payment, Dispatch/Completion, Cancellation/Refund, Freight และ Release B no-regression ตามเอกสาร การอนุมัตินี้เป็น Scope Approval เท่านั้น ยังไม่อนุญาตแก้โค้ด สร้างหรือ Apply Migration, เขียนข้อมูล, Deploy, เปลี่ยน Backend/Staging/Config/Schedule/Notification หรือ Production ให้ใช้เวลาของข้อความนี้เป็นเวลาอนุมัติ กำหนด `data_authority: None`, `migration_authority: None` และ `production_allowed: No`

### 15.2 Approval B — Local Implementation

จัดทำหลัง Scope Approval และ Architect impact map โดยต้องระบุ:

- exact baseline commit/tree และ isolated worktree/branch
- exact owned files/components และพื้นที่ห้ามแตะ โดยเฉพาะ `.codex-tmp`
- exact RPC signatures/ACL contract และ migration file scope
- Local test fixtures/evidence ที่อนุญาต
- `data_authority: Local synthetic fixtures only`
- `migration_authority: Create local files only, no apply`
- `production_allowed: No`

### 15.3 Approval C — Temporary Staging Execution

ต้องขอภายหลัง Implementation และ Independent QA โดยระบุอย่างน้อย:

- exact candidate commit/tree
- Project name/ID/host/region ที่ไม่ใช่ Production
- migration allow-list และ SHA-256
- backup, fixture, recipient allow-list, SMTP/Schedule policy, retention/cost limit
- UAT, restore และ recovery scope
- `production_allowed: No`

### 15.4 Approval D — Production Release

ต้องขอแยกหลัง Staging GO โดยระบุ exact candidate, Production identity, backup, migration/deploy steps, config, schedule, smoke, rollback, monitoring, release window และผู้รับผิดชอบ ห้ามอนุมานจาก Approval A, B หรือ C

## 16. Evidence และ Traceability ที่ต้องส่งมอบ

- Approved document/version และ approval timestamp
- Git commit/tree และ clean working-tree evidence
- Candidate Manifest พร้อม file/migration hashes
- Test/build/audit logs ที่ตัด secret แล้ว
- Requirement-to-test traceability สำหรับ `MVP-REQ-001` ถึง `MVP-REQ-019`
- Independent QA report
- Staging identity/preflight/backup/migration/deploy/UAT/recovery evidence
- Go-live readiness summary: scope, environment, open blockers, data/migration status, rollback, owner decisions
- Production release record และ 24-hour monitoring report (เมื่อได้รับอนุญาตในอนาคต)

## 17. Definition of Done

Slice นี้ถือว่าปิดได้เมื่อ:

1. Scope ได้รับอนุมัติ
2. Implementation Addendum/impact map เสร็จและ Local Implementation ได้รับอนุมัติ
3. Implementation และ migrations เสร็จใน Local พร้อม test evidence
4. Independent QA ให้ GO กับ exact candidate
5. Temporary Staging rehearsal ผ่านทุก gate และปิด blocker แล้ว
6. เจ้าของให้ Production Release Authorization แยก
7. Production rollout, smoke, เปิดสมาชิกประมาณ 20 คน และ monitoring 24 ชั่วโมงแรกสำเร็จโดยไม่มี blocker ค้าง

ณ เวลาจัดทำเอกสาร เหลือ **7 ขั้นตอน** ตามรายการข้างต้นเพื่อปิด `GO-LIVE-MVP-INITIAL-OPERATIONS-01`

## 18. Proposed Decision Record — มีผลเมื่อเจ้าของอนุมัติ Scope

| Decision | Value |
| --- | --- |
| Target users | สมาชิกประมาณ 20 คน เปิดพร้อมกันหลัง Production smoke |
| Catalog operations after Go-live | ทีมงานเพิ่ม/แก้/เผยแพร่ได้ต่อเนื่องตาม permission |
| Customer payment | โอนภายนอก + สมาชิกแนบสลิป + Finance ตรวจด้วยคน |
| Supplier payment | ทำภายนอกแอป; ปิดในรุ่นนี้ |
| Dispatch gate | ไม่พึ่ง Supplier Payment record; บังคับ Customer Balance VERIFIED/PO/QC/quantity/Hold |
| Supplier-paid manual control | `PURCHASING` ตรวจนอกระบบก่อน Dispatch; แอปไม่เก็บ/บังคับหลักฐานนี้ |
| Freight | Product total ไม่เปลี่ยนสูตร; Actual Freight Invoice แยก, โอนภายนอกและ Finance ตรวจ Manual |
| Cancellation/refund | Workflow และ Audit อยู่ในแอป; การคืนเงินจริงอยู่นอกแอป |
| Delivery issue | Minimal resolution + evidence + Member confirmation; Claim compensation เลื่อนไปภายหลัง |
| Operations | Production/QC/Warehouse/Shipment/Delivery |
| Notifications | 9 เหตุการณ์สำคัญถึง Member Order Owner เท่านั้น |
| Deferred | Claims, Advanced Reports, Supplier Payment, payment automation, PDF auto-import |
| Rollout | C → D7 → D8 → Notification → สมาชิกประมาณ 20 คน ใน release window เดียว |
| Current production authority | ไม่มี |
