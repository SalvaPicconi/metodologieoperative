# Educazione civica — manutenzione

La sezione `educazione-civica.html` riusa il catalogo delle sezioni: legge le UDA con
`sezione: "educazione-civica"` da `programmi.json` e le raggruppa nei cinque anni.
Mostra soltanto annualità con UDA effettive. Non trasferisce automaticamente le attività
civiche già presenti in altre UDA e non duplica i moduli curriculari.

## Aggiungere un percorso

1. Confrontare le UDA pubbliche esistenti e i materiali; valutare un innesto prima di creare un modulo.
2. Scrivere il modulo nel corretto `programmi-src/moduli-*-anno.json`, con provenienza,
   prova esperta tarata sul livello dell’anno, focus e materiali. Impostare `sezione: "educazione-civica"`.
3. Il primo materiale HTML è l’ingresso del percorso per gli studenti; gli altri materiali
   restano accessibili dalla UDA e dai Programmi. Il catalogo usa `data-attivita="true"`.
4. Collegare la pagina anche all’annualità corretta di `materiali.json`, con un argomento reale.
5. Eseguire `python3 scripts/programmi.py build` e `check`. Non editare gli artefatti generati.
6. Per il menu modificare soltanto `scripts/nav.py` e rigenerare.

La sezione è registrata in `SEZIONI` di `scripts/programmi.py` e in `PAGINE_SEZIONE`
di `programmi.js`. I cataloghi preesistenti mantengono il loro comportamento.

## Dall’informazione alla partecipazione · terza, UDA 9

Fonte didattica: `UDA_COMPLETA.md` del pacchetto fornito il 16 ottobre 2026, confrontata con
la bozza storica, tutte le otto slide e lo schema PDF. La discussione introduttiva è dichiarata
già svolta dalla fonte; la ricerca dei gruppi e gli ampliamenti restano attività da svolgere.
Gli studenti scelgono notizie e casi; non si assegnano casi risolti. Il giudizio riguarda il
metodo di ricerca e la qualità dell’argomentazione, non l’orientamento politico.

La rubrica analitica è rinviata su richiesta del docente. Gli indicatori osservabili non
sono una rubrica definitiva. Nessun comando invia la lettera a istituzioni esterne.

- Linee guida nazionali verificate sul [documento MIM](https://www.mim.gov.it/documents/20182/0/Linee+guida+Educazione+civica.pdf/9ffd1e06-db57-1596-c742-216b3f42b995):
  secondo ciclo, competenze civiche 1 e 2, pp. 17–18; competenza 10, pp. 21–22.
  I raccordi della pagina sono parafrasi. Nel catalogo trasversale è stata aggiunta soltanto
  la formulazione verbatim della competenza 10, p. 21, necessaria al focus; le voci preesistenti restano intatte.
- [PTOF ufficiale 2025–2028](https://www.iismeuccimattei.edu.it/download/670/ptof/3805/ptof-25-28.pdf),
  aggiornamento 2025/26: lette le pp. 87–91 (pagine PDF 91–95), che documentano taglio sociale
  del percorso SA, metodi, prove e collegamento al curricolo digitale SSAS. L’allegato
  «CURRICOLO - EDUCAZIONE CIVICA - GENERALE 2526.pdf» è nominato a p. 89 ma non è incorporato
  nel PDF consultato: non è stato letto né presentato come verificato.
- [Curricolo digitale SSAS](https://salvapicconi.github.io/conoscenzessas2025/uda-civica.html):
  confrontati `data-uda-civica.json` e `data-uda-dipartimento.json` correnti. È presente il percorso
  di prima T1.1 / DIP1-CIVICA; manca un raccordo specifico già documentato per questa UDA di terza.
  Da completare con il consiglio di classe. Le quattro ore della UDA non sostituiscono l’intero monte annuale.
- I numeri delle competenze civiche non sono codici SSAS C1–C10: il modulo è dichiarato trasversale.

## Allegati e slide

PPTX e PDF sono copie binarie degli originali, nei rispettivi nomi. Le otto WebP derivano
dalla conversione locale del PowerPoint, conservato intatto. La proiezione funziona come
HTML statico, senza Office online, iframe di terzi o dipendenze aggiuntive.
Senza JavaScript le otto immagini restano visibili; con JavaScript si sfogliano anche da tastiera.

## Scheda e dati

La pagina usa `progress.js` / `progress-global.js` nella versione già adottata dal sito,
senza modificare funzioni, permessi o database. Tutti i 16 campi hanno identificativi stabili.
Le bozze locali sono separate fra ospite e identità; i campi sconosciuti e i metadati caricati
sono conservati. Se la lettura remota fallisce si può lavorare su una bozza locale, mentre
il salvataggio remoto resta sospeso per evitare sovrascritture di dati non caricati.

La vista LIM richiede l’accesso docente esistente, usa `progress_docente_classe`, mostra una
domanda alla volta e inserisce le risposte come testo, senza identità o numerazione persistente.
Non può rendere anonimi eventuali dati personali scritti dagli studenti dentro le risposte.

Prima di pubblicare: approvazione del risultato concreto, verifiche locali e controllo dello
stato corrente di `origin/main`; dopo il rilascio autorizzato, controllare deploy e contenuti serviti.
La preparazione locale e i test simulati non costituiscono collaudo di un accesso studente/docente reale.
