# Collaudo database dell’Area alunni

Ambiente: PostgreSQL 18.6 (PGlite 0.5.13), in memoria, con la struttura remota ricostruita in `baseline.sql` e dati inventati.
Comando: `cd supabase/test && npm install && node area-alunni.test.mjs`. Eseguito il 20/11/2026, 21:15:16.
Esito: 94 prove superate su 94.

Il progetto remoto usa Postgres 17: il collaudo locale non sostituisce la prova sul backend reale,
che va fatta solo dopo l’autorizzazione della migrazione.

| Gruppo | Prova | Esito | Evidenza |
| --- | --- | --- | --- |
| Base | Prima della migrazione il flusso storico salva | superata |  |
| Migrazione | La migrazione si applica | superata |  |
| Migrazione | Nessun salvataggio esistente cambia | superata | 8 righe, impronta invariata |
| Migrazione | Rieseguire la migrazione si ferma senza effetti | superata | relation "progress_backup_pre_area_alunni_20261120" already  |
| Migrazione | Dopo la migrazione, senza attivazione, il flusso storico legge come prima | superata |  |
| Migrazione | Ingresso spento: risposta «non disponibile» | superata |  |
| Permessi | anon non legge progress | superata |  |
| Permessi | anon non legge i profili | superata |  |
| Permessi | anon non legge le credenziali | superata |  |
| Permessi | anon non esegue le funzioni interne | superata |  |
| Permessi | anon non scrive direttamente | superata |  |
| Permessi | Le funzioni docente rifiutano un token falso | superata |  |
| Attivazione docente | Accesso docente di collaudo | superata |  |
| Attivazione docente | Ingresso attivato | superata |  |
| Attivazione docente | Anteprima dell’importazione senza scritture | superata | nuovo, nuovo, nuovo, nuovo |
| Attivazione docente | Importazione confermata | superata |  |
| Attivazione docente | Reimportare la stessa lista non crea doppioni | superata | già in questa classe, già in questa classe, già in questa classe, già in questa classe |
| Attivazione docente | Lo stesso codice non può andare a due alunni nello stesso anno | superata | codice già usato da un altro alunno in questo anno: sceglierne uno diverso |
| Attivazione docente | Codice ripetuto nella stessa lista segnalato | superata |  |
| Attivazione docente | La classe 3SB 2026 elenca quattro alunni | superata |  |
| Attivazione docente | All’attivazione le righe dell’anno con codici protetti su pagine abilitate vanno in verifica | superata | GIALLIGdimento.html, ROSSIAzo-anno.html, VERDICdimento.html, VERDICzo-anno.html |
| Attivazione docente | La pagina fuori dal perimetro non viene toccata | superata |  |
| Confine storico | progress_carica non restituisce più la riga passata in verifica | superata |  |
| Confine storico | progress_salva non la modifica | superata | lavoro protetto: entra da I miei lavori |
| Confine storico | Neppure dal percorso con il vecchio prefisso | superata |  |
| Confine storico | Una vecchia pagina non ricrea la posizione su una pagina abilitata (anche in minuscolo) | superata |  |
| Confine storico | Fuori dal perimetro il vecchio accesso funziona come prima | superata |  |
| Confine storico | Gli alunni senza accesso personale continuano a salvare | superata |  |
| Codici e sessioni | Codice nel formato XXXX-XXXX-XXXX-XXXX | superata | ••••-••••-••••-•••• |
| Codici e sessioni | Nel database resta solo l’impronta | superata |  |
| Codici e sessioni | Codice errato: risposta generica | superata |  |
| Codici e sessioni | I tentativi falliti restano registrati (servono al limite) | superata |  |
| Codici e sessioni | Accetta minuscole, spazi e le lettere O/I/L lette come cifre | superata |  |
| Codici e sessioni | Il profilo restituisce classe e anno dalla sessione | superata | {"classe":"3SB","iscritto":true,"anno_corso":3,"pseudonimo":"Alunna A.","anno_corrente":2026} |
| Isolamento | Pagina nuova per A: stato «nuovo» | superata |  |
| Isolamento | A salva il proprio lavoro | superata |  |
| Isolamento | B sulla stessa pagina non vede il lavoro di A | superata | nuovo |
| Isolamento | Conoscere l’ID del lavoro di A non basta a B | superata |  |
| Isolamento | L’elenco di B non contiene lavori di A | superata | 0 righe |
| Isolamento | B non può scrivere sulla riga di A usando la versione di A | superata | il lavoro non è più disponibile |
| Isolamento | Il lavoro protetto di A non è leggibile col vecchio accesso | superata |  |
| Isolamento | Token inventato respinto | superata |  |
| Isolamento | Pagina non abilitata: salvataggio protetto rifiutato | superata |  |
| Isolamento | Payload non oggetto rifiutato | superata |  |
| Versioni e schede | Salvataggio con la versione corrente | superata |  |
| Versioni e schede | Una seconda scheda con versione vecchia riceve un conflitto | superata |  |
| Versioni e schede | Il contenuto rimasto è quello della scheda aggiornata | superata | HTML conservato come testo: l’escape spetta alla pagina |
| Lavori storici | Stesso codice e stessa classe: «certo» | superata |  |
| Lavori storici | Codice con una lettera mancante: «simile», al solo docente | superata |  |
| Lavori storici | Stesso codice in due classi nello stesso anno: «da verificare» | superata | lo stesso codice compare in più classi in questo anno |
| Lavori storici | Unica riga rimasta con altra classe: «da verificare» | superata | salvato con un'altra classe: 3SA |
| Lavori storici | Nessun abbinamento automatico | superata |  |
| Lavori storici | Prima della conferma B non vede il lavoro col codice sbagliato | superata |  |
| Lavori storici | Il docente conferma il collegamento | superata |  |
| Lavori storici | Una riga non può avere due proprietari | superata |  |
| Lavori storici | Dopo la conferma B lo vede | superata |  |
| Lavori storici | …e lo riprende con i dati compilati | superata |  |
| Lavori storici | …e lo continua | superata |  |
| Lavori storici | Il vecchio codice digitato male non apre più la riga | superata |  |
| Lavori storici | …né la modifica da una pagina vecchia in cache | superata |  |
| Lavori storici | Il docente vede il collegamento confermato da poter annullare | superata |  |
| Lavori storici | Annullamento: il docente vede che la riga è cambiata dopo il collegamento | superata |  |
| Lavori storici | Annullamento: B perde subito l’accesso | superata |  |
| Lavori storici | Annullamento: la riga resta, protetta e senza proprietario | superata |  |
| Lavori storici | Annullamento: il vecchio accesso resta chiuso | superata |  |
| Lavori storici | Registro con conferma e annullamento | superata |  |
| Lavori storici | Non si sblocca una riga di un codice con accesso personale | superata |  |
| Lavori storici | Lavoro 2025/26 di seconda proposto per lo stesso profilo | superata |  |
| Lavori storici | Lo storico compare con anno, percorso normalizzato e sola lettura | superata |  |
| Lavori storici | Lo storico si riapre con i dati, non modificabile | superata |  |
| Lavori storici | Rifare l’attività quest’anno apre un lavoro nuovo | superata |  |
| 1° settembre | 31 agosto alle 23:30 (ora italiana) si scrive ancora nel 2026/27 | superata |  |
| 1° settembre | 1° settembre alle 00:30: senza iscrizione nel nuovo anno non si scrive | superata |  |
| 1° settembre | Una scheda rimasta aperta non scrive nell’anno sbagliato | superata |  |
| 1° settembre | I lavori 2026/27 restano consultabili in sola lettura | superata |  |
| 1° settembre | Passaggio in quarta: stesso profilo, nuova iscrizione | superata | portato dall'anno precedente |
| 1° settembre | Classe e anno di corso seguono l’iscrizione attuale | superata |  |
| 1° settembre | Nel nuovo anno nasce un lavoro nuovo, il vecchio resta intatto | superata | 2026:3SB / 2027:4SB |
| 1° settembre | La 3SB del 2027/28 è un gruppo diverso: nessun lavoro del 2026/27 le viene proposto | superata |  |
| 1° settembre | Due classi 3SB distinte per anno | superata |  |
| Revoca e uscita | Dopo «Esci» il token non vale più | superata |  |
| Revoca e uscita | Codice sostituito: la vecchia sessione cade | superata |  |
| Revoca e uscita | Codice sostituito: il vecchio codice non entra | superata |  |
| Revoca e uscita | Codice sostituito: il nuovo entra | superata |  |
| Revoca e uscita | Codice revocato: stessa risposta di un codice errato | superata |  |
| Revoca e uscita | Revoca e sostituzione non toccano i lavori | superata |  |
| Revoca e uscita | Sessione scaduta: nessun salvataggio | superata |  |
| Sospensione | Ingresso sospeso: niente nuovi accessi | superata |  |
| Sospensione | Ingresso sospeso: le sessioni aperte si fermano | superata |  |
| Sospensione | Ingresso sospeso: i lavori protetti NON tornano al vecchio accesso | superata |  |
| Viste docente esistenti | I nuovi lavori compaiono nella vista docente una volta sola | superata |  |
| Viste docente esistenti | Il docente apre il dettaglio di un lavoro protetto | superata |  |
| Limite dei tentativi | Dopo 40 errori dalla stessa rete in 15 minuti: blocco temporaneo | superata |  |
| Limite dei tentativi | Un’altra rete non è bloccata | superata |  |
