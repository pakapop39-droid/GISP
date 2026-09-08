# Slice 13 — Visual Product Sourcing Engineering Evidence

วันที่: 8 กันยายน 2569

## ผลลัพธ์ที่ทำเสร็จ

- สร้าง Backend Branch `slice-13-visual-sourcing` แบบ schema-only
- ลง Migration `20260905121000_slice-13-visual-sourcing.sql` และ Security Migration ตามลำดับ
- Merge เข้า `gisp-mvp-development` สำเร็จ โดย Production Release A ไม่ถูกเปลี่ยน
- เพิ่ม Member Flow: สร้างร่าง แนบ/ลบภาพ ส่งคำขอ ส่งข้อมูลเพิ่ม เลือกหรือปฏิเสธตัวเลือก และยกเลิก
- เพิ่ม Operations Flow: เริ่มจัดหา ขอข้อมูลเพิ่ม เพิ่มตัวเลือกและภาพ ส่งตัวเลือก ระบุว่าหาไม่ได้ และเชื่อม Product
- เพิ่มการตรวจ Magic Bytes สำหรับ JPEG, PNG และ WebP ก่อนรับไฟล์
- จำกัดภาพคำขอและภาพตัวเลือกอย่างละไม่เกิน 8 ภาพ ภาพละไม่เกิน 10 MB
- เพิ่มหน้าจอ Admin สำหรับเปิด ดู และลบภาพตัวเลือก พร้อม Refresh รายการทันทีหลังอัปโหลด

## Security และ Integration

- Branch Integration ผ่าน 20 Assertions ครอบคลุม Member สองบริษัท, Direct Write Denial,
  Sequence Helper Denial, File Guard, Workflow ทุกทาง และ Append-only History
- Member-safe API ตรวจแล้วว่าไม่ส่ง `supplier_id`, `factory_sku`, `factory_cost`,
  `internal_note` หรือข้อความภายในให้ Member
- `sourcing.manage` ผูกกับ `PRODUCT_ADMIN`, `PURCHASING` และ `SUPER_ADMIN` ครบ 3 บทบาท
- `next_record_reference(text)` ไม่มีสิทธิ์ Execute สำหรับ `authenticated`

## Quality Gate

- Type Check: ผ่าน
- ESLint: ผ่าน
- Unit/Contract Test: 42 Files / 171 Tests ผ่าน
- Production Build: ผ่าน 118 Pages
- Local Browser E2E: Member Create/Upload/Delete/Submit และ Admin Queue/Candidate/Image/Publish ผ่าน
- Responsive: Member และ Admin ที่ 390×844 ไม่มี Horizontal Overflow
- ภาพหลักฐาน:
  - `output/slice13-member-new-local.png`
  - `output/slice13-member-submitted-mobile.png`
  - `output/slice13-admin-detail-mobile.png`
  - `output/slice13-member-options-mobile.png`

## Backup และ Merge

- Backup ก่อน Merge: `output/development-pre-slice13-2026-09-08.sql`
- SHA-256: `2155A80554040BDF7D9C31DD9C03B884A19ECF036A08EF2F26CED25E1C9CD4C7`
- Dry-run: 27 Added, 1 Modified, 0 Conflicts
- Merge: สำเร็จ
- Post-merge Database Check: Tables พร้อม, Permission 1, Role Grants 3, Sequence Exposed = false

## Deployment

- เปิด Development Environment Flag `NEXT_PUBLIC_ENABLE_PRODUCT_SOURCING=true` แล้ว
- InsForge Main Deployment ถูก Vercel Rate Limit ระหว่างอัปโหลด โดย Deployment เดิมยัง READY
- Deploy Development Preview รุ่นแก้ไขล่าสุดสำเร็จ: `dpl_J6A1Pk2SDtRZUMSn3XPhbshZzaJ5`
- URL สำหรับ Human UAT: `https://gisp-slice-13-visual-sourcing.vercel.app`
- Health และ Auth Gate ผ่านบน Hosted Environment
- Member Request/Options และ Admin Queue/Detail ผ่านบน Hosted Environment
- Candidate Image Upload บนรุ่นแก้ไขล่าสุดผ่าน จาก 0/8 เป็น 1/8 โดยไม่มี Browser Error
- Member-safe API พบตัวเลือกทั้งสองรายการและไม่พบ `supplier_id`, `factory_sku`,
  `factory_cost` หรือ `internal_note`
- Member/Admin ที่ 390×844 ไม่มี Horizontal Overflow

## UAT Finding — Member Draft Visibility

- พบ `PSR-2026-000002` ในคิว Admin ทั้งที่ยังเป็น `DRAFT` และมีภาพ 0 ภาพ
- ยืนยันว่าไฟล์ไม่ได้หาย เพราะ Member ยังไม่ได้แนบภาพและยังไม่ได้กดส่งคำขอ
- แก้ Admin API, Detail, Image Endpoint และ RLS ให้ทีมงานไม่เห็นร่างของ Member
- หน้าสร้างคำขอใหม่เลือกภาพ 1–8 ภาพตั้งแต่หน้าแรกและอัปโหลดพร้อมการสร้างร่าง
- หน้าร่างแสดงข้อความชัดเจนว่าต้องแนบภาพและกด “ส่งคำขอให้ GISP”
- Hosted Verification ยืนยัน Admin Queue มี 1 รายการ, Draft 0 รายการ และเปิด Draft ID ตรง ๆ ได้ 404
- Member ยังเห็นร่างของตนเอง พร้อมปุ่มแนบภาพและคำอธิบายขั้นตอน บน 390×844 ไม่มี Horizontal Overflow
- Security Migration `20260908143000_slice-13-hide-member-drafts.sql` ลง Development สำเร็จ
- แก้ช่องกว้าง/ลึก/สูงจาก `min=0.01` ที่ทำให้ Browser รับเฉพาะ 499.01/500.01 เป็นมิลลิเมตรจำนวนเต็ม
- Hosted Verification ยืนยัน `500 × 500 × 700` ผ่าน Validation โดยทุกช่องใช้ `min=1`, `step=1`

## Human UAT และ Owner Sign-off

- เจ้าของระบบแจ้ง “ผ่านทั้งหมด” วันที่ 8 กันยายน 2569
- กำหนดผลเป็น `SLICE_13_ACCEPTED` / `DONE` บน Development
- Production Release A ไม่ถูกเปลี่ยน และ Release B ต้องได้รับ Owner Approval แยก

คงเหลือ 0 ขั้นตอนเพื่อปิด Slice 13
