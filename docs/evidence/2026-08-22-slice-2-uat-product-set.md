# Slice 2 — UAT Product Set

**วันที่เลือก:** 22 สิงหาคม 2569  
**Backend Branch:** `slice-2-catalog`  
**ขอบเขต:** ชุดทดลองสำหรับขั้น 2–9 เท่านั้น

เลือกสินค้า CN01 จำนวน 6 รายการจากฐานข้อมูลจริง:

| SKU | หมวด | มิติ | Active Variant | รูปหลัก | สถานะ |
|---|---|---|---:|---:|---|
| CN01-1232 | BED | 1870 × 2240 × 1080 mm | 2 | 1 | DRAFT |
| CN01-126677 | TABLE | 1300 × 1300 × 750 mm | 0 | 1 | DRAFT |
| CN01-126679 | CABINET | 500 × 400 × 460 mm | 0 | 1 | DRAFT |
| CN01-127134 | SOFA | 3400 × 1000 × 670 mm | 0 | 1 | DRAFT |
| CN01-127139 | CHAIR_STOOL | 440 × 470 × 800 mm | 0 | 1 | DRAFT |
| CN01-139895 | SOFA | 2860 × 1100 × 900 mm | 0 | 1 | DRAFT |

เหตุผลที่เลือก: ครอบคลุมหลายหมวด ทุกชิ้นมี Primary Image และมิติครบ สามารถใช้เดินขั้น Enrichment → Variant → Cost → Price → Review → Publish → Member-safe verification ได้โดยไม่แก้ข้อมูลสินค้า 723 รายการทั้งหมด

ข้อมูลที่ยังรอในขั้นถัดไป: Lead time และ Material Summary ทั้ง 6 รายการ รวมถึง Default Variant ของ 5 รายการที่ยังไม่มี Active Variant
