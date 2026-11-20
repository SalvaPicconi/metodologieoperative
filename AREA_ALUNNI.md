# Area «I miei lavori» · consegna del 20 novembre 2026

Ramo di lavoro `claude/area-alunni`, partito dalla punta remota di `codex/aruba-metodologieoperativessas`
(`8dbb2bd`, lo stesso commit del rilascio Aruba verificato). Nessun commit, nessuna pubblicazione, nessuna
modifica al progetto Supabase remoto: questo documento descrive ciò che è pronto e ciò che va autorizzato.

## A che punto è

| Livello | Stato |
| --- | --- |
| Codice delle pagine e migrazione SQL | Pronti nel ramo, non committati. |
| Database di collaudo locale (PGlite, dati inventati) | 94 prove su 94 superate: `supabase/test/ESITO-COLLAUDO-DB.md`. |
| Anteprima nel browser con backend locale | Provati ingresso, archivio, riapertura, sola lettura, conflitto fra schede, sessione scaduta, uscita, telefono e pannello docente (sezione «Prove nel browser»). |
| Progetto Supabase remoto | Solo letto. La migrazione **non** è applicata. |
| Sito pubblicato su Aruba | Invariato. |
| Prova con utenti reali | Non fatta. |

## Che cosa vede e fa l’alunno

1. In home, sotto il titolo, c’è il pulsante **I miei lavori** (`area_alunni.html`). Si entra con il **codice
   personale** dato dal docente: 16 caratteri in quattro gruppi (`XXXX-XXXX-XXXX-XXXX`), che si possono incollare.
   Minuscole, spazi e trattini non contano; le lettere O, I e L valgono come 0, 1 e 1. Non servono email né account
   Microsoft o Google, e non si vede nessun elenco di classi o alunni.
2. Un codice errato, revocato o sostituito riceve sempre la stessa risposta («Codice non riconosciuto»).
3. In alto compare **Riprendi l’ultimo lavoro**, con il titolo dell’attività e la data dell’ultimo salvataggio.
   Lo stato è la percentuale, quando la pagina la registra, oppure «Lavoro salvato». Sotto c’è una riga con le parole
   del curricolo e una domanda per ricordare, senza nulla da scrivere.
4. Sotto c’è l’archivio per anno scolastico: quest’anno aperto, gli anni precedenti in un riquadro chiuso.
   I lavori di quest’anno hanno **Riprendi**. Quelli degli anni passati hanno **Rileggi** e si aprono in sola lettura.
   Se l’attività si rifà nel nuovo anno, nasce un lavoro nuovo.
5. Aprendo un’attività abilitata, i campi sono già compilati e l’alunno continua senza reinserire classe e codice.
   Sulla pagina compaiono «I miei lavori · nome · classe» e il pulsante **Esci**.
6. «Salvato» compare solo dopo la conferma del server. Se il lavoro è stato salvato da un’altra scheda, se la rete
   cade o se la sessione scade, un avviso lo dice. Le risposte restano in una bozza della scheda e si recuperano solo
   su richiesta, solo dallo stesso alunno, e vengono cancellate quando un salvataggio riesce.
7. **Esci** chiude la sessione sul server, svuota i campi e toglie l’attività dalla cronologia. Tornando indietro
   non ricompare nulla (provato).

## Che cosa vede e fa il docente

Nell’Area docente, dentro una classe, c’è la nuova vista **Accessi alunni**, accanto a «Attività», «Alunni»,
«Verifica codici» e «Test Stroop». Le viste esistenti restano invariate e mostrano anche i lavori protetti, una
volta sola. Nella nuova vista il docente:

- vede lo stato dell’ingresso, che vale per tutto il sito, e può sospenderlo;
- **aggiunge alunni** con anteprima. Per ciascuno scrive una riga «Nome da mostrare; CODICE usato nelle attività».
  Può anche portare un alunno dall’anno precedente, per esempio dalla terza alla quarta, mantenendo il suo storico;
- **crea, sostituisce o revoca** il codice personale. Il codice compare una sola volta, in grande, e il database ne
  conserva solo l’impronta. Sostituire o revocare chiude subito le sessioni aperte e lascia intatti i lavori;
- **attribuisce i lavori già salvati**. Ogni riga è classificata come «Certo» (stesso codice, stessa classe,
  nessuna alternativa nei dati), «Da verificare» (stesso codice ma un’altra classe, oppure codice presente in più
  classi), «Codice simile» (una lettera diversa) o «Più alunni possibili». Nessun lavoro passa a un alunno senza
  conferma; il pulsante «Conferma tutti i certi» chiede comunque il consenso esplicito;
- **annulla un collegamento**: l’alunno perde subito l’accesso, la riga resta protetta e torna fra quelle da
  attribuire. Se l’alunno l’aveva modificata dopo il collegamento, il pannello lo segnala;
- consulta il **registro delle operazioni**: creazioni, codici, collegamenti, annullamenti, attivazioni.

## Modello dati e permessi (`supabase/area-alunni.sql`)

- Tabelle private (schema `private`, RLS attiva, nessun permesso ai ruoli dell’API):
  - `alunni_profili` (pseudonimo);
  - `alunni_classi` (anno scolastico, anno di corso, sezione: una 3SB del 2026/27 e una 3SB del 2027/28 sono
    gruppi distinti);
  - `alunni_iscrizioni` (alunno, classe dell’anno, codice delle attività, unico fra gli alunni attivi dell’anno);
  - `alunni_credenziali` (impronta SHA-256 del codice; 80 bit casuali generati nel database);
  - `alunni_sessioni` (impronta del token, scadenza di 8 ore, revoca);
  - `alunni_tentativi` (impronta troncata dell’indirizzo di rete, conservata un giorno);
  - `alunni_collegamenti`, `alunni_registro`, `alunni_pagine`, `alunni_config`.
- **Scelta: si estende `public.progress`** con `profilo_id` (proprietario confermato) e `protetto` (riga chiusa al
  vecchio accesso). Le viste docente esistenti leggono già quella tabella, quindi ogni lavoro compare una sola
  volta senza riscriverle. Un indice impedisce due lavori dello stesso alunno sulla stessa attività nello stesso anno.
  Un vincolo impedisce un proprietario su una riga non protetta, e una riga ha al massimo un collegamento attivo.
- Funzioni per l’alunno: `alunni_accesso`, `alunni_esci`, `alunni_profilo`, `alunni_lavori`, `alunni_lavoro_apri`,
  `alunni_lavoro_salva`. Anno e iscrizione li ricava il server dalla data in ora italiana. Il salvataggio richiede la
  versione caricata: con una versione vecchia risponde «conflitto» e non sovrascrive.
- Funzioni per il docente: `alunni_docente_*`, tutte con la sessione docente esistente, verificata a ogni chiamata.
- Tutte le funzioni sono `SECURITY DEFINER` con `search_path` vuoto e nomi di schema espliciti. L’EXECUTE va solo
  alle funzioni pubbliche. La chiave pubblica del sito non dà accesso a nessun dato senza sessione.
- **Confine con il vecchio accesso.** `progress_carica` e `progress_salva` tengono le stesse firme e le stesse
  risposte, ma non leggono e non scrivono una posizione (anno, codice, pagina, compresi i percorsi con il vecchio
  prefisso) che sia protetta o che appartenga a un codice con accesso personale su una pagina abilitata. Il controllo
  avviene nella stessa transazione, con un blocco sul codice. Vale anche per le pagine vecchie rimaste in cache, e
  resta in vigore anche se l’ingresso viene sospeso.
- Sessione nel browser: `sessionStorage`, cioè una sola scheda. Il codice resta valido anche dopo il passaggio a
  un’altra pagina del sito nella stessa scheda, e chiudendo la scheda la sessione sparisce, cosa utile sui PC
  condivisi. Il compromesso: un’attività aperta in una nuova scheda chiede di rientrare. Niente cookie, perché il
  sito (Aruba) e l’API (Supabase) stanno su domini diversi. Il token non passa mai nell’indirizzo della pagina.
- Anteprima locale: le pagine accettano un backend diverso **solo su localhost** (chiave `mo:api-locale`).
  In produzione l’indirizzo resta quello del progetto Supabase del sito.

## Censimento delle pagine del catalogo

Generato con `python3 scripts/censimento_area_alunni.py`, che legge il codice delle pagine e non i dati.
«Compatibile» indica un’analisi del codice: queste pagine vanno provate una per una prima di abilitarle.
Le verifiche sommative risultano compatibili per il codice, ma abilitarle è una scelta didattica.
Fra i salvataggi storici ci sono anche percorsi interni (per esempio `/attivita-index-01`): si possono attribuire
come storico, ma l’area non ha una pagina da riaprire e mostra «Lo consulta il docente».

| Copertura | Sezione | Titolo | File | Nota |
| --- | --- | --- | --- | --- |
| integrata | biennio | L'operatore sociale · percorso a tappe per la lezione partecipata | `materiali/biennio/tssas_percorso_completo_v2.html` | pilota: riapertura protetta collaudata in anteprima |
| integrata | biennio | Il welfare: dalle basi all'azione (percorso in 4 fasi) | `materiali/biennio/welfare-4-fasi-COMPLETO.html` | pilota: riapertura protetta collaudata in anteprima |
| integrata | laboratorio | Il collage autobiografico · Autoapprendimento | `materiali/laboratorio/collage_autobiografico.html` | pilota: riapertura protetta collaudata in anteprima |
| integrata | terzo | I servizi sociosanitari · percorso di autoapprendimento | `materiali/terzo/percorsi_autoapprendimento.html` | pilota: riapertura protetta collaudata in anteprima |
| integrata | terzo | Ripasso di Metodologie Operative | `materiali/terzo/ripasso-terzo-anno.html` | pilota: riapertura protetta collaudata in anteprima |
| compatibile | ai | L'intelligenza artificiale · percorso in sei fasi | `materiali/ai/definitivo percorso_ia_completo_6fasi.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | ai | L'intelligenza artificiale · versione semplificata | `materiali/ai/intelligenza_artificiale_semplificata.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | ai | Verifica sull'intelligenza artificiale | `materiali/ai/verifica_ia_modificata.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | archivio | Intelligenza artificiale - Teoria | `materiali/ai/intelligenza_artificiale_didattica.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | archivio | Disabilità: iter legislativo e classificazioni | `materiali/quarto/disabilita_iter_legislativo_completo.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | archivio | La fase preliminare del progetto d'intervento | `materiali/quarto/progetto_intervento_completo.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | archivio | Equipe multiprofessionale: strumenti e ruoli | `materiali/terzo/equipe_multiprofessionale_completo.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | biennio | Bisogni umani e relazione d’aiuto · lezione partecipata | `materiali/biennio/bisogni-relazione-aiuto.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | biennio | Il gruppo e l'auto mutuo aiuto | `materiali/biennio/gruppi_lavoro_sociale_autoapprendimento.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | biennio | L'animazione ludica e sociale · esercizio pratico | `materiali/biennio/percorso_animativo_interattivo.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | biennio | Verifica sommativa digitale · primo quadrimestre | `materiali/biennio/verifica_sommativa_q1.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | biennio | Il welfare · teoria | `materiali/biennio/welfare-materiale-teorico.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | biennio | Il welfare · versione semplificata | `materiali/biennio/welfare-semplificato-inclusivo.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | laboratorio | Animazione ludico-ricreativa | `lab_animazione.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | laboratorio | Dalla teoria alla pratica per l'infanzia | `lab_infanzia.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | laboratorio | I laboratori manipolativi · percorso interattivo | `materiali/laboratorio/laboratori-manipolativi.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | peer_tutoring | L'operatore sociale tra pari | `materiali/peer_tutoring/incontro3_percorso_interattivo.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | peer_tutoring | Peer tutoring · hub operativo | `materiali/peer_tutoring/peer_tutoring_platform.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | quarto | Fascicolo tecnico-pratico: le disabilità · quarto anno | `materiali/laboratorio/fascicolo_disabilita_4sa.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | quarto | Le disabilità: parole, modelli e leggi | `materiali/quarto/disabilita_dalle_leggi_al_progetto.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | quarto | Verifica sommativa digitale · primo quadrimestre | `materiali/quarto/verifica_sommativa_q1.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | quinto | Il caso professionale | `materiali/quinto/caso-professionale.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | quinto | La relazione professionale e la seconda prova | `materiali/quinto/relazione-seconda-prova.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | terzo | Un primo colloquio al SerD | `lab_dipendenze.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | terzo | Dall’informazione alla partecipazione | `materiali/educazione-civica/dall-informazione-alla-partecipazione.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | terzo | L'équipe multiprofessionale e le figure professionali | `materiali/terzo/equipe_multiprofessionale.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | terzo | Dai bisogni ai servizi · casi guidati | `materiali/terzo/esercitazioni_servizi.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | terzo | Dai bisogni ai servizi · versione intermedia | `materiali/terzo/inc_esercitazione_media.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | terzo | Dai bisogni ai servizi · versione semplificata | `materiali/terzo/inc_esercitazione_semplificata.html` | flusso comune con percorso reale: si abilita senza modifiche |
| compatibile | terzo | Verifica sommativa digitale · primo quadrimestre | `materiali/terzo/verifica_sommativa_q1.html` | flusso comune con percorso reale: si abilita senza modifiche |
| storico consultabile | archivio | Il Welfare: dai Bisogni alle Risposte | `welfare-activity.html` | salva con l'identificativo interno «attivita-welfare-activity-01»: serve un alias verificato per riaprirla dall'area |
| storico consultabile | terzo | Modulo: fase preliminare del progetto d'intervento | `materiali/terzo/modulo-progetto-intervento.html` | salva con l'identificativo interno «attivita-terzo-modulo-progetto-intervento-01»: serve un alias verificato per riaprirla dall'area |
| flusso separato | biennio | L’operatore sociale · Verifica di terza · Versione A | `materiali/biennio/verifica-operatore-terza.html` | verifica con accesso, invio e restituzione propri |
| flusso separato | compresenza | Test di Stroop · laboratorio di valutazione cognitiva | `materiali/compresenza/test-stroop.html` | risultati Stroop in tabelle proprie |
| flusso separato | peer_tutoring | Peer tutoring fra classi 2026-2027 · la prima e i tutor | `materiali/peer_tutoring/peer_tutoring_2026_2027.html` | chiama direttamente progress_salva/progress_carica |
| solo sul dispositivo | quarto | Riconfigurare la disabilità · Autoapprendimento | `materiali/quarto/riconfigurare-la-disabilita/autoapprendimento.html` | le risposte restano nel browser in cui sono state scritte |
| nessun salvataggio | archivio | Storie sui pregiudizi · versione LIM (seconda bozza) | `materiali/compresenza/pregiudizio/griglie-pregiudizi-lim-2.html` | pagina di sola lettura o presentazione |
| nessun salvataggio | archivio | Storie sui pregiudizi · versione LIM (prima bozza) | `materiali/compresenza/pregiudizio/griglie-pregiudizi-lim.html` | pagina di sola lettura o presentazione |
| nessun salvataggio | biennio | L'animazione ludica e sociale · teoria | `materiali/biennio/percorso_animativo_teoria.html` | pagina di sola lettura o presentazione |
| nessun salvataggio | biennio | La progettazione individualizzata · teoria | `materiali/biennio/progettazione_individualizzata_teoria.html` | pagina di sola lettura o presentazione |
| nessun salvataggio | biennio | L'operatore sociale · ripasso di teoria | `materiali/biennio/tssas_teoria_ripasso.html` | pagina di sola lettura o presentazione |
| nessun salvataggio | compresenza | Storie e griglie sui pregiudizi · versione per la LIM | `materiali/compresenza/pregiudizio/storie-griglie-pregiudizi.html` | pagina di sola lettura o presentazione |
| nessun salvataggio | laboratorio | Il collage autobiografico · Teoria | `materiali/laboratorio/collage_autobiografico_teoria.html` | pagina di sola lettura o presentazione |
| nessun salvataggio | laboratorio | Laboratorio di scrittura autobiografica | `materiali/laboratorio/laboratorio_autobiografico.html` | flusso comune disattivato nella pagina |
| nessun salvataggio | peer_tutoring | Giochi di peer tutoring | `materiali/peer_tutoring/peer_tutoring_games.html` | pagina di sola lettura o presentazione |
| nessun salvataggio | quarto | Guida alla verifica sommativa · primo quadrimestre | `materiali/quarto/guida_verifica_sommativa_q1.html` | pagina di sola lettura o presentazione |
| nessun salvataggio | quarto | Riconfigurare la disabilità · Teoria | `materiali/quarto/riconfigurare-la-disabilita/riconfigurare-la-disabilita.html` | pagina di sola lettura o presentazione |
| nessun salvataggio | quinto | Anzianità, società e welfare | `materiali/quinto/anzianita-societa-welfare.html` | pagina di sola lettura o presentazione |
| nessun salvataggio | terzo | Guida alla verifica sommativa · terzo anno | `materiali/terzo/guida_verifica_sommativa_terzo.html` | pagina di sola lettura o presentazione |
| nessun salvataggio | terzo | Servizi e interventi per la comunità · teoria | `materiali/terzo/percorsi_autoapprendimento_teoria.html` | pagina di sola lettura o presentazione |

Riepilogo: integrata 5, compatibile 30, storico consultabile 2, flusso separato 3, solo sul dispositivo 1, nessun salvataggio 14

## Prove nel browser (anteprima locale, dati inventati)

Ambiente: `node supabase/test/server-locale.mjs`, che serve il sito e risponde come Supabase con la migrazione
vera su PGlite, poi `http://localhost:8421/__api-locale`. Browser integrato (Chromium), vista desktop e telefono
375 px.

| Prova | Esito |
| --- | --- |
| Codice errato: messaggio generico. Codice giusto scritto in minuscolo e con spazi: si entra | superata |
| Prima schermata: saluto, classe e anno, «Riprendi» con data e stato, riga del curricolo della terza | superata |
| Archivio con due anni: 2026/27 con «Riprendi», 2025/26 chiuso con «Rileggi» | superata |
| Storico di seconda: si apre con la risposta compilata, in sola lettura, senza popup del vecchio accesso e senza ID nell’indirizzo | superata |
| Lavoro nuovo: salvataggio confermato dal server, ricaricando i campi tornano | superata |
| Due schede: la scheda rimasta indietro riceve un conflitto, nessuna sovrascrittura, bozza recuperabile su richiesta | superata |
| Sessione scaduta: avviso «Rientra», nessun ripiego sul vecchio accesso, dopo il codice si torna all’attività | superata |
| «Esci» e poi Indietro: nessuna risposta ricompare (difetto trovato e corretto durante la prova) | superata |
| Telefono 375 px: nessuno scorrimento orizzontale, «Esci» e «Riprendi» visibili | superata |
| Area docente: classi, attività e alunni come prima; lavori protetti contati una volta | superata |
| Pannello accessi: conferma di un «certo», nuovo codice mostrato una volta, importazione con anteprima ed esiti | superata |
| Vecchio accesso: un codice senza accesso personale salva come prima, un codice protetto riceve il rifiuto e un messaggio | superata |
| Esportazione Aruba: 5 file nuovi, 13 modificati, nessun file di `supabase/`, `scripts/` o di collaudo nel pacchetto | superata |

Non provato: Firefox e Safari, un telefono vero, un Chromebook della scuola, zoom molto alto, la navigazione solo
da tastiera su tutta l’attività, il collaudo sul Postgres 17 del progetto remoto, le pagine «compatibili» una per una
e le prove con utenti reali.

## Ordine di rilascio e sospensione

Ogni passaggio richiede un’autorizzazione separata.

1. **Database.** Prima una copia secondo le modalità concordate. Poi si applica `supabase/area-alunni.sql`: è
   additiva, parte con l’ingresso spento e nessuna pagina abilitata, e se un salvataggio esistente cambiasse annulla
   tutto da sola. Dopo, verifiche in sola lettura: conteggi, permessi e advisor.
2. **Sito.** Commit sul ramo, push normale su `codex/aruba-metodologieoperativessas`, controllo del workflow per
   quel commit, degli hash e del browser. Il nuovo codice nelle pagine non cambia nulla finché nel database non ci
   sono pagine abilitate e codici.
3. **Pilota.** Si abilitano le attività scelte con `alunni_docente_pagina` (oggi solo da SQL o da una piccola
   aggiunta al pannello), si attiva l’ingresso, si importa una classe pilota, si confermano i lavori «certi» e si
   consegnano i codici uno alla volta.
4. **Quando sospendere.** Un alunno vede un lavoro non suo, un salvataggio va perso, oppure il vecchio accesso
   torna a leggere o a scrivere un lavoro protetto.
5. **Come sospendere.** «Sospendi l’ingresso» nel pannello: gli alunni non entrano più, le sessioni si fermano e i
   lavori restano protetti, senza tornare al vecchio accesso. Per tornare indietro sul sito si ripubblicano i file
   della release precedente; le funzioni storiche del database continuano a rispondere alle pagine vecchie, che non
   conoscono le colonne nuove. Un ripristino del database da una copia **non** si fa sopra dati più recenti senza una
   procedura che conservi le scritture successive.

## Dati trattati: Aruba e Supabase

| Voce | Verificato | Da verificare | Decisione necessaria |
| --- | --- | --- | --- |
| Aruba | Serve le pagine; il service worker non mette in cache le chiamate all’API, che sono POST verso un altro dominio | Log del server: durata, accessi, contenuto. Oggi i link di anteprima docente portano classe e codice nell’indirizzo. Condizioni del piano e disciplina del trattamento per conto del cliente | Se accettare quei parametri nei log o rivedere i link di anteprima |
| Supabase | Progetto «Scuola e presenza online», regione eu-west-1 (Irlanda), stato attivo | DPA applicabile all’account, piano, durata di backup e log, accessi amministrativi, subfornitori dei componenti usati | Chi è titolare e chi responsabile, con il referente della scuola |
| Dati nuovi | Pseudonimo, classe e anno, impronte di codici e token, data dell’ultimo uso, impronta dell’indirizzo di rete per un giorno, registro delle operazioni | — | Quanto conservare registro, sessioni scadute e annate di lavori |
| Dati già presenti | Codici storici, classe, risposte libere: dati personali se riconducibili a un alunno | Testi liberi che contengono riferimenti personali | Testo breve di informazione agli alunni; chi chiede correzione o rimozione |

La regione del server non basta a dire che il trattamento è conforme. I ruoli non si deducono dal possesso del dominio.

## Da sapere dalla ricognizione

- Il 20/11/2026 `progress` contiene 386 righe, 237 del 2025/26 e 149 del 2026/27. Nove codici compaiono in più
  classi nello stesso anno, undici codici hanno più grafie, 104 righe usano il vecchio prefisso. Questi conteggi
  non contengono nomi.
- L’advisor di Supabase segnala come «esposte» quattro tabelle `private.*` senza RLS. Il ruolo `anon` però non ha
  accesso allo schema `private`, quindi la segnalazione non indica un’esposizione reale. Abilitare la RLS su quelle
  tabelle resta una pulizia innocua da decidere.
- **Difetto già in produzione:** `progress_docente_accesso` registra il tentativo fallito e subito dopo solleva un
  errore, e l’errore annulla anche la registrazione. Nel registro ci sono 20 accessi riusciti e nessun fallimento, e
  il blocco dopo dieci password sbagliate non scatta mai. Il rimedio è lo stesso schema usato in `alunni_accesso`:
  restituire un esito invece di sollevare l’errore. Va fatto in una migrazione separata, da autorizzare.
- `docente_compiti` (compiti assegnati alla classe) esiste ma è vuota: quando verrà usata, potrà alimentare
  «Apri l’attività assegnata» nella pagina dell’alunno.

## Decisioni che spettano al docente

1. Le attività della prima fase. Oggi sono le cinque pilota collaudate: operatore sociale, welfare in quattro fasi,
   collage autobiografico, percorsi di autoapprendimento di terza, ripasso di terza.
2. Le parole del curricolo per ogni anno, oggi in `assets/area-alunni.js`: prima e seconda «Persona · Bisogno ·
   Relazione d’aiuto», con «Bisogno · Risposta · Welfare» sulle attività di welfare; terza «Bisogno · Servizio ·
   Équipe»; quarta «Barriere · Partecipazione · Progetto di vita»; quinta «Autonomia · Ambiente di vita · Sostegno».
3. La classe pilota e i lavori storici da affidare alla verifica.
4. Dove mettere «I miei lavori» nel menu di tutte le pagine (oggi è solo in home e nella pagina stessa).
5. Le autorizzazioni, separate fra loro: migrazione del database, pubblicazione su Aruba, attivazione con dati
   reali e consegna dei codici.
