# 📚 Sito Materiali Didattici - Guida Completa

## 🚀 PARTE 1: CARICARE IL SITO SU GITHUB PAGES

### Passo 1: Creare un Account GitHub (se non ce l'hai)
1. Vai su https://github.com
2. Clicca su "Sign up" (Registrati)
3. Completa la registrazione con la tua email

### Passo 2: Creare un Nuovo Repository
1. Fai login su GitHub
2. Clicca sul pulsante "+" in alto a destra
3. Seleziona "New repository"
4. Compila i campi:
   - **Repository name**: `materiali-didattici` (o il nome che preferisci)
   - **Description**: "Materiali didattici Metodologie Operative"
   - Seleziona **Public**
   - ✅ Spunta "Add a README file"
5. Clicca su "Create repository"

### Passo 3: Caricare i File
1. Nel tuo repository, clicca su "Add file" → "Upload files"
2. Trascina questi file nella finestra:
   - index.html
   - biennio.html
   - terzo.html
   - quarto.html
   - quinto.html
   - style.css
   - materiali.js
   - materiali.json
3. Scrivi un messaggio tipo: "Caricamento iniziale del sito"
4. Clicca su "Commit changes"

### Passo 4: Creare le Cartelle per i Materiali
1. Nel repository, clicca su "Add file" → "Create new file"
2. Nel campo del nome file, scrivi: `materiali/biennio/.gitkeep`
3. Clicca su "Commit changes"
4. Ripeti per le altre cartelle:
   - `materiali/terzo/.gitkeep`
   - `materiali/quarto/.gitkeep`
   - `materiali/quinto/.gitkeep`

### Passo 5: Attivare GitHub Pages
1. Nel tuo repository, vai su "Settings" (Impostazioni)
2. Nel menu a sinistra, clicca su "Pages"
3. Nella sezione "Source":
   - Seleziona **Branch: main**
   - Seleziona **/ (root)**
4. Clicca su "Save"
5. Aspetta 1-2 minuti

### Passo 6: Trovare l'URL del Tuo Sito
Dopo qualche minuto, vedrai un messaggio tipo:
**"Your site is live at https://tuonomeutente.github.io/materiali-didattici/"**

Questo è il tuo sito! Condividilo con i tuoi studenti.

---

## 📝 PARTE 2: AGGIUNGERE UN NUOVO MATERIALE

### OPZIONE A: Via Interfaccia Web GitHub (PIÙ SEMPLICE)

#### Passo 1: Caricare il File PDF (o altro)
1. Vai sul tuo repository GitHub
2. Naviga nella cartella corretta:
   - Per il biennio: `materiali/biennio/`
   - Per il terzo: `materiali/terzo/`
   - Per il quarto: `materiali/quarto/`
   - Per il quinto: `materiali/quinto/`
3. Clicca su "Add file" → "Upload files"
4. Carica il tuo file PDF
5. Scrivi un messaggio tipo: "Aggiunto materiale X"
6. Clicca su "Commit changes"

#### Passo 2: Aggiornare il File materiali.json
1. Nel repository, clicca sul file `materiali.json`
2. Clicca sull'icona della matita (✏️) in alto a destra per modificare
3. Aggiungi il nuovo materiale nella sezione corretta

**FORMATO DA COPIARE E INCOLLARE:**

```json
{
  "titolo": "Nome del tuo materiale",
  "file": "materiali/ANNO/nomefile.pdf",
  "descrizione": "Breve descrizione del contenuto",
  "data": "2025-10-06"
}
```

**ESEMPIO COMPLETO per il Biennio:**

```json
{
  "biennio": [
    {
      "titolo": "Introduzione ai Servizi Sociosanitari",
      "file": "materiali/biennio/introduzione.pdf",
      "descrizione": "Panoramica generale dei servizi sociosanitari in Italia",
      "data": "2025-10-06"
    },
    {
      "titolo": "Tecniche di Comunicazione",
      "file": "materiali/biennio/comunicazione.pdf",
      "descrizione": "Tecniche base per la comunicazione efficace",
      "data": "2025-10-05"
    }
  ],
  "terzo": [],
  "quarto": [],
  "quinto": []
}
```

**⚠️ ATTENZIONE:**
- Ogni materiale deve essere separato da una **virgola** (,)
- L'ULTIMO materiale di una sezione **NON ha la virgola**
- Controlla che le parentesi graffe { } siano corrette
- La data deve essere nel formato: YYYY-MM-DD (es: 2025-10-06)
- Il percorso del file deve corrispondere a dove l'hai caricato

4. Dopo aver modificato, scrivi un messaggio tipo: "Aggiunto nuovo materiale"
5. Clicca su "Commit changes"

#### Passo 3: Verifica
Dopo 1-2 minuti, vai sul tuo sito e ricarica la pagina (F5).
Il nuovo materiale dovrebbe comparire!

---

## 🎯 ESEMPI PRATICI

### Esempio 1: Aggiungere il Primo Materiale al Biennio

**Prima** (file vuoto):
```json
{
  "biennio": [],
  "terzo": [],
  "quarto": [],
  "quinto": []
}
```

**Dopo**:
```json
{
  "biennio": [
    {
      "titolo": "Lezione 1 - Introduzione",
      "file": "materiali/biennio/lezione1.pdf",
      "descrizione": "Introduzione al corso",
      "data": "2025-10-06"
    }
  ],
  "terzo": [],
  "quarto": [],
  "quinto": []
}
```

### Esempio 2: Aggiungere un Secondo Materiale

**Prima**:
```json
{
  "biennio": [
    {
      "titolo": "Lezione 1 - Introduzione",
      "file": "materiali/biennio/lezione1.pdf",
      "descrizione": "Introduzione al corso",
      "data": "2025-10-06"
    }
  ],
  "terzo": [],
  "quarto": [],
  "quinto": []
}
```

**Dopo** (nota la virgola dopo il primo materiale):
```json
{
  "biennio": [
    {
      "titolo": "Lezione 1 - Introduzione",
      "file": "materiali/biennio/lezione1.pdf",
      "descrizione": "Introduzione al corso",
      "data": "2025-10-06"
    },
    {
      "titolo": "Lezione 2 - I Servizi Territoriali",
      "file": "materiali/biennio/lezione2.pdf",
      "descrizione": "Panoramica sui servizi territoriali",
      "data": "2025-10-13"
    }
  ],
  "terzo": [],
  "quarto": [],
  "quinto": []
}
```

### Esempio 3: Materiali in Più Anni

```json
{
  "biennio": [
    {
      "titolo": "Manuale Base",
      "file": "materiali/biennio/manuale.pdf",
      "descrizione": "Manuale per il biennio",
      "data": "2025-10-06"
    }
  ],
  "terzo": [
    {
      "titolo": "Legislazione Sociale",
      "file": "materiali/terzo/legislazione.pdf",
      "descrizione": "Normativa dei servizi sociali",
      "data": "2025-10-08"
    }
  ],
  "quarto": [],
  "quinto": []
}
```

---

## 🆘 RISOLUZIONE PROBLEMI

### Il sito non si vede
- Aspetta 2-3 minuti dopo aver fatto modifiche
- Controlla che GitHub Pages sia attivato (Settings → Pages)
- Prova a ricaricare la pagina con CTRL+F5 (o CMD+R su Mac)

### I materiali non compaiono
- Controlla che il file materiali.json sia valido:
  - Tutte le virgole al posto giusto
  - Parentesi graffe corrette
  - Nessuno spazio dopo l'ultima virgola
- Verifica il percorso del file (deve corrispondere a dove l'hai caricato)

### Errore nel JSON
- Copia il contenuto del tuo materiali.json
- Vai su https://jsonlint.com
- Incolla il tuo JSON e clicca "Validate JSON"
- Correggi gli errori indicati

---

## 📋 CHECKLIST RAPIDA PER AGGIUNGERE MATERIALI

- [ ] Carica il file PDF nella cartella giusta (materiali/ANNO/)
- [ ] Apri materiali.json
- [ ] Copia il template del materiale
- [ ] Modifica titolo, file, descrizione, data
- [ ] Controlla le virgole (,)
- [ ] Salva con "Commit changes"
- [ ] Aspetta 1-2 minuti
- [ ] Ricarica il sito e verifica

---

## 🎓 SUGGERIMENTI

1. **Nomi dei file**: Usa nomi semplici senza spazi
   - ✅ BUONO: `lezione-1.pdf`, `introduzione.pdf`
   - ❌ CATTIVO: `Lezione 1 (versione finale).pdf`

2. **Descrizioni**: Sii chiaro e conciso
   - ✅ BUONO: "Appunti sulla comunicazione non verbale"
   - ❌ CATTIVO: "File"

3. **Date**: Usa sempre il formato YYYY-MM-DD
   - ✅ BUONO: `2025-10-06`
   - ❌ CATTIVO: `06/10/2025` o `6 ottobre 2025`

4. **Organizzazione**: Puoi creare sottocartelle:
   - `materiali/biennio/modulo1/lezione1.pdf`
   - Ricorda di aggiornare il percorso nel JSON!

---

## 📞 SUPPORTO

Se hai problemi o domande, puoi:
1. Rivedere questa guida
2. Controllare su https://docs.github.com/pages
3. Fare una prova con un solo materiale prima di caricarne molti

**Buon lavoro! 🚀**
