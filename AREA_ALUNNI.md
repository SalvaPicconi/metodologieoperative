# Area «I miei lavori» · 20 novembre 2026

Decisione del titolare (20/11/2026): gli alunni entrano con **la classe e il codice che usano già** nelle attività
(cognome e iniziale). Non ci sono codici nuovi da consegnare. Le grafie sbagliate dello stesso codice le unisce il sito;
i casi dubbi restano al docente. Il limite è accettato: chi conosce classe e codice di un compagno può aprirne i lavori,
come già oggi dalle attività.

## Che cosa vede e fa l’alunno

1. In home, sotto il titolo, preme **I miei lavori** (`area_alunni.html`) e scrive classe e codice. Maiuscole e spazi
   non contano. Anche un codice scritto con una lettera sbagliata, se il sito l’ha unito al suo, apre gli stessi lavori.
2. In alto trova **Riprendi l’ultimo lavoro**, con titolo, data e stato (percentuale, quando la pagina la registra,
   oppure «Lavoro salvato»). Sotto c’è una riga di parole del curricolo, con una domanda per ricordare.
3. Sotto c’è l’archivio per anno scolastico. Per i lavori di quest’anno: **Riprendi** sulle attività collegate all’area,
   dove la pagina si apre già compilata e non chiede classe e codice; **Apri** sulle altre, che chiedono classe e codice
   come sempre. Per gli anni precedenti: **Rileggi**, in sola lettura. Rifacendo un’attività nel nuovo anno nasce un
   lavoro nuovo.
4. «Salvato» compare solo dopo la conferma del server. Se un’altra scheda ha salvato nel frattempo, il lavoro non si
   sovrascrive: un avviso lo dice e le risposte restano recuperabili. **Esci** chiude la sessione e toglie i dati dallo schermo.

## Che cosa vede e fa il docente

Nell’Area docente, dentro ogni classe, c’è la nuova vista **Accessi alunni**. Le altre viste sono invariate. Qui si vede:

- l’elenco degli alunni ricavato dai salvataggi, ciascuno con le **grafie unite** in automatico. Per ognuna c’è
  **Separa**, se l’unione è sbagliata;
- i casi **Da decidere**: codici quasi uguali che hanno salvato le stesse attività, quindi probabilmente due alunni
  (per esempio rossia e rossim). Si sceglie **Alunni diversi** oppure **Stesso alunno**;
- l’interruttore per sospendere l’ingresso e il registro delle decisioni.

## Come il sito unisce le grafie

L’unificazione lavora anno per anno, a partire dal codice con più lavori:

- si unisce un codice della stessa classe che differisce di **una lettera** (in più, in meno o diversa) o di **due
  lettere vicine scambiate**;
- si unisce lo **stesso codice salvato con un’altra sezione** dello stesso anno di corso;
- l’unione avviene solo se le due grafie **non hanno mai salvato la stessa attività**, e solo se la variante è vicina
  a un solo codice. Negli altri casi le grafie restano alunni distinti e il caso va fra quelli «Da decidere»;
- lo stesso codice nella classe successiva (per esempio 2SB → 3SB) è lo stesso alunno, e lo storico lo segue.

L’unificazione non modifica nessun salvataggio. Separare o unire cambia solo chi vede che cosa nell’area. Il vecchio
accesso dalle attività resta identico: `progress_carica` e `progress_salva` non sono state toccate.

## Dati e permessi (`supabase/area-alunni.sql`)

- **Tabelle private** (RLS attiva, nessun permesso ai ruoli dell’API): profili, classi per anno, iscrizioni con il
  codice principale, varianti, sessioni (solo l’impronta del token, 8 ore), tentativi (impronta della rete, conservata
  un giorno), registro, pagine collegate e configurazione.
- **Colonna `progress.profilo_id`**: facoltativa, usata quando il docente unisce a mano due alunni.
- **Copia di sicurezza** dei salvataggi in `private.progress_backup_pre_area_alunni_20261120`. Se un salvataggio
  esistente cambiasse, la migrazione si annulla da sola.
- **Funzioni**: tutte `SECURITY DEFINER` con `search_path` vuoto. Quelle dell’alunno chiedono la sessione; quelle del
  docente chiedono la sessione docente esistente.
- **Pagine collegate all’area** (si riprendono senza reinserire classe e codice): operatore sociale, welfare in
  quattro fasi, collage autobiografico, percorsi di autoapprendimento di terza, ripasso di terza.
- **Sessione nel browser**: `sessionStorage`, cioè una sola scheda; chiudendola, la sessione sparisce.

## Collaudo

- **Database**: 55 prove su 55, su PGlite con dati inventati (`supabase/test/ESITO-COLLAUDO-DB.md`).
- **Browser**, anteprima locale (`node supabase/test/server-locale.mjs`, poi `http://localhost:8421/__api-locale`):
  - ingresso con una grafia sbagliata e archivio unificato;
  - riapertura, storico in sola lettura, conflitto fra schede, sessione scaduta;
  - «Esci» seguito dal tasto Indietro;
  - telefono a 375 px;
  - pannello docente.
- **Non provato**: Firefox e Safari, un telefono e un Chromebook veri, le altre attività una per una.

## Censimento delle pagine

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

## Da sapere

- **Blocco della password docente.** Il blocco dopo dieci password sbagliate non scatta mai: il tentativo fallito
  viene annullato insieme all’errore. Correzione da fare a parte.
- **Avviso dell’advisor di Supabase.** Le tabelle `private.*` senza RLS segnalate dall’advisor non sono raggiungibili
  dall’API, perché il ruolo anon non ha accesso allo schema.
- **Sospensione.** «Sospendi l’ingresso» chiude l’area; le attività continuano come prima. Per tornare alle pagine
  precedenti si ripubblicano i file della release precedente.

## Correzione delle verifiche (20/11/2026, sera)

Su richiesta del docente le verifiche sommative di biennio, terza e quarta e la verifica sull’intelligenza artificiale si
correggono come «L’operatore sociale», da `verifiche_correzione.html` (Strumenti del docente). Si sceglie la verifica e
l’elaborato; le domande si leggono dalla pagina della verifica; si scrivono commenti per risposta, punti per sezione,
voto e commento finale. «Salva» tiene tutto riservato, «Mostra all’alunno» lo rende visibile in «I miei lavori»
(«Vedi la correzione»), «Rendi di nuovo riservata» lo ritira. Sezioni, massimi e regola del voto in
`assets/verifiche-correzione.json`: terza e quarta usano la griglia della verifica; per biennio (100 punti) e IA
(150 punti) la pagina non ha griglia e il voto è proporzionale, **da confermare**. Le risposte non cambiano:
la correzione sta in `private.verifiche_correzioni` (migrazione `supabase/verifiche-correzione.sql`). Collaudo: 63/63.
