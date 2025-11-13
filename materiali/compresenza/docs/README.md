# 🧠 Test di Stroop - Laboratorio Digitale di Valutazione Cognitiva

## Autore
**Prof. Salvatore Picconi**  
Docente di Metodologie Operative  
IIS Meucci Mattei - Sede Decimomannu  
Indirizzo: Servizi per la Sanità e l'Assistenza Sociale

---

## 📖 Descrizione

Il Test di Stroop è uno strumento didattico interattivo per l'apprendimento delle tecniche di valutazione neuropsicologica. Questo progetto è stato sviluppato specificamente per gli studenti dei Servizi Sociosanitari per:

- **Sperimentare direttamente** l'effetto Stroop e comprenderne le implicazioni cognitive
- **Apprendere** l'uso di strumenti di valutazione delle funzioni esecutive
- **Riflettere** sulle applicazioni pratiche nel contesto dell'assistenza sociosanitaria
- **Analizzare** casi clinici reali e sviluppare capacità di osservazione
- **Raccogliere e analizzare** dati di classe per esercitazioni statistiche

---

## ✨ Caratteristiche Principali

### 🎯 Per gli Studenti
- ✅ Test interattivo con 30 prove a difficoltà progressiva
- ✅ Feedback immediato con punteggio gamificato (0-1000)
- ✅ Certificato PDF scaricabile con risultati dettagliati
- ✅ Sezione di riflessione guidata sull'esperienza
- ✅ Studio di 3 casi clinici reali commentati
- ✅ Interfaccia responsive (funziona su PC, tablet, smartphone)

### 👨‍🏫 Per il Docente
- ✅ Dashboard statistiche classe con grafici
- ✅ Export dati in CSV per analisi avanzate
- ✅ Salvataggio automatico locale (localStorage)
- ✅ Integrazione opzionale con Google Sheets
- ✅ Area riservata protetta da password
- ✅ Raccolta riflessioni degli studenti

### 📚 Contenuti Didattici
- ✅ Fondamenti teorici del Test di Stroop
- ✅ Spiegazione delle basi neuropsicologiche
- ✅ Applicazioni cliniche dettagliate
- ✅ Ruolo dell'operatore sociosanitario
- ✅ Interpretazione guidata dei risultati

---

## 🚀 Installazione su GitHub Pages

### Passo 1: Carica i file sul repository GitHub

1. Vai al tuo repository GitHub: `https://github.com/salvapicconi/metodologieoperative`
2. Entra nella cartella `materiali` (o creala se non esiste)
3. Carica questi file mantenendo la struttura:

```
metodologieoperative/
└── materiali/
    ├── test-stroop.html
    ├── css/
    │   └── stroop.css
    └── js/
        ├── stroop-test.js
        ├── stroop-results.js
        └── stroop-data.js
```

### Passo 2: Abilita GitHub Pages (se non già fatto)

1. Vai su `Settings` del repository
2. Sezione `Pages`
3. Source: `Deploy from a branch`
4. Branch: `main` (o `master`)
5. Folder: `/ (root)`
6. Salva

### Passo 3: Accedi al Test

Il test sarà disponibile a:
```
https://salvapicconi.github.io/metodologieoperative/materiali/test-stroop.html
```

### Passo 4: Link dalla pagina principale

Aggiungi un link dalla tua pagina `compresenza.html`:

```html
<a href="materiali/test-stroop.html" class="btn-test">
    🧠 Test di Stroop - Valutazione Cognitiva
</a>
```

---

## 🎮 Come Utilizzare il Test

### Per gli Studenti

1. **Accedi al test** dal link fornito dal docente
2. **Leggi gli approfondimenti teorici** (opzionale ma consigliato)
3. **Inserisci i tuoi dati**:
   - Nome o nickname (opzionale)
   - Età e sesso (obbligatori)
   - Acconsenti al trattamento dati didattici
4. **Leggi attentamente le istruzioni**
5. **Completa le 30 prove**:
   - Indica il COLORE dell'inchiostro, non la parola
   - Rispondi il più velocemente possibile
   - Mantieni la concentrazione
6. **Visualizza i tuoi risultati**:
   - Punteggio finale (0-1000)
   - Statistiche dettagliate
   - Interpretazione guidata
7. **Scarica il certificato PDF** (opzionale)
8. **Completa la riflessione guidata**
9. **Studia i casi clinici** per approfondire

### Per il Docente

#### Accesso alle Statistiche

1. Vai alla sezione "Casi Clinici"
2. Clicca su "Visualizza Statistiche Classe"
3. Inserisci la password: `metodologie2024` o `picconi`
4. Visualizza:
   - Numero totale partecipanti
   - Punteggi medi classe
   - Grafici distribuzione
   - Tabella dettagliata

#### Export Dati

Dalla dashboard statistiche:
- **Esporta CSV**: Download dati aggregati per analisi
- **Formato**: Data, Nome, Età, Sesso, Punteggio, Tempi, Accuratezza

#### Analisi Dati

I dati sono salvati in `localStorage` del browser. Per analisi avanzate:
1. Esporta i dati in CSV
2. Importa in Excel/Google Sheets/SPSS
3. Conduci analisi statistiche descrittive e inferenziali

---

## ⚙️ Configurazione Avanzata

### Cambio Password Statistiche

Modifica in `js/stroop-test.js` alla riga ~580:

```javascript
if (password === 'TUA_NUOVA_PASSWORD') {
    // ...
}
```

### Integrazione Google Sheets (Opzionale)

Per inviare automaticamente i dati a un Google Sheet:

#### 1. Crea il Google Sheet

1. Crea un nuovo Google Sheet
2. Menu: `Estensioni` → `Apps Script`
3. Incolla questo codice:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Test Stroop');
  
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Test Stroop');
    sheet.appendRow(['Timestamp', 'Nome', 'Età', 'Sesso', 'Punteggio', 'Livello', 
                     'Tempo Totale', 'Tempo Medio', 'Corrette', 'Accuratezza']);
  }
  
  var data = JSON.parse(e.postData.contents);
  
  if (data.type === 'reflection') {
    return ContentService.createTextOutput(JSON.stringify({result: 'success'}));
  }
  
  sheet.appendRow([
    data.timestamp,
    data.participant.name,
    data.participant.age,
    data.participant.gender,
    data.results.finalScore,
    data.results.performanceLevel,
    data.results.totalTime,
    data.results.avgTime,
    data.results.correctCount,
    data.results.accuracy
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({result: 'success'}));
}
```

4. Salva il progetto
5. `Deploy` → `New deployment`
6. Type: `Web app`
7. Execute as: `Me`
8. Who has access: `Anyone`
9. Clicca `Deploy`
10. **Copia l'URL generato**

#### 2. Configura il Test

In `js/stroop-data.js`, modifica:

```javascript
const DATA_CONFIG = {
    GOOGLE_SHEETS_URL: 'IL_TUO_URL_APPS_SCRIPT',  // ← Incolla qui
    USE_GOOGLE_SHEETS: true,  // ← Cambia a true
    // ...
};
```

#### 3. Ricarica su GitHub

Carica il file `stroop-data.js` modificato su GitHub.

**Fatto!** Ora i dati verranno automaticamente salvati nel Google Sheet.

---

## 📊 Formato Dati

### LocalStorage
I dati sono salvati localmente con chiave `stroopTests` in formato JSON:

```json
{
  "id": "test_1699876543210_xyz",
  "savedAt": "2024-11-13T10:30:00.000Z",
  "participant": {
    "name": "Marco R.",
    "age": 18,
    "gender": "M",
    "timestamp": "2024-11-13T10:25:00.000Z"
  },
  "testData": {
    "results": {
      "finalScore": 850,
      "performanceLevel": "Ottimo",
      "totalTime": 75.3,
      "avgTime": 2.51,
      "correctCount": 27,
      "accuracy": 90.0
    }
  }
}
```

### CSV Export
Formato file CSV esportato:

```
Data,Nome,Età,Sesso,Punteggio,Tempo Totale,Tempo Medio,Accuratezza
13/11/2024,Marco R.,18,M,850,75.3,2.51,90.0
```

---

## 🎨 Personalizzazione

### Colori e Stile

Modifica `css/stroop.css`:

```css
:root {
    --primary-color: #2563eb;     /* Colore principale */
    --secondary-color: #0891b2;   /* Colore secondario */
    /* Modifica questi valori per cambiare il tema */
}
```

### Numero di Prove

Modifica in `js/stroop-test.js`:

```javascript
const CONFIG = {
    TOTAL_TRIALS: 30,  // ← Cambia questo numero
    // ...
};
```

### Colori del Test

Modifica in `js/stroop-test.js`:

```javascript
COLORS: [
    { name: 'ROSSO', hex: '#FF0000' },
    { name: 'BLU', hex: '#0000FF' },
    // Aggiungi o modifica colori qui
]
```

---

## 🔧 Risoluzione Problemi

### Il test non si carica
- Verifica che tutti i file siano caricati correttamente
- Controlla la console del browser (F12) per errori
- Verifica i percorsi dei file CSS e JS nell'HTML

### I grafici non appaiono
- Attendi qualche secondo (Chart.js si carica da CDN)
- Verifica la connessione internet
- Controlla che il browser supporti JavaScript

### Il PDF non si scarica
- Attendi il caricamento di jsPDF (alcuni secondi)
- Verifica che il browser non blocchi i download
- Prova con un browser diverso

### I dati non si salvano
- Verifica che il browser permetta localStorage
- Controlla di non essere in modalità incognito
- Pulisci cache e cookie se necessario

### Google Sheets non riceve dati
- Verifica che l'URL dello script sia corretto
- Controlla che lo script sia deployato come "Anyone"
- Guarda i log dello script in Apps Script

---

## 📱 Compatibilità

### Browser Supportati
- ✅ Chrome/Edge (consigliato)
- ✅ Firefox
- ✅ Safari
- ✅ Opera
- ⚠️ Internet Explorer (non supportato)

### Dispositivi
- ✅ Desktop/Laptop
- ✅ Tablet (iPad, Android)
- ✅ Smartphone (iOS, Android)

### Requisiti Minimi
- JavaScript abilitato
- LocalStorage disponibile
- Connessione internet (per CDN Chart.js e jsPDF)

---

## 📖 Risorse Didattiche

### Materiali Integrativi nel Test
1. **Teoria completa** del Test di Stroop
2. **Basi neuropsicologiche** (attenzione, controllo inibitorio, funzioni esecutive)
3. **Applicazioni cliniche** (demenze, ADHD, Parkinson, traumi, depressione)
4. **Casi clinici commentati** con interpretazione professionale
5. **Guida riflessione** per apprendimento esperienziale

### Collegamenti con il Programma
- Valutazione funzioni cognitive nell'anziano
- Strumenti di screening sociosanitario
- Comunicazione con équipe multidisciplinare
- Personalizzazione dell'assistenza
- Osservazione e segnalazione tempestiva

---

## 🎓 Utilizzo Didattico Consigliato

### Prima del Test (30 min)
1. Lezione frontale su funzioni esecutive
2. Spiegazione test di Stroop (storia, applicazioni)
3. Discussione ruolo OSS nella valutazione cognitiva

### Durante il Test (15 min)
1. Studenti completano il test individualmente
2. Osservano le proprie reazioni ed emozioni
3. Prendono nota delle difficoltà incontrate

### Dopo il Test (45 min)
1. Analisi risultati individuali (10 min)
2. Discussione in classe sull'esperienza (15 min)
3. Studio casi clinici in piccoli gruppi (15 min)
4. Sintesi e collegamenti teorici (5 min)

### Compiti a Casa
1. Completare riflessione guidata
2. Ricerca approfondita su un caso clinico
3. Intervista a un professionista (psicologo, OSS)

---

## 🔒 Privacy e GDPR

### Trattamento Dati
- ✅ Consenso esplicito richiesto prima del test
- ✅ Nome opzionale (può essere pseudonimo)
- ✅ Dati utilizzati solo per fini didattici
- ✅ Nessun dato sensibile raccolto
- ✅ Storage locale nel browser dello studente
- ✅ Export controllato solo dal docente

### Informativa
Nel test è presente avviso chiaro:
> "I dati sono anonimi e utilizzati esclusivamente per scopi didattici"

### Diritti dell'Utente
Gli studenti possono:
- Usare pseudonimi
- Cancellare dati locali (cancellando localStorage browser)
- Chiedere al docente di non includere i propri dati

---

## 📞 Supporto e Contatti

### Autore
**Prof. Salvatore Picconi**
- Istituto: IIS Meucci Mattei - Decimomannu
- Disciplina: Metodologie Operative
- Indirizzo: Servizi per la Sanità e l'Assistenza Sociale

### Per Assistenza
- Consulta questo README
- Verifica la console browser (F12)
- Contatta il docente per supporto tecnico

---

## 📝 Note Legali

### Disclaimer
⚠️ **IMPORTANTE**: Questo è uno strumento **esclusivamente didattico**.

- ❌ NON sostituisce una valutazione clinica professionale
- ❌ NON può essere usato per diagnosi
- ❌ NON ha validità clinica certificata
- ✅ È progettato SOLO per scopi educativi
- ✅ Deve essere interpretato in contesto didattico

La somministrazione diagnostica del Test di Stroop deve essere effettuata esclusivamente da psicologi e neuropsicologi qualificati.

### Licenza
Materiale didattico realizzato per uso interno all'IIS Meucci Mattei.  
Ogni utilizzo esterno deve essere autorizzato dall'autore.

---

## 🎯 Obiettivi di Apprendimento

Al termine dell'attività, gli studenti sapranno:

### Conoscenze
- ✅ Cos'è il Test di Stroop e la sua storia
- ✅ Cosa sono le funzioni esecutive
- ✅ Quali aree cerebrali sono coinvolte
- ✅ In quali patologie è utile il test
- ✅ Come interpretare i risultati

### Competenze
- ✅ Somministrare un test di valutazione cognitiva
- ✅ Osservare comportamenti durante test
- ✅ Riconoscere pattern di difficoltà cognitive
- ✅ Comunicare osservazioni all'équipe
- ✅ Collegare teoria e pratica assistenziale

### Attitudini
- ✅ Approccio scientifico alla valutazione
- ✅ Empatia verso difficoltà cognitive
- ✅ Attenzione ai dettagli comportamentali
- ✅ Lavoro in équipe multidisciplinare
- ✅ Apprendimento riflessivo ed esperienziale

---

## 🔄 Versioni e Aggiornamenti

### Versione 1.0 (Novembre 2024)
- ✅ Rilascio iniziale
- ✅ 30 prove con difficoltà progressiva
- ✅ Sistema di punteggio gamificato
- ✅ Certificato PDF scaricabile
- ✅ Dashboard statistiche classe
- ✅ 3 casi clinici commentati
- ✅ Integrazione Google Sheets
- ✅ Design responsive

### Prossimi Sviluppi
- 🔜 Modalità allenamento (con feedback durante test)
- 🔜 Confronto risultati pre/post
- 🔜 Quiz interattivo sui casi clinici
- 🔜 Versione in lingua inglese
- 🔜 Accessibilità migliorata (screen reader)

---

## ✅ Checklist Installazione

Prima di rendere disponibile il test agli studenti:

- [ ] File caricati su GitHub nella cartella corretta
- [ ] GitHub Pages abilitato e funzionante
- [ ] Test raggiungibile dal link pubblico
- [ ] Tutti i bottoni funzionano correttamente
- [ ] Grafici si caricano (attendi 5-10 secondi)
- [ ] PDF si scarica correttamente
- [ ] Password statistiche funziona
- [ ] Export CSV funzionante
- [ ] (Opzionale) Google Sheets configurato
- [ ] Link aggiunto alla pagina compresenza
- [ ] README letto e compreso
- [ ] Testato su diversi browser
- [ ] Testato su mobile

---

## 🙏 Ringraziamenti

Questo progetto è stato sviluppato con l'obiettivo di innovare la didattica laboratoriale attraverso l'uso dell'intelligenza artificiale, insegnando agli studenti un uso consapevole e critico della tecnologia.

Grazie agli studenti dell'IIS Meucci Mattei per l'entusiasmo e la partecipazione attiva.

---

**© 2024 Prof. Salvatore Picconi - IIS Meucci Mattei, Decimomannu**  
*Innovare la didattica attraverso la tecnologia*
