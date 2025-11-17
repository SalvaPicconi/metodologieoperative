# 📍 DOVE METTERE I FILE SU GITHUB
## Guida Visuale Passo-Passo

---

## 🎯 REPOSITORY GITHUB

URL: `https://github.com/salvapicconi/metodologieoperative`

---

## 📂 STRUTTURA FINALE (DOPO)

```
metodologieoperative/          ← Repository root
│
├── 📄 index.html             ← DA MODIFICARE (già esiste)
├── 📄 manifest.json          ← ✨ NUOVO (root)
├── 📄 service-worker.js      ← ✨ NUOVO (root)  
├── 📄 offline.html           ← ✨ NUOVO (root)
│
├── 📁 icons/                 ← ✨ NUOVA CARTELLA
│   ├── icon-72x72.png
│   ├── icon-96x96.png
│   ├── icon-128x128.png
│   ├── icon-144x144.png
│   ├── icon-152x152.png
│   ├── icon-192x192.png
│   ├── icon-384x384.png
│   └── icon-512x512.png
│
└── ... (tutti i tuoi file esistenti)
```

---

## 🚀 PROCEDURA SU GITHUB

### **PARTE 1: CARICA FILE NELLA ROOT** ⏱️ 5 min

#### 1️⃣ Vai al repository
```
https://github.com/salvapicconi/metodologieoperative
```

#### 2️⃣ Clicca "Add file" → "Upload files"
![](screenshot-upload.png)

#### 3️⃣ Trascina questi 3 file:
- ✅ `manifest.json`
- ✅ `service-worker.js`
- ✅ `offline.html`

#### 4️⃣ Scrivi messaggio commit:
```
Aggiunti file PWA per installazione app
```

#### 5️⃣ Clicca "Commit changes"

✅ **FATTO! File nella root!**

---

### **PARTE 2: CREA CARTELLA ICONS** ⏱️ 5 min

#### 1️⃣ Clicca "Add file" → "Create new file"

#### 2️⃣ Nel campo "Name your file..." scrivi:
```
icons/README.md
```
(scrivendo `icons/` GitHub crea automaticamente la cartella!)

#### 3️⃣ Nel contenuto scrivi:
```
# Icone PWA
Icone per l'installazione dell'app
```

#### 4️⃣ Commit changes

✅ **Cartella icons creata!**

---

### **PARTE 3: CARICA LE ICONE** ⏱️ 3 min

#### 1️⃣ Entra nella cartella icons appena creata
Clicca su: `icons/`

#### 2️⃣ Clicca "Add file" → "Upload files"

#### 3️⃣ Trascina TUTTE le 8 icone:
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

#### 4️⃣ Commit: "Aggiunte icone PWA"

✅ **Icone caricate!**

---

### **PARTE 4: MODIFICA INDEX.HTML** ⏱️ 10 min

#### 1️⃣ Torna alla root del repository
Clicca su: `metodologieoperative` (in alto)

#### 2️⃣ Trova e clicca su: `index.html`

#### 3️⃣ Clicca sull'icona **matita** (Edit this file)

#### 4️⃣ Trova la sezione `<head>`

Cerca questa riga:
```html
<head>
```

Subito DOPO questa riga, aggiungi:

```html
<!-- PWA Meta Tags -->
<meta name="theme-color" content="#4A90E2">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="MetOp Lab">
<meta name="mobile-web-app-capable" content="yes">

<!-- PWA Manifest -->
<link rel="manifest" href="/metodologieoperative/manifest.json">

<!-- PWA Icons -->
<link rel="apple-touch-icon" sizes="192x192" href="/metodologieoperative/icons/icon-192x192.png">
<link rel="icon" type="image/png" sizes="32x32" href="/metodologieoperative/icons/icon-72x72.png">
```

#### 5️⃣ Trova la chiusura `</body>`

Cerca questa riga verso la fine del file:
```html
</body>
```

Subito PRIMA di questa riga, aggiungi tutto il contenuto del file:
**`codice-per-index.html`** che ti ho dato

(È il codice JavaScript lungo, copialo interamente!)

#### 6️⃣ Clicca "Commit changes"
Messaggio: "Integrazione PWA completa"

✅ **INDEX.HTML MODIFICATO!**

---

## 🎯 VERIFICA FINALE

Dopo il commit, la struttura deve essere:

```
https://github.com/salvapicconi/metodologieoperative

📂 Root directory:
  ✅ manifest.json
  ✅ service-worker.js  
  ✅ offline.html
  ✅ index.html (modificato)
  
📂 icons/:
  ✅ icon-72x72.png
  ✅ icon-96x96.png
  ✅ icon-128x128.png
  ✅ icon-144x144.png
  ✅ icon-152x152.png
  ✅ icon-192x192.png
  ✅ icon-384x384.png
  ✅ icon-512x512.png
```

---

## ⏱️ ATTENDI DEPLOY

GitHub Pages impiega 2-5 minuti per aggiornare.

Controlla stato:
1. Settings (ingranaggio)
2. Pages (menu sinistra)
3. Vedi "Your site is live at..."

---

## 🧪 TESTA DA SMARTPHONE

### Android:
1. Apri Chrome
2. Vai su: `https://salvapicconi.github.io/metodologieoperative/`
3. Dovresti vedere bottone **"📱 Installa App"** in basso a destra!
4. Se non appare subito, aspetta 10 secondi

### iOS:
1. Apri Safari
2. Vai su: `https://salvapicconi.github.io/metodologieoperative/`
3. Tocca condividi (□↑)
4. Cerca "Aggiungi a Home"

---

## ✅ CHECKLIST RAPIDA

Prima di iniziare, scarica tutti i file:

- [ ] manifest.json
- [ ] service-worker.js
- [ ] offline.html
- [ ] codice-per-index.html
- [ ] Cartella icons/ con 8 file PNG

Poi su GitHub:

- [ ] Caricati 3 file nella root
- [ ] Creata cartella icons/
- [ ] Caricate 8 icone nella cartella
- [ ] Modificato index.html (head + body)
- [ ] Atteso deploy (2-5 min)
- [ ] Testato da smartphone

---

## 🆘 PROBLEMI COMUNI

### "Non vedo il bottone Installa"
- Aspetta 30 secondi dopo caricamento
- Controlla DevTools (F12) → Console per errori
- Verifica percorsi file in manifest.json

### "404 su manifest.json"
- File deve essere nella ROOT (non in sottocartella)
- URL deve essere: `/metodologieoperative/manifest.json`

### "Icone non si vedono"
- Verifica cartella si chiami esattamente `icons`
- Nomi file: `icon-72x72.png` (con trattini, non underscore)

---

## 📞 SERVE AIUTO?

Fammi vedere screenshot della struttura file su GitHub e ti dico se è corretto!

---

**Creato per Prof. Picconi**
Novembre 2025
