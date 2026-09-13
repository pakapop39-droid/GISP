# คู่มือ UAT — PDF Catalog Import v1.0

เอกสารนี้ใช้เตรียมและวัดผล UAT บน Development เท่านั้น ไม่อนุญาต Production และไม่ใช่ผล UAT ในตัวเอง

ไฟล์ `.TEMPLATE.json` เป็นเพียงแบบฟอร์ม ตัว evaluator จะปฏิเสธไฟล์ที่ยังมีสถานะ `TEMPLATE_NOT_APPROVED` หรือ `TEMPLATE_NOT_RUN` เสมอ ห้ามนำ template หรือผลจากข้อมูลสมมติไปอ้างว่าเกณฑ์ผ่าน

## สิ่งที่เจ้าของต้องเตรียม

1. PDF ที่มีสิทธิ์ใช้งานอย่างน้อย 4 ไฟล์ ครบทั้ง:
   - ภาษาจีนแบบเลือกข้อความได้ (`CN / NATIVE_TEXT`)
   - ภาษาจีนแบบสแกน (`CN / SCANNED`)
   - ภาษาอังกฤษแบบเลือกข้อความได้ (`EN / NATIVE_TEXT`)
   - ภาษาอังกฤษแบบสแกน (`EN / SCANNED`)
2. อย่างน้อยหนึ่งไฟล์ต้องมี 100 หน้าพอดี เพื่อวัดเวลา 30 นาที
3. คำตอบอ้างอิงรวมอย่างน้อย 100 สินค้า ซึ่งเจ้าของหรือผู้เชี่ยวชาญสินค้าอ่านจาก PDF และอนุมัติแล้ว
4. Supplier ที่ถูกต้องสำหรับ PDF แต่ละไฟล์

ค่าที่ไม่มีหลักฐานใน PDF ต้องใส่ `null` ห้ามเดา ค่า `null` ยังถูกนำไปวัดด้วย: ถ้าระบบสร้างข้อมูลที่ PDF ไม่มี จะถือว่าผิด

## ขั้นที่ 1 — ทำ Ground Truth

ให้ QA คัดลอก `docs/uat/pdf-catalog-import-v1/ground-truth.TEMPLATE.json` ไปเป็นไฟล์ทำงาน เช่น `output/pdf-catalog-uat/ground-truth.json` แล้วแทนที่ข้อมูลตัวอย่างทั้งหมด

แต่ละ PDF ต้องมี:

- `catalogId` ที่ไม่ซ้ำกัน
- ภาษาและชนิด PDF
- จำนวนหน้าจริง
- SHA-256 ของไฟล์จริง
- SHA-256 ต้องไม่ซ้ำกันทั้ง 4 catalog เพื่อยืนยันว่าเป็น PDF จริงคนละไฟล์ ไม่ใช่ไฟล์เดียวเปลี่ยน label
- `declaredProductCount` ที่ตรงกับจำนวนสมาชิกใน `products`

บน Windows ตรวจ SHA-256 ได้ด้วย:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\path\catalog.pdf'
```

แต่ละสินค้าต้องมี `groundTruthId` ไม่ซ้ำ หน้าอ้างอิง และ `expected` ครบทุกช่อง หากไม่มีหลักฐานให้ใส่ `null`:

`sku`, `factorySku`, `nameZh`, `nameEn`, `nameThDraft`, `productType`, `categoryId`, `countryCode`, `leadTimeDays`, `widthMm`, `depthMm`, `heightMm`, `weightKg`, `cbm`, `materialSummary`, `finishSummary`, `moq`, `descriptionTh`, `specificationSummary`, `sourcePage`

- `readableSku=true` เฉพาะ SKU ที่มนุษย์อ่านได้ชัดจากต้นฉบับ
- `imageAssessable=true` เมื่อผู้เชี่ยวชาญระบุรูปสินค้าที่ถูกต้องได้ และต้องใส่ `expectedImageRef`
- จำนวนสินค้าจริงรวมต้องตรงกับ `declaredProductCount` และไม่น้อยกว่า 100

เมื่อผู้เชี่ยวชาญตรวจครบ ให้เจ้าของเปลี่ยน `approval.status` เป็น `OWNER_APPROVED` พร้อมชื่อและเวลา ISO ใน `approvedBy`/`approvedAt` การเปลี่ยนสถานะก่อนตรวจครบทำให้หลักฐานใช้ไม่ได้

## ขั้นที่ 2 — อัปโหลดและรอผลดิบ

ขั้นนี้ทำหลัง Backend Branch พร้อมและ Feature Flag เปิดเฉพาะ Development แล้วเท่านั้น

1. เข้าเมนู Admin → Catalog → Import
2. เลือก `PDF Catalog`
3. เลือก Supplier ให้ตรงกับไฟล์
4. อัปโหลด PDF ทีละไฟล์
5. จด Job ID และเวลาเริ่ม
6. รอจนสถานะเป็น `READY_FOR_REVIEW`
7. หยุดก่อนแก้ชื่อ เลือกรูป อนุมัติ หรือปฏิเสธ เพราะต้อง export “ผลดิบจากระบบ” ก่อน Human Review

หากไฟล์ไม่ผ่าน malware/encryption/structure check ให้บันทึกรหัสข้อผิดพลาดและไม่นับเป็นงานที่พร้อมตรวจ ห้ามเปิดหรือ Retry การตรวจความปลอดภัยแบบข้ามขั้น

## ขั้นที่ 3 — Export ผลดิบ

รุ่นปัจจุบันยังไม่มีปุ่ม Export UAT แบบคลิกครั้งเดียว ขั้นนี้ให้ QA หรือผู้ดูแลระบบที่มี `catalog.import` เป็นผู้ทำ ห้ามส่ง access token หรือ Signed URL ให้ผู้อื่น

1. ขณะล็อกอิน Development ให้เก็บคำตอบจาก `GET /api/admin/catalog/imports/{JOB_ID}?page=1&pageSize=100`
2. หากมีมากกว่า 100 รายการ ให้เพิ่ม `page=2`, `page=3` จนครบตาม `pagination.totalPages`
3. นำเฉพาะ normalized row และ candidate image metadata มาลงในสำเนา `docs/uat/pdf-catalog-import-v1/results.TEMPLATE.json`
4. เปลี่ยน `status` เป็น `COMPLETED_EXPORT`
5. ห้ามแก้ค่าที่ระบบสกัดเพื่อให้ตรง Ground Truth
6. ใส่ `sourcePdfSha256` จาก `job.file_sha256`; evaluator จะหยุดทันทีถ้าไม่ตรง Ground Truth

การ map ช่องผลลัพธ์:

| Results JSON | ข้อมูลจาก Import |
| --- | --- |
| `candidateId` | `row.id` |
| `matchedGroundTruthId` | รหัส Ground Truth ของสินค้าชิ้นเดียวกัน หรือ `null` ถ้าเป็น false positive |
| `selectedImageFileId` | `row.selected_image_file_id`; ถ้าระบบไม่ได้จับคู่รูปให้ใช้ `null` ห้ามเลือกแทนระบบก่อนวัดผล |
| `selectedImageRef` | QA เปิดรูปจาก `selectedImageFileId` เทียบกับรูป Ground Truth: ถ้าตรงให้ใส่ `expectedImageRef`; ถ้าผิดให้ใส่ `UNMATCHED:<file-id>` และถ้าไม่มีรูปให้ใช้ `null` |
| `fields.sku` | `row.sku` |
| `fields.factorySku` | `row.factory_sku` |
| `fields.nameZh` / `nameEn` / `nameThDraft` | `row.name_zh` / `name_en` / `name_th_draft` |
| `fields.productType` / `categoryId` / `countryCode` | `row.product_type` / `category_id` / `country_code` |
| ช่องตัวเลขและรายละเอียด | คอลัมน์ชื่อเดียวกันในรูป snake_case |
| `fields.sourcePage` | `row.source_page_number` |

`matchedGroundTruthId` เป็น annotation สำหรับวัดว่า “ตรวจพบสินค้าชิ้นไหน” ไม่ใช่ช่องให้แก้คำตอบของระบบ หนึ่ง Ground Truth จับคู่ได้ไม่เกินหนึ่ง Candidate และห้ามจับคู่ข้าม PDF

สำหรับงาน 100 หน้า ให้เพิ่ม `performanceRuns` โดยใช้:

- `startedAt`: `job.created_at` จากระบบ ห้ามใช้เวลาที่จดหรือประมาณเอง
- `readyForReviewAt`: เวลาที่งานเข้าสู่ `READY_FOR_REVIEW` ครั้งแรก
- ห้ามใช้เวลาหลังเจ้าหน้าที่แก้ข้อมูล หรือกรอกเวลาประมาณ

## ขั้นที่ 4 — รัน Evaluator

เปิด Terminal ที่โฟลเดอร์โครงการแล้วรัน:

```powershell
npm run evaluate:pdf-catalog:uat -- --ground-truth output/pdf-catalog-uat/ground-truth.json --results output/pdf-catalog-uat/results.json --output output/pdf-catalog-uat/evaluation.json
```

ความหมายของ exit code:

- `0`: ผ่าน threshold อัตโนมัติทั้งหมด
- `1`: input ถูกต้อง แต่มีอย่างน้อยหนึ่ง threshold ไม่ผ่าน
- `2`: โครงสร้าง/approval/matrix/จำนวนสินค้า/การจับคู่ไม่ถูกต้อง จึงยังวัดผลไม่ได้

Evaluator ตรวจเกณฑ์ต่อไปนี้:

- Product Detection Recall อย่างน้อย 95%
- SKU ตรงทุกอักขระอย่างน้อย 98% โดย denominator คือ SKU ที่ Ground Truth ระบุว่าอ่านได้ทั้งหมด; สินค้าที่ระบบตรวจไม่พบถือว่าผิด
- ความถูกต้องของแต่ละ field อย่างน้อย 90% และค่าเฉลี่ยทุก field อย่างน้อย 90%
- Image Association Accuracy อย่างน้อย 90%
- มีงาน 100 หน้าจริงอย่างน้อยหนึ่งงานและเข้าสู่ `READY_FOR_REVIEW` ไม่เกิน 1,800 วินาที

## ขั้นที่ 5 — ตรวจและลงนามผล

1. QA ตรวจ `evaluation.json`, input สองไฟล์ และ PDF hash ว่าตรงกัน
2. Human Reviewer เปิด PDF เทียบ Candidate ตัวอย่างและรายการผิด โดยเฉพาะชื่อไทย รูป และ SKU
3. ผล evaluator ที่ `pass=true` ยังไม่ใช่การอนุมัติ UAT หรือ Release โดยอัตโนมัติ
4. เจ้าของต้องยืนยันผล Human UAT แยก และการ merge/deploy Development ต้องมี authorization ตามขั้นตอน
5. Production ไม่อยู่ในขอบเขตนี้และต้องมี Release Authorization แยกต่างหาก

## ไฟล์อ้างอิง

- Schema Ground Truth: `docs/uat/pdf-catalog-import-v1/ground-truth.schema.json`
- Schema Results: `docs/uat/pdf-catalog-import-v1/results.schema.json`
- Template Ground Truth: `docs/uat/pdf-catalog-import-v1/ground-truth.TEMPLATE.json`
- Template Results: `docs/uat/pdf-catalog-import-v1/results.TEMPLATE.json`
- Evaluator: `scripts/pdf-catalog-uat/evaluate.mjs`
- Unit tests: `scripts/pdf-catalog-uat/evaluator-core.test.mjs`
