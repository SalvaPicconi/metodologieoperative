#!/usr/bin/env python3
"""Controlla che le attività con risposte siano agganciate alla correzione del docente.

Regola del titolare (23/11/2026): ogni pagina di autoapprendimento (o laboratorio, o verifica) che salva
risposte nasce già agganciata alla correzione nella pagina e all'Area docente. Quindi, per ogni voce di
materiali.json di tipo interattivo, verifica o laboratorio la cui pagina include assets/progress.js:

- la pagina è in assets/verifiche-correzione.json («verifiche»), oppure
- è nell'elenco «da_agganciare» dello stesso file (pagine già online il 23/11/2026, da sistemare).

Per ogni pagina agganciata: il file esiste, include assets/correzione-in-pagina.js prima di
assets/progress.js. La tabella private.verifiche_elenco su Supabase non si controlla da qui: la riga
si aggiunge con supabase/verifiche-elenco-aggiungi.sql (vedi .claude/skills/nuovo-materiale/SKILL.md).

Si lancia da solo o da scripts/programmi.py (build e check), quindi anche prima di ogni pubblicazione.
"""
import json
import pathlib
import sys

RADICE = pathlib.Path(__file__).resolve().parent.parent
TIPI = {"interattivo", "verifica", "laboratorio"}


def voci_materiali(dati):
    out = []

    def visita(o):
        if isinstance(o, dict):
            if isinstance(o.get("file"), str) and o.get("tipo") in TIPI:
                out.append(o)
            for v in o.values():
                visita(v)
        elif isinstance(o, list):
            for v in o:
                visita(v)

    visita({k: v for k, v in dati.items() if k != "archivio"})
    return out


def controlla():
    errori = []
    cfg = json.loads((RADICE / "assets/verifiche-correzione.json").read_text(encoding="utf-8"))
    agganciate = {v["pagina"]: v for v in cfg.get("verifiche", [])}
    da_agganciare = set(cfg.get("da_agganciare", []))

    for pagina in sorted(agganciate):
        f = RADICE / pagina
        if not f.exists():
            errori.append(f"{pagina}: è in verifiche-correzione.json ma il file non esiste")
            continue
        testo = f.read_text(encoding="utf-8", errors="ignore")
        i_corr = testo.find("assets/correzione-in-pagina.js")
        i_prog = testo.find("assets/progress.js")
        if i_prog < 0:
            errori.append(f"{pagina}: non include assets/progress.js, quindi non salva le risposte")
        if i_corr < 0:
            errori.append(f"{pagina}: manca <script src=\"…/assets/correzione-in-pagina.js?v=…\"> (prima di progress.js)")
        elif i_prog >= 0 and i_corr > i_prog:
            errori.append(f"{pagina}: correzione-in-pagina.js va incluso PRIMA di progress.js")
    for pagina in sorted(da_agganciare & set(agganciate)):
        errori.append(f"{pagina}: è già agganciata, toglila da «da_agganciare»")

    materiali = json.loads((RADICE / "materiali.json").read_text(encoding="utf-8"))
    viste = set()
    for voce in voci_materiali(materiali):
        pagina = voce["file"].split("#")[0].split("?")[0]
        if pagina in viste or not pagina.endswith(".html"):
            continue
        viste.add(pagina)
        f = RADICE / pagina
        if not f.exists() or "assets/progress.js" not in f.read_text(encoding="utf-8", errors="ignore"):
            continue
        if pagina not in agganciate and pagina not in da_agganciare:
            errori.append(
                f"{pagina} ({voce.get('tipo')}): salva risposte ma non è agganciata alla correzione. "
                "Aggiungila a assets/verifiche-correzione.json, includi assets/correzione-in-pagina.js "
                "e aggiungi la riga in private.verifiche_elenco (supabase/verifiche-elenco-aggiungi.sql)."
            )
    return errori


def main():
    errori = controlla()
    if errori:
        print("Correzione delle attività: controlli NON superati")
        for e in errori:
            print("  -", e)
        return 1
    print("  Correzione delle attività: tutte le pagine con risposte sono agganciate (o in «da_agganciare»).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
