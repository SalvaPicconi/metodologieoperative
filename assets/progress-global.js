import { Progress } from './progress.js';

console.log('✅ progress-global attivo');

// Rileva ID della pagina (meta o path)
const PAGE_ID = document.querySelector('meta[name="page-id"]')?.content || location.pathname;
let studentLabel = null;

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

  // etichetta studente attivo
  studentLabel = document.createElement('div');
  studentLabel.id = 'studentLabel';
  studentLabel.style.cssText = 'position:fixed;top:8px;right:16px;background:#0ea5e9;color:#fff;padding:4px 10px;border-radius:6px;font-size:14px;z-index:9999;';
  document.body.appendChild(studentLabel);
  updateStudentLabel();
});

function updateStudentLabel() {
  if (!studentLabel) return;
  const c = localStorage.getItem('mo:class');
  const s = localStorage.getItem('mo:code');
  studentLabel.textContent = c && s ? `Classe ${c} • Codice ${s}` : 'Studente non identificato';
}

function collectData() {
  const d = {};
  document.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.name) d[el.name] = el.value;
  });
  return d;
}

function restoreData(saved) {
  if (!saved) return;
  for (const [name, value] of Object.entries(saved)) {
    const el = document.querySelector(`[name="${name}"]`);
    if (el) el.value = value;
  }
}

// carica automaticamente i dati salvati
async function loadAndRestore() {
  try {
    const saved = await Progress.load(PAGE_ID);
    restoreData(saved);
  } catch (error) {
    console.error('Errore caricamento progressi:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadAndRestore();
});

// gestisci click su salva
document.addEventListener('click', async (event) => {
  if (event.target.matches('[data-save-progress]')) {
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '⏳ Salvataggio...';
    try {
      await Progress.save(collectData(), PAGE_ID);
      alert('Progressi salvati!');
    } catch (error) {
      alert('Errore salvataggio: ' + error.message);
    } finally {
      button.textContent = originalText;
    }
  }
});

// pulsante cambio studente
document.addEventListener('click', (event) => {
  if (event.target.matches('#resetStudent')) {
    if (confirm('Vuoi cambiare studente?')) {
      localStorage.removeItem('mo:class');
      localStorage.removeItem('mo:code');
      sessionStorage.removeItem('mo:class');
      sessionStorage.removeItem('mo:code');
      location.reload();
    }
  }
});

// Aggiorna UI quando cambia identità
window.addEventListener('mo:identity-change', () => {
  updateStudentLabel();
  loadAndRestore();
});
