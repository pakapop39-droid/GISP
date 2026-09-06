from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "2026-08-18-gisp-slice-1-uat-signoff.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont("Tahoma", r"C:\Windows\Fonts\tahoma.ttf"))
pdfmetrics.registerFont(TTFont("Tahoma-Bold", r"C:\Windows\Fonts\tahomabd.ttf"))

INK = colors.HexColor("#17201B")
PAPER = colors.HexColor("#F7F3EA")
BRASS = colors.HexColor("#A66A1E")
JADE = colors.HexColor("#2D6B57")
LINE = colors.HexColor("#D7D1C5")
MUTED = colors.HexColor("#666C68")
PALE_JADE = colors.HexColor("#E8F0EB")
PALE_BRASS = colors.HexColor("#F2E9DA")

styles = getSampleStyleSheet()


def style(name, **kwargs):
    defaults = {
        "fontName": "Tahoma",
        "fontSize": 9.2,
        "leading": 14,
        "textColor": INK,
        "wordWrap": "CJK",
        "spaceAfter": 0,
    }
    defaults.update(kwargs)
    return ParagraphStyle(name, **defaults)


EYEBROW = style(
    "Eyebrow",
    fontName="Tahoma-Bold",
    fontSize=7.5,
    leading=10,
    textColor=BRASS,
    uppercase=True,
    letterSpacing=1.5,
)
TITLE = style("Title", fontName="Tahoma-Bold", fontSize=24, leading=31, spaceAfter=6)
SUBTITLE = style("Subtitle", fontSize=10, leading=16, textColor=MUTED)
H2 = style("H2", fontName="Tahoma-Bold", fontSize=13, leading=18, spaceBefore=4, spaceAfter=7)
BODY = style("Body", fontSize=9.2, leading=15, textColor=INK)
SMALL = style("Small", fontSize=7.8, leading=12, textColor=MUTED)
LABEL = style("Label", fontName="Tahoma-Bold", fontSize=7.7, leading=11, textColor=MUTED)
VALUE = style("Value", fontName="Tahoma-Bold", fontSize=9.2, leading=14)
CELL = style("Cell", fontSize=8.2, leading=12.5)
CELL_BOLD = style("CellBold", fontName="Tahoma-Bold", fontSize=8.2, leading=12.5)
WHITE = style("White", fontName="Tahoma-Bold", fontSize=10, leading=14, textColor=colors.white)
QUOTE = style("Quote", fontName="Tahoma-Bold", fontSize=10, leading=17, textColor=JADE)


def p(text, paragraph_style=BODY):
    return Paragraph(text, paragraph_style)


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(18 * mm, 15 * mm, width - 18 * mm, 15 * mm)
    canvas.setFont("Tahoma-Bold", 7)
    canvas.setFillColor(INK)
    canvas.drawString(18 * mm, 9.5 * mm, "GISP / SLICE 1 UAT SIGN-OFF")
    canvas.setFont("Tahoma", 7)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(width - 18 * mm, 9.5 * mm, f"หน้า {doc.page}")
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    rightMargin=18 * mm,
    leftMargin=18 * mm,
    topMargin=16 * mm,
    bottomMargin=22 * mm,
    title="GISP Slice 1 Human UAT Sign-off",
    author="GISP Project Owner",
    subject="Acceptance evidence for Slice 1: Login, company, users and permissions",
)

story = []

brand = Table(
    [
        [
            p("GI", style("Mark", fontName="Tahoma-Bold", fontSize=14, leading=18, textColor=colors.white, alignment=TA_CENTER)),
            [p("GISP", style("Brand", fontName="Tahoma-Bold", fontSize=15, leading=18)), p("GLOBAL INTERIOR SUPPLY PLATFORM", EYEBROW)],
            p("HUMAN UAT / 18 AUG 2026", style("TopMeta", fontName="Tahoma-Bold", fontSize=7.5, leading=11, textColor=MUTED, alignment=TA_RIGHT)),
        ]
    ],
    colWidths=[15 * mm, 95 * mm, 62 * mm],
)
brand.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (0, 0), INK),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (0, 0), 0),
            ("RIGHTPADDING", (0, 0), (0, 0), 0),
            ("TOPPADDING", (0, 0), (0, 0), 7),
            ("BOTTOMPADDING", (0, 0), (0, 0), 7),
            ("LEFTPADDING", (1, 0), (1, 0), 8),
            ("RIGHTPADDING", (2, 0), (2, 0), 0),
        ]
    )
)
story.extend([brand, Spacer(1, 14 * mm)])

story.extend(
    [
        p("SLICE 1 / ACCEPTANCE RECORD", EYEBROW),
        Spacer(1, 2 * mm),
        p("เอกสารรับรองผลการตรวจรับ Slice 1", TITLE),
        p("Login, บริษัท, ผู้ใช้ และสิทธิ์", SUBTITLE),
        Spacer(1, 7 * mm),
    ]
)

status = Table(
    [[p("DONE", WHITE), p("HUMAN UAT ACCEPTED", WHITE), p("DEVELOPMENT", WHITE)]],
    colWidths=[32 * mm, 88 * mm, 52 * mm],
)
status.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, -1), JADE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LINEBEFORE", (1, 0), (-1, -1), 0.5, colors.HexColor("#78A08F")),
        ]
    )
)
story.extend([status, Spacer(1, 8 * mm)])

metadata = Table(
    [
        [p("ผู้อนุมัติ", LABEL), p("Project Owner / GISP SUPER_ADMIN", VALUE), p("วันที่อนุมัติ", LABEL), p("18 สิงหาคม 2569", VALUE)],
        [p("ระบบที่ตรวจรับ", LABEL), p("GISP Development", VALUE), p("Deployment ID", LABEL), p("53f686d7-7d71-4161-9d42-229b0a75c9cd", CELL)],
        [p("URL", LABEL), p("https://kit6y4pj.insforge.site", CELL), p("Decision", LABEL), p("SLICE_1_ACCEPTED", VALUE)],
    ],
    colWidths=[25 * mm, 60 * mm, 25 * mm, 62 * mm],
)
metadata.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.6, LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ]
    )
)
story.extend([metadata, Spacer(1, 8 * mm)])

acceptance = Table(
    [[p("คำยืนยันจากเจ้าของระบบ", EYEBROW)], [p('“อนุมัติปิด Slice 1”', QUOTE)], [p("เจ้าของระบบตรวจรับการทำงานบน Development และยอมรับผลตามขอบเขต Slice 1 ที่ระบุในเอกสารนี้", BODY)]],
    colWidths=[172 * mm],
)
acceptance.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, -1), PALE_JADE),
            ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#AFC7BB")),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]
    )
)
story.extend([acceptance, Spacer(1, 8 * mm), p("ขอบเขตที่ตรวจรับ", H2)])

scope_rows = [
    ("01", "Auth และ Account Lifecycle", "สมัครและ OTP, Login/Logout, Recovery Link แบบใช้ครั้งเดียว, Pending/Rejected/Suspended Redirect"),
    ("02", "Member Profile และ Ownership", "หนึ่ง Login ต่อหนึ่ง Member Profile, Onboarding, แก้ข้อมูลบริษัท, Business Type Dropdown"),
    ("03", "Admin Access Operations", "Approve, Reject, Suspend, Reactivate, Force Logout, Reset Password, Fixed Role และ Permission"),
    ("04", "Session, RLS และ Security", "App Session Registry, Backend Permission Guard, Sanitized History, Last Super Admin Guard"),
    ("05", "Foundation", "Company Settings, Atomic Document Number, Unique Record Reference และ Append-only Audit"),
    ("06", "Private Application Files", "PDF/JPEG/PNG, 10 MB, สูงสุด 5 ไฟล์, File Metadata และ Signed URL 5 นาที"),
]
scope_table = Table(
    [[p("NO.", LABEL), p("พื้นที่", LABEL), p("ผลที่ยอมรับ", LABEL)]]
    + [[p(number, CELL_BOLD), p(area, CELL_BOLD), p(result, CELL)] for number, area, result in scope_rows],
    colWidths=[13 * mm, 49 * mm, 110 * mm],
    repeatRows=1,
)
scope_table.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), PALE_BRASS),
            ("BACKGROUND", (0, 1), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.6, LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ]
    )
)
story.append(scope_table)

story.append(PageBreak())
story.extend([p("QUALITY AND UAT EVIDENCE", EYEBROW), Spacer(1, 2 * mm), p("หลักฐานประกอบการปิด Slice 1", TITLE), Spacer(1, 5 * mm)])

story.append(p("ผล Automated Gate", H2))
gate_rows = [
    ("TypeScript Typecheck", "PASS"),
    ("ESLint", "PASS - 0 Error"),
    ("Unit Test", "PASS - 43/43"),
    ("Branch Integration / RLS / Security", "PASS - 12/12"),
    ("Next.js Production Build", "PASS - 62 Routes"),
    ("Browser E2E Desktop / Mobile", "PASS"),
    ("Development Smoke Test", "PASS - Health ok"),
]
gate_table = Table(
    [[p(name, CELL), p(result, CELL_BOLD)] for name, result in gate_rows],
    colWidths=[118 * mm, 54 * mm],
)
gate_table.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.6, LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
            ("TEXTCOLOR", (1, 0), (1, -1), JADE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]
    )
)
story.extend([gate_table, Spacer(1, 8 * mm), p("ผล Human UAT ที่ยืนยันแล้ว", H2)])

human_items = [
    "Admin อนุมัติ Member และ Member Login เข้า Portal ด้วย Role ที่ถูกต้อง",
    "แก้ไขข้อมูลบริษัทและ Business Type Dropdown แล้วข้อมูลคงอยู่หลัง Refresh",
    "ความกระชับของหน้าระบบ Member และ Admin ได้รับการยืนยันว่าเหมาะสม",
    "Suspend, Read-only Suspended, Reactivate และกลับเข้า Member Dashboard ผ่านครบวงจร",
    "Force Logout ยกเลิก Session เดิมและมี Security Log SUCCESS",
    "Forgot/Reset Password ส่งอีเมลจริง เปลี่ยนรหัสผ่านได้ และลิงก์เดิมใช้ซ้ำไม่ได้",
    "Member ACTIVE อัปโหลด ดูรายการ และเปิดเอกสารจริงผ่าน Signed URL ได้",
]
human_data = []
for item in human_items:
    human_data.append([p("PASS", style("Pass", fontName="Tahoma-Bold", fontSize=7.5, leading=11, textColor=JADE)), p(item, CELL)])
human_table = Table(human_data, colWidths=[18 * mm, 154 * mm])
human_table.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.6, LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]
    )
)
story.extend([human_table, Spacer(1, 9 * mm)])

boundary = Table(
    [
        [p("RELEASE BOUNDARY", EYEBROW)],
        [p("การอนุมัตินี้ปิด Slice 1 บน Development เท่านั้น", H2)],
        [p("ยังไม่อนุญาต Production Deployment และยังไม่อนุญาตลบ Backend Branch <b>slice-1-access</b> การดำเนินการดังกล่าวต้องได้รับคำอนุมัติแยกจากเจ้าของระบบ", BODY)],
    ],
    colWidths=[172 * mm],
)
boundary.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, -1), PALE_BRASS),
            ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#D3B789")),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]
    )
)
story.extend([boundary, Spacer(1, 9 * mm)])

signoff = Table(
    [
        [p("ผู้ตรวจรับ", LABEL), p("Project Owner", VALUE), p("สถานะ", LABEL), p("APPROVED", style("Approved", fontName="Tahoma-Bold", fontSize=9.2, leading=14, textColor=JADE))],
        [p("หลักฐานคำสั่ง", LABEL), p('“อนุมัติปิด Slice 1”', VALUE), p("วันที่", LABEL), p("18 สิงหาคม 2569", VALUE)],
    ],
    colWidths=[25 * mm, 60 * mm, 25 * mm, 62 * mm],
)
signoff.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.8, INK),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]
    )
)
story.append(signoff)

doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUTPUT)
