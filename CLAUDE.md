# Sito Metodologie Operative — note di progetto

Sito statico pubblicato su GitHub Pages sotto `/metodologieoperative/`.
In locale si serve dalla root: `preview_start` con la configurazione `static-site`
di `.claude/launch.json` (porta 8420).

Due dataset indipendenti:

- **`materiali.json`** — i materiali didattici per anno, letti da `materiali.js`.
  Si modifica a mano, seguendo `GUIDA-RAPIDA.txt`.
- **`programmi.json`** — la proposta di programmazione, **generata**: vedi sotto.

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
