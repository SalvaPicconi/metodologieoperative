#!/usr/bin/env python3
"""Riscrive testata, menu e briciole di tutte le pagine del sito.

Il menu è uno solo e va cambiato qui, non a mano pagina per pagina:
    python3 scripts/nav.py

Per ogni pagina con il menu lo script genera, nell'ordine:
- la testata (<header> subito prima del menu), uguale per tutto il sito;
- il menu (<nav>), costruito sui tre livelli di LIVELLI;
- le briciole («Sei qui»), con la voce precedente e la successiva dello stesso livello;
- il richiamo ad assets/nav.js, che chiude il menu nei telefoni.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSIONE = "20261024"

# I tre livelli del sito, nell'ordine della home.
# (titolo, ancora in home, modo, [(voce, link), ...])
# "piatto" mette le voci direttamente nella barra, "tendina" le raccoglie in un sottomenu.
LIVELLI = [
    ("Le classi", "classi", "piatto", [
        ("Biennio", "biennio.html"),
        ("Terzo anno", "terzo.html"),
        ("Quarto anno", "quarto.html"),
        ("Quinto anno", "quinto.html"),
    ]),
    ("Metodi e laboratori", "metodi", "tendina", [
        ("Lezioni partecipate", "lezioni-partecipate.html"),
        ("Laboratorio", "laboratorio.html"),
        ("Peer tutoring", "peer_tutoring.html"),
        ("Compresenza Scienze umane", "compresenza.html"),
        ("Attività di orientamento", "orientamento.html"),
        ("Educazione civica", "educazione-civica.html"),
        ("Intelligenza artificiale", "intelligenza-artificiale.html"),
        ("Glossario", "glossario.html"),
    ]),
    ("Docente", "docente", "tendina", [
        ("Programmi SSAS", "programmi.html"),
        ("Programmazione individuale", "programmazione.html"),
        ("Programmazione Carola", "programmi-carola.html"),
        ("Area docente", "area_docente.html"),
    ]),
]

# Pagine interne: accendono la voce del menu da cui si raggiungono
# e compaiono come ultimo anello delle briciole.
ALIAS = {
    "lab_infanzia.html": ("laboratorio.html", "Attività educative per l’infanzia"),
    "lab_dipendenze.html": ("laboratorio.html", "Un primo colloquio al SerD"),
    "lab_animazione.html": ("laboratorio.html", "Animazione ludico-ricreativa"),
    "stroop_statistiche.html": ("area_docente.html", "Statistiche Test di Stroop"),
}

TESTATA = """<header class="testata">
        <div class="container">
            <a class="testata-marchio" href="index.html">
                <img src="logo/mark.svg" alt="" width="44" height="44">
                <span>
                    <span class="testata-scuola">IIS Meucci-Mattei · Decimomannu</span>
                    <span class="testata-titolo">Metodologie Operative</span>
                    <span class="testata-indirizzo">Servizi per la Sanità e l’Assistenza Sociale</span>
                </span>
            </a>
        </div>
    </header>"""


def link(voce, href, attivo, extra=""):
    cls = ' class="active"' if attivo else ""
    corrente = ' aria-current="page"' if attivo and "#" not in href else ""
    return f'<a href="{href}"{cls}{corrente}{extra}>{voce}</a>'


def render_nav(corrente):
    righe = ["<nav>", '        <ul>',
             f'            <li>{link("Home", "index.html", corrente == "index.html")}</li>']
    for titolo, ancora, modo, voci in LIVELLI:
        if modo == "piatto":
            for i, (nome, href) in enumerate(voci):
                cls = "nav-piatto" + (" nav-fine-livello" if i == len(voci) - 1 else "")
                righe.append(f'            <li class="{cls}">{link(nome, href, href == corrente)}</li>')
            continue
        attivo = any(h == corrente for _, h in voci)
        righe.append(f'            <li class="nav-group">{link(titolo, "index.html#" + ancora, attivo)}')
        righe.append('                <ul class="nav-sub">')
        for nome, href in voci:
            righe.append(f"                    <li>{link(nome, href, href == corrente)}</li>")
        righe.append("                </ul>")
        righe.append("            </li>")
    righe += ["        </ul>", "    </nav>"]
    return "\n".join(righe)


def render_briciole(pagina):
    """Home › livello › voce [› pagina interna], più la voce precedente e la successiva."""
    corrente, interna = ALIAS.get(pagina, (pagina, None))
    for titolo, ancora, _, voci in LIVELLI:
        hrefs = [h for _, h in voci]
        if corrente not in hrefs:
            continue
        i = hrefs.index(corrente)
        nome = voci[i][0]
        anelli = ['<a href="index.html">Home</a>',
                  f'<a href="index.html#{ancora}">{titolo}</a>']
        if interna:
            anelli += [f'<a href="{corrente}">{nome}</a>',
                       f'<span aria-current="page">{interna}</span>']
        else:
            anelli.append(f'<span aria-current="page">{nome}</span>')
        sep = '<span class="briciole-sep" aria-hidden="true">›</span>'
        vicini = ""
        if not interna:
            prima = (f'<a href="{voci[i - 1][1]}" rel="prev">← {voci[i - 1][0]}</a>'
                     if i > 0 else "")
            dopo = (f'<a href="{voci[i + 1][1]}" rel="next">{voci[i + 1][0]} →</a>'
                    if i < len(voci) - 1 else "")
            vicini = f'\n            <p class="briciole-vicini">{prima}{dopo}</p>'
        return ('<div class="briciole" role="navigation" aria-label="Sei qui">\n'
                '        <div class="container">\n'
                f'            <p class="briciole-percorso">{sep.join(anelli)}</p>'
                f'{vicini}\n'
                '        </div>\n'
                '    </div>')
    return ""


def render_blocco(pagina):
    corrente = ALIAS.get(pagina, (pagina, None))[0]
    parti = [TESTATA, "", "    " + render_nav(corrente), "    <!-- briciole: scripts/nav.py -->"]
    briciole = render_briciole(pagina)
    if briciole:
        parti.append("    " + briciole)
    parti.append(f'    <script src="assets/nav.js?v={VERSIONE}" defer></script>')
    parti.append("    <!-- /briciole -->")
    return "\n".join(parti).lstrip()


def main():
    # La testata è il <header> che precede il menu; le briciole stanno fra i due commenti.
    blocco_re = re.compile(
        r"(?:<header\b(?:(?!</header>).)*</header>\s*)?<nav>.*?</nav>"
        r"(?:\s*<!-- briciole: scripts/nav\.py -->.*?<!-- /briciole -->)?",
        re.S,
    )
    for f in sorted(ROOT.glob("*.html")):
        testo = f.read_text(encoding="utf-8")
        if not blocco_re.search(testo):
            continue
        nuovo = blocco_re.sub(lambda _: render_blocco(f.name), testo, count=1)
        if nuovo != testo:
            f.write_text(nuovo, encoding="utf-8")
            print("menu aggiornato:", f.name)


if __name__ == "__main__":
    main()
