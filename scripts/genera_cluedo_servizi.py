#!/usr/bin/env python3
"""Genera uno o tutti i mazzi stampabili di Servizi in giallo."""

from __future__ import annotations

import argparse
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
    cover_label = "SERVIZI IN GIALLO · CACCIA ALL'IMPOSTORE" if scenario.get("haImpostore") else "SERVIZI IN GIALLO · CACCIA AL SABOTATORE"
    c.drawString(MARGIN, PAGE_H - 20 * mm, cover_label)
    c.setFont("Deck-Bold", 38)
    c.drawString(MARGIN, PAGE_H - 39 * mm, scenario["classe"])
    c.setFont("Deck-Bold", 22)
    c.drawString(MARGIN, PAGE_H - 53 * mm, scenario["caso"])

    top = PAGE_H - 82 * mm
    paragraph(c, scenario["focus"], MARGIN, top, PAGE_W - 2 * MARGIN, ParagraphStyle("Focus", parent=CARD_TITLE, fontSize=20, leading=23, textColor=INK))
    top -= 27 * mm

    composition = "5 carte Testimone · 1 biglietto dell'impostore · 8 carte Prova · 4 Missioni segrete · 4 schede Squadra. La soluzione resta nella regia docente." if scenario.get("haImpostore") else "5 carte Testimone · 8 carte Prova · 4 Missioni segrete · 4 schede Squadra. La soluzione resta nella regia docente."
    essential_rule = "Quattro testimoni dicono il vero. L'impostore può usare una sola risposta evasiva già scritta e poi deve ammettere l'azione; non può inventare fatti o accusare altri." if scenario.get("haImpostore") else "I testimoni non mentono, non inventano e non mostrano la carta. Il dettaglio riservato viene comunicato solo quando la squadra formula una domanda pertinente."
    blocks = [
        ("Composizione del mazzo", composition),
        ("Stampa", "Stampa a grandezza effettiva, su un solo lato. Taglia lungo i bordi. Se hai più di quattro squadre, ristampa soltanto l'ultima pagina."),
        ("Allestimento", "Di norma cinque studenti restano alle postazioni Testimone; gli altri lavorano in squadre da 2-6. Se ci sono assenti, i ruoli si accorpano seguendo la guida online. Ogni squadra pesca una Missione segreta."),
        ("Regola essenziale", essential_rule),
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
    impostor = witness.get("impostore")
    accent = RED if impostor else TEAL
    cut_card(c, x, y, width, height, accent=accent, fill=CREAM if impostor else white)
    inner_x = x + 6 * mm
    inner_w = width - 12 * mm
    top = y + height - 10 * mm
    c.setFillColor(accent)
    c.setFont("Deck-Bold", 7.5)
    header = f"TESTIMONE {index} · RUOLO SEGRETO" if impostor else f"TESTIMONE {index}"
    c.drawString(inner_x, top, header)
    top -= 6 * mm
    top -= paragraph(c, witness["ruolo"], inner_x, top, inner_w, CARD_TITLE) + 4 * mm

    if impostor:
        impostor_small = ParagraphStyle("ImpostorSmall", parent=SMALL, fontSize=7.4, leading=9.3, textColor=INK)
        top -= draw_labeled_block(c, "Ciò che puoi dire subito", witness["pubblico"], inner_x, top, inner_w, impostor_small) + 3 * mm
        c.setFillColor(RED)
        top -= paragraph(c, impostor["titolo"], inner_x, top, inner_w, ParagraphStyle("ImpostorTitle", parent=LABEL, fontSize=8.2, leading=9.5, textColor=RED)) + 1.2 * mm
        top -= draw_labeled_block(c, "Che cosa hai fatto", impostor["azione"], inner_x, top, inner_w, impostor_small) + 3 * mm
        draw_labeled_block(c, "Come devi giocare", impostor["regola"], inner_x, top, inner_w, impostor_small)
        return

    top -= draw_labeled_block(c, "Ciò che puoi dire subito", witness["pubblico"], inner_x, top, inner_w) + 4 * mm
    top -= draw_labeled_block(c, "Informazione riservata", witness["segreto"], inner_x, top, inner_w) + 4 * mm
    draw_labeled_block(c, "Quando rivelarla", witness["domanda"], inner_x, top, inner_w, SMALL)
    c.setFillColor(ORANGE_LIGHT)
    c.rect(x + 5 * mm, y + 5 * mm, width - 10 * mm, 8 * mm, stroke=0, fill=1)
    paragraph(c, "Non mostrare la carta. Non aggiungere dettagli.", x + 8 * mm, y + 11 * mm, width - 16 * mm, ParagraphStyle("Rule", parent=SMALL, fontName="Deck-Bold", textColor=ORANGE))


def impostor_prop_card(c: canvas.Canvas, prop: dict, x: float, y: float, width: float, height: float) -> None:
    cut_card(c, x, y, width, height, accent=RED, fill=CREAM)
    inner_x = x + 7 * mm
    inner_w = width - 14 * mm
    top = y + height - 11 * mm
    c.setFillColor(RED)
    c.setFont("Deck-Bold", 7.5)
    c.drawString(inner_x, top, "OGGETTO DI SCENA · SOLO PER L'IMPOSTORE")
    top -= 7 * mm
    top -= paragraph(c, prop["titolo"], inner_x, top, inner_w, CARD_TITLE) + 7 * mm
    c.setFillColor(white)
    c.setStrokeColor(RED)
    c.setLineWidth(1.1)
    c.rect(inner_x, top - 24 * mm, inner_w, 24 * mm, stroke=1, fill=1)
    paragraph(c, prop["testo"], inner_x + 5 * mm, top - 6 * mm, inner_w - 10 * mm, ParagraphStyle("PropText", parent=CARD_TITLE, fontSize=13, leading=15, textColor=RED, alignment=TA_CENTER))
    top -= 31 * mm
    draw_labeled_block(c, "Consegna riservata", prop["istruzione"], inner_x, top, inner_w, SMALL)


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
    extra = {"_impostor_prop": scenario["oggettoImpostore"]} if scenario.get("oggettoImpostore") else None
    cards = list(scenario["testimoni"]) + [extra]
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
            elif "_impostor_prop" in item:
                impostor_prop_card(c, item["_impostor_prop"], MARGIN, y, PAGE_W - 2 * MARGIN, height)
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


def evidence_card(c: canvas.Canvas, scenario: dict, evidence: dict, x: float, y: float, width: float, height: float) -> None:
    show_kind = scenario.get("mostraTipoProva", True)
    accent = type_color(evidence["tipo"]) if show_kind else TEAL
    cut_card(c, x, y, width, height, accent=accent, fill=white)
    inner_x = x + 6 * mm
    inner_w = width - 12 * mm
    top = y + height - 12 * mm
    c.setFillColor(accent)
    c.setFont("Deck-Bold", 20)
    c.drawString(inner_x, top, evidence["codice"])
    if show_kind:
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
            evidence_card(c, scenario, scenario["prove"][page_index * 4 + offset], x, y, width, height)
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

    if scenario.get("haImpostore"):
        fields = [
            (f"{scenario['domandaAccusa']} · 2 + 2 punti", 2),
            ("Due codici-prova e perché · 2 punti", 2),
            ("Una pista falsa da scartare · 1 punto", 1),
            ("Riparazione: quattro mosse · 2 punti", 2),
            ("Missione segreta compiuta? · 1 punto  SÌ / NO", 1),
        ]
    else:
        fields = [
            (scenario["domandaAccusa"], 2),
            ("Due codici-prova e perché", 2),
            ("Una pista o inferenza da scartare", 1),
            ("Soluzione: quattro mosse in ordine", 2),
            ("Missione segreta compiuta?  SÌ / NO", 1),
        ]
    for label, lines in fields:
        if scenario.get("haImpostore"):
            label_style = ParagraphStyle("TeamFieldLabel", parent=LABEL, fontSize=6.1, leading=7.1, textColor=TEAL)
            top -= paragraph(c, label.upper(), inner_x, top, inner_w, label_style) + 3.2 * mm
            line_gap = 5.4 * mm
        else:
            c.setFillColor(TEAL)
            c.setFont("Deck-Bold", 7.2)
            c.drawString(inner_x, top, label.upper())
            top -= 5.5 * mm
            line_gap = 7 * mm
        for _ in range(lines):
            writing_line(c, inner_x, top, inner_w)
            top -= line_gap


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
    if scenario['id'] == '3sa':
        from build_gioco_3sa import load, make_pdf, make_web, active_story, BASE
        rules, story = load(BASE / 'storie' / (active_story()+'.json'))
        output, _ = make_pdf(rules, story)
        make_web(rules, story)
        return output
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--classe", choices=["3sa", "3sb", "4sb", "5sa"], help="Genera soltanto il mazzo indicato")
    args = parser.parse_args()
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    scenarios = data["classi"]
    if args.classe:
        scenarios = [scenario for scenario in scenarios if scenario["id"] == args.classe]
    outputs = [build_pdf(scenario) for scenario in scenarios]
    for output in outputs:
        print(output)


if __name__ == "__main__":
    main()
