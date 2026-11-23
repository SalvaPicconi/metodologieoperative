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
- Domande chiuse: si conta la prima risposta data (campo `f` nei salvataggi `act_*`), con la spiegazione
  della pagina per ogni errore.

## Blocco delle risposte corrette

- **Una risposta già corretta non si può più modificare; una risposta non corretta sì.**
  Nella pagina dell'attività ogni campo che ha un commento visibile è bloccato e mostra la correzione
  sotto la risposta; i campi vuoti restano scrivibili.

## Dove si vede la correzione

- Nella **pagina dell'attività stessa**, non in una pagina di solo testo: sotto ogni risposta compare
  la correzione. Lo stesso vale per il docente, che apre il lavoro dell'alunno dall'Area docente e
  trova, sotto ogni risposta, la correzione modificabile.

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
