from __future__ import annotations

from pathlib import Path
from shutil import copy2
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
PUBLIC = ROOT / "public" / "demo-documents"
OUTPUT.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)

INK = colors.HexColor("#17201C")
PORCELAIN = colors.HexColor("#F4F0E7")
LACQUER = colors.HexColor("#A82D21")
JADE = colors.HexColor("#1D6651")
BRASS = colors.HexColor("#BC8F4B")
MIST = colors.HexColor("#D8DFDA")

pdfmetrics.registerFont(TTFont("Tahoma", r"C:\Windows\Fonts\tahoma.ttf"))
pdfmetrics.registerFont(TTFont("Tahoma-Bold", r"C:\Windows\Fonts\tahomabd.ttf"))

styles = getSampleStyleSheet()
BODY = ParagraphStyle(
    "BodyThai",
    parent=styles["BodyText"],
    fontName="Tahoma",
    fontSize=8.5,
    leading=13,
    textColor=INK,
)
SMALL = ParagraphStyle(
    "SmallThai", parent=BODY, fontSize=7, leading=10, textColor=colors.HexColor("#5E665F")
)
TITLE = ParagraphStyle(
    "TitleThai",
    parent=BODY,
    fontName="Tahoma-Bold",
    fontSize=20,
    leading=25,
    textColor=INK,
)
SUBTITLE = ParagraphStyle(
    "SubtitleThai",
    parent=BODY,
    fontName="Tahoma-Bold",
    fontSize=10,
    leading=14,
    textColor=LACQUER,
)
RIGHT = ParagraphStyle("RightThai", parent=BODY, alignment=TA_RIGHT)
RIGHT_BOLD = ParagraphStyle(
    "RightBoldThai", parent=RIGHT, fontName="Tahoma-Bold", fontSize=9
)
CENTER = ParagraphStyle("CenterThai", parent=BODY, alignment=TA_CENTER)

PRODUCTS = [
    ("CHR-LNG-001", "เก้าอี้เลานจ์", "Lobby", 8, 18500, 148000),
    ("TBL-SID-002", "โต๊ะข้าง", "Lobby", 12, 6200, 74400),
    ("CHR-DIN-014", "เก้าอี้รับประทานอาหาร", "All-day Dining", 24, 7900, 189600),
    ("LGT-PEN-009", "โคมไฟแขวน", "All-day Dining", 10, 9800, 98000),
    ("CUS-REC-001", "เคาน์เตอร์ต้อนรับสั่งผลิต", "Lobby", 1, 165000, 165000),
    ("CUS-HDB-010", "หัวเตียงบุผ้าสั่งผลิต", "Guest Rooms", 10, 22500, 225000),
]


def p(value: object, style: ParagraphStyle = BODY) -> Paragraph:
    return Paragraph(str(value), style)


def money(value: float) -> str:
    return f"{value:,.2f}"


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = doc.pagesize
    canvas.setFillColor(PORCELAIN)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(INK)
    canvas.rect(0, height - 11 * mm, width, 11 * mm, fill=1, stroke=0)
    canvas.setFont("Tahoma-Bold", 8)
    canvas.setFillColor(colors.white)
    canvas.drawString(18 * mm, height - 7 * mm, "GISP · GLOBAL INTERIOR SUPPLY PLATFORM")
    canvas.setFont("Tahoma-Bold", 9)
    canvas.setFillColor(LACQUER)
    canvas.setFillAlpha(0.10)
    canvas.translate(width / 2, height / 2)
    canvas.rotate(35)
    canvas.drawCentredString(0, 0, "DEMO · NOT FOR COMMERCIAL USE")
    canvas.setFillAlpha(1)
    canvas.rotate(-35)
    canvas.translate(-width / 2, -height / 2)
    canvas.setStrokeColor(colors.HexColor("#CFCCC3"))
    canvas.line(18 * mm, 13 * mm, width - 18 * mm, 13 * mm)
    canvas.setFillColor(colors.HexColor("#6E746F"))
    canvas.setFont("Tahoma", 6.5)
    canvas.drawString(18 * mm, 8 * mm, "ข้อมูลจำลองทั้งหมด · สร้างเพื่อสาธิต Workflow ของ GISP เท่านั้น")
    canvas.drawRightString(width - 18 * mm, 8 * mm, f"หน้า {doc.page}")
    canvas.restoreState()


def build_pdf(
    filename: str,
    title: str,
    number: str,
    subtitle: str,
    story: Iterable,
    pagesize=A4,
):
    path = OUTPUT / filename
    doc = BaseDocTemplate(
        str(path),
        pagesize=pagesize,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=18 * mm,
        title=title,
        author="GISP Demo",
        subject="Interactive Demo Document",
    )
    frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        id="content",
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    doc.addPageTemplates([PageTemplate(id="main", frames=frame, onPage=header_footer)])
    intro = [
        Spacer(1, 4 * mm),
        Table(
            [
                [
                    p("GISP", ParagraphStyle("Brand", parent=TITLE, fontSize=14, textColor=JADE)),
                    p("DEMO DOCUMENT", ParagraphStyle("Demo", parent=RIGHT_BOLD, textColor=LACQUER)),
                ]
            ],
            colWidths=[doc.width * 0.6, doc.width * 0.4],
        ),
        Spacer(1, 9 * mm),
        p(title, TITLE),
        Spacer(1, 1.5 * mm),
        p(subtitle, SUBTITLE),
        Spacer(1, 5 * mm),
        Table(
            [
                [p("เลขที่เอกสาร", SMALL), p(number, RIGHT_BOLD)],
                [p("โครงการ", SMALL), p("Riverstone Boutique Hotel Bangkok", RIGHT)],
                [p("สมาชิก", SMALL), p("Atelier Nara Design Co., Ltd.", RIGHT)],
                [p("สถานะ", SMALL), p("DEMO · SAMPLE DATA", RIGHT_BOLD)],
            ],
            colWidths=[doc.width * 0.28, doc.width * 0.72],
            style=[
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.5, MIST),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, MIST),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ],
        ),
        Spacer(1, 7 * mm),
    ]
    doc.build([*intro, *list(story)])
    copy2(path, PUBLIC / filename)


def section(title: str, body: str):
    return KeepTogether(
        [
            p(title, ParagraphStyle("Section", parent=SUBTITLE, textColor=JADE)),
            Spacer(1, 1.5 * mm),
            p(body),
            Spacer(1, 4 * mm),
        ]
    )


def data_table(headers, rows, widths=None, totals_row=False):
    header_style = ParagraphStyle(
        "TH",
        parent=CENTER,
        fontName="Tahoma-Bold",
        fontSize=7,
        leading=10,
        textColor=colors.white,
    )
    table_rows = [[p(cell, header_style) for cell in headers]]
    for row in rows:
        cells = []
        for index, cell in enumerate(row):
            style = RIGHT if isinstance(cell, (int, float)) or (isinstance(cell, str) and cell.replace(",", "").replace(".", "").isdigit()) else BODY
            cells.append(p(cell, style))
        table_rows.append(cells)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, MIST),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8F6EF")]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    if totals_row:
        style += [
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E5ECE8")),
            ("LINEABOVE", (0, -1), (-1, -1), 1, JADE),
        ]
    return Table(table_rows, colWidths=widths, repeatRows=1, style=TableStyle(style))


def amount_summary(subtotal: float, vat: float, total: float, label="ยอดรวมทั้งสิ้น"):
    return Table(
        [
            [p("ฐานราคาก่อน VAT", RIGHT), p(money(subtotal), RIGHT_BOLD)],
            [p("VAT 7%", RIGHT), p(money(vat), RIGHT_BOLD)],
            [p(label, RIGHT_BOLD), p(money(total), RIGHT_BOLD)],
        ],
        colWidths=[120 * mm, 35 * mm],
        hAlign="RIGHT",
        style=[
            ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#E5ECE8")),
            ("LINEABOVE", (0, 2), (-1, 2), 1, JADE),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ],
    )


def build_all():
    product_rows = [
        [sku, name, area, str(qty), money(unit), money(total)]
        for sku, name, area, qty, unit, total in PRODUCTS
    ]
    build_pdf(
        "product-schedule.pdf",
        "Product Schedule",
        "PS-PRJ-2026-000001",
        "รายการสินค้า Standard และ Custom ของโครงการ",
        [
            data_table(
                ["SKU", "รายการ", "พื้นที่", "จำนวน", "ราคา/หน่วย", "รวม"],
                product_rows,
                [25 * mm, 46 * mm, 29 * mm, 15 * mm, 25 * mm, 28 * mm],
            ),
            Spacer(1, 6 * mm),
            amount_summary(900000, 63000, 963000),
            Spacer(1, 6 * mm),
            section(
                "Business Rule",
                "สินค้า Standard ที่มี Active Member Price พร้อมสร้าง Order ได้ทันที ส่วนสินค้า Custom ต้องอ้างอิงใบเสนอราคา Version ที่ Accepted แล้ว",
            ),
        ],
    )

    for version, status, subtotal, vat, total, filename in [
        (1, "SUPERSEDED", 375000, 26250, 401250, "quotation-v1.pdf"),
        (2, "ACCEPTED", 390000, 27300, 417300, "quotation-v2.pdf"),
    ]:
        build_pdf(
            filename,
            f"Custom Quotation · Version {version}",
            f"QT-2026-000001-V{version}",
            f"GISP ออกเอกสารในนามผู้ขาย · สถานะ {status}",
            [
                data_table(
                    ["รายการ", "จำนวน", "ราคา/หน่วย", "รวม"],
                    [
                        ["Custom Reception Counter", "1", money(160000 if version == 1 else 165000), money(160000 if version == 1 else 165000)],
                        ["Custom Upholstered Headboard", "10", money(21500 if version == 1 else 22500), money(215000 if version == 1 else 225000)],
                    ],
                    [85 * mm, 20 * mm, 30 * mm, 33 * mm],
                ),
                Spacer(1, 6 * mm),
                amount_summary(subtotal, vat, total),
                Spacer(1, 6 * mm),
                section(
                    "Confirmed Specification",
                    "Reception Counter: Walnut veneer, stone top, cable management และ LED · Headboard: กว้าง 2,200 มม. ผ้า Terracotta พร้อมไฟอ่านหนังสือ",
                ),
                section(
                    "Validity & Lead Time",
                    "ใบเสนอราคามีอายุ 30 วัน · Lead Time 60 วันหลังได้รับมัดจำและยืนยันแบบ โดย Accepted Version จะล็อกราคา สเปก VAT และ Lead Time",
                ),
            ],
        )

    build_pdf(
        "customer-order.pdf",
        "Customer Order",
        "ORD-2026-000001",
        "Order Snapshot หลังเลือกสินค้าบางรายการและจำนวน",
        [
            data_table(
                ["SKU", "รายการ", "จำนวน", "ราคา/หน่วย", "รวม"],
                [[sku, name, str(qty), money(unit), money(total)] for sku, name, _, qty, unit, total in PRODUCTS],
                [27 * mm, 65 * mm, 18 * mm, 28 * mm, 30 * mm],
            ),
            Spacer(1, 6 * mm),
            amount_summary(900000, 63000, 963000),
            Spacer(1, 6 * mm),
            section("Payment Schedule", "Deposit 50% = 481,500.00 บาท · Balance = ยอดรวม 963,000.00 ลบ Deposit 481,500.00 = 481,500.00 บาท"),
        ],
    )

    for filename, title, number, payment_type in [
        ("deposit-notice.pdf", "ใบแจ้งชำระมัดจำ 50%", "INV-DEP-2026-000001", "Deposit"),
        ("balance-notice.pdf", "ใบแจ้งชำระยอดคงเหลือ 50%", "INV-BAL-2026-000001", "Balance"),
    ]:
        build_pdf(
            filename,
            title,
            number,
            f"{payment_type} Schedule · แบ่งโอนได้หลายครั้ง",
            [
                data_table(
                    ["อ้างอิง", "ฐานยอดรวมสินค้า", "สัดส่วน", "ยอดที่ต้องชำระ"],
                    [["ORD-2026-000001", money(963000), "50%", money(481500)]],
                    [50 * mm, 42 * mm, 25 * mm, 43 * mm],
                ),
                Spacer(1, 6 * mm),
                section(
                    "Verification Rule",
                    "สถานะเปลี่ยนเป็น VERIFIED เมื่อ Finance ตรวจยอดโอนสะสมครบเท่านั้น ยอดเกินต้อง Flag เพื่อตรวจสอบ และการส่ง Email ล้มเหลวไม่ Rollback ธุรกรรมหลัก",
                ),
            ],
        )

    build_pdf(
        "qc-report.pdf",
        "Custom QC & Reinspection Report",
        "QC-2026-000001",
        "ตรวจครั้งแรก → Rework → ตรวจซ้ำผ่าน",
        [
            data_table(
                ["วันที่", "รายการ", "ผล", "หมายเหตุ"],
                [
                    ["18 ต.ค. 2569", "Custom Reception Counter", "REWORK REQUIRED", "สี Walnut เข้มกว่าตัวอย่างอนุมัติ"],
                    ["24 ต.ค. 2569", "Custom Reception Counter", "PASSED", "แก้สีและตรวจซ้ำผ่าน"],
                    ["24 ต.ค. 2569", "Custom Headboard", "PASSED", "ขนาด ผ้า และไฟอ่านหนังสือตรงสเปก"],
                ],
                [28 * mm, 49 * mm, 30 * mm, 61 * mm],
            ),
            Spacer(1, 7 * mm),
            section(
                "Dispatch Gate",
                "QC Passed อย่างเดียวไม่เพียงพอ สินค้า Custom ต้องมี Member Approval, Customer Balance Verified และ Supplier Balance Paid ครบด้วย",
            ),
        ],
    )

    build_pdf(
        "packing-list.pdf",
        "Packing List · Standard Shipment",
        "PL-SHP-2026-000001",
        "Partial Shipment เที่ยวที่ 1 · LCL",
        [
            data_table(
                ["SKU", "รายการ", "จำนวน", "แพ็กเกจ", "สถานะ"],
                [
                    ["CHR-LNG-001", "Lounge Chair", "8", "8 cartons", "READY"],
                    ["TBL-SID-002", "Side Table", "12", "12 cartons", "READY"],
                    ["CHR-DIN-014", "Dining Chair", "24", "12 cartons", "READY"],
                    ["LGT-PEN-009", "Pendant Light", "10", "10 cartons", "READY"],
                ],
                [30 * mm, 55 * mm, 20 * mm, 28 * mm, 28 * mm],
            ),
            Spacer(1, 6 * mm),
            section("Shipment", "ETD 5 พฤศจิกายน 2569 · ETA 18 พฤศจิกายน 2569 · ปริมาณใน Shipment ไม่เกินจำนวนที่ผ่าน Dispatch Gate"),
        ],
    )

    build_pdf(
        "delivery-proof.pdf",
        "Delivery Proof · Received with Issue",
        "POD-2026-000001",
        "ส่งมอบเที่ยวที่ 1 พร้อมบันทึกปัญหา",
        [
            data_table(
                ["วันที่ส่งมอบ", "ผู้รับ", "ผลการส่งมอบ", "หลักฐาน"],
                [["20 พ.ย. 2569", "คุณนารา · Atelier Nara", "DELIVERED WITH ISSUE", "ภาพถ่ายและลายเซ็นจำลอง"]],
                [35 * mm, 49 * mm, 45 * mm, 39 * mm],
            ),
            Spacer(1, 6 * mm),
            section(
                "Issue",
                "Lounge Chair จำนวน 1 ตัว มีรอยกระแทกที่ขาด้านหลัง คาดว่าเกิดระหว่างขนส่ง ผู้รับยืนยันรับสินค้าส่วนอื่นและเปิด Claim สำหรับรายการที่เสียหาย",
            ),
        ],
    )

    build_pdf(
        "claim-resolution.pdf",
        "Claim Replacement Resolution",
        "CLM-2026-000001",
        "Resolution และ Member Confirmation",
        [
            data_table(
                ["สินค้า", "สาเหตุ", "มติ", "สถานะ"],
                [["CHR-LNG-001 · Lounge Chair", "เสียหายระหว่างขนส่ง", "ผลิตทดแทน 1 ตัว", "CLOSED"]],
                [50 * mm, 44 * mm, 43 * mm, 31 * mm],
            ),
            Spacer(1, 6 * mm),
            section(
                "Timeline",
                "20 พ.ย. เปิด Claim พร้อมหลักฐาน · 21 พ.ย. อนุมัติ Replacement · 5 ธ.ค. ส่งสินค้าทดแทน · 6 ธ.ค. Member ยืนยันและปิด Claim",
            ),
            section(
                "Resolution",
                "โรงงานผลิต Lounge Chair ทดแทน 1 ตัวและส่งถึงหน้างานเรียบร้อย สมาชิกยืนยันว่าได้รับสินค้าในสภาพสมบูรณ์",
            ),
        ],
    )


if __name__ == "__main__":
    build_all()
    print(f"Created 10 demo PDFs in {OUTPUT}")
