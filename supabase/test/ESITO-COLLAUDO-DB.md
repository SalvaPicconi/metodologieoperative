# Collaudo database dell’Area alunni

Ambiente: PostgreSQL 18.6 (PGlite 0.5.13), in memoria, struttura remota ricostruita in `baseline.sql`, dati inventati.
Comando: `cd supabase/test && npm install && node area-alunni.test.mjs`. Eseguito il 20/11/2026, 22:09:55.
Esito: 63 prove superate su 63.

| Gruppo | Prova | Esito | Evidenza |
| --- | --- | --- | --- |
| Migrazione | La migrazione si applica | superata |  |
| Migrazione | Nessun salvataggio cambia | superata | 12 righe, impronta invariata |
| Migrazione | Copia di sicurezza creata nello schema privato | superata |  |
| Migrazione | Rieseguire la migrazione si ferma senza effetti | superata | relation "progress_backup_pre_area_alunni_20261120 |
| Unificazione automatica | ROSSIG in 3SB: un alunno, con «rosig» unito come variante | superata | 3SB/ROSIG |
| Unificazione automatica | Maiuscole, spazi e «3 SB» non creano alunni diversi | superata |  |
| Unificazione automatica | ROSSIA e ROSSIM (stessa attività) restano due alunni | superata |  |
| Unificazione automatica | VERDIC salvato una volta con 3SA, attività diversa: unito come classe sbagliata | superata |  |
| Unificazione automatica | NERID in 4SA: alunno a sé | superata |  |
| Unificazione automatica | Il profilo di ROSSIG continua dalla 2SB 2025/26 alla 3SB 2026/27 | superata |  |
| Unificazione automatica | Nessun lavoro attribuito a mano: tutto viene dalle regole | superata |  |
| Vecchio accesso invariato | Le attività leggono come prima con classe e codice | superata |  |
| Vecchio accesso invariato | …e salvano come prima | superata |  |
| Ingresso | Classe e codice di sempre: si entra | superata |  |
| Ingresso | Con la grafia sbagliata già unita si entra nello stesso profilo | superata |  |
| Ingresso | Con la classe sbagliata già unita si entra (VERDIC con 3SA) | superata |  |
| Ingresso | Classe o codice inesistenti: risposta generica | superata |  |
| Ingresso | Il profilo dice classe e anno | superata | {"classe":"3SB","iscritto":true,"anno_corso":3,"pseudonimo":"ROSSIG","anno_corrente":2026} |
| Ingresso | Chi ha appena salvato la prima volta entra subito (profilo creato all’ingresso) | superata |  |
| I miei lavori | ROSSIG vede i suoi lavori, anche quello salvato come «rosig» | superata | ripasso-terzo-anno.html:2026, esercitazioni_servizi.html:2026, equipe_multiprofessionale.html:2026, percorsi_autoapprendimento.html:2026, laboratorio.html:2025, tssas_percorso_completo_v2.html:2025 |
| I miei lavori | …e quelli di seconda, con il percorso normalizzato | superata |  |
| I miei lavori | Non vede i lavori di ROSSIA né di ROSSIM | superata |  |
| I miei lavori | Conoscere l’ID di un lavoro altrui non basta | superata |  |
| Riprendere e salvare | Riapre il lavoro con i dati (anche quelli salvati dal vecchio accesso) | superata |  |
| Riprendere e salvare | Salva nella stessa riga | superata |  |
| Riprendere e salvare | Il vecchio accesso vede subito lo stesso lavoro | superata |  |
| Riprendere e salvare | Una scheda rimasta indietro riceve un conflitto | superata |  |
| Riprendere e salvare | Il lavoro salvato con «rosig» si riapre | superata |  |
| Riprendere e salvare | Salvando resta il codice con cui era stato salvato (la riga non si sposta) | superata |  |
| Riprendere e salvare | Attività già fatta l’anno scorso: quest’anno si parte da un lavoro nuovo | superata |  |
| Riprendere e salvare | Il lavoro nuovo si salva con classe e codice principali | superata |  |
| Riprendere e salvare | Il lavoro di seconda si rilegge, non si modifica | superata |  |
| Riprendere e salvare | Pagina non abilitata: nessun salvataggio dall’area | superata |  |
| Riprendere e salvare | Token inventato respinto | superata |  |
| 1° settembre | 31 agosto 23:30: si lavora ancora nel 2026/27 | superata |  |
| 1° settembre | 1° settembre 00:30: niente scritture nel nuovo anno senza classe | superata |  |
| 1° settembre | In quarta lo stesso alunno ritrova anche terza e seconda | superata | 2027,2026,2025 |
| Docente | Senza sessione docente: rifiuto | superata |  |
| Docente | La classe elenca gli alunni con le grafie unite | superata | NUOVOX,ROSSIA,ROSSIG,ROSSIM,VERDIC |
| Docente | ROSSIA/ROSSIM proposti come caso da decidere | superata |  |
| Docente | «Alunni diversi»: la coppia non viene più proposta | superata |  |
| Docente | «Separa»: il lavoro con «rosig» esce subito da ROSSIG | superata |  |
| Docente | …e ROSIG diventa un alunno a sé che non viene riunito da solo | superata |  |
| Docente | «Stesso alunno»: il lavoro torna a ROSSIG | superata |  |
| Docente | Registro delle decisioni | superata |  |
| Docente | Le viste docente esistenti contano ogni lavoro una volta | superata |  |
| Sessione, uscita, sospensione | Dopo «Esci» il token non vale più | superata |  |
| Sessione, uscita, sospensione | Sessione scaduta: nessuna lettura | superata |  |
| Sessione, uscita, sospensione | Ingresso sospeso: nessun nuovo accesso | superata |  |
| Sessione, uscita, sospensione | Ingresso sospeso: le sessioni aperte si fermano | superata |  |
| Sessione, uscita, sospensione | Ingresso sospeso: il vecchio accesso dalle attività continua | superata |  |
| Correzione delle verifiche | Il docente vede gli elaborati della verifica, da correggere | superata |  |
| Correzione delle verifiche | Apre le risposte dell’alunno | superata |  |
| Correzione delle verifiche | «Salva» tiene la correzione riservata | superata |  |
| Correzione delle verifiche | Una revisione vecchia non sovrascrive (due schede) | superata |  |
| Correzione delle verifiche | «Mostra all’alunno»: la vede in I miei lavori | superata |  |
| Correzione delle verifiche | Un compagno non la vede, nemmeno con l’ID | superata |  |
| Correzione delle verifiche | «Rendi riservata» la nasconde di nuovo | superata |  |
| Correzione delle verifiche | Senza sessione docente nessun accesso agli elaborati | superata |  |
| Permessi | anon non legge progress | superata |  |
| Permessi | anon non legge le iscrizioni | superata |  |
| Permessi | anon non esegue le funzioni interne | superata |  |
| Permessi | Dopo 60 errori dalla stessa rete in 15 minuti: pausa | superata |  |
