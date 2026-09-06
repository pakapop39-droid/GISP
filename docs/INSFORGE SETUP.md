# InsForge Setup — GISP

## สถานะ Development ปัจจุบัน

ตรวจล่าสุดเมื่อ 1 สิงหาคม 2026:

| รายการ | ค่า |
|---|---|
| InsForge Project | `gisp-mvp-development` |
| Region | `ap-southeast` |
| หน้าเว็บ Development | `https://gisp-mvp-development.insforge.site` |
| Backend | `https://kit6y4pj.ap-southeast.insforge.app` |
| Database Migration | ใช้งานครบ 8 ฉบับ |
| Storage | `gisp-public`, `gisp-member-private`, `gisp-confidential` |
| Notification Retry | ทุก 10 นาที |

Environment นี้ใช้ข้อมูลทดสอบเท่านั้น ห้ามนำข้อมูล Production จริงมาใช้
Migration/API/UI ที่มีอยู่ใน Development เป็น Preliminary Baseline ตาม DEC-031 แม้ Target Demo
Version 1.4 จะผ่าน Human UAT 8/8 และ GISP Admin Sign-off แล้วเมื่อ 18 สิงหาคม 2569 การผ่าน
Demo Gate ไม่ใช้แทน Integration/UAT ของ Application จริง ส่วน Demo 1.3 เป็น Historical Baseline

## สถานะ Demo ปัจจุบัน

ตรวจล่าสุดเมื่อ 18 สิงหาคม 2026:

| รายการ | ค่า |
|---|---|
| InsForge Project | `gisp-mvp-demo` |
| Region | `ap-southeast` |
| หน้าเว็บ Demo | `https://gisp-mvp-demo.insforge.site` |
| Default URL | `https://yjswmb38.insforge.site` |
| App Mode | `demo` |
| Data | Browser-local fixture |
| Transaction API | ปิดทั้งหมด; อนุญาตเฉพาะ `/api/health` |
| Demo 1.4 | `/v1-4/member`, `/v1-4/admin`, `/v1-4/overview` |
| Historical Demo 1.3 | `/v1-3` และ Mode Query เดิม |
| Functional State | Version 1.4: `gisp-demo-prototype-v14`; Version 1.3: `gisp-demo-prototype-v3` |
| Latest Deployment | `9e7b2660-5979-4057-83c2-666d73a95156` — `READY` |
| Demo Gate | `APPROVED FOR MVP BUILD`; Human UAT PASS 8/8 |
| Approval Evidence | `evidence/2026-08-18-demo-1.4-uat-signoff.pdf` |

Demo Project ไม่ได้ Apply Database Migration และไม่ใช้ข้อมูลของ
`gisp-mvp-development` การ Deploy ใช้ `npx @insforge/cli deployments deploy .`
และตั้ง Custom Slug ด้วย `npx @insforge/cli deployments slug gisp-mvp-demo`
Functional Prototype ทั้งสอง Version ไม่ใช้ Auth, Database, Storage Upload, Email หรือ Transaction API
และ File Input เก็บเฉพาะ Metadata ใน Browser

## 1. Link Development Project

```powershell
npx @insforge/cli login
npx @insforge/cli link
npx @insforge/cli current
npx @insforge/cli memory list
```

อย่า Commit `.insforge/project.json`

## 2. Apply Migration

ควรใช้ Development Branch หรือ Project แยกก่อน:

```powershell
npx @insforge/cli db migrations list
npx @insforge/cli db migrations up --all
```

## 3. Create Storage Buckets

```powershell
npx @insforge/cli storage create-bucket gisp-public
npx @insforge/cli storage create-bucket gisp-member-private --private
npx @insforge/cli storage create-bucket gisp-confidential --private
```

Key ของ Private Bucket ต้องเริ่มด้วย Organization UUID:

```text
<organization_uuid>/<entity>/<entity_uuid>/<filename>
```

ตัวอย่าง:

```text
e4b08e7a-27b1-49f1-9a3e-b1a4f1c1a001/custom-request/9a.../drawing.pdf
```

## 4. Frontend Deployment และ Environment Variables

ใช้ `npx @insforge/cli secrets get ANON_KEY` และ URL จาก `.insforge/project.json`

ค่าที่อนุญาตให้หน้าเว็บใช้:

* `NEXT_PUBLIC_INSFORGE_URL`
* `NEXT_PUBLIC_INSFORGE_ANON_KEY`
* `NEXT_PUBLIC_APP_URL`

ค่า Server-only:

* `INSFORGE_URL`
* `INSFORGE_API_KEY`
* `CRON_SECRET`

ตั้งค่าและ Deploy ผ่าน InsForge:

```powershell
npx @insforge/cli deployments env list
npx @insforge/cli deployments env set NEXT_PUBLIC_INSFORGE_URL <project-url>
npx @insforge/cli deployments env set NEXT_PUBLIC_INSFORGE_ANON_KEY <anon-key>
npm run check
npx @insforge/cli deployments deploy .
```

ห้าม Deploy `.next`, `dist` หรือ `build` โดยตรง ให้ Deploy Source Root เท่านั้น

## 5. Scheduled Jobs

Notification Retry ใช้ InsForge Schedule เรียก Endpoint หรือ InsForge Function ที่มี Secret ป้องกัน:

```powershell
npx @insforge/cli schedules list
npx @insforge/cli schedules create --name "GISP Notification Retry" --cron "*/10 * * * *" --url "<protected-endpoint>" --method POST --headers '{"x-cron-secret":"${{secrets.CRON_SECRET}}"}'
```

## 6. First Super Admin

1. สมัครบัญชีผ่านหน้า Login
2. ยืนยันรหัสที่ได้รับทางอีเมล แล้ว Login
3. แจ้งผู้ดูแล Deployment ว่า “สมัครและเข้าสู่ระบบแล้ว” พร้อมอีเมลที่ใช้
4. ผู้ดูแลตรวจบัญชีและกำหนด `SUPER_ADMIN` ผ่านช่องทาง Privileged พร้อม Audit Log

ห้ามส่งรหัสผ่านให้ผู้ดูแลหรือบุคคลอื่น ฟังก์ชัน `claim_initial_super_admin`
ถูกถอนสิทธิ์จากผู้ใช้ทั่วไปแล้ว เพื่อป้องกันบุคคลอื่นชิงสิทธิ์ผู้ดูแลคนแรก

## 7. Email

Auth Email ใช้ InsForge Auth โดยตรง ส่วน Custom Transactional Email ต้องใช้แพ็กเกจ InsForge แบบชำระเงินและทดสอบใน Development/Staging ก่อน Production

Email Failure ต้องถูกเก็บเป็น Notification Job เพื่อ Retry และห้าม Rollback ธุรกรรมหลัก

## 8. Backup

ก่อน Production:

```powershell
npx @insforge/cli backups create --name pre-production --wait
npx @insforge/cli backups latest
```

การทดสอบ Restore ต้องทำใน Staging/Environment ที่ยอมให้ข้อมูลถูกเขียนทับเท่านั้น
