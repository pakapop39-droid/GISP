# **GLOBAL INTERIOR SUPPLY PLATFORM**

## **GISP – MVP BUSINESS MASTER PLAN**

**Document Version:** 2.3  
**Reconciled Date:** 1 สิงหาคม 2569 (2026-08-01)  
**Change Summary:** เพิ่ม Customer Browse Catalog แบบไม่มีราคาและลิงก์ 4 ขอบเขตตาม DEC-061  
**Document Type:** Business Master Plan  
**Project Stage:** Minimum Viable Product  
**Primary Market:** ประเทศไทย  
**Initial Supply Country:** ประเทศจีน  
**Platform Owner:** บริษัทของคุณต๋อง  
**Primary Users:** ผู้เรียนหลักสูตร นักออกแบบ ผู้รับเหมา และตัวแทนจำหน่ายที่ได้รับอนุมัติ

---

# **0\. APPROVED DECISIONS และลำดับ SOURCE OF TRUTH**

ส่วนนี้เป็นคำตัดสินที่อนุมัติแล้วสำหรับ GISP MVP หากข้อความในส่วนอื่นของเอกสารนี้หรือเอกสารฉบับอื่นขัดกับส่วนนี้ ให้ใช้ส่วนนี้เป็นหลัก

## **0.1 ลำดับ Source of Truth**

1. `MVP BUSINESS MASTER PLAN.md` โดยเฉพาะหัวข้อ Approved Decisions
2. `DECISION LOG.md`
3. `MVP IMPLEMENTATION PLAN.md`
4. `DATABASE SCHEMA.md`
5. เอกสาร UX/UI Volume 1, Volume 2 และ Volume 3-A ถึง 3-D
6. `docs/REQUIREMENT TRACEABILITY.md`

เอกสารลำดับรองมีหน้าที่ขยายรายละเอียดเท่านั้น ห้ามเปลี่ยน Business Rule ของเอกสารลำดับสูงกว่า หากพบข้อขัดแย้งระหว่างพัฒนาให้หยุดเฉพาะส่วนที่ขัดแย้ง บันทึกคำถาม และแก้เอกสารทุกฉบับหลังได้รับคำตัดสิน

## **0.2 Technology Baseline**

* Frontend ใช้ Next.js App Router, TypeScript Strict Mode และ Tailwind CSS
* Deploy Frontend ผ่าน **InsForge Frontend Deployments** ด้วย `npx @insforge/cli deployments deploy .`
* Backend ใช้ InsForge สำหรับ Email + Password Auth, PostgreSQL, RLS, Storage, Email, Migration และ Backup
* Deployment, Environment Variables, Domain, Deployment Status และ Scheduled Jobs บริหารผ่าน InsForge CLI/Dashboard
* ทีมโครงการไม่ต้องสร้างหรือบริหาร Frontend Project บนผู้ให้บริการ Hosting อื่นแยกจาก InsForge
* Browser ใช้เฉพาะ Public InsForge URL และ Anon Key
* InsForge API Key เป็น Server-only Secret ห้ามใช้ชื่อ `NEXT_PUBLIC_*` และห้ามส่งไป Browser
* ตาราง `public.users` เชื่อม `auth.users` และห้ามเก็บ Password หรือ `password_hash`
* Environment แยก Development, Staging/UAT และ Production โดยทั้ง Frontend และ Backend อยู่ภายใต้ InsForge Environment ที่ตรงกัน

## **0.3 Product, RFQ และ Quotation**

* สินค้า Standard ที่มี Active Member Price ใช้ Product Schedule และสร้าง Order ได้โดยไม่ผ่าน RFQ
* RFQ และ Custom Quotation ใช้เฉพาะสินค้า Custom
* Custom Quotation ออกในชื่อ GISP และมี Version
* สถานะ Quotation คือ `DRAFT → SENT → ACCEPTED / REJECTED / EXPIRED / CANCELLED`
* การสร้าง Revision ใหม่ทำให้ฉบับเดิมเป็น `SUPERSEDED`
* หนึ่ง Custom Request มี Active Quotation ได้ครั้งละหนึ่ง Version
* Quotation เริ่มต้นมีอายุ 30 วัน และ Admin แก้ได้ก่อนส่ง
* Quotation ที่ Accepted ต้องล็อก Price, Confirmed Spec, VAT และ Lead Time แล้วสร้าง Project Item สถานะ `READY_TO_ORDER`

## **0.4 Price, VAT และเอกสารการเงิน**

* Member Price เป็นราคาก่อน VAT
* Price Structure ใช้ Version และลำดับสืบทอด `Global → Supplier → Product` โดยระดับล่าง Override เฉพาะ Component ได้
* เฉพาะ `SUPER_ADMIN` สร้าง แก้ Preview และ Activate สูตรราคา
* Template เริ่มต้นที่แก้ไขได้คือ Platform 5%, Marketing/Training/Factory Visit 10% และ Product Sourcing/Catalog 10% ของ Factory Cost หลังแปลง THB
* Suggested Resale Price เริ่มต้นเป็น Member Price บวก 25% และเป็นข้อมูลแนะนำเท่านั้น ไม่ใช้คำนวณ Order/Invoice/Payment
* Freight Estimate แสดงช่วง 15–20% ของ Factory Cost หลังแปลง THB แต่ Actual Freight ออกเอกสารแยกตามจริง
* VAT เริ่มต้น 7% และแก้ได้ใน Company Settings
* Quotation, Customer Order และ Financial Document ต้อง Snapshot VAT Rate, Taxable Amount, VAT Amount และ Grand Total
* Supplier Payment ไม่คิด Thai VAT อัตโนมัติ
* เงินใช้ Decimal และปัด Round Half-up สองตำแหน่ง
* Deposit เท่ากับ 50% ของ Grand Total หลัง VAT โดยปัดสองตำแหน่ง
* Balance เท่ากับ Grand Total ลบ Deposit เพื่อป้องกันส่วนต่างจากการปัดเศษ
* Deposit และ Balance แบ่งโอนได้หลายครั้ง
* Payment Schedule เปลี่ยนเป็น `VERIFIED` เมื่อยอดที่ Finance ยืนยันสะสมครบยอดที่ต้องชำระเท่านั้น
* ยอดโอนเกินต้อง Flag ให้ Finance ตรวจ ห้ามรับรองอัตโนมัติ
* Freight ออกเอกสารและชำระแยกภายหลัง

## **0.5 Order, QC และ Dispatch Gate**

สินค้าออกจากโรงงานได้เมื่อเงื่อนไขต่อไปนี้ครบทุกข้อ

1. QC ผ่าน
2. สินค้า Custom ได้รับ Member Approval
3. Customer Balance ได้รับ Finance Verification ครบ
4. Supplier Balance ถูกบันทึกว่า Paid ครบ

ระบบต้องตรวจ Gate นี้ใน Backend และฐานข้อมูล ไม่ให้ Frontend เปลี่ยนสถานะเพื่อข้ามเงื่อนไข

## **0.6 Security, State และ Notification**

* Multi-role ใช้กับทีมงานภายใน GISP; Member หนึ่งรายมีหนึ่ง Member Profile ต่อหนึ่ง Login และไม่มี Team/Sub-user/Invitation ใน Core MVP
* ใช้ Backend Permission Guard ร่วมกับ RLS เพื่อป้องกันข้อมูลข้ามสมาชิก
* Factory Cost, Margin, Supplier Payment, Internal Note และ Confidential File ห้ามปรากฏต่อ Member ผ่าน UI, API, Export หรือ URL
* ก่อน Visit Completed ต้องปกปิดชื่อโรงงาน ที่อยู่ Contact และ Supplier ID; สิทธิ์เปิดเผยผูกกับ Member Profile + Supplier ไม่ใช่ Organization
* State Transition ทุกชนิดใช้ Action Endpoint หรือ Trusted Database Function ห้าม Frontend PATCH สถานะโดยตรง
* Storage แบ่ง Public, Member-private และ Confidential พร้อมบันทึกทั้ง Object Key และ URL/File Metadata
* Notification ใช้ In-App และ InsForge Email
* Email Failure ต้องไม่ Rollback ธุรกรรมหลัก แต่ต้องบันทึก Retry และ Error Log

## **0.7 Core MVP และ Post-MVP**

Core MVP พัฒนาแบบ Workflow Vertical Slice ตามลำดับ: Login/บริษัท/ผู้ใช้/สิทธิ์ → Product/Supplier → Project/Items → Custom RFQ → Custom Quotation → Order/Payment → Production/QC → Shipment/Delivery → Claim → Basic Dashboard/Fixed Reports

รายการต่อไปนี้เป็น Post-MVP ทั้งหมด

* Commission ทุกประเภท
* Executive BI ขั้นสูง
* Custom Report Builder และ Export Center เต็มรูปแบบ
* AI Catalog Import
* Generic Task Center
* Infrastructure หรือ Integration UI ขั้นสูง
* Member-branded Quotation Builder
* Member Team, Sub-user และ Team Invitation
* Full Trip Booking, Calendar, Itinerary และค่าเดินทาง
* Automatic Warranty หรือ Compensation Decision

ใน Core MVP คง Assignment, Due Date และ Action Required เฉพาะที่ผูกกับธุรกรรมจริง รวมถึงรายงานคงที่เฉพาะ Order, Payment, Delay, Delivery และ Claim

## **0.8 Operational Contract ที่อนุมัติเพิ่มเติม**

* Demo Version 1.3 เป็น Baseline เชิงประวัติ ส่วน Demo Application 1.4 ที่ Deploy แล้วเป็น Target Demo Gate แบบแยก Member Application และ GISP Back Office ตาม DEC-043
* Demo 1.4 ต้องผ่าน Human UAT 8 หมวดที่ขยาย Pricing, Sample/Visit Privacy และ Warranty ก่อนเริ่ม MVP Build
* Demo 1.4 ใช้ Browser-local Shared State Schema 4 แยกจาก Version 1.3 และยังไม่มี Auth/Database/Transaction API จริง
* งาน Development ที่ทำไว้ก่อน Gate ผ่านเป็น Preliminary Baseline และยังไม่ถือว่าผ่าน UAT
* Core MVP ต้องคง Account Recovery, Member Suspension, Excel/CSV Catalog Import,
  Cancellation Request, Supplier Payment 50/50, Freight Invoice/Payment Verification และ
  Configuration/Backup/Logging ขั้นต่ำ
* Production Role ใช้ `MEMBER`, `MEMBER_ADMIN`, `PRODUCT_ADMIN`, `ORDER_ADMIN`, `PURCHASING`,
  `FINANCE`, `QC`, `LOGISTICS`, `EXECUTIVE_VIEWER`, `SUPER_ADMIN`; `GISP Admin` เป็น Demo Mapping เท่านั้น
* Custom Request ใช้ `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `NEED_INFO`, `READY_FOR_QUOTE`,
  `CONVERTED`, `CANCELLED`; สถานะ Quotation ต้องอยู่ใน Custom Quotation แยกต่างหาก
* Custom Quotation ใช้ `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED`, `SUPERSEDED`
* Customer Payment/Order ใช้คำว่า `VERIFIED` เมื่อ Finance ตรวจแล้ว; ห้ามใช้ `PAID` แทนสถานะที่ต้องผ่าน Finance
* Claim `REJECTED` ต้องมี Rejection Reason ส่วน `CLOSED` ต้องมี Resolution และการยืนยันผล
* Atomic Document Number ใช้ `QT`, `ORD`, `SO`, `PO`, `INV`, `PAY`, `SHP`, `DLV`, `CLM`;
  `INV` แยก Deposit/Balance/Freight subtype และ `PRJ`, `CRQ`, `QCI`, `WRC`, `CNS` เป็น Unique Record Reference

## **0.9 Customer Browse Catalog**

* Member ส่งลิงก์ให้ลูกค้าเปิดโดยไม่ Login ได้ 4 แบบ: สินค้ารายชิ้น, สินค้าใน Project,
  Catalog ที่คัดเอง และสินค้าทั้งหมดแยกตามหมวด
* หน้า Public และ Public API ห้ามส่งหรือแสดงราคา Member Price, Suggested Resale, Freight,
  Customer Price, Factory Cost, Margin, Formula, Supplier และ Internal Note
* Product, Project และ Curated Catalog ใช้ Snapshot เมื่อ Publish; Full Catalog ใช้สินค้า `PUBLISHED`
  ที่มี Active Member Price แบบ Live Public-safe โดยไม่ส่งราคา
* ลูกค้าเก็บรายการที่สนใจใน Browser และติดต่อ Member ผ่านช่องทางที่ Member ยืนยันไว้ รุ่นแรกไม่มี
  Checkout, Lead Form หรือการเก็บข้อมูลลูกค้าใน Backend
* Token, Expiry, Revoke, Rotate, `noindex`, `no-store` และ Private Signed URL ใช้กติกาความปลอดภัยเดิม
  ของ Shared Catalog
* กติกานี้แทนที่เฉพาะส่วนการแสดงราคาลูกค้าของ DEC-056; Snapshot ราคาเดิมเก็บเป็นประวัติภายในได้
  แต่ห้ามออก Public API หรือ Public UI

---

# **1\. บทสรุปผู้บริหาร**

Global Interior Supply Platform หรือ GISP คือแพลตฟอร์มสำหรับคัดเลือก จำหน่าย และบริหารการสั่งซื้อเฟอร์นิเจอร์ งานบิลท์อิน วัสดุตกแต่ง และอุปกรณ์จากโรงงานต่างประเทศให้แก่ตัวแทนจำหน่ายในประเทศไทย

แพลตฟอร์มเริ่มต้นจากโรงงานและซัพพลายเออร์ในประเทศจีน โดยบริษัทของคุณต๋องเป็นผู้คัดเลือกโรงงาน เจรจาราคา ตรวจสอบเงื่อนไข จัดเตรียมข้อมูลสินค้า และนำสินค้าเข้าสู่ระบบเอง

โรงงานและซัพพลายเออร์จะไม่มีบัญชีผู้ใช้งานในระบบ MVP และไม่สามารถเพิ่มหรือแก้ไขสินค้าได้โดยตรง

ผู้ใช้งานหลักของ GISP ได้แก่

* ผู้เรียนหลักสูตรดูงานและสั่งซื้อสินค้าจากประเทศจีน  
* ผู้เรียนหลักสูตรภายในประเทศไทย  
* นักออกแบบตกแต่งภายใน  
* ผู้รับเหมาตกแต่งภายใน  
* เจ้าของโชว์รูมและร้านเฟอร์นิเจอร์  
* ผู้ประกอบการที่ต้องการนำสินค้าไปขายต่อ  
* ตัวแทนจำหน่ายที่ผ่านการอนุมัติ

ผู้ใช้งานจะเห็นราคาขายสมาชิกหรือราคาขายตัวแทน ไม่เห็นราคาทุนโรงงาน และชำระเงินให้บริษัทของคุณต๋องโดยตรง

บริษัทจะทำหน้าที่เสมือนผู้จัดจำหน่ายและพ่อค้าคนกลาง โดยซื้อสินค้าจากโรงงานตามราคาทุน และขายต่อให้สมาชิกตามราคาสมาชิก

ระบบจะสนับสนุนกระบวนการตั้งแต่

สมัครสมาชิก  
→ สร้างโครงการ  
→ เลือกสินค้า  
→ เลือกสี วัสดุ และตัวเลือก  
→ สร้างรายการสินค้า  
→ ยืนยันออเดอร์  
→ ชำระมัดจำ  
→ บริษัทเปิด PO ไปยังโรงงาน  
→ ผลิตสินค้า  
→ ตรวจสอบคุณภาพ  
→ ชำระยอดคงเหลือ  
→ รวมสินค้า  
→ ขนส่งเข้าประเทศไทย  
→ ส่งมอบหน้างาน  
→ เรียกเก็บค่าขนส่ง  
→ เคลมและบริการหลังการขาย

MVP จะเน้นให้กระบวนการใช้งานง่าย สามารถใช้ดำเนินธุรกิจจริงได้ และไม่พัฒนาฟังก์ชันที่ซับซ้อนเกินความจำเป็นในระยะแรก

---

# **2\. วิสัยทัศน์ของแพลตฟอร์ม**

วิสัยทัศน์ของ GISP คือ

> “สร้างระบบโครงสร้างพื้นฐานสำหรับเชื่อมโยงสินค้า โรงงาน การเรียนรู้ ตัวแทนจำหน่าย การจัดซื้อ การนำเข้า และการส่งมอบสินค้าตกแต่งภายในจากทั่วโลกเข้าสู่ตลาดประเทศไทยในระบบเดียว”

GISP จะไม่เป็นเพียงเว็บไซต์ขายสินค้า แต่จะเป็นระบบที่ช่วยให้ผู้ประกอบการไทยสามารถนำสินค้าจากโรงงานต่างประเทศไปขายต่อได้อย่างเป็นระบบ โดยไม่ต้องมีทีมจัดซื้อ ทีมแปลภาษา ทีมประสานงานโรงงาน หรือระบบติดตามออเดอร์เป็นของตนเองทั้งหมด

ในระยะยาว GISP สามารถขยายจากประเทศจีนไปยังประเทศอื่น เช่น

* ไทย  
* เวียดนาม  
* มาเลเซีย  
* อินโดนีเซีย  
* ญี่ปุ่น  
* เกาหลีใต้  
* อิตาลี  
* สเปน  
* ประเทศผู้ผลิตสินค้าและวัสดุตกแต่งอื่น

ดังนั้นคำว่า “ประเทศจีน” จะเป็นข้อมูลประเทศต้นทางของซัพพลายเออร์ ไม่ใช่ข้อจำกัดของแพลตฟอร์ม

---

# **3\. ปัญหาทางธุรกิจที่แพลตฟอร์มต้องแก้**

## **3.1 ปัญหาของนักออกแบบและผู้รับเหมา**

นักออกแบบและผู้รับเหมาที่ต้องการซื้อสินค้าจากประเทศจีนมักพบปัญหา เช่น

* ไม่รู้จักโรงงานที่น่าเชื่อถือ  
* ไม่ทราบราคาที่แท้จริง  
* ไม่สามารถอ่านภาษาจีนได้  
* ต้องติดต่อผ่าน WeChat หรือบุคคลกลาง  
* ไม่ทราบ MOQ  
* ไม่ทราบระยะเวลาผลิต  
* ไม่สามารถติดตามออเดอร์ได้  
* ไม่ทราบว่าสินค้าผลิตถึงขั้นตอนไหน  
* ไม่ทราบค่าใช้จ่ายขนส่งและนำเข้า  
* ไม่มีระบบตรวจสินค้า  
* ไม่มีระบบจัดการการเคลม  
* ไม่มีหลักฐานและเอกสารรวมอยู่ในที่เดียว  
* สินค้าจากหลายโรงงานติดตามยาก  
* ไม่มีสถานที่ดูตัวอย่างวัสดุจริง

## **3.2 ปัญหาของผู้เรียนหลักสูตร**

หลังจากเรียนหรือเดินทางดูงาน ผู้เรียนอาจสนใจสินค้า แต่ไม่มีเครื่องมือสำหรับ

* กลับมาค้นหาสินค้าที่เคยดู  
* บันทึกสินค้าที่สนใจ  
* จัดสินค้าแยกตามโครงการ  
* เช็กราคาตัวแทน  
* เปิดออเดอร์จริง  
* ติดตามการผลิตและขนส่ง  
* สร้างรายการสินค้าเพื่อเสนอให้ลูกค้า

หากไม่มีแพลตฟอร์ม การเรียนหรือการเดินทางดูงานอาจจบลงเพียงการได้รับความรู้ แต่ไม่สามารถต่อยอดเป็นยอดขายได้อย่างมีประสิทธิภาพ

## **3.3 ปัญหาของบริษัทผู้บริหารแพลตฟอร์ม**

บริษัทต้องการควบคุมและตรวจสอบ

* สมาชิกทั้งหมด  
* สินค้าที่เปิดขาย  
* ราคาทุนและราคาขาย  
* ยอดขายแยกตามสมาชิก  
* ยอดขายแยกตามโรงงาน  
* เงินมัดจำ  
* ยอดคงเหลือ  
* การจ่ายเงินให้โรงงาน  
* สถานะการผลิต  
* สถานะการขนส่ง  
* กำไรต่อออเดอร์  
* ค่าคอมมิชชันที่โรงงานต้องจ่าย  
* ข้อร้องเรียนและการเคลม

หากใช้ Excel, LINE, WeChat และเอกสารแยกกัน จะทำให้ข้อมูลกระจัดกระจาย ติดตามยาก และเสี่ยงต่อความผิดพลาด

## **3.4 ปัญหาของโรงงาน**

โรงงานต่างประเทศต้องการขยายตลาดประเทศไทย แต่ไม่ต้องการจัดการตัวแทนรายย่อยจำนวนมาก

GISP ช่วยให้โรงงานมีคู่ค้าและตัวกลางหลักเพียงรายเดียว คือบริษัทผู้บริหารแพลตฟอร์ม ซึ่งทำหน้าที่

* คัดเลือกสินค้า  
* ทำตลาด  
* ฝึกอบรมตัวแทน  
* รวบรวมออเดอร์  
* ประสานงานการผลิต  
* ตรวจสินค้า  
* บริหารการขนส่ง  
* ดูแลลูกค้าในประเทศไทย

---

# **4\. โมเดลธุรกิจหลัก**

## **4.1 รูปแบบความสัมพันธ์**

โรงงานและซัพพลายเออร์ต่างประเทศ  
                 ↓  
บริษัทผู้บริหาร GISP  
                 ↓  
สมาชิกและตัวแทนจำหน่าย  
                 ↓  
ลูกค้าปลายทางหรือเจ้าของโครงการ

## **4.2 บทบาทของบริษัท GISP**

บริษัททำหน้าที่เป็น

* ผู้คัดเลือกโรงงาน  
* ผู้คัดเลือกสินค้า  
* ผู้เจรจาต้นทุน  
* ผู้นำสินค้าเข้าระบบ  
* ผู้ขายสินค้าให้สมาชิก  
* ผู้รับชำระเงิน  
* ผู้เปิด PO ไปโรงงาน  
* ผู้ตรวจสอบการผลิต  
* ผู้ประสานงาน QC  
* ผู้บริหารโลจิสติกส์  
* ผู้นำเข้า  
* ผู้จัดส่ง  
* ผู้ดูแลการเคลม  
* ผู้ตรวจสอบยอดขาย

## **4.3 โมเดลการซื้อขาย**

สมาชิกไม่ได้ซื้อสินค้าโดยตรงจากโรงงาน แต่ซื้อจากบริษัทผู้บริหาร GISP

ราคาสำคัญในระบบ ได้แก่

1. **Factory Cost**  
   ราคาทุนที่บริษัทซื้อจากโรงงาน  
2. **Member Price**  
   ราคาที่บริษัทขายให้สมาชิกหรือตัวแทน  
3. **Suggested Resale Price**  
   ราคาแนะนำให้สมาชิกใช้เป็นแนวทางขายต่อ ไม่ใช่ยอดที่ GISP เรียกเก็บ  
4. **Freight Estimate**  
   ช่วงประมาณการเพื่อวางแผนซึ่งยังไม่ใช่ใบแจ้งหนี้  
5. **Logistics Charge**  
   ค่าขนส่ง ค่านำเข้า และค่าใช้จ่ายที่เกี่ยวข้อง ซึ่งเรียกเก็บภายหลัง

สมาชิกเห็น Member Price, Suggested Resale Price และ Freight Estimate แต่ไม่เห็นราคาทุนโรงงาน
สูตร องค์ประกอบต้นทุน หรือกำไรของบริษัท

---

# **5\. เป้าหมายของ MVP**

## **5.1 เป้าหมายทางธุรกิจ**

MVP ต้องช่วยให้บริษัทสามารถ

* เปิดรับสมาชิกและตัวแทน  
* นำสินค้าเข้าระบบ  
* แสดงราคาขายสมาชิก  
* รับออเดอร์จริง  
* รับชำระเงิน  
* เปิด PO ไปยังหลายโรงงาน  
* ติดตามการผลิต  
* ตรวจสินค้า  
* ติดตามขนส่ง  
* ส่งมอบสินค้า  
* เรียกเก็บค่าขนส่ง  
* ตรวจสอบยอดขายและกำไร  
* เก็บ Order/Supplier Snapshot เพื่อรักษาความถูกต้องของประวัติธุรกรรม

## **5.2 เป้าหมายด้านผู้ใช้งาน**

สมาชิกต้องสามารถ

* สมัครและเข้าสู่ระบบ  
* สร้างโครงการ  
* ค้นหาสินค้า  
* เลือกสี ลาย วัสดุ และตัวเลือกมาตรฐาน  
* เพิ่มสินค้าในโครงการ  
* แยกสินค้าตามห้องหรือพื้นที่  
* ดาวน์โหลดรายการสินค้า  
* เลือกเฉพาะสินค้าที่พร้อมสั่ง  
* สร้างออเดอร์  
* ชำระมัดจำ  
* อัปโหลดหลักฐานการโอน  
* ติดตามการผลิต  
* ดูรายงาน QC  
* อนุมัติสินค้า Custom  
* ติดตามขนส่ง  
* ดูวันนัดส่ง  
* ยืนยันรับสินค้า  
* แจ้งปัญหาและเคลม

## **5.3 เป้าหมายด้านการพัฒนา**

* ทำระบบให้ครบเส้นทางธุรกิจ  
* ไม่สร้างฟังก์ชันลึกเกินความจำเป็น  
* รองรับหลายโรงงาน  
* รองรับหลายประเทศในอนาคต  
* รองรับหลายบริษัทในอนาคต  
* แยกข้อมูลราคาทุนและราคาสมาชิกอย่างปลอดภัย  
* เก็บประวัติการเปลี่ยนแปลงที่สำคัญ  
* สามารถต่อยอดกับ Smart BOQ และ Material Library ได้

---

# **6\. ขอบเขตผู้ใช้งาน**

Production Role Catalog ใช้ Code ตามหัวข้อ 0.8 โดย Multi-role ใช้กับทีมงานภายใน GISP
และ `GISP Admin` ไม่มีใน Production เพราะเป็นชื่อรวมเพื่อสลับบทบาทใน Demo เท่านั้น

* `MEMBER_ADMIN` เป็นทีมงานภายใน GISP ดูแลการอนุมัติ ระงับ และสิทธิ์สมาชิก ไม่ใช่ผู้ดูแลทีมของ Member
* `ORDER_ADMIN` ดูแล Customer Order และการแยก Supplier Order
* `PURCHASING` ดูแล Supplier, Factory Cost, PO และการประสานโรงงาน
* `EXECUTIVE_VIEWER` ดู Basic Executive Summary/Fixed Reports แบบ Read-only

## **6.1 Member / Dealer**

ผู้เรียนหรือผู้สมัครตัวแทนที่ผ่านการอนุมัติแล้ว

สิทธิ์หลัก

* ดูสินค้า  
* ดูราคาสมาชิก  
* ดูราคาแนะนำขายต่อและช่วงประมาณการค่าขนส่ง  
* สร้างโครงการ  
* เลือกตัวเลือกสินค้า  
* ดาวน์โหลดรายการสินค้า  
* เปิดออเดอร์  
* ชำระเงิน  
* ติดตามออเดอร์  
* ดูเอกสาร  
* อนุมัติสินค้า Custom  
* ยืนยันรับสินค้า  
* แจ้งเคลม
* ขอเยี่ยมชม Showroom/โรงงาน Partner

## **6.2 Product Admin**

รับผิดชอบ

* เพิ่มสินค้า  
* แก้ไขสินค้า  
* จัดหมวด  
* เพิ่มรูป  
* เพิ่มตัวเลือกมาตรฐาน  
* กำหนดราคาสมาชิก  
* เปิดหรือปิดการขาย  
* Import ข้อมูลจาก Excel หรือ CSV

## **6.3 Order Admin**

รับผิดชอบ

* ตรวจออเดอร์  
* แยกออเดอร์ตามโรงงาน  
* สร้าง Supplier Order  
* ส่งต่อ Supplier Order ที่พร้อมให้ Purchasing เปิด PO  
* ประสานงานโรงงาน  
* อัปเดตสถานะการผลิต  
* ตรวจความครบถ้วนของออเดอร์

## **6.4 Finance**

รับผิดชอบ

* ตรวจสลิป  
* ยืนยันรับเงิน  
* ออกใบแจ้งมัดจำ  
* ออกใบแจ้งยอดคงเหลือ  
* ออกใบแจ้งค่าขนส่ง  
* บันทึกการจ่ายเงินให้โรงงาน  
* ติดตามยอดค้างชำระ

## **6.5 QC Team**

รับผิดชอบ

* ตรวจสินค้ามาตรฐาน  
* ตรวจสินค้าสั่งผลิต  
* อัปโหลดรูปและวิดีโอ  
* ระบุผล QC  
* บันทึกปัญหา  
* ติดตามการแก้ไข

## **6.6 Logistics Team**

รับผิดชอบ

* รับสินค้าจากโรงงาน  
* รับสินค้าเข้าโกดังจีน  
* ตรวจนับ  
* รวมสินค้า  
* สร้าง Shipment  
* อัปเดต ETA  
* อัปเดตสถานะศุลกากร  
* นัดหมายส่งมอบ  
* บันทึกหลักฐานส่งมอบ

## **6.7 Super Admin**

สิทธิ์สูงสุด

* จัดการผู้ใช้งาน  
* กำหนดสิทธิ์  
* จัดการโรงงาน  
* จัดการสินค้า  
* จัดการราคา  
* จัดการออเดอร์  
* จัดการการเงิน  
* จัดการสถานะ  
* ดูรายงานทั้งหมด  
* แก้ไขข้อมูลที่จำเป็น  
* ตรวจสอบ Audit Log

## **6.8 โรงงานและซัพพลายเออร์**

ใน MVP โรงงานไม่มีบัญชีและไม่เข้าสู่ระบบ

โรงงานส่งข้อมูลผ่านช่องทางภายนอก เช่น

* Email  
* WeChat  
* LINE  
* Google Drive  
* PDF  
* Excel  
* รูปภาพ  
* Video

ทีมงาน GISP เป็นผู้บันทึกข้อมูลเข้าระบบ

---

# **7\. โครงสร้างสมาชิก**

## **7.1 กลุ่มที่สมัครได้**

* ผู้เรียนหลักสูตร  
* ผู้สมัครตัวแทนจำหน่าย

ผู้สมัครต้องผ่านการอนุมัติจาก Admin ก่อนใช้งานระบบเต็มรูปแบบ

## **7.2 สถานะสมาชิก**

* Pending Approval  
* Active  
* Suspended  
* Rejected  
* Inactive

## **7.3 ข้อมูลสมาชิกขั้นต่ำ**

* ชื่อและนามสกุล  
* ชื่อบริษัท  
* ประเภทอาชีพ  
* เบอร์โทรศัพท์  
* อีเมล  
* ชื่อที่ใช้แสดง ถ้ามี  
* Password  
* เลขประจำตัวผู้เสียภาษี ถ้ามี  
* ที่อยู่บริษัท  
* หลักสูตรที่เคยเรียน  
* ประเภทสินค้าที่สนใจ  
* จังหวัดหรือพื้นที่ให้บริการ  
* สถานะการอนุมัติ

## **7.4 กฎสำคัญ**

* ผู้สมัครยังไม่เห็นราคาสมาชิกจนกว่าจะได้รับอนุมัติ  
* สมาชิกที่ถูกระงับดูประวัติเดิมแบบ Read-only ได้ แต่ไม่เห็นราคาและสร้าง/แก้ Project หรือ Order ใหม่ไม่ได้  
* ประวัติออเดอร์เดิมต้องยังคงอยู่  
* Admin สามารถเปลี่ยนระดับหรือสถานะสมาชิกได้  
* หนึ่ง Member Profile ผูกกับหนึ่ง Login และไม่มีหน้าจอ/API สำหรับ Member Team, Sub-user หรือ Team Invitation ใน Core MVP  
* หากเจ้าของสมาชิกให้ผู้ช่วยใช้ Credential เดียวกัน ทุก Action และ Audit จะถือว่าเป็นการกระทำของ Member Account เดียว ระบบไม่สามารถระบุตัวบุคคลจริงแยกกันได้
* การเปลี่ยนสิทธิ์ต้องบันทึกประวัติ

---

# **8\. แนวคิด Project First**

GISP ใช้โครงการเป็นศูนย์กลางของระบบ

สมาชิกไม่ได้ซื้อสินค้าเข้าสต๊อกเป็นหลัก แต่เลือกสินค้าเพื่อนำไปใช้กับงานของลูกค้าแต่ละโครงการ

โครงสร้างคือ

สมาชิก  
  ↓  
Project  
  ↓  
Project Items  
  ↓  
Order  
  ↓  
Supplier Orders  
  ↓  
Production / QC / Shipment / Delivery

## **8.1 กฎของ Project**

* หนึ่ง Project มีลูกค้าหลักหนึ่งราย  
* หนึ่ง Project มีสถานที่ส่งของหลักหนึ่งแห่ง  
* หนึ่ง Project มีหลายห้องหรือหลายพื้นที่ได้  
* หนึ่ง Project มีสินค้าจากหลายโรงงานได้  
* หนึ่ง Project สร้างหลายออเดอร์ได้  
* สมาชิกเลือกสั่งสินค้าเป็นบางรายการได้  
* สินค้าที่ไม่ได้สั่งยังคงอยู่ใน Project  
* สินค้าที่สั่งแล้วต้องไม่ถูกสั่งซ้ำโดยไม่ตั้งใจ

## **8.2 ข้อมูล Project**

* Project Code  
* ชื่อโครงการ  
* ชื่อลูกค้า  
* เบอร์โทรลูกค้า  
* ที่อยู่หน้างาน  
* พิกัด Google Maps  
* ผู้ติดต่อหน้างาน  
* เบอร์โทรผู้ติดต่อ  
* ประเภทโครงการ  
* วันที่คาดว่าต้องการสินค้า  
* หมายเหตุการเข้าพื้นที่  
* สมาชิกผู้ดูแล  
* สถานะโครงการ

## **8.3 สถานะ Project**

* Draft  
* Active  
* On Hold  
* Completed  
* Cancelled  
* Archived

---

# **9\. ระบบสินค้า**

## **9.1 ประเภทสินค้า**

* Standard Product  
* Custom Product  
* Ready-to-Order Pre-order Product  
* Built-in Product  
* Material  
* Equipment  
* Decorative Item  

MVP จะเน้น Pre-order และยังไม่ทำระบบ Stock ในประเทศไทย

## **9.2 ข้อมูลสินค้าขั้นต่ำ**

* Product Code  
* Factory SKU  
* ชื่อสินค้าไทย  
* ชื่อสินค้าอังกฤษ  
* ชื่อสินค้าจีน  
* โรงงาน  
* ประเทศต้นทาง  
* หมวดหลัก  
* หมวดย่อย  
* Collection  
* รูปหลัก  
* รูปเพิ่มเติม  
* ขนาด  
* น้ำหนัก ถ้ามี  
* CBM ถ้ามี  
* วัสดุ  
* สีและ Finish  
* ตัวเลือกสินค้า  
* MOQ  
* Lead Time  
* ราคาทุนโรงงาน  
* ราคาสมาชิก  
* สกุลเงินต้นทุน  
* สถานะเปิดขาย  
* เอกสารอ้างอิง  
* หน้า PDF ต้นฉบับ  
* หมายเหตุการสั่งซื้อ

## **9.3 ข้อมูลราคาที่ต้องแยก**

* Factory Cost  
* Member Price  
* Suggested Resale Price  
* Freight Estimate Range  
* Price Formula Version/Scope  
* Currency  
* Effective Date  
* Expiry Date ถ้ามี  
* Price Status  
* Price Version

## **9.4 กฎราคา**

* สมาชิกเห็น Member Price, Suggested Resale Price และ Freight Estimate เท่านั้น  
* ราคาทุนเห็นเฉพาะผู้มีสิทธิ์  
* สูตรและ Component ต้นทุนเห็นเฉพาะ Super Admin  
* รายการใน Project ใช้ราคาปัจจุบันล่าสุด  
* เมื่อสร้าง Order ระบบต้อง Snapshot ราคา  
* ราคาใน Order ห้ามเปลี่ยนย้อนหลัง  
* หาก Admin เปลี่ยนราคาสินค้า จะมีผลเฉพาะ Project Item ที่ยังไม่เป็น Order  
* สินค้าที่ไม่มีราคาสมาชิก Active ไม่สามารถกดสั่งทันที

## **9.5 Price Structure Builder**

สูตรราคามีลำดับ `Global → Supplier → Product` โดย Product มี Priority สูงสุดและ Override
เฉพาะ Component ที่ต่างจากระดับบนได้ Component รองรับ `percentage` หรือ `fixed_amount_thb`
และต้องมี Version, Effective Date, Status, Preview และ Audit

Template เริ่มต้นซึ่ง Super Admin แก้ได้:

* Factory Cost THB = Factory Cost รวม Variant/Option Adjustment × Exchange Rate Snapshot  
* Platform Cost = 5% ของ Factory Cost THB  
* Marketing/Training/Factory Visit Cost = 10% ของ Factory Cost THB  
* Product Sourcing/Catalog Operations Cost = 10% ของ Factory Cost THB  
* Member Price = Factory Cost THB + Component ที่รวมในราคาสมาชิก หรือเท่ากับ 125.00 เมื่อทุนเป็น 100.00  
* Suggested Resale Price = Member Price + 25% หรือเท่ากับ 156.25 เมื่อทุนเป็น 100.00  
* Freight Estimate = 15–20% ของ Factory Cost THB แสดงแยก ไม่รวมใน Member Price

ผลคำนวณใช้ Decimal และ Round Half-up สองตำแหน่ง การ Activate สูตรใหม่มีผลเฉพาะราคาหรือ
Project Item ที่ยังไม่ถูก Snapshot เป็น Order และห้ามแก้ Order เดิมย้อนหลัง

---

# **10\. Product Options และโชว์รูม**

สินค้าแต่ละรายการควรมีตัวเลือกมาตรฐานที่สมาชิกเลือกได้ เช่น

* สี  
* ลาย  
* วัสดุ  
* ผ้า  
* หนัง  
* สีไม้  
* สีโลหะ  
* หิน  
* ขนาด  
* มือจับ  
* Hardware  
* Accessories

แต่ละตัวเลือกควรมีรหัส เช่น

* Fabric F001  
* Wood W301  
* Stone S102  
* Metal M205

## **10.1 กฎ Product Option**

* สมาชิกเลือกจากตัวเลือกที่ Admin กำหนด  
* สมาชิกไม่ควรพิมพ์ชื่อวัสดุแทนตัวเลือกมาตรฐาน  
* สมาชิกเพิ่มหมายเหตุได้  
* หมายเหตุไม่ทำให้ราคาเปลี่ยนอัตโนมัติ  
* หากหมายเหตุขัดกับสเปกมาตรฐาน ต้องเปลี่ยนเป็น Custom Request  
* ตัวอย่างวัสดุระบุได้ว่าอยู่ที่ Showroom Partner ในจีนหรือชมรมในประเทศไทย

## **10.2 ข้อมูลตัวอย่างวัสดุและ Built-in Display**

* Sample Code  
* Option Code  
* Sample Type: `material_swatch` หรือ `built_in_display`  
* Option, Material หรือ Built-in Product ที่เกี่ยวข้อง  
* ประเทศ เมือง และสถานที่จัดแสดง  
* Shelf Location  
* Available / Borrowed / Unavailable  
* รูปตัวอย่าง  
* หมายเหตุ

เฟอร์นิเจอร์ทั่วไปไม่ถือเป็น Sample ใน Core MVP สมาชิกดูสินค้าจริงที่ Showroom/โรงงาน Partner
ในประเทศจีน ส่วนประเทศไทยเน้นตัวอย่างวัสดุ ยกเว้น Built-in Display บางรายการ เช่น
ตู้เสื้อผ้าและชุดครัว

## **10.3 Factory/Showroom Visit Workflow**

สถานะใช้ `SUBMITTED → APPROVED → COMPLETED` พร้อมทางออก `REJECTED` และ `CANCELLED`
Member ส่งคำขอ ส่วน Purchasing/GISP Admin นัดหมายและบันทึกผล ระบบไม่รวมการจองทริป
Calendar, Itinerary หรือค่าเดินทางเต็มรูปแบบ

## **10.4 Factory Confidentiality**

ก่อน Visit Completed สมาชิกเห็นเพียงประเทศ เมือง ประเภท Showroom ประเภทวัสดุ รูปและสถานะ
ห้ามแสดงชื่อโรงงาน ที่อยู่ Contact หรือ Supplier ID ผ่าน UI, API, Export หรือ URL เมื่อ Visit เป็น
`COMPLETED` จึงสร้างสิทธิ์เปิดเผยแบบถาวรเฉพาะ Member Profile + Supplier นั้น
Super Admin เพิกถอนได้พร้อมเหตุผลและ Audit สมาชิกอื่นไม่ได้รับสิทธิ์ตาม Organization หรือความสัมพันธ์


---

# **11\. Product Schedule และการดาวน์โหลด**

MVP ยังไม่สร้าง Quotation Builder ในชื่อบริษัทสมาชิก

สมาชิกสามารถดาวน์โหลดรายการสินค้าออกไปจัดทำใบเสนอราคาภายนอกระบบ

## **11.1 รูปแบบไฟล์**

* PDF  
* Excel

## **11.2 ข้อมูลใน Product Schedule**

* ชื่อ Project  
* ชื่อลูกค้า  
* ที่อยู่หน้างาน  
* วันที่จัดทำ  
* รหัสสินค้า  
* รูปสินค้า  
* ชื่อสินค้า  
* โรงงาน  
* หมวดสินค้า  
* ห้องหรือพื้นที่  
* ขนาด  
* วัสดุ  
* สี  
* ตัวเลือก  
* หมายเหตุ  
* จำนวน  
* ราคาสมาชิกต่อหน่วย  
* ราคาแนะนำขายต่อต่อหน่วย  
* ช่วงประมาณการค่าขนส่ง  
* ราคารวม  
* Lead Time  
* เงื่อนไขราคา  
* ข้อความว่าไม่รวมค่าขนส่งและค่าใช้จ่ายนำเข้า  
* Project Reference

## **11.3 ข้อมูลที่ห้ามแสดง**

* Factory Cost  
* กำไรบริษัท  
* ค่าคอมมิชชันโรงงาน  
* หมายเหตุภายใน  
* ข้อมูลติดต่อโรงงานที่เป็นความลับ
* สูตรราคาและองค์ประกอบต้นทุน

---

# **12\. การสร้างออเดอร์**

สมาชิกสามารถเลือกเฉพาะรายการที่พร้อมสั่งจาก Project เพื่อสร้าง Order

## **12.1 กฎออเดอร์**

* หนึ่ง Project มีหลาย Order ได้  
* หนึ่ง Order มีหลายโรงงานได้  
* หนึ่ง Order มีที่อยู่ส่งมอบหลักหนึ่งแห่ง  
* ที่อยู่ดึงจาก Project  
* ระบบต้องแยก Supplier Order ตามโรงงาน  
* สมาชิกเห็นเป็น Customer Order เดียว  
* Admin เห็น Customer Order และ Supplier Orders  
* Order ต้องมีเลขอ้างอิงไม่ซ้ำ  
* สินค้าที่ถูกสร้าง Order แล้วต้องเปลี่ยนสถานะเป็น Ordered  
* Order ต้องบันทึกราคาและสเปก ณ วันที่ยืนยัน

## **12.2 โครงสร้าง**

Customer Order  
├── Supplier Order โรงงาน A  
├── Supplier Order โรงงาน B  
└── Supplier Order โรงงาน C

## **12.3 สถานะ Order หลัก**

* Draft  
* Awaiting Deposit  
* Deposit Submitted  
* Deposit Verified  
* Processing  
* Partially In Production  
* In Production  
* Awaiting Balance Payment  
* Balance Verified  
* Partially Shipped  
* In Transit  
* Delivered  
* Awaiting Freight Payment  
* Completed  
* Cancellation Requested  
* Cancelled

## **12.4 สถานะ Supplier Order**

* Pending PO  
* PO Issued  
* Factory Confirmed  
* Awaiting Factory Deposit  
* Material Preparation  
* In Production  
* Partially Completed  
* Awaiting QC  
* Rework Required  
* QC Passed  
* Awaiting Member Approval  
* Ready for Balance Payment  
* Balance Paid  
* Ready for Factory Dispatch  
* Delivered to China Warehouse  
* Consolidated  
* Shipped

---

# **13\. การชำระเงินของสมาชิก**

## **13.1 รูปแบบการชำระ**

MVP ใช้การโอนเงินเข้าบัญชีบริษัทและอัปโหลดสลิป

ยังไม่ทำ

* Payment Gateway  
* ระบบตัดบัตร  
* QR Payment อัตโนมัติ  
* การตรวจสลิปอัตโนมัติเต็มรูปแบบ

## **13.2 งวดการชำระ**

### **งวดที่ 1: มัดจำ 50%**

คำนวณจากราคาสมาชิกของสินค้าใน Order

สมาชิกชำระหลังยืนยัน Order

### **งวดที่ 2: ยอดคงเหลือ 50%**

เรียกเก็บก่อนโรงงานส่งสินค้า หลังผลิตเสร็จและผ่านเงื่อนไข QC

### **งวดที่ 3: ค่าขนส่งและค่าใช้จ่ายที่เกี่ยวข้อง**

เรียกเก็บหลังส่งสินค้าถึงบ้านหรือหน้างานลูกค้า ตามยอดที่บริษัทสรุป

## **13.3 ขั้นตอนตรวจเงิน**

สมาชิกโอนเงิน  
→ อัปโหลดสลิป  
→ สถานะ Deposit Submitted  
→ Finance ตรวจสอบ  
→ Finance ยืนยันรับเงิน  
→ สถานะ Deposit Verified  
→ Purchasing เปิด PO

## **13.4 เอกสารทางการเงินใน MVP**

* ใบแจ้งมัดจำ 50%  
* ใบแจ้งยอดคงเหลือ 50%  
* ใบแจ้งค่าขนส่ง

ใบเสร็จรับเงินและใบกำกับภาษีออกโดยฝ่ายบัญชีนอกระบบในระยะแรก

## **13.5 ข้อมูลหลักฐานการชำระ**

* Payment Reference  
* Order Number  
* Payment Type  
* Amount  
* Transfer Date  
* Bank  
* Slip Image  
* Submitted By  
* Verification Status  
* Verified By  
* Verified At  
* Finance Note

---

# **14\. การจ่ายเงินให้โรงงาน**

บริษัทจ่ายเงินให้โรงงานตามราคาทุน ซึ่งแยกจากราคาสมาชิก

รูปแบบเบื้องต้น

* มัดจำโรงงาน 50%  
* ยอดคงเหลือโรงงาน 50% ก่อนส่งสินค้า

## **14.1 กฎสำคัญ**

* สมาชิกจ่าย 50% จากราคาสมาชิก  
* บริษัทจ่ายโรงงาน 50% จากราคาทุน  
* จำนวนเงินไม่เท่ากัน แม้เปอร์เซ็นต์เท่ากัน  
* การจ่ายโรงงานต้องบันทึกแยกตาม Supplier Order  
* สมาชิกไม่เห็นข้อมูลการจ่ายโรงงาน  
* ระบบคำนวณกำไรขั้นต้นจาก Revenue และ Factory/Logistics Cost โดยไม่สร้างหรือหัก Commission ใน Core MVP

---

# **15\. สินค้า Custom**

MVP รองรับ Custom Product แบบง่าย

## **15.1 ประเภท Custom**

* เปลี่ยนขนาด  
* เปลี่ยนสี  
* เปลี่ยนวัสดุ  
* เปลี่ยนอุปกรณ์  
* ผลิตตามแบบ  
* ผลิตสำหรับ Project เฉพาะ  
* งานบิลท์อิน  
* งานตามไฟล์ CAD หรือ PDF

## **15.2 ขั้นตอน**

สมาชิกสร้าง Custom Request  
→ อัปโหลดข้อมูล  
→ Admin ตรวจสอบ  
→ ขอข้อมูลเพิ่มหรือทำรายการเป็น Ready for Quote  
→ Admin ประสานโรงงานและสร้าง GISP Custom Quotation แบบ Version  
→ Member Accept/Reject Quotation  
→ Accepted Quotation สร้าง Project Item เป็น Ready to Order  
→ Member เลือก Project Item เพื่อสร้าง Order  
→ ชำระมัดจำ

## **15.3 ข้อมูล Custom Request**

* Project  
* ชื่อรายการ  
* รายละเอียด  
* ขนาด  
* วัสดุ  
* สี  
* จำนวน  
* รูปภาพ  
* PDF  
* CAD  
* Reference Image  
* หมายเหตุ  
* Supplier Candidate  
* Assignment และ Due Date  
* Admin Note  
* Status

ราคา, VAT, Confirmed Spec, Lead Time, Validity และผล Accept/Reject ต้องเก็บใน Custom Quotation
แยกจาก Custom Request

## **15.4 สิ่งที่ยังไม่ทำใน MVP**

* Shop Drawing Workflow เต็มรูปแบบ  
* Version Control หลายชั้น  
* ระบบอนุมัติวัสดุแยกขั้นตอน  
* Digital Signature บนแบบ  
* ระบบเปรียบเทียบ Revision อัตโนมัติ

แต่ต้องเก็บไฟล์ที่ใช้ยืนยัน Order ไว้เป็นหลักฐาน

---

# **16\. การผลิต**

Supplier Order แต่ละโรงงานมี Timeline ของตนเอง

## **16.1 สถานะการผลิตขั้นต่ำ**

* Factory Confirmed  
* Material Preparation  
* In Production  
* Partially Completed  
* Production Completed  
* Awaiting QC  
* Rework Required  
* QC Passed  
* Ready for Dispatch

## **16.2 ข้อมูลการผลิต**

* Start Date  
* Estimated Completion Date  
* Actual Completion Date  
* Factory Update  
* Progress Percentage แบบกำหนดเอง  
* รูปภาพ  
* วิดีโอ  
* หมายเหตุ  
* ผู้บันทึก  
* วันที่อัปเดต

ระบบไม่จำเป็นต้องเชื่อม ERP โรงงานใน MVP ทีมงานเป็นผู้บันทึกสถานะ

---

# **17\. ระบบตรวจสอบคุณภาพ**

MVP ใช้ QC สองรูปแบบ

## **17.1 สินค้ามาตรฐาน**

ทีมงานตรวจและอนุมัติ

สมาชิกสามารถดูรายงาน รูป และวิดีโอ แต่ไม่ต้องกดอนุมัติทุกชิ้น

## **17.2 สินค้า Custom**

ทีมงานตรวจสอบก่อน จากนั้นสมาชิกต้องอนุมัติก่อนเรียกเก็บยอดคงเหลือและส่งสินค้า

## **17.3 สถานะ QC**

* Awaiting QC  
* QC In Progress  
* QC Passed  
* QC Failed  
* Rework Required  
* Waiting Member Approval  
* Member Approved  
* Additional Review Requested

## **17.4 ข้อมูลรายงาน QC**

* Supplier Order  
* Product Item  
* Inspector  
* Inspection Date  
* รูปภาพ  
* วิดีโอ  
* Checklist  
* จุดผิดปกติ  
* ผลการตรวจ  
* Rework Note  
* Member Approval  
* Approval Date  
* Approval Note

## **17.5 Business Rules**

* ทีมงานเป็นผู้ตัดสินผล QC ทางเทคนิค  
* สมาชิกอนุมัติด้านสี ลาย รูปแบบ และความตรงกับสเปกสำหรับ Custom Product  
* สมาชิกเลือก “อนุมัติให้จัดส่ง” หรือ “ขอให้ตรวจสอบเพิ่มเติม”  
* ไม่ใช้การอนุมัติอัตโนมัติเมื่อสมาชิกไม่ตอบ  
* ทุกการอนุมัติต้องมีประวัติ

---

# **18\. การรวมสินค้าและขนส่ง**

## **18.1 หลักการเริ่มต้น**

ค่าเริ่มต้นของ Order หลายโรงงานคือ

> รอรวมสินค้าครบที่โกดังจีนและจัดส่งพร้อมกัน

Admin สามารถเปลี่ยนเป็นส่งบางส่วนได้ตาม

* ความเร่งด่วน  
* ต้นทุน  
* ความล่าช้าของโรงงาน  
* ความพร้อมของหน้างาน  
* ข้อจำกัดของโกดัง  
* การอนุมัติค่าใช้จ่ายเพิ่มเติม

## **18.2 กฎ Partial Shipment**

* Admin เป็นผู้เสนอ  
* หากค่าใช้จ่ายเพิ่ม สมาชิกต้องรับทราบ  
* ระบบต้องสร้าง Shipment แยก  
* Shipment แต่ละเที่ยวต้องระบุรายการสินค้า  
* Order หลักต้องแสดงว่าจัดส่งบางส่วน

## **18.3 สถานะโลจิสติกส์**

* Factory Pickup Scheduled  
* Picked Up from Factory  
* Arrived at China Warehouse  
* Warehouse Counting  
* Waiting Consolidation  
* Consolidated  
* Packing Confirmed  
* Container / LCL Booking  
* Export Customs  
* Departed China  
* In Transit  
* Arrived Thailand  
* Import Customs  
* Thailand Warehouse  
* Delivery Scheduled  
* Out for Delivery  
* Delivered

## **18.4 ข้อมูล Shipment**

* Shipment Number  
* Order  
* Supplier Orders  
* รายการสินค้า  
* Shipping Method  
* LCL / FCL / Truck / Air  
* China Warehouse  
* Container Number  
* Tracking Number  
* Carrier  
* ETD  
* ETA  
* Actual Arrival  
* Packing List  
* BL หรือเอกสารขนส่ง  
* Status  
* Delay Note

---

# **19\. การส่งมอบ**

หนึ่ง Order มีที่อยู่ส่งมอบหลักหนึ่งแห่ง ซึ่งดึงจาก Project

## **19.1 ข้อมูลส่งมอบ**

* Delivery Date  
* Delivery Time  
* Site Address  
* Google Maps  
* Site Contact  
* Driver  
* Vehicle  
* Delivery Note  
* รายการสินค้าที่ส่ง  
* รูปภาพหน้างาน  
* ชื่อผู้รับ  
* ลายเซ็นหรือการกดยืนยัน  
* สภาพสินค้า  
* หมายเหตุความเสียหาย

## **19.2 สถานะการรับสินค้า**

* Received Complete  
* Received with Issue  
* Partially Received  
* Delivery Failed  
* Reschedule Required

## **19.3 Business Rules**

* ผู้รับสินค้าหรือสมาชิกต้องยืนยันรับสินค้า  
* หากพบความเสียหาย ต้องบันทึกทันที  
* รูปภาพและหมายเหตุต้องเชื่อมกับ Claim ได้  
* หลังส่งมอบ ระบบสามารถออกใบแจ้งค่าขนส่ง

---

# **20\. ค่าขนส่งและค่าใช้จ่ายนำเข้า**

ราคาสมาชิกใน Catalog เป็นราคาสินค้าและไม่รวมค่าขนส่งหรือค่าใช้จ่ายนำเข้า

## **20.1 ค่าใช้จ่ายที่อาจเกิดขึ้น**

* ขนส่งภายในประเทศจีน  
* ค่าโกดังจีน  
* ค่าตรวจนับ  
* ค่ารวมสินค้า  
* ค่าบรรจุเพิ่มเติม  
* ค่าขนส่งระหว่างประเทศ  
* ค่าประกัน  
* ภาษี  
* ค่าพิธีการศุลกากร  
* ค่าโกดังประเทศไทย  
* ค่าขนส่งหน้างาน  
* ค่ายกของ  
* ค่าใช้จ่ายพิเศษ

## **20.2 MVP**

* ทีมงานกรอกค่าใช้จ่ายจริง  
* ระบบรวมยอด  
* ออกใบแจ้งค่าขนส่ง  
* สมาชิกอัปโหลดสลิป  
* Finance ตรวจสอบ  
* เมื่อรับเงินครบ Order จึงเข้าสถานะ Completed

ยังไม่ต้องมีระบบคำนวณ Freight อัตโนมัติ

---

# **21\. ระบบยกเลิกออเดอร์**

## **21.1 ก่อน Finance ยืนยันรับเงิน**

สมาชิกสามารถยกเลิก Draft Order หรือ Order ที่ยังไม่ตรวจรับเงินได้

## **21.2 หลัง Finance ยืนยันมัดจำ**

สมาชิกไม่สามารถยกเลิกเองได้

ต้องส่ง Cancellation Request พร้อมเหตุผลให้ Admin พิจารณา

## **21.3 ข้อมูลคำขอยกเลิก**

* Order  
* Request Date  
* Requested By  
* Reason  
* Supporting File  
* Factory PO Status  
* Factory Payment Status  
* Refund Amount  
* Deduction  
* Admin Decision  
* Decision Note  
* Status

## **21.4 Business Rules**

* หากบริษัทเปิด PO หรือจ่ายมัดจำโรงงานแล้ว อาจคืนเงินไม่เต็มจำนวน  
* การคืนเงินเป็นการพิจารณาโดย Admin  
* MVP ยังไม่คำนวณ Refund อัตโนมัติ  
* ทุกการยกเลิกต้องมีประวัติ

---

# **22\. ระบบเคลมและบริการหลังการขาย**

## **22.1 ขั้นตอน**

สมาชิกแจ้งปัญหา  
→ แนบรูปหรือวิดีโอ  
→ Admin ตรวจสอบ  
→ ประสานโรงงานหรือทีมซ่อม  
→ เสนอแนวทางแก้ไข  
→ ดำเนินการ  
→ สมาชิกยืนยันผล  
→ ปิดเคส

## **22.2 ประเภทปัญหา**

* สินค้าไม่ครบ  
* ผิดรุ่น  
* ผิดสี  
* ผิดขนาด  
* ชำรุด  
* แตกหัก  
* งานผลิตไม่ได้มาตรฐาน  
* ความเสียหายจากขนส่ง  
* ปัญหาการติดตั้ง  
* อื่น ๆ

## **22.3 สถานะ Claim**

* Submitted  
* Under Review  
* Waiting Information  
* Coordinating Supplier  
* Repair Approved  
* Replacement Approved  
* Compensation Proposed  
* In Progress  
* Resolved  
* Closed  
* Rejected

## **22.4 MVP**

* สมาชิกสร้างเคส  
* อัปโหลดรูปและวิดีโอ  
* Admin อัปเดตสถานะ  
* มี Timeline การดำเนินงาน  
* ยังไม่คำนวณค่าชดเชยหรือ Warranty อัตโนมัติ
* การ Reject ต้องมี Rejection Reason
* การ Close ต้องมี Resolution, หลักฐานการดำเนินการ และ Member Confirmation/Admin Review ตามประเภทเคส
* เงื่อนไข Warranty ของ Partner ต้องมี Version และ Snapshot ลง Order Item  
* ก่อนปลดล็อกโรงงาน Member เห็นคำว่า `Partner Warranty` และเงื่อนไขโดยไม่เห็นชื่อโรงงาน  
* ระบบเสนอ Responsibility จาก Issue Type แต่ `ORDER_ADMIN` ต้องยืนยันก่อนดำเนินการ  
* Manufacturing/Material/Specification ใช้ `SUPPLIER`; Transit Damage ใช้ `LOGISTICS_INSURANCE`; Installation ใช้ `INSTALLER`  
* GISP รับเรื่อง ตรวจหลักฐาน และประสานงาน แต่ไม่ให้เงื่อนไขเกินกว่าผู้รับผิดชอบต้นทาง

---

# **23\. ระบบแจ้งเตือน**

## **23.1 ช่องทาง MVP**

* In-App Notification  
* Email


## **23.2 เหตุการณ์ที่ควรแจ้ง**

* สมัครสมาชิกสำเร็จ  
* สมาชิกได้รับอนุมัติ  
* Order ถูกสร้าง  
* ระบบรอชำระมัดจำ  
* Finance ยืนยันรับมัดจำ  
* เปิด PO แล้ว  
* โรงงานเริ่มผลิต  
* ผลิตเสร็จ  
* มีรายงาน QC  
* Custom Product รอสมาชิกอนุมัติ  
* รอชำระยอดคงเหลือ  
* Finance ยืนยันยอดคงเหลือ  
* สินค้าออกจากโรงงาน  
* สินค้าออกจากประเทศจีน  
* สินค้าถึงประเทศไทย  
* นัดหมายส่งของ  
* ส่งมอบแล้ว  
* มีใบแจ้งค่าขนส่ง  
* Claim มีการอัปเดต  
* Order ล่าช้า

---

# **24\. Dashboard สมาชิก**

สมาชิกควรเห็นข้อมูลสำคัญทันทีหลัง Login

## **24.1 KPI**

* จำนวน Project  
* Project ที่กำลังดำเนินการ  
* รายการรอสรุป  
* Order รอชำระเงิน  
* Order กำลังผลิต  
* Order กำลังขนส่ง  
* Order รอส่งมอบ  
* ยอดค้างชำระ  
* Custom Request รออนุมัติ  
* Claim ที่เปิดอยู่

## **24.2 Action Required**

* อัปโหลดสลิป  
* อนุมัติ QC  
* ตรวจวันนัดส่ง  
* ชำระยอดคงเหลือ  
* ชำระค่าขนส่ง  
* ส่งข้อมูลเพิ่มเติม

---

# **25\. Dashboard Admin**

## **25.1 ข้อมูลหลัก**

* สมาชิกทั้งหมด  
* สมาชิก Pending  
* ยอดขายรวม  
* มูลค่าออเดอร์เปิด  
* มัดจำที่รับ  
* ยอดคงเหลือค้าง  
* ออเดอร์กำลังผลิต  
* Supplier Order ล่าช้า  
* สินค้ารอ QC  
* Shipment ระหว่างขนส่ง  
* งานรอส่งมอบ  
* ค่าขนส่งค้างเก็บ  
* Claim เปิดอยู่

## **25.2 รายงานแยกตาม**

* สมาชิก  
* Project  
* Order  
* โรงงาน  
* ประเทศ  
* หมวดสินค้า  
* เดือน  
* สถานะ  
* ผู้รับผิดชอบ

---

# **26\. Dashboard ผู้บริหาร**

Core MVP แสดง Executive Summary แบบอ่านอย่างเดียวจาก Order, Payment, Delay, Delivery และ Claim เท่านั้น

## **26.1 KPI ขั้นพื้นฐาน**

* Order Count และ Order Value  
* Payment Verified และ Customer Outstanding  
* Production Delay Rate  
* Claim Rate  
* On-time Delivery Rate

# **27\. ระบบนำสินค้าเข้า**

## **27.1 วิธีใน MVP**

* เพิ่มสินค้าผ่าน Admin Form  
* Import Excel หรือ CSV  
* อัปโหลดรูป  
* แนบ PDF Catalog  
* แนบ Price List

## **27.2 กฎสำคัญ**

* โรงงานไม่เพิ่มสินค้าเอง  
* ทุกสินค้าต้องผ่าน Admin  
* ห้าม Publish สินค้าที่ยังไม่มีข้อมูลขั้นต่ำ  
* ราคาต้นทุนต้องจำกัดสิทธิ์  
* สินค้าที่หยุดขายต้องไม่หายจาก Order เก่า

---

# **28\. เอกสารในระบบ**

## **28.1 เอกสารฝั่งสมาชิก**

* Product Schedule PDF  
* Product Schedule Excel  
* Deposit Invoice  
* Balance Invoice  
* Freight Invoice  
* Order Summary  
* QC Report  
* Packing List  
* Shipping Document ที่อนุญาต  
* Delivery Proof  
* Claim Documents

## **28.2 เอกสารภายใน**

* Supplier PO  
* Factory Invoice  
* Factory Payment Evidence  
* Cost Sheet  
* Internal Margin Report  
* Internal QC Note

## **28.3 Permission**

สมาชิกต้องไม่เห็นเอกสารต้นทุนและเอกสารภายใน

---

# **29\. Audit Log และประวัติ**

ทุกกิจกรรมสำคัญควรบันทึก

* ใครทำ  
* ทำอะไร  
* เวลาใด  
* ค่าก่อนแก้  
* ค่าหลังแก้  
* เหตุผล ถ้ามี

กิจกรรมสำคัญ ได้แก่

* เปลี่ยนราคา  
* เปลี่ยนสเปก  
* ยืนยันการชำระ  
* เปิด PO  
* เปลี่ยนสถานะผลิต  
* อนุมัติ QC  
* เปลี่ยน Shipment  
* ยกเลิก Order  
* ปิด Claim  
* เปลี่ยนสิทธิ์สมาชิก

---

# **30\. Business Rules หลัก**

1. โรงงานไม่มีบัญชีใน MVP  
2. ทีมงานและ Admin เป็นผู้เพิ่มสินค้า  
3. ผู้ใช้ต้องผ่านการอนุมัติก่อนเห็นราคาสมาชิก  
4. สมาชิกเห็นเฉพาะราคาขายสมาชิก  
5. ราคาทุนโรงงานเป็นข้อมูลลับ  
6. สินค้ามาตรฐานที่มีราคา Active สามารถสั่งซื้อได้ทันที  
7. สินค้า Custom ต้องผ่านการเสนอราคาและยืนยัน  
8. Project เป็นศูนย์กลางของการซื้อ  
9. หนึ่ง Project มีลูกค้าหลักหนึ่งราย  
10. หนึ่ง Project มีที่อยู่ส่งหลักหนึ่งแห่ง  
11. หนึ่ง Project มีหลาย Order ได้  
12. หนึ่ง Order มีหลายโรงงานได้  
13. ระบบแตก Supplier Order ตามโรงงาน  
14. ราคาถูก Snapshot เมื่อสร้าง Order  
15. สมาชิกชำระมัดจำ 50% ของราคาสมาชิก  
16. Finance ต้องยืนยันสลิปก่อนเปิด PO  
17. บริษัทจ่ายโรงงานตามราคาทุน  
18. สินค้ามาตรฐาน QC โดยทีมงาน  
19. สินค้า Custom ต้องให้สมาชิกอนุมัติ  
20. ค่าเริ่มต้นคือ Consolidate All  
21. Admin เปลี่ยนเป็น Partial Shipment ได้  
22. ค่าขนส่งเรียกเก็บหลังส่งมอบ  
23. ผู้รับหน้างานต้องยืนยันรับสินค้า  
24. หลังรับมัดจำ สมาชิกยกเลิกเองไม่ได้  
25. Claim ต้องมีหลักฐาน  
26. ทุกการเปลี่ยนแปลงสำคัญต้องมีประวัติ

---

# **31\. Must Have สำหรับ MVP**

## **31.1 Member Management**

* สมัครสมาชิก  
* Login  
* Forgot/Reset Password  
* อนุมัติสมาชิก  
* ระงับสมาชิก  
* กำหนด Role

## **31.2 Supplier and Product**

* จัดการโรงงาน  
* จัดการประเทศ  
* จัดการสินค้า  
* จัดการหมวด  
* จัดการราคา  
* จัดการ Product Options  
* Import Excel/CSV  
* แนบ PDF และรูป

## **31.3 Project**

* สร้าง Project  
* กำหนดลูกค้า  
* กำหนดที่อยู่  
* แบ่งห้อง  
* เพิ่มสินค้า  
* กำหนดจำนวน  
* เลือก Option  
* เพิ่ม Remark  
* สถานะ Project Item

## **31.4 Product Schedule**

* ดูรายการ  
* ดาวน์โหลด PDF  
* ดาวน์โหลด Excel

## **31.5 Order**

* เลือก Project Items  
* สร้าง Order  
* หลายโรงงานต่อ Order  
* Supplier Orders  
* Snapshot ราคา  
* สถานะ Order  
* Cancellation Request

## **31.6 Payment**

* ใบแจ้งมัดจำ  
* ใบแจ้งยอดคงเหลือ  
* ใบแจ้งค่าขนส่ง  
* VAT Snapshot และยอดก่อน VAT/VAT/ยอดรวม  
* อัปโหลดสลิปแบบแบ่งโอนได้หลายครั้ง  
* Finance Verify จากยอดสะสมและ Flag ยอดเกิน  
* Payment History  
* Supplier Deposit/Balance 50/50  
* Supplier Payment Approval และ History

## **31.7 Custom Request**

* อัปโหลด PDF/CAD/รูป  
* ใส่ขนาดและหมายเหตุ  
* Admin ตรวจคำขอและเลือก Supplier  
* GISP ออก Custom Quotation แบบ Version  
* สมาชิก Accept หรือ Reject  
* Accepted Quotation ล็อก Price, Spec, VAT และ Lead Time

## **31.8 Production and QC**

* อัปเดตสถานะ  
* รูปและวิดีโอ  
* QC Report  
* Rework  
* Member Approval สำหรับ Custom

## **31.9 Logistics**

* China Warehouse  
* Consolidation  
* Shipment  
* Tracking  
* ETA  
* Delivery Schedule

## **31.10 Delivery**

* Proof of Delivery  
* ผู้รับสินค้า  
* รูป  
* ลายเซ็นหรือยืนยัน  
* ความเสียหาย

## **31.11 Claim**

* เปิดเคส  
* แนบหลักฐาน  
* อัปเดตสถานะ  
* ปิดเคส

## **31.12 Dashboard**

* Member Dashboard  
* Admin Dashboard  
* Executive Summary ขั้นพื้นฐาน

## **31.13 Notification**

* In-App  
* Email

## **31.14 Configuration and Operations Control**

* Company Settings และ VAT Default
* Production Role/Permission
* Atomic Document Number และ Unique Record Reference
* Storage Visibility
* Backup/Restore Procedure ขั้นต่ำ
* Audit, Security และ Notification Delivery Log

---

# **32\. สิ่งที่ไม่รวมใน MVP**

* ระบบบัญชีเต็มรูปแบบ  
* ระบบภาษีเต็มรูปแบบ  
* การชำระผ่านบัตร  
* สต๊อกสินค้าในประเทศไทย  
* การจัดซื้ออัตโนมัติโดยโรงงาน  
* ERP โรงงาน  
* Live Chat  
* Tracking เรือแบบ Real-time  
* ระบบจัดตู้ด้วย AI  
* การคำนวณภาษีศุลกากรอัตโนมัติ  
* การอนุมัติ Shop Drawing หลาย Revision  
* การแบ่งค่าคอมมิชชันตัวแทนหลายชั้น  
* การให้โรงงานแก้ไขสินค้าเอง

---

# **33\. ความเสี่ยงและแนวทางป้องกัน**

## **33.1 ราคาเปลี่ยน**

แนวทาง

* ราคาใน Project อัปเดตตามราคาปัจจุบัน  
* Order Snapshot ราคา  
* มี Effective Date

## **33.2 โรงงานผลิตล่าช้า**

แนวทาง

* ETA แยก Supplier Order  
* Delay Flag  
* Admin Note  
* แจ้งสมาชิก

## **33.3 สเปกผิด**

แนวทาง

* ใช้ Option Code  
* Snapshot สเปก  
* มี Remark  
* Custom ต้องอนุมัติ

## **33.4 สมาชิกไม่ชำระยอดคงเหลือ**

แนวทาง

* แจ้งเตือน  
* ระงับการส่ง  
* แสดง Due Date  
* Finance Follow-up

## **33.5 ค่าขนส่งสูงกว่าคาด**

แนวทาง

* แจ้งชัดว่าราคาสินค้าไม่รวมขนส่ง  
* แยก Freight Invoice  
* เก็บต้นทุนจริง

## **33.6 สินค้าเสียหาย**

แนวทาง

* QC ก่อนส่ง  
* รูป Packing  
* Proof of Delivery  
* Claim Workflow

## **33.7 ข้อมูลต้นทุนรั่วไหล**

แนวทาง

* Role Permission  
* Field-level Access  
* Audit Log  
* เอกสารภายในแยกจากสมาชิก

## **33.8 ออเดอร์หลายโรงงานสับสน**

แนวทาง

* Customer Order เป็นภาพรวม  
* Supplier Order แยกโรงงาน  
* Shipment แยกเที่ยว  
* สถานะสองระดับ

---

# **34\. KPI สำหรับวัดผล MVP**

## **34.1 Adoption**

* จำนวนสมาชิกสมัคร  
* อัตราอนุมัติ  
* Active Members ต่อเดือน  
* จำนวนสมาชิกที่สร้าง Project  
* จำนวนสมาชิกที่สร้าง Order

## **34.2 Sales**

* ยอดขายรวม  
* Average Order Value  
* Order per Member  
* ยอดขายต่อโรงงาน  
* ยอดขายต่อหมวด  
* Conversion Project Item to Order

## **34.3 Operation**

* เวลาเฉลี่ยจากรับมัดจำถึงเปิด PO  
* เวลาเฉลี่ยผลิต  
* On-time Production Rate  
* QC Pass Rate  
* Rework Rate  
* On-time Delivery Rate

## **34.4 Finance**

* Deposit Collection Rate  
* Balance Collection Rate  
* Freight Collection Rate  
* Gross Product Margin  
* Payment Verification Time


## **34.5 Quality**

* Claim Rate  
* Damage Rate  
* Wrong Specification Rate  
* Claim Resolution Time  
* Member Satisfaction

---

# **34.6 Shared Catalog สำหรับลูกค้าของ Member**

* Member สร้าง Catalog ได้หลายชุดและส่งลิงก์ให้ลูกค้าเปิดดูโดยไม่ต้องสมัครสมาชิก
* เลือกได้เฉพาะสินค้า Published ที่มี Active Member Price แต่ราคาเริ่มต้นใน Shared Catalog ต้องซ่อน
* หากแสดงราคา Member ต้องกำหนดราคาขายลูกค้าเป็น THB ก่อน VAT ของแต่ละรายการ
* การ Publish ต้อง Snapshot ชื่อ รูป สเปก ราคา Branding และ Contact ลูกค้าไม่เห็น Draft ที่กำลังแก้
* ลิงก์ต้องหมดอายุ ปิด และเปลี่ยน Token ได้ พร้อม `noindex` และห้าม Public Payload เปิดเผยข้อมูลภายใน
* รุ่นแรกใช้เพื่อดูสินค้าและติดต่อ Member ไม่มี Checkout หรือแบบฟอร์มเก็บข้อมูลลูกค้า

# **34.7 Visual Product Sourcing**

* สินค้าสำเร็จรูปที่หาไม่พบใช้ Product Sourcing Request จากภาพ ส่วนงานผลิตหรือปรับแบบใช้ Custom RFQ
* Member แนบ JPEG, PNG หรือ WebP ได้ 1–8 ภาพ ภาพละไม่เกิน 10 MB พร้อมรายละเอียดประกอบ
* ทีม GISP ตรวจและจัดหาด้วยคน ขอข้อมูลเพิ่ม เสนอ Candidate และให้ Member เลือกได้
* Candidate ที่เลือกต้องผ่าน Product Lifecycle เดิมก่อนเข้า Catalog กลาง ห้ามสร้าง Product Published จากภาพโดยตรง
* Member API ต้องปกปิด Supplier, Factory Cost, Margin, Internal Note และข้อมูลการเจรจา
* รุ่นแรกไม่มี AI วิเคราะห์ภาพ

---

# **35\. Acceptance Criteria ระดับธุรกิจ**

MVP ถือว่าใช้งานได้เมื่อ

1. สมาชิกสมัครและได้รับอนุมัติได้  
2. สมาชิก Login และเห็นราคาสมาชิกได้  
3. Admin เพิ่มโรงงานและสินค้าได้  
4. สมาชิกสร้าง Project ได้  
5. สมาชิกเพิ่มสินค้าและเลือก Option ได้  
6. สมาชิกดาวน์โหลด Product Schedule ได้  
7. สมาชิกเลือกบางรายการสร้าง Order ได้  
8. Order หนึ่งมีหลายโรงงานได้  
9. ระบบสร้าง Supplier Orders แยกโรงงานได้  
10. สมาชิกอัปโหลดสลิปได้  
11. Finance ตรวจและยืนยันเงินได้  
12. Purchasing เปิด PO ได้หลังผ่าน Deposit Gate  
13. ทีมงานอัปเดตสถานะผลิตได้  
14. ทีม QC อัปโหลดรายงานได้  
15. สมาชิกอนุมัติ Custom Product ได้  
16. ระบบติดตาม Shipment ได้  
17. ทีมงานนัดส่งและบันทึก Proof of Delivery ได้  
18. ระบบออกใบแจ้งค่าขนส่งได้  
19. สมาชิกแจ้ง Claim ได้  
20. Admin ดูยอดขายแยกโรงงานได้  
21. ราคาทุนไม่แสดงแก่สมาชิก  
22. Order เดิมไม่เปลี่ยนราคาเมื่อราคาสินค้าเปลี่ยน

---

# **36\. หลักการออกแบบระบบ**

1. Project First  
2. Member sees Member Price, Suggested Resale และ Freight Estimate แต่ไม่เห็น Cost/Formula  
3. One Order supports Multiple Suppliers  
4. Supplier Orders are internal operational units  
5. Price and Specification Snapshot at Order  
6. Standard Product must be easy to order  
7. Custom Product must be controlled  
8. Human Review before financial and factory actions  
9. Every important action must be traceable  
10. Build simple workflows first, automate later  
11. Support expansion without overbuilding MVP  
12. Keep Supplier outside the MVP application
13. Hide Factory Identity until the Member completes an approved visit  
14. Snapshot Partner Warranty and assign Claim responsibility by cause  
15. One Member Profile per Login; no Member Team/Sub-user in Core MVP

---

# **37\. ข้อสรุป**

GISP MVP ไม่ใช่ Marketplace สาธารณะ และไม่ใช่ระบบโรงงาน

GISP คือ

> “แพลตฟอร์มตัวแทนจำหน่ายและบริหารการสั่งซื้อสินค้าตกแต่งภายในจากโรงงานต่างประเทศแบบครบเส้นทาง โดยบริษัทเป็นผู้คัดเลือกสินค้า ขายสินค้า รับชำระเงิน บริหารโรงงาน ควบคุมการผลิต นำเข้า และส่งมอบให้แก่ตัวแทนในประเทศไทย”

แกนกลางของระบบคือ

Member  
→ Project  
→ Product  
→ Order  
→ Supplier Order  
→ Payment  
→ Production  
→ QC  
→ Shipment  
→ Delivery  
→ Claim

MVP ต้องครบทุกขั้นตอนข้างต้น แต่แต่ละโมดูลควรเริ่มด้วย Workflow ที่ง่าย ใช้ทีมงานเป็นผู้ควบคุม และหลีกเลี่ยงระบบอัตโนมัติที่ยังไม่จำเป็น

เมื่อ MVP ใช้งานจริงและมีข้อมูลเพียงพอ จึงค่อยเพิ่ม AI, Automation, Supplier Portal, Payment Gateway, Smart BOQ Integration และ Marketplace ในระยะต่อไป
