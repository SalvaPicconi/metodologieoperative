---
name: monitoraggio-richiami
description: Fare il punto, classe per classe, su chi ha svolto o no i compiti assegnati sul sito Metodologie Operative e produrre il file Word «a che punto sei» da condividere con la classe (studenti, famiglie, docenti in sola lettura). Usare quando il docente chiede monitoraggio, richiami, solleciti, «chi non ha fatto i compiti», «a che punto sono».
---

# Monitoraggio e file di richiami per classe

Modello deciso dal titolare il 25-26 novembre 2026. Si lavora senza chiedere conferme (vedi `correzione-compiti`).

## 1. Che cosa si controlla (comportarsi da docente)

1. **Solo i compiti assegnati.** L'elenco lo dà il docente, classe per classe (es. 2SB collage, parte da casa;
   3ª servizi sociosanitari; 4SB riconfigurare la disabilità; 5SA caso professionale più quelli assegnati prima,
   riconoscibili dalle date dei salvataggi). Un'attività fatta tutta in classe in un solo giorno (es. lezione
   partecipata) non è un compito da sollecitare: si segnala al docente e si chiede.
2. **Elenco della classe:** i codici iscritti all'Area alunni dell'anno (`private.alunni_iscrizioni` +
   `private.alunni_classi`, `school_year`), più i codici che hanno salvato. Esclusi i codici di prova del docente.
3. **Stato parte per parte, non per numero di campi:** moduli, fasi, tappe, missioni, parti della pagina
   (`completed`/`_meta` dove la pagina li salva, campi con etichetta in `assets/verifiche-correzione.json`,
   `act_*`, `quizAnswers`). Tre stati: **Fatto**, **A metà** (con le parti che mancano), **Da iniziare**.
   Una risposta di una parola o un campo riempito per sbloccare la pagina non conta come svolto.
4. **Prima di scrivere, verificare:**
   - codici doppi o sbagliati (es. karim/karimk, tatterit/patterit): il lavoro va al codice che lo contiene;
   - pagine che **non salvano sul sito** (es. risposte solo nel browser): non si può dire chi ha lavorato; si
     collega la pagina al salvataggio (skill `nuovo-materiale`, passo 4b) e si avvisano gli alunni;
   - esercizi che la pagina non salva per scelta (es. prove guidate del collage): non si controllano;
   - pagine delle classi (`biennio/terzo/quarto/quinto.html`): le «annotazioni» non sono compiti.
5. **Al docente, a parte (in chat, mai nel file):** casi da chiarire, codici doppi, sospetti di copiatura,
   alunni mai entrati nel sito (vanno confrontati con il registro).

## 2. Il file Word della classe (modello approvato)

Un file per classe, letto **dal telefono**: corto, concreto, niente circolare.

- **Titolo:** `<CLASSE> · <attività>` (con più attività: `5SA · Attività da completare`).
- **Introduzione, una riga:** «Care studentesse e cari studenti, ecco a che punto siete con … Completate quello
  che manca.» Mai «Ragazzi». Niente presentazioni del sito, niente consigli generali.
- **📌 «Questa attività verrà valutata.»** (con più attività: «Tutte queste attività verranno valutate.»)
- **👉 Apri l'attività** (link alla pagina sul sito), **Da fare:** in una riga, **Scadenza:** quella indicata
  dal docente; se non la indica resta `__________` (vale la scadenza già data).
- **Tabella:** Alunno (codice in maiuscolo) · Stato (✅ Fatto / 🟡 A metà / 🔴 Da iniziare, a colori) ·
  Che cosa ti manca (parti precise: «Modulo 4 (progetto per la famiglia Neri)», «Missioni 4-8 e caso finale»).
- **A chi ha finito:** il passo concreto che viene dopo **in quel punto della pagina**. Collage: «In laboratorio
  realizzi il tuo collage: porta riviste, fotografie ed eventuali oggetti significativi per te» (forbici, colla,
  cartoncino ci sono già in laboratorio). Percorsi corretti: «Leggi la mia correzione sotto le tue risposte».
- Più attività: una sezione numerata per attività, la prima è quella in corso.
- **Niente** riga finale («Dubbi…»), niente indicazioni generiche, niente voti, giudizi sulla persona, sospetti
  di copiatura o di uso dell'IA, contenuti personali (es. temi del collage autobiografico).

Generatore: `.claude/skills/monitoraggio-richiami/genera_richiami.py dati.json uscita.docx` (struttura di
`dati.json` in testa allo script). Dati e file con i codici degli alunni solo nella scratchpad; si mandano al
docente con `SendUserFile`. Prima di consegnare: conversione in PDF e controllo dell'immagine della pagina.

## 3. Dopo

- Le correzioni dei lavori completi si fanno con la skill `correzione-compiti`.
- Dopo la scadenza si rifà il controllo e si aggiorna il file.
