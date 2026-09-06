# Slice 2 Pricing Engine — Branch Evidence

**วันที่ตรวจ:** 18 สิงหาคม 2569  
**Backend Branch:** `slice-2-catalog` (`schema-only`)  
**Production:** ไม่มีการเปลี่ยนแปลง

## สิ่งที่ติดตั้งบน Branch

- Migration `20260818151117_slice-2-pricing-engine.sql`
- Pricing Formula Inheritance: `Global → Supplier → Product`
- Component Override ด้วย `component_code`
- Calculation Basis: `FACTORY_COST_THB` หรือ `MEMBER_PRICE`
- Decimal Round Half-up สองตำแหน่ง
- Trusted Action สำหรับ Draft, Preview, Activate, Retire, Factory Cost Version และ Calculated Member Price
- API สำหรับ Formula, Preview, Factory Cost และ Member Price
- Audit สำหรับ Formula/Cost/Calculated Price

## ผลตรวจอัตโนมัติ

| การตรวจ | ผล |
|---|---|
| Unit Test Pricing Engine | ผ่าน 5/5 |
| Test ทั้งโครงการ | ผ่าน 48/48, 9 Test Files |
| Branch Pricing Integration/Security | ผ่าน 7/7 |
| Typecheck | ผ่าน |
| Lint | 0 Error; Warning เดิมนอก Application 2 จุด |
| Production Build | ผ่าน; Route Pricing ใหม่ถูกรวมครบ |

## Branch Assertions 7 รายการ

1. ทุน 100 คำนวณ Member Price 125, Suggested Resale 156.25 และ Freight 15–20
2. Active Member เห็น Calculated Member Price
3. Member Catalog ไม่ส่ง Factory Cost, Formula, Margin หรือ Supplier Identity
4. RLS ปิด Direct Read ตาราง Formula และ Factory Cost จาก Member
5. Member เรียก Confidential Pricing Preview ไม่ได้
6. Direct Update Formula และ Calculated Price ถูกปฏิเสธ
7. Formula Activation และ Calculated Price Activation สร้าง Audit Event

## ขอบเขตผลตรวจ

หลักฐานนี้ยืนยันเฉพาะ Pricing Engine และ Pricing API ชุดแรกของ Slice 2 ยังไม่ใช่การตรวจรับ Slice 2
ทั้งหมด และยังไม่อนุญาต Merge หรือ Production Deployment
