import { Progress } from './progress.js';

console.log('✅ progress-global attivo');

// Rileva ID della pagina (meta o path)
const PAGE_ID = document.querySelector('meta[name="page-id"]')?.content || location.pathname;

// Crea pulsanti se non esistono già
document.addEventListener('DOMContentLoaded', () => {
  if (!document.querySelector('[data-save-progress]')) {
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 Salva progressi';
    saveBtn.id = 'saveProgressBtn';
    saveBtn.setAttribute('data-save-progress', '');
    saveBtn.style.cssText = 'position:fixed;right:16px;bottom:16px;padding:10px 14px;border-radius:10px;border:0;background:#0ea5e9;color:#fff;box-shadow:0 6px 14px rgba(0,0,0,.15);z-index:9999;cursor:pointer;';
    document.body.appendChild(saveBtn);
  }
  if (!document.querySelector('#resetStudent')) {
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🔄 Cambia studente';
    resetBtn.id = 'resetStudent';
    resetBtn.style.cssText = 'position:fixed;left:16px;bottom:16px;padding:8px 12px;border-radius:10px;border:0;background:#f97316;color:white;box-shadow:0 6px 14px rgba(0,0,0,.15);z-index:9999;cursor:pointer;';
    document.body.appendChild(resetBtn);
  }
});

function collectData() {
  const d = {};
  document.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.name) d[el.name] = el.value;
  });
  return d;
}
function restoreData(s) {
  if (!s) return;
  for (const [k,v] of Object.entries(s)) {
    const el = document.querySelector(`[name="${k}"]`);
    if (el) el.value = v;
  }
}

// carica automaticamente i dati salvati
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const saved = await Progress.load(PAGE_ID);
    restoreData(saved);
  } catch (e) {
    console.error('Errore caricamento progressi:', e);
  }
});

// gestisci click su salva
document.addEventListener('click', async (e) => {
  if (e.target.matches('[data-save-progress]')) {
    e.target.textContent = '⏳ Salvataggio...';
    try {
      await Progress.save(collectData(), PAGE_ID);
      alert('Progressi salvati!');
    } catch (err) {
      alert('Errore salvataggio: ' + err.message);
    } finally {
      e.target.textContent = '💾 Salva progressi';
    }
  }
});

// pulsante cambio studente
document.addEventListener('click', (e) => {
  if (e.target.matches('#resetStudent')) {
    if (confirm('Vuoi cambiare studente?')) {
      localStorage.removeItem('mo:class');
      localStorage.removeItem('mo:code');
      location.reload();
    }
  }
});

// etichetta studente attivo
document.addEventListener('DOMContentLoaded', () => {
  const c = localStorage.getItem('mo:class');
  const s = localStorage.getItem('mo:code');
  const label = document.createElement('div');
  label.id = 'studentLabel';
  label.style.cssText = 'position:fixed;top:8px;right:16px;background:#0ea5e9;color:#fff;padding:4px 10px;border-radius:6px;font-size:14px;z-index:9999;';
  label.textContent = c && s ? `Classe ${c} • Codice ${s}` : 'Studente non identificato';
  document.body.appendChild(label);
});
