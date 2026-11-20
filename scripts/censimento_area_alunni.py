"""Censimento delle pagine del catalogo per l'Area alunni («I miei lavori»).

Legge materiali.json (anche l'archivio) e il codice di ogni pagina HTML, e classifica il modo in cui
salva: flusso comune con percorso reale (si può abilitare), flusso comune con identificativo interno,
flusso separato, solo sul dispositivo, nessun salvataggio. Non legge dati di studenti.
Uso: python3 scripts/censimento_area_alunni.py > /percorso/censimento.md
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PILOTA = {
    "materiali/biennio/tssas_percorso_completo_v2.html",
    "materiali/biennio/welfare-4-fasi-COMPLETO.html",
    "materiali/laboratorio/collage_autobiografico.html",
    "materiali/terzo/percorsi_autoapprendimento.html",
    "materiali/terzo/ripasso-terzo-anno.html",
}
SEPARATI = {
    "materiali/peer_tutoring/peer_tutoring_2026_2027.html": "chiama direttamente progress_salva/progress_carica",
    "materiali/biennio/verifica-operatore-terza.html": "verifica con accesso, invio e restituzione propri",
    "materiali/compresenza/test-stroop.html": "risultati Stroop in tabelle proprie",
}


def classifica(file, testo, js_locali):
    if file in SEPARATI:
        return "flusso separato", SEPARATI[file]
    comune = "progress-global" in testo
    if comune:
        # La configurazione può stare nella pagina o in uno script locale della pagina.
        tutto = "\n".join([testo, *js_locali])
        cfg = (re.search(r"MO_PROGRESS_CONFIG\s*=\s*\{(.*?)\n\s*\};", tutto, re.S)
               or re.search(r"MO_PROGRESS_CONFIG\s*=\s*\{([^\n]*)\};", tutto))
        corpo = cfg.group(1) if cfg else ""
        if re.search(r"disabled\s*:\s*true", corpo):
            return "nessun salvataggio", "flusso comune disattivato nella pagina"
        reale = re.search(r"pagePath\s*:\s*window\.location\.pathname", corpo)
        if file in PILOTA:
            return "integrata", "pilota: riapertura protetta collaudata in anteprima" if reale else "pilota"
        letterale = re.search(r"pagePath\s*:\s*['\"]([^'\"]+)['\"]", corpo)
        if reale or (letterale and letterale.group(1).lstrip('/') == file):
            return "compatibile", "flusso comune con percorso reale: si abilita senza modifiche"
        pid = re.search(r'<meta[^>]*name="page-id"[^>]*content="([^"]+)"|<meta[^>]*content="([^"]+)"[^>]*name="page-id"', testo)
        ident = (pid.group(1) or pid.group(2)) if pid else None
        if ident:
            return "storico consultabile", f"salva con l'identificativo interno «{ident}»: serve un alias verificato per riaprirla dall'area"
        return "compatibile", "flusso comune senza percorso esplicito: usa l'indirizzo della pagina"
    locale = re.search(r"localStorage\.setItem", testo) or any(re.search(r"localStorage\.setItem", j) for j in js_locali)
    if locale:
        return "solo sul dispositivo", "le risposte restano nel browser in cui sono state scritte"
    return "nessun salvataggio", "pagina di sola lettura o presentazione"


def script_locali(file, testo):
    base = (ROOT / file).parent
    out = []
    for src in re.findall(r'<script[^>]+src="([^"?#]+)', testo):
        if src.startswith("http"):
            continue
        p = (base / src).resolve()
        if p.is_file() and "assets/progress" not in str(p) and p.suffix == ".js":
            out.append(p.read_text(encoding="utf-8", errors="ignore"))
    return out


def main():
    dati = json.loads((ROOT / "materiali.json").read_text(encoding="utf-8"))
    righe = []
    visti = set()
    for sezione, voci in dati.items():
        if not isinstance(voci, list):
            continue
        for m in voci:
            file = m.get("file", "")
            if not file.endswith(".html") or file in visti:
                continue
            visti.add(file)
            percorso = ROOT / file
            if not percorso.is_file():
                righe.append((sezione, m.get("titolo", ""), file, "file assente", ""))
                continue
            testo = percorso.read_text(encoding="utf-8", errors="ignore")
            stato, nota = classifica(file, testo, script_locali(file, testo))
            righe.append((sezione, m.get("titolo", ""), file, stato, nota))
    for extra in sorted(SEPARATI):
        if extra not in visti:
            righe.append(("fuori catalogo", "", extra, "flusso separato", SEPARATI[extra]))
    ordine = ["integrata", "compatibile", "storico consultabile", "flusso separato", "solo sul dispositivo", "nessun salvataggio", "file assente"]
    righe.sort(key=lambda r: (ordine.index(r[3]), r[0], r[2]))
    conteggi = {k: sum(1 for r in righe if r[3] == k) for k in ordine}
    print("| Copertura | Sezione | Titolo | File | Nota |\n| --- | --- | --- | --- | --- |")
    for sezione, titolo, file, stato, nota in righe:
        print(f"| {stato} | {sezione} | {titolo.replace('|', '/')} | `{file}` | {nota} |")
    print("\nRiepilogo: " + ", ".join(f"{k} {v}" for k, v in conteggi.items() if v))


if __name__ == "__main__":
    main()
