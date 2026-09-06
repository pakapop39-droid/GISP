# CN01 Data Approval Workbook — 19 August 2026

## Scope

เตรียมตารางสำหรับอนุมัติ Lead time, Material Mapping, อัตรา CNY → THB และ Effective Date
ก่อนรัน Batch Enrichment/Pricing กับ Supplier `CN01` บน Branch `slice-2-catalog`

ขั้นตอนนี้เป็นการอ่านข้อมูลและจัดทำเอกสารเท่านั้น ไม่มีการเขียนข้อมูลกลับฐานข้อมูล ไม่มี Product
ถูกเปลี่ยนสถานะ Review/Publish และไม่มีการ Merge เข้า Development หรือ Deploy Production

## Source Verification

- Import Job: `2b5f864b-267f-480f-aaad-89d2f537623c`
- Product: 723 Draft
- Variant: 729
- Primary Image: 723
- Import Error: 0
- Publish Readiness ก่อนอนุมัติ: Lead time 723, Material 723, มิติ 53,
  Active Variant 438, Active Cost 723 และ Active Member Price 723

## Approval Groups Prepared

### Lead time

- 14 กฎจาก 8 หมวด โดยสร้างเฉพาะกลุ่มที่มีสินค้า
- กลุ่มพร้อมส่ง: 142 รายการ
- กลุ่มทั่วไป: 581 รายการ
- จำนวนวันและ Effective Date เว้นว่างทั้งหมดเพื่อไม่เดา Business Rule

### Material Mapping

- Candidate Rule 16 กฎ ใช้เฉพาะคำวัสดุที่พบชัดเจนในชื่อ/สเปกต้นทาง
- ตัดคำว่า `เนื้อผ้าสี` ออกจากการอนุมานว่าเป็น “ผ้า” เพราะเป็นหัวข้อสี/ผิววัสดุทั่วไป
- พบ Candidate อย่างน้อยหนึ่งค่า: 481 รายการ
- ไม่พบคำวัสดุชัดเจน: 242 รายการ
- พบหลายวัสดุ: 134 รายการ โดยข้อเสนอคือรวมค่าแบบไม่ซ้ำหลัง Rule ได้รับอนุมัติ
- ทุก Rule ยังเป็น `PENDING`

### Dimensions

- มิติไม่ครบ: 53 รายการ
- พบรูปแบบวงกลม `ØD × H`: 30 รายการ พร้อมข้อเสนอ `W=D=เส้นผ่านศูนย์กลาง, H=ค่าหลัง ×`
- ต้องตรวจด้วยคน/เอกสาร Supplier เพิ่ม: 23 รายการ
- ไม่มีข้อเสนอใดถูกเขียนกลับฐานข้อมูล

### FX and Pricing Contract

- ช่องอัตรา CNY → THB, Effective Date, แหล่งอ้างอิง และผู้อนุมัติยังว่าง
- Formula Active ที่ตรวจจาก Branch: Global v7
- Platform Cost 5% + Marketing and Training 10% + Product Sourcing 10% ของ Factory Cost THB
- Suggested Resale ใช้ Markup 25% จาก Member Price
- Freight Estimate 15–20% ของ Factory Cost THB
- Acceptance case เดิม: Cost 100 THB → Member Price 125 → Suggested Resale 156.25

## Workbook Verification

- 6 ชีต: สรุปอนุมัติ, Lead time, Material, FX/Pricing, มิติที่ขาด และสินค้า 723 รายการ
- มี Dropdown สำหรับ Approval Status และช่องสีเหลืองสำหรับข้อมูลผู้อนุมัติ
- แถวสินค้าใน Audit Sheet ครบ 723 รายการ
- Formula Error Scan: 0
- Workbook: [GISP_CN01_Data_Approval.xlsx](../../outputs/019fe597-d44e-7631-9509-28e340533908/GISP_CN01_Data_Approval.xlsx)

## Next Gate

ผู้มีอำนาจต้องอนุมัติค่าทางธุรกิจใน Workbook ก่อน จากนั้น Engineering จะทำ Batch Preview
แบบไม่เขียนจริงเพื่อแสดงจำนวนรายการที่จะเปลี่ยนและ Error ก่อนขออนุมัติเขียนฐานข้อมูลอีกครั้ง
