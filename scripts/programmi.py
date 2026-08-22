#!/usr/bin/env python3
"""Costruisce e verifica programmi.json a partire dalle sorgenti in programmi-src/.

Sottocomandi:
    build          ricostruisce programmi.json dopo aver superato tutti i controlli
    check          esegue i controlli senza scrivere nulla
    list           elenca anni, moduli, competenze coperte e competenze scoperte
    nuovo-modulo   stampa lo scheletro di un modulo gia' tarato sul livello QNQ dell'anno

I messaggi di errore indicano sempre file, modulo e attivita' da correggere.
Finche' i controlli non passano, programmi.json resta all'ultima versione valida.
"""

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
SORGENTI = RADICE / "programmi-src"
USCITA = RADICE / "programmi.json"

ANNI = ["Primo anno", "Secondo anno", "Terzo anno", "Quarto anno", "Quinto anno"]

CAMPI_PROVA = ["titolo", "compito", "contesto", "prodotto", "durata", "modalita", "risorse", "evidenze"]

# Campi che rendono un modulo una UDA nel senso del D.M. 92/2018.
CAMPI_UDA = ["periodo", "monteOre", "prodottoFinale", "fasi"]


class ErroriRaccolti:
    """Accumula i problemi invece di fermarsi al primo, cosi' si correggono in blocco."""

    def __init__(self):
        self.voci = []

    def aggiungi(self, dove, problema, rimedio=""):
        self.voci.append((dove, problema, rimedio))

    def __bool__(self):
        return bool(self.voci)

    def stampa(self):
        print(f"\n  {len(self.voci)} problema/i da correggere:\n", file=sys.stderr)
        for dove, problema, rimedio in self.voci:
            print(f"  ✗ {dove}", file=sys.stderr)
            print(f"    {problema}", file=sys.stderr)
            if rimedio:
                for riga in rimedio.splitlines():
                    print(f"    → {riga}", file=sys.stderr)
            print(file=sys.stderr)


def leggi_json(percorso):
    if not percorso.exists():
        print(f"File mancante: {percorso.relative_to(RADICE)}", file=sys.stderr)
        sys.exit(1)
    try:
        return json.loads(percorso.read_text(encoding="utf-8"))
    except json.JSONDecodeError as errore:
        print(f"JSON non valido in {percorso.relative_to(RADICE)}, riga {errore.lineno}: {errore.msg}", file=sys.stderr)
        sys.exit(1)


def carica_sorgenti():
    curricolo = leggi_json(SORGENTI / "curricolo-ssas.json")["traguardi"]
    livelli = leggi_json(SORGENTI / "livelli-qnq.json")
    impianto = leggi_json(SORGENTI / "impianto-didattico.json")

    blocchi = []
    for anno in ANNI:
        nome = "moduli-" + anno.lower().replace(" ", "-") + ".json"
        percorso = SORGENTI / nome
        if percorso.exists():
            blocchi.append(leggi_json(percorso))

    alternativi = SORGENTI / "modulo-tutela-minori.json"
    if alternativi.exists():
        blocchi.append(leggi_json(alternativi))

    return curricolo, livelli, impianto, blocchi


def indicizza_curricolo(curricolo):
    """(periodo, competenza) -> traguardo, per la verifica degli agganci."""
    indice = {}
    for traguardo in curricolo:
        indice[(traguardo["periodo"], traguardo["competenza"])] = traguardo
    return indice


def controlla_qnq_verbatim(livelli, errori):
    testo = (SORGENTI / "qnq-tabella-a.txt").read_text(encoding="utf-8")
    for livello in ("2", "3", "4"):
        blocco = re.search(rf"--- LIVELLO {livello} ---(.*?)(?=\n---|\Z)", testo, re.S)
        if not blocco:
            errori.aggiungi("programmi-src/qnq-tabella-a.txt", f"manca il blocco del livello {livello}")
            continue
        campi = {}
        chiave = None
        for riga in blocco.group(1).strip().splitlines():
            riga = riga.strip()
            if not riga:
                continue
            if riga in ("CONOSCENZE", "ABILITA", "TIPICAMENTE", "AUTONOMIA E RESPONSABILITA"):
                chiave = riga
                campi[chiave] = ""
            elif chiave:
                campi[chiave] = (campi[chiave] + " " + riga).strip()
        atteso = {
            "conoscenze": campi.get("CONOSCENZE", ""),
            "abilita": campi.get("ABILITA", ""),
            "tipicamente": campi.get("TIPICAMENTE", ""),
            "autonomiaResponsabilita": campi.get("AUTONOMIA E RESPONSABILITA", ""),
        }
        effettivo = livelli["descrittori"].get(livello, {})
        for campo, valore in atteso.items():
            if effettivo.get(campo, "") != valore:
                errori.aggiungi(
                    f"programmi-src/livelli-qnq.json → descrittori.{livello}.{campo}",
                    "il descrittore non coincide con la Tabella A del D.I. 8 gennaio 2018",
                    "è testo normativo: riallinealo a programmi-src/qnq-tabella-a.txt",
                )


def controlla_uda(modulo, dove, errori):
    """Ogni modulo deve essere una UDA completa: periodo, ore, prodotto e fasi."""
    for campo in CAMPI_UDA:
        if not modulo.get(campo):
            errori.aggiungi(dove, f"campo UDA mancante o vuoto: {campo}",
                            "ogni UDA dichiara periodo, monteOre, prodottoFinale e fasi;\n"
                            "usa: python3 scripts/programmi.py nuovo-modulo --anno \"<anno>\"")
    fasi = modulo.get("fasi")
    if isinstance(fasi, list) and 0 < len(fasi) < 3:
        errori.aggiungi(dove, f"la UDA ha solo {len(fasi)} fase/i",
                        "servono almeno tre fasi: avvio, costruzione delle conoscenze, laboratorio")
    prodotto = (modulo.get("prodottoFinale") or "").strip().lower()
    prova = (modulo.get("provaEsperta") or {}).get("prodotto", "").strip().lower()
    if prodotto and prova and not set(prodotto.split()) & set(prova.split()):
        errori.aggiungi(dove, "prodottoFinale e provaEsperta.prodotto non hanno nulla in comune",
                        f"UDA: «{modulo.get('prodottoFinale')}»\nprova: «{(modulo.get('provaEsperta') or {}).get('prodotto')}»\n"
                        "il prodotto della UDA è quello che si consegna nella prova esperta")


def controlla_prova(prova, livello, dove, errori):
    if not prova:
        errori.aggiungi(dove, "manca la prova esperta di laboratorio",
                        "ogni modulo deve avere una prova con un prodotto concreto")
        return
    for campo in CAMPI_PROVA:
        if not prova.get(campo):
            errori.aggiungi(f"{dove} → provaEsperta", f"campo obbligatorio vuoto o assente: {campo}")
    if "imprevisto" not in prova:
        errori.aggiungi(f"{dove} → provaEsperta", "manca il campo imprevisto",
                        'al livello 2 va lasciato "", dal livello 3 in su va compilato')
        return

    imprevisto = (prova.get("imprevisto") or "").strip()
    modalita = (prova.get("modalita") or "").lower()
    risorse = " ".join(prova.get("risorse") or []).lower()
    evidenze = " ".join(prova.get("evidenze") or []).lower()

    if livello == "2":
        if imprevisto:
            errori.aggiungi(f"{dove} → provaEsperta.imprevisto",
                            "il livello QNQ 2 non prevede imprevisti: il compito resta quello annunciato",
                            'lascia il campo vuoto ("")')
        if "format" not in risorse:
            errori.aggiungi(f"{dove} → provaEsperta.risorse",
                            "al livello QNQ 2 la consegna è passo per passo: manca il format fornito",
                            'aggiungi fra le risorse il format o la scheda già impostata')
    elif livello == "3":
        if not imprevisto:
            errori.aggiungi(f"{dove} → provaEsperta.imprevisto",
                            "al livello QNQ 3 serve una variabile che cambia a metà prova")
        if "ruoli" not in modalita:
            errori.aggiungi(f"{dove} → provaEsperta.modalita",
                            "al livello QNQ 3 si collabora con un ruolo assegnato",
                            'per esempio: "piccolo gruppo con ruoli assegnati"')
    elif livello == "3-4":
        if not imprevisto:
            errori.aggiungi(f"{dove} → provaEsperta.imprevisto",
                            "al livello QNQ 3-4 serve un imprevisto non annunciato nella consegna")
        if not any(t in evidenze for t in ("autocontrollo", "giustificaz", "verifica del proprio", "motivaz")):
            errori.aggiungi(f"{dove} → provaEsperta.evidenze",
                            "al livello QNQ 3-4 si valuta anche l'autocontrollo o la giustificazione delle scelte",
                            "aggiungi un'evidenza su come lo studente motiva e verifica il proprio prodotto")
    elif livello == "4":
        if not imprevisto:
            errori.aggiungi(f"{dove} → provaEsperta.imprevisto",
                            "al livello QNQ 4 servono imprevisti e gestione del tempo")
        if "coordina" not in modalita:
            errori.aggiungi(f"{dove} → provaEsperta.modalita",
                            "al livello QNQ 4 lo studente coordina e integra il lavoro altrui",
                            'per esempio: "gruppo con ruolo di coordinamento"')
        if "integraz" not in evidenze:
            errori.aggiungi(f"{dove} → provaEsperta.evidenze",
                            "al livello QNQ 4 si valuta l'integrazione dei contributi altrui",
                            "aggiungi un'evidenza sull'integrazione del lavoro del gruppo")


def controlla_agganci(attivita, periodo, indice, dove, errori):
    """Verifica che competenze, abilita' e conoscenze esistano davvero nel curricolo."""
    if attivita.get("aggancio") == "trasversale":
        if not attivita.get("nota"):
            errori.aggiungi(dove, "attività trasversale senza nota",
                            "spiega in una riga perché sta fuori dal curricolo di indirizzo")
        return set()

    agganci = attivita.get("agganci")
    if not agganci:
        errori.aggiungi(dove, "attività senza aggancio al curricolo",
                        'aggiungi "agganci" oppure marcala con "aggancio": "trasversale" e una nota')
        return set()

    competenze = set()
    for aggancio in agganci:
        competenza = aggancio.get("competenza")
        traguardo = indice.get((periodo, competenza))
        if not traguardo:
            disponibili = sorted(
                {c for (p, c) in indice if p == periodo},
                key=lambda x: int(x[1:]),
            )
            errori.aggiungi(f"{dove} → {competenza}",
                            f"la competenza {competenza} non esiste nel periodo «{periodo}»",
                            "competenze disponibili: " + ", ".join(disponibili))
            continue
        competenze.add(competenza)

        abilita_valide = set(traguardo["abilita"])
        conoscenze_valide = {c["nome"] for c in traguardo["conoscenze"]}

        for abilita in aggancio.get("abilita", []):
            if abilita not in abilita_valide:
                errori.aggiungi(f"{dove} → {competenza}",
                                f"abilità non presente nel curricolo: «{abilita}»",
                                "abilità disponibili:\n" + "\n".join(f"  · {a}" for a in sorted(abilita_valide)))
        for conoscenza in aggancio.get("conoscenze", []):
            if conoscenza not in conoscenze_valide:
                disponibili = ("conoscenze di Metodologie Operative disponibili:\n"
                               + "\n".join(f"  · {c}" for c in sorted(conoscenze_valide))
                               ) if conoscenze_valide else (
                    f"{competenza} nel periodo «{periodo}» non ha conoscenze di Metodologie Operative: "
                    "lascia l'elenco vuoto e aggancia solo l'abilità")
                errori.aggiungi(f"{dove} → {competenza}",
                                f"conoscenza non presente nel curricolo: «{conoscenza}»", disponibili)

        if not aggancio.get("abilita") and not aggancio.get("conoscenze"):
            errori.aggiungi(f"{dove} → {competenza}",
                            "aggancio vuoto: né abilità né conoscenze",
                            "indica almeno un'abilità o una conoscenza, altrimenti l'aggancio è decorativo")
    return competenze


def elabora(curricolo, livelli, blocchi, errori):
    indice = indicizza_curricolo(curricolo)
    moduli = []

    for blocco in blocchi:
        anno = blocco.get("anno")
        if anno not in ANNI:
            errori.aggiungi(f"blocco «{anno}»", f"anno non riconosciuto: {anno}",
                            "anni ammessi: " + ", ".join(ANNI))
            continue
        scheda = livelli["anni"][anno]
        periodo = scheda["periodo"]
        livello = scheda["livello"]

        if blocco.get("periodo") != periodo:
            errori.aggiungi(f"{anno}", f"periodo dichiarato «{blocco.get('periodo')}» diverso da «{periodo}»",
                            f"per {anno} il periodo del curricolo è «{periodo}»")

        for modulo in blocco.get("moduli", []):
            etichetta = f"{anno} · modulo {modulo.get('n')} «{modulo.get('titolo')}»"
            competenze = set()
            for attivita in modulo.get("contenuti", []):
                dove = f"{etichetta} → «{attivita.get('attivita', '?')[:70]}»"
                competenze |= controlla_agganci(attivita, periodo, indice, dove, errori)
            controlla_uda(modulo, etichetta, errori)
            controlla_prova(modulo.get("provaEsperta"), livello, etichetta, errori)

            modulo_uscita = dict(modulo)
            modulo_uscita["anno"] = anno
            # "periodo" della UDA e' il periodo didattico (es. "Ottobre - Novembre"):
            # non va confuso con il periodo del curricolo, che qui prende un nome distinto.
            modulo_uscita["periodoCurricolo"] = periodo
            modulo_uscita["livelloQNQ"] = livello
            modulo_uscita["competenze"] = sorted(competenze, key=lambda x: int(x[1:]))
            moduli.append(modulo_uscita)

    for modulo in moduli:
        if "alternativoA" in modulo:
            fratelli = {m["n"] for m in moduli if m["anno"] == modulo["anno"] and "alternativoA" not in m}
            if modulo["alternativoA"] not in fratelli:
                errori.aggiungi(f"{modulo['anno']} · modulo «{modulo['titolo']}»",
                                f"alternativoA punta al modulo {modulo['alternativoA']}, che non esiste in {modulo['anno']}",
                                "moduli disponibili: " + ", ".join(str(n) for n in sorted(fratelli)))
    return moduli


def costruisci(scrivi):
    errori = ErroriRaccolti()
    curricolo, livelli, impianto, blocchi = carica_sorgenti()
    controlla_qnq_verbatim(livelli, errori)
    moduli = elabora(curricolo, livelli, blocchi, errori)

    if errori:
        errori.stampa()
        print("Build interrotta: programmi.json non è stato modificato.\n", file=sys.stderr)
        sys.exit(1)

    documento = {
        "meta": {
            "fonteCurricolo": "D.M. 24 maggio 2018 n. 92, Allegato C",
            "fonteQNQ": "D.I. MLPS/MIUR 8 gennaio 2018, Allegato 1 (Tabella A)",
            "verificaNormativa": "2026-08-21",
            "aggiornato": date.today().isoformat(),
            "anni": ANNI,
            "avvertenza": "File generato da scripts/programmi.py: non modificarlo a mano.",
        },
        "livelliQNQ": {
            anno: {
                "livello": scheda["livello"],
                "periodo": scheda["periodo"],
                "sintesi": scheda["sintesi"],
                "ufficiale": (
                    {"transizione": True,
                     "livello3": livelli["descrittori"]["3"],
                     "livello4": livelli["descrittori"]["4"],
                     "citazioni": livelli["citazioniTransizione"]}
                    if scheda["livello"] == "3-4"
                    else dict(livelli["descrittori"][scheda["livello"]], transizione=False)
                ),
                "operativo": scheda["operativo"],
                "proveEsperte": scheda["proveEsperte"],
            }
            for anno, scheda in livelli["anni"].items()
        },
        "impiantoDidattico": impianto,
        "curricolo": curricolo,
        "moduli": moduli,
    }

    conoscenze = sum(len(t["conoscenze"]) for t in curricolo)
    compresenze = sum(1 for t in curricolo for c in t["conoscenze"] if c["compresenzaScienzeUmane"])
    print(f"  traguardi ................. {len(curricolo)}")
    print(f"  conoscenze Metodologie .... {conoscenze}")
    print(f"  in compresenza Sc. umane .. {compresenze}")
    print(f"  traguardi con conoscenze .. {sum(1 for t in curricolo if t['conoscenze'])}")
    print(f"  moduli .................... {len(moduli)}")
    print(f"  prove esperte ............. {sum(1 for m in moduli if m.get('provaEsperta'))}")
    for anno in ANNI:
        quanti = sum(1 for m in moduli if m["anno"] == anno)
        print(f"    {anno:14s} {quanti} moduli")

    # Il build deve essere idempotente: se cambia solo la data di esecuzione,
    # il file non va riscritto, altrimenti ogni build produrrebbe una modifica
    # e la verifica di allineamento su GitHub fallirebbe sempre.
    if USCITA.exists():
        try:
            precedente = json.loads(USCITA.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            precedente = None
        if precedente:
            confronto = json.loads(json.dumps(documento))
            confronto["meta"]["aggiornato"] = precedente.get("meta", {}).get("aggiornato")
            if confronto == precedente:
                documento["meta"]["aggiornato"] = precedente["meta"]["aggiornato"]

    if scrivi:
        nuovo = json.dumps(documento, ensure_ascii=False, indent=2) + "\n"
        if USCITA.exists() and USCITA.read_text(encoding="utf-8") == nuovo:
            print(f"\n  {USCITA.relative_to(RADICE)} è già allineato: nessuna modifica.")
        else:
            USCITA.write_text(nuovo, encoding="utf-8")
            print(f"\n  Scritto {USCITA.relative_to(RADICE)}")
    else:
        print("\n  Controlli superati (nessun file scritto).")
    return documento


def elenca():
    curricolo, livelli, _, blocchi = carica_sorgenti()
    errori = ErroriRaccolti()
    moduli = elabora(curricolo, livelli, blocchi, errori)
    for anno in ANNI:
        scheda = livelli["anni"][anno]
        periodo, livello = scheda["periodo"], scheda["livello"]
        del_anno = [m for m in moduli if m["anno"] == anno]
        attive = {t["competenza"] for t in curricolo if t["periodo"] == periodo}
        coperte = {c for m in del_anno for c in m["competenze"]}
        scoperte = sorted(attive - coperte, key=lambda x: int(x[1:]))
        print(f"\n{anno} — QNQ {livello} — {len(coperte)}/{len(attive)} competenze coperte")
        for modulo in sorted(del_anno, key=lambda m: (m["n"], "alternativoA" in m)):
            marchio = f" [alternativo al {modulo['alternativoA']}]" if "alternativoA" in modulo else ""
            print(f"   {modulo['n']}. {modulo['titolo']}{marchio}")
            print(f"      competenze: {', '.join(modulo['competenze']) or '—'}")
        if scoperte:
            print(f"   senza moduli: {', '.join(scoperte)}")
    if errori:
        errori.stampa()


def scheletro(anno):
    livelli = leggi_json(SORGENTI / "livelli-qnq.json")
    if anno not in livelli["anni"]:
        print(f"Anno non riconosciuto: {anno}\nAnni ammessi: " + ", ".join(ANNI), file=sys.stderr)
        sys.exit(1)
    scheda = livelli["anni"][anno]
    livello, prove = scheda["livello"], scheda["proveEsperte"]

    print(f"\n  {anno} — livello QNQ {livello}. La prova esperta deve rispettare:")
    print(f"    consegna .... {prove['consegna']}")
    print(f"    imprevisto .. {prove['imprevisto']}")
    print(f"    gruppo ...... {prove['ruoloGruppo']}")
    print(f"    valutazione . {prove['valutazione']}")
    print(f"\n  Incolla in programmi-src/moduli-{anno.lower().replace(' ', '-')}.json, dentro \"moduli\":\n")

    modello = {
        "n": 0,
        "titolo": "",
        "periodo": "",
        "monteOre": "",
        "sintesi": "",
        "prodottoFinale": "",
        "fasi": ["", "", ""],
        "contenuti": [
            {"attivita": "", "agganci": [{"competenza": "C1", "abilita": [""], "conoscenze": [""]}]},
            {"attivita": "", "aggancio": "trasversale", "nota": ""},
        ],
        "provaEsperta": {
            "titolo": "", "compito": "", "contesto": "", "prodotto": "",
            "durata": "", "modalita": "", "risorse": [""],
            "imprevisto": "" if livello == "2" else "descrivi qui l'imprevisto",
            "evidenze": [""],
        },
        "materiali": [],
    }
    print(json.dumps(modello, ensure_ascii=False, indent=2))
    print("\n  Abilità e conoscenze vanno copiate alla lettera da programmi-src/curricolo-ssas.json:")
    print("  il build rifiuta gli agganci che non corrispondono.\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="comando", required=True)
    sub.add_parser("build", help="ricostruisce programmi.json")
    sub.add_parser("check", help="controlla senza scrivere")
    sub.add_parser("list", help="elenca moduli e competenze scoperte")
    nuovo = sub.add_parser("nuovo-modulo", help="stampa lo scheletro di un modulo")
    nuovo.add_argument("--anno", required=True, help="uno fra: " + ", ".join(ANNI))
    argomenti = parser.parse_args()

    if argomenti.comando == "build":
        costruisci(scrivi=True)
    elif argomenti.comando == "check":
        costruisci(scrivi=False)
    elif argomenti.comando == "list":
        elenca()
    elif argomenti.comando == "nuovo-modulo":
        scheletro(argomenti.anno)


if __name__ == "__main__":
    main()
