import { Progress } from './progress.js';

console.log('✅ progress-global attivo');

// Rileva ID della pagina (meta o path)
const PAGE_ID = document.querySelector('meta[name="page-id"]')?.content || location.pathname;
const CONFIG = window.MO_PROGRESS_CONFIG || {};
const PAGE_PATH = CONFIG.pagePath || PAGE_ID;
const INPUT_SELECTOR = CONFIG.inputSelector || 'input, textarea, select';
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

function escapeSelector(value) {
  if (typeof value !== 'string') return value;
  if (typeof window !== 'undefined' && window.CSS && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/([\\^$*+?.()|{}\[\]])/g, '\\$1');
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
      const radios = document.querySelectorAll(`[name="${escapeSelector(key)}"]`);
      const checked = Array.from(radios).find(radio => radio.checked);
      data[key] = checked ? checked.value : null;
      return;
    }

    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (processedCheckbox.has(key)) return;
      processedCheckbox.add(key);
      const checkboxes = document.querySelectorAll(`[name="${escapeSelector(key)}"]`);
      if (checkboxes.length > 1) {
        data[key] = Array.from(checkboxes)
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
  return data;
}

function restoreData(saved) {
  if (!saved) {
    dispatchProgressRestored(null);
    return;
  }

  for (const [name, value] of Object.entries(saved)) {
    const selector = name ? `[name="${escapeSelector(name)}"]` : null;
    const elements = selector ? document.querySelectorAll(selector) : [];

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
          elements.forEach(cb => {
            const cbValue = cb.value ?? 'on';
            cb.checked = values.includes(cbValue);
          });
        } else {
          first.checked = Boolean(value);
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
      await Progress.save(collectData(), PAGE_PATH);
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
