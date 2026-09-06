# GISP MVP

เว็บแอปบริหารการสั่งซื้อเฟอร์นิเจอร์และวัสดุตกแต่งจากจีนสำหรับสมาชิก GISP

## Development ที่ใช้งานอยู่

- หน้าเว็บ: `https://gisp-mvp-development.insforge.site`
- InsForge Project: `gisp-mvp-development` (`ap-southeast`)
- Environment นี้ใช้ข้อมูลทดสอบเท่านั้น

## Demo-first

- Demo ออนไลน์: `https://gisp-mvp-demo.insforge.site`
- InsForge Project: `gisp-mvp-demo` (`ap-southeast`)
- Story และชุดข้อมูลหลัก: `DEMO STORY AND MOCK DATA.md`
- แผนรวม Demo เป็นเส้นทางเดียวแบบ Optional Enhancement (ไม่ใช่ MVP Gate): `FULL DEMO MASTER PLAN.md`
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

1. `MVP BUSINESS MASTER PLAN.md`
2. `DECISION LOG.md`
3. `MVP IMPLEMENTATION PLAN.md`

อย่า Commit `.env.local`, `.insforge/project.json` หรือ API Key
