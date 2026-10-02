# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — การผูก Package ใหม่และลองขั้นตอนบัญชีผู้ใช้บน Lean Staging ครั้งที่ 1 v0.1

## 1. จุดประสงค์และสถานะ

เอกสารแก้ไขเพิ่มเติมระดับ T3 นี้ใช้ผูกชุดโปรแกรมที่แก้ปัญหาการตรวจ Usage และผ่าน Independent QA แล้ว เข้ากับการลองรันขั้นตอนสร้างบัญชีผู้ใช้ (`Accounts phase`) บน Temporary Staging แบบแยกอิสระที่มีอยู่ โดยอนุญาตให้ลองเพียงหนึ่งครั้งภายใต้ขอบเขตที่กำหนด

เอกสารนี้ **ไม่อนุญาต** ให้ดำเนินการกับ Production, Deploy, Migration, การตั้งค่า, Schedule, การประมวลผล Notification, ขั้นตอนสร้างข้อมูลทดสอบส่วนถัดไป, UAT, Restore, Cleanup หรือการลบข้อมูล

สถานะ: **ข้อเสนอ — รอเจ้าของอนุมัติ Scope Amendment และอนุญาตให้ดำเนินการบน Staging**

## 2. สภาพแวดล้อมและ Source ที่ผูกไว้อย่างแน่นอน

- ชื่อ Temporary Staging: `gisp-lean-staging-20260923`
- Project ID: `a24aff68-a82e-41da-b64a-a128a1539769`
- Host marker: `5wjnzj4y`
- Region / ขนาดระบบ: `ap-southeast` / `nano`
- CLI context แบบแยกอิสระ: `C:\codex\GISP\.insforge-audit-lean-staging-new`
- Candidate commit: `8b2573729b7d2b8ad750414e1ba86daa633e4218`
- Candidate tree: `9cb01e050462ded9160ac2429667794b27ceaf00`
- Candidate manifest SHA-256: `89E51D111698D16467C16C2600218B9E1962468C6A09703152E5585026132ACD`
- จำนวน Migration / Migration ล่าสุด: `38` / `20260923090000_startup-initial-operations-guard.sql`
- สถานะ Release ที่ต้องยืนยัน: Stage `D` และเปิด slices `[7,8]`
- SMTP ต้องเป็น: `false` หรือปิดอยู่
- จำนวน Active Schedule ต้องเป็น: `0`

Production ID `865860c2-49fa-4e53-908f-9396b2f75233`, Production host `m8ugbyak`, Staging เก่า ID `33481c06-9ac0-43e0-a13f-88480e409441`, host เก่า `4tsmimwp`, Ghost Child ID `41df0506-ef0a-4753-9426-b1c8ed4f9ff6` และ Schedule ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8` ยังคงเป็นเป้าหมายต้องห้ามสำหรับการเขียนข้อมูล และห้ามปรากฏในข้อมูลคำสั่งที่จะนำไปเขียน

## 3. ชุดโปรแกรมที่แก้แล้วและค่า Hash ที่ผูกไว้

- Semantic manifest SHA-256 ซึ่งไม่เปลี่ยนจากเดิม: `2ABC5F6256AB15BB389D813FE7BCACC641C4E08F00F3EE2201E99A5D8AEF770D`
- Package aggregate SHA-256: `1155EFD89BDEB01ACD97BE1D1B535F45F093034A3BEEA3100C6979D5B0D6E73F`
- `PACKAGE-MANIFEST.json` SHA-256: `4FE9D753A49BE24FE1934BA086416989CE59A4249D7C906FAB4050436DB5DAEC`
- `collect-preflight.mjs`: `F49798421CB03104F510AD06BED4A4EAABBAD0D9F00DDA613716CFCA66E90555`
- `collect-preflight.test.mjs`: `CF4A7E7AA965286380B0EB8628FBE9999FD2CEF3E87F3585C500DD87BA707E29`
- `README.md`: `C950C96891242F604DB113FC9F253436A57282E91BF16013F82E971C05BC1EB0`
- รายงาน Independent QA SHA-256: `FA2F97A21CA906210423927BC65FA67A39076F47409EF738A04165C8549D5BDA`

Independent QA ตรวจผ่านดังนี้: ชุดทดสอบเฉพาะจุด `11/11`, ชุดทดสอบรวม `93/93`, ตรวจไวยากรณ์โค้ด `31/31`, ตรวจ Package seal และรายการไฟล์ทั้งหมด 33 ไฟล์ รวมถึง Dry-run ที่ยืนยัน `writes:false` และ `networkCalls:false` โดยไม่พบปัญหาระดับ Blocker, Major หรือ Minor

## 4. ลำดับการดำเนินการที่อนุญาต

1. ตรวจสอบค่าที่ผูกไว้ทั้งหมดในข้อ 2–3 แบบอ่านอย่างเดียว รวมถึง Bucket ที่กำหนดทั้งสามรายการ, ประวัติและ Migration ล่าสุด, สถานะ Release ปัจจุบัน, SMTP ต้องปิด, Active Schedule ต้องเป็นศูนย์, ต้องไม่มีเป้าหมายหรือข้อมูลคำสั่งที่มี marker ต้องห้าม และต้องไม่มีสถานะ Runner ที่ไม่คาดหมาย
2. ตรวจสอบว่าบัญชี Auth, ผู้ใช้ในระบบ, Member profile หรือ Organization สังเคราะห์ที่ตรงกับอีเมล 24 บัญชีและรหัส Organization 20 รายการยังไม่มีอยู่ หากพบข้อมูลที่มีอยู่แล้ว ซ้ำกัน สร้างไว้เพียงบางส่วน หรือผลตรวจไม่ชัดเจน ต้องหยุดทันที ห้าม Update, Delete, รวมข้อมูล หรือทดลองซ้ำโดยไม่ทราบผลเดิม
3. ภายในรอบการทำงานเดียวกัน ให้เก็บ Billing quote/snapshot ชุดใหม่จากข้อมูลที่ผู้ให้บริการแสดง โดยต้องมีอายุไม่เกิน 15 นาทีก่อนเริ่มเขียน Accounts ครั้งแรก หลักฐานต้องผูกกับ Organization `e93668ea-e8ab-4361-9872-282454438478`, Staging Project ID ที่กำหนด, ขนาด `nano` และครอบคลุม compute, backup, Storage และ usage โดยต้นทุนเพิ่มที่คาดการณ์รวมต้องไม่เกิน USD 10 Independent QA ต้องยืนยันหลักฐานใหม่นี้ก่อนเริ่มเขียนข้อมูล ห้ามใช้ Billing evidence ชุดเดิมที่หมดอายุ
4. ตรวจ Package seal, semantic hash และ preflight ซ้ำอีกครั้ง รายการ Usage ระดับ Organization อาจมี Project อื่นอยู่ได้เฉพาะในฐานะรายการอ่านอย่างเดียว แต่หลักฐานที่ระบบนำไปใช้ต้องเลือก Staging เป้าหมายที่ตรงเพียงหนึ่งรายการ และต้องไม่เปิดเผยหรือนำตัวตนหรือค่าการใช้งานของ Project อื่นไปใช้
5. รันเฉพาะ Runner phase `accounts` หนึ่งครั้ง โดยใช้คำยืนยัน `GLMVP_STAGING_WRITE` ไม่อนุญาตให้รันครั้งที่สองไม่ว่าจะอัตโนมัติหรือสั่งเอง หากผลการเขียนไม่ชัดเจน อนุญาตให้ตรวจสอบแบบอ่านอย่างเดียวเพื่อเทียบผลเท่านั้น จากนั้นต้องหยุด
6. บันทึกเฉพาะ checkpoint และหลักฐาน Local ที่ผ่านการตัดข้อมูลสำคัญออกแล้ว ห้ามบันทึกรหัสผ่าน, token, API key, database URL หรือข้อมูลส่วนบุคคล/ข้อมูลธุรกิจ และต้องนำรหัสผ่านสังเคราะห์ชั่วคราวออกจาก environment ของตัวดำเนินการเมื่อจบหรือหยุดขั้นตอน
7. หลังดำเนินการ ให้ตรวจสอบแบบอ่านอย่างเดียวว่าจำนวนบัญชี, Organization และ role ตรงตามกำหนด ผู้ทำหน้าที่แต่ละส่วนแยกจากกัน, SMTP ยังปิด, Active Schedule ยังเป็นศูนย์, Package ยังตรง และ Production ไม่เปลี่ยนแปลง Independent QA ต้องรายงาน PASS หรือ NO-GO ก่อนเริ่มขั้นตอนถัดไป

## 5. ขอบเขตข้อมูล Accounts ที่อนุญาต

อนุญาตให้การลองครั้งนี้สร้าง Auth user สังเคราะห์ที่ verified/auto-confirmed โดยไม่ส่งอีเมล ได้สูงสุด `24` บัญชี ดังนี้

- Member ตั้งแต่ `pakapop39+glmvp-member-01@gmail.com` ถึง `pakapop39+glmvp-member-20@gmail.com` โดยแต่ละบัญชีต้องผ่าน Hosted onboarding flow ที่มีอยู่ แต่ละคนมี Organization สังเคราะห์แยกกันหนึ่งรายการ รหัสตั้งแต่ `GLMVP-STG-20260923-ORG-01` ถึง `GLMVP-STG-20260923-ORG-20` และใช้ role `MEMBER` ที่มีอยู่แล้ว
- บัญชีทีมงาน `pakapop39+glmvp-admin@gmail.com`, `pakapop39+glmvp-operations@gmail.com`, `pakapop39+glmvp-finance@gmail.com` และ `pakapop39+glmvp-logistics@gmail.com`
- บัญชี Admin อาจใช้ private function `operator_bootstrap_super_admin(UUID,TEXT)` ที่เคยอนุมัติไว้แล้วได้เพียงหนึ่งครั้ง โดยใช้ Auth User ID ที่ระบบคืนมาและชื่อ `GLMVP-STG-20260923 Admin` ห้ามใช้ `claim_initial_super_admin`
- บัญชีทีมงานอื่นต้องใช้เฉพาะขั้นตอนจัดการผู้ใช้ Admin App/API ที่มีอยู่ และใช้ job group เดิมเท่านั้น ได้แก่ Operations → `MEMBER_ADMIN`, `PRODUCT_ADMIN`, `ORDER_ADMIN`, `PURCHASING`, `QC`; Finance → `FINANCE`; Logistics → `LOGISTICS` โดย role ของทีมงานต้องมี `organization_id=NULL`

ห้ามสร้างหรือแก้ไขคำจำกัดความของ role, permission หรือ `role_permissions` และเอกสารแก้ไขเพิ่มเติมนี้ไม่อนุญาตให้สร้าง Warehouse, Category, Product, สูตรราคา, Custom RFQ, Order, Payment, ไฟล์, Notification job หรือข้อมูลทดสอบของขั้นตอนถัดไป

## 6. เงื่อนไขที่ต้องหยุด

ต้องหยุดก่อนการเขียนครั้งถัดไป หากข้อมูลตัวตน, hash, Project, host, region, tier, Package seal, ประวัติหรือ Migration ล่าสุด, Bucket, สถานะ Release, SMTP, Schedule, ต้นทุน หรืออายุ Billing evidence ไม่ตรงตามเอกสาร หรือหากพบอีเมล/Organization ที่กำหนดมีอยู่แล้ว พบ marker ต้องห้ามในเป้าหมายหรือข้อมูลคำสั่งที่จะเขียน รหัสผ่านหรือ Secret จะถูกบันทึกลงหลักฐาน Runner เสนอจำนวนข้อมูล Accounts เกินขอบเขต ผลลัพธ์ใดหายไปหรือไม่ชัดเจน หรือ Accounts phase/test/QA ไม่ผ่าน

เมื่อเกิดเงื่อนไขดังกล่าว ห้าม Deploy, ทำ Migration, ซ่อมข้อมูล, ลองซ้ำ, Update หรือ Delete เพื่อบังคับให้ผลผ่าน

## 7. สิ่งที่ไม่อนุญาตอย่างชัดเจน

- ห้าม App deploy/redeploy, Migration/DDL/ACL, `up --all`, เปลี่ยน config/secret, เปิด Schedule, ประมวลผล/ส่ง/ลองส่ง Notification ซ้ำ, Backup/Restore, Cleanup หรือ Delete
- ห้ามดำเนินขั้นตอน Catalog, Warehouse, สูตรราคา, RFQ, Order, Payment, Production/QC, Logistics, Recovery หรือ UAT
- ห้ามแก้ Staging เก่า, Ghost Child หรือ Production
- เอกสารนี้ไม่ใช่การอนุมัติ Production Release

## 8. ข้อความเสนอเพื่ออนุมัติ

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment, การผูก Package Hash ใหม่ และการดำเนินการขั้นตอน Accounts บน Staging ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — การผูก Package ใหม่และลองขั้นตอนบัญชีผู้ใช้บน Lean Staging ครั้งที่ 1 v0.1` และ checksum companion ที่แนบ เฉพาะ Temporary Staging `gisp-lean-staging-20260923` Project ID `a24aff68-a82e-41da-b64a-a128a1539769`, host marker `5wjnzj4y`, region `ap-southeast`, tier `nano` โดยผูก candidate commit `8b2573729b7d2b8ad750414e1ba86daa633e4218`, tree `9cb01e050462ded9160ac2429667794b27ceaf00`, semantic SHA-256 `2ABC5F6256AB15BB389D813FE7BCACC641C4E08F00F3EE2201E99A5D8AEF770D`, package aggregate SHA-256 `1155EFD89BDEB01ACD97BE1D1B535F45F093034A3BEEA3100C6979D5B0D6E73F`, package manifest SHA-256 `4FE9D753A49BE24FE1934BA086416989CE59A4249D7C906FAB4050436DB5DAEC` และรายงาน Independent QA SHA-256 `FA2F97A21CA906210423927BC65FA67A39076F47409EF738A04165C8549D5BDA` อนุญาตให้ตรวจ preflight แบบอ่านอย่างเดียว สร้าง Billing evidence ชุดใหม่จากข้อมูลที่ผู้ให้บริการแสดงซึ่งมีอายุไม่เกิน 15 นาที และให้ Independent QA ยืนยันก่อนเขียนข้อมูล จากนั้นรันเฉพาะ Runner phase `accounts` ด้วยคำยืนยัน `GLMVP_STAGING_WRITE` หนึ่งครั้ง อนุญาต Auth user สังเคราะห์สูงสุด 24 บัญชี, Organization/Member profile สังเคราะห์สูงสุด 20/20, ใช้ role/job group ที่มีอยู่แล้ว และเรียก private function `operator_bootstrap_super_admin(UUID,TEXT)` หนึ่งครั้งตามตัวตน ลำดับ และเงื่อนไขหยุดที่กำหนดในเอกสาร ห้ามใช้ Billing evidence ชุดเดิม ห้ามลองรันครั้งที่สอง และหากพบข้อมูลทดสอบเดิม ข้อมูลซ้ำ ข้อมูลบางส่วน ผลลัพธ์ไม่ชัดเจน หรือ preflight/hash/identity/cost/SMTP/Schedule ไม่ตรง ให้หยุดโดยไม่ Update/Delete หรือแก้ข้อมูลเพื่อบังคับให้ผ่าน ห้าม Deploy, Migration, เปลี่ยน Config/Secret/Schedule, ประมวลผล/ส่ง/ลองส่ง Notification ซ้ำ, ดำเนิน phase อื่น, Restore, Cleanup/Delete, แก้ Staging เก่า, Ghost Child หรือ Production ให้ใช้เวลาของข้อความนี้เป็น `approved_at` กำหนด `data_authority: ข้อมูล Accounts สังเคราะห์ตามขอบเขตที่กำหนดบน Staging ที่ระบุเท่านั้น`, `migration_authority: None`, `deploy_authority: None`, `notification_authority: None`, `staging_allowed: Yes เฉพาะ Accounts phase ที่กำหนดและการตรวจแบบอ่านอย่างเดียว`, และ `production_allowed: No`

## 9. เงื่อนไขการปิด Amendment นี้

Amendment นี้จะถือว่าปิดเมื่อ Accounts phase ที่กำหนดผ่านพร้อมหลักฐานจาก Independent QA หรือหยุดแบบ Fail Closed โดยไม่มีการเขียนที่ไม่ได้รับอนุญาต ขั้นตอน Staging ส่วนถัดไปยังคงต้องผ่านเงื่อนไขและหลักฐานตามแผนเดิมแยกต่างหาก
