# GISP MVP

เว็บแอปบริหารการสั่งซื้อเฟอร์นิเจอร์และวัสดุตกแต่งจากจีนสำหรับสมาชิก GISP

> เอกสารใน `docs/active/` และรายการ Active Documents ด้านล่างเป็น Requirement ชุดปัจจุบันเท่านั้น
> เอกสารใน `docs/archive/` ใช้ตรวจประวัติหรือกู้คืนและไม่มีอำนาจกำหนด Requirement

## Development ที่ใช้งานอยู่

- หน้าเว็บ: `https://gisp-mvp-development.insforge.site`
- InsForge Project: `gisp-mvp-development` (`ap-southeast`)
- Environment นี้ใช้ข้อมูลทดสอบเท่านั้น

## Demo-first

- Demo ออนไลน์: `https://gisp-mvp-demo.insforge.site`
- InsForge Project: `gisp-mvp-demo` (`ap-southeast`)
- Story และชุดข้อมูลหลัก: `docs/active/DEMO STORY AND MOCK DATA.md`
- Fixture และ Scene Engine: `src/demo`
- Demo 1.4: `/v1-4`; Member Application: `/v1-4/member`; GISP Back Office: `/v1-4/admin`; Guided Overview: `/v1-4/overview`
- Demo Application 1.3 อยู่ที่ `/v1-3` เป็น Historical Baseline และยังรองรับลิงก์ `?mode=overview` / `?mode=prototype` เดิม
- Demo 1.4 ใช้ Browser-local Shared State Schema 4 แยกจาก Version 1.3 และซิงก์งานระหว่างสอง Portal หลัง Refresh
- มี Dynamic Document Preview, Browser-local Audit และเอกสาร Baseline PDF/Excel
- Demo 1.4 ใช้ key `gisp-demo-prototype-v14`; Demo 1.3 ใช้ `gisp-demo-prototype-v3`; Transaction API ทั้งหมดยังตอบ 404 และไม่เขียนข้อมูลลง Development
- Demo Gate ผ่านแล้วเมื่อ 18 สิงหาคม 2569: `APPROVED FOR MVP BUILD` โดย Human UAT Version 1.4 ผ่าน 8/8 หมวด

## เริ่มใช้งานในเครื่อง

1. ติดตั้ง Node.js 22 ขึ้นไป
2. รัน `npm install`
3. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า InsForge
4. Link InsForge ด้วย `npx @insforge/cli link`
5. Apply Migration ด้วย `npx @insforge/cli db migrations up --all`
6. สร้าง Storage Bucket ตาม `docs/INSFORGE SETUP.md`
7. รัน `npm run dev`

## Deploy หน้าเว็บผ่าน InsForge

1. ตรวจ Environment Variables ด้วย `npx @insforge/cli deployments env list`
2. ตรวจ Build ด้วย `npm run check`
3. Deploy Source Root ด้วย `npx @insforge/cli deployments deploy .`
4. ตรวจสถานะด้วย `npx @insforge/cli deployments status <deployment-id>`

ทั้ง Frontend Hosting และ Backend บริหารผ่าน InsForge ไม่ต้องสร้าง Frontend Project แยกกับผู้ให้บริการอื่น

## คำสั่งตรวจคุณภาพ

* `npm run typecheck`
* `npm run test`
* `npm run build`
* `npm run check`

## เอกสารควบคุม

ให้อ่านและตัดสินข้อขัดแย้งตามลำดับนี้:

1. [MVP Business Master Plan](docs/active/MVP%20BUSINESS%20MASTER%20PLAN.md)
2. [Decision Log](docs/active/DECISION%20LOG.md)
3. [MVP Implementation Plan](docs/active/MVP%20IMPLEMENTATION%20PLAN.md)
4. [Database Schema](docs/active/DATABASE%20SCHEMA.md)
5. UX/UI: [Volume 1](docs/active/UX-UI%20FLOW%20VOLUME%201.md), [Volume 2](docs/active/UX-UI%20FLOW%20VOLUME%202.md), [Volume 3-A](docs/active/VOLUME%203-A.md), [Volume 3-B](docs/active/VOLUME%203-B.md), [Volume 3-C](docs/active/VOLUME%203-C.md), [Volume 3-D](docs/active/VOLUME%203-D.md)
6. [Requirement Traceability](docs/REQUIREMENT%20TRACEABILITY.md)

เอกสารสนับสนุนที่ยัง Active:

- [Current Project Status](docs/active/CURRENT%20PROJECT%20STATUS.md) — สถานะล่าสุด ช่องว่างเทียบแผน และลำดับงานที่แนะนำสำหรับเริ่มทำงานต่อ
- [Demo 1.4 UAT Sign-off Evidence](docs/evidence/2026-08-18-demo-1.4-uat-signoff.pdf) — หลักฐาน Human UAT ผ่าน 8/8 และอนุมัติให้เริ่ม MVP Build
- [Demo Story and Mock Data](docs/active/DEMO%20STORY%20AND%20MOCK%20DATA.md) — แยก Historical Demo 1.3 และ Deployed Demo 1.4 พร้อม UAT 8 หมวด
- [GISP Visual Design Instruction](docs/active/GISP%20VISUAL%20DESIGN%20INSTRUCTION.md) — แนวทาง Quiet Architectural Operations สำหรับ Member Application, Back Office และหน้าที่พัฒนาต่อไป
- [InsForge Setup](docs/INSFORGE%20SETUP.md)

## Post-MVP และ Archive

- [Post-MVP Backlog](docs/post-mvp/POST-MVP%20BACKLOG.md) เป็นรายการรอพิจารณา ไม่ใช่คำสั่งให้พัฒนา
- [Pre-cleanup Archive](docs/archive/2026-08-01-pre-cleanup/README.md) เก็บเอกสารก่อนรวมชุด Active พร้อม SHA-256
- [Pre-pricing/samples/warranty Archive](docs/archive/2026-08-01-pre-pricing-samples-warranty/ARCHIVE%20README.md) เก็บเอกสาร Active ก่อนคำตัดสิน DEC-037 ถึง DEC-042 พร้อม SHA-256
- Demo 1.4 แบบแยกสอง Portal และ Shared State Schema 4 เป็น Target MVP Gate ตาม DEC-043

อย่า Commit `.env.local`, `.insforge/project.json` หรือ API Key
