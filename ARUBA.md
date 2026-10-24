# Pubblicazione su Aruba

Destinazione: `https://www.metodologieoperativessas.it/`, Hosting Basic Linux.
Le fonti restano scritte per il vecchio prefisso `/metodologieoperative/`.
L'esportazione adatta soltanto gli indirizzi, la PWA e il ritorno alla home;
dataset, campi delle attivita e protocollo Supabase rimangono identici.

## Stato attuale (aggiornato il 24 ottobre 2026)

- Il sito vive solo su Aruba. GitHub Pages e stato disattivato il 23 ottobre 2026
  su richiesta del titolare: non va riattivato e il vecchio indirizzo non si pubblica piu.
- Si pubblica con un push normale sul ramo `codex/aruba-metodologieoperativessas`,
  che avvia il workflow `Pubblica su Aruba` (sezione «Caricamento automatico da GitHub»).
  Il nome del ramo non lo riserva a Codex. `main` non pubblica e non contiene questo file,
  gli script `package_aruba.py`/`deploy_aruba.py` ne il workflow.
- La procedura per ogni revisione (ramo dalla cima Aruba, controlli, consenso del titolare,
  push non forzato, run dello stesso commit, verifica del sito) e in `CLAUDE.md` e `AGENTS.md`,
  sezione «Pubblicazione su Aruba», presente anche su `main`.
- Le sezioni «Ordine di attivazione e verifica» e la parte sul sito precedente in
  «Conservazione dei lavori» descrivono la migrazione del 22 ottobre 2026: sono storiche.

## Preparazione

```sh
python3 scripts/programmi.py check
python3 scripts/package_aruba.py --output /percorso/nuova-release-aruba
```

La nuova cartella contiene `site/`, lo ZIP da estrarre nella radice web Aruba e
`release.json` con commit sorgente, file adattati e hash SHA-256 dei file esportati.
Non caricare il repository completo: codice server, fonti e istruzioni interne
sono esclusi dallo ZIP. Lo script non sovrascrive un'esportazione precedente.

## Ordine di attivazione e verifica (storico: migrazione del 22 ottobre 2026)

1. Attendere dominio/hosting attivi e certificato HTTPS valido.
2. Conservare una copia degli eventuali file preesistenti nella nuova radice web.
3. Pubblicare le due funzioni `programmi-revisioni` e `programmi-carola` con
   le origini HTTPS del nuovo dominio e del www, mantenendo `verify_jwt=true`.
   Confrontare prima le fonti live, per non sovrascrivere modifiche concorrenti.
   Verificare OPTIONS sia dal nuovo indirizzo sia da GitHub; una richiesta senza
   sessione deve continuare a essere respinta senza esporre contenuti protetti.
4. Caricare/estrarre lo ZIP, compreso `.htaccess`, nella radice web del nuovo dominio.
5. Verificare HTTPS, dominio senza www verso www, percorsi vecchi prefissati verso
   radice, home, navigazione, file scaricabili e installazione PWA. I redirect sono
   inizialmente temporanei (302), per poter correggere la configurazione.
6. Confrontare gli hash dei file serviti con `release.json`; provare l'accesso
   ospite senza scrivere progressi di studenti reali. Collaudare separatamente
   gli accessi riservati con il titolare, senza cambiare password.

## Conservazione dei lavori

Le chiavi remote sono normalizzate da `assets/progress.js`: il vecchio prefisso
`/metodologieoperative` resta riconosciuto anche sul nuovo dominio. Non modificare
record, codici studenti, identificatori HTML, alias dei percorsi o dataset generati.

Cookie, accessi e bozze salvate soltanto nel browser appartengono al vecchio
indirizzo e non passano automaticamente al nuovo dominio. Non trasferire
indiscriminatamente localStorage o token. Durante la migrazione il sito precedente
restava disponibile per recuperarle; dal 23 ottobre 2026 GitHub Pages e disattivato
e questa via non c'e piu: per una bozza solo locale si usano gli strumenti di
esportazione della singola attivita, dal browser in cui e stata scritta.

## Ripristino

Non si torna a GitHub Pages. Se un rilascio fallisce il collaudo, si ripubblicano su
Aruba i file statici di una release compatibile gia verificata: di norma si porta sul
ramo Aruba, con un nuovo commit e senza force-push, il contenuto dei file della revisione
precedente, cosi il workflow ricarica quelli. Non si ripristinano vecchie righe del
database: i progressi degli studenti restano dove sono. Per le funzioni
Supabase conservare il sorgente/versione live precedente al deploy: il ripristino
deve mantenere i controlli di autenticazione e non richiede modifiche ai dati.
Il nuovo dominio non attiva ancora acquisti, abbonamenti o un paywall.

## Caricamento automatico da GitHub

Il workflow `Pubblica su Aruba` parte dai push sul ramo
`codex/aruba-metodologieoperativessas`; `main` non pubblica (GitHub Pages e
disattivato). Serve un solo repository secret: `ARUBA_FTP_PASSWORD`, con la
password FTP dell'account Aruba indicato nell'email di attivazione.
Inserirlo in Settings > Secrets and variables > Actions del repository.
La password non va nel codice, nei log o in chat.

Il workflow controlla le sorgenti, genera la stessa esportazione e carica con
FTPS soltanto i file modificati. Verifica i byte rileggendoli dal server, carica
la home per ultima e non cancella file. La prima esecuzione parte dal manifest
della release Aruba `0995452`, già verificata online; le successive leggono lo
stato `.aruba-deploy.json` sul server. Una home diversa dall'ultima nota blocca
il caricamento per evitare di sovrascrivere modifiche concorrenti.

Se manca il secret, il workflow si ferma prima di connettersi. Dopo averlo
inserito, rieseguire il job da Actions. Verificare comunque la pagina e
l'immagine pubbliche: il controllo FTPS non prova che la cache HTTP sia aggiornata.
