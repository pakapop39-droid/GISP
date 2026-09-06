# **GLOBAL INTERIOR SUPPLY PLATFORM**

## **GISP – UX/UI FLOW SPECIFICATION**

## **VOLUME 3 – PART A: PRODUCT & CATALOG MANAGEMENT**

**Document Version:** 2.0  
**Reconciled Date:** 1 สิงหาคม 2569 (2026-08-01)  
**Authority:** Admin Catalog Reference ภายใต้ `MVP BUSINESS MASTER PLAN.md` และ `DECISION LOG.md`  
**Document Type:** UX/UI Flow and Back-office Screen Specification  
**Project Stage:** Core MVP  
**Primary Platform:** Responsive Web Application  
**Primary Users:** Product Admin, Purchasing Admin, Catalog Reviewer, Finance Approver และ Super Admin  
**Primary Language:** ภาษาไทย  
**Initial Supplier Country:** ประเทศจีน

**Related Documents**

1. GISP – MVP Business Master Plan  
2. GISP – Database Schema Specification  
3. GISP – UX/UI Flow Specification Volume 1  
4. GISP – UX/UI Flow Specification Volume 2  

---

# **0\. RECONCILED ADMIN CONTRACT**

* Core MVP ทำ Supplier, Category, Product, Variant, Option, Media, Document, Factory Cost และ Member Price
* Member Price ไม่รวม VAT; Factory Cost/Margin/Internal Note เป็นข้อมูลลับ
* Publish ได้เมื่อข้อมูลขั้นต่ำครบและมี Active Member Price
* Action สำคัญใช้ Backend Guard และ Audit Log

---

# **1\. วัตถุประสงค์ของเอกสาร**

เอกสารฉบับนี้กำหนด UX/UI และ Workflow สำหรับการบริหารข้อมูลต้นน้ำของ GISP ได้แก่

* โรงงานและซัพพลายเออร์  
* ประเทศและสกุลเงิน  
* หมวดหมู่สินค้า  
* Collection  
* Product Master  
* Product Variant  
* Product Option  
* รูปภาพและวิดีโอ  
* เอกสารสินค้า  
* ราคาทุนโรงงาน  
* ราคาขายสมาชิก  
* Price Version  
* การอนุมัติราคา  
* การตรวจคุณภาพข้อมูลสินค้า  
* การ Publish และหยุดขาย  
* การ Import ข้อมูลจาก Excel/CSV  
* การรับข้อมูลจาก PDF Catalog  
* Catalog QA  
* การตรวจสอบประวัติการแก้ไข

ข้อมูลใน Part A เป็นข้อมูลต้นน้ำของระบบทั้งหมด หากข้อมูลสินค้า ราคา หรือ Option ผิด จะส่งผลต่อ

* Project  
* Product Schedule  
* Order  
* Supplier Order  
* Payment  
* Production  
* QC  
* Logistics  
* Margin  

ดังนั้น UX ฝั่ง Product Admin ต้องช่วยลดข้อผิดพลาด ตรวจสอบข้อมูลก่อน Publish และเก็บประวัติการเปลี่ยนแปลงทุกครั้ง

---

# **2\. ขอบเขตของ Part A**

## **2.1 Must Have สำหรับ MVP**

* Product & Catalog Dashboard  
* Supplier Management  
* Category Management  
* Collection Management  
* Product Listing  
* Create Product  
* Edit Product  
* Product Media  
* Product Documents  
* Product Options  
* Product Variants  
* Factory Cost  
* Member Price  
* Price Version  
* Price Approval  
* Publish Workflow  
* Suspend และ Discontinue  
* Excel/CSV Import  
* Data Validation  
* Catalog QA  
* Audit History

## **2.2 ไม่รวมใน Part A**

* การรับสมัครสมาชิก  
* Project ฝั่งสมาชิก  
* Order  
* Payment  
* Production  
* QC การผลิต  
* Shipment  
* Delivery  
* Executive Report  
* Role and Permission Setup เชิงลึก  
* System Configuration เชิงลึก

---

# **3\. เป้าหมาย UX**

ชื่อผู้ใช้ใน Part A เป็น Persona/Permission Profile ไม่ใช่ Production Role ใหม่ โดยต้อง Map ไปยัง
`PRODUCT_ADMIN`, `PURCHASING`, `FINANCE` หรือ `SUPER_ADMIN` ตาม DEC-035

ระบบต้องช่วยให้ Product Admin สามารถ

1. เพิ่มโรงงานใหม่ได้อย่างเป็นระบบ  
2. จัดโครงสร้างหมวดสินค้าได้โดยไม่ต้องแก้ Database  
3. เพิ่มสินค้าด้วยมือได้  
4. Import สินค้าจำนวนมากได้  
6. แยก Product Master กับ Variant ได้ถูกต้อง  
7. กำหนด Option มาตรฐานที่สมาชิกเลือกได้  
8. แยกราคาทุนกับราคาขายอย่างปลอดภัย  
9. ตรวจความพร้อมก่อน Publish ได้  
10. ป้องกันสินค้าซ้ำ  
11. ป้องกันราคาหมดอายุโดยไม่มีการแจ้งเตือน  
12. หยุดขายโดยไม่ทำลายข้อมูล Order เดิม  
13. ตรวจสอบว่าใครแก้ไขข้อมูลใดและเมื่อใด  
14. ทำงานกับสินค้าหลายร้อยหรือหลายพันรายการได้  
15. ลดการใช้ Excel แยกภายนอกในระยะยาว

---

# **4\. หลักการสำคัญของระบบ Catalog**

## **4.1 Admin-controlled Catalog**

โรงงานไม่มีบัญชีใน MVP

ข้อมูลทั้งหมดต้องผ่าน

โรงงานส่งข้อมูล  
→ ทีม GISP รับข้อมูล  
→ สร้าง Draft  
→ ตรวจสอบ  
→ กำหนดราคา  
→ อนุมัติ  
→ Publish

## **4.2 Draft First**

สินค้าใหม่ต้องเริ่มที่สถานะ `Draft`

ห้าม Publish อัตโนมัติทันทีจาก

* Excel  
* CSV  
* PDF  
* Copy Product

## **4.3 Separate Product, Variant and Option**

ระบบต้องแยกความหมายให้ชัดเจน

### **Product Master**

ตัวสินค้าโดยรวม เช่น โซฟารุ่น Milan

### **Variant**

รูปแบบสินค้าที่มี SKU หรือขนาดต่างกัน เช่น

* Milan Sofa 1800 mm  
* Milan Sofa 2200 mm  
* Milan Sofa 2600 mm

### **Option**

ตัวเลือกที่เปลี่ยนได้โดยไม่จำเป็นต้องเป็น SKU ใหม่ เช่น

* ผ้า F001  
* ผ้า F002  
* ขาโลหะ M101

ทีม Admin ต้องเห็นคำแนะนำว่าควรสร้างเป็น Variant หรือ Option

## **4.4 Source Traceability**

สินค้าจาก Catalog ต้องอ้างอิงได้ว่า

* มาจากไฟล์ใด  
* หน้าใด  
* เวอร์ชันใด  
* ใคร Import  
* ใครตรวจ  
* ใคร Publish

## **4.5 Price Versioning**

ราคาห้ามถูกเขียนทับ

การแก้ราคาต้องสร้าง Version ใหม่ พร้อม

* Effective Date  
* Currency  
* Exchange Rate  
* Approver  
* Reason

## **4.6 Historical Integrity**

การแก้ Product Master ห้ามเปลี่ยนข้อมูล Snapshot ใน Order เดิม

การ Discontinue สินค้าห้ามลบข้อมูลเดิม

---

# **5\. User Roles ใน Part A**

## **5.1 Product Viewer**

สามารถ

* ดูสินค้า  
* ดู Supplier  
* ดู Category  
* ดูสถานะ  
* ดูราคา Member ตาม Permission

ไม่สามารถแก้ไข

## **5.2 Catalog Editor**

สามารถ

* สร้าง Draft Product  
* แก้ข้อมูลสินค้า  
* อัปโหลด Media  
* เพิ่ม Option  
* เพิ่ม Variant  
* Import Excel  
* ส่งตรวจ

ไม่สามารถ

* อนุมัติราคาทุน  
* Publish หากไม่มี Permission  
* ลบ Product ที่มี Transaction

## **5.3 Product Admin**

สามารถ

* จัดการ Product  
* Category  
* Collection  
* Option  
* Variant  
* Publish  
* Suspend  
* Discontinue  
* Review Import

## **5.4 Purchasing Admin**

สามารถ

* จัดการ Supplier  
* Factory SKU  
* Factory Cost  
* MOQ  
* Lead Time  
* Supplier Documents  
* Price Source

## **5.5 Finance Approver**

สามารถ

* ดู Factory Cost  
* ตรวจ Exchange Rate  
* อนุมัติ Member Price  
* ตรวจ Margin  
* อนุมัติ Price Version

ไม่จำเป็นต้องแก้ Content สินค้า

## **5.6 Catalog Reviewer**

สามารถ

* ตรวจ Draft  
* ตรวจความครบถ้วน  
* เปรียบเทียบต้นฉบับ  
* Reject พร้อมเหตุผล  
* ส่งกลับแก้ไข  
* อนุมัติข้อมูลก่อน Publish

## **5.7 Super Admin**

เข้าถึงทั้งหมด รวม Override โดยต้องมีเหตุผลและ Audit Log

---

# **6\. Admin Information Architecture**

Catalog Dashboard

Suppliers  
├── Supplier List  
├── Contacts  
├── Commercial Terms  
├── Documents  
├── Collections  
└── Products

Catalog  
├── Products  
├── Product Drafts  
├── Categories  
├── Collections  
├── Tags  
├── Option Groups  
├── Option Values  
├── Samples  
└── Archived Products

Pricing  
├── Factory Cost  
├── Member Price  
├── Price Approval  
├── Price History  
├── Price Expiry  
└── Exchange Rates

Imports  
├── Excel/CSV Import  
├── Source Documents  
├── Product Draft Review  
├── Import Errors  
└── Import History

Catalog QA  
├── Missing Data  
├── Duplicate Products  
├── Broken Media  
├── Invalid Prices  
├── Expired Prices  
└── Publish Review

---

# **7\. URL Structure**

/admin/catalog/dashboard

/admin/suppliers  
/admin/suppliers/new  
/admin/suppliers/\[supplierId\]  
/admin/suppliers/\[supplierId\]/documents  
/admin/suppliers/\[supplierId\]/products  
/admin/suppliers/\[supplierId\]/collections

/admin/catalog/products  
/admin/catalog/products/new  
/admin/catalog/products/\[productId\]  
/admin/catalog/products/\[productId\]/edit  
/admin/catalog/products/\[productId\]/media  
/admin/catalog/products/\[productId\]/documents  
/admin/catalog/products/\[productId\]/variants  
/admin/catalog/products/\[productId\]/options  
/admin/catalog/products/\[productId\]/prices  
/admin/catalog/products/\[productId\]/history

/admin/catalog/categories  
/admin/catalog/collections  
/admin/catalog/tags  
/admin/catalog/options  
/admin/catalog/samples

/admin/catalog/imports  
/admin/catalog/imports/new  
/admin/catalog/imports/\[importId\]  
/admin/catalog/source-documents  
/admin/catalog/source-documents/\[documentId\]  

/admin/catalog/qa  
/admin/catalog/price-approvals  
/admin/catalog/publish-review

---

# **8\. Screen Inventory**

## **Dashboard และ Supplier**

1. Catalog Dashboard  
2. Supplier Listing  
3. Create Supplier  
4. Edit Supplier  
5. Supplier Contacts  
6. Supplier Commercial Terms  
7. Supplier Documents  
8. Supplier Product Summary  
9. Suspend Supplier

## **Taxonomy**

10. Category Management  
11. Create Category  
12. Category Tree  
13. Collection Listing  
14. Create Collection  
15. Tag Management  
16. Option Group Listing  
17. Create Option Group  
18. Option Value Management  
19. Sample Location Management

## **Product**

20. Product Listing  
21. Product Quick View  
22. Create Product – Basic Information  
23. Create Product – Classification  
24. Create Product – Specification  
25. Create Product – Variant  
26. Create Product – Options  
27. Create Product – Media  
28. Create Product – Pricing  
29. Create Product – Review  
30. Edit Product  
31. Product Media Manager  
32. Product Document Manager  
33. Product Variant Manager  
34. Product Option Manager  
35. Related Product Manager  
36. Copy Product  
37. Suspend Product  
38. Discontinue Product  
39. Archive Product

## **Pricing**

40. Product Price Overview  
41. Create Factory Cost Version  
42. Create Member Price Version  
43. Price Calculator  
44. Price Approval Queue  
45. Price History  
46. Expiring Price List  
47. Bulk Price Update

## **Import**

48. Import Center  
49. Upload Excel/CSV  
50. Column Mapping  
51. Import Validation  
52. Import Preview  
53. Import Result  
54. Import Error Review  
55. Duplicate Review  

## **Publish และ QA**

56. Product Readiness Checklist  
57. Submit for Review  
58. Publish Review Queue  
59. Publish Confirmation  
60. Reject and Return  
61. Catalog QA Dashboard  
62. Missing Data Report  
63. Invalid Price Report  
64. Broken Media Report  
65. Duplicate Product Report  
66. Audit History

รวมประมาณ 66 หน้าจอและสถานะหลัก

---

# **9\. Admin Application Shell**

## **Desktop Layout**

┌────────────────────────────────────────────────────────────┐  
│ Product Admin | Global Search | Action Required | Alerts  │  
├─────────────────┬──────────────────────────────────────────┤  
│ Dashboard       │                                          │  
│ Products        │                                          │  
│ Categories      │                                          │  
│ Options         │                                          │  
│ Pricing         │                                          │  
│ Imports         │                                          │  
│ Catalog QA      │                                          │  
│ Reports         │                                          │  
│ Settings        │                                          │  
└─────────────────┴──────────────────────────────────────────┘

## **UX Principle**

Admin Interface เน้น Desktop แต่ต้องรองรับ Tablet สำหรับ

* ตรวจสินค้า  
* Approve ราคา  
* ดู Draft  
* Upload ภาพ  
* ตรวจ Catalog

การสร้าง Product ที่มีข้อมูลจำนวนมากไม่จำเป็นต้องเหมาะกับ Mobile เต็มรูปแบบ แต่ Mobile ต้องดูข้อมูลและอนุมัติงานเร่งด่วนได้

---

# **10\. Catalog Dashboard**

## **Screen ID**

`CATADM-001`

## **Route**

`/admin/catalog/dashboard`

## **Purpose**

แสดงสุขภาพของ Catalog และงานที่ต้องดำเนินการ

## **KPI Cards**

* Products ทั้งหมด  
* Active Products  
* Draft Products  
* รอตรวจ  
* รอ Publish  
* Suspended  
* Discontinued  
* Products ไม่มีราคา Active  
* ราคากำลังหมดอายุ  
* Import Error  
* Product ข้อมูลไม่ครบ

## **Action Required**

เรียงตามความสำคัญ

1. Product Active แต่ไม่มี Member Price  
2. ราคาหมดอายุ  
3. Product Orderable แต่ Option ไม่ครบ  
4. Draft รอ Review  
5. Import มี Error  
6. Media เสีย  
7. Duplicate ที่ต้องตรวจ  
8. Supplier ถูกระงับแต่ Product ยัง Active

## **Dashboard Charts**

MVP ใช้กราฟพื้นฐาน

* Products by Category  
* Products by Supplier  
* Products by Status  
* Draft Aging  
* Price Expiry Timeline

## **Quick Actions**

* เพิ่มสินค้า  
* เพิ่ม Supplier  
* Import Excel  
* ตรวจ Draft  
* อนุมัติราคา

---

# **11\. Supplier Listing**

## **Screen ID**

`SUP-001`

## **Route**

`/admin/suppliers`

## **Columns**

* Supplier Code  
* Supplier Name  
* Country  
* Supplier Type  
* Currency  
* Product Count  
* Active Products  
* Default Lead Time  
* Status  
* Updated Date  
* Assigned Buyer  
* Action

## **Filters**

* Country  
* Supplier Type  
* Category  
* Currency  
* Status  
* Assigned Buyer  
* Has Active Products  
* Has Expired Documents

## **Search**

* Supplier Code  
* Supplier Name  
* Local Name  
* Contact  
* WeChat  

## **Actions**

* View  
* Edit  
* Add Product  
* Add Collection  
* Upload Document  
* Suspend

---

# **12\. Create Supplier**

## **Screen ID**

`SUP-002`

## **Route**

`/admin/suppliers/new`

ใช้ Form แบ่ง Section หรือ Step Form

### **Step 1: Identity**

* Supplier Code  
* Supplier Name English  
* Supplier Name Local  
* Country  
* Supplier Type  
* Status

### **Step 2: Contact**

* Contact Person  
* Position  
* Phone  
* WeChat  
* Address

### **Step 3: Commercial Terms**

* Default Currency  
* Deposit Percentage  
* Balance Percentage  
* Standard Lead Time  
* MOQ Policy  
* Warranty  

### **Step 4: Documents**

* Factory Profile  
* Catalog  
* Price List  
* Agreement  
* Certificate

### **Step 5: Review**

แสดงสรุปก่อนสร้าง

## **Validation**

* Supplier Code ไม่ซ้ำ  
* Supplier Name English จำเป็น  
* Country จำเป็น  
* Currency จำเป็น  
* Deposit \+ Balance ต้องเท่ากับ 100 หากใช้สองงวด  
* Suspended Supplier ไม่ควรตั้งเป็นค่าเริ่มต้นเมื่อสร้างใหม่

---


## **Screen ID**

`SUP-003`

## **Header**

* Supplier Name  
* Supplier Code  
* Country  
* Type  
* Status  
* Assigned Buyer  
* Edit  
* Add Product  
* More Actions

## **Tabs**

1. Overview  
2. Products  
3. Collections  
4. Contacts  
5. Commercial Terms  
6. Documents  
7. Price Sources  
8. Activity

## **Overview**

* Active Product Count  
* Draft Count  
* Discontinued Count  
* Current Price List  
* Price Updated Date  
* Standard Lead Time  
* Open Supplier Orders ในอนาคต  
* Data Quality Score

## **Alerts**

* Price list หมดอายุ  
* Agreement หมดอายุ  
* Product ไม่มี Member Price  
* Supplier Suspended  
* Contact ขาดข้อมูล

---

# **13\. Supplier Contacts**

## **Screen ID**

`SUP-004`

รองรับหลาย Contact

Fields

* Name  
* Position  
* Department  
* Phone  
* WeChat  
* Language  
* Primary Contact  
* Note  
* Confidential

## **Business Rule**

Member ไม่เห็น Contact โรงงานโดยตรง เว้นแต่นโยบายอนุญาต

---

# **14\. Supplier Commercial Terms**

## **Screen ID**

`SUP-005`

ข้อมูล

* Currency  
* Default Payment Terms  
* Deposit %  
* Balance %  
* MOQ Policy  
* Lead Time  
* Incoterm ในอนาคต  
* Warranty  
* Packaging Terms  
* Effective Date  
* Internal Note

การแก้เงื่อนไขไม่ควรเปลี่ยน Supplier Order เดิม

---

# **15\. Supplier Documents**

## **Screen ID**

`SUP-006`

Document Types

* Catalog  
* Price List  
* Agreement  
* Certificate  
* Warranty  
* Factory Profile  
* Packaging Standard  
* Other

Columns

* Name  
* Type  
* Version  
* Effective Date  
* Expiry Date  
* Confidential  
* Uploaded By  
* Status

Actions

* Preview  
* Download  
* Replace with New Version  
* Archive

## **Rule**

การ Replace ต้องไม่ลบ Version เดิม

---

# **16\. Suspend Supplier**

## **Screen ID**

`SUP-007`

ก่อน Suspend ต้องแสดงผลกระทบ

* จำนวน Active Products  
* Draft Products  
* Open Project Items  
* Open Orders  
* Supplier Orders ที่กำลังดำเนินการ

Options

* ระงับการสร้างสินค้าใหม่  
* หยุดรับออเดอร์ใหม่  
* Suspend Products ทั้งหมด  
* คง Orders เดิมให้ดำเนินการต่อ

Fields

* Reason  
* Effective Date  
* Member-visible Message  
* Internal Note

การ Suspend ต้องมี Confirmation และ Audit Log

---

# **17\. Category Management**

## **Screen ID**

`TAX-001`

## **Route**

`/admin/catalog/categories`

ใช้ Tree View

Furniture  
├── Seating  
│   ├── Sofa  
├── Table  
└── Storage

## **Components**

* Search Category  
* Expand/Collapse  
* Add Root Category  
* Add Child  
* Edit  
* Reorder  
* Activate/Deactivate  
* Product Count

## **Business Rules**

* Category ที่มี Product ห้ามลบถาวร  
* ใช้ Deactivate หรือ Merge  
* Category Code ไม่ซ้ำ  
* ห้ามสร้าง Circular Parent  
* Level ไม่ควรลึกเกินที่กำหนดใน MVP เช่น 4 ระดับ

---

# **18\. Create/Edit Category**

## **Screen ID**

`TAX-002`

Fields

* Parent Category  
* Category Code  
* Name English  
* Name Chinese  
* Description  
* Display Order  
* Active  

## **Merge Category**

หากต้องรวมหมวด

* เลือก Source  
* เลือก Destination  
* แสดง Product Count  
* Preview ผลกระทบ  
* Confirm

---

# **19\. Collection Management**

## **Screen ID**

`TAX-003`

Collection ต้องผูก Supplier

Columns

* Collection Code  
* Collection Name  
* Supplier  
* Product Count  
* Active  
* Launch Date  
* Status

Actions

* Create  
* Edit  
* View Products  
* Deactivate

Collection ที่ถูก Deactivate ไม่ทำให้ Product ถูกปิดขายอัตโนมัติ เว้นแต่ Admin เลือก

---

# **20\. Tag Management**

## **Screen ID**

`TAX-004`

Tag Types

* Style  
* Room  
* Material  
* Feature  
* Trend  
* Usage  
* Marketing

Functions

* Add  
* Edit  
* Merge  
* Deactivate  
* See Usage Count

ควรป้องกัน Tag ซ้ำ เช่น

* Minimal  
* minimal  
* มินิมอล

ระบบควรเสนอ Merge

---

# **21\. Option Group Listing**

## **Screen ID**

`OPT-001`

Option Groups ตัวอย่าง

* Fabric  
* Leather  
* Wood Finish  
* Stone  
* Metal Finish  
* Size  
* Handle  
* Hardware  
* Accessories

Columns

* Code  
* Name  
* Selection Type  
* Required Default  
* Value Count  
* Product Usage  
* Active

---

# **22\. Create Option Group**

## **Screen ID**

`OPT-002`

Fields

* Option Group Code  
* Name English  
* Name Chinese  
* Selection Type  
* Default Required  
* Display Type  
* Sort Order  
* Active

Selection Type

* Single  
* Multiple  
* Informational

Display Type

* Swatch  
* Image Card  
* Radio Card  
* Dropdown  
* Checkbox  
* Text Display

---

# **23\. Option Value Management**

## **Screen ID**

`OPT-003`

แสดงค่าภายใน Option Group

ตัวอย่าง Fabric

* F001  
* F002  
* F003

Columns

* Code  
* Name  
* Image  
* Color  
* Material  
* Standard  
* Product Usage  
* Active

Actions

* Add  
* Edit  
* Duplicate  
* Deactivate  
* View Used Products

## **Important Rule**

Option Value ที่ใช้ใน Order แล้วห้ามลบถาวร

---

# **24\. Create Option Value**

## **Screen ID**

`OPT-004`

Fields

* Option Code  
* Name English  
* Name Chinese  
* Image  
* Color Hex  
* Material Description  
* Standard/Upgrade  
* Default Price Adjustment  
* Active  
* Sample Reference  
* Internal Note

ราคาที่ Product ใช้จริงสามารถ Override ใน Product Option Manager

---

# **25\. Product Listing**

## **Screen ID**

`PRDADM-001`

## **Route**

`/admin/catalog/products`

## **Table Columns**

* Checkbox  
* Product Code  
* Factory SKU  
* Product Name  
* Supplier  
* Category  
* Product Type  
* Variants  
* Member Price  
* Factory Cost ตาม Permission  
* Margin ตาม Permission  
* Lead Time  
* Sales Status  
* Data Quality  
* Updated Date  
* Updated By  
* Actions

## **Filters**

* Supplier  
* Country  
* Category  
* Collection  
* Product Type  
* Sales Status  
* Orderable  
* Has Price  
* Price Expiry  
* Data Quality  
* Has Image  
* Has Required Options  
* Import Source  
* Updated By  
* Updated Date

## **Bulk Actions**

* Assign Category  
* Assign Collection  
* Add Tag  
* Set Status  
* Submit Review  
* Export  
* Bulk Price Update  
* Archive Draft

Bulk Publish ควรจำกัดและมี Validation

---

# **26\. Product Quick View**

## **Screen ID**

`PRDADM-002`

Drawer แสดง

* Product Code  
* Factory SKU  
* Name  
* Supplier  
* Category  
* Dimensions  
* Variants  
* Options  
* Factory Cost  
* Member Price  
* Status  
* Data Quality  
* Open Product

ใช้เพื่อ Review เร็วจาก Listing

---

# **27\. Create Product Workflow**

แนะนำเป็น 8 Steps

1 ข้อมูลหลัก  
→ 2 การจัดหมวด  
→ 3 สเปกและขนาด  
→ 4 Variant  
→ 5 Option  
→ 6 Media และเอกสาร  
→ 7 ราคา  
→ 8 ตรวจสอบ

มี

* Save Draft  
* Next  
* Previous  
* Exit with Save  
* Completion Indicator  
* Validation Summary

---

# **28\. Create Product Step 1: Basic Information**

## **Screen ID**

`PRDADM-003`

Fields

* Product Code  
* Supplier  
* Factory SKU  
* Product Type  
* Name English  
* Name Chinese  
* Full Description  
* Source Document  
* Source Page  
* Internal Note

Product Type

* Standard  
* Custom Base  
* Built-in  
* Material  
* Equipment  
* Decorative Item  
* Sample Product

## **Validation**

* Product Code ไม่ซ้ำ  
* Supplier จำเป็น  
* Factory SKU ซ้ำใน Supplier เดียวกันต้องเตือน  
* Source Page ต้องอยู่ในจำนวนหน้าของเอกสาร

---

# **29\. Step 2: Classification**

## **Screen ID**

`PRDADM-004`

Fields

* Subcategory  
* Collection  
* Tags  
* Country of Origin  
* Application Area  
* Suitable Room  
* Indoor/Outdoor  
* Style

แสดง Category Path

> Furniture \> Seating \> Sofa

---

# **30\. Step 3: Specification and Dimensions**

## **Screen ID**

`PRDADM-005`

Fields

* Surface Material  
* Width mm  
* Depth mm  
* Height mm  
* Weight kg  
* CBM  
* MOQ  
* MOQ Unit  
* Lead Time Days  
* Warranty  
* Packing Description  
* Installation Note  
* Limitations  
* Certificates

## **Dimension UX**

แสดงลำดับชัดเจน

W × D × H  
กว้าง × ลึก × สูง

ใช้หน่วย mm เป็นมาตรฐาน

หากต้นฉบับเป็น cm ให้ระบบ Import แปลงเป็น mm แต่เก็บ Source Text ไว้เพื่อตรวจสอบใน Import Metadata

## **Unknown Data**

Admin เลือก

* ไม่พบในต้นฉบับ  
* ไม่เกี่ยวข้อง  
* รอยืนยันจากโรงงาน

ห้ามใช้เลข 0 แทน “ไม่พบ”

---

# **31\. Step 4: Variant**

## **Screen ID**

`PRDADM-006`

ระบบถามก่อน

> สินค้านี้มีหลาย SKU หรือขนาดที่มีราคาแตกต่างกันหรือไม่?

หากไม่มี

* ใช้ Standard Product เดียว

หากมี

* เปิด Variant Table

Columns

* Variant Code  
* Factory Variant SKU  
* Variant Name  
* W  
* D  
* H  
* Weight  
* CBM  
* Lead Time  
* Active

# **32\. Step 5: Product Options**

## **Screen ID**

`PRDADM-007`

Flow

1. Add Option Group  
2. Set Required  
3. Select Allowed Values  
4. Select Default Value  
5. Set Price Adjustment  
6. Set Lead Time Adjustment  

## **Product Option Table**

* Group  
* Value  
* Code  
* Default  
* Additional Factory Cost  
* Additional Member Price  
* Lead Time Adjustment  
* Sample

## **Validation**

* Default Value ต้องอยู่ใน Allowed Values  
* Single Selection มี Default ได้หนึ่งค่า  
* Additional Price ต้องใช้ Decimal  
* Cost Field แสดงตาม Permission

---

# **33\. Step 6: Media and Documents**

## **Screen ID**

`PRDADM-008`

Media Roles

* Gallery  
* Lifestyle  
* Dimension Drawing  
* Material Swatch  
* Packing  
* Video

Functions

* Drag and Drop  
* Multi-upload  
* Reorder  
* Crop  
* Add Alt Text  
* Assign Variant  
* Archive

Documents

* Technical Sheet  
* Catalog Page  
* Certificate  
* Installation Guide  
* Warranty  
* CAD  
* Other

## **Publish Requirement**


---

# **34\. Step 7: Pricing**

## **Screen ID**

`PRDADM-009`

แยก Section ชัดเจน

### **Factory Cost — Confidential**

* Product/Variant  
* Amount  
* Currency  
* Effective Date  
* Source Price List  
* Exchange Rate  
* THB Equivalent  
* MOQ  
* Internal Note

### **Member Price**

* Price Tier  
* Amount  
* Currency  
* Effective Date  
* Expiry Date  
* Price Note  
* Approval Status

### **Margin Preview**

สำหรับผู้มีสิทธิ์

* Member Price  
* Factory Cost Converted  
* Gross Margin Amount  
* Gross Margin %  
* Warning Threshold

## **Security**

Catalog Editor ที่ไม่มี Cost Permission ต้องไม่เห็นค่าทุน แม้ผ่าน Browser Developer Tools

---

# **35\. Step 8: Review**

## **Screen ID**

`PRDADM-010`

แสดง Checklist

* Basic Information  
* Supplier  
* Category  
* Dimensions  
* Required Options  
* Factory Cost  
* Member Price  
* Lead Time  
* MOQ  
* Source Reference  
* Member-visible Content  
* Confidential Content

Status

* Complete  
* Warning  
* Blocking Error

Actions

* Save Draft  
* Submit for Review  
* Publish หากมีสิทธิ์และผ่านทุกกฎ

---


## **Screen ID**

`PRDADM-011`

## **Header**

* Product Image  
* Product Name  
* Product Code  
* Factory SKU  
* Supplier  
* Sales Status  
* Data Quality Score  
* Edit  
* Submit Review  
* Publish  
* More Actions

## **Tabs**

1. Overview  
2. Variants  
3. Options  
4. Media  
5. Documents  
6. Prices  
7. Source  
8. Member Preview  
9. History

## **Overview**

* Classification  
* Dimensions  
* Materials  
* Lead Time  
* MOQ  
* Warranty  
* Packing  
* Orderability  
* Current Active Price  
* Data Alerts

---

# **36\. Member Preview**

## **Screen ID**

`PRDADM-012`

จำลองสิ่งที่สมาชิกเห็น

* Member Price  
* Options  
* Documents  
* Remarks  
* Add to Project State

มี Toggle

* Desktop  
* Tablet  
* Mobile  
* Approved Member  
* Pending Member Preview

ช่วยตรวจว่า Factory Cost หรือ Internal Note ไม่หลุด

---

# **37\. Edit Product**

## **Screen ID**

`PRDADM-013`

เมื่อแก้ Product Active ต้องแสดงผลกระทบ

* Project Items ที่ยังไม่ Order  
* Active Orders ไม่ถูกเปลี่ยนเพราะ Snapshot  
* Related Variants  
* Related Options

การแก้ข้อมูลสำคัญต้องมี Change Reason

ข้อมูลสำคัญ ได้แก่

* Product Code  
* Supplier  
* Factory SKU  
* Dimensions  
* Material  
* Required Options  
* Sales Status

---

# **38\. Product Media Manager**

## **Screen ID**

`PRDADM-014`

Features

* Grid/List  
* Reorder  
* Replace  
* Assign Role  
* Assign Variant  
* Alt Text  
* Download  
* Archive  
* Broken File Indicator  
* Duplicate Image Detection ในอนาคต

## **Rule**


---

# **39\. Product Document Manager**

## **Screen ID**

`PRDADM-015`

Columns

* Document Name  
* Type  
* Version  
* Member Visible  
* Confidential  
* Effective Date  
* Expiry Date  
* Source  
* Status

การเปลี่ยน Member Visibility ต้องมี Preview และ Confirmation

---

# **40\. Product Variant Manager**

## **Screen ID**

`PRDADM-016`

Functions

* Add Variant  
* Edit  
* Duplicate  
* Deactivate  
* Reorder  
* Bulk Dimensions  
* Assign Media  
* Assign Price

## **Business Rule**

Variant ที่มี Order History ห้ามลบ

ใช้ `Inactive`

Product ต้องมีอย่างน้อยหนึ่ง Active Variant หากใช้ Variant Model

---

# **41\. Product Option Manager**

## **Screen ID**

`PRDADM-017`

แสดง Option Group เป็น Accordion

ภายในมี

* Allowed Values  
* Default  
* Required  
* Cost Adjustment  
* Member Price Adjustment  
* Lead Time  
* Sample

## **Conflict Warning**

ตัวอย่าง

> Option F003 ไม่สามารถใช้กับ Variant V2600

MVP อาจยังไม่ทำ Option Compatibility Matrix เต็มรูปแบบ แต่ต้องมีช่อง Note หรือ Restriction

---

# **42\. Copy Product**

## **Screen ID**

`PRDADM-018`

ใช้เมื่อสินค้าคล้ายกัน

เลือกว่าจะ Copy

* Basic Information  
* Category  
* Specification  
* Options  
* Media  
* Documents  
* Variants  
* Prices

ค่าเริ่มต้นไม่ Copy

* Product Code  
* Factory SKU  
* Active Price  
* Publish Status  
* Audit History

Product ใหม่ต้องเป็น Draft

---

# **43\. Suspend Product**

## **Screen ID**

`PRDADM-019`

ใช้ชั่วคราว เช่น

* รอยืนยันราคา  
* Option ขาด  
* Supplier หยุดรับออเดอร์  
* ข้อมูลผิด

แสดงผลกระทบ

* Project Items ที่ยังไม่ Order  
* Member Favorites  
* Open Custom Requests  
* Existing Orders ไม่ได้รับผล

Fields

* Reason  
* Member-visible Message  
* Effective Time  
* Expected Resume Date

---

# **44\. Discontinue Product**

## **Screen ID**

`PRDADM-020`

ใช้เมื่อหยุดขายถาวร

ต้องแสดง

* Product History  
* Existing Orders  
* Projects ที่ยังมี Item  
* Suggested Replacement Products

Options

* Disable New Project Addition  
* Keep Member View for Existing Projects  
* Show Replacement Products  
* Archive Media หรือคงไว้

Discontinue ไม่ใช่ Delete

---

# **45\. Product Price Overview**

## **Screen ID**

`PRICE-001`

## **Route**

`/admin/catalog/products/[productId]/prices`

แสดงแยก

### **Factory Costs**

* Version  
* Amount  
* Currency  
* Exchange Rate  
* THB Equivalent  
* Effective Dates  
* Source  
* Status

### **Member Prices**

* Tier  
* Amount  
* Currency  
* Effective Dates  
* Approval  
* Status

### **Margin**

* Current Margin  
* Margin History  
* Threshold Warning

---

# **46\. Create Factory Cost Version**

## **Screen ID**

`PRICE-002`

Fields

* Product/Variant  
* Amount  
* Currency  
* Effective From  
* Effective To  
* Exchange Rate  
* Amount THB  
* Price List Source  
* Source Page/Row  
* Reason  
* Note  
* Attachment

## **Rule**

* ห้ามแก้ Active Version โดยตรง  
* สร้าง Version ใหม่  
* Version ก่อนหน้าถูกปิดตาม Effective Date  
* การ Backdate ต้องมี Permission

---

# **47\. Create Member Price Version**

## **Screen ID**

`PRICE-003`

Fields

* Product/Variant  
* Price Tier  
* Amount  
* Currency  
* Effective From  
* Effective To  
* Price Note  
* Approval Required  
* Reason

แสดง Preview

* Factory Cost  
* Member Price  
* Margin  
* Margin %  
* Minimum Margin Warning

## **Business Rule**

ราคาขายสมาชิกอาจเป็น THB แม้ต้นทุนเป็น CNY

ต้องบันทึก Exchange Rate ที่ใช้ในการวิเคราะห์ราคา แต่สมาชิกเห็นเฉพาะราคาขาย

---

# **48\. Price Calculator**

## **Screen ID**

`PRICE-004`

เป็นเครื่องมือช่วยคำนวณ ไม่ใช่แหล่งข้อมูลสุดท้ายจนกว่าจะ Save

Inputs

* Factory Cost  
* Currency  
* Exchange Rate  
* China Charges Estimate  
* Import Factor  
* Platform Markup  
* Target Margin  
* Rounding Rule

Outputs

* Suggested Member Price  
* Gross Margin  
* Margin %  
* Sensitivity เมื่อ Exchange Rate เปลี่ยน

MVP สามารถเริ่มแบบง่าย

* Factory Cost  
* Exchange Rate  
* Markup %  
* Suggested Member Price

ผลลัพธ์ต้องให้ Admin ยืนยัน ไม่ Save อัตโนมัติ

---

# **49\. Price Approval Queue**

## **Screen ID**

`PRICE-005`

รายการราคาที่รออนุมัติ

Columns

* Product  
* Supplier  
* Current Price  
* Proposed Price  
* Change %  
* Factory Cost  
* Margin  
* Effective Date  
* Submitted By  
* Risk Flag

Filters

* Supplier  
* Price Tier  
* Increase/Decrease  
* Margin Below Threshold  
* Effective Date  
* Submitted By

---


## **Screen ID**

`PRICE-006`

แสดง

* Product  
* Current Version  
* Proposed Version  
* Factory Cost  
* Exchange Rate  
* Margin  
* Change Reason  
* Source Document  
* Impacted Project Items  
* Existing Orders ไม่เปลี่ยน

Actions

* Approve  
* Reject  
* Return for Correction  
* Schedule Effective Date

Reject ต้องมี Reason

---

# **50\. Price History**

## **Screen ID**

`PRICE-007`

Timeline หรือ Table

* Version  
* Amount  
* Currency  
* Effective Range  
* Status  
* Approved By  
* Created By  
* Reason  
* Related Source


---

# **51\. Expiring Price List**

## **Screen ID**

`PRICE-008`

แสดง

* Expiring in 7 Days  
* 30 Days  
* Expired  
* No Expiry but Stale

Columns

* Product  
* Supplier  
* Current Price  
* Expiry Date  
* Last Verified  
* Owner  
* Action

Actions

* Extend  
* Create New Version  
* Suspend Product  
* Request Updated Price

---

# **52\. Bulk Price Update**

## **Screen ID**

`PRICE-009`

ใช้สำหรับ Import Price List

Flow

เลือก Supplier  
→ Upload File  
→ Map SKU  
→ Validate  
→ Preview Changes  
→ Submit Approval

Preview แยก

* New Price  
* Increased  
* Decreased  
* Unchanged  
* SKU Not Found  
* Duplicate SKU  
* Missing Currency

Bulk Update ห้าม Publish ราคาโดยข้าม Approval หากนโยบายต้องอนุมัติ

---

# **53\. Import Center**

## **Screen ID**

`IMP-001`

## **Route**

`/admin/catalog/imports`

Cards

* New Excel/CSV Import  
* Import Errors  
* Import History

Summary

* Running Jobs  
* Products Created  
* Products Updated  
* Duplicate Alerts

---

# **54\. Excel/CSV Upload**

## **Screen ID**

`IMP-002`

Fields

* Supplier  
* Import Type  
* File  
* Language  
* Currency  
* Default Category  
* Update Existing หรือ Create New  
* Match Key

Import Types

* New Products  
* Update Products  
* Prices  
* Options  
* Variants

Match Keys

* Product Code  
* Supplier \+ Factory SKU  
* Variant SKU

---

# **55\. Column Mapping**

## **Screen ID**

`IMP-003`

แสดง

| Source Column | Sample Data | Target Field | Required | Status |
| :---: | :---: | :---: | :---: | :---: |

ระบบเสนอ Mapping อัตโนมัติ แต่ Admin ต้องตรวจ

ตัวอย่าง

* 型号 → Factory SKU  
* 尺寸 → Original Size Text  
* 单价 → Factory Cost  
* 材质 → Material

## **Data Transformation**

Admin กำหนด

* Trim Text  
* Convert cm to mm  
* Split W×D×H  
* Currency  
* Boolean Mapping  
* Category Mapping

ต้อง Preview Transformation

---

# **56\. Import Validation**

## **Screen ID**

`IMP-004`

แบ่งผล

* Valid  
* Warning  
* Error  
* Duplicate  
* Needs Review

ตัวอย่าง Error

* ไม่มี Supplier  
* ไม่มี Product Name  
* SKU ซ้ำ  
* ราคาไม่ใช่ตัวเลข  
* หน่วยไม่ทราบ  
* ขนาด Parse ไม่ได้  
* Category ไม่ตรง  
* Currency ไม่รองรับ

Admin ดาวน์โหลด Error File ได้

---

# **57\. Import Preview**

## **Screen ID**

`IMP-005`

Preview ก่อน Commit

แสดง

* จำนวนที่จะสร้าง  
* จำนวนที่จะอัปเดต  
* จำนวนข้าม  
* จำนวนผิดพลาด  
* Field Changes

สำหรับ Update Existing ต้องแสดง

* Old Value  
* New Value

Actions

* Back to Mapping  
* Import Valid Rows Only  
* Cancel  
* Confirm Import

ข้อมูลที่ Import ต้องเป็น Draft

---

# **58\. Import Result**

## **Screen ID**

`IMP-006`

แสดง

* Job Number  
* Completed Time  
* Created  
* Updated  
* Skipped  
* Drafts Created  
* Download Report

Actions

* Review Drafts  
* Review Errors  
* Start New Import

---

# **59\. Product Readiness Checklist**

## **Screen ID**

`PUB-001`

ใช้ก่อน Submit Review หรือ Publish

## **Blocking Requirements**

* Product Code  
* Supplier  
* Category  
* Product Type  
* Active Member Price  
* Currency  
* Lead Time หรือเหตุผลไม่ระบุ  
* Required Option มี Value  
* Source Reference สำหรับ Imported Product  
* Sales Status ไม่ขัดแย้ง  
* Supplier Active

## **Warnings**

* ไม่มี Name English  
* ไม่มี Name Chinese  
* ไม่มี Weight  
* ไม่มี CBM  
* ไม่มี Warranty  
* ไม่มี Dimension Drawing  
* ไม่มี Showroom Sample

Warning ไม่จำเป็นต้อง Block ทุกกรณี

---

# **60\. Submit for Review**

## **Screen ID**

`PUB-002`

แสดง

* Readiness Score  
* Blocking Errors  
* Warnings  
* Reviewer  
* Review Note  
* Requested Publish Date

Primary

`ส่งตรวจ`

หลังส่ง

* Editor แก้ไม่ได้บาง Field หรือสร้าง Revision  
* Reviewer ได้ Notification

---

# **61\. Publish Review Queue**

## **Screen ID**

`PUB-003`

Columns

* Product  
* Supplier  
* Category  
* Submitted By  
* Submitted Date  
* Readiness  
* Price Status  
* Risk Flags  
* Reviewer  

Filters

* Supplier  
* Category  
* Risk  
* Price  
* Reviewer  

---


## **Screen ID**

`PUB-004`

Reviewer เห็น

* Member Preview  
* Source  
* Price  
* Margin ตาม Permission  
* Option Completeness  
* Media  
* Documents  
* Change History  
* Checklist


---

# **62\. Publish Decision**

Actions

### **Approve and Publish**

* Publish Now  
* Schedule Publish

### **Approve as Non-orderable**

ใช้กรณีแสดง Catalog แต่ยังไม่เปิดสั่ง

### **Return for Correction**

ต้องระบุ Field และเหตุผล

### **Reject**

ใช้เมื่อสินค้าไม่ควรเข้าระบบ

---

# **63\. Publish Confirmation**

## **Screen ID**

`PUB-005`

Dialog แสดง

* Product  
* Member Price  
* Effective Date  
* Orderable Status  
* Member Preview Link

Confirmation Text

> เมื่อ Publish แล้ว สมาชิกที่ได้รับอนุมัติจะสามารถเห็นสินค้าและราคาสมาชิกตามสิทธิ์ที่กำหนด

หลัง Publish

* `sales_status = active`  
* `published_at`  
* Audit Log  
* Search Index Update  
* Notification ภายในตามนโยบาย

---

# **64\. Return for Correction**

## **Screen ID**

`PUB-006`

Reviewer เลือก

* Basic Information  
* Category  
* Specification  
* Variant  
* Option  
* Media  
* Document  
* Price  
* Source  
* Other

ใส่ Comment

Status กลับเป็น `Needs Correction`

Editor เห็น Action Required

---

# **65\. Catalog QA Dashboard**

## **Screen ID**

`QA-001`

## **Route**

`/admin/catalog/qa`

QA Categories

* Missing Data  
* Invalid Data  
* Price Issue  
* Media Issue  
* Duplicate  
* Supplier Conflict  
* Option Conflict  
* Source Missing  
* Stale Product  
* Broken Link

KPI

* Critical  
* High  
* Medium  
* Low  
* Resolved This Month

---

# **66\. Data Quality Score**

Product แต่ละรายการมี Score เพื่อช่วยจัดลำดับ ไม่ใช้แทนการอนุมัติ

ตัวอย่าง Weight

* Basic Info 15%  
* Classification 10%  
* Specification 15%  
* Media 15%  
* Price 20%  
* Options 10%  
* Source 10%  
* Documents 5%

แสดงเป็น

* Excellent  
* Good  
* Needs Attention  
* Critical

Blocking Error มีผลเหนือ Score

---

# **67\. Missing Data Report**

## **Screen ID**

`QA-002`

Columns

* Product  
* Missing Fields  
* Severity  
* Status  
* Owner  
* Updated Date

Bulk Actions

* Assign Owner  
* Export  
* Open Products  
* Mark Not Applicable ตาม Permission

---

# **68\. Invalid Price Report**

## **Screen ID**

`QA-003`

Issues

* Active Product ไม่มี Member Price  
* Price Expired  
* Member Price ต่ำกว่า Factory Cost  
* Margin ต่ำกว่า Threshold  
* Currency Missing  
* Overlapping Active Versions  
* Variant ไม่มีราคา  
* Option Price ไม่สัมพันธ์

Critical Issue อาจ Suspend Orderability อัตโนมัติตามนโยบาย แต่ไม่ควรทำโดยไม่มี Notification

---

# **69\. Broken Media Report**

## **Screen ID**

`QA-004`

Issues

* File Not Found  
* Unsupported Format  
* Image Too Small  
* Duplicate File  
* Missing Alt Text  
* Confidential File Public

Actions

* Replace  
* Reassign Role  
* Update Access  
* Archive

---

# **70\. Duplicate Product Report**

## **Screen ID**

`QA-005`


* Product A  
* Product B  
* Supplier  
* SKU  
* Name Similarity  
* Image Similarity  
* Dimensions  
* Created Date

Actions

* Not Duplicate  
* Merge  
* Create Variant Relationship  
* Archive One Product

Merge ต้อง Preview ผลกระทบต่อ Project, Price และ Order History

---

# **71\. Audit History**

## **Screen ID**

`AUD-001`

Product-level Audit แสดง

* Date  
* User  
* Action  
* Section  
* Old Value  
* New Value  
* Reason  
* Source  
* IP ตาม Permission

Filters

* Price  
* Status  
* Specification  
* Media  
* Option  
* Publish  
* User  
* Date

ราคาทุนใน Audit ต้องจำกัด Permission เช่นเดียวกับข้อมูลหลัก

---

# **72\. Global Search ฝั่ง Admin**

ค้นหา

* Product Code  
* Factory SKU  
* Product Name  
* Supplier  
* Category  
* Collection  
* Option Code  
* Source Document  
* Import Job  
* Price Version

ผลลัพธ์แบ่งประเภท

* Products  
* Suppliers  
* Documents  
* Imports  
* Options

---

# **73\. Bulk Action Safety**

Bulk Actions ต้องมี

1. Selection Summary  
2. Eligibility Check  
3. Preview  
4. Confirmation  
5. Result Report  
6. Audit Log

ห้าม Bulk

* ลบ Product ที่มี Order  
* เปลี่ยน Factory Cost โดยไม่มี Preview  
* Publish Product ที่มี Blocking Error  
* ย้าย Supplier โดยไม่ตรวจ SKU  
* Deactivate Option ที่อยู่ใน Open Project Items โดยไม่มี Warning

---

# **74\. Product Status Model**

## **Draft**

กำลังกรอกข้อมูล

## **Needs Correction**

Reviewer ส่งกลับแก้


รอตรวจ

## **Approved**

ข้อมูลผ่าน แต่ยังไม่ Publish

## **Active**

สมาชิกเห็นและสั่งได้ตาม `is_orderable`

## **Suspended**

หยุดรับออเดอร์ชั่วคราว

## **Discontinued**

หยุดขายถาวร

## **Archived**

ซ่อนจากงานประจำ แต่เก็บประวัติ

## **Status Flow**

Draft  
→ Approved  
→ Active  
→ Suspended  
→ Active

Active  
→ Discontinued  
→ Archived

Reviewer สามารถส่ง

→ Needs Correction  

---

# **75\. Orderability แยกจาก Sales Status**

Product อาจเป็น `Active` แต่ `is_orderable = false`

กรณี

* แสดงเพื่อการศึกษา  
* รอราคา  
* รอ Option  
* Catalog Only  
* สินค้าตัวอย่าง

Member UI ต้องแสดง

> สินค้านี้ยังไม่เปิดรับออเดอร์

---

# **76\. Validation Rules สำคัญ**

## **Supplier**

* Supplier Code Unique  
* Currency Required  
* Payment Terms Valid  
* Suspended Supplier ห้ามเปิด Product ใหม่เป็น Orderable

## **Product**

* Product Code Unique  
* Supplier Required  
* Category Required  
* Source Reference Required for Import  
* Product Type Required

## **Variant**

* Variant Code Unique ภายใน Product  
* Factory Variant SKU เตือน Duplicate  
* Dimension ห้ามติดลบ  
* Active Variant อย่างน้อยหนึ่งรายการถ้าใช้ Variant

## **Option**

* Default ต้อง Active  
* Option Code Unique ภายใน Group

## **Price**

* Amount มากกว่า 0  
* Currency Required  
* Effective From Required  
* Active Version ห้าม Overlap  
* Member Price ต้องมี Approval ตาม Rule

## **Publish**

* Supplier Active  
* Price Active  
* Required Fields Complete  
* Confidential Data ไม่ Member-visible

---

# **77\. Error States**

## **Supplier**

* Duplicate Supplier Code  
* Supplier Has Open Orders  
* Document Expired

## **Product**

* Duplicate Product Code  
* Duplicate Factory SKU  
* Product Modified by Another User  
* Required Field Missing  

## **Price**

* Overlapping Price Version  
* Invalid Exchange Rate  
* Margin Below Threshold  
* Approval Already Completed

## **Import**

* File Format Invalid  
* Mapping Missing  
* Duplicate Rows  
* Partial Import


* PDF Cannot Parse  
* Low Confidence  
* Source Page Missing  
* Multiple Products in Image

ระบบต้องเก็บ Draft และงานที่ทำไว้เมื่อ Error

---

# **78\. Concurrent Editing**

หาก Product ถูกแก้โดยหลายคน

ระบบควรแสดง

> ข้อมูลนี้ถูกแก้ไขโดยผู้ใช้อื่นเมื่อเวลา...

แนวทาง MVP

* Optimistic Lock ด้วย `updated_at` หรือ Version  
* แจ้ง Conflict  
* ให้ Refresh และ Apply Changes ใหม่  
* ห้ามเขียนทับโดยไม่แจ้ง

---

# **79\. Unsaved Changes**

Form ยาวทุกหน้าต้อง

* แสดง Unsaved Indicator  
* เตือนก่อนออก  
* Save Draft  
* บอก Last Saved  
* Disable Submit ระหว่างบันทึก


---

# **80\. Permission Matrix Part A**

| Function | Viewer | Catalog Editor | Product Admin | Purchasing | Finance Approver | Reviewer | Super Admin |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| ดู Product | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| สร้าง Draft | No | Yes | Yes | Yes | No | No | Yes |
| แก้ Content | No | Yes | Yes | Limited | No | Review only | Yes |
| ดู Factory Cost | No | ตามสิทธิ์ | ตามสิทธิ์ | Yes | Yes | ตามสิทธิ์ | Yes |
| แก้ Factory Cost | No | No | ตามสิทธิ์ | Yes | No | No | Yes |
| สร้าง Member Price | No | No | Yes | No | Yes | No | Yes |
| อนุมัติราคา | No | No | ตามนโยบาย | No | Yes | No | Yes |
| Publish | No | No | Yes | No | No | Approve ตามสิทธิ์ | Yes |
| จัดการ Supplier | No | No | Limited | Yes | View | View | Yes |
| Import Excel | No | Yes | Yes | Yes | No | No | Yes |
| Suspend Product | No | No | Yes | Limited | No | Recommend | Yes |
| Delete Draft | No | Own Draft | Yes | Own Draft | No | No | Yes |

---

# **81\. API Mapping Part A**

## **Suppliers**

GET    /api/admin/suppliers  
POST   /api/admin/suppliers  
GET    /api/admin/suppliers/:id  
PATCH  /api/admin/suppliers/:id  
POST   /api/admin/suppliers/:id/suspend  
POST   /api/admin/suppliers/:id/reactivate  
GET    /api/admin/suppliers/:id/documents  
POST   /api/admin/suppliers/:id/documents

## **Categories and Collections**

GET    /api/admin/categories  
POST   /api/admin/categories  
PATCH  /api/admin/categories/:id  
POST   /api/admin/categories/:id/deactivate  
POST   /api/admin/categories/merge

GET    /api/admin/collections  
POST   /api/admin/collections  
PATCH  /api/admin/collections/:id

## **Options**

GET    /api/admin/option-groups  
POST   /api/admin/option-groups  
PATCH  /api/admin/option-groups/:id

GET    /api/admin/option-groups/:id/values  
POST   /api/admin/option-groups/:id/values  
PATCH  /api/admin/option-values/:id  
POST   /api/admin/option-values/:id/deactivate

## **Products**

GET    /api/admin/products  
POST   /api/admin/products  
GET    /api/admin/products/:id  
PATCH  /api/admin/products/:id  
POST   /api/admin/products/:id/copy  
POST   /api/admin/products/:id/submit-review  
POST   /api/admin/products/:id/publish  
POST   /api/admin/products/:id/suspend  
POST   /api/admin/products/:id/reactivate  
POST   /api/admin/products/:id/discontinue  
POST   /api/admin/products/:id/archive

## **Variants and Options**

GET    /api/admin/products/:id/variants  
POST   /api/admin/products/:id/variants  
PATCH  /api/admin/product-variants/:variantId

GET    /api/admin/products/:id/options  
POST   /api/admin/products/:id/options  
PATCH  /api/admin/product-option-values/:id

## **Media and Documents**

GET    /api/admin/products/:id/media  
POST   /api/admin/products/:id/media  
PATCH  /api/admin/product-media/:id  
DELETE /api/admin/product-media/:id

GET    /api/admin/products/:id/documents  
POST   /api/admin/products/:id/documents  
PATCH  /api/admin/product-documents/:id

## **Prices**

GET    /api/admin/products/:id/prices  
POST   /api/admin/products/:id/factory-costs  
POST   /api/admin/products/:id/member-prices  
POST   /api/admin/product-prices/:id/submit-approval  
POST   /api/admin/product-prices/:id/approve  
POST   /api/admin/product-prices/:id/reject  
POST   /api/admin/product-prices/:id/deactivate  
GET    /api/admin/price-approvals

## **Import**

GET    /api/admin/imports  
POST   /api/admin/imports  
POST   /api/admin/imports/:id/map  
POST   /api/admin/imports/:id/validate  
POST   /api/admin/imports/:id/commit  
GET    /api/admin/imports/:id/errors

## **QA**

GET /api/admin/catalog-qa/summary  
GET /api/admin/catalog-qa/missing-data  
GET /api/admin/catalog-qa/invalid-prices  
GET /api/admin/catalog-qa/broken-media  
GET /api/admin/catalog-qa/duplicates  
GET /api/admin/products/:id/audit

---

# **82\. Analytics Events**

## **Supplier**

* Supplier Created  
* Supplier Updated  
* Supplier Suspended  
* Supplier Document Uploaded

## **Product**

* Product Draft Created  
* Product Step Completed  
* Product Submitted for Review  
* Product Returned  
* Product Published  
* Product Suspended  
* Product Discontinued

## **Price**

* Factory Cost Version Created  
* Member Price Proposed  
* Price Approved  
* Price Rejected  
* Price Expired

## **Import**

* Import Started  
* Mapping Completed  
* Validation Completed  
* Import Committed  


* PDF Uploaded  
* Draft Reviewed  
* Draft Corrected  
* Draft Approved  
* Duplicate Merged

## **QA**

* QA Issue Created  
* QA Issue Resolved  
* Broken Media Replaced  
* Duplicate Confirmed

---

# **83\. KPI สำหรับ Product & Catalog Team**

* จำนวน Active Products  
* Draft-to-Publish Conversion  
* Average Time to Publish  
* Draft Aging  
* Product Data Completeness  
* Products Without Active Price  
* Price Expiry Rate  
* Price Approval Time  
* Import Error Rate  
* Duplicate Product Rate  
* Broken Media Rate  
* Products per Supplier  
* Products per Category  
* Catalog Search No-result Rate จาก Member Side  
* Suspended Product Rate

---

# **84\. Mobile and Tablet Rules**

## **Tablet**

ควรรองรับเต็มสำหรับ

* Product Review  
* Price Approval  
* Image Upload  
* Catalog QA  
* Supplier View

## **Mobile**

รองรับ

* Dashboard  
* Alerts  
* Product Quick View  
* Price Approval  
* Publish Approval  
* Suspend Product  
* Upload Product Photo  

ไม่แนะนำให้สร้าง Product 8 Steps เต็มบน Mobile แต่ต้องไม่ Block หากจำเป็น ควรใช้ Full-screen Step Form

---

# **85\. Accessibility**

* ตารางมี Accessible Headers  
* Tree Category ใช้ Keyboard ได้  
* Status มีข้อความ  
* Drag and Drop มีปุ่ม Reorder ทางเลือก  
* Media มี Alt Text  
* Price Fields มี Currency Label  
* Confidential Data มี Visual Label และ Screen Reader Text  
* Error Summary ลิงก์ไป Field  
* PDF Comparison ใช้ข้อความ Extracted ประกอบ ไม่พึ่งภาพอย่างเดียว  
* Approval Dialog Trap Focus  
* Button Names ระบุ Action ชัดเจน

---

# **86\. UX Copy Guidelines**

ใช้คำที่ชัดเจน

### **ดี**

> ไม่สามารถ Publish ได้ เนื่องจากสินค้านี้ยังไม่มีราคาสมาชิกที่มีผลใช้งาน

### **ไม่ควรใช้**


### **ดี**

> รหัส SKU นี้มีอยู่แล้วในโรงงานเดียวกัน กรุณาตรวจสอบว่าเป็นสินค้าซ้ำหรือ Variant

### **ไม่ควรใช้**

> Duplicate error

คำเกี่ยวกับต้นทุนต้องระบุว่า

> ข้อมูลภายใน — สมาชิกไม่สามารถมองเห็น

---

# **87\. Wireflow หลัก**

## **87.1 Manual Product Creation**

Create Product  
→ Basic Information  
→ Category  
→ Specification  
→ Variant  
→ Options  
→ Media  
→ Price  
→ Review  
→ Submit  
→ Reviewer Checks  
→ Approve  
→ Publish

## **87.2 Excel Import**

Upload Excel  
→ Select Supplier  
→ Map Columns  
→ Transform Data  
→ Validate  
→ Review Errors  
→ Preview  
→ Import as Draft  
→ Catalog Review  
→ Add Prices  
→ Publish

## **87.3 Price Update**

Receive Price List  
→ Upload  
→ Match SKU  
→ Preview Changes  
→ Create Price Versions  
→ Finance Approval  
→ Schedule Effective Date  
→ Activate

## **87.4 Product Suspension**

Identify Issue  
→ Review Impact  
→ Suspend  
→ Member Message  
→ Correct Data/Price  
→ Review  
→ Reactivate

---

# **88\. Must Have**

## **Supplier**

* Create/Edit  
* Contacts  
* Terms  
* Documents  
* Suspend

## **Taxonomy**

* Category Tree  
* Collection  
* Tags  
* Option Groups  
* Option Values

## **Product**

* Create/Edit  
* Variants  
* Options  
* Media  
* Documents  
* Status  
* Member Preview  
* Copy Product

## **Price**

* Factory Cost  
* Member Price  
* Currency  
* Version  
* Approval  
* Expiry  
* History

## **Import**

* Excel/CSV  
* Mapping  
* Validation  
* Preview  
* Error Report  
* Import as Draft

## **Publish**

* Readiness Check  
* Submit Review  
* Approve  
* Return  
* Publish  
* Suspend  
* Discontinue

## **QA**

* Missing Data  
* Invalid Prices  
* Broken Media  
* Duplicate  
* Audit

---

# **89\. Acceptance Criteria Part A**

Part A ถือว่าสมบูรณ์เมื่อ

1. Admin สร้าง Supplier ได้  
2. Supplier รองรับหลายประเทศและสกุลเงิน  
3. Supplier เก็บ Contact, Terms และ Document ได้  
4. Admin Suspend Supplier ได้โดยไม่กระทบ Order เดิม  
5. Admin สร้าง Category แบบ Parent-Child ได้  
6. Category ที่มี Product ไม่ถูกลบถาวร  
7. Admin สร้าง Collection และ Tag ได้  
8. Admin สร้าง Option Group และ Option Value ได้  
9. Option ที่มีประวัติ Order ไม่ถูกลบ  
10. Admin สร้าง Product Draft ได้  
11. Product รองรับชื่อไทย อังกฤษ และจีน  
12. Product รองรับ Variant  
13. Product รองรับ Required Options  
14. Product รองรับ Media หลายประเภท  
15. Product รองรับ Document และ Visibility  
16. Product รองรับ Factory Cost แยกจาก Member Price  
17. Member API ไม่ได้รับ Factory Cost  
18. ราคาใช้ Version และ Effective Date  
19. ราคาเก่าไม่ถูกเขียนทับ  
20. ระบบคำนวณ Margin Preview สำหรับผู้มีสิทธิ์ได้  
21. ราคาต้องผ่าน Approval ตาม Workflow  
22. Product Active ต้องมี Member Price Active  
23. Admin Preview สิ่งที่ Member เห็นได้  
24. Product Publish ต้องผ่าน Readiness Checklist  
25. Reviewer ส่งกลับแก้ไขพร้อมเหตุผลได้  
26. Publish สร้าง Audit Log ได้  
27. Suspend และ Discontinue ไม่เปลี่ยน Order Snapshot เดิม  
28. Admin Import Excel/CSV ได้  
29. Import มี Column Mapping ได้  
30. Import แปลงหน่วย cm เป็น mm ได้ตาม Rule  
31. Import แสดง Error และ Warning แยกกัน  
32. Import สร้างข้อมูลเป็น Draft ไม่ Publish ทันที  
33. ระบบตรวจ Duplicate SKU ได้  
34. ระบบเก็บ Source Document และ Source Page ได้  
# **90\. Handoff ให้ทีม UI Design**

ทีม UI ต้องสร้าง Prototype อย่างน้อย

1. Catalog Dashboard  
2. Supplier Listing  
3. Create Supplier  
5. Category Tree  
6. Option Management  
7. Product Listing  
8. Create Product Multi-step  
10. Variant Manager  
11. Option Manager  
12. Media Manager  
13. Product Price Overview  
14. Price Approval  
15. Excel Import Mapping  
16. Import Validation  
19. Publish Review  
20. Catalog QA Dashboard

ต้องออกแบบ State

* Draft  
* Needs Correction  
* Price Missing  
* Low Margin  
* Duplicate  
* Import Error  
* Suspended  
* Discontinued  
* Concurrent Edit

---

# **91\. Handoff ให้ Codex**

แนะนำแยกพัฒนาเป็น Sprint

## **Sprint K: Supplier and Taxonomy**

* Supplier  
* Contacts  
* Terms  
* Documents  
* Category  
* Collection  
* Tags  
* Option Groups  
* Option Values

## **Sprint L: Product Master**

* Product Listing  
* Product Form  
* Specification  
* Variant  
* Option  
* Media  
* Documents  
* Member Preview

## **Sprint M: Pricing**

* Factory Cost  
* Member Price  
* Exchange Rate  
* Price Version  
* Margin Preview  
* Approval  
* Price Expiry

## **Sprint N: Import Center**

* Excel/CSV Upload  
* Mapping  
* Transformation  
* Validation  
* Preview  
* Draft Creation  
* Error Report

## **Sprint P: Publish and Catalog QA**

* Readiness Checklist  
* Review Queue  
* Publish  
* Suspend  
* Discontinue  
* QA Dashboard  
* Audit History

Codex ห้าม

* Publish ข้อมูล Import อัตโนมัติ  
* เขียนทับ Price Version เดิม  
* แสดง Factory Cost ผ่าน Member API  
* ลบ Product หรือ Option ที่มี Transaction  
* เปลี่ยน Snapshot ใน Order เดิม  
* Publish Product ที่ไม่มี Active Member Price  
* Publish Product ที่ Required Option ไม่มีค่าให้เลือก  
* Merge Product โดยไม่ตรวจผลกระทบ  
* Suspend Supplier แล้วลบข้อมูล Order เดิม

---

# **92\. ข้อสรุป**

GISP Volume 3 Part A เป็นระบบควบคุมข้อมูลต้นน้ำของแพลตฟอร์มทั้งหมด

Workflow หลักคือ

รับข้อมูลจากโรงงาน  
→ จัดเก็บ Source  
→ สร้าง Draft  
→ ตรวจ Product  
→ กำหนด Variant และ Option  
→ เพิ่ม Media และ Documents  
→ กำหนด Factory Cost  
→ กำหนด Member Price  
→ อนุมัติราคา  
→ ตรวจ Catalog QA  
→ Publish  
→ ติดตามและอัปเดตเป็น Version

หัวใจสำคัญของ Part A คือ

1. โรงงานไม่แก้ข้อมูลเองใน MVP  
2. ข้อมูลใหม่ทุกชุดเริ่มจาก Draft  
3. Product, Variant และ Option ต้องแยกกันชัดเจน  
4. ราคาทุนและราคาขายต้องแยกสิทธิ์  
5. ราคาต้องมี Version และ Effective Date  
6. Product ต้องผ่านการตรวจสอบก่อน Publish  
8. ทุกข้อมูลที่ดึงจาก Catalog ต้องอ้างอิงหน้าได้  
9. สิ่งที่ไม่พบต้องไม่เดา  
10. การ Suspend และ Discontinue ต้องรักษาประวัติ  
11. Member Preview ต้องยืนยันว่าไม่มีข้อมูลลับรั่วไหล  
12. Catalog QA ต้องตรวจปัญหาได้ก่อนกระทบ Project และ Order

