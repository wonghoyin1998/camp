from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import registerFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


OUTPUT = Path(__file__).resolve().parents[1] / "output" / "pdf" / "p1-p6-challenge-record.pdf"
FONT = Path(__file__).resolve().parents[1] / "assets" / "fonts" / "NotoSansTC-Regular.ttf"

CHALLENGES = [
    ("P1", "雙人棒夾運球", "每人一支棒、軟球、起終點標記", "每兩人用棒夾一個球。夾球時該二人不可移動，須由其他拍檔接力調位。跌球返回起點，計時繼續。"),
    ("P2", "繩控疊杯", "膠杯 6 隻、橡筋圈、每人一條控制繩", "全隊只可拉自己的繩控制橡筋，合作將 6 隻杯疊成指定形狀。手不可直接碰杯。"),
    ("P3", "Six Bricks 分散視圖", "Six Bricks 8–12 粒、每人一張不同視圖、工作員答案圖", "每人只可看自己的一張圖，可口述但不可展示或交換。全隊按不同視角砌出正確模型。"),
    ("P4", "三墊過河", "防滑地墊 3 塊、起終點標記", "全隊只可踏在 3 塊地墊上前進。任何人觸地便返回起點，計時繼續。"),
    ("P5", "雙繩圈穿越", "尼龍繩圈 2 個", "全隊手牽手成圈。兩個尼龍繩圈由相反方向穿過每位隊員，途中不可放手。"),
    ("P6", "層層疊貨運", "層層疊一副、繩控托盤、路線標記", "先在托盤砌好層層疊貨物，再由全隊拉繩運過指定路線。貨物倒下須重砌，計時繼續。"),
]


def build_pdf():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    registerFont(TTFont("NotoSansTC", str(FONT)))
    styles = getSampleStyleSheet()
    title = ParagraphStyle("title", parent=styles["Title"], fontName="NotoSansTC", fontSize=22, leading=28, textColor=colors.HexColor("#12354A"), alignment=TA_CENTER)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontName="NotoSansTC", fontSize=9.5, leading=14, textColor=colors.HexColor("#1C2D36"))
    label = ParagraphStyle("label", parent=body, fontSize=8.5, leading=12, textColor=colors.HexColor("#496472"))
    cell = ParagraphStyle("cell", parent=body, fontSize=8.2, leading=10, alignment=TA_CENTER)
    header_cell = ParagraphStyle("header-cell", parent=cell, textColor=colors.white)

    doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=12 * mm, rightMargin=12 * mm, topMargin=11 * mm, bottomMargin=10 * mm)
    story = []
    for page_no, (code, name, materials, rules) in enumerate(CHALLENGES, start=1):
        story.append(Paragraph(f"{code} - {name} - 實體挑戰紀錄", title))
        story.append(Spacer(1, 3 * mm))
        info = Table([
            [Paragraph("<b>判定規則</b>", body), Paragraph("第一隊成功完成即可建立紀錄。之後隊伍必須嚴格快過目前最快時間才算成功，相同時間不算。Web App 為主要紀錄，本表作現場核對及後備。", body)],
            [Paragraph("<b>物資</b>", body), Paragraph(materials, body)],
            [Paragraph("<b>玩法摘要</b>", body), Paragraph(rules, body)],
        ], colWidths=[26 * mm, 157 * mm])
        info.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#DDEFF4")),
            ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#3E7184")),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#91AAB4")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(info)
        story.append(Spacer(1, 4 * mm))
        target = Table([[Paragraph("現時 TIME TO BEAT", label), Paragraph("分　　　　秒", title), Paragraph("工作員 ____________", body)]], colWidths=[48 * mm, 79 * mm, 56 * mm], rowHeights=[17 * mm])
        target.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 1.2, colors.HexColor("#12354A")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#91AAB4")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#F0F9FA")),
        ]))
        story.append(target)
        story.append(Spacer(1, 4 * mm))
        headers = ["次序", "隊伍", "完成時間", "挑戰前紀錄", "快過紀錄?", "工作員簽署 / 備註"]
        data = [[Paragraph(f"<b>{item}</b>", header_cell) for item in headers]]
        for row in range(1, 14):
            data.append([Paragraph(str(row), cell), "", "", "", "是 / 否", ""])
        table = Table(data, colWidths=[13 * mm, 25 * mm, 28 * mm, 29 * mm, 31 * mm, 57 * mm], rowHeights=[10 * mm] + [11 * mm] * 13)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#12354A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), "NotoSansTC"),
            ("FONTSIZE", (0, 1), (-1, -1), 8.5),
            ("GRID", (0, 0), (-1, -1), 0.55, colors.HexColor("#547481")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F8F9")]),
        ]))
        story.append(table)
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(f"記錄方法: 停止 Web App 計時後，先抄下完成時間及系統結果。只有系統顯示成功，方可提交佔領申請。第 {page_no} / 6 頁", label))
        if page_no < len(CHALLENGES):
            story.append(__import__("reportlab.platypus", fromlist=["PageBreak"]).PageBreak())
    doc.build(story)


if __name__ == "__main__":
    build_pdf()
