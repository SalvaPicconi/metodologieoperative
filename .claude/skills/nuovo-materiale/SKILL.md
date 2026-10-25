---
name: nuovo-materiale
description: Trasformare una fonte del docente (pagine di un libro, un testo, appunti, un PDF, una presentazione) in un pacchetto didattico per una UDA del sito Metodologie Operative, cioè spiegazione per la LIM, esercitazioni con salvataggio in tre livelli, attività di laboratorio con strumento Word e verifica. Usare ogni volta che il docente consegna materiale da trasformare in attività, anche se non nomina la skill.
---

# Dalla fonte al pacchetto della UDA

Modello deciso dal titolare il 25 ottobre 2026. Vale per ogni materiale nuovo da una fonte.
Le regole generali del sito (`CLAUDE.md`) restano valide: questa skill dice **che cosa** si produce e **in che ordine**.
Copia nell'ecosistema del docente, per gli agenti fuori dal repository (ChatGPT): Google Drive, `00_ECOSISTEMA_AI/20_DIDATTICA/nuovo-materiale-pacchetto-uda.md`. Se si cambia il modello, si aggiornano tutte e due le copie.

## Il pacchetto

Ogni fonte diventa un pacchetto agganciato a **una** UDA, in quattro pezzi, sempre in quest'ordine:

| # | Pezzo | Forma | File | `tipo` in `materiali.json` |
|---|---|---|---|---|
| 1 | **Spiegazione** | pagina per la LIM, stampabile, senza campi | `<slug>-spiegazione.html` | `teoria` |
| 2 | **Esercitazioni** | pagina con salvataggio, correzione dopo la consegna, **tre livelli** | `<slug>-esercizi.html`, `-esercizi-intermedia.html`, `-esercizi-semplificata.html` | `interattivo` (+ `livello`) |
| 3 | **Laboratorio** | pagina con consegna, ruoli, tempi e criteri + strumento professionale in Word | `<slug>-laboratorio.html`, `<slug>-strumento.docx` | `laboratorio` e `download` |
| 4 | **Verifica** | pagina con salvataggio e griglia in decimi | `verifica-<slug>.html` | `verifica` (+ `quadrimestre`) |

Cartella: `materiali/<biennio|terzo|quarto|quinto>/`. `<slug>` è breve, in minuscolo, con trattini.

## Procedura

### 1. Lettura della fonte
- Leggere **tutta** la fonte prima di proporre. Fare l'inventario dei concetti: definizioni, classificazioni, procedure, norme, esempi.
- **La fonte non entra nel sito né nel repository**: si riscrive con parole proprie. Da un libro si citano solo frasi brevi, tra virgolette e con l'indicazione della fonte. Le norme si verificano su fonte ufficiale, con la data della verifica.
- Segnalare ciò che nella fonte è superato (norme abrogate, termini non più usati, come «handicappato» o «TSSAS»).

### 2. Proposta e decisioni (con domande, niente muri di testo)
Con `AskUserQuestion`, non con un testo lungo:
1. **UDA**: proporre la UDA (anno + numero) con il motivo in una riga, più un'alternativa. Il docente sceglie. Se nessuna UDA è adatta, chiedere se crearne una (`python3 scripts/programmi.py nuovo-modulo`).
2. **Che cosa entra nella spiegazione** e che cosa resta fuori o va in approfondimento.
3. **Tipo di laboratorio** fra i quattro (vedi sotto) e **strumento professionale** da compilare.
4. **Quadrimestre** della verifica.

Solo dopo le risposte si scrive.

### 3. Scrittura, nell'ordine del pacchetto
Spiegazione → esercitazioni (prima la completa, poi intermedia e semplificata) → laboratorio e strumento Word → verifica.

### 4. Collegamenti
- `materiali.json`: ogni file nella sezione dell'anno, con `argomento` = `uda-<anno>-<n>` (la UDA scelta; se il blocco non esiste ancora in `argomenti`, si aggiunge copiando titolo e `sintesi` dalla UDA, nell'ordine dei programmi). Le verifiche non hanno argomento ma `quadrimestre`.
- `programmi-src/moduli-<anno>.json`: i file nel campo `materiali` della UDA, poi `python3 scripts/programmi.py build` (aggiorna `materiali-curricolo.json`, da cui nasce la riga «Nel programma» delle schede). Modifica testuale delle righe, non `json.dump`, per non riformattare il file.
- `glossario.html`: ogni termine nuovo nell'array `VOCI`, con l'anno in cui si incontra per la prima volta.
- `REGISTRO.md`: una riga.

### 5. Controlli
- `python3 scripts/programmi.py check`.
- Prova dei salvataggi su ogni pagina con campi: dati simulati, accesso lento, salvataggio anticipato, riapertura.
- Schermate al computer e al telefono (390 px): niente uscite dallo schermo, contrasto leggibile.
- `python3 scripts/package_aruba.py --output <cartella-nuova>`: cambiano solo i file del pacchetto e i collegamenti.

### 6. Consegna
Ramo proprio, PR in bozza, schermate al docente, domanda sulla pubblicazione. Si pubblica su Aruba **solo con il suo consenso**, con la procedura di `CLAUDE.md`. La **verifica** va online solo quando il docente lo dice: fino ad allora resta nella PR, fuori dal ramo Aruba.

## Come si scrive ogni pezzo

### Regole comuni
- Italiano scolastico da manuale: frasi brevi, una idea per frase, maiuscola solo a inizio frase e nei nomi propri (niente Title Case, niente maiuscolo gridato).
- Profilo: «l'operatore sociale». Mai «TSSAS»; «OSS» solo per la qualifica regionale. In pagina compare solo Metodologie Operative.
- Casi inventati, con nomi di fantasia. Mai nomi di studenti reali.
- Veste: `assets/materiale.css` e `assets/materiale.js`, colori del logo a rotazione (`data-tinta`: lime, rosa, verde, acqua; ogni pagina del pacchetto una tinta diversa), DM Serif per i titoli, DM Sans per il testo.
- In testa la barra con «← Materiali del <anno>» verso `<anno>.html#arg-uda-<anno>-<n>` e il link al pezzo successivo del pacchetto.

### 1 · Spiegazione per la LIM
Chiara, sintetica, esaustiva: si espone alla classe in una lezione.
- Testata, `indice` delle sezioni, poi 4-7 `sezione` numerate. **Una idea per sezione**, leggibile da lontano.
- Ogni concetto: `definizione` (che cos'è) → `esempio` dal mondo dei servizi → schema (`passi`, `confronto`, `linea-tempo`, `tabella`, oppure HTML/SVG disegnato).
- `attenzione` per gli errori tipici; `in-breve` in fondo a ogni sezione (3-4 punti).
- Ciò che allunga ma non serve alla lezione va in `details.approfondimento`, chiuso.
- Nessun campo da compilare. Stampabile come dispensa (`@media print` già in `materiale.css`).

### 2 · Esercitazioni (tre livelli)
Tre pagine con **gli stessi obiettivi e la stessa sequenza di esercizi**, che cambiano nel sostegno:

| | Completa | Intermedia | Semplificata |
|---|---|---|---|
| Testo | come la spiegazione | frasi più brevi, parole chiave in grassetto | lessico di base, una richiesta per volta, icone |
| Esercizi chiusi | scelta multipla, vero/falso motivato, classificazione | come la completa, con meno opzioni | abbinamento, completamento con parole date |
| Esercizi aperti | risposta argomentata, caso | risposta guidata da domande | frase da completare, scelta fra due risposte |
| Etichetta | — | `"livello": "intermedio"` | `"livello": "semplificato"` |

Sequenza tipo (5-8 esercizi): comprensione → riconoscimento in esempi → classificazione → applicazione a un caso → riflessione sul ruolo dell'operatore.

Salvataggio:
- `MO_PROGRESS_CONFIG` e `MO_IDENTITY_CONFIG` come in `materiali/quinto/caso-professionale.html` (onBeforeSave che conserva i dati già caricati e calcola `_meta`), `assets/progress.js` e `assets/progress-global.js` con lo stesso `?v=`.
- Ogni campo ha `id` e `name` uguali, con un prefisso proprio della pagina (es. `wf_`, `wfi_`, `wfs_`). **Una volta pubblicati, `id`, `name` e percorso non cambiano più.**

Correzione dopo la consegna:
- In fondo il pulsante «Consegna e vedi la correzione». Salva il campo nascosto `<prefisso>_consegnato` (data e ora), blocca i campi e mostra i blocchi `.correzione`.
- Chiusi: giusto/sbagliato con la spiegazione del perché. Aperti: la risposta attesa e i criteri per autocorreggersi.
- Alla riapertura (`mo:progress-restored`), se la consegna c'è, la correzione si mostra di nuovo.
- Prima della consegna le soluzioni non sono nella pagina visibile.

### 3 · Laboratorio tecnico-pratico
Non vuol dire cartelloni o manufatti: è **il lavoro dell'operatore**, simulato in classe. Quattro tipi:

| Tipo | Che cosa si fa | Strumento Word tipico |
|---|---|---|
| **Strumento professionale** | si compila un documento vero del servizio | scheda di accesso, PAI, diario di bordo, verbale d'équipe, relazione |
| **Simulazione** | role play con ruoli e osservatori | copione dei ruoli, griglia dell'osservatore |
| **Caso e problema** | analisi di un caso a gruppi, decisione motivata | scheda del caso, matrice delle ipotesi |
| **Osservazione e ricerca** | griglie, interviste, ricerca sul territorio | griglia di osservazione, traccia d'intervista |

La pagina del laboratorio contiene, in quest'ordine: obiettivo · scenario · ruoli · tempi (fasi con i minuti) · materiali · consegna · prodotto atteso · criteri di valutazione (rubrica a 4 livelli sulle evidenze) · imprevisto.
Taratura sul livello QNQ dell'anno, come le prove esperte (`CLAUDE.md`, regola 2): QNQ 2 senza imprevisto e con format fornito; QNQ 3 imprevisto e ruoli assegnati; QNQ 3-4 imprevisto e autocontrollo delle scelte; QNQ 4 imprevisto, coordinamento e integrazione del lavoro altrui.

Strumento Word: generato con `python-docx`, intestazione dell'istituto e della materia, tabelle con spazi da compilare, carattere leggibile; stessi colori del logo nei titoli.

### 4 · Verifica
- Tre parti: **A** domande chiuse (conoscenze); **B** risposte brevi (comprensione); **C** caso da analizzare (applicazione, sul modello del laboratorio).
- Punteggio dichiarato per ogni domanda, totale in decimi, griglia di valutazione in fondo.
- Sempre anche la **versione per obiettivi minimi** (`"livello": "semplificato"`), con le stesse parti ridotte e guidate.
- Salvataggio come le esercitazioni; nessuna correzione visibile allo studente.
- Nel codice della pagina **non va mai una password né la sua impronta**: la verifica si protegge pubblicandola solo il giorno della prova.

## Lista di controllo finale
- [ ] UDA scelta dal docente; blocco `uda-<anno>-<n>` presente in `argomenti` dell'anno.
- [ ] Quattro pezzi, tre livelli di esercitazione, verifica + obiettivi minimi.
- [ ] Nessun testo copiato dalla fonte oltre brevi citazioni; norme verificate con data.
- [ ] `materiali.json`, `programmi-src` (+ build), glossario, `REGISTRO.md`.
- [ ] Salvataggi provati, schermate computer e telefono, pacchetto Aruba confrontato.
- [ ] PR in bozza; pubblicazione solo con il consenso del docente; verifica solo il giorno della prova.
