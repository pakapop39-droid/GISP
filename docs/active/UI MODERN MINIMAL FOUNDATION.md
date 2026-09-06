# GISP UI Foundation — Modern Simple Minimal

อัปเดต: 28 สิงหาคม 2026

สถานะ: **อนุมัติและขยาย UI Foundation ครบทุกหน้าปัจจุบันแล้ว** เมื่อ 28 สิงหาคม 2026

## เป้าหมาย

ทำให้ GISP ดูทันสมัย เรียบง่าย และใช้งานได้เร็วขึ้น โดยรักษาสีเขียวเข้ม ครีม ทอง และแดงเดิม รวมถึงไม่เปลี่ยน Workflow, API, Permission หรือข้อมูลในระบบ

## ผลการตรวจ UI เดิม

- โทนสีมีเอกลักษณ์และเหมาะกับแบรนด์อยู่แล้ว
- Serif ขนาดใหญ่และภาพ Hero หลายหน้าทำให้เนื้อหางานถูกลดความสำคัญ
- Radius, กรอบ,เงา และขนาดตัวอักษรของแต่ละโมดูลยังไม่สม่ำเสมอ
- Dashboard เดิมเน้นข้อมูลเชิงเทคนิคมากกว่างานที่สมาชิกต้องเริ่มทำ
- Catalog มีข้อมูลครบ แต่แถบค้นหาและการ์ดสินค้ายังมีรายละเอียดตกแต่งมากเกินไป

## Design System รอบแรก

### สี

- Canvas: `#F6F4EF`
- Surface: `#FFFFFF`
- Ink: `#17201C`
- Muted: `#69706B`
- Jade: `#1D6651`
- Lacquer: `#A82D21`
- Brass: `#A77B32`
- Line: `#DEDDD7`

### หลักการตัวอักษร

- ใช้ Noto Sans Thai กับหัวข้อ H1–H6, ปุ่ม, ฟอร์ม และข้อมูลทุกหน้าใน Member/Admin
- ใช้ Serif เฉพาะพื้นที่ Brand/Editorial และหน้า Demo ที่จำเป็น ไม่ใช้กับข้อมูลปฏิบัติการ
- หัวข้อหน้าหลัก 34–52px, หัวข้อ Section 22px, เนื้อหา 14–16px

### รูปทรงและระยะ

- Radius หลัก 8px, 12px และ 18px
- Control สูง 44–52px เพื่อกดง่าย
- ใช้เงาเฉพาะ Hover หรือจุดที่ต้องแยกชั้นข้อมูล
- ลดเส้นกรอบซ้อนและลดภาพตกแต่งในหน้าทำงาน

### สถานะและการเข้าถึง

- สถานะมีทั้งสีและข้อความเสมอ
- Focus ring สีทองเพื่อใช้งานด้วยคีย์บอร์ดได้ชัดเจน
- รองรับ Reduced Motion
- Layout ตัวอย่างรองรับ Desktop, Tablet และ Mobile

## หน้าตัวอย่างรอบแรก

1. Login — ลดองค์ประกอบตกแต่ง เหลือ Brand assurance และฟอร์มที่ชัดเจน
2. Member Dashboard — เปลี่ยนเป็นภาพรวมบัญชีและทางลัดเริ่มงาน
3. Member Catalog — ลด Hero, ทำ Toolbar และ Product Card ให้เรียบและสม่ำเสมอ

## ขอบเขตที่ไม่เปลี่ยน

- Authentication และ Session
- Role และ Permission
- API และ Database
- Workflow และสถานะของทุก Slice
- ข้อมูลสินค้า โครงการ และ RFQ

## ผลการขยายรูปแบบทั้งระบบ

- [x] Member Dashboard, Catalog, Product Detail, Project, Project Detail และ Custom RFQ
- [x] Operations/Admin Dashboard, Catalog, Import, Batch, Product, Member, User, Role, Settings, Log, Showroom และ Custom RFQ
- [x] Login, Register, Password Recovery, Onboarding และ Account Status
- [x] Component กลางสำหรับ Hero, Panel, Card, Form, Table, List, Status, Alert, Empty State และ Button
- [x] Desktop, Tablet และ Mobile responsive rules
- [x] Keyboard Focus, Reduced Motion และ WCAG color contrast
- [x] Historical Demo 1.3/1.4 ถูกแยกไว้ตามเดิมและไม่รับผลจาก Production UI Foundation

## Quality Gate รอบขยายครบทุกหน้า

- ESLint: ผ่าน
- TypeScript: ผ่าน
- Automated Test: 85/85 ผ่าน
- Next.js Production Build: ผ่าน 82 หน้า
- Browser Verification: Desktop/Mobile แสดงผลปกติ ไม่มี Error Overlay หรือ Console Error
- Accessibility Audit: 0 violation บนหน้า Login และ Register ตัวแทนของ Public/Auth Layout

## บันทึกการอนุมัติ

- ผู้ใช้งานอนุมัติรูปแบบ Modern Simple Minimal และโทนสีปัจจุบัน
- อนุมัติให้ใช้ Noto Sans Thai กับหัวข้อและข้อมูลปฏิบัติการใน Member/Admin
- UI Preview รอบแรกและการขยายรูปแบบครบหน้าปัจจุบันปิดงานแล้ว
- หน้าที่พัฒนาเพิ่มในอนาคตต้องใช้ UI Foundation นี้เป็นมาตรฐานตั้งแต่เริ่มต้น
