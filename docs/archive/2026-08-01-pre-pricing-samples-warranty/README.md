# GISP MVP

เว็บแอปบริหารการสั่งซื้อเฟอร์นิเจอร์และวัสดุตกแต่งจากจีนสำหรับสมาชิก GISP

> เอกสารที่ Root และรายการ Active Documents ด้านล่างเป็น Requirement ชุดปัจจุบันเท่านั้น
> เอกสารใน `docs/archive/` ใช้ตรวจประวัติหรือกู้คืนและไม่มีอำนาจกำหนด Requirement

## Development ที่ใช้งานอยู่

- หน้าเว็บ: `https://gisp-mvp-development.insforge.site`
- InsForge Project: `gisp-mvp-development` (`ap-southeast`)
- Environment นี้ใช้ข้อมูลทดสอบเท่านั้น

## Demo-first

- Demo ออนไลน์: `https://gisp-mvp-demo.insforge.site`
- InsForge Project: `gisp-mvp-demo` (`ap-southeast`)
- Story และชุดข้อมูลหลัก: `DEMO STORY AND MOCK DATA.md`
- Fixture และ Scene Engine: `src/demo`
- หน้าแรกเลือกได้ 2 โหมด: Overview 10 ขั้น และ Functional Prototype ที่ใช้ State Schema Version 3
- Functional Prototype ครอบคลุม Workflow เดิม พร้อม Foundation/Permission, Product/Supplier Admin, Role Dashboard, Exception/Recovery และ UAT & Sign-off 8 Scenario
- เปิดตรงได้ด้วย `?mode=overview` หรือ `?mode=prototype`
- มี Dynamic Document Preview, Browser-local Audit และเอกสาร Baseline PDF/Excel
- Demo ใช้ Browser-local state key `gisp-demo-prototype-v3` และปิด Transaction API ทั้งหมด ไม่เขียนข้อมูลลง Development
- ตาม DEC-030 Human UAT และ Sign-off ใช้ Demo Version 1.3 นี้เป็น Baseline ปัจจุบัน

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

1. [MVP Business Master Plan](MVP%20BUSINESS%20MASTER%20PLAN.md)
2. [Decision Log](DECISION%20LOG.md)
3. [MVP Implementation Plan](MVP%20IMPLEMENTATION%20PLAN.md)
4. [Database Schema](DATABASE%20SCHEMA.md)
5. UX/UI: [Volume 1](UX-UI%20FLOW%20VOLUME%201.md), [Volume 2](UX-UI%20FLOW%20VOLUME%202.md), [Volume 3-A](VOLUME%203-A.md), [Volume 3-B](VOLUME%203-B.md), [Volume 3-C](VOLUME%203-C.md), [Volume 3-D](VOLUME%203-D.md)
6. [Requirement Traceability](docs/REQUIREMENT%20TRACEABILITY.md)

เอกสารสนับสนุนที่ยัง Active:

- [Demo Story and Mock Data](DEMO%20STORY%20AND%20MOCK%20DATA.md) — Demo Application Version 1.3 สำหรับ Human UAT 8 Scenario
- [InsForge Setup](docs/INSFORGE%20SETUP.md)

## Post-MVP และ Archive

- [Post-MVP Backlog](docs/post-mvp/POST-MVP%20BACKLOG.md) เป็นรายการรอพิจารณา ไม่ใช่คำสั่งให้พัฒนา
- [Pre-cleanup Archive](docs/archive/2026-08-01-pre-cleanup/README.md) เก็บเอกสารก่อนรวมชุด Active พร้อม SHA-256
- Full Demo Unified State Version 4 เป็น Optional Enhancement ที่อยู่ใน Archive และไม่ใช่ MVP Gate

อย่า Commit `.env.local`, `.insforge/project.json` หรือ API Key
