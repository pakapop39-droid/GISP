# GISP Development UAT — QC Reopen AC-05 Permission Addendum v0.3

วันที่ตรวจ: 2026-09-18 (Asia/Bangkok)  
สถานะ: **AC-05 ไม่มี `qc.manage` = PASS; AC-05 ต่างองค์กร = NOT TESTED**  
อ่านคู่กับ `GISP-UAT-QC-REOPEN-DR024-R02-20260918-v0.2.md` และอำนาจทดสอบใน `GISP-APR-QC-REOPEN-AC0256-R02-RETEST-20260918-v1.0.md`

## สิ่งที่ทดสอบจริง

- เจ้าของสลับเข้าบัญชีเดิม `Logistic Tong` ใน GISP Development เอง; หน้า Dashboard แสดงเฉพาะงาน Logistics
- ตรวจข้อมูลบทบาทแบบอ่านอย่างเดียว: user `6df99174-6e3f-4f5b-b752-b27f3b1846e2` เป็น `ACTIVE`, มีบทบาท `LOGISTICS` เท่านั้น และไม่มี permission `qc.manage`; ไม่ได้แก้ Role หรือ Permission
- หน้า Order R02 `ORD-2026-000011` เปิดได้สำหรับงาน Logistics แต่ไม่แสดงส่วน Quality Control หรือปุ่ม Reopen
- เพื่อพิสูจน์ฝั่ง backend เพิ่มเติม ส่งคำขอ `POST /api/admin/qc-inspections/reopen` **หนึ่งครั้ง** จากเซสชันบัญชี `Logistic Tong` บน origin Development เดียวกัน ระบุ order item R02 `d2246320-b6c8-47d4-9626-481986bd1bef` และเหตุผล `DRYRUN-R02 AC-05 Development Test`; ผลจริง HTTP **403**, `code=PERMISSION_DENIED`, ข้อความ “ไม่มีสิทธิ์ทำรายการนี้”
- SQL แบบอ่านอย่างเดียวก่อนและหลังคำขอให้ผลตรงกัน: Shipment `DISPATCHED` พร้อม `dispatched_at=2026-09-18T05:57:03.154Z`, QC `PASSED`, `QC_REOPENED` **2** รายการ, `qc_inspections` **4** รายการ; ไม่มีธุรกรรมหรือ Audit ใหม่จากคำขอที่ถูกปฏิเสธ

## ขอบเขตของข้อสรุป

- **PASS:** บัญชี Logistics-only ที่ไม่มี `qc.manage` ไม่สามารถ Reopen QC ได้ทั้งจากหน้าจอและจาก API ที่ใช้เซสชันจริง
- **NOT TESTED:** ผู้ใช้ที่มี `qc.manage` ในองค์กรอื่นพยายาม Reopen R02; การอ่านบทบาท Development พบ active QC user ที่มี role แบบจำกัดองค์กร **0** ราย จึงไม่มี fixture เดิมที่แยกกรณีผิดองค์กรออกจากกรณีไม่มีสิทธิ์ได้ ห้ามตีความผล 403 ข้างต้นว่าเป็น PASS ของ cross-organization
- ไม่ใช้ SQL `project_admin` อ้างเป็นผลสิทธิ์ของผู้ใช้; SQL ใช้ตรวจ read-only baseline และผลหลังทดสอบเท่านั้น
- ไม่แก้ App, Source Code, Database, Role, Permission, ข้อมูล R01 หรือ Production และไม่ Deploy

## สถานะ Slice หลัง Addendum

AC-02 ผ่านสำหรับ R02; AC-05 ยัง **PARTIAL** เพราะ cross-organization ไม่ได้ทดสอบ; AC-06 ยัง **PARTIAL** เพราะ Member Custom approval และ Shipment creation หลัง deploy ยังไม่ครบ; UX findings 2 รายการจาก v0.2 ยังเปิดอยู่

**เหลือ 3 ขั้นตอนเพื่อปิด Slice:** (1) เจ้าของอนุมัติหรือยกเว้นอย่างชัดเจนสำหรับ fixture ทดสอบ cross-organization โดยไม่ใช้ข้อมูลจริง (2) อนุมัติชุด Custom test แยกสำหรับ AC-06 (3) ตัดสิน UX findings และรับรองผล UAT; ไม่มีข้อใดเป็น Production Release Authorization
