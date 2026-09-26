#!/usr/bin/env python3
"""Riscrive il blocco <nav> di tutte le pagine del sito con il menu unico.

Il menu è uno solo e va cambiato qui, non a mano pagina per pagina:
    python3 scripts/nav.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# (voce, link) oppure (voce, link, [sottovoci])
MENU = [
    ("Home", "index.html"),
    ("Biennio", "biennio.html"),
    ("Terzo anno", "terzo.html"),
    ("Quarto anno", "quarto.html"),
    ("Quinto anno", "quinto.html"),
    ("Metodi e laboratori", "index.html#metodi", [
        ("Lezioni partecipate", "lezioni-partecipate.html"),
        ("Laboratorio", "laboratorio.html"),
        ("Peer tutoring", "peer_tutoring.html"),
        ("Compresenza Scienze umane", "compresenza.html"),
    ]),
    ("Intelligenza artificiale", "intelligenza-artificiale.html"),
    ("Docente", "index.html#docente", [
        ("Programmi", "programmi.html"),
        ("Area docente", "area_docente.html"),
        ("Anno di prova", "anno-di-prova.html"),
    ]),
]

# Pagine interne che accendono una voce del menu diversa dalla propria
ALIAS = {
    "lab_infanzia.html": "laboratorio.html",
    "lab_dipendenze.html": "laboratorio.html",
    "lab_animazione.html": "laboratorio.html",
    "stroop_statistiche.html": "area_docente.html",
}


def link(voce, href, attivo, extra=""):
    cls = ' class="active"' if attivo else ""
    corrente = ' aria-current="page"' if attivo and "#" not in href else ""
    return f'<a href="{href}"{cls}{corrente}{extra}>{voce}</a>'


def render(pagina):
    corrente = ALIAS.get(pagina, pagina)
    righe = ["<nav>", "        <ul>"]
    for voce in MENU:
        if len(voce) == 2:
            nome, href = voce
            li = ' class="nav-ai"' if href == "intelligenza-artificiale.html" else ""
            righe.append(f"            <li{li}>{link(nome, href, href == corrente)}</li>")
        else:
            nome, href, sotto = voce
            attivo = any(h == corrente for _, h in sotto)
            righe.append(f'            <li class="nav-group">{link(nome, href, attivo)}')
            righe.append('                <ul class="nav-sub">')
            for n, h in sotto:
                righe.append(f"                    <li>{link(n, h, h == corrente)}</li>")
            righe.append("                </ul>")
            righe.append("            </li>")
    righe += ["        </ul>", "    </nav>"]
    return "\n".join(righe)


def main():
    nav_re = re.compile(r"<nav>.*?</nav>", re.S)
    for f in sorted(ROOT.glob("*.html")):
        testo = f.read_text(encoding="utf-8")
        if not nav_re.search(testo):
            continue
        nuovo = nav_re.sub(lambda _: render(f.name), testo, count=1)
        if nuovo != testo:
            f.write_text(nuovo, encoding="utf-8")
            print("menu aggiornato:", f.name)


if __name__ == "__main__":
    main()
