# Slice 10 — Dashboard และ Fixed Report Contract

สถานะ: ออกแบบสำหรับ Backend Branch `slice-10-dashboard-reports` เท่านั้น  
Production: ไม่อยู่ในขอบเขตจนกว่า Human UAT และ Owner Sign-off จะผ่าน

## 1. เป้าหมายการตัดสินใจ

- Member รู้ว่าวันนี้ต้องทำอะไรกับ Order ของบริษัทตนเอง
- ทีมปฏิบัติการเห็น Action Required จริงตามสิทธิ์และเปิดไปยัง Record ต้นทางได้
- Executive เห็นยอด Order, การเก็บเงิน และความเสี่ยงการส่งมอบแบบ Read-only
- ผู้ใช้เปิด Fixed Report 5 ประเภทด้วยช่วงเวลาและสถานะที่ระบุได้
- ทุกคำตอบอ้างอิง Transaction ปัจจุบัน ณ เวลา Generate และไม่อ่านจาก Product Master

## 2. KPI หลัก

| กลุ่ม | KPI | นิยาม/สูตร | Source of truth |
|---|---|---|---|
| Member | งานที่ต้องดำเนินการ | จำนวน Payment เกินกำหนด, QC รออนุมัติ, Delivery รอยืนยัน, Claim รอข้อมูล และ Payment ใกล้ครบกำหนดของ Member Profile ปัจจุบัน | `payment_schedules`, `order_items`, `deliveries`, `claims` |
| Member | Order ที่กำลังดำเนินการ | Order ของ Member ที่สถานะไม่ใช่ `COMPLETED` หรือ `CANCELLED` | `customer_orders` |
| Member | ยอดค้างชำระ | `SUM(GREATEST(due_amount - verified_amount, 0))` แยกตาม Currency ของ Order และไม่รวม Schedule `CANCELLED` | `payment_schedules`, `customer_orders` |
| Member | Claim ที่เปิดอยู่ | Claim ที่ไม่ใช่ `CLOSED` หรือ `REJECTED` | `claims` |
| Operations | Action Required | Queue ที่สร้างจากสถานะธุรกรรมจริงและถูกจำกัดตาม Permission ของผู้ใช้ | ตารางธุรกรรมแต่ละ Workflow |
| Operations | Production ล่าช้า | Supplier Order ที่ Latest Production Update เป็น `DELAYED` | `production_updates` |
| Operations | Shipment ระหว่างทาง | Shipment สถานะ `DISPATCHED`, `IN_TRANSIT`, `ARRIVED`, `ARRIVED_THAILAND`, `IMPORT_CUSTOMS` | `shipments` |
| Operations | Delivery ใกล้ถึงกำหนด | Delivery ที่ยังไม่จบและ `scheduled_at` อยู่ใน 7 วันข้างหน้า | `deliveries` |
| Executive | มูลค่า Order | `SUM(customer_orders.grand_total)` แยกตาม Currency และไม่รวม `CANCELLED` ภายในช่วงวันที่ | `customer_orders` |
| Executive | รับชำระแล้ว | `SUM(payment_schedules.verified_amount)` แยกตาม Currency ของ Order และไม่รวม Schedule `CANCELLED` | `payment_schedules`, `customer_orders` |
| Executive | ลูกหนี้คงค้าง | `SUM(GREATEST(due_amount - verified_amount, 0))` แยกตาม Currency และไม่รวม Schedule `CANCELLED` | `payment_schedules`, `customer_orders` |
| Executive | Claim เปิดอยู่ | Claim ที่ไม่ใช่ `CLOSED` หรือ `REJECTED` และสร้างภายในช่วงวันที่ | `claims` |

หมายเหตุ: ห้ามรวมยอดต่าง Currency เป็นตัวเลขเดียว รายงาน Financial ต้องแสดง Currency ของแต่ละยอดเสมอ

## 3. Fixed Report

| ประเภท | Grain | วันที่ที่ใช้ Filter | ฟิลด์หลักที่ปลอดภัย |
|---|---|---|---|
| Order | 1 แถวต่อ Customer Order | `customer_orders.created_at` | Order, บริษัท/โครงการ, สถานะ, Currency, Grand Total |
| Payment | 1 แถวต่อ Payment Schedule | `payment_schedules.created_at` | Order, ประเภท Schedule, Due, Verified, Outstanding, Currency, สถานะ, Due Date |
| Delay | 1 แถวต่อ Delay Event | เวลาของ Production/Shipment/Delivery Event | ประเภท Delay, Reference, Order, สถานะ, เหตุผลที่อนุญาต, Target/Event Time |
| Delivery | 1 แถวต่อ Delivery | `deliveries.created_at` | Delivery, Order, สถานะ, วันนัด, วันส่งจริง, Issue Flag |
| Claim | 1 แถวต่อ Claim | `claims.created_at` | Claim, Order, หัวข้อ, ประเภท, Severity, สถานะ, Responsibility, Target |

ช่วงวันที่เป็น Inclusive Date Range: ตั้งแต่ `00:00` ของวันเริ่ม จนก่อน `00:00` ของวันถัดจากวันสิ้นสุด และจำกัดไม่เกิน 366 วันต่อครั้ง

## 4. Permission และข้อมูลลับ

- Member อ่าน Dashboard/Report ได้เฉพาะ `member_profile_id` ของ Session ตนเอง
- Staff ต้องมี `reports.fixed.read`; Executive Dashboard ต้องมี `reports.executive.read`
- Export ต้องมี `reports.fixed.export` และสร้าง Append-only Audit Event
- Fixed Report 5 ประเภทไม่คืน `factory_cost`, `supplier_cost`, `paid_factory_amount`, `internal_note`, `claim_internal_costs`, ไฟล์ Confidential, เบอร์โทร, ที่อยู่ หรือหลักฐานชำระเงิน
- Delay ที่ Member เห็น ใช้เฉพาะ Production/Tracking Event ที่ `is_member_visible = TRUE`
- การคุมสิทธิ์อยู่ใน `SECURITY DEFINER` RPC โดยตรวจ Session/Permission ก่อน Query และ `REVOKE ... FROM PUBLIC, anon`

## 5. การแสดงผล

- ภาษาไทยเป็นหลัก; Internal Status ถูกแปลใน UI แต่ API เก็บ Canonical Status ไว้เพื่อ Filter/Audit
- Dashboard ทุก Card ที่เป็น Queue ต้องเปิดไปยังรายการจริงได้
- Report แสดงเวลา Generate, ช่วงวันที่, Status Filter, จำนวนแถว และ Currency
- Loading, Empty และ Error State ต้องมีทั้ง Desktop และ Tablet

## 6. Definition of Done ของ Slice 10

1. Member Dashboard, Operations Dashboard และ Executive Read-only Summary ใช้ข้อมูลจริง
2. Fixed Report Order/Payment/Delay/Delivery/Claim Filter ด้วยเวลาและสถานะได้
3. Permission Test ยืนยัน Cross-member Isolation และ Confidential-field Leakage เป็นศูนย์
4. Export CSV สร้าง Audit Event และข้อมูลตรงกับ Filter ที่แสดง
5. Automated Test, Branch Integration Test, Preview Smoke และ Human UAT ผ่านก่อนเสนอ Merge
