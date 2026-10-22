# Pubblicazione su Aruba

Destinazione: `https://metodologieoperativessas.it/`, Hosting Basic Linux.
Il repository conserva le fonti compatibili con il vecchio GitHub Pages.
L'esportazione adatta soltanto gli indirizzi, la PWA e il ritorno alla home;
dataset, campi delle attivita e protocollo Supabase rimangono identici.

## Preparazione

```sh
python3 scripts/programmi.py check
python3 scripts/package_aruba.py --output /percorso/nuova-release-aruba
```

La nuova cartella contiene `site/`, lo ZIP da estrarre nella radice web Aruba e
`release.json` con commit sorgente, file adattati e hash SHA-256 dei file esportati.
Non caricare il repository completo: codice server, fonti e istruzioni interne
sono esclusi dallo ZIP. Lo script non sovrascrive un'esportazione precedente.

## Ordine di attivazione e verifica

1. Attendere dominio/hosting attivi e certificato HTTPS valido.
2. Conservare una copia degli eventuali file preesistenti nella nuova radice web.
3. Pubblicare le due funzioni `programmi-revisioni` e `programmi-carola` con
   le origini HTTPS del nuovo dominio e del www, mantenendo `verify_jwt=true`.
   Confrontare prima le fonti live, per non sovrascrivere modifiche concorrenti.
   Verificare OPTIONS sia dal nuovo indirizzo sia da GitHub; una richiesta senza
   sessione deve continuare a essere respinta senza esporre contenuti protetti.
4. Caricare/estrarre lo ZIP, compreso `.htaccess`, nella radice web del nuovo dominio.
5. Verificare HTTPS, www verso dominio principale, percorsi vecchi prefissati verso
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
indirizzo e non passano automaticamente al nuovo dominio. Lasciare disponibile
il sito precedente per recuperarle; utilizzare gli strumenti di esportazione
delle singole attivita. Non trasferire indiscriminatamente localStorage o token.
Nessun reindirizzamento del vecchio GitHub Pages e previsto in questa fase.

## Ripristino

Se il collaudo fallisce, continuare a usare il sito GitHub esistente; ripristinare
sul nuovo hosting la copia precedente o uno ZIP gia verificato. Per le funzioni
Supabase conservare il sorgente/versione live precedente al deploy: il ripristino
deve mantenere i controlli di autenticazione e non richiede modifiche ai dati.
Il nuovo dominio non attiva ancora acquisti, abbonamenti o un paywall.
