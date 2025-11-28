import { Progress } from './progress.js';

console.log('✅ progress-global attivo');

const DEFAULT_CONFIG = {
  pathPrefixes: ['/metodologieoperative']
};

function resolveConfig() {
  const userConfig = window.MO_PROGRESS_CONFIG && typeof window.MO_PROGRESS_CONFIG === 'object'
    ? window.MO_PROGRESS_CONFIG
    : {};

  const merged = {
    ...DEFAULT_CONFIG,
    ...userConfig
  };

  const pathPrefixes = new Set(DEFAULT_CONFIG.pathPrefixes);
  if (Array.isArray(userConfig.pathPrefixes)) {
    userConfig.pathPrefixes.filter(Boolean).forEach(prefix => pathPrefixes.add(prefix));
  }
  merged.pathPrefixes = Array.from(pathPrefixes);
  window.MO_PROGRESS_CONFIG = merged;
  return merged;
}

const CONFIG = resolveConfig();

// Rileva ID della pagina (meta o path)
  const PAGE_ID = document.querySelector('meta[name="page-id"]')?.content || location.pathname;
  const IS_DISABLED = CONFIG.disabled === true;
  const HOME_URL = CONFIG.homeUrl || guessHomeUrl();
  const AUTO_SAVE_ENABLED = CONFIG.autoSave === true;
  const AUTO_SAVE_DEBOUNCE = typeof CONFIG.autoSaveDebounceMs === 'number' ? CONFIG.autoSaveDebounceMs : 6000;
  const AUTO_SAVE_MIN_INTERVAL = typeof CONFIG.autoSaveMinIntervalMs === 'number' ? CONFIG.autoSaveMinIntervalMs : 15000;
  const AUTO_SAVE_JITTER = typeof CONFIG.autoSaveJitterMs === 'number' ? CONFIG.autoSaveJitterMs : 3000;

  if (IS_DISABLED) {
    console.log('⏸️ progress tracking disattivato su questa pagina');
  } else {
  const PAGE_PATH = CONFIG.pagePath || PAGE_ID;
  const INPUT_SELECTOR = CONFIG.inputSelector || 'input, textarea, select';
  const LOCAL_FALLBACK_KEY = `mo:progress-local:${PAGE_PATH}`;
  let studentLabel = null;
  let saveBtnElement = null;
  let resetBtnElement = null;
  let isGuestMode = false;
  let homeLinkElement = null;
  let autoSaveTimer = null;
  let autoSaveInFlight = false;
  let lastAutoSave = 0;
  let lastSavedSnapshot = null;

  // Crea pulsanti se non esistono già
  document.addEventListener('DOMContentLoaded', () => {
    saveBtnElement = document.querySelector('[data-save-progress]');
    if (!saveBtnElement) {
      saveBtnElement = document.createElement('button');
      saveBtnElement.textContent = '💾 Salva progressi';
      saveBtnElement.id = 'saveProgressBtn';
      saveBtnElement.setAttribute('data-save-progress', '');
      saveBtnElement.style.cssText = 'position:fixed;right:16px;bottom:16px;padding:10px 14px;border-radius:10px;border:0;background:#0ea5e9;color:#fff;box-shadow:0 6px 14px rgba(0,0,0,.15);z-index:9999;cursor:pointer;';
      document.body.appendChild(saveBtnElement);
    }

    resetBtnElement = document.querySelector('#resetStudent');
    if (!resetBtnElement) {
      resetBtnElement = document.createElement('button');
      resetBtnElement.textContent = '🔄 Cambia studente';
      resetBtnElement.id = 'resetStudent';
      resetBtnElement.style.cssText = 'position:fixed;left:16px;bottom:16px;padding:8px 12px;border-radius:10px;border:0;background:#f97316;color:white;box-shadow:0 6px 14px rgba(0,0,0,.15);z-index:9999;cursor:pointer;';
      document.body.appendChild(resetBtnElement);
    }

    // etichetta studente attivo
    studentLabel = document.createElement('div');
    studentLabel.id = 'studentLabel';
    studentLabel.style.cssText = 'position:fixed;top:8px;right:16px;background:#0ea5e9;color:#fff;padding:4px 10px;border-radius:6px;font-size:14px;z-index:9999;';
    document.body.appendChild(studentLabel);

    if (!document.querySelector('.home-floating-link')) {
      homeLinkElement = document.createElement('a');
      homeLinkElement.href = HOME_URL;
      homeLinkElement.textContent = '🏠 Home';
      homeLinkElement.className = 'home-floating-link';
      homeLinkElement.title = 'Torna alla Home';
      document.body.appendChild(homeLinkElement);
    }

    isGuestMode = document.body?.dataset?.moGuest === 'true';
    updateSaveButtonsVisibility();
    updateStudentLabel();
  });

  function updateStudentLabel(detail) {
    if (!studentLabel) return;
    const detailData = detail || {};
    const isSuperMode = document.body?.dataset?.moSuper === 'true';
    if (isSuperMode) {
      const superClass = document.body?.dataset?.moSuperClass || detailData.classCode || '—';
      const superStudent = document.body?.dataset?.moSuperStudent || detailData.studentCode || '—';
      studentLabel.textContent = `Modalità docente · ${superClass} • ${superStudent}`;
      studentLabel.classList.add('super-mode');
      return;
    }
    studentLabel.classList.remove('super-mode');
    if (isGuestMode || detailData.guest) {
      studentLabel.textContent = 'Modalità ospite: progressi locali';
      return;
    }
    const c = detailData.classCode ?? localStorage.getItem('mo:class');
    const s = detailData.studentCode ?? localStorage.getItem('mo:code');
    studentLabel.textContent = c && s ? `Classe ${c} • Codice ${s}` : 'Studente non identificato';
  }

  function updateSaveButtonsVisibility() {
    if (saveBtnElement) {
      saveBtnElement.style.display = isGuestMode ? 'none' : 'inline-block';
    }
    if (resetBtnElement) {
      resetBtnElement.style.display = 'inline-block';
    }
  }

  function dispatchProgressRestored(data) {
    try {
      const detail = { pageId: PAGE_PATH, data };
      const target = typeof window !== 'undefined' ? window : document;
      if (!target) return;
      let event;
      if (typeof CustomEvent === 'function') {
        event = new CustomEvent('mo:progress-restored', { detail });
      } else if (target.createEvent) {
        event = target.createEvent('CustomEvent');
        event.initCustomEvent('mo:progress-restored', false, false, detail);
      }
      if (event && typeof target.dispatchEvent === 'function') {
        target.dispatchEvent(event);
      }
    } catch (error) {
      console.warn('Impossibile inviare evento di ripristino progressi:', error);
    }
  }

  function scheduleAutoSave(reason = 'input') {
    if (!AUTO_SAVE_ENABLED || IS_DISABLED || isGuestMode) return;
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    const jitter = AUTO_SAVE_JITTER ? Math.random() * AUTO_SAVE_JITTER : 0;
    autoSaveTimer = setTimeout(runAutoSave, AUTO_SAVE_DEBOUNCE + jitter);
  }

  async function runAutoSave() {
    autoSaveTimer = null;
    const payload = collectData();
    if (!payload || payload.__skipSave) return;
    const snapshot = JSON.stringify(payload);
    if (snapshot === lastSavedSnapshot) {
      return; // evita write identiche
    }

    const elapsed = Date.now() - lastAutoSave;
    if (elapsed < AUTO_SAVE_MIN_INTERVAL) {
      const jitter = AUTO_SAVE_JITTER ? Math.random() * AUTO_SAVE_JITTER : 0;
      autoSaveTimer = setTimeout(runAutoSave, AUTO_SAVE_MIN_INTERVAL - elapsed + jitter);
      return;
    }
    if (autoSaveInFlight) return;
    autoSaveInFlight = true;
    try {
      await Progress.save(payload, PAGE_PATH);
      lastAutoSave = Date.now();
      lastSavedSnapshot = snapshot;
      console.debug('[Progress] 💾 Salvataggio automatico completato');
    } catch (error) {
      console.warn('Errore salvataggio automatico progressi:', error);
      const savedLocally = saveLocalFallback(payload);
      if (savedLocally) {
        lastSavedSnapshot = snapshot;
        console.debug('[Progress] 💾 Salvataggio locale di fallback completato');
      }
    } finally {
      autoSaveInFlight = false;
    }
  }

function collectData() {
  const data = {};
  const processedRadio = new Set();
  const processedCheckbox = new Set();

  document.querySelectorAll(INPUT_SELECTOR).forEach(el => {
    const key = el.name || el.id;
    if (!key) return;

    if (el instanceof HTMLInputElement && el.type === 'radio') {
      if (processedRadio.has(key)) return;
      processedRadio.add(key);
      const radios = Array.from(document.getElementsByName(key))
        .filter(node => node instanceof HTMLInputElement && node.type === 'radio');
      const checked = radios.find(radio => radio.checked);
      data[key] = checked ? checked.value : null;
      return;
    }

    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (processedCheckbox.has(key)) return;
      processedCheckbox.add(key);
      const checkboxes = Array.from(document.getElementsByName(key))
        .filter(node => node instanceof HTMLInputElement && node.type === 'checkbox');
      if (checkboxes.length > 1) {
        data[key] = checkboxes
          .filter(cb => cb.checked)
          .map(cb => cb.value ?? 'on');
      } else {
        data[key] = el.checked;
      }
      return;
    }

    if (el instanceof HTMLSelectElement && el.multiple) {
      data[key] = Array.from(el.selectedOptions).map(opt => opt.value);
      return;
    }

    data[key] = el.value;
  });

  let result = data;
  if (typeof CONFIG.onBeforeSave === 'function') {
    try {
      const hookResponse = CONFIG.onBeforeSave(result);
      if (hookResponse && typeof hookResponse === 'object') {
        result = hookResponse;
      } else if (hookResponse !== undefined) {
        result = hookResponse;
      }
    } catch (error) {
      console.error('Errore durante onBeforeSave progress:', error);
    }
  }

  return result;
}

function saveLocalFallback(data) {
  try {
    const payload = { data, savedAt: new Date().toISOString() };
    localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn('Impossibile salvare localmente il fallback:', error);
    return false;
  }
}

function loadLocalFallback() {
  try {
    const raw = localStorage.getItem(LOCAL_FALLBACK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data || null;
  } catch (error) {
    console.warn('Impossibile leggere il fallback locale:', error);
    return null;
  }
}

function restoreData(saved) {
  if (!saved) {
    dispatchProgressRestored(null);
    return;
  }

  for (const [name, value] of Object.entries(saved)) {
    const elements = name ? Array.from(document.getElementsByName(name)) : [];

    if (elements.length > 0) {
      const first = elements[0];

      if (first instanceof HTMLInputElement && first.type === 'radio') {
        elements.forEach(radio => {
          radio.checked = value === null ? false : radio.value === value;
        });
        continue;
      }

      if (first instanceof HTMLInputElement && first.type === 'checkbox') {
        if (elements.length > 1) {
          const values = Array.isArray(value) ? value.map(val => String(val)) : [];
          elements.forEach(node => {
            const cb = node;
            const cbValue = cb.value ?? 'on';
            cb.checked = values.includes(cbValue);
          });
        } else {
          (first).checked = Boolean(value);
        }
        continue;
      }

      if (first instanceof HTMLSelectElement && first.multiple) {
        const selectedValues = Array.isArray(value) ? value.map(val => String(val)) : [];
        Array.from(first.options).forEach(option => {
          option.selected = selectedValues.includes(option.value);
        });
        continue;
      }

      first.value = value ?? '';
      continue;
    }

    if (name) {
      const byId = document.getElementById(name);
      if (byId) {
        if (byId instanceof HTMLInputElement && byId.type === 'checkbox') {
          byId.checked = Boolean(value);
        } else if (byId instanceof HTMLSelectElement && byId.multiple && Array.isArray(value)) {
          Array.from(byId.options).forEach(option => {
            option.selected = value.includes(option.value);
          });
        } else {
          byId.value = value ?? '';
        }
      }
    }
  }

  dispatchProgressRestored(saved);
}

// carica automaticamente i dati salvati
async function loadAndRestore() {
  try {
    const saved = await Progress.load(PAGE_PATH);
    const localFallback = loadLocalFallback();
    let dataToRestore = saved || localFallback;
    if (typeof CONFIG.onRestore === 'function') {
      try {
        const hookResponse = CONFIG.onRestore(saved);
        if (hookResponse === false) {
          return;
        }
        if (hookResponse && typeof hookResponse === 'object') {
          dataToRestore = hookResponse;
        }
      } catch (error) {
        console.error('Errore durante onRestore progress:', error);
      }
    }
    restoreData(dataToRestore);
  } catch (error) {
    console.error('Errore caricamento progressi:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadAndRestore();
});

document.addEventListener('input', () => scheduleAutoSave('input'));
document.addEventListener('change', () => scheduleAutoSave('change'));

// gestisci click su salva
document.addEventListener('click', async (event) => {
  if (event.target.matches('[data-save-progress]')) {
    const button = event.target;
    if (isGuestMode) {
      alert('Sei in modalità ospite: il salvataggio online è disattivato.');
      return;
    }
    const payload = collectData();
    if (!payload || payload.__skipSave) {
      alert('Nessun dato da salvare.');
      return;
    }
    const originalText = button.textContent;
    button.textContent = '⏳ Salvataggio...';
    try {
      await Progress.save(payload, PAGE_PATH);
      lastAutoSave = Date.now();
      try {
        lastSavedSnapshot = JSON.stringify(payload);
      } catch {
        lastSavedSnapshot = null;
      }
      alert('Progressi salvati!');
    } catch (error) {
      const savedLocally = saveLocalFallback(payload);
      const msg = savedLocally
        ? 'Salvataggio remoto non disponibile, dati salvati in locale sul browser.'
        : 'Errore salvataggio: ' + error.message;
      alert(msg);
    } finally {
      button.textContent = originalText;
    }
  }
});

// pulsante cambio studente
document.addEventListener('click', (event) => {
  if (event.target.matches('#resetStudent')) {
    if (confirm('Vuoi cambiare studente?')) {
      if (typeof Progress?.clearSuperSession === 'function') {
        Progress.clearSuperSession();
      }
      localStorage.removeItem('mo:class');
      localStorage.removeItem('mo:code');
      sessionStorage.removeItem('mo:class');
      sessionStorage.removeItem('mo:code');
      location.reload();
    }
  }
});

// Aggiorna UI quando cambia identità
window.addEventListener('mo:identity-change', (event) => {
  const detail = event?.detail || {};
  isGuestMode = Boolean(detail.guest);
  updateSaveButtonsVisibility();
  updateStudentLabel(detail);
  loadAndRestore();
});
}

function guessHomeUrl() {
  try {
    const { origin, pathname } = window.location;
    const match = pathname.match(/^(.*?\/metodologieoperative)\//);
    if (match) {
      return `${origin}${match[1]}/index.html`;
    }
    if (origin && origin !== 'null' && origin !== 'file://') {
      return `${origin}/index.html`;
    }
  } catch (error) {
    console.warn('Impossibile determinare la home, uso percorso relativo:', error);
  }
  return 'index.html';
}
