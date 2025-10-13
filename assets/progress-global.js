import { Progress } from './progress.js';

const hasWindow = typeof window !== 'undefined';
const DEBUG = (() => {
  if (!hasWindow) return false;
  try {
    return !!localStorage.getItem('mo-debug');
  } catch (error) {
    return false;
  }
})();

function debugLog(...args) {
  if (DEBUG) {
    console.log('[progress-global]', ...args);
  }
}

debugLog('✅ progress-global attivo');

const STORAGE_KEYS = {
  classCode: 'mo:class',
  studentCode: 'mo:code'
};

// Rileva ID della pagina (meta o path)
const PAGE_ID = (() => {
  const meta = document.querySelector('meta[name="page-id"]');
  return meta && meta.content ? meta.content : location.pathname;
})();

let saveButtonEl = null;
let resetButtonEl = null;
let studentLabelEl = null;
let uiObserver = null;

function ensureSaveButton() {
  if (saveButtonEl && document.body.contains(saveButtonEl)) return;
  saveButtonEl = document.querySelector('[data-save-progress]');
  if (!saveButtonEl) {
    saveButtonEl = document.createElement('button');
    saveButtonEl.textContent = '💾 Salva progressi';
    saveButtonEl.id = 'saveProgressBtn';
    saveButtonEl.setAttribute('data-save-progress', '');
    saveButtonEl.style.cssText = 'position:fixed;right:16px;bottom:16px;padding:10px 14px;border-radius:10px;border:0;background:#0ea5e9;color:#fff;box-shadow:0 6px 14px rgba(0,0,0,.15);z-index:2147483647;cursor:pointer;pointer-events:auto;';
    document.body.appendChild(saveButtonEl);
    debugLog('➕ creato pulsante Salva progressi');
  }
}

function ensureResetButton() {
  if (resetButtonEl && document.body.contains(resetButtonEl)) return;
  resetButtonEl = document.querySelector('#resetStudent');
  if (!resetButtonEl) {
    resetButtonEl = document.createElement('button');
    resetButtonEl.textContent = '🔄 Cambia studente';
    resetButtonEl.id = 'resetStudent';
    resetButtonEl.style.cssText = 'position:fixed;left:16px;bottom:16px;padding:10px 14px;border-radius:10px;border:0;background:#f97316;color:white;box-shadow:0 6px 14px rgba(0,0,0,.15);z-index:2147483647;cursor:pointer;pointer-events:auto;';
    document.body.appendChild(resetButtonEl);
    debugLog('➕ creato pulsante Cambia studente');
  }
}

function getStoredIdentity() {
  try {
    const classCode = localStorage.getItem(STORAGE_KEYS.classCode);
    const studentCode = localStorage.getItem(STORAGE_KEYS.studentCode);
    if (classCode && studentCode) {
      return {
        classCode,
        studentCode
      };
    }
  } catch (error) {
    console.warn('[Progress] Impossibile leggere identity dal localStorage:', error);
  }
  return null;
}

function ensureStudentLabel() {
  if (!studentLabelEl || !document.body.contains(studentLabelEl)) {
    studentLabelEl = document.getElementById('studentLabel');
  }
  if (!studentLabelEl) {
    studentLabelEl = document.createElement('div');
    studentLabelEl.id = 'studentLabel';
    studentLabelEl.style.cssText = 'position:fixed;top:8px;right:16px;background:#0ea5e9;color:#fff;padding:4px 10px;border-radius:6px;font-size:14px;z-index:2147483647;pointer-events:auto;';
    document.body.appendChild(studentLabelEl);
    debugLog('➕ creata etichetta studente');
  }
  updateStudentLabel();
}

function updateStudentLabel() {
  if (!studentLabelEl) return;
  const identity = getStoredIdentity();
  studentLabelEl.textContent = identity
    ? `Classe ${identity.classCode} • Codice ${identity.studentCode}`
    : 'Studente non identificato';
}

function ensureUI() {
  if (!document.body) return;
  ensureSaveButton();
  ensureResetButton();
  ensureStudentLabel();
}

function observeUI() {
  if (!document.body || uiObserver) return;
  uiObserver = new MutationObserver(() => {
    debugLog('♻️ reiniezione UI (mutation)');
    ensureUI();
  });
  // osserva tutto il sottoalbero per re-iniettare i bottoni quando il DOM viene rimpiazzato
  uiObserver.observe(document.body, { childList: true, subtree: true });
}

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

async function loadProgress() {
  try {
    const saved = await Progress.load(PAGE_ID);
    restoreData(saved);
  } catch (e) {
    console.error('Errore caricamento progressi:', e);
  } finally {
    updateStudentLabel();
  }
}

// carica automaticamente i dati salvati
function initLoad() {
  loadProgress();
}

function init() {
  ensureUI();
  observeUI();
  initLoad();

  // fallback rechecks in caso di caricamenti dinamici prolungati
  let attempts = 0;
  const interval = setInterval(() => {
    ensureUI();
    attempts += 1;
    debugLog('♻️ reiniezione UI (timer)', {
      attempt: attempts,
      save: !!saveButtonEl,
      reset: !!resetButtonEl,
      label: !!studentLabelEl
    });
    if (attempts >= 40 || (saveButtonEl && resetButtonEl && studentLabelEl)) {
      debugLog('🛑 stop tentativi reiniezione', { attempt: attempts });
      clearInterval(interval);
    }
  }, 250);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEYS.classCode || event.key === STORAGE_KEYS.studentCode) {
    debugLog('🔄 storage event rilevato', event.key, event.newValue);
    ensureStudentLabel();
  }
});

window.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    debugLog('👁️ visibilitychange, ripristino UI');
    ensureUI();
    updateStudentLabel();
  }
});

window.addEventListener('focus', () => {
  debugLog('🎯 window focus, ripristino UI');
  ensureUI();
  updateStudentLabel();
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
window.addEventListener('mo:identity-change', (event) => {
  debugLog('🔎 identity-change ricevuto', event?.detail);
  ensureStudentLabel();
});

if (hasWindow) {
  const modDebug = window.MODebug || {};
  const legacyShowIdentity = modDebug.showIdentity;

  modDebug.enable = () => {
    try {
      localStorage.setItem('mo-debug', '1');
      console.info('[progress-global] Debug abilitato. Ricarica la pagina per attivarlo.');
    } catch (error) {
      console.warn('[progress-global] Impossibile salvare la preferenza di debug:', error);
    }
  };

  modDebug.disable = () => {
    try {
      localStorage.removeItem('mo-debug');
      console.info('[progress-global] Debug disabilitato. Ricarica la pagina per disattivarlo.');
    } catch (error) {
      console.warn('[progress-global] Impossibile rimuovere la preferenza di debug:', error);
    }
  };

  modDebug.showIdentity = () => {
    const identity = getStoredIdentity();
    if (identity) {
      console.info('[progress-global] 👤 Studente attivo:', identity.classCode, identity.studentCode);
    } else {
      console.info('[progress-global] ❌ Nessuna identità salvata');
    }
    if (typeof legacyShowIdentity === 'function') {
      try {
        return legacyShowIdentity();
      } catch (error) {
        debugLog('⚠️ errore showIdentity legacy', error);
      }
    }
    return identity;
  };

  window.MODebug = modDebug;
}
