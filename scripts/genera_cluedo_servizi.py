#!/usr/bin/env python3
"""Genera i quattro mazzi stampabili di Servizi in giallo."""

from __future__ import annotations

import json
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "materiali" / "giochi" / "cluedo-servizi" / "scenari.json"
OUTPUT_DIR = ROOT / "output" / "pdf"

PAGE_W, PAGE_H = A4
MARGIN = 12 * mm
GAP = 6 * mm

INK = HexColor("#172321")
MUTED = HexColor("#516762")
TEAL = HexColor("#0f766e")
TEAL_LIGHT = HexColor("#dff7f2")
ORANGE = HexColor("#e66b13")
ORANGE_LIGHT = HexColor("#fff0df")
RED = HexColor("#b64034")
CREAM = HexColor("#fbf7ee")
LINE = HexColor("#b7c5c1")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("Deck", "/System/Library/Fonts/Supplemental/Arial.ttf"))
    pdfmetrics.registerFont(TTFont("Deck-Bold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"))


register_fonts()

BODY = ParagraphStyle(
    "Body",
    fontName="Deck",
    fontSize=9.2,
    leading=12.2,
    textColor=INK,
    spaceAfter=4,
)
SMALL = ParagraphStyle(
    "Small",
    parent=BODY,
    fontSize=8.1,
    leading=10.4,
    textColor=MUTED,
)
CARD_TITLE = ParagraphStyle(
    "CardTitle",
    parent=BODY,
    fontName="Deck-Bold",
    fontSize=15,
    leading=17,
    textColor=INK,
)
EVIDENCE_TITLE = ParagraphStyle(
    "EvidenceTitle",
    parent=CARD_TITLE,
    fontSize=13,
    leading=15,
)
LABEL = ParagraphStyle(
    "Label",
    parent=BODY,
    fontName="Deck-Bold",
    fontSize=7.3,
    leading=8.5,
    textColor=TEAL,
    spaceAfter=2,
)
CENTER_SMALL = ParagraphStyle(
    "CenterSmall",
    parent=SMALL,
    alignment=TA_CENTER,
)


def safe(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )


def paragraph(c: canvas.Canvas, text: str, x: float, top: float, width: float, style: ParagraphStyle, max_height: float = 1000 * mm) -> float:
    item = Paragraph(safe(text), style)
    _, height = item.wrap(width, max_height)
    item.drawOn(c, x, top - height)
    return height


def footer(c: canvas.Canvas, scenario: dict, page_number: int) -> None:
    c.setStrokeColor(LINE)
    c.setLineWidth(0.4)
    c.line(MARGIN, 8.8 * mm, PAGE_W - MARGIN, 8.8 * mm)
    c.setFont("Deck", 7.2)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, 5.2 * mm, f"{scenario['classe']} · {scenario['caso']} · materiali per il gioco in classe")
    c.drawRightString(PAGE_W - MARGIN, 5.2 * mm, str(page_number))


def page_title(c: canvas.Canvas, eyebrow: str, title: str, scenario: dict, page_number: int) -> float:
    c.setFillColor(TEAL)
    c.rect(0, PAGE_H - 9 * mm, PAGE_W, 9 * mm, stroke=0, fill=1)
    c.setFillColor(TEAL)
    c.setFont("Deck-Bold", 8)
    c.drawString(MARGIN, PAGE_H - 20 * mm, eyebrow.upper())
    c.setFillColor(INK)
    c.setFont("Deck-Bold", 20)
    c.drawString(MARGIN, PAGE_H - 30 * mm, title)
    footer(c, scenario, page_number)
    return PAGE_H - 38 * mm


def cut_card(c: canvas.Canvas, x: float, y: float, width: float, height: float, accent=TEAL, fill=white) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.65)
    c.rect(x, y, width, height, stroke=1, fill=1)
    c.setFillColor(accent)
    c.rect(x, y + height - 3.2 * mm, width, 3.2 * mm, stroke=0, fill=1)


def draw_labeled_block(c: canvas.Canvas, label: str, text: str, x: float, top: float, width: float, style=BODY) -> float:
    used = paragraph(c, label.upper(), x, top, width, LABEL)
    top -= used + 1.2 * mm
    used += 1.2 * mm + paragraph(c, text, x, top, width, style)
    return used


def cover_page(c: canvas.Canvas, scenario: dict, page_number: int) -> None:
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.setFillColor(TEAL)
    c.rect(0, PAGE_H - 64 * mm, PAGE_W, 64 * mm, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Deck-Bold", 10)
    c.drawString(MARGIN, PAGE_H - 20 * mm, "SERVIZI IN GIALLO · CACCIA AL SABOTATORE")
    c.setFont("Deck-Bold", 38)
    c.drawString(MARGIN, PAGE_H - 39 * mm, scenario["classe"])
    c.setFont("Deck-Bold", 22)
    c.drawString(MARGIN, PAGE_H - 53 * mm, scenario["caso"])

    top = PAGE_H - 82 * mm
    paragraph(c, scenario["focus"], MARGIN, top, PAGE_W - 2 * MARGIN, ParagraphStyle("Focus", parent=CARD_TITLE, fontSize=20, leading=23, textColor=INK))
    top -= 27 * mm

    blocks = [
        ("Composizione del mazzo", "5 carte Testimone · 8 carte Prova · 4 Missioni segrete · 4 schede Squadra. La soluzione resta nella regia docente."),
        ("Stampa", "Stampa a grandezza effettiva, su un solo lato. Taglia lungo i bordi. Se hai più di quattro squadre, ristampa soltanto l'ultima pagina."),
        ("Allestimento", "Cinque studenti restano alle postazioni Testimone; gli altri si muovono in squadre da 2–4. Ogni squadra pesca una Missione segreta."),
        ("Regola essenziale", "I testimoni non mentono, non inventano e non mostrano la carta. Il dettaglio riservato viene comunicato solo quando la squadra formula una domanda pertinente."),
    ]
    for label, text in blocks:
        c.setFillColor(white)
        c.setStrokeColor(LINE)
        c.rect(MARGIN, top - 31 * mm, PAGE_W - 2 * MARGIN, 27 * mm, stroke=1, fill=1)
        draw_labeled_block(c, label, text, MARGIN + 6 * mm, top - 8 * mm, PAGE_W - 2 * MARGIN - 12 * mm)
        top -= 34 * mm

    footer(c, scenario, page_number)
    c.showPage()


def witness_card(c: canvas.Canvas, witness: dict, index: int, x: float, y: float, width: float, height: float) -> None:
    cut_card(c, x, y, width, height, accent=TEAL, fill=white)
    inner_x = x + 6 * mm
    inner_w = width - 12 * mm
    top = y + height - 10 * mm
    c.setFillColor(TEAL)
    c.setFont("Deck-Bold", 7.5)
    c.drawString(inner_x, top, f"TESTIMONE {index}")
    top -= 6 * mm
    top -= paragraph(c, witness["ruolo"], inner_x, top, inner_w, CARD_TITLE) + 4 * mm
    top -= draw_labeled_block(c, "Ciò che puoi dire subito", witness["pubblico"], inner_x, top, inner_w) + 4 * mm
    top -= draw_labeled_block(c, "Informazione riservata", witness["segreto"], inner_x, top, inner_w) + 4 * mm
    draw_labeled_block(c, "Quando rivelarla", witness["domanda"], inner_x, top, inner_w, SMALL)
    c.setFillColor(ORANGE_LIGHT)
    c.rect(x + 5 * mm, y + 5 * mm, width - 10 * mm, 8 * mm, stroke=0, fill=1)
    paragraph(c, "Non mostrare la carta. Non aggiungere dettagli.", x + 8 * mm, y + 11 * mm, width - 16 * mm, ParagraphStyle("Rule", parent=SMALL, fontName="Deck-Bold", textColor=ORANGE))


def observer_card(c: canvas.Canvas, x: float, y: float, width: float, height: float) -> None:
    cut_card(c, x, y, width, height, accent=ORANGE, fill=CREAM)
    inner_x = x + 6 * mm
    inner_w = width - 12 * mm
    top = y + height - 10 * mm
    c.setFillColor(ORANGE)
    c.setFont("Deck-Bold", 7.5)
    c.drawString(inner_x, top, "RUOLO FACOLTATIVO")
    top -= 6 * mm
    top -= paragraph(c, "Osservatore del metodo", inner_x, top, inner_w, CARD_TITLE) + 5 * mm
    items = [
        "Segna una domanda che ha aperto un'informazione importante.",
        "Segna quando la squadra ha scambiato un'interpretazione per un fatto.",
        "Conta quante persone hanno contribuito al ragionamento.",
        "Nel debriefing restituisci un comportamento utile e uno da migliorare.",
    ]
    for number, item in enumerate(items, start=1):
        top -= paragraph(c, f"{number}. {item}", inner_x, top, inner_w, BODY) + 2 * mm


def witness_pages(c: canvas.Canvas, scenario: dict, start_page: int) -> int:
    cards = list(scenario["testimoni"]) + [None]
    page_number = start_page
    for page_index in range(2):
        top = page_title(c, "Carte da ritagliare", "Postazioni Testimone", scenario, page_number)
        available_top = top - 3 * mm
        bottom = 13 * mm
        height = (available_top - bottom - 2 * GAP) / 3
        for row in range(3):
            card_index = page_index * 3 + row
            y = available_top - (row + 1) * height - row * GAP
            item = cards[card_index]
            if item is None:
                observer_card(c, MARGIN, y, PAGE_W - 2 * MARGIN, height)
            else:
                witness_card(c, item, card_index + 1, MARGIN, y, PAGE_W - 2 * MARGIN, height)
        c.showPage()
        page_number += 1
    return page_number


def type_color(kind: str):
    if kind == "PROVA-CHIAVE":
        return TEAL
    if kind in {"INFERENZA", "PISTA-DEBOLE"}:
        return ORANGE
    if kind == "CONTROPROVA":
        return RED
    return MUTED


def evidence_card(c: canvas.Canvas, evidence: dict, x: float, y: float, width: float, height: float) -> None:
    accent = type_color(evidence["tipo"])
    cut_card(c, x, y, width, height, accent=accent, fill=white)
    inner_x = x + 6 * mm
    inner_w = width - 12 * mm
    top = y + height - 12 * mm
    c.setFillColor(accent)
    c.setFont("Deck-Bold", 20)
    c.drawString(inner_x, top, evidence["codice"])
    c.setFont("Deck-Bold", 7.2)
    c.drawRightString(x + width - 6 * mm, top, evidence["tipo"])
    top -= 10 * mm
    top -= paragraph(c, evidence["titolo"], inner_x, top, inner_w, EVIDENCE_TITLE) + 7 * mm
    paragraph(c, evidence["testo"], inner_x, top, inner_w, ParagraphStyle("EvidenceBody", parent=BODY, fontSize=10.5, leading=14))


def evidence_pages(c: canvas.Canvas, scenario: dict, start_page: int) -> int:
    page_number = start_page
    for page_index in range(2):
        top = page_title(c, "Carte da ritagliare", "Tavolo delle prove", scenario, page_number)
        bottom = 13 * mm
        usable_top = top - 3 * mm
        width = (PAGE_W - 2 * MARGIN - GAP) / 2
        height = (usable_top - bottom - GAP) / 2
        for offset in range(4):
            row = offset // 2
            col = offset % 2
            x = MARGIN + col * (width + GAP)
            y = usable_top - (row + 1) * height - row * GAP
            evidence_card(c, scenario["prove"][page_index * 4 + offset], x, y, width, height)
        c.showPage()
        page_number += 1
    return page_number


def mission_card(c: canvas.Canvas, mission: dict, index: int, x: float, y: float, width: float, height: float) -> None:
    cut_card(c, x, y, width, height, accent=ORANGE, fill=CREAM)
    inner_x = x + 7 * mm
    inner_w = width - 14 * mm
    top = y + height - 13 * mm
    c.setFillColor(ORANGE)
    c.setFont("Deck-Bold", 8)
    c.drawString(inner_x, top, f"MISSIONE SEGRETA {index}")
    top -= 9 * mm
    top -= paragraph(c, mission["titolo"], inner_x, top, inner_w, CARD_TITLE) + 8 * mm
    top -= draw_labeled_block(c, "La sfida", mission["testo"], inner_x, top, inner_w, BODY) + 8 * mm
    c.setFillColor(ORANGE_LIGHT)
    c.rect(inner_x - 2 * mm, y + 8 * mm, inner_w + 4 * mm, 24 * mm, stroke=0, fill=1)
    draw_labeled_block(c, "Bonus detective", mission["bonus"], inner_x + 2 * mm, y + 27 * mm, inner_w - 4 * mm, SMALL)


def mission_page(c: canvas.Canvas, scenario: dict, page_number: int) -> None:
    top = page_title(c, "Una per ogni squadra", "Missioni segrete", scenario, page_number)
    bottom = 13 * mm
    usable_top = top - 3 * mm
    width = (PAGE_W - 2 * MARGIN - GAP) / 2
    height = (usable_top - bottom - GAP) / 2
    for offset, mission in enumerate(scenario["missioniSegrete"]):
        row = offset // 2
        col = offset % 2
        x = MARGIN + col * (width + GAP)
        y = usable_top - (row + 1) * height - row * GAP
        mission_card(c, mission, offset + 1, x, y, width, height)
    c.showPage()


def writing_line(c: canvas.Canvas, x: float, y: float, width: float, label: str = "") -> None:
    c.setStrokeColor(LINE)
    c.setLineWidth(0.55)
    c.line(x, y, x + width, y)
    if label:
        c.setFillColor(MUTED)
        c.setFont("Deck", 6.7)
        c.drawString(x, y + 1.5 * mm, label)


def team_sheet(c: canvas.Canvas, scenario: dict, team_number: int, x: float, y: float, width: float, height: float) -> None:
    cut_card(c, x, y, width, height, accent=TEAL, fill=white)
    inner_x = x + 5 * mm
    inner_w = width - 10 * mm
    top = y + height - 11 * mm
    c.setFillColor(TEAL)
    c.setFont("Deck-Bold", 7.2)
    c.drawString(inner_x, top, f"SQUADRA {team_number} · {scenario['classe']}")
    top -= 5.5 * mm
    top -= paragraph(c, "Foglio d'accusa", inner_x, top, inner_w, EVIDENCE_TITLE) + 3 * mm

    roles = "\n".join(f"{role} __________" for role in scenario["ruoliSquadra"])
    top -= draw_labeled_block(c, "Ruoli", roles, inner_x, top, inner_w, SMALL) + 4 * mm

    fields = [
        (scenario["domandaAccusa"], 2),
        ("Due codici-prova e perché", 2),
        ("Una pista o inferenza da scartare", 1),
        ("Soluzione: quattro mosse in ordine", 2),
        ("Missione segreta compiuta?  SÌ / NO", 1),
    ]
    for label, lines in fields:
        c.setFillColor(TEAL)
        c.setFont("Deck-Bold", 7.2)
        c.drawString(inner_x, top, label.upper())
        top -= 5.5 * mm
        for _ in range(lines):
            writing_line(c, inner_x, top, inner_w)
            top -= 7 * mm


def team_page(c: canvas.Canvas, scenario: dict, page_number: int) -> None:
    top = page_title(c, "Una scheda per ogni squadra", "Accusa motivata", scenario, page_number)
    bottom = 13 * mm
    usable_top = top - 3 * mm
    width = (PAGE_W - 2 * MARGIN - GAP) / 2
    height = (usable_top - bottom - GAP) / 2
    for offset in range(4):
        row = offset // 2
        col = offset % 2
        x = MARGIN + col * (width + GAP)
        y = usable_top - (row + 1) * height - row * GAP
        team_sheet(c, scenario, offset + 1, x, y, width, height)
    c.showPage()


def build_pdf(scenario: dict) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"cluedo-servizi-{scenario['id']}.pdf"
    c = canvas.Canvas(str(output_path), pagesize=A4, pageCompression=1)
    c.setTitle(f"Servizi in giallo - {scenario['classe']} - {scenario['caso']}")
    c.setAuthor("Metodologie Operative - IIS Meucci Mattei")
    c.setSubject("Carte stampabili per il gioco investigativo Servizi in giallo")
    cover_page(c, scenario, 1)
    next_page = witness_pages(c, scenario, 2)
    next_page = evidence_pages(c, scenario, next_page)
    mission_page(c, scenario, next_page)
    team_page(c, scenario, next_page + 1)
    c.save()
    return output_path


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    outputs = [build_pdf(scenario) for scenario in data["classi"]]
    for output in outputs:
        print(output)


if __name__ == "__main__":
    main()
