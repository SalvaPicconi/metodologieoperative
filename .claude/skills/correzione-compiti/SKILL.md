---
name: correzione-compiti
description: Correggere i compiti svolti dagli alunni sulle pagine del sito Metodologie Operative (risposte salvate in Supabase, tabella progress) e renderli visibili nella pagina dell'attività. Usare ogni volta che il docente chiede di correggere, rivedere o pubblicare correzioni di compiti, esercitazioni o percorsi svolti dagli alunni.
---

# Correzione dei compiti degli alunni

Regole decise dal titolare il 23 novembre 2026. Valgono sempre, senza chiedere conferma.

## Chi corregge

- **La correzione la fa Claude e vale subito.** Si salva visibile (`pubblicata` = `bozza`), senza
  bozze da confermare. Il docente entra, verifica e, se vuole, modifica: altrimenti resta valida.
- Non si chiede il consenso per salvare o pubblicare le correzioni.

## Che cosa si corregge

- **Solo ciò che l'alunno ha fatto.** Una domanda senza risposta, un quiz non svolto, una tappa non
  aperta: non si commentano e non si segnalano nella nota. Restano aperti, l'alunno ci può ancora lavorare.
- Precisione al 100%: ogni commento si basa sul testo della pagina (consegna, scheda del caso,
  «risposte attese» del docente, chiave dei quiz). Prima di scrivere si rilegge la domanda e la
  risposta per intero. Niente formule generiche ripetute: ogni commento dice qualcosa di quella risposta.
- Si valutano le cose importanti per quell'esercizio (lo scopo della domanda), non i dettagli formali.
- Formato: «✔ ciò che è corretto» / «✎ ciò che manca o è sbagliato» / «Risposta attesa: …» quando serve.
  Domande di riflessione personale: una riga di riscontro. Stesso metro per tutti, nessun confronto
  fra alunni, nessun nome nei commenti.
- **Lessico disciplinare, sempre.** Ogni termine dei commenti, delle consegne e delle risposte attese è quello
  di Metodologie Operative, nel suo uso trasversale alle materie collegate (scienze umane, igiene, diritto e
  legislazione socio-sanitaria). Le fonti, da consultare insieme e non una sola:
  1. la pagina dell'attività e gli altri materiali del sito, dal biennio alla quinta;
  2. il curricolo normativo, `programmi-src/curricolo-ssas.json` (D.M. 92/2018, Allegato C): abilità e
     conoscenze alla lettera (es. «metodi e strumenti di osservazione e documentazione», «rilevazione dei
     bisogni», «pertinenza e attendibilità delle informazioni e dei dati», «scale dei livelli di autonomia»);
  3. le UDA dei programmi (`programmi-src/moduli-*.json`) e l'impianto didattico;
  4. il libro di testo in adozione (Lotteri, Corsi, *Metodologie Operative*) e i materiali del docente su
     Drive: indice `GRAPHIFY_PICCONI_SCUOLA_DIDATTICA.txt`, poi solo le fonti pertinenti;
  5. `glossario.html`, che va tenuto allineato: un termine nuovo o corretto si aggiunge lì.
  Se le fonti non concordano o un termine manca, non si inventa e non si usa la parola di uso comune:
  si sceglie quello del curricolo e dei materiali, e nel dubbio si chiede al titolare prima di correggere.
- Esempio fissato dal titolare: **fatto** (osservato o riferito, con la fonte, verificabile),
  **interpretazione** (la lettura di chi riferisce, con «mi sembra», «credo»: va verificata o motivata),
  **giudizio** (etichetta sulla persona, non si scrive), **ipotesi** (la formula l'operatore, cioè l'alunno,
  sui fatti, e la verifica). Non si scrive «supposizioni» né «impressioni».
- Domande chiuse: si conta la prima risposta data (campo `f` nei salvataggi `act_*`), con la spiegazione
  della pagina per ogni errore.

## Blocco delle risposte corrette

- **Una risposta già corretta non si può più modificare; una risposta non corretta sì.**
  `assets/correzione-in-pagina.js` (vista alunno) chiude ogni campo che ha un commento e una risposta;
  i campi vuoti restano scrivibili.

## Dove si vede la correzione

- Nella **pagina dell'attività stessa** (`assets/correzione-in-pagina.js`, regole in CLAUDE.md,
  «Correzione nella pagina dell'attività»). Il docente apre «Apri la correzione» dall'Area docente e trova
  la pagina dell'alunno con il commento modificabile sotto ogni risposta. L'alunno lo vede sotto le sue
  risposte, sia dall'area «I miei lavori» sia entrando con classe e codice (`progress_correzione`).
- Ogni correzione salvata è visibile subito: lo impone anche il database (trigger `sempre_visibili`).

## Valutazione

- Voto numerico e competenze raggiunte solo in un ultimo giro, quando il docente lo chiede, secondo
  le linee guida di valutazione del sito (`programmi-src/impianto-didattico.json`).

## Dati

- Risposte: `public.progress` (anno scolastico in `school_year`, es. 2026 = 2026/27).
- Correzioni: `private.verifiche_correzioni` (`progress_id`, `bozza`, `pubblicata`, `revisione`).
  Struttura: `{tipo:'compito', verifica, titolo, nota, commenti:[{campo, etichetta, commento}]}`;
  `campo` è l'id del campo della pagina, `act.<id>` per un'attività a scelta, `blocco.<nome>` per un gruppo.
- Configurazione per pagina: `assets/verifiche-correzione.json` (chiave, pagina, campi nascosti, etichette).
- File di lavoro con dati degli alunni solo nella scratchpad, mai nel repository.
