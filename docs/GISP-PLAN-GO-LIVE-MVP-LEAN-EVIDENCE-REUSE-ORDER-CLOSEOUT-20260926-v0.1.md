# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — แผนปิดงานแบบใช้หลักฐานเดิม v0.1

สถานะ: **ร่างเพื่อให้เจ้าของตัดสินใจ** — เอกสารนี้ไม่ใช่คำอนุมัติให้เขียนข้อมูล, ทดสอบด้วยบัญชีจริง, Restore หรือเปลี่ยน Production และไม่แก้ย้อนหลังผล UAT/เอกสารที่อนุมัติแล้ว

## 1. เป้าหมายและขอบเขต

เปิดแอปเริ่มต้นตาม Lean Scope v0.2 ด้วย Catalog, Project/Custom RFQ, Order, การรับเงินและ Finance ตรวจแบบ Manual, Production/QC, Warehouse, Shipment และ Delivery โดยใช้ความสามารถเดิม ไม่เพิ่มระบบหรือฟีเจอร์ ไม่ทดสอบทั้งระบบหรือรีเซ็ตห้าบัญชีซ้ำเพียงเพราะขั้นตอนก่อนหน้าหยุด

คง **2 ขั้นตอน Go Live เดิม**: (1) ปิด Staging UAT/Recovery และ Independent QA `GO`; (2) Production Release และติดตาม 24 ชั่วโมง ข้อความนี้เป็นการลดงานซ้ำ *ภายใน* สองขั้นตอน ไม่ใช่การประกาศว่าจุดตรวจที่ยังไม่ผ่านได้ผ่านแล้ว

## 2. ข้อเท็จจริง ณ 2026-09-26

| เรื่อง | ผลที่ใช้ต่อได้ / ยังขาด |
| --- | --- |
| Local candidate | Commit `2317e60e013c16b907732368d195afd39fc7e64c`, tree `fdfebb1f6e5e1672bfcdd48a9bb331db74ed3bce`, manifest SHA-256 `39F64745F6DCA2F66B092474521E4F19CC9FFC2FF592B85A193CBA380DFB899C`; Local QA ผ่าน 677/677, typecheck และ build |
| Staging | Project `a24aff68-a82e-41da-b64a-a128a1539769`, host `5wjnzj4y`; named backup `glmvp-pre-order-cost-v2-20260926` ID `c20d2f88-2d93-460a-941c-f74166a0b449` สถานะ `completed` |
| Migration #13 | `20260926150000_order-cost-version-snapshot.sql` SHA-256 `F35C9192B89FE6DA4A011AEB574BF08C6924C3264E5415DFD51B048E1E5B8DDE` Apply บน Staging แล้วหนึ่งครั้ง; history 39 รายการ, #13 เป็น head; QA ตรวจ function body และสิทธิ์ private แล้วผ่าน **เฉพาะการไป UAT ต่อ** |
| UAT เดิม | เก็บผลที่ผ่านแล้วของ Development/Local และ Staging สำหรับส่วนที่ candidate ใหม่ไม่ได้เปลี่ยน โดย QA ต้องตรวจว่าอ้างอิง candidate, ขอบเขตข้อมูล และ ACL ได้จริง; ไม่เปลี่ยน `STOP` เป็น `PASS` ด้วยการคาดเดา |
| Order หลัง #13 | ยังไม่มีผลสร้าง Order จริงหลังแก้; Custom Request ทดสอบ `28aa7b00-41cd-47c3-8b2f-8fe2193b1a8d` เป็น `CONVERTED` และอ่านกลับพบ Order ที่เกี่ยวข้อง 0 รายการ จึงยังไม่ใช่ Staging `GO` |
| บัญชีทดสอบ | รอบ r11 ใช้ห้าบัญชีสำเร็จ แต่ process จบและตั้งใจไม่เก็บ password/session; ไม่สามารถอ้างว่า session เดิมยังใช้ได้หรือกู้รหัสจาก checkpoint |
| Production | **ยังไม่เปลี่ยน**; คำอนุมัติ #13 ระบุ `production_allowed: No` และการอนุมัติ candidate 12 migrations เดิมไม่ครอบคลุม #13 |

## 3. ขั้นตอนที่ 1 — ปิด Staging เฉพาะส่วนที่เปลี่ยน

1. จัดทำตารางหลักฐานสั้น ๆ แยก `ผ่านและใช้ต่อได้`, `ต้องตรวจเฉพาะจุด`, `ยังไม่มีหลักฐาน` โดยผูกกับ exact candidate ข้างต้น ไม่รันรายการที่ผ่านและไม่ stale ซ้ำ ไม่สร้าง Catalog, Project, Custom Request หรือไฟล์เดิมซ้ำ
2. ตรวจช่องทางเข้าใช้บัญชี Member ทดสอบเดิมที่มีอยู่แบบอ่านอย่างเดียวก่อน หากไม่มี session ที่ตรวจตัวตน/สิทธิ์ได้จริง ให้หยุดเฉพาะการเขียน Order และเสนอทางเข้าที่ใช้ **บัญชีเดิมให้น้อยที่สุด** โดยไม่สมมติว่ามี no-email reset หรือ session ที่กู้ได้ การส่ง reset email ใหม่, การใช้บัญชีใหม่ หรือการเปลี่ยนวิธียืนยันตัวตนต้องมีขอบเขต/สิทธิ์ชัดก่อนทำ; ไม่วนรีเซ็ตทั้งห้าบัญชี
3. เมื่อมีตัวตน Member ที่ยืนยันได้ ให้ใช้ Project item สังเคราะห์เดิมทดสอบการสร้าง Catalog Order หลัง #13 เพียงชุดที่จำเป็น ตรวจผลจาก Staging จริง: ราคาและ cost-version ที่ผูกกัน, supplier cost สกุล CNY, Order/Payment schedules และ commercial snapshot; สองคำขอพร้อมกันต้องได้ Order ไม่เกินหนึ่งรายการ ไม่มีลูกแถวซ้ำ และคำขอที่แพ้ต้องเป็น error ที่จัดการได้ **ห้ามเรียกซ้ำเมื่อผลการเขียนไม่ชัด**
4. ใช้ผล negative test และ UAT ของส่วนที่ไม่เปลี่ยนจากเดิมเมื่อ QA ยืนยันว่าไม่ stale; หากจุดใดผูกกับ Order ใหม่โดยตรงจึงตรวจเฉพาะจุดนั้น เช่น cross-org access กับ Order ใหม่นี้ การใช้ผลทดสอบห้าบัญชีเดิมแทนการล็อกอินซ้ำเป็นส่วนหนึ่งของ **Scope/Acceptance Amendment ที่เสนอ** ไม่ใช่สิทธิ์อัตโนมัติ
5. Recovery: ตรวจว่าหลักฐาน Stop → SELECT-only Reconcile → Resume และ Restore เดิมยังใช้กับ candidate/#13 ได้จริงหรือไม่ Backup **ก่อน** #13 ใช้เป็นทางย้อนกลับฉุกเฉินได้ แต่การ Restore จะเอา #13 ออก **และลบ Order/UAT data ทุกอย่างที่สร้างหลัง backup นั้น** ห้าม Restore แล้วอ้างว่า #13 ยังอยู่ ถ้าหลักฐานเดิมไม่ครอบคลุม ให้เสนอ rehearsal ที่จำกัดและมี post-#13 restore point/การตรวจ history ชัดเจนก่อนลงมือ; ห้าม Restore เพื่อให้ช่องเอกสารเป็น `PASS`
6. Independent QA ตัดสิน `GO` หรือระบุ Blocker เฉพาะที่ยังไม่ผ่านจากหลักฐานจริง ไม่เปลี่ยนแผนเป็น Full UAT รอบใหม่

## 4. ขั้นตอนที่ 2 — Production Release เดิม

ก่อน Production write ต้องมี **Release Authorization แยก** ที่ระบุ exact commit/tree/manifest ใหม่, migration #1–#13 และ hash, Production Project ID `865860c2-49fa-4e53-908f-9396b2f75233`, ขอบเขต Backup/Apply/Deploy/เปิดสมาชิก/Recovery และเวลาที่อนุมัติ `production_allowed: Yes` การอนุมัติ Staging หรือข้อความให้ทำต่อเนื่องไม่แทนสิทธิ์นี้

เมื่อได้ Staging `GO` และ Release Authorization ครบ ให้ตรวจ Production identity, baseline/history, config/SMTP/Schedule, ค่าใช้จ่าย, backup `completed` และวิธี Emergency Stop/ย้อนคืนก่อนเขียน Apply เฉพาะ migration ที่ยังไม่เคย Apply ทีละไฟล์ตาม allow-list ห้าม `up --all` หรือ Apply ซ้ำ Deploy exact app candidate ตามที่อนุมัติ เปิด `C → D7 → D8` พร้อม smoke/สิทธิ์แต่ละช่วง ปิด Business Notification Schedule เฉพาะรายการที่ยืนยันได้ เปิดสมาชิกประมาณ 20 คนเมื่อผ่าน แล้วติดตาม 24 ชั่วโมง ห้าม synthetic Production fixture

หากผล Apply/Deploy/ข้อมูลไม่ชัด ให้ทำ read-only reconciliation และหยุดก่อนการเขียนถัดไป ไม่ retry ไม่เปลี่ยน candidate หรือขยายขอบเขตอัตโนมัติ

## 5. สิ่งที่เอกสารนี้ตั้งใจตัดออก

- ไม่เริ่ม Development/Local/Staging UAT ทั้งชุดใหม่; ไม่ส่ง OTP ห้าบัญชีซ้ำเป็นขั้นตอนปกติ
- ไม่สร้างสินค้า, ต้นทุน, ราคา, Project, Custom Request, Order หรือหลักฐานทดสอบที่มีอยู่แล้วซ้ำ
- ไม่เพิ่มระบบ Auth, idempotency, automation, notification, Supplier Payment, Claims หรือ Advanced Reports
- ไม่ลดเกณฑ์ความถูกต้องของ Order/เงิน/สิทธิ์ หรืออ้าง `GO` จากเพียงการ Apply migration และไม่ข้าม backup/recovery ที่ยังไม่มีหลักฐาน

## 6. เรื่องที่ต้องตัดสินใจก่อนการเขียนครั้งถัดไป

1. ยอมรับการใช้หลักฐาน UAT เดิมสำหรับส่วนที่ไม่เปลี่ยน และแทนงาน Order/concurrency ที่เคยกำหนด 20 สมาชิก × 2 คำขอด้วย targeted proof บนบัญชี Member/Project เดิม **หรือ** คงเกณฑ์เดิม หากเลือก targeted proof ถือเป็น Scope/Acceptance Amendment; QA ต้องระบุว่าครอบคลุมความเสี่ยงเท่าใด
2. หากไม่มี session ที่ใช้ได้ ให้ระบุวิธียืนยันตัวตนของบัญชีเดิมแบบจำกัดและอนุมัติขอบเขต email/reset เฉพาะที่จำเป็นก่อนใช้จริง; ยังไม่มีวิธีไม่ใช้รหัสที่ได้รับการยืนยันว่าใช้ได้
3. หลัง Staging `GO` จึงออก Production Release Authorization สำหรับ candidate #13 แยก ไม่มีสิทธิ์ Production จากเอกสารร่างนี้

## 7. ขอบเขตของร่างนี้

`data_authority: None`; `migration_authority: None`; `staging_allowed: Read-only planning/evidence review only`; `production_allowed: No` เอกสารนี้เสนอวิธีลดงานซ้ำและลำดับการตัดสินใจ ไม่อนุมัติการเขียน Backend, ส่ง Auth email, Restore, Deploy หรือ Production
