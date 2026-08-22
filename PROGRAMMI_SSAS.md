# Programmi SSAS — stato, struttura e manutenzione

Questo documento è il punto di ripartenza per lavorare sulla pagina **Programmi SSAS** senza dover ricostruire il contesto dalle conversazioni precedenti.

- Pagina pubblica: <https://salvapicconi.github.io/metodologieoperative/programmi.html>
- Repository: `SalvaPicconi/metodologieoperative`
- Pubblicazione: GitHub Pages dal ramo `main`, directory radice
- File generato mostrato dalla pagina: `programmi.json`
- Stato verificato: 22 agosto 2026
- Commit di riferimento per lo stato descritto: `baccc9e`

## Stato attuale

| Anno | Livello QNQ | UDA pubblicate | Nota |
| --- | ---: | ---: | --- |
| Primo | 2 | 9 | Programma riorganizzato e integrato con l'orientamento alle professioni |
| Secondo | 2 | 13 | Programmi delle due seconde unificati |
| Terzo | 3 | 8 | UDA 5 con due percorsi alternativi; 9 record nel JSON contando l'alternativa |
| Quarto | 3–4 | 8 | Base provvisoria, da integrare quando sarà disponibile il programma svolto completo |
| Quinto | 4 | 1 | Programma svolto ancora in attesa; è presente soltanto il percorso trasversale di orientamento |

Decisioni attive:

- Il collegamento e la pagina si chiamano **Programmi SSAS**.
- Al terzo anno l'UDA 5 presenta due alternative: **dipendenze e Ser.D** oppure **tutela del minore**. Nella programmazione se ne sceglie una.
- Il welfare state resta nel secondo anno. Al terzo anno l'UDA 2 è dedicata alle esercitazioni su casi concreti, dai bisogni ai servizi.
- La Pet Therapy non fa parte dei programmi.
- In tutti gli anni è presente **Orientamento alle professioni: incontri a scuola, visite guidate e laboratori**. Sono attività di osservazione, orientamento e simulazione scolastica, senza inserimento operativo in struttura.
- Al terzo anno il **tirocinio presso una struttura** è un'UDA distinta: presenza nel servizio, attività assegnate, obblighi, sicurezza e diario di bordo.
- Il Peer Tutoring non compare nei programmi annuali. Il progetto autonomo e i relativi materiali restano conservati nel repository.

## Architettura

```text
programmi-src/*.json e qnq-tabella-a.txt
                    │
                    ▼
          scripts/programmi.py
          check + build + controlli QNQ
                    │
                    ▼
              programmi.json
                    │
                    ▼
          programmi.js + programmi.html
                    │
                    ▼
              GitHub Pages
```

`programmi.json` è un artefatto generato: **non va modificato manualmente**.

### File principali

| File | Funzione |
| --- | --- |
| `programmi-src/curricolo-ssas.json` | Traguardi, abilità e conoscenze del curricolo SSAS |
| `programmi-src/livelli-qnq.json` | Livelli QNQ per anno e criteri operativi delle prove esperte |
| `programmi-src/qnq-tabella-a.txt` | Testo normativo usato per verificare i descrittori QNQ |
| `programmi-src/impianto-didattico.json` | Metodologie, strumenti, verifiche ed elementi trasversali |
| `programmi-src/moduli-<anno>.json` | UDA dei cinque anni |
| `programmi-src/modulo-tutela-minori.json` | Percorso alternativo all'UDA 5 del terzo anno |
| `scripts/programmi.py` | Validazione, costruzione ed elenco dei programmi |
| `programmi.json` | Output generato e caricato dal browser |
| `programmi.js` | Filtri e rendering della pagina |
| `programmi.html` | Struttura della pagina Programmi SSAS |
| `.github/workflows/programmi-build.yml` | Controllo automatico di sorgenti e allineamento del JSON |

## Regole per modificare le UDA

Ogni UDA deve contenere almeno:

- numero e titolo;
- periodo e monte ore;
- prodotto finale;
- almeno tre fasi;
- attività collegate al curricolo;
- prova esperta completa;
- materiali, anche come elenco vuoto.

Le abilità e le conoscenze negli `agganci` devono coincidere letteralmente con quelle presenti in `curricolo-ssas.json`. Lo script rifiuta formulazioni inventate o riferite a un periodo curricolare diverso.

La prova esperta deve rispettare il livello dell'anno:

- **QNQ 2 — primo e secondo:** compito guidato, format fornito, nessun imprevisto;
- **QNQ 3 — terzo:** scelta del metodo, ruoli assegnati e variabile che cambia durante la prova;
- **QNQ 3–4 — quarto:** adattamento, motivazione delle scelte e autocontrollo;
- **QNQ 4 — quinto:** coordinamento, integrazione del lavoro altrui, imprevisti e gestione del tempo.

Per un percorso alternativo usare `alternativoA` e, quando necessario, `suffisso`. L'alternativa non deve diventare una card isolata fuori dall'anno cui appartiene.

## Procedura ordinaria

### 1. Controllare lo stato

```bash
git status --short --branch
python3 scripts/programmi.py list
```

Preservare sempre modifiche e file non collegati al lavoro corrente.

### 2. Modificare le sorgenti

Intervenire nei file dentro `programmi-src/`. Non modificare direttamente `programmi.json`.

Per ottenere uno scheletro già tarato sul QNQ dell'anno:

```bash
python3 scripts/programmi.py nuovo-modulo --anno "Terzo anno"
```

### 3. Validare e rigenerare

```bash
python3 scripts/programmi.py check
python3 scripts/programmi.py build
node --check programmi.js
git diff --check
```

Il `build` scrive `programmi.json` soltanto dopo il superamento dei controlli.

### 4. Verificare la pagina in locale

```bash
python3 -m http.server 8420 --bind 127.0.0.1
```

Aprire <http://127.0.0.1:8420/programmi.html> e controllare almeno:

- vista mobile e desktop;
- conteggi e numerazione delle UDA;
- apertura delle card;
- filtri per anno e ricerca;
- vista per competenza;
- assenza di errori JavaScript;
- assenza di contenuti rimossi o duplicati.

Arrestare il server con `Ctrl+C`.

### 5. Preparare una pubblicazione selettiva

Mettere in stage soltanto le sorgenti modificate e `programmi.json`, quindi verificare:

```bash
git diff --cached --check
git diff --cached --name-status
```

Creare il commit e fare push solo dopo l'autorizzazione alla pubblicazione.

### 6. Verificare la pubblicazione

Dopo il push devono risultare riusciti:

1. workflow **Controllo programmi**;
2. workflow **pages build and deployment**;
3. risposta HTTP 200 della pagina pubblica;
4. corrispondenza tra il `programmi.json` del commit e quello servito da GitHub Pages;
5. controllo finale della pagina pubblica, preferibilmente anche in vista mobile.

Un push completato non basta a dichiarare la modifica live: il confine di completamento è la verifica pubblica.

## Ripristino

Se una modifica già pubblicata deve essere annullata, preferire un ripristino tracciabile:

```bash
git revert <commit-da-annullare>
python3 scripts/programmi.py check
python3 scripts/programmi.py build
```

Verificare il nuovo commit con la stessa procedura locale e pubblica. Evitare `git reset --hard` e riscritture distruttive della cronologia.

## Commit che spiegano lo stato corrente

| Commit | Decisione |
| --- | --- |
| `19d4337` | Prima proposta ancorata al curricolo SSAS |
| `2b54318` | Strutturazione dei moduli come UDA complete |
| `e3a0dd4` | Rinomina del collegamento in Programmi SSAS |
| `d5de0b0` | Integrazione dei due percorsi alternativi del terzo anno |
| `47914d1` | Sostituzione del welfare del terzo con casi concreti |
| `d907cfe` | Introduzione del percorso ricorrente sulle professioni |
| `2725ef7` | Distinzione fra orientamento e tirocinio in struttura |
| `baccc9e` | Rimozione del Peer Tutoring dai programmi annuali |

## Prima di riprendere il lavoro in un nuovo contesto

1. Leggere questo documento.
2. Eseguire `git status --short --branch`.
3. Eseguire `python3 scripts/programmi.py list`.
4. Aprire la pagina pubblica e verificare lo stato effettivo.
5. Considerare le sorgenti e Git come fonte di verità; non ricostruire decisioni mancanti per supposizione.
