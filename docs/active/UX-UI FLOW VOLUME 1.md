# **GLOBAL INTERIOR SUPPLY PLATFORM**

## **GISP – UX/UI FLOW SPECIFICATION**

## **VOLUME 1: FOUNDATION, MEMBER, CATALOG AND PROJECT**

**Document Version:** 2.1  
**Reconciled Date:** 1 สิงหาคม 2569 (2026-08-01)  
**Authority:** UX/UI Reference ภายใต้ `MVP BUSINESS MASTER PLAN.md` และ `DECISION LOG.md`  
**Change Summary:** เพิ่ม Member-safe Pricing, Material Sample/Visit Disclosure, บัญชีสมาชิกเดี่ยว และ Demo 1.4 ตาม DEC-037 ถึง DEC-042  
**Document Type:** UX/UI Flow and Screen Specification  
**Project Stage:** MVP  
**Primary Platform:** Responsive Web Application  
**Primary Language:** ภาษาไทย  
**Initial Market:** ประเทศไทย  
**Related Documents:**

1. GISP – MVP Business Master Plan  
2. GISP – Database Schema Specification  
3. GISP – Codex Development Specification

---

# **0\. RECONCILED UX CONTRACT**

* Standard Product ที่มี Active Member Price ใช้ Product Schedule แล้วสร้าง Order ได้โดยไม่ผ่าน RFQ
* RFQ และ Custom Quotation ใช้เฉพาะ Custom Product
* GISP เป็นผู้ออก Custom Quotation แบบ Version; Member Accept/Reject ได้
* Accepted Quotation ล็อก Price/Spec/VAT/Lead Time และสร้าง `READY_TO_ORDER` Project Item
* ความสามารถนอก Core แยกไว้ใน `docs/post-mvp/POST-MVP BACKLOG.md`
* Pending/Suspended Member ต้องไม่เห็นราคาและสร้างธุรกรรมไม่ได้
* หน้าจอต้อง Responsive และไม่เปิดเผย Factory Cost/Formula/Margin/Internal Note/Confidential File
* Credential ใช้ Email + Password; Username ไม่เป็นข้อมูลบังคับ
* หนึ่ง Member Profile ต่อหนึ่ง Login ไม่มี Member Team/Sub-user/Team Invitation; Action จาก Credential เดียว Audit เป็นบัญชีเดียว
* Active Member เห็น Member Price, Suggested Resale และ Freight Estimate แต่ Suggested Resale ไม่ใช้คิดยอด Order
* ก่อน Visit Completed ห้ามแสดงชื่อ/ที่อยู่/Contact/Supplier ID; การเปิดเผยผูก Member Profile + Supplier
* Custom Request และ Custom Quotation ใช้ State แยกกันตาม `MVP IMPLEMENTATION PLAN.md`
* `GISP Admin` เป็น Demo Mapping เท่านั้น; หน้าจอจริงตรวจ Production Role ตาม DEC-035

---

# **1\. วัตถุประสงค์ของเอกสาร**

เอกสารฉบับนี้กำหนดโครงสร้าง UX/UI และเส้นทางการใช้งานของ GISP Volume 1 ซึ่งครอบคลุมตั้งแต่ผู้ใช้งานเข้าสู่ระบบ สมัครสมาชิก ได้รับอนุมัติ ดู Dashboard ค้นหาสินค้า ดูรายละเอียดสินค้า สร้างโครงการ และจัดเตรียมรายการสินค้าภายในโครงการ

ขอบเขตของ Volume 1 ประกอบด้วย

1. UX/UI Foundation  
2. Public และ Authentication  
3. Member Registration และ Approval State  
4. Member Application Shell  
5. Member Dashboard  
6. Product Catalog  
7. Product Detail และ Product Options  
8. End Customer Management  
9. Project Management  
10. Project Area และ Project Item  
11. Product Schedule  
12. Custom Request จุดเริ่มต้น  
13. Notification และ Profile ขั้นพื้นฐาน

Volume 1 สิ้นสุดเมื่อสมาชิกสามารถสร้าง Project เพิ่มสินค้า เลือกสเปก แบ่งตามห้อง และเตรียมรายการที่พร้อมสร้าง Order ได้

ระบบ Order, Payment, Production, QC, Logistics และ Delivery จะอยู่ใน Volume 2

---

# **2\. เป้าหมาย UX ของ Volume 1**

ระบบต้องช่วยให้สมาชิกใหม่สามารถทำงานสำคัญได้โดยไม่ต้องผ่านการอบรมระบบที่ซับซ้อน

เป้าหมายหลักคือ

* สมัครสมาชิกได้ง่าย  
* เข้าใจว่าสถานะบัญชีอยู่ขั้นตอนไหน  
* ค้นหาสินค้าได้รวดเร็ว  
* เห็นราคาสมาชิกอย่างชัดเจนหลังได้รับอนุมัติ  
* เข้าใจตัวเลือกสินค้าโดยไม่ต้องพิมพ์สเปกเอง  
* สร้าง Project ได้ก่อนเลือกสินค้า หรือสร้างระหว่างเลือกสินค้าได้  
* จัดสินค้าแยกตามห้องหรือพื้นที่ได้  
* ทราบว่าสินค้ารายการใดพร้อมสั่ง  
* ป้องกันการเลือกสเปกไม่ครบ  
* ดาวน์โหลด Product Schedule ได้  
* เริ่ม Custom Request ได้เมื่อสินค้ามาตรฐานไม่ตรงความต้องการ

---

# **3\. กลุ่มผู้ใช้งานใน Volume 1**

## **3.1 Visitor**

ผู้ที่ยังไม่ได้สมัครสมาชิก

สามารถ

* ดูหน้าแนะนำแพลตฟอร์ม  
* ดูคำอธิบายประเภทสินค้า  
* สมัครสมาชิก  
* Login  
* ขอ Reset Password

ไม่สามารถ

* ดูราคาสมาชิก  
* สร้าง Project  
* ดูรายละเอียดสินค้าที่จำกัดสิทธิ์  
* สร้างรายการสินค้า

## **3.2 Pending Member**

ผู้สมัครที่ยังรอ Admin อนุมัติ

สามารถ

* Login  
* ดูสถานะคำขอ  
* แก้ไขข้อมูลส่วนตัวบางส่วน  
* อัปโหลดข้อมูลเพิ่มเติม  
* ติดต่อทีมงาน  
* Logout

ไม่สามารถ

* ดู Member Price  
* สร้าง Project  
* เพิ่มสินค้า  
* ดาวน์โหลด Product Schedule  
* เปิด Order

## **3.3 Active Member**

สมาชิกที่ได้รับอนุมัติ

สามารถ

* ดู Member Dashboard  
* ดู Product Catalog  
* ดู Member Price  
* ดู Suggested Resale Price และ Freight Estimate  
* สร้าง End Customer  
* สร้าง Project  
* เพิ่ม Project Area  
* เพิ่มสินค้าใน Project  
* เลือก Product Options  
* ดาวน์โหลด Product Schedule  
* สร้าง Custom Request  
* จัดรายการเป็น Ready to Order
* ขอเยี่ยมชม Showroom/โรงงาน Partner และดูสถานะคำขอ

Core MVP ไม่มีหน้าจอเชิญทีม ผู้ช่วย หรือ Sub-user หากมีบุคคลอื่นใช้ Credential เดียวกัน
ระบบจะแสดงและ Audit เป็น Active Member Account เดียว

## **3.4 Suspended Member**

สมาชิกที่ถูกระงับ

สามารถ

* Login ตามนโยบาย  
* ดูข้อมูลและประวัติเดิม  
* ดู Project และ Order เดิม  
* ติดต่อทีมงาน

ไม่สามารถ

* สร้าง Project ใหม่  
* เพิ่มสินค้าใหม่  
* เปลี่ยนรายการเป็น Ready to Order  
* สร้าง Order ใหม่

## **3.5 Admin Roles ที่เกี่ยวข้อง**

* Super Admin  
* Member Admin  
* Product Admin

หน้าจอ Admin เชิงลึกจะอยู่ใน Volume 3 แต่ Volume 1 ต้องกำหนดผลกระทบจากการอนุมัติสมาชิกและการ Publish สินค้าให้ชัดเจน

---

# **4\. Information Architecture**

## **4.1 Public Navigation**

หน้าแรก  
├── เกี่ยวกับ GISP  
├── ประเภทสินค้า  
├── วิธีการสั่งซื้อ  
├── สิทธิ์สมาชิก  
├── คำถามที่พบบ่อย  
├── สมัครสมาชิก  
└── เข้าสู่ระบบ

Public Website สามารถลดขอบเขตใน MVP เหลือ Landing Page เดียวได้ แต่ Navigation และ URL ควรรองรับการเพิ่มหน้าในอนาคต

## **4.2 Member Navigation**

Dashboard  
├── งานที่ต้องดำเนินการ  
├── โครงการล่าสุด  
├── รายการรออนุมัติจากลูกค้า  
└── รายการพร้อมสั่ง

Catalog  
├── สินค้าทั้งหมด  
├── หมวดสินค้า  
├── Collection  
├── โรงงาน  
├── สินค้าที่ดูล่าสุด  

Projects  
├── โครงการทั้งหมด  
├── สร้างโครงการ  
├── ลูกค้า  
├── ห้องและพื้นที่  
├── รายการสินค้า  
└── Product Schedule

Custom Requests  
├── คำขอทั้งหมด  
├── ร่าง  
├── รอทีมงานตรวจสอบ  
└── ได้รับราคาแล้ว

Notifications

Profile  
├── ข้อมูลส่วนตัว  
├── ข้อมูลบริษัท  
├── ที่อยู่  
├── ความปลอดภัย  
└── ออกจากระบบ

## **4.3 Member URL Structure**

/member/dashboard

/member/catalog  
/member/catalog/\[productId\]

/member/projects  
/member/projects/new  
/member/projects/\[projectId\]  
/member/projects/\[projectId\]/items  
/member/projects/\[projectId\]/schedule

/member/custom-requests  
/member/custom-requests/new  
/member/custom-requests/\[requestId\]

/member/customers  
/member/customers/new  
/member/customers/\[customerId\]

/member/notifications  
/member/profile  
/member/profile/security

---

# **5\. Application Shell**

## **5.1 Desktop Layout**

┌──────────────────────────────────────────────────────────┐  
│ Logo | Global Search            Notification | Profile   │  
├──────────────┬───────────────────────────────────────────┤  
│ Dashboard    │                                           │  
│ Catalog      │               Main Content                │  
│ Projects     │                                           │  
│ Custom       │                                           │  
│ Notifications│                                           │  
│              │                                           │  
│ Help         │                                           │  
└──────────────┴───────────────────────────────────────────┘

## **5.2 Tablet Layout**

* Sidebar ย่อเหลือ Icon  
* กดขยายเมนูได้  
* Search อยู่ใน Header  
* Main Content ใช้ความกว้างเต็มส่วนที่เหลือ  
* Table ต้องรองรับ Horizontal Scroll หรือเปลี่ยนเป็น Card View

## **5.3 Mobile Layout**

┌─────────────────────┐  
│ Logo       🔔   ☰   │  
├─────────────────────┤  
│                     │  
│    Main Content     │  
│                     │  
├─────────────────────┤  
│ Home Catalog Project│  
└─────────────────────┘

Mobile Bottom Navigation แนะนำ

* หน้าหลัก  
* สินค้า  
* โครงการ  
* แจ้งเตือน  
* เพิ่มเติม

## **5.4 Global Header**

ประกอบด้วย

* GISP Logo  
* Global Search  
* Notification  
* Help  
* User Avatar  
* Company หรือ Member Name  
* Dropdown Profile

## **5.5 Global Search**

MVP ค้นหา

* Product Code  
* Product Name  
* Factory SKU เฉพาะเมื่อผู้ใช้มีสิทธิ์หรือ Active Disclosure Grant  
* Project Code  
* Project Name  
* Customer Name

ผลลัพธ์แบ่งหมวด

สินค้า  
โครงการ  
ลูกค้า

หากการพัฒนา Global Search ทำให้ MVP ล่าช้า สามารถจำกัดให้ค้นหาเฉพาะ Product ก่อน แต่ควรวางตำแหน่ง UI รองรับไว้

---

# **6\. UX Foundation และ Design System**

## **6.1 Design Principles**

### **Clear**

ผู้ใช้ต้องเข้าใจได้ทันทีว่ากำลังอยู่หน้าใด และต้องทำอะไรต่อ

### **Trustworthy**

ข้อมูลราคา สถานะ และสเปกต้องแสดงอย่างเป็นระบบ ไม่ดูเหมือน Social Commerce ที่ไม่เป็นทางการ

### **Project-Oriented**

สินค้าไม่ได้ถูกเพิ่มลง Cart ทั่วไป แต่เพิ่มเข้า Project

### **Visual Product First**

ภาพสินค้า ขนาด วัสดุ และ Option ต้องเป็นองค์ประกอบหลัก

### **Action-Oriented**

ทุกหน้าควรบอกว่ามีงานอะไรที่ผู้ใช้ต้องทำต่อ

### **Progressive Disclosure**

ข้อมูลภายในหรือรายละเอียดเทคนิคที่ไม่จำเป็นไม่ควรแสดงพร้อมกันทั้งหมด

---

## **6.2 Typography**

แนะนำให้ใช้ Font ที่รองรับภาษาไทยและอังกฤษได้ดี

ระดับข้อความ

* Display  
* Page Title  
* Section Title  
* Card Title  
* Body  
* Label  
* Helper Text  
* Caption  
* Status Text

ควรหลีกเลี่ยงตัวอักษรเล็กเกินไป โดยเฉพาะราคา ขนาด และ Option Code

---

## **6.3 Spacing**

ใช้ระบบ 4 หรือ 8 Point Grid

ตัวอย่าง

* 4 px  
* 8 px  
* 12 px  
* 16 px  
* 24 px  
* 32 px  
* 48 px

Card และ Form ต้องมีพื้นที่หายใจเพียงพอ ไม่ควรอัดข้อมูลแน่นเหมือนระบบ ERP รุ่นเก่า

---

## **6.4 Component States**

ทุก Component ที่ Interactive ต้องมี

* Default  
* Hover  
* Focus  
* Active  
* Disabled  
* Loading  
* Error  
* Success

---

## **6.5 Button Hierarchy**

### **Primary**

ใช้กับ Action หลักของหน้า เช่น

* สมัครสมาชิก  
* สร้างโครงการ  
* เพิ่มสินค้าในโครงการ  
* บันทึก  
* ส่งคำขอ

### **Secondary**

* ดาวน์โหลด  
* ดูรายละเอียด  
* เพิ่มห้อง  
* บันทึกเป็นร่าง

### **Tertiary หรือ Ghost**

* ยกเลิก  
* กลับ  
* ดูเพิ่มเติม

### **Destructive**

* ลบรายการ  
* ยกเลิก Project  
* ออกจากระบบ

---

## **6.6 Status Badge**

สถานะต้องใช้ทั้ง

* ข้อความ  
* สี  
* Icon เมื่อเหมาะสม

ห้ามใช้สีอย่างเดียว

ตัวอย่าง Project Item

* ร่าง  
* รอลูกค้าอนุมัติ  
* พร้อมสั่ง  
* สั่งบางส่วน  
* สั่งแล้ว  
* ยกเลิก

---

## **6.7 Form Standard**

ทุก Form ต้องมี

* Label  
* Required Mark  
* Placeholder ที่มีความหมาย  
* Helper Text เมื่อจำเป็น  
* Validation Message ใต้ Field  
* Save State  
* Unsaved Changes Warning

---

## **6.8 Modal, Drawer และ Page**

ใช้ Modal สำหรับ

* ยืนยัน Action  
* เลือก Project แบบรวดเร็ว  
* เลือกห้อง  
* ลบรายการ

ใช้ Drawer สำหรับ

* Filter Catalog บน Mobile  
* Quick Product Preview  
* Edit Item แบบไม่ออกจากหน้า

ใช้ Full Page สำหรับ

* Register  
* Create Project  
* Product Detail  
* Custom Request  
* Profile

---

# **7\. Global UX States**

ทุกหน้าหลักต้องออกแบบ State ต่อไปนี้

## **7.1 Loading State**

* Skeleton Card  
* Skeleton Table  
* Disable Action ระหว่าง Submit  
* แสดง Upload Progress

## **7.2 Empty State**

ต้องอธิบาย

* ยังไม่มีข้อมูลอะไร  
* เพราะเหตุใด  
* ผู้ใช้ควรทำอะไรต่อ

ตัวอย่าง

> ยังไม่มีโครงการ เริ่มสร้างโครงการแรกเพื่อรวบรวมสินค้าสำหรับลูกค้าของคุณ

ปุ่ม

`สร้างโครงการ`

## **7.3 Error State**

ประเภท

* Page Load Error  
* API Error  
* Permission Error  
* File Upload Error  
* Validation Error  
* Network Error

ต้องมี Action เช่น

* ลองอีกครั้ง  
* กลับหน้าหลัก  
* ติดต่อทีมงาน

## **7.4 Success Feedback**

ใช้ Toast หรือ Inline Success

ตัวอย่าง

* บันทึกข้อมูลแล้ว  
* เพิ่มสินค้าใน Project แล้ว  
* ส่งคำขอ Custom แล้ว  
* ดาวน์โหลด Product Schedule สำเร็จ

## **7.5 Offline หรือ Connection Lost**

แสดง Banner

> การเชื่อมต่อขัดข้อง ข้อมูลที่ยังไม่ได้บันทึกอาจสูญหาย

---

# **8\. Screen Inventory Volume 1**

## **Public และ Authentication**

1. Landing Page  
2. Login  
3. Register – Account  
4. Register – Business Information  
5. Register – Verification and Review  
6. Registration Success  
7. Pending Approval  
8. Rejected Application  
9. Suspended Account  
10. Forgot Password  
11. Reset Password

## **Member Foundation**

12. Member Dashboard  
13. Notifications  
14. Profile Overview  
15. Edit Personal Information  
16. Edit Company Information  
17. Security Settings

## **Catalog**

18. Catalog Listing  
19. Catalog Search Results  
20. Product Quick View  
21. Product Detail  
22. Product Option Selection  
23. Select Project Modal  
24. Create Project Quick Modal  
25. Product Unavailable State

## **Customer and Project**

26. Customer Listing  
27. Create Customer  
28. Customer Detail  
29. Project Listing  
30. Create Project  
31. Project Overview  
32. Project Area Management  
33. Project Item Listing  
34. Edit Project Item  
35. Project Item Status Update  
36. Product Schedule Preview  
37. Product Schedule Export  
38. Custom Request Start  
39. Custom Request Form  
40. Custom Request Detail

## **Material Visit และ Factory Disclosure**

41. Showroom Visit Request  
42. Showroom Visit Detail  
43. Factory Disclosure State

รวมประมาณ 43 หน้าหรือ Screen State หลัก

---

# **9\. Public Landing Page**

## **Screen ID**

`PUB-001`

## **Route**

`/`

## **Purpose**

อธิบาย GISP และนำผู้สนใจเข้าสู่การสมัครสมาชิกหรือ Login

## **Target User**

Visitor

## **Page Structure**

Header  
Hero  
Platform Benefits  
Who It Is For  
Product Categories  
How It Works  
Membership Benefits  
FAQ  
Call to Action  
Footer

## **Hero Content**

หัวข้อควรสื่อว่าเป็นแพลตฟอร์มจัดหาสินค้าตกแต่งภายในสำหรับมืออาชีพ

Primary CTA

`สมัครสมาชิก`

Secondary CTA

`เข้าสู่ระบบ`

## **How It Works**

สมัครสมาชิก  
→ ได้รับอนุมัติ  
→ สร้างโครงการ  
→ เลือกสินค้า  
→ จัดรายการ  
→ เปิดออเดอร์  
→ ติดตามจนส่งมอบ

ใน Volume 1 สามารถแสดง Flow ทั้งหมดเพื่อให้เข้าใจธุรกิจ แม้บางโมดูลจะถูกพัฒนาใน Volume 2

## **Visibility Rule**

* Visitor เห็น Public Content  
* Active Member ที่เปิด `/` อาจ Redirect ไป Dashboard หรือยังดูหน้า Public ได้ตามนโยบาย  
* Admin ไม่จำเป็นต้องใช้หน้านี้เป็นหน้าแรก

---

# **10\. Login**

## **Screen ID**

`AUTH-001`

## **Route**

`/login`

## **Purpose**

ให้ผู้ใช้เข้าสู่ระบบด้วย Email และ Password

## **Components**

* GISP Logo  
* Email  
* Password  
* Show/Hide Password  
* Remember Me  
* Forgot Password  
* Login Button  
* Register Link  
* Help Link

## **Wireframe**

┌────────────────────────────┐  
│          GISP Logo         │  
│                            │  
│ เข้าสู่ระบบ                │  
│                            │  
│ Email                      │  
│ \[\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\] │  
│                            │  
│ Password                   │  
│ \[\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ 👁 \] │  
│                            │  
│ ☐ จดจำการเข้าสู่ระบบ       │  
│ ลืมรหัสผ่าน?               │  
│                            │  
│ \[       เข้าสู่ระบบ       \] │  
│                            │  
│ ยังไม่มีบัญชี? สมัครสมาชิก  │  
└────────────────────────────┘

## **Validation**

* Email จำเป็นและต้องอยู่ในรูปแบบที่ถูกต้อง  
* Password จำเป็น  
* ไม่บอกว่า Email หรือ Password ส่วนใดผิด เพื่อความปลอดภัย  
* ป้องกัน Submit ซ้ำ

## **Login Results**

### **Active Member**

ไป `/member/dashboard`

### **Pending Member**

ไป `/pending-approval`

### **Rejected Member**

ไป `/application-rejected`

### **Suspended Member**

ไป `/account-suspended`

### **Staff/Admin**

ไป Admin Dashboard ตาม Role

## **Error Messages**

* ข้อมูลเข้าสู่ระบบไม่ถูกต้อง  
* บัญชีนี้ยังไม่ได้ยืนยันอีเมล  
* บัญชีถูกระงับ  
* ระบบไม่สามารถเข้าสู่ระบบได้ กรุณาลองอีกครั้ง

---

# **11\. Registration Flow**

Registration ใช้ Multi-step Form เพื่อลดความยาวของหน้า

Step 1 บัญชีผู้ใช้งาน  
→ Step 2 ข้อมูลธุรกิจ  
→ Step 3 ตรวจสอบและยืนยัน  
→ ส่งคำขอ

ต้องมี Progress Indicator

1 บัญชี ─── 2 ธุรกิจ ─── 3 ยืนยัน

---

# **12\. Register Step 1: Account**

## **Screen ID**

`AUTH-002`

## **Route**

`/register`

## **Fields**

* ชื่อ  
* นามสกุล  
* เบอร์โทรศัพท์  
* Email  
* ชื่อที่ใช้แสดง ถ้ามี  
* Password  
* Confirm Password  
* ยอมรับเงื่อนไขการใช้งาน  
* ยอมรับนโยบายความเป็นส่วนตัว

## **Password Requirements**

* ความยาวขั้นต่ำตามมาตรฐานระบบ  
* มีตัวอักษรและตัวเลข  
* แสดง Requirement Checklist  
* Password และ Confirm Password ต้องตรงกัน

## **Actions**

* ดำเนินการต่อ  
* มีบัญชีแล้ว เข้าสู่ระบบ

## **Validation**

ตรวจแบบ Inline ก่อนเปลี่ยน Step

* Email ซ้ำ  
* เบอร์โทรไม่ครบ  
* Password ไม่ผ่านเงื่อนไข  
* ไม่ยอมรับ Terms

---

# **13\. Register Step 2: Business Information**

## **Screen ID**

`AUTH-003`

## **Fields**

* ประเภทผู้สมัคร  
* ชื่อบริษัท  
* ประเภทธุรกิจ  
* เลขประจำตัวผู้เสียภาษี  
* ที่อยู่บริษัท  
* จังหวัด  
* พื้นที่ให้บริการ  
* หลักสูตรที่เคยเรียน  
* ประเภทสินค้าที่สนใจ  
* ช่องทางที่รู้จัก GISP  
* เอกสารประกอบ ถ้าต้องการ

## **Applicant Type**

Dropdown หรือ Card Selection

* ผู้เรียนหลักสูตร  
* นักออกแบบ  
* ผู้รับเหมา  
* เจ้าของโชว์รูม  
* ตัวแทนจำหน่าย  
* เจ้าของโครงการ  
* อื่น ๆ

## **Conditional Fields**

หากเลือก “ผู้เรียนหลักสูตร”

แสดง

* ชื่อหลักสูตร  
* รุ่น  
* ปีที่เรียน

หากเลือก “บริษัท”

แสดงข้อมูลบริษัทเพิ่มเติม

## **Actions**

* ย้อนกลับ  
* ดำเนินการต่อ  
* บันทึกร่าง หากรองรับ

MVP สามารถไม่รองรับ Draft Registration แต่ต้องไม่ล้างข้อมูลเมื่อกดย้อนกลับ

---

# **14\. Register Step 3: Review**

## **Screen ID**

`AUTH-004`

## **Purpose**

ให้ผู้สมัครตรวจสอบข้อมูลก่อนส่ง

## **Sections**

* ข้อมูลบัญชี  
* ข้อมูลส่วนตัว  
* ข้อมูลบริษัท  
* ประเภทสมาชิก  
* หลักสูตร  
* เอกสาร

แต่ละ Section มีปุ่ม `แก้ไข`

## **Confirmation**

Checkbox

> ข้าพเจ้าขอยืนยันว่าข้อมูลที่ให้ไว้เป็นจริง และยอมรับเงื่อนไขการใช้งานแพลตฟอร์ม

## **Primary Action**

`ส่งคำขอสมัครสมาชิก`

## **System Actions หลัง Submit**

1. Create Auth User  
2. Create User Record  
3. Create Member Profile  
4. Set Status `pending`  
5. Send Confirmation  
6. Create Admin Notification  
7. Redirect ไป Registration Success

---

# **15\. Registration Success**

## **Screen ID**

`AUTH-005`

## **Message**

> ส่งคำขอสมัครสมาชิกเรียบร้อยแล้ว ทีมงานจะตรวจสอบข้อมูลของคุณก่อนเปิดสิทธิ์การใช้งานเต็มรูปแบบ

แสดง

* Email ที่สมัคร  
* สถานะ `รอตรวจสอบ`  
* คำอธิบายว่าระหว่างนี้ทำอะไรได้  
* วิธีติดต่อทีมงาน

Actions

* ไปหน้าเข้าสู่ระบบ  
* กลับหน้าแรก

ไม่ควรระบุเวลารับรองการอนุมัติหากบริษัทไม่มี SLA ที่แน่นอน

---

# **16\. Pending Approval**

## **Screen ID**

`AUTH-006`

## **Route**

`/pending-approval`

## **Purpose**

ป้องกันผู้ใช้ Pending เข้าถึงระบบเต็มรูปแบบ และลดความสับสน

## **Components**

* Status Illustration  
* ชื่อสมาชิก  
* Application Reference  
* วันที่สมัคร  
* สถานะ  
* Checklist ข้อมูลที่ส่งแล้ว  
* ข้อมูลที่ต้องเพิ่ม  
* ปุ่มแก้ไขข้อมูล  
* ติดต่อทีมงาน  
* Logout

## **Wireframe**

┌──────────────────────────────────┐  
│ บัญชีของคุณอยู่ระหว่างตรวจสอบ    │  
│                                  │  
│ หมายเลขคำขอ: MEM-APP-000123      │  
│ วันที่สมัคร: ...                  │  
│                                  │  
│ ✓ ข้อมูลบัญชี                    │  
│ ✓ ข้อมูลธุรกิจ                   │  
│ \! เอกสารเพิ่มเติม ถ้ามี          │  
│                                  │  
│ \[แก้ไขข้อมูล\] \[ติดต่อทีมงาน\]      │  
└──────────────────────────────────┘

## **Permission**

ห้ามเข้าถึง Member Routes อื่น

หากพิมพ์ URL ตรง ต้อง Redirect กลับหน้านี้

---

# **17\. Rejected Application**

## **Screen ID**

`AUTH-007`

แสดง

* สถานะไม่ผ่านการอนุมัติ  
* เหตุผลที่เปิดเผยได้  
* ปุ่มแก้ไขและส่งใหม่ หาก Admin อนุญาต  
* ช่องทางติดต่อ

ไม่ควรแสดง Internal Admin Note

---

# **18\. Suspended Account**

## **Screen ID**

`AUTH-008`

แสดง

* บัญชีถูกระงับชั่วคราว  
* เหตุผลแบบสมาชิกมองเห็นได้  
* สิทธิ์ที่ถูกจำกัด  
* ช่องทางติดต่อ  
* ปุ่มดูข้อมูลเดิม หากนโยบายอนุญาต  
* Logout

---

# **19\. Forgot และ Reset Password**

## **Screen ID**

`AUTH-009`, `AUTH-010`

Flow

กรอก Email  
→ ส่ง Link  
→ เปิด Reset Page  
→ ตั้ง Password ใหม่  
→ Login

Security Rule

* ไม่เปิดเผยว่า Email มีในระบบหรือไม่  
* Link มีอายุ  
* ใช้ได้ครั้งเดียว  
* Password ใหม่ต้องผ่าน Policy

---

# **20\. Member Dashboard**

## **Screen ID**

`MEM-001`

## **Route**

`/member/dashboard`

## **Purpose**

เป็นหน้าสรุปงานและทางลัดเข้าสู่กิจกรรมหลัก

## **Dashboard Layout**

Page Header  
Greeting and Member Status  
Action Required  
KPI Summary  
Recent Projects  
Ready to Order Items  
Recently Viewed Products  
Help and Learning

## **Header**

* สวัสดี คุณ...  
* ชื่อบริษัท  
* Member Type  
* ปุ่ม `สร้างโครงการ`  
* ปุ่ม `ค้นหาสินค้า`

## **KPI Cards Volume 1**

* โครงการที่กำลังดำเนินการ  
* รายการรอลูกค้าอนุมัติ  
* รายการพร้อมสั่ง  
* Custom Request ที่กำลังดำเนินการ

Volume 2 จะเพิ่ม

* รอชำระเงิน  
* กำลังผลิต  
* ระหว่างขนส่ง

## **Action Required**

รายการที่สมาชิกต้องทำ เช่น

* Project ยังไม่มีที่อยู่ส่ง  
* Project Item ยังเลือก Option ไม่ครบ  
* Custom Request ได้รับราคาแล้ว  
* รายการพร้อมสร้าง Order

แต่ละ Action ต้องกดไปยังหน้าที่เกี่ยวข้องได้โดยตรง

## **Recent Projects**

Card แสดง

* Project Name  
* Customer  
* Status  
* จำนวนรายการ  
* มูลค่ารวมปัจจุบัน  
* วันที่แก้ไขล่าสุด  
* ปุ่มเปิด Project

## **Empty State**

หากไม่มี Project

> เริ่มสร้างโครงการแรกของคุณ แล้วเพิ่มสินค้าที่ต้องการเสนอให้ลูกค้า

Actions

* สร้างโครงการ  
* ดูสินค้า

---

# **21\. Notifications**

## **Screen ID**

`MEM-002`

## **Route**

`/member/notifications`

## **Components**

* All  
* Unread  
* Project  
* Custom Request  
* System

Notification Item

* Icon  
* Title  
* Description  
* Date/Time  
* Related Entity  
* Read Status

Actions

* Mark as Read  
* Mark All as Read  
* Open Related Item

MVP ไม่ต้องมี Notification Preference ลึก แต่ควรแยก In-App และ Email ใน Backend

---

# **22\. Member Profile**

## **Screen ID**

`MEM-003`

## **Route**

`/member/profile`

## **Tabs**

* ข้อมูลส่วนตัว  
* ข้อมูลบริษัท  
* ความปลอดภัย

## **Profile Summary**

* Avatar  
* Member Code  
* Member Type  
* Approval Status  
* Company  
* Contact

---

# **23\. Edit Personal Information**

## **Screen ID**

`MEM-004`

Fields

* ชื่อ  
* นามสกุล  
* Display Name  
* เบอร์โทร  
* Email  
* รูป Profile

Business Rules

* การเปลี่ยน Email อาจต้อง Verify ใหม่  
* Member Code แก้ไม่ได้  
* Member Type แก้เองไม่ได้  
* Approval Status แก้เองไม่ได้

---

# **24\. Edit Company Information**

## **Screen ID**

`MEM-005`

Fields

* Company Name  
* Business Type  
* Tax ID  
* Address  
* Province  
* Service Area  
* Interested Categories

หากข้อมูลสำคัญบางอย่างกระทบสิทธิ์สมาชิก ระบบอาจตั้งสถานะ `รอตรวจสอบการแก้ไข` โดยไม่ลดสิทธิ์เดิมทันที

---

# **25\. Security Settings**

## **Screen ID**

`MEM-006`

Functions

* เปลี่ยน Password  
* ดูอุปกรณ์หรือ Session ล่าสุดในอนาคต  
* Logout ทุกอุปกรณ์ในอนาคต

MVP ต้องมีอย่างน้อย Change Password และ Logout

---

# **26\. Catalog Listing**

## **Screen ID**

`CAT-001`

## **Route**

`/member/catalog`

## **Purpose**

ให้สมาชิกค้นหาและเลือกสินค้าสำหรับ Project

## **Desktop Layout**

┌──────────────────────────────────────────────────────────┐  
│ Catalog             Search \[\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\]         │  
├───────────────┬──────────────────────────────────────────┤  
│ Filters       │ Sort     View Grid/List      Results     │  
│               │                                          │  
│ Category      │ \[Product\] \[Product\] \[Product\]             │  
│ Supplier      │ \[Product\] \[Product\] \[Product\]             │  
│ Collection    │                                          │  
│ Price         │                                          │  
│ Material      │                                          │  
│ Style         │                                          │  
│ Lead Time     │                                          │  
└───────────────┴──────────────────────────────────────────┘

## **Mobile Layout**

* Search อยู่ด้านบน  
* Filter เปิด Bottom Sheet หรือ Drawer  
* Product Grid 2 Columns หรือ 1 Column ตามขนาด  
* Sticky Filter/Sort Bar

## **Filters**

Must Have

* Category  
* Subcategory  
* Supplier  
* Collection  
* Member Price Range  
* Material  
* Product Type  
* Lead Time  
* Availability หรือ Orderable Status

## **Sort**

* แนะนำ  
* ใหม่ล่าสุด  
* ราคาต่ำไปสูง  
* ราคาสูงไปต่ำ  
* Lead Time สั้นที่สุด  
* ชื่อสินค้า

## **Product Card**

แสดง

* Main Image  
* Product Name  
* Product Code  
* Category  
* Partner Source Label; แสดงชื่อโรงงานเฉพาะเมื่อมี Active Disclosure Grant  
* ขนาดย่อ  
* Member Price  
* Suggested Resale Price  
* Freight Estimate Range  
* Price Unit  
* Lead Time  
* Material Sample Available หรือ Built-in Display Badge  
* Status  
* Quick Add to Project  
* Quick View  

## **Member Price Rule**

* Active Member เห็นราคา  
* Pending หรือ Visitor ไม่เห็น  
* Product ไม่มี Active Price แสดง `ติดต่อทีมงาน` หรือ `ยังไม่เปิดรับออเดอร์`  
* Suggested Resale เป็นข้อมูลแนะนำและไม่รวมในยอด Order  
* ห้ามแสดง Factory Cost, Formula Component หรือ Margin

## **Product Card Actions**

Primary

`เพิ่มเข้าโครงการ`

Secondary

`ดูรายละเอียด`

---

# **27\. Catalog Search**

## **Screen ID**

`CAT-002`

Search รองรับ

* Product Name ไทย  
* Product Name อังกฤษ  
* Product Name จีน  
* Product Code  
* Factory SKU เฉพาะ Active Disclosure Grant  
* Material  
* Option Code  
* Category  
* Collection

## **Search Experience**

* Debounce  
* Search Suggestion  
* Recent Search  
* Clear Search  
* Highlight Matching Text  
* Show Result Count

## **No Result State**

> ไม่พบสินค้าที่ตรงกับคำค้น ลองลดตัวกรองหรือค้นหาด้วยรหัสสินค้า หมวด หรือวัสดุ

Actions

* ล้างตัวกรอง  
* ดูสินค้าทั้งหมด  
* ส่ง Custom Request

---

# **28\. Product Quick View**

## **Screen ID**

`CAT-003`

ใช้ Drawer หรือ Modal แสดงข้อมูลย่อโดยไม่ออกจาก Catalog

แสดง

* รูป  
* ชื่อ  
* รหัส  
* ขนาด  
* วัสดุ  
* ราคา  
* Lead Time  
* Option Groups  
* ปุ่มดูรายละเอียด  
* ปุ่มเพิ่มเข้า Project

Quick View ไม่จำเป็นต้องเลือก Option ทุกอย่างได้ หากทำให้ซับซ้อน ให้เลือก Option ใน Product Detail หรือ Add-to-Project Flow

---

# **29\. Product Detail**

## **Screen ID**

`CAT-004`

## **Route**

`/member/catalog/[productId]`

## **Purpose**

ให้สมาชิกตรวจข้อมูลสินค้า เลือก Variant และ Option ก่อนเพิ่มเข้า Project

## **Page Sections**

1. Breadcrumb  
2. Image Gallery  
3. Product Summary  
4. Price and Lead Time  
5. Variant Selection  
6. Product Options  
7. Quantity  
8. Add to Project  
9. Specifications  
10. Dimensions  
11. Materials and Finishes  
12. Documents  
13. Material Sample / Built-in Display  
14. Related Products  
15. Terms and Notes

## **Desktop Wireframe**

┌──────────────────────────────────────────────────────────┐  
│ Breadcrumb                                               │  
├───────────────────────────┬──────────────────────────────┤  
│                           │ Product Name                 │  
│       Image Gallery       │ Product Code                 │  
│                           │ Member Price                 │  
│                           │ Suggested Resale             │  
│                           │ Freight Estimate             │  
│                           │ Lead Time                    │  
│                           │                              │  
│                           │ Variant                      │  
│                           │ Options                      │  
│                           │ Quantity                     │  
│                           │                              │  
│                           │ \[เพิ่มเข้าโครงการ\]           │  
├───────────────────────────┴──────────────────────────────┤  
│ รายละเอียด | สเปก | ขนาด | เอกสาร | ตัวอย่าง            │  
└──────────────────────────────────────────────────────────┘

## **Product Summary**

* Product Name TH  
* Product Name EN  
* Product Code  
* Factory SKU เฉพาะเมื่อมี Active Disclosure Grant  
* Category  
* Collection  
* Partner Source Label หรือชื่อโรงงานเมื่อปลดล็อกแล้ว  
* Country of Origin  
* Standard/Custom Badge

## **Price**

แสดง

* Member Price  
* Suggested Resale Price พร้อมป้าย `ราคาแนะนำสำหรับขายต่อ`  
* Freight Estimate 15–20% หรือค่าจาก Formula Snapshot พร้อมป้าย `ประมาณการ`  
* Unit  
* ราคานี้รวมอะไร  
* ข้อความชัดเจนว่าไม่รวม Freight และค่าใช้จ่ายนำเข้า

ตัวอย่างข้อความ

> ราคาสมาชิกเป็นราคาสินค้า ไม่รวมค่าขนส่ง ค่านำเข้า และค่าจัดส่งหน้างาน

Suggested Resale และ Freight Estimate เป็นข้อมูลประกอบการวางแผน Member Price เท่านั้นที่ส่งต่อเป็น
ยอดสินค้าใน Order ส่วน Actual Freight และ VAT ออกเอกสารแยกตามกฎ

## **Material Sample และ Factory Privacy**

* `material_swatch` แสดงประเภทวัสดุ รหัส รูป สถานะ ประเทศ เมือง และสถานที่ Member-safe  
* `built_in_display` ใช้เฉพาะงานแสดงบางรายการ เช่น ตู้เสื้อผ้าหรือชุดครัว  
* เฟอร์นิเจอร์ทั่วไปไม่ใช้ Sample Badge  
* ก่อน Visit Completed แสดงเพียง `Partner Showroom — เมือง` และปุ่ม `ขอเยี่ยมชม`  
* หลัง Visit Completed แสดงชื่อโรงงานและรายละเอียดตาม Disclosure Grant ของ Member Profile นั้น

## **Price Unavailable**

หากไม่มี Active Member Price

* Disable Add to Project แบบ Orderable  
* อนุญาตเพิ่มเป็นรายการสนใจหรือ Custom Request ตามนโยบาย  
* แสดงข้อความให้ติดต่อทีมงาน

---

# **30\. Product Option Selection**

## **Screen ID**

`CAT-005`

## **Option Group Display**

เลือก Component ตามประเภท

### **Color หรือ Material Swatch**

แสดง

* รูปหรือสี  
* Option Code  
* Option Name  
* Sample Availability

### **Size**

ใช้ Radio Card หรือ Dropdown

### **Accessories**

ใช้ Checkbox หากเลือกหลายรายการได้

### **Single Selection**

ใช้ Radio หรือ Select

## **Required Option**

แสดงเครื่องหมายจำเป็น

หากยังเลือกไม่ครบ

* ปุ่มเพิ่มเข้า Project Disable หรือ  
* เมื่อกด ให้ Scroll ไปยัง Option ที่ขาด

ข้อความ

> กรุณาเลือกผ้าหุ้มก่อนเพิ่มสินค้าเข้าโครงการ

## **Option Price Adjustment**

หาก Option มีราคาเพิ่ม

แสดง

* `เพิ่ม ฿...`  
* ราคา Updated Preview  
* ไม่เปิดเผยต้นทุน

## **Option Availability**

* Available  
* Temporarily Unavailable  
* Discontinued

Option ที่ไม่ใช้ต้อง Disabled และมีคำอธิบาย

## **Remark**

มีช่องหมายเหตุ

ข้อความกำกับ

> หมายเหตุใช้สำหรับข้อมูลประกอบเท่านั้น หากต้องการเปลี่ยนขนาด วัสดุ หรือโครงสร้างนอกเหนือจากตัวเลือกมาตรฐาน กรุณาสร้าง Custom Request

---

# **31\. Add Product to Project Flow**

Flow หลัก

เลือก Product  
→ เลือก Variant  
→ เลือก Required Options  
→ ระบุ Quantity  
→ กดเพิ่มเข้าโครงการ  
→ เลือก Project  
→ เลือก Area  
→ เพิ่ม Remark  
→ ยืนยัน

## **Select Project Modal**

### **Screen ID**

`CAT-006`

แสดง

* Search Project  
* Recent Projects  
* Project Name  
* Customer  
* Status  
* Site Province  
* ปุ่มสร้าง Project ใหม่

## **Business Rules**

* แสดงเฉพาะ Active Project ของ Member  
* ไม่แสดง Completed, Cancelled หรือ Archived เป็นค่าเริ่มต้น  
* Suspended Member ไม่สามารถเพิ่มสินค้าได้

## **Select Area**

หลังเลือก Project

* เลือก Area ที่มีอยู่  
* หรือสร้าง Area ใหม่แบบรวดเร็ว  
* สามารถเลือก `ยังไม่ระบุห้อง` ได้ หาก Project รองรับ General Area

## **Confirm Summary**

* Product  
* Variant  
* Options  
* Quantity  
* Price  
* Project  
* Area  
* Remark

Primary Action

`เพิ่มเข้าโครงการ`

## **Success**

Toast

> เพิ่มสินค้าเข้าโครงการแล้ว

Actions

* ดูโครงการ  
* เลือกสินค้าต่อ

---

# **32\. Quick Create Project**

## **Screen ID**

`CAT-007`

เปิดจาก Select Project Modal

Fields ขั้นต่ำ

* Project Name  
* Customer  
* Site Province  
* Expected Need Date  
* Main Address แบบย่อ

หากยังไม่มี Customer

* สร้าง Customer ใหม่ใน Flow เดียวได้

หลังสร้าง

* เลือก Project นั้นอัตโนมัติ  
* กลับ Add Product Flow  
* ไม่ควรพาผู้ใช้ออกจาก Product Detail โดยไม่จำเป็น

---

# **33\. Product Unavailable State**

## **Screen ID**

`CAT-008`

กรณี

* Product Suspended  
* Product Discontinued  
* Supplier Suspended  
* Price Expired  
* Option Unavailable

แสดง

* สถานะชัดเจน  
* เหตุผลที่เปิดเผยได้  
* Alternative Products  
* Custom Request  
* ติดต่อทีมงาน

Product เดิมที่อยู่ใน Project ต้องยังดู Snapshot หรือข้อมูลอ้างอิงได้ แม้ Product Master หยุดขาย

---

# **34\. End Customer Listing**

## **Screen ID**

`CUS-001`

## **Route**

`/member/customers`

## **Purpose**

จัดการข้อมูลลูกค้าปลายทางที่ใช้กับ Project

## **Display**

Desktop ใช้ Table

* Customer Code  
* Customer Name  
* Phone  
* Email  
* จำนวน Project  
* Project ล่าสุด  
* Updated Date  
* Action

Mobile ใช้ Card

## **Actions**

* สร้างลูกค้า  
* ดูรายละเอียด  
* แก้ไข  
* สร้าง Project ให้ลูกค้ารายนี้

## **Search**

* Customer Name  
* Phone  
* Email  
* Customer Code

## **Privacy**

Member เห็นเฉพาะ Customer ของตนเอง

---

# **35\. Create Customer**

## **Screen ID**

`CUS-002`

## **Route**

`/member/customers/new`

Fields

* Customer Name  
* Customer Type  
* Phone  
* Email  
* Note


## **Validation**

* Customer Name จำเป็น  
* Phone หรือ Email ควรมีอย่างน้อยหนึ่งอย่าง ตามนโยบาย  
* ตรวจข้อมูลซ้ำแบบเตือน ไม่จำเป็นต้อง Block เสมอไป

## **Success**

ไป Customer Detail หรือกลับ Flow ที่เรียกใช้

---

# **36\. Customer Detail**

## **Screen ID**

`CUS-003`

แสดง

* Customer Information  
* Active Projects  
* Completed Projects  
* Notes  
* Create Project Action

ห้ามแสดง Customer ของ Member อื่นผ่าน URL โดยตรง

---

# **37\. Project Listing**

## **Screen ID**

`PRJ-001`

## **Route**

`/member/projects`

## **Purpose**

แสดง Project ทั้งหมดของสมาชิก

## **Header**

* Page Title  
* Search  
* Filter  
* Create Project Button

## **Filters**

* Status  
* Customer  
* Project Type  
* Province  
* Expected Need Date  
* Updated Date

## **View Options**

* Card View  
* Table View

## **Project Card**

* Project Name  
* Project Code  
* Customer  
* Site  
* Status  
* Number of Areas  
* Number of Items  
* Ready to Order Count  
* Current Member Value  
* Expected Need Date  
* Last Updated

## **Primary Actions**

* เปิด Project  
* เพิ่มสินค้า  
* ดาวน์โหลด Schedule เมื่อมีรายการ

## **Empty State**

> คุณยังไม่มีโครงการ สร้างโครงการเพื่อเริ่มจัดสินค้าให้ลูกค้า

---

# **38\. Create Project**

## **Screen ID**

`PRJ-002`

## **Route**

`/member/projects/new`

ใช้ Step Form หรือ Single Page แบบแบ่ง Section

แนะนำ 3 Steps

1 ข้อมูลโครงการ  
→ 2 ลูกค้าและสถานที่  
→ 3 ตรวจสอบ

---

## **38.1 Step 1: Project Information**

Fields

* Project Name  
* Project Type  
* Expected Need Date  
* Internal Note ของ Member  
* Project Reference ภายนอก ถ้ามี

Project Type

* บ้านพักอาศัย  
* คอนโด  
* โรงแรม  
* ร้านอาหาร  
* สำนักงาน  
* โชว์รูม  
* ร้านค้า  
* โครงการอสังหาริมทรัพย์  
* อื่น ๆ

---

## **38.2 Step 2: Customer and Site**

Fields

* Select Existing Customer  
* Create New Customer  
* Site Address  
* Province  
* Postal Code  
* Google Maps URL  
* Contact Name  
* Contact Phone  
* Delivery/Access Note

Business Rule

* Project ต้องมี End Customer  
* Project ต้องมี Main Site Address  
* One Project \= One Main Delivery Address ใน MVP

---

## **38.3 Step 3: Review**

แสดง

* Project Information  
* Customer  
* Address  
* Contact  
* Expected Date

Actions

* ย้อนกลับ  
* บันทึกเป็นร่าง  
* สร้างโครงการ

## **Success Page หรือ Redirect**

ไป Project Overview พร้อม Empty State สำหรับ Area และ Items

---

# **39\. Project Overview**

## **Screen ID**

`PRJ-003`

## **Route**

`/member/projects/[projectId]`

## **Purpose**

เป็นศูนย์กลางของ Project

## **Header**

* Project Name  
* Project Code  
* Status Badge  
* Customer  
* Site  
* Expected Need Date  
* Edit Project  
* Add Product  
* Download Schedule

## **Tabs**

1. ภาพรวม  
2. รายการสินค้า  
3. ห้องและพื้นที่  
4. Custom Request  
5. เอกสาร  
6. Activity

Volume 1 อาจเปิดใช้งาน 1–4 และ Activity ขั้นพื้นฐาน

## **Overview Cards**

* จำนวนรายการทั้งหมด  
* รอลูกค้าอนุมัติ  
* พร้อมสั่ง  
* สั่งแล้ว  
* มูลค่าปัจจุบัน

## **Project Progress**

สร้างโครงการ  
→ เพิ่มสินค้า  
→ ลูกค้าอนุมัติ  
→ พร้อมสั่ง  
→ เปิดออเดอร์

Volume 1 แสดงถึง Ready to Order

## **Project Information**

* Customer  
* Site Address  
* Site Contact  
* Expected Need Date  
* Project Type  
* Notes

## **Quick Actions**

* เพิ่มสินค้า  
* เพิ่มห้อง  
* สร้าง Custom Request  
* ดาวน์โหลด Product Schedule

---

# **40\. Edit Project**

ใช้ Full Page หรือ Drawer ตามจำนวน Field

Business Rules

* Project Code แก้ไม่ได้  
* Member Owner แก้ไม่ได้  
* Address เปลี่ยนได้ก่อนสร้าง Order  
* เมื่อมี Order แล้ว การเปลี่ยน Address ต้องมี Warning เพราะ Order ใช้ Snapshot  
* Completed หรือ Archived Project จำกัดการแก้ไข

Unsaved Changes Warning จำเป็น

---

# **41\. Project Area Management**

## **Screen ID**

`PRJ-004`

## **Route**

`/member/projects/[projectId]/areas`

## **Purpose**

แบ่งสินค้าออกตามห้อง ชั้น หรือพื้นที่

## **Area Structure**

MVP ใช้ Flat List ไม่ต้องทำ Tree ซับซ้อน

Fields

* Area Name  
* Floor  
* Display Order  
* Note

ตัวอย่าง

* ชั้น 1 – Living Room  
* ชั้น 1 – Kitchen  
* ชั้น 2 – Master Bedroom  
* Outdoor – Terrace

## **Actions**

* Add Area  
* Edit  
* Reorder  
* Delete  
* Move Items

## **Delete Rule**

หาก Area มี Project Item

ระบบต้องให้เลือก

* ย้ายรายการไป Area อื่น  
* ย้ายไป `ยังไม่ระบุพื้นที่`  
* ยกเลิกการลบ

ห้ามลบแล้วทำให้ Item หาย

---

# **42\. Project Item Listing**

## **Screen ID**

`PRJ-005`

## **Route**

`/member/projects/[projectId]/items`

## **Purpose**

จัดการสินค้าทั้งหมดใน Project

## **View Modes**

* By Area  
* All Items  
* Status View  
* Table  
* Visual Card

## **Filters**

* Area  
* Category  
* Supplier  
* Item Status  
* Option Completeness  
* Standard/Custom  
* Ordered/Not Ordered

## **Table Columns**

* Image  
* Product Code  
* Product Name  
* Area  
* Selected Options  
* Quantity  
* Unit Price  
* Line Total  
* Item Status  
* Ordered Quantity  
* Action

## **Mobile Card**

แสดงข้อมูลสำคัญและเปิด Drawer เพื่อแก้ไข

# **43\. Project Item Status**

สถานะและความหมาย

## **Draft**

ยังจัดข้อมูลไม่ครบ

## **Waiting Client Approval**

สมาชิกนำไปเสนอและรอลูกค้าตัดสินใจ

## **Ready to Order**

ลูกค้าอนุมัติและ Option จำเป็นครบ

## **Partially Ordered**

สั่งบางส่วนของ Quantity

## **Ordered**

สั่งครบแล้ว

## **Cancelled**

ยกเลิกรายการใน Project

## **Status Transition**

Draft  
→ Waiting Client Approval  
→ Ready to Order  
→ Partially Ordered  
→ Ordered

สามารถย้อน

* Waiting Client Approval → Draft  
* Ready to Order → Waiting Client Approval

หลัง Ordered ห้ามย้อนด้วย Member เอง

## **Ready to Order Validation**

ก่อนเปลี่ยนเป็น Ready to Order ต้องตรวจ

* Product ยัง Orderable  
* Active Member Price  
* Required Options ครบ  
* Quantity มากกว่า 0  
* Supplier Active  
* ไม่มี Remark ที่ชัดเจนว่าเปลี่ยน Standard Spec  
* Custom Request ได้รับการยืนยันแล้ว หากเป็น Custom

---

# **44\. Edit Project Item**

## **Screen ID**

`PRJ-006`

เปิดแบบ Drawer บน Desktop และ Full Page บน Mobile

## **Fields**

* Area  
* Variant  
* Selected Options  
* Quantity  
* Unit  
* Remark  
* Item Status

## **Read-only Information**

* Product Code  
* Product Name  
* Current Price  
* Lead Time  
* Supplier  
* Product Status

## **Current Price Notice**

Project Item ใช้ราคาปัจจุบันก่อนสร้าง Order

หากราคามีการเปลี่ยนหลังเพิ่มเข้า Project

แสดง Badge

`ราคาอัปเดตแล้ว`

พร้อม

* ราคาเดิม  
* ราคาปัจจุบัน  
* วันที่อัปเดต

สมาชิกต้องรับทราบก่อน Ready to Order หากนโยบายกำหนด

## **Product Changed State**

หาก Product หรือ Option ถูกระงับ

แสดง Warning และ Action

* เลือก Option ใหม่  
* เปลี่ยนสินค้า  
* ติดต่อทีมงาน  
* สร้าง Custom Request

---

# **45\. Duplicate Product Item**

หากสมาชิกเพิ่ม Product เดียวกันเข้า Project และ Area เดียวกัน

ระบบควรถาม

> สินค้านี้มีอยู่ในพื้นที่นี้แล้ว ต้องการเพิ่มจำนวนในรายการเดิมหรือสร้างเป็นรายการใหม่?

Actions

* เพิ่มจำนวนรายการเดิม  
* สร้างรายการใหม่  
* ยกเลิก

สร้างรายการใหม่เหมาะเมื่อ Option หรือ Remark ต่างกัน

---

# **46\. Remove Project Item**

ก่อนลบ

แสดง Confirmation

* Product  
* Area  
* Quantity

Business Rules

* Draft หรือ Waiting Client Approval ลบได้  
* Ready to Order ลบได้แต่ต้องยืนยัน  
* Partially Ordered หรือ Ordered ลบไม่ได้  
* ใช้ Cancel Status แทนเมื่อมีประวัติการสั่งแล้ว

---

# **47\. Move Item Between Areas**

สามารถ

* ใช้ Action `ย้ายพื้นที่` ใน MVP

หลังย้ายต้อง Update Project Summary

---

# **48\. Project Item Detail View**

นอกจาก Edit Drawer ควรมี Detail Page หรือ Expanded Row เพื่อดู

* Product Snapshot ปัจจุบัน  
* Selected Options  
* Price History ที่เกี่ยวข้อง  
* Files  
* Remark  
* Status Timeline  
* Related Custom Request  
* Ordered Quantity

MVP สามารถใช้ Side Panel แทน Full Page

---

# **49\. Product Schedule Preview**

## **Screen ID**

`PRJ-007`

## **Route**

`/member/projects/[projectId]/schedule`

## **Purpose**

ให้สมาชิกตรวจรายการก่อน Export PDF หรือ Excel

## **Filters**

* All Areas  
* Selected Areas  
* Item Status  
* Include Draft  
* Include Price  
* Include Partner Source/Brand; ชื่อโรงงานเฉพาะ Active Disclosure Grant  
* Include Notes

ค่าเริ่มต้นแนะนำ

* รวม Draft และ Waiting Client Approval ตามการใช้งานเสนอราคา  
* แสดง Member Price  
* ไม่แสดง Internal Data

## **Preview Sections**

* Company/Member Information  
* Project  
* Customer  
* Site  
* Area Groups  
* Product Rows  
* Summary  
* Terms

## **Product Row**

* Image  
* Code  
* Name  
* Dimensions  
* Material  
* Options  
* Quantity  
* Unit Price  
* Suggested Resale Unit Price  
* Freight Estimate Range  
* Total  
* Lead Time  
* Remark

## **Footer Note**

> ราคาสินค้ายังไม่รวมค่าขนส่ง ค่านำเข้า ภาษี และค่าจัดส่งหน้างาน เว้นแต่ระบุไว้เป็นอย่างอื่น

Suggested Resale และ Freight Estimate ต้องมีคำว่า `ราคาแนะนำ`/`ประมาณการ` และต้องไม่รวมใน Total
ห้าม Export ชื่อโรงงานหรือ Supplier ID หาก Member ยังไม่มี Active Disclosure Grant

---

# **50\. Product Schedule Export**

## **Screen ID**

`PRJ-008`

## **Formats**

* PDF  
* Excel

## **Export Modal**

Options

* File Format  
* Areas  
* Item Status  
* Include Price  
* Include Suggested Resale  
* Include Freight Estimate  
* Include Product Image  
* Include Remarks  
* Language  
* Orientation สำหรับ PDF

---

## **50.1 Showroom Visit Request**

## **Screen ID**

`VISIT-001`

## **Route**

`/member/showroom-visits/new?location=[locationId]&product=[productId]`

แสดงเฉพาะข้อมูล Member-safe ได้แก่ประเทศ เมือง ประเภท Showroom ประเภท Material Sample/Built-in Display
และ Project ที่เกี่ยวข้อง ห้ามส่งชื่อโรงงาน Address, Contact หรือ Supplier ID มาที่ Browser

Member เลือก Project, วันที่สะดวก, จำนวนผู้ร่วมเดินทางเชิงข้อความ และหมายเหตุ แล้วกด `ส่งคำขอเยี่ยมชม`
สถานะเริ่มต้นเป็น `SUBMITTED`

## **50.2 Showroom Visit Detail**

## **Screen ID**

`VISIT-002`

## **Route**

`/member/showroom-visits/[visitId]`

แสดง Timeline `SUBMITTED`, `APPROVED`, `COMPLETED`, `REJECTED`, `CANCELLED` วันนัด และข้อความจากทีมงาน
Member ยกเลิกได้ก่อน Completed ตามนโยบาย ส่วน Purchasing/GISP Admin เป็นผู้ Approve/Complete

## **50.3 Factory Disclosure State**

## **Screen ID**

`VISIT-003`

ก่อน Completed แสดง Partner Source Label เท่านั้น หลัง Completed และมี Active Grant จึงแสดงชื่อโรงงาน
ที่อยู่และ Contact เฉพาะ Member Profile ผู้ขอ สิทธิ์ไม่ส่งต่อให้ Member อื่นและ Super Admin เพิกถอนได้
เมื่อถูกเพิกถอน UI ต้องกลับสู่สถานะ Redacted ทันทีโดยไม่ลบ Audit เดิม

MVP สามารถจำกัด Language เป็นไทยก่อน แต่ Database รองรับหลายภาษา

## **File Name**

ตัวอย่าง

GISP\_Product\_Schedule\_PRJ-2026-000001\_2026-07-30.pdf

## **Loading**

แสดง Progress

> กำลังสร้างเอกสาร กรุณาอย่าปิดหน้านี้

หากการสร้างไฟล์ใช้เวลานาน ควรสร้างแบบ Job และแจ้งเมื่อพร้อมในอนาคต แต่ MVP สามารถทำ Sync หากรายการไม่มาก

## **Security**

ห้าม Export

* Factory Cost  
* Margin  
* Supplier Payment  
* Internal Notes  
* Confidential Contact

---

# **51\. Custom Request Entry Points**

สมาชิกสามารถเริ่ม Custom Request จาก

* Product Detail  
* Product Unavailable State  
* Project Overview  
* Project Item ที่ Option ไม่ตรง  
* Catalog No Result  
* Custom Request Menu

## **Entry Types**

### **Modify Existing Product**

มี Base Product

### **New Custom Product**

ไม่มี Base Product

---

# **52\. Custom Request Form**

## **Screen ID**

`CUSREQ-001`

## **Route**

`/member/custom-requests/new`

## **Step Flow**

1 ประเภทคำขอ  
→ 2 รายละเอียดและขนาด  
→ 3 ไฟล์อ้างอิง  
→ 4 Project และพื้นที่  
→ 5 ตรวจสอบและส่ง

---

## **52.1 Step 1: Request Type**

เลือก

* เปลี่ยนขนาด  
* เปลี่ยนสีหรือวัสดุ  
* เปลี่ยนอุปกรณ์  
* ผลิตตามแบบ  
* งานบิลท์อิน  
* อื่น ๆ

หากเริ่มจาก Product Detail ให้แสดง Base Product

---

## **52.2 Step 2: Specification**

Fields

* Item Name  
* Description  
* Width  
* Depth  
* Height  
* Quantity  
* Unit  
* Requested Material  
* Requested Color  
* Requested Function  
* Member Note

Units

* mm  
* ชิ้น  
* ชุด  
* ตารางเมตร  
* เมตรยาว ตามประเภท

สำหรับขนาดเฟอร์นิเจอร์ควรใช้ mm เป็นค่ามาตรฐาน

---

## **52.3 Step 3: Files**

รองรับ

* Reference Image  
* PDF  
* CAD  
* Dimension Drawing  
* Material Reference

แสดง

* Upload Progress  
* File Name  
* File Size  
* File Role  
* Delete Before Submit

CAD ไม่ต้อง Preview แต่ต้องแสดง Icon และชื่อไฟล์

---

## **52.4 Step 4: Project**

เลือก

* Project  
* Area  
* Expected Need Date ดึงจาก Project  
* Site Notes ที่เกี่ยวข้อง

หากไม่มี Project ให้สร้าง Quick Project ได้

---

## **52.5 Step 5: Review**

แสดงสรุป

* Request Type  
* Base Product  
* Dimensions  
* Quantity  
* Material  
* Files  
* Project  
* Area  
* Notes

Actions

* บันทึกร่าง  
* ย้อนกลับ  
* ส่งคำขอ

---

# **53\. Custom Request Detail**

## **Screen ID**

`CUSREQ-002`

## **Route**

`/member/custom-requests/[requestId]`

## **Sections**

* Request Summary  
* Status  
* Project  
* Base Product  
* Specification  
* Files  
* Team Response  
* Proposed Member Price  
* Lead Time  
* Timeline

## **Status**

* Draft  
* Submitted  
* Under Review  
* Need Info  
* Ready for Quote  
* Converted  
* Cancelled

## **Linked Custom Quotation**

แสดง

* Quotation Number และ Version  
* Proposed Member Price  
* Currency  
* Lead Time  
* Quote Note  
* Confirmed Spec File  
* Expiry Date ถ้ามี

Actions

* เปิด Custom Quotation  
* Accept/Reject ผ่าน Action ของ Custom Quotation  
* ขอข้อมูลเพิ่มเติม ตามนโยบาย

## **Confirmation**

ก่อนยืนยัน

> เมื่อยืนยันแล้ว ระบบจะสร้างรายการ Custom ใน Project ตามราคาและสเปกนี้

หลัง Custom Quotation เป็น `ACCEPTED`

* Create Project Item  
* Link Custom Request  
* Set Item Status ตามกฎ  
* Lock Quoted Specification ใน Project Item

---

# **54\. Custom Request Listing**

## **Screen ID**

`CUSREQ-003`

## **Route**

`/member/custom-requests`

Filters

* Status  
* Project  
* Request Type  
* Date

Card/Table

* Request Number  
* Item Name  
* Project  
* Type  
* Status  
* Proposed Price  
* Updated Date  
* Action

Action Required Badge เมื่อมี Linked Custom Quotation สถานะ `SENT`

---

# **55\. Project Activity Timeline**

## **Screen ID**

`PRJ-009`

แสดง Event ที่ Member เห็น เช่น

* Project Created  
* Area Added  
* Product Added  
* Product Option Updated  
* Item Ready to Order  
* Product Schedule Downloaded  
* Custom Request Submitted  
* Custom Quote Confirmed

ไม่แสดง

* Factory Cost Change  
* Internal Admin Note  
* Supplier Communication

---

# **56\. Breadcrumb และ Navigation Rules**

ตัวอย่าง

โครงการ  
\> บ้านคุณเอ  
\> รายการสินค้า  
\> SOFA-001

กฎ

* Desktop แสดง Breadcrumb เต็ม  
* Mobile ลดระดับกลางเมื่อพื้นที่ไม่พอ  
* Back Button ต้องไม่ทำให้ข้อมูล Form หาย  
* Deep Link ต้องเปิดได้เมื่อผู้ใช้มีสิทธิ์

---

# **57\. Confirmation Dialogs**

Action ที่ต้องยืนยันใน Volume 1

* ส่งใบสมัคร  
* ลบ Project Item  
* Archive Project  
* เปลี่ยน Item เป็น Cancelled  
* ส่ง Custom Request  
* ยืนยัน Custom Quote  
* ออกจากหน้าที่มีข้อมูลยังไม่บันทึก  
* เปลี่ยน Option ที่ทำให้ราคาเปลี่ยน

Dialog ต้องบอกผลกระทบ ไม่ใช้เพียงข้อความ “แน่ใจหรือไม่”

---

# **58\. Form Autosave**

## **Recommended**

Project Item Remark และ Custom Request Draft ควร Autosave หรือมี Save Draft ชัดเจน

## **MVP Minimum**

* เตือนก่อนออกจากหน้าหากยังไม่บันทึก  
* บันทึกเมื่อกด Save  
* แสดง Saved At  
* ป้องกัน Double Submit

---

# **59\. Permission Matrix Volume 1**

| Function | Visitor | Pending | Active Member | Suspended | Product Admin |
| ----- | ----- | ----- | ----- | ----- | ----- |
| ดู Landing Page | Yes | Yes | Yes | Yes | Yes |
| สมัครสมาชิก | Yes | No | No | No | No |
| Login | Yes | Yes | Yes | Yes | Yes |
| ดู Catalog | Limited | No/Preview | Yes | Read-only | Yes |
| ดู Member Price | No | No | Yes | Read-only ตามนโยบาย | Yes |
| ดู Suggested Resale/Freight Estimate | No | No | Yes | Read-only ตามนโยบาย | Yes |
| ขอเยี่ยมชม Showroom | No | No | Yes | No | View |
| ดูชื่อโรงงาน | No | No | เฉพาะ Active Disclosure Grant ของตน | เฉพาะ Active Grant เดิมแบบ Read-only หากนโยบายอนุญาตเข้าอ่าน | ตาม Permission |
| สร้าง Project | No | No | Yes | No | No |
| เพิ่ม Project Item | No | No | Yes | No | No |
| ดาวน์โหลด Schedule | No | No | Yes | Existing only | No |
| สร้าง Custom Request | No | No | Yes | No | No |
| จัดการ Product | No | No | No | No | Yes |
| ดู Factory Cost | No | No | No | No | ตาม Permission |

---

# **60\. API Mapping Volume 1**

## **Authentication**

* `POST /api/auth/register`  
* `POST /api/auth/login`  
* `POST /api/auth/logout`  
* `POST /api/auth/forgot-password`  
* `POST /api/auth/reset-password`  
* `GET /api/auth/session`

## **Profile**

* `GET /api/member/profile`  
* `PATCH /api/member/profile`

## **Catalog**

* `GET /api/products`  
* `GET /api/products/:id`

Member Catalog Response ส่ง `memberPrice`, `suggestedResalePrice`, `freightEstimateLow/High`,
Material Sample และ Partner Source Label ได้ แต่ห้ามมี Factory Cost, Formula Component, Margin,
Supplier ID/Name/Address/Contact จนกว่าจะผ่าน Disclosure Guard

## **Showroom Visit**

* `GET /api/showroom-visits`  
* `POST /api/showroom-visits`  
* `GET /api/showroom-visits/:id`  
* `POST /api/showroom-visits/:id/cancel`  
* `POST /api/admin/showroom-visits/:id/approve`  
* `POST /api/admin/showroom-visits/:id/reject`  
* `POST /api/admin/showroom-visits/:id/complete`  
* `POST /api/admin/supplier-disclosures/:id/revoke`

ทุก Transition เป็น Action Endpoint; Complete สร้าง Grant ใน Transaction เดียว และ Revoke ใช้ Super Admin

## **Customers**

* `GET /api/customers`  
* `POST /api/customers`  
* `GET /api/customers/:id`  
* `PATCH /api/customers/:id`

## **Projects**

* `GET /api/projects`  
* `POST /api/projects`  
* `GET /api/projects/:id`  
* `PATCH /api/projects/:id`  
* `POST /api/projects/:id/archive`

## **Project Areas**

* `GET /api/projects/:id/areas`  
* `POST /api/projects/:id/areas`  
* `PATCH /api/projects/:id/areas/:areaId`  
* `DELETE /api/projects/:id/areas/:areaId`

## **Project Items**

* `GET /api/projects/:id/items`  
* `POST /api/projects/:id/items`  
* `PATCH /api/projects/:id/items/:itemId`  
* `DELETE /api/projects/:id/items/:itemId`  
* `POST /api/projects/:id/items/:itemId/status`

## **Product Schedule**

* `GET /api/projects/:id/product-schedule/pdf`  
* `GET /api/projects/:id/product-schedule/excel`

## **Custom Request**

* `GET /api/custom-requests`  
* `POST /api/custom-requests`  
* `GET /api/custom-requests/:id`  
* `PATCH /api/custom-requests/:id`  
* `POST /api/custom-requests/:id/submit`  
* `POST /api/custom-requests/:id/accept`  
* `POST /api/custom-requests/:id/reject`

---

# **61\. Analytics Events Volume 1**

ควรเก็บ Event เพื่อวัด Funnel

## **Registration**

* Registration Started  
* Registration Step Completed  
* Registration Submitted  
* Registration Approved  
* Registration Rejected

## **Catalog**

* Catalog Viewed  
* Search Performed  
* Filter Applied  
* Product Viewed  
* Option Selected  
* Add to Project Clicked

## **Project**

* Project Created  
* Area Created  
* Product Added  
* Item Status Changed  
* Product Schedule Exported

## **Custom**

* Custom Request Started  
* Custom Request Submitted  
* Custom Quote Viewed  
* Custom Quote Accepted  
* Custom Quote Rejected

ห้ามเก็บข้อมูลส่วนบุคคลที่ไม่จำเป็นใน Analytics Payload

---

# **62\. UX Metrics**

KPI ของ Volume 1

* Registration Completion Rate  
* Approval Conversion Rate  
* Time to First Project  
* Percentage of Active Members Creating Project  
* Time from Project Creation to First Item  
* Catalog Search Success Rate  
* Product Detail to Add-to-Project Rate  
* Option Completion Rate  
* Project Item to Ready-to-Order Rate  
* Product Schedule Export Rate  
* Custom Request Submission Rate  
* Form Error Rate  
* Mobile Completion Rate

---

# **63\. Error Cases สำคัญ**

## **Catalog**

* Product ถูกปิดระหว่างผู้ใช้ดู  
* ราคาเปลี่ยนก่อนเพิ่มเข้า Project  
* Option ถูกปิด  
* Supplier ถูกระงับ

## **Project**

* Project ถูก Archive ในอีก Session  
* Item ถูกแก้ไขพร้อมกัน  
* Quantity ไม่ถูกต้อง  
* Area ถูกลบ  
* Product ถูกสั่งครบแล้ว

## **Custom Request**

* Upload ล้มเหลว  
* File ใหญ่เกิน  
* File Type ไม่รองรับ  
* Quote หมดอายุ  
* Request ถูกยกเลิกโดย Admin

## **General**

* Session หมดอายุ  
* Permission เปลี่ยน  
* Network ขาด  
* API Timeout

ทุกกรณีต้องรักษาข้อมูล Form เท่าที่ทำได้

---

# **64\. Mobile-Specific Rules**

## **Catalog**

* Filter Drawer  
* Sticky Add to Project Button ใน Product Detail  
* Image Gallery Swipe  
* Option Swatch ขนาดกดง่าย  
* ราคาและปุ่มไม่ควรถูกดันลงต่ำเกินไป

## **Project**

* Project Item เป็น Card  
* Edit ใช้ Full-screen Sheet  
* Status Change ใช้ Bottom Sheet  
* Export Option แบบ Simplified

## **Form**

* Input Type ถูกต้อง เช่น Phone, Email, Number  
* Avoid Horizontal Form Layout  
* Sticky Save Button เมื่อ Form ยาว  
* File Upload ใช้กล้องถ่ายรูปได้

---

# **65\. Accessibility Requirements**

* Minimum Touch Target เหมาะกับมือถือ  
* Label เชื่อม Input  
* Required Field ไม่ใช้สีอย่างเดียว  
* Error Summary อยู่ด้านบน Form เมื่อ Submit ไม่ผ่าน  
* Focus ไป Field แรกที่ผิด  
* Modal Trap Focus  
* Escape ปิด Modal เมื่อปลอดภัย  
* Image Alt Text  
* Status Badge มีข้อความ  
* Table มี Header ที่ชัดเจน  
* รองรับ Keyboard Navigation

---

# **66\. UX Copy Guidelines**

ข้อความควร

* ใช้ภาษาไทยตรงไปตรงมา  
* หลีกเลี่ยงศัพท์โรงงานที่สมาชิกใหม่ไม่เข้าใจ  
* ไม่ใช้คำกว้าง เช่น “ดำเนินการ”  
* บอก Action และผลลัพธ์

ตัวอย่างที่ดี

> กรุณาเลือกวัสดุหน้าบานก่อนเพิ่มสินค้าเข้าโครงการ

แทน

> ข้อมูลไม่สมบูรณ์

ตัวอย่างที่ดี

> ไม่สามารถเปลี่ยนจำนวนได้ เนื่องจากรายการนี้ถูกสร้างออเดอร์แล้วบางส่วน

แทน

> Operation failed

---

# **67\. Wireflow หลัก Volume 1**

## **67.1 New Member Flow**

Landing  
→ Register  
→ Account Information  
→ Business Information  
→ Review  
→ Submit  
→ Pending Approval  
→ Admin Approves  
→ Login  
→ Member Dashboard

## **67.2 Catalog to Project Flow**

Dashboard  
→ Catalog  
→ Search / Filter  
→ Product Detail  
→ Select Variant  
→ Select Options  
→ Add to Project  
→ Select Project  
→ Select Area  
→ Confirm  
→ Project Item Added

## **67.3 New Project Flow**

Dashboard  
→ Create Project  
→ Project Information  
→ Select/Create Customer  
→ Site Address  
→ Review  
→ Create  
→ Add Area  
→ Browse Catalog  
→ Add Product

## **67.4 Project Preparation Flow**

Project  
→ Add Items  
→ Organize by Area  
→ Select Options  
→ Set Quantity  
→ Waiting Client Approval  
→ Ready to Order  
→ Volume 2 Order Creation

## **67.5 Custom Request Flow**

Product Detail / Project  
→ Create Custom Request  
→ Enter Specification  
→ Upload Files  
→ Select Project  
→ Submit  
→ Admin Quotes  
→ Member Reviews  
→ Accept  
→ Convert to Project Item

## **67.6 Product Schedule Flow**

Project  
→ Product Schedule  
→ Select Area and Status  
→ Preview  
→ Export PDF / Excel  
→ Download

---

# **68\. MVP Must Have**

## **Foundation**

* Responsive Application Shell  
* Sidebar / Mobile Navigation  
* Global Status Components  
* Loading, Empty, Error, Success States  
* Permission Guard

## **Authentication**

* Login  
* Register  
* Pending Approval  
* Forgot Password  
* Reset Password  
* Suspended State

## **Member**

* Dashboard  
* Profile  
* Notifications

## **Catalog**

* Product Listing  
* Search  
* Filter  
* Product Detail  
* Variant and Option Selection  
* Member Price  
* Add to Project

## **Customer**

* Customer Listing  
* Create and Edit Customer

## **Project**

* Project Listing  
* Create Project  
* Project Overview  
* Project Area  
* Project Item  
* Item Status  
* Product Schedule PDF/Excel

## **Custom**

* Create Request  
* Upload Files  
* View Quote  
* Accept/Reject  
* Convert to Project Item

---

# **69\. Acceptance Criteria Volume 1**

Volume 1 ถือว่าสมบูรณ์เมื่อ

1. Visitor สมัครสมาชิกได้  
2. ผู้สมัครเห็นสถานะ Pending ชัดเจน  
3. Pending Member ไม่สามารถเข้าถึง Member Price  
4. Active Member Login เข้า Dashboard ได้  
5. Member Dashboard แสดง Project และ Action Required ได้  
6. Member ค้นหาและกรองสินค้าได้  
7. Member ดู Product Detail ได้  
8. Member เห็น Member Price, Suggested Resale และ Freight Estimate โดยยอด Order ใช้ Member Price เท่านั้น  
9. Required Product Options ถูกตรวจสอบครบ  
10. Member สร้าง Customer ได้  
11. Member สร้าง Project ได้  
12. Project มี Customer และ Main Address ได้  
13. Member สร้าง Area ได้  
14. Member เพิ่ม Product เข้า Project ได้  
15. Member แก้ Quantity, Option และ Remark ได้  
16. ระบบป้องกันการเพิ่มรายการซ้ำโดยไม่ตั้งใจ  
17. Member เปลี่ยน Item Status ได้ตามกฎ  
18. Ready to Order ถูก Block หาก Option ไม่ครบ  
19. Member ดาวน์โหลด Product Schedule PDF ได้  
20. Member ดาวน์โหลด Product Schedule Excel ได้  
21. Product Schedule แสดง Suggested Resale/Freight Estimate แบบแนะนำแต่ไม่รวมใน Total และไม่แสดง Factory Cost/Formula/Margin  
22. Member สร้าง Custom Request ได้  
23. Member Upload PDF, CAD และรูปได้  
24. Member ดูและยืนยัน Custom Quote ได้  
25. Custom Quote ที่ยืนยันแปลงเป็น Project Item ได้  
26. Member เห็นเฉพาะ Project, Customer และ Request ของตนเอง  
27. Suspended Member สร้าง Project หรือเพิ่ม Item ไม่ได้  
28. Mobile Catalog และ Project ใช้งานได้  
29. ทุก Form มี Validation และ Error State  
30. ไม่มีข้อมูลต้นทุน สูตร Margin หรือข้อมูลภายในหลุดสู่ Member UI  
31. Core ไม่มี Member Team/Sub-user/Invitation และ Action จาก Credential เดียว Audit เป็น Member Account เดียว  
32. Material Sample แยกจาก Built-in Display และไม่ใช้เฟอร์นิเจอร์ทั่วไปเป็น Sample  
33. ก่อน Visit Completed Member ไม่เห็นชื่อโรงงาน Address, Contact หรือ Supplier ID ผ่าน UI/API/Export/URL  
34. Visit เดิน `SUBMITTED → APPROVED → COMPLETED` พร้อม Reject/Cancel ได้  
35. Completed Visit เปิดชื่อโรงงานเฉพาะ Member Profile + Supplier และ Member อื่นยังถูก Redact  
36. Super Admin เพิกถอน Disclosure พร้อมเหตุผลแล้ว Member UI กลับเป็น Redacted ได้

---

# **70\. Handoff ให้ทีม UI Design**

ทีม UI ต้องส่งมอบ

* Sitemap  
* User Flow Diagram  
* Low-fidelity Wireframe  
* High-fidelity Design  
* Desktop Layout  
* Tablet Layout  
* Mobile Layout  
* Component Library  
* Form States  
* Status Badge System  
* Empty States  
* Error States  
* Loading States  
* Prototype Flow

หน้าที่ต้อง Prototype ก่อน

1. Register  
2. Login  
3. Dashboard  
4. Catalog  
5. Product Detail  
6. Add to Project  
7. Create Project  
8. Project Overview  
9. Project Item Management  
10. Product Schedule  
11. Custom Request

---

# **71\. Handoff ให้ Codex**

Codex ต้องพัฒนา Volume 1 แยกเป็น Sprint

## **Sprint A: Foundation and Authentication**

* Application Shell  
* Authentication  
* Registration  
* Pending Approval  
* Permission Guard

## **Sprint B: Member Foundation**

* Dashboard  
* Profile  
* Notifications  
* Customer Management

## **Sprint C: Catalog**

* Catalog Listing  
* Search  
* Filter  
* Product Detail  
* Options  
* Add to Project

## **Sprint D: Project**

* Project Creation  
* Project Overview  
* Area  
* Items  
* Status  
* Price Refresh

## **Sprint E: Product Schedule and Custom Request**

* PDF/Excel  
* Custom Form  
* File Upload  
* Quote Confirmation  
* Convert to Project Item

Codex ห้ามเริ่ม Order และ Payment ใน Volume 1 ยกเว้นสร้างปุ่มหรือสถานะเชื่อมต่อที่ยัง Disabled พร้อมข้อความว่าเป็นขั้นตอนถัดไป

---

# **72\. ข้อสรุป**

GISP UX/UI Volume 1 ต้องทำให้สมาชิกสามารถเดินทางจากผู้สนใจไปสู่ตัวแทนที่มี Project และรายการสินค้าพร้อมสั่งได้อย่างเป็นระบบ

เส้นทางหลักคือ

สมัครสมาชิก  
→ ได้รับอนุมัติ  
→ เข้าสู่ Dashboard  
→ ค้นหาสินค้า  
→ ดูรายละเอียด  
→ เลือกสเปก  
→ สร้าง Project  
→ แบ่งห้อง  
→ เพิ่มสินค้า  
→ จัดสถานะ  
→ ดาวน์โหลด Product Schedule  
→ เตรียมพร้อมสร้าง Order

หัวใจของ UX Volume 1 คือ

1. สมาชิกต้องเข้าใจสถานะบัญชี  
2. Catalog ต้องค้นหาและกรองง่าย  
3. Member Price ต้องชัดเจนแต่ต้นทุนต้องไม่ปรากฏ  
4. Product Options ต้องเป็นมาตรฐาน  
5. Project ต้องเป็นศูนย์กลาง  
6. สมาชิกต้องจัดสินค้าแยกตามพื้นที่ได้  
7. ระบบต้องช่วยตรวจความพร้อมก่อน Order  
8. Custom Request ต้องเริ่มได้จากหลายจุด  
9. Product Schedule ต้องใช้เสนอและตรวจรายการได้จริง  
10. ระบบต้องใช้งานได้ดีทั้ง Desktop, Tablet และ Mobile

เมื่อ Volume 1 เสร็จ สมาชิกจะมีรายการสินค้าใน Project ที่ถูกต้องและพร้อมส่งต่อไปยัง **GISP UX/UI Flow Specification Volume 2: Order, Payment, Production, QC, Logistics and Delivery**
