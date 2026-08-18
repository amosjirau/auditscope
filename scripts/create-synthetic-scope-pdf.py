from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


OUTPUT = Path("output/pdf/AuditScope-Test-Scope-Report.pdf")
REPOSITORY = "https://github.com/amosjirau/auditscope"
COMMIT = "740eebbb21af164209331eae15e8c9bc2a86ec86"
SOURCE = "fixtures/base-sepolia/contracts/VaultV1.sol"


def footer(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D5D9E0"))
    canvas.line(0.7 * inch, 0.55 * inch, 7.8 * inch, 0.55 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#5D6470"))
    canvas.drawString(0.7 * inch, 0.36 * inch, "AuditScope synthetic verification fixture")
    canvas.drawRightString(7.8 * inch, 0.36 * inch, f"Page {document.page}")
    canvas.restoreState()


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=29,
        textColor=colors.HexColor("#111827"),
        alignment=TA_CENTER,
        spaceAfter=14,
    )
    warning = ParagraphStyle(
        "Warning",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=17,
        textColor=colors.HexColor("#7F1D1D"),
        alignment=TA_CENTER,
    )
    heading = ParagraphStyle(
        "Heading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0F3D63"),
        spaceBefore=12,
        spaceAfter=7,
    )
    body = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=15,
        textColor=colors.HexColor("#252A31"),
        spaceAfter=7,
    )
    mono = ParagraphStyle(
        "Mono",
        parent=body,
        fontName="Courier",
        fontSize=8.4,
        leading=12,
        textColor=colors.HexColor("#172033"),
        wordWrap="CJK",
    )
    table_header = ParagraphStyle(
        "TableHeader",
        parent=body,
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=colors.white,
        alignment=TA_CENTER,
    )

    document = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        rightMargin=0.7 * inch,
        leftMargin=0.7 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.75 * inch,
        title="AuditScope Test Scope Report",
        author="AuditScope",
        subject="Synthetic verification fixture, not a security audit",
    )

    story = [
        Paragraph("AuditScope Test Scope Report", title),
        Table(
            [[Paragraph("SYNTHETIC AUDITSCOPE VERIFICATION FIXTURE - NOT A SECURITY AUDIT", warning)]],
            colWidths=[7.05 * inch],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEE2E2")),
                ("BOX", (0, 0), (-1, -1), 1.2, colors.HexColor("#B91C1C")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 11),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
            ]),
        ),
        Spacer(1, 14),
        Paragraph(
            "Purpose: exercise AuditScope's production evidence pipeline on Base Sepolia. "
            "This document makes no security claims and contains no vulnerability assessment.",
            body,
        ),
        Paragraph("Fixture identity", heading),
        Table(
            [
                [Paragraph("Repository", body), Paragraph(REPOSITORY, mono)],
                [Paragraph("Exact commit SHA", body), Paragraph(COMMIT, mono)],
                [Paragraph("Audited source file", body), Paragraph(SOURCE, mono)],
                [Paragraph("Contract in scope", body), Paragraph("VaultV1", mono)],
                [Paragraph("Network", body), Paragraph("Base Sepolia (chain ID 84532)", body)],
                [Paragraph("Fixture date", body), Paragraph("2026-08-18", body)],
            ],
            colWidths=[1.55 * inch, 5.5 * inch],
            style=TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EEF4F8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]),
        ),
        Paragraph("Scope boundary", heading),
        Paragraph(
            "Deployment addresses are reference fixtures only. Coverage is NOT limited to a particular deployment "
            "or address. Exact source correspondence to VaultV1.sol at the stated GitHub commit governs coverage.",
            body,
        ),
        Paragraph("In-scope source", heading),
        Paragraph(
            f"The sole source file in scope is <font name='Courier'>{SOURCE}</font> at commit "
            f"<font name='Courier'>{COMMIT}</font>. No other Solidity file is in scope.",
            body,
        ),
        PageBreak(),
        Paragraph("Controlled Base Sepolia deployments", title),
        Paragraph(
            "These addresses are public test fixtures. CURRENT remains on VaultV1. STALE was initialized on VaultV1 "
            "and then upgraded to VaultV2. PARTIAL points to an intentionally unverified implementation. "
            "UNVERIFIED is a funded externally owned account with no contract bytecode.",
            body,
        ),
    ]

    rows = [
        ["Outcome", "Address type", "Base Sepolia address"],
        ["CURRENT", "Proxy", "0xC7A79CD13dda7967588549a83110012DCc395266"],
        ["CURRENT", "VaultV1 implementation", "0x903C90A8879d54D719Fb1D0De22C105a2f380938"],
        ["STALE", "Upgraded proxy", "0x0Bd5Dd0831139566Dc5166BA74F0891eb44A7b03"],
        ["STALE", "Initial VaultV1 implementation", "0xD0267cb3Cb1F57b4471270304934C06C06F3ec0f"],
        ["STALE", "Live VaultV2 implementation (out of scope)", "0x99a32A7715D49714D2aba8Ccc57a468B19Be258F"],
        ["PARTIAL", "Proxy", "0x3E14Df03d2e3fEC961DAb781107D446c1AAC365E"],
        ["PARTIAL", "Unverified implementation (out of scope)", "0x1584AE516269233af9A6dE1E17028D04B93CAE77"],
        ["UNVERIFIED", "EOA with no bytecode", "0x76D753410be13BF383366a0F566f90c2d1819b67"],
    ]
    table_rows = []
    for index, row in enumerate(rows):
        style = table_header if index == 0 else body
        table_rows.append([
            Paragraph(row[0], style),
            Paragraph(row[1], style),
            Paragraph(row[2], mono if index else style),
        ])
    story.extend([
        Table(
            table_rows,
            colWidths=[1.05 * inch, 1.9 * inch, 4.1 * inch],
            repeatRows=1,
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F3D63")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]),
        ),
        Spacer(1, 12),
        KeepTogether([
            Paragraph("Expected deterministic interpretation", heading),
            Paragraph(
                "CURRENT: the live implementation has Sourcify exact_match and its VaultV1.sol source equals the "
                "historical GitHub source. STALE: the live implementation has Sourcify exact_match but its source "
                "differs from the scoped VaultV1.sol. PARTIAL: the historical commit resolves but applicable live "
                "source evidence is incomplete. UNVERIFIED: the requested address has no contract bytecode.",
                body,
            ),
        ]),
        Spacer(1, 10),
        Table(
            [[Paragraph("END OF SYNTHETIC FIXTURE - THIS REPORT IS NOT A SECURITY AUDIT", warning)]],
            colWidths=[7.05 * inch],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF7ED")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#C2410C")),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]),
        ),
    ])

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT.resolve())


if __name__ == "__main__":
    build()
