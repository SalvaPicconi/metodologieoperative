# 📱 GUIDA COMPLETA INSTALLAZIONE PWA
## Metodologie Operative Lab - IIS Meucci Mattei

---

## 🎯 COSA OTTERRAI

✅ **App installabile** su smartphone Android/iOS
✅ **Funzionamento offline** (dopo prima visita)
✅ **Icona su home screen** come app nativa
✅ **Notifiche push** per nuovi contenuti
✅ **Aggiornamenti automatici**
✅ **Esperienza full-screen** senza browser

---

## 📦 COSA HAI RICEVUTO

Hai 5 file pronti all'uso:

1. ✅ `manifest.json` - Configurazione app
2. ✅ `service-worker.js` - Funzionalità offline
3. ✅ `offline.html` - Pagina modalità offline
4. ✅ `codice-per-index.html` - Codice da inserire
5. ✅ `genera-icone-pwa.py` - Script per creare icone

---

## 🚀 INSTALLAZIONE STEP-BY-STEP

### **FASE 1: PREPARA LE ICONE** ⏱️ 5 minuti

#### Opzione A: Genera icone con lo script Python

```bash
# 1. Installa Pillow (se non l'hai già)
pip install Pillow

# 2. Esegui lo script
python3 genera-icone-pwa.py

# 3. Scegli opzione 1 (crea con iniziali)
# Oppure opzione 2 (usa tua immagine)

# 4. Troverai la cartella "icons" con tutte le dimensioni
```

#### Opzione B: Usa tool online (più veloce)

1. Vai su: https://www.pwabuilder.com/imageGenerator
2. Carica un'immagine 512x512 (es. logo scuola)
3. Clicca "Generate"
4. Scarica lo ZIP con tutte le icone

#### Opzione C: Icone generiche temporanee

Se vuoi testare subito, usa questa emoji come icona:
1. Vai su: https://favicon.io/emoji-favicons/
2. Cerca emoji "📚" o "🎓"
3. Scarica il pacchetto
4. Rinomina i file secondo le dimensioni richieste

---

### **FASE 2: CARICA FILE SU GITHUB** ⏱️ 10 minuti

#### 1️⃣ Accedi al repository

```
https://github.com/salvapicconi/metodologieoperative
```

#### 2️⃣ Carica i file principali (root)

Nella **cartella principale** del repository, aggiungi:
- ✅ `manifest.json`
- ✅ `service-worker.js`
- ✅ `offline.html`

**Come fare:**
1. Clicca su "Add file" → "Upload files"
2. Trascina i 3 file
3. Scrivi messaggio commit: "Aggiunti file PWA"
4. Clicca "Commit changes"

#### 3️⃣ Crea cartella icons

1. Clicca su "Add file" → "Create new file"
2. Scrivi: `icons/icon-72x72.png`
3. Questo crea automaticamente la cartella
4. Carica **tutte le 8 icone** nella cartella `icons/`:
   - icon-72x72.png
   - icon-96x96.png
   - icon-128x128.png
   - icon-144x144.png
   - icon-152x152.png
   - icon-192x192.png
   - icon-384x384.png
   - icon-512x512.png

---

### **FASE 3: MODIFICA index.html** ⏱️ 15 minuti

#### 1️⃣ Apri il file index.html del tuo sito

Nel repository GitHub:
1. Clicca su `index.html`
2. Clicca sull'icona matita (Edit)

#### 2️⃣ Aggiungi il codice nella sezione `<head>`

Trova la riga `<head>` e **subito dopo** incolla:

```html
<!-- Meta tag per PWA -->
<meta name="theme-color" content="#4A90E2">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="MetOp Lab">
<meta name="mobile-web-app-capable" content="yes">

<!-- Link al manifest -->
<link rel="manifest" href="/metodologieoperative/manifest.json">

<!-- Icone per iOS -->
<link rel="apple-touch-icon" sizes="192x192" href="/metodologieoperative/icons/icon-192x192.png">
<link rel="icon" type="image/png" sizes="32x32" href="/metodologieoperative/icons/icon-72x72.png">
```

#### 3️⃣ Aggiungi il codice JavaScript prima di `</body>`

Trova la riga `</body>` (alla fine del file) e **subito prima** incolla tutto il contenuto del file `codice-per-index.html`.

#### 4️⃣ Salva le modifiche

1. Scrivi messaggio commit: "Integrazione PWA completa"
2. Clicca "Commit changes"

---

### **FASE 4: ATTENDI DEPLOY** ⏱️ 2-5 minuti

GitHub Pages aggiornerà automaticamente il sito.
Controlla lo stato su: Settings → Pages

---

### **FASE 5: TESTA LA PWA** ⏱️ 5 minuti

#### Su Android (Chrome):

1. Apri: https://salvapicconi.github.io/metodologieoperative/
2. Dovresti vedere un popup "Installa app"
3. Oppure: Menu (⋮) → "Installa app"
4. Conferma installazione
5. L'icona apparirà nella home screen! 🎉

#### Su iPhone (Safari):

1. Apri: https://salvapicconi.github.io/metodologieoperative/
2. Tocca icona condivisione (□↑)
3. Scorri e seleziona "Aggiungi a Home"
4. Conferma
5. L'icona apparirà nella home screen! 🎉

#### Su Desktop (Chrome/Edge):

1. Apri il sito
2. Guarda nella barra URL (icona + o computer)
3. Clicca "Installa Metodologie Operative Lab"
4. Ora puoi aprirla come app desktop!

---

## 🔍 VERIFICA FUNZIONALITÀ

### ✅ Checklist Test:

1. **Installazione:**
   - [ ] Bottone "Installa App" visibile?
   - [ ] Installazione completata?
   - [ ] Icona presente su home screen?

2. **Offline Mode:**
   - [ ] Apri l'app installata
   - [ ] Attiva modalità aereo
   - [ ] Ricarica la pagina → dovrebbe funzionare!
   - [ ] Appare messaggio "Sei Offline"?

3. **Notifiche:**
   - [ ] Dopo 30 secondi, appare richiesta permesso notifiche?
   - [ ] Se accetti, ricevi notifica di benvenuto?

4. **Aggiornamenti:**
   - [ ] Fai una modifica al sito
   - [ ] Riapri l'app dopo deploy
   - [ ] Appare notifica "Aggiorna disponibile"?

5. **Performance:**
   - [ ] L'app si apre velocemente?
   - [ ] Navigazione fluida?
   - [ ] Punteggi salvati correttamente?

---

## 🐛 RISOLUZIONE PROBLEMI

### ❌ "Bottone installa non appare"

**Causa:** File manifest non trovato o errato

**Soluzione:**
1. Apri DevTools (F12)
2. Vai su "Application" → "Manifest"
3. Verifica errori
4. Controlla percorso: `/metodologieoperative/manifest.json`

---

### ❌ "Icone non si vedono"

**Causa:** Percorsi icone errati

**Soluzione:**
1. Verifica che le icone siano in `/metodologieoperative/icons/`
2. Apri direttamente: https://salvapicconi.github.io/metodologieoperative/icons/icon-192x192.png
3. Se dà 404, il percorso è sbagliato

---

### ❌ "Offline non funziona"

**Causa:** Service Worker non registrato

**Soluzione:**
1. Apri DevTools → "Application" → "Service Workers"
2. Verifica che sia "Activated and running"
3. Se no, controlla Console per errori JavaScript
4. Prova "Update on reload" e ricarica

---

### ❌ "iOS non installa"

**Causa:** Safari richiede HTTPS (GitHub Pages lo ha già)

**Soluzione:**
1. Assicurati di usare Safari (non Chrome su iOS)
2. Verifica URL inizi con `https://`
3. Prova modalità "Richiesta Desktop"

---

## 📊 STRUMENTI DI TESTING

### 🔧 Lighthouse (Chrome DevTools)

1. Apri il sito su Chrome Desktop
2. F12 → Tab "Lighthouse"
3. Seleziona "Progressive Web App"
4. Clicca "Generate report"
5. **Obiettivo: Score > 90/100**

### 🌐 PWA Builder Validator

1. Vai su: https://www.pwabuilder.com/
2. Inserisci: `https://salvapicconi.github.io/metodologieoperative/`
3. Clicca "Start"
4. Controlla risultati e suggerimenti

---

## 🎓 USO PER GLI STUDENTI

### 📱 Guida rapida da condividere:

**Testo da postare su Google Classroom:**

```
🚀 METODOLOGIE OPERATIVE LAB - ORA È UN'APP!

Puoi installare il nostro laboratorio virtuale come app sul tuo smartphone:

📱 ANDROID:
1. Apri Chrome
2. Vai su https://salvapicconi.github.io/metodologieoperative/
3. Tocca "Installa App" (apparirà automaticamente)
4. Troverai l'icona nella home!

🍎 IPHONE:
1. Apri Safari
2. Vai su https://salvapicconi.github.io/metodologieoperative/
3. Tocca il pulsante condivisione (□↑)
4. Seleziona "Aggiungi a Home"
5. Troverai l'icona nella home!

✨ VANTAGGI:
✅ Funziona anche senza internet (dopo la prima volta)
✅ Si apre velocemente come un'app vera
✅ Salva i tuoi progressi automaticamente
✅ Ricevi notifiche per nuovi percorsi

💡 Se hai problemi, scrivimi!
```

---

## 📈 STATISTICHE E MONITORAGGIO

### Google Analytics (opzionale)

Per tracciare installazioni e utilizzo:

1. Aggiungi questo codice in `index.html` dopo il Service Worker:

```javascript
// Traccia installazione PWA
window.addEventListener('appinstalled', () => {
  gtag('event', 'pwa_installed', {
    'event_category': 'PWA',
    'event_label': 'Installazione completata'
  });
});

// Traccia prompt installazione mostrato
window.addEventListener('beforeinstallprompt', () => {
  gtag('event', 'pwa_prompt_shown', {
    'event_category': 'PWA',
    'event_label': 'Prompt installazione mostrato'
  });
});
```

---

## 🔄 AGGIORNAMENTI FUTURI

### Come aggiornare la PWA:

1. **Modifica i file** sul repository GitHub
2. **Cambia versione cache** in `service-worker.js`:
   ```javascript
   const CACHE_NAME = 'metop-lab-v2'; // Incrementa versione
   ```
3. **Commit e push**
4. Gli utenti riceveranno notifica "Aggiorna disponibile"

---

## 🎯 PROSSIMI PASSI

### Funzionalità avanzate da aggiungere:

1. **Badge Counter** (numero percorsi da completare)
2. **Share API** (condividi risultati)
3. **Background Sync** (salva progressi offline)
4. **Push Notifications** (avvisi nuovi contenuti)
5. **Shortcuts** (scorciatoie quick actions)

---

## 📞 SUPPORTO

### Hai bisogno di aiuto?

- 💬 **Gruppo Facebook:** Home care premium Italia
- 📧 **Email professionale:** [tua email]
- 🌐 **Sito:** dottpicconi.it (se ce l'hai)

---

## ✅ CHECKLIST FINALE

Prima di lanciare agli studenti:

- [ ] Tutti i file caricati su GitHub
- [ ] Icone caricate (8 dimensioni)
- [ ] Manifest.json funzionante
- [ ] Service Worker attivo
- [ ] Test installazione su Android
- [ ] Test installazione su iOS
- [ ] Test modalità offline
- [ ] Lighthouse score > 90
- [ ] Preparato messaggio per studenti

---

**CONGRATULAZIONI! 🎉**

Ora hai una Progressive Web App professionale per i tuoi studenti!

**Stima tempo totale:** ~30-45 minuti
**Difficoltà:** 🟢 Media (con questa guida)
**Risultato:** 🚀 Professionale

---

*Guida creata per Prof. Picconi - IIS Meucci Mattei*
*Versione 1.0 - Novembre 2025*
