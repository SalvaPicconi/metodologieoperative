# Sito Metodologie Operative — note di progetto

Sito statico pubblicato su GitHub Pages sotto `/metodologieoperative/`.
In locale si serve dalla root: `preview_start` con la configurazione `static-site`
di `.claude/launch.json` (porta 8420).

Due dataset indipendenti:

- **`materiali.json`** — i materiali didattici per anno, letti da `materiali.js`.
  Si modifica a mano, seguendo `GUIDA-RAPIDA.txt`.
- **`programmi.json`** — la proposta di programmazione, **generata**: vedi sotto.

---

## Gerarchia del sito

Tre livelli, in quest'ordine, sia in home sia nel menu:

1. **Le classi** — `biennio.html`, `terzo.html`, `quarto.html`, `quinto.html`;
2. **Metodi e laboratori** — lezioni partecipate, laboratorio, peer tutoring, compresenza,
   glossario, più `intelligenza-artificiale.html` (pagina propria, non più sezione della home);
3. **Docente** — programmi SSAS, area docente, anno di prova.

Il menu è unico e **non si modifica a mano**: si cambia `MENU` in `scripts/nav.py` e si lancia
`python3 scripts/nav.py`, che riscrive il `<nav>` di tutte le pagine.

Le parole della materia si definiscono in un posto solo, `glossario.html` (array `VOCI`): quando
una pagina usa un termine nuovo o ne cambia la spiegazione, si aggiorna anche il glossario, con
l'anno in cui il termine si incontra per la prima volta.

Ogni pagina anno segue lo stesso ordine: **materiali per argomento → verifiche → programma
dell'anno → fine anno → annotazioni** (queste ultime chiuse di default).

### Materiali: il campo `argomento`

In `materiali.json` ogni materiale di una sezione anno porta `argomento`, l'id di un nucleo
elencato sotto la chiave `argomenti` della stessa sezione, che ne fissa ordine, titolo e descrizione:

```json
"argomenti": { "terzo": [ { "id": "equipe", "titolo": "Équipe e figure professionali", "descrizione": "..." } ] }
```

Dentro un argomento le schede vanno teoria → dispensa → attività → compito di realtà.
Le verifiche (`"tipo": "verifica"`) non hanno argomento: stanno nel loro blocco, per quadrimestre.
**Ciò che è vuoto non compare**: né argomenti senza materiali, né categorie o quadrimestri vuoti.
Un materiale senza argomento finisce in «Altri materiali»: è il segnale che manca l'aggancio.
Niente segnaposto: un file di esempio non va in `materiali.json`.

Lo stesso schema vale per le sezioni **Laboratorio** e **Peer tutoring** (argomenti propri in
`materiali.json`). Una sottopagina del sito, come `lab_dipendenze.html`, si elenca con
`"tipo": "laboratorio"`: si apre nella stessa scheda, con il bottone «Entra». Le sottopagine dei
laboratori hanno il link «← Laboratorio» in testa. Diari e annotazioni stanno sempre in fondo, chiusi.

### Versioni differenziate e archivio

- `"livello": "semplificato"` marca la versione per il sostegno (etichetta verde), `"intermedio"`
  quella a difficoltà media. Si tengono sempre: compaiono subito dopo la versione completa.
- Un doppione **non si cancella**: la voce si sposta sotto la chiave `archivio` di `materiali.json`
  con `motivo` e `sostituitoDa`, e il file resta dov'è (conserva i salvataggi degli studenti).
  I file non HTML superati vanno nella cartella `archivio/`, spiegati in `archivio/LEGGIMI.md`.
- Criterio per scegliere fra due versioni piene sullo stesso argomento: resta la più strutturata
  (fasi, attività, verifiche intermedie); la teoria di riferimento resta se non è già dentro il percorso.

### Salvataggio delle risposte degli studenti

Le risposte stanno nella tabella `progress` di Supabase, che **non si legge né si scrive direttamente**
dal sito: gli studenti passano da `progress_carica` e `progress_salva` (in `assets/progress.js`),
che toccano solo la riga di quel codice su quella pagina; il docente legge tutto solo con una
sessione ottenuta dalla password (`assets/docente-accesso.js`, funzioni `progress_docente_*` e
`stroop_docente_*`). Una pagina nuova con campi da salvare include `assets/progress.js` e
`assets/progress-global.js` con lo stesso `?v=`; una pagina che mostra le risposte della classe
include `assets/docente-accesso.js` e chiama `MODocente.chiama(...)`. Nel codice delle pagine non va
mai una password né la sua impronta. Schema e ragioni in `supabase/progress-protezione.sql`.

---

## Programmi

La pagina `programmi.html` presenta i **contenuti da trattare anno per anno**: moduli in
sequenza, ciascuno con le sue attività, la prova esperta di laboratorio e i materiali.

L'impianto curricolare resta disponibile ma **non è in primo piano**, perché appesantisce
la lettura di chi cerca semplicemente che cosa fare:

- il livello QNQ dell'anno è un badge accanto al titolo dell'anno, che linka alla scheda;
- l'interruttore **Mostra competenze** (spento di default) aggiunge il **cappello monografico**
  in testa a ogni UDA, i codici di competenza su ogni attività, il riepilogo «Competenze di
  indirizzo intercettate» in fondo a ogni modulo e i contatori di copertura;
- la vista **Per competenza** (C1 → C10, con gli anni in progressione QNQ) è il secondo
  bottone del toggle; lì la UDA compare sotto ogni competenza che intercetta, quindi il cappello
  per esteso non si ripete: al suo posto un'etichetta dice se quella competenza è il cappello
  della UDA o se la UDA la sfiora soltanto;
- schede dei livelli QNQ e impianto didattico stanno in fondo, sotto *Approfondimenti*, collassati.

Quando modifichi la pagina, tieni questa gerarchia: **prima i contenuti, il curricolo a richiesta.**

### Che cosa si modifica e che cosa no

| File | Si modifica? |
|---|---|
| `programmi-src/moduli-*.json` | **sì** — è il contenuto didattico |
| `programmi-src/modulo-tutela-minori.json` | **sì** — modulo alternativo del terzo anno |
| `programmi-src/impianto-didattico.json` | sì — metodologia, strumenti, verifiche, valutazione |
| `programmi-src/livelli-qnq.json` | **no**, salvo verifica normativa: i blocchi `descrittori` sono testo verbatim del D.I. 8 gennaio 2018 |
| `programmi-src/qnq-tabella-a.txt` | **no** — è il riscontro di fedeltà contro cui il build confronta i descrittori |
| `programmi-src/curricolo-ssas.json` | **no** — curricolo normativo, D.M. 92/2018 Allegato C |
| `programmi-src/competenze-trasversali.json` | **no** — competenze chiave europee, area generale ed educazione civica, verbatim |
| `programmi.json` | **no** — è generato, ogni modifica a mano viene sovrascritta |
| `materiali-curricolo.json` | **no** — generato dal build: per ogni file, le UDA che lo usano con il loro cappello |

### Comandi

```bash
python3 scripts/programmi.py build          # ricostruisce programmi.json dopo i controlli
python3 scripts/programmi.py check          # controlla senza scrivere
python3 scripts/programmi.py list           # moduli per anno e competenze ancora scoperte
python3 scripts/programmi.py nuovo-modulo --anno "Terzo anno"
```

`nuovo-modulo` stampa lo scheletro già tarato sul livello QNQ dell'anno, con
`provaEsperta` e `materiali` predisposti: non si può aggiungere un modulo senza la sua prova.

### Modello dati

Ogni modulo vive in `programmi-src/moduli-<anno>.json` sotto la chiave `moduli`:

```json
{
  "n": 3,
  "titolo": "...",
  "sintesi": "...",
  "contenuti": [
    { "attivita": "...",
      "agganci": [ { "competenza": "C1", "abilita": ["..."], "conoscenze": ["..."] } ] },
    { "attivita": "...", "aggancio": "trasversale", "nota": "perché sta fuori dal curricolo" }
  ],
  "provaEsperta": { "titolo": "", "compito": "", "contesto": "", "prodotto": "",
                    "durata": "", "modalita": "", "risorse": [], "imprevisto": "", "evidenze": [] },
  "focus": { "competenza": "C1", "abilita": ["..."], "conoscenze": ["..."], "nota": "..." },
  "materiali": [ { "titolo": "", "file": "materiali/..." } ]
}
```

Il campo `materiali` collega la UDA ai materiali del sito (percorso dalla radice, come in
`materiali.json`); il build controlla che ogni file esista e ne ricava `materiali-curricolo.json`,
che `materiali.js` usa per mostrare sotto ogni scheda delle pagine anno la riga chiusa «Nel programma»
con competenza intermedia, abilità e conoscenze della UDA. Un materiale nuovo si collega qui,
non si scrive il curricolo in `materiali.json`.

Il campo `competenze` del modulo **non si scrive**: lo calcola il build come unione
delle competenze delle sue attività. Il `focus` invece si scrive, ma solo nelle sue voci
essenziali: vedi *Il cappello monografico* più sotto.

`anno` è quello che si vede in pagina (Primo … Quinto); `periodo` è la chiave di
aggancio al curricolo, che tratta il biennio come periodo unico. Primo e secondo anno
condividono quindi `periodo: "Biennio"` e livello QNQ 2.

### Le quattro regole che il build fa rispettare

1. **Aggancio letterale.** Ogni abilità e ogni conoscenza citata da un'attività deve
   esistere alla lettera nel curricolo per quella competenza *e* quel periodo. Il messaggio
   di errore elenca le voci disponibili: si copiano da lì, non si riscrivono a memoria.
   Se un'attività non ha un aggancio reale, si marca `"aggancio": "trasversale"` con una nota.
   Un aggancio finto vale meno di un aggancio assente.

2. **Prova coerente col livello QNQ.** La griglia di taratura è in `livelli-qnq.json`:
   - QNQ 2 (primo e secondo anno) — `imprevisto` **vuoto**, fra le `risorse` un format fornito;
   - QNQ 3 (terzo) — `imprevisto` compilato, `modalita` con ruoli assegnati;
   - QNQ 3-4 (quarto) — `imprevisto` compilato, fra le `evidenze` autocontrollo o giustificazione delle scelte;
   - QNQ 4 (quinto) — `imprevisto` compilato, `modalita` di coordinamento, fra le `evidenze` l'integrazione del lavoro altrui.

3. **Fedeltà normativa.** I descrittori QNQ devono coincidere carattere per carattere
   con `qnq-tabella-a.txt`.

4. **Cappello monografico.** Ogni UDA ha un `focus`: una competenza fra quelle che le sue attività
   agganciano davvero, al massimo due abilità e due conoscenze, verbatim, più la nota che motiva
   la scelta. Dove il curricolo non assegna conoscenze a Metodologie Operative il ripiego è
   obbligatorio; dove le assegna, è vietato. Vedi *Il cappello monografico* più sotto.

Finché il build non passa, `programmi.json` resta all'ultima versione valida:
il sito online non si rompe mai per un errore di contenuto.

### Il cappello monografico: il campo `focus`

Ogni UDA dichiara **su che cosa lavora davvero**, non tutto ciò che sfiora. È il campo `focus`,
obbligatorio su ogni modulo: **una** competenza, **fino a due** abilità e **fino a due** conoscenze,
tutte verbatim dal curricolo come gli agganci delle attività. In pagina compare in testa alla UDA,
sotto l'interruttore *Mostra competenze*; le altre competenze restano nel riepilogo in fondo.

```json
"focus": {
  "competenza": "C8",
  "abilita": ["...", "..."],
  "conoscenze": ["..."],
  "nota": "perché è questa la competenza dominante"
}
```

**Chi decide qual è la competenza dominante: la prova esperta.** È lì che la competenza diventa
osservabile, quindi si guardano il prodotto e le evidenze valutate, non il conteggio degli agganci.
Quando il conteggio e la prova divergono — succede, per esempio, in *Pregiudizio, autorità e
percezione*, cinque agganci su C3 e una prova che è una rilevazione dati — vince la prova e la `nota`
lo dice in chiaro. La `nota` è obbligatoria proprio per questo: fra un anno deve restare leggibile
perché quella competenza e non un'altra.

`competenzaTitolo`, `competenzaIntermedia` e `competenzaNum` **non si scrivono**: il build li pesca
dal curricolo con la coppia competenza + periodo, così non possono divergere.

### Quando il curricolo non arriva: il campo `ripiego`

Cinque coppie competenza/periodo **non hanno conoscenze assegnate a Metodologie Operative**:
C2, C3 e C6 nel biennio, C5 e C9 in quinta. Verificato incrociando `curricolo-ssas.json` con il
curricolo verticale d'istituto: le 73 conoscenze corrispondono una a una, i buchi sono reali.

Dove il cappello cade su una di quelle coppie, `conoscenze` resta vuoto e si compila `ripiego`,
nell'ordine: **competenza chiave europea** (sempre), poi **area generale** con l'asse culturale e
le sue abilità e conoscenze, poi **educazione civica** solo dove la UDA è davvero di cittadinanza.
Le fonti stanno in `programmi-src/competenze-trasversali.json` e anche lì vale la regola letterale.

```json
"focus": {
  "competenza": "C2",
  "abilita": ["..."],
  "conoscenze": [],
  "nota": "...",
  "ripiego": {
    "europea": "Competenza personale, sociale e capacità di imparare a imparare",
    "generale": { "competenza": 2, "asse": "Asse dei linguaggi",
                  "abilita": ["..."], "conoscenze": ["..."] },
    "civica": { "nucleo": "Costituzione", "competenza": "3" }
  }
}
```

Il build fa rispettare la simmetria: **ripiego dove e solo dove la conoscenza manca davvero.**
Se la competenza scelta ha conoscenze di Metodologie Operative, il cappello ne deve citare almeno
una e il ripiego è rifiutato; se non ne ha, le conoscenze devono restare vuote e il ripiego è
obbligatorio. Così il ripiego non diventa una scorciatoia per evitare il curricolo.

Una UDA che sta **tutta** fuori dal curricolo di indirizzo — nel catalogo attuale solo *Avvio
dell'anno e metodo di lavoro* in seconda — lo dichiara con `"trasversale": true`, senza competenza,
con nota e ripiego. Meglio dichiararlo che attribuire una competenza che la UDA non esercita.

### Programmazione a due mani: il campo `origine`

Il curricolo è costruito insieme a un collega. Ogni UDA dichiara da quale programma nasce:

| Valore | Significato |
|---|---|
| `"P"` | UDA che nasce dal programma del docente titolare |
| `"C"` | UDA che nasce dal programma del collega |
| `"P+C"` | UDA del docente in cui sono stati innestati contenuti del collega |

Il campo è **obbligatorio** su ogni UDA: il build si ferma se manca o se il valore non è
uno dei tre. In pagina diventa un badge accanto al numero della UDA, spiegato dalla legenda
in testa.

Quando arriva un programma nuovo da integrare, **prima si fa il confronto**: si inventariano
i punti elenco della fonte, si decide per ciascuno se è un doppione da scartare, un frammento
da innestare in una UDA esistente, o materia per una UDA nuova. Solo dopo si scrive.
La mappa di quel confronto resta in `programmi-src/_integrazione/piano.json`.

### Vincoli editoriali

- La sigla **TSSAS non si usa**: si scrive «l'indirizzo sociosanitario». Il profilo in uscita è
  «l'operatore sociale», forma breve di «operatore dei servizi per la sanità e l'assistenza sociale».
  «Operatore socio-sanitario» (OSS) indica solo la qualifica regionale, che è un'altra figura:
  scriverlo per il profilo dei nostri studenti crea confusione (decisione del 25 settembre 2026).
- In pagina compare **solo Metodologie Operative**. Le conoscenze condivise con
  Scienze umane portano il flag `compresenzaScienzeUmane` e l'etichetta «in compresenza».
  Nessun altro insegnamento va nominato.
- **Nessun nome di studente** nei file sorgente: i programmi svolti di partenza ne contengono,
  vanno rimossi in fase di riscrittura.
- Niente riferimenti a dispense nel testo dei moduli: i materiali stanno nel campo `materiali`.

### Trasformare un programma svolto in proposta di programmazione

È il flusso di lavoro tipico. Il docente consegna il programma svolto di un anno
(docx, pdf del registro, elenco incollato):

1. raggruppa le voci in moduli per nucleo tematico, **conservando il contenuto**
   dell'originale: si normalizza la forma, non si inventano attività mai svolte;
2. aggancia ogni attività a competenza, abilità e conoscenze puntuali di quel periodo;
3. scrivi la prova esperta di laboratorio, tarata sul livello QNQ dell'anno;
4. lancia `build`, poi apri la pagina con `preview_start` e controlla;
5. commit.

Le voci organizzative dell'originale — «preparazione e correzione delle verifiche»,
«ripasso degli argomenti precedenti» — non diventano moduli: rientrano come attività
dentro il modulo a cui si riferiscono.

### Frasi tipiche del docente

- «aggiungi al terzo anno un modulo sul lavoro di comunità, con la sua prova di laboratorio»
- «nel modulo tutela minori cambia l'imprevisto: invece del consenso ritirato, il minore rifiuta di parlare»
- «il modulo 6 del quarto anno toglilo»
- «quali competenze del quinto anno sono ancora senza moduli?» → `list`
- «la prova del modulo 4 del primo anno è troppo difficile per il livello 2, riportala in riga»
- «collega al modulo 3 il materiale sul sociogramma» → campo `materiali`
- «il modulo 5 di seconda non lavora sulla rilevazione dati, lavora sul pregiudizio» → campo `focus`
- «su che cosa lavora ogni UDA di quarta?» → `list`, che stampa il cappello accanto alle competenze

### Riferimenti normativi della pagina

- D.Lgs. 61/2017; D.M. 24 maggio 2018 n. 92 (Regolamento, Linee guida, Allegato C).
- D.I. MLPS/MIUR 8 gennaio 2018 — QNQ, Allegato 1, Tabella A (G.U. 25 gennaio 2018).
- Raccomandazione del Consiglio UE 22 maggio 2018 (2018/C 189/01) — competenze chiave europee,
  usate nel ripiego del cappello.
- D.M. 92/2018 Allegato A e Linee guida D.M. 766/2019 Allegato B — area generale, idem.
- L. 92/2019 e D.M. 183/2024 — educazione civica, idem.
- D.Lgs. 62/2017 — valutazione.
- Il modulo sulla tutela del minore porta i propri riferimenti in
  `riferimentiNormativi`, con la data dell'ultima verifica in `verificaNormativa`.
  La data di avvio del Tribunale per le persone, per i minorenni e per le famiglie
  è soggetta a proroghe: **va ricontrollata su fonte ufficiale** prima di ripubblicare.
