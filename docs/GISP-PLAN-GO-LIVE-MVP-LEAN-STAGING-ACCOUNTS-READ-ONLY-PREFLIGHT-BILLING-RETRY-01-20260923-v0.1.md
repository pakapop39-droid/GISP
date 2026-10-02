# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — ลองตรวจ Preflight และ Billing แบบอ่านอย่างเดียวใหม่สำหรับ Accounts ครั้งที่ 1 v0.1

## 1. จุดประสงค์

เอกสารแก้ไขเพิ่มเติมระดับ T3 นี้อนุญาตให้ลองตรวจ Preflight และสร้าง Billing evidence ชุดใหม่บน Temporary Staging หนึ่ง session แบบอ่านอย่างเดียว หลังรอบก่อนหน้าหยุดอย่างปลอดภัยเพราะคำสั่ง `deployments status ... --sync --json` เรียก POST เพื่ออัปเดต cached deployment metadata ซึ่งเกินขอบเขต strict read-only

เอกสารนี้ **ไม่อนุญาตให้รัน Accounts หรือเขียนข้อมูล Staging ใด ๆ**

## 2. หลักฐานเหตุการณ์และสถานะปัจจุบัน

- Stop Report SHA-256: `4976C8CBE1B112EC60D918347313E9C411762CB89C2787B7A781620FDAF63133`
- Independent QA Incident Report SHA-256: `65E7B7FD566C987AEAAD55E7F05BCB244967322B4DB42969E6A04EDD4850910F`
- Independent QA ตัดสิน `PASS` สำหรับการควบคุมเหตุการณ์ และ `NO-GO` สำหรับ Accounts execution
- Deployment ID และ Provider ID เดิม สถานะยัง `READY`
- ไม่พบ Accounts runner state/checkpoint และไม่มีการใช้ `GLMVP_STAGING_WRITE`
- ไม่พบการสร้าง Auth user, Organization, Member profile หรือข้อมูลธุรกิจ
- ไม่พบ Deploy/redeploy, Migration, Config, Secret, Schedule, Notification หรือ Production mutation
- Billing evidence จาก session เดิมเป็น `audit-only / expired` และห้ามนำกลับมาใช้

## 3. เป้าหมายและ Package ที่ต้องตรง

- Temporary Staging: `gisp-lean-staging-20260923`
- Project ID: `a24aff68-a82e-41da-b64a-a128a1539769`
- Host marker: `5wjnzj4y`
- Region / tier: `ap-southeast` / `nano`
- CLI context: `C:\codex\GISP\.insforge-audit-lean-staging-new`
- Candidate commit/tree: `8b2573729b7d2b8ad750414e1ba86daa633e4218` / `9cb01e050462ded9160ac2429667794b27ceaf00`
- Semantic SHA-256: `2ABC5F6256AB15BB389D813FE7BCACC641C4E08F00F3EE2201E99A5D8AEF770D`
- Package aggregate SHA-256: `1155EFD89BDEB01ACD97BE1D1B535F45F093034A3BEEA3100C6979D5B0D6E73F`
- Package manifest SHA-256: `4FE9D753A49BE24FE1934BA086416989CE59A4249D7C906FAB4050436DB5DAEC`

## 4. สิ่งที่อนุญาต

อนุญาตหนึ่ง session ใหม่สำหรับ:

1. ตรวจ exact Project/host/region/tier/standalone, Package seal, Migration 38/head, Bucket, Release D+[7,8], SMTP=false, Active Schedule=0, optional services และ notification jobs=0
2. ตรวจการชนกันของอีเมลสังเคราะห์ 24 บัญชีและ Organization code 20 รายการแบบอ่านอย่างเดียว
3. ตรวจ Deployment status ด้วยคำสั่งที่ไม่มี `--sync` เท่านั้น เช่น `deployments status <exact-id> --json`
4. ใช้เฉพาะคำสั่งหรือ API ที่เป็น GET/list/select/read-only และไม่มีผลข้างเคียง
5. สร้าง Billing quote/snapshot ชุดใหม่จากข้อมูลที่ผู้ให้บริการแสดง ผูก same session กับ Organization `e93668ea-e8ab-4361-9872-282454438478`, exact Staging, `nano`, compute, backup, Storage และ usage โดย projected incremental cost ต้องไม่เกิน USD 10
6. เขียนเฉพาะหลักฐาน Local ที่ sanitized พร้อม hash และเวลาเก็บหลักฐาน เพื่อส่ง Independent QA

## 5. สิ่งที่ห้าม

- ห้ามใช้ `--sync` กับ Deployment หรือคำสั่งอื่นที่ทำให้ provider metadata เปลี่ยน
- ห้าม POST/PUT/PATCH/DELETE/RPC หรือคำสั่ง create/update/apply/deploy/restore/process/send/retry
- ห้ามรัน Runner phase `accounts` และห้ามใช้ `GLMVP_STAGING_WRITE`
- ห้ามสร้างหรือแก้ Auth user, public user, Organization, Member profile, role หรือข้อมูลธุรกิจ
- ห้าม Deploy/redeploy, Migration/DDL/ACL, Config/Secret/Schedule, Notification, Backup/Restore, Cleanup/Delete
- ห้ามแก้ Staging เก่า, Ghost Child หรือ Production
- ห้ามใช้ Billing evidence จาก session ก่อนหน้า

## 6. เงื่อนไขหยุด

หยุดทันทีโดยไม่ลองซ้ำ หากคำสั่งที่จะใช้ไม่สามารถยืนยันว่าเป็น read-only, พบ identity/hash/history/bucket/release/SMTP/Schedule/cost ไม่ตรง, พบ fixture เดิมหรือบางส่วน, พบ marker ต้องห้ามใน target/payload, เกิดผลลัพธ์ไม่ชัดเจน หรือมีการเปลี่ยน provider/backend metadata ใด ๆ โดยไม่ตั้งใจ

หลักฐานชุดใหม่จะยังใช้รัน Accounts ไม่ได้จนกว่า Independent QA จะยืนยัน และเจ้าของจะอนุมัติ Accounts Execution แยกอีกครั้ง

## 7. ข้อความเสนอเพื่ออนุมัติ

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment และการลองตรวจ Preflight/Billing แบบอ่านอย่างเดียวใหม่ ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — ลองตรวจ Preflight และ Billing แบบอ่านอย่างเดียวใหม่สำหรับ Accounts ครั้งที่ 1 v0.1` และ checksum companion ที่แนบ เฉพาะ Temporary Staging `gisp-lean-staging-20260923` Project ID `a24aff68-a82e-41da-b64a-a128a1539769`, host marker `5wjnzj4y`, region `ap-southeast`, tier `nano` อนุญาตหนึ่ง session ใหม่โดยใช้เฉพาะ GET/list/select/read-only, ตรวจ Deployment status โดยห้าม `--sync`, สร้าง Billing quote/snapshot ชุดใหม่จาก provider-visible data และเขียนเฉพาะหลักฐาน Local ที่ sanitized เพื่อให้ Independent QA ตรวจ ห้ามใช้ Billing evidence เดิม ห้าม Runner phase `accounts`, `GLMVP_STAGING_WRITE`, POST/PUT/PATCH/DELETE/RPC, Backend/Staging data write, Deploy, Migration, Config/Secret/Schedule, Notification, Backup/Restore, Cleanup/Delete, Staging เก่า, Ghost Child และ Production หลัง QA ผ่านต้องขอ Accounts Execution Authorization แยกอีกครั้ง ให้ใช้เวลาของข้อความนี้เป็น `approved_at` กำหนด `data_authority: None`, `migration_authority: None`, `network_authority: Exact read-only GET/list/select on the named Staging and provider-visible Billing only`, `staging_allowed: Read-only only`, และ `production_allowed: No`

## 8. เงื่อนไขการปิด Amendment

Amendment นี้ปิดเมื่อได้หลักฐาน Preflight/Billing ชุดใหม่ที่ Independent QA ยืนยัน หรือหยุดแบบ Fail Closed โดยไม่มีการเขียน Backend/Staging/Production หลังจากนั้น Accounts execution ยังคงต้องขออนุมัติแยก
