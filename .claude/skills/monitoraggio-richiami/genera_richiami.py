#!/usr/bin/env python3
"""Genera il file Word «a che punto sei» di una classe (modello approvato dal titolare il 26/11/2026).

Uso: python3 genera_richiami.py dati.json uscita.docx
I dati degli alunni stanno solo nella scratchpad, mai nel repository. Struttura di dati.json:
{
  "titolo": "3SA · I servizi sociosanitari",
  "intro": "Care studentesse e cari studenti, ecco a che punto siete con … Completate quello che manca.",
  "valutata": "Questa attività verrà valutata.",          (facoltativo; per più attività: «Tutte queste attività verranno valutate.»)
  "sezioni": [
    {"nome": "1 · Il caso professionale",                 (solo se le attività sono più di una)
     "link": "https://www.metodologieoperativessas.it/materiali/…html",
     "fare": "moduli 1-5 (…).",
     "scadenza": "venerdì 27 novembre 2026",              (vuota = «__________»: resta valida la scadenza già data)
     "righe": [["CODICE", "fatto|meta|nuovo", "Che cosa ti manca"], …]}
  ]
}
"""
import json, sys
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

BLU = RGBColor(0x17, 0x38, 0x5a); ROSA = RGBColor(0xd6, 0x10, 0x5f); BIANCO = RGBColor(255, 255, 255)
STATI = {"fatto": ("✅ Fatto", "E3F2E8"), "meta": ("🟡 A metà", "FFF4D6"), "nuovo": ("🔴 Da iniziare", "FBE3EC")}

def run(p, testo, bold=False, color=None, size=None):
    r = p.add_run(testo); r.bold = bold
    if color: r.font.color.rgb = color
    if size: r.font.size = Pt(size)

def sfondo(cella, colore):
    s = OxmlElement('w:shd'); s.set(qn('w:val'), 'clear'); s.set(qn('w:color'), 'auto'); s.set(qn('w:fill'), colore)
    cella._tc.get_or_add_tcPr().append(s)

def link(p, url, testo):
    r_id = p.part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    h = OxmlElement('w:hyperlink'); h.set(qn('r:id'), r_id)
    r = OxmlElement('w:r'); rPr = OxmlElement('w:rPr')
    c = OxmlElement('w:color'); c.set(qn('w:val'), '1F5FA8'); rPr.append(c)
    u = OxmlElement('w:u'); u.set(qn('w:val'), 'single'); rPr.append(u); r.append(rPr)
    t = OxmlElement('w:t'); t.text = testo; r.append(t); h.append(r); p._p.append(h)

def tabella(d, righe):
    t = d.add_table(rows=1, cols=3); t.style = 'Table Grid'; t.autofit = False
    lay = OxmlElement('w:tblLayout'); lay.set(qn('w:type'), 'fixed'); t._tbl.tblPr.append(lay)
    larg = [3.4, 3.4, 11.2]
    for i, gc in enumerate(t._tbl.tblGrid.findall(qn('w:gridCol'))): gc.set(qn('w:w'), str(int(larg[i] * 567)))
    for i, h in enumerate(["Alunno", "Stato", "Che cosa ti manca"]):
        c = t.rows[0].cells[i]; c.text = ''; run(c.paragraphs[0], h, bold=True, color=BIANCO, size=11); sfondo(c, '17385A')
    for codice, stato, manca in righe:
        etichetta, colore = STATI[stato]
        cells = t.add_row().cells
        for i, v in enumerate([codice, etichetta, manca]):
            cells[i].text = ''; run(cells[i].paragraphs[0], v, bold=(i == 0), size=11)
        sfondo(cells[1], colore)
    for row in t.rows:
        trPr = row._tr.get_or_add_trPr(); cs = OxmlElement('w:cantSplit'); cs.set(qn('w:val'), 'true'); trPr.append(cs)
        for i, w in enumerate(larg): row.cells[i].width = Cm(w)

def genera(dati, uscita):
    d = Document()
    for s in d.sections: s.top_margin = s.bottom_margin = Cm(1.5); s.left_margin = s.right_margin = Cm(1.5)
    d.styles['Normal'].font.name = 'Calibri'; d.styles['Normal'].font.size = Pt(12)
    run(d.add_paragraph(), dati["titolo"], bold=True, color=BLU, size=18)
    run(d.add_paragraph(), dati["intro"])
    if dati.get("valutata"): run(d.add_paragraph(), "📌 " + dati["valutata"], bold=True, color=ROSA)
    for s in dati["sezioni"]:
        if s.get("nome"):
            p = d.add_paragraph(); p.paragraph_format.space_before = Pt(10); run(p, s["nome"], bold=True, color=ROSA, size=13)
        p = d.add_paragraph(); run(p, "👉 "); link(p, s["link"], "Apri l’attività")
        if s.get("fare"):
            p = d.add_paragraph(); run(p, "Da fare: ", bold=True); run(p, s["fare"])
        p = d.add_paragraph(); run(p, "Scadenza: ", bold=True); run(p, s.get("scadenza") or "__________")
        tabella(d, s["righe"])
    d.save(uscita)

if __name__ == "__main__":
    genera(json.load(open(sys.argv[1], encoding="utf-8")), sys.argv[2])
