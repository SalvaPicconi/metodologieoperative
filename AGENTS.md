# Sito Metodologie Operative — note di progetto

Sito statico pubblicato su **Aruba**: https://www.metodologieoperativessas.it/ (Hosting Basic Linux).
GitHub Pages è disattivato dal 23 ottobre 2026 e non va riattivato. Le fonti restano scritte per il
vecchio prefisso `/metodologieoperative/`: l'esportazione per Aruba adatta indirizzi e PWA.
In locale si serve dalla root: `preview_start` con la configurazione `static-site`
di `.Codex/launch.json` (porta 8420).

Due dataset indipendenti:

- **`materiali.json`** — i materiali didattici per anno, letti da `materiali.js`.
  Si modifica a mano, seguendo `GUIDA-RAPIDA.txt`.
- **`programmi.json`** — la proposta di programmazione, **generata**: vedi sotto.

---

## Pubblicazione su Aruba

**Unire una PR in `main` non pubblica niente.** Il sito si aggiorna soltanto con il workflow
«Pubblica su Aruba» (`.github/workflows/aruba-deploy.yml`), che parte dai push sul ramo
`codex/aruba-metodologieoperativessas`. Il nome del ramo non lo riserva a Codex: chi ha il consenso
del titolare pubblica lì, Claude compreso. Su quel ramo stanno anche gli strumenti, assenti da `main`:
`ARUBA.md`, `scripts/package_aruba.py`, `scripts/deploy_aruba.py` e il workflow. Partendo da `main`,
le istruzioni complete si leggono con `git show origin/codex/aruba-metodologieoperativessas:ARUBA.md`.

Procedura per ogni revisione:

1. `git fetch origin`, poi un ramo proprio dalla **cima remota del ramo Aruba**: contiene revisioni e
   protezioni dei salvataggi già in produzione che `main` può non avere. Niente reset distruttivi,
   force-push o cancellazione di rami.
2. Solo la revisione approvata. Se il lavoro sta su `main`, si porta sul ramo Aruba soltanto quello,
   conservando tutta l'infrastruttura Aruba; non si sostituisce un ramo con l'altro.
3. Controlli: `python3 scripts/programmi.py check` e
   `python3 scripts/package_aruba.py --output <cartella-nuova>`; si confrontano gli hash di
   `release.json` con quelli della produzione: devono cambiare solo i file della revisione.
4. Pagine che salvano risposte: stessi `page-id`, percorso, nomi dei campi e funzioni di ripristino.
   Con dati simulati si provano accesso lento, salvataggio anticipato, riapertura e salvataggi vecchi.
5. Si pubblica solo la revisione concreta che il titolare ha approvato, nel momento che ha autorizzato,
   senza richiedere un consenso già dato. Si rifà `git fetch`, si controlla che la cima Aruba sia
   quella esaminata e sia antenata della revisione, poi un **push normale, non forzato**, sul ramo
   Aruba. Se il remoto è avanzato si integra e si ricontrolla, senza sovrascrivere.
6. Si verifica il run del workflow **per quello stesso commit** (REST:
   `GET /repos/SalvaPicconi/metodologieoperative/actions/workflows/aruba-deploy.yml/runs?head_sha=<sha>`;
   nel cloud `gh pr` e GraphQL possono essere bloccati, si usa `gh api` REST o gli strumenti GitHub
   della sessione). Poi HTTPS, hash dei file pubblici modificati contro `release.json` e prova nel
   browser. Un collaudo con la password docente si fa con il titolare, non si dichiara per deduzione.
7. La password FTP sta solo nel secret `ARUBA_FTP_PASSWORD` di GitHub Actions: non si chiede, non si
   legge, non si copia. Non si cambiano trigger, permessi o protezioni per far passare un rilascio.
8. Una riga in `REGISTRO.md` con commit e run del workflow.

Se qualcosa blocca, si indicano operazione, errore esatto (senza credenziali) e rimedio minimo.

---

## Registro dei lavori

Ogni sessione che cambia qualcosa nel sito lascia **una riga** in `REGISTRO.md`, in cima al mese
corrente: data, chi ha lavorato, che cosa è cambiato per chi usa il sito, commit. Brevissima: una o
due frasi, senza dettagli tecnici, che stanno già in git. La riga si scrive nello stesso commit del
lavoro, o subito dopo se serve l'hash; se in un giorno si fanno più cose distinte, una riga ciascuna.

---

## Gerarchia del sito

Tre livelli, in quest'ordine, sia in home sia nel menu:

1. **Le classi** — `biennio.html`, `terzo.html`, `quarto.html`, `quinto.html`, direttamente nella barra;
2. **Metodi e laboratori** (tendina) — lezioni partecipate, laboratorio, peer tutoring, compresenza,
   attività di orientamento, educazione civica, intelligenza artificiale, glossario;
3. **Docente** (tendina) — programmi SSAS, programmazione individuale, programmazione Carola,
   area docente. La pagina `anno-di-prova.html` resta nel sito ma fuori da menu e home (24 ottobre 2026).

La home mostra **solo le voci da aprire**, negli stessi tre livelli e nello stesso ordine del menu:
niente descrizioni lunghe, niente riquadri speciali. Una pagina nuova si aggiunge prima in `LIVELLI`.

Testata, menu e briciole **non si modificano a mano**: si cambia `LIVELLI` (e `ALIAS` per le
sottopagine, come `lab_infanzia.html`) in `scripts/nav.py` e si lancia `python3 scripts/nav.py`,
che riscrive in tutte le pagine la testata, il `<nav>`, le briciole «Home › livello › pagina» con la
voce precedente e la successiva, e il richiamo ad `assets/nav.js` (menu nei telefoni).

La veste grafica è **rosa e blu**: blu notte `#17385a`, il rosa del logo SSAS `#ec166c` per gli elementi
decorativi e `#d6105f` per testi e pulsanti (leggibile), fondo `#f5f6fa` e superfici bianche; DM Serif per
i titoli e DM Sans per il testo, serviti da `assets/collage-fonts/` (decisione del titolare, 24 ottobre 2026) —
ed è fissata nei token di `:root` e nella sezione «Veste editoriale» in fondo a `style.css`.

Ogni pagina anno segue lo stesso ordine: **materiali per argomento → verifiche → programma
dell'anno → fine anno → annotazioni** (queste ultime chiuse di default).

### Materiali: il campo `argomento`

In `materiali.json` ogni materiale di una sezione anno porta `argomento`, l'id di un nucleo
elencato sotto la chiave `argomenti` della stessa sezione, che ne fissa ordine, titolo e descrizione:

```json
"argomenti": { "terzo": [ { "id": "uda-3-3", "titolo": "UDA 3 · Le figure professionali e l'équipe multiprofessionale",
                            "descrizione": "...", "alias": ["equipe"] } ] }
```

Nelle pagine anno **ogni argomento è una UDA del programma** (decisione del titolare, 25 ottobre 2026):
id `uda-<anno>-<n>`, titolo e descrizione copiati da `programmi-src/` (numero, titolo, `sintesi`), stesso
ordine dei programmi; nel biennio prima le UDA di prima («UDA 2 di prima · …»), poi quelle di seconda.
Un materiale usato da più UDA sta nella prima che lo usa (`materiali-curricolo.json` dice quali).
Se una UDA cambia titolo o numero, si aggiorna anche qui. Fanno eccezione i blocchi che coprono l'anno
intero (`ripasso`) e i materiali di un altro anno da riprendere (`ripresa`), che stanno in fondo.
`alias` conserva i vecchi id come ancore (`#arg-welfare`), perché le pagine dei materiali vi rimandano.

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

---

## Programmi

La pagina `programmi.html` presenta i **contenuti da trattare anno per anno**: moduli in
sequenza, ciascuno con le sue attività, la prova esperta di laboratorio e i materiali.

L'impianto curricolare resta disponibile ma **non è in primo piano**, perché appesantisce
la lettura di chi cerca semplicemente che cosa fare:

- il livello QNQ dell'anno è un badge accanto al titolo dell'anno, che linka alla scheda;
- l'interruttore **Mostra competenze** (spento di default) aggiunge i codici di competenza
  su ogni attività, il riepilogo «Competenze di indirizzo intercettate» in fondo a ogni
  modulo e i contatori di copertura;
- la vista **Per competenza** (C1 → C10, con gli anni in progressione QNQ) è il secondo
  bottone del toggle;
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
| `programmi.json` | **no** — è generato, ogni modifica a mano viene sovrascritta |

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
  "materiali": [ { "titolo": "", "file": "materiali/..." } ]
}
```

Il campo `competenze` del modulo **non si scrive**: lo calcola il build come unione
delle competenze delle sue attività.

`anno` è quello che si vede in pagina (Primo … Quinto); `periodo` è la chiave di
aggancio al curricolo, che tratta il biennio come periodo unico. Primo e secondo anno
condividono quindi `periodo: "Biennio"` e livello QNQ 2.

### Le tre regole che il build fa rispettare

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

Finché il build non passa, `programmi.json` resta all'ultima versione valida:
il sito online non si rompe mai per un errore di contenuto.

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

- **[GPT 2026-09-20 20:10] Le pagine pubbliche sono materiali didattici, non resoconti del lavoro di progettazione.** Non devono contenere ragionamenti interni, motivazioni delle scelte editoriali, formule promozionali, metadiscorso rivolto al docente o frasi che facciano percepire la voce di un assistente. Il testo deve funzionare direttamente come manuale, spiegazione o esercitazione per gli studenti proiettata alla LIM. Si va subito ai contenuti; eventuali istruzioni operative devono essere concrete e necessarie. Meglio pochi nuclei sviluppati bene, con definizioni, esempi, evidenziazioni, domande precise e spazi di risposta, che una copertura ampia ma superficiale. Ogni acronimo va sciolto e spiegato al primo uso.
- La sigla **TSSAS non si usa**: si scrive «l'indirizzo sociosanitario» e «l'operatore sociosanitario».
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

### Riferimenti normativi della pagina

- D.Lgs. 61/2017; D.M. 24 maggio 2018 n. 92 (Regolamento, Linee guida, Allegato C).
- D.I. MLPS/MIUR 8 gennaio 2018 — QNQ, Allegato 1, Tabella A (G.U. 25 gennaio 2018).
- D.Lgs. 62/2017 — valutazione.
- Il modulo sulla tutela del minore porta i propri riferimenti in
  `riferimentiNormativi`, con la data dell'ultima verifica in `verificaNormativa`.
  La data di avvio del Tribunale per le persone, per i minorenni e per le famiglie
  è soggetta a proroghe: **va ricontrollata su fonte ufficiale** prima di ripubblicare.

### Separazione Carola — 14 ottobre 2026

Le UDA C non vanno nei sorgenti o negli artefatti pubblici. Il generatore le rifiuta. La fonte corrente dei 16 moduli e del piano storico è `private.programmi_cataloghi` in Supabase; `programmi-carola.html` li carica dal servizio autenticato. Le UDA P+C restano pubbliche. Per manutenzione e limiti consultare `PROGRAMMI_SSAS.md`.
