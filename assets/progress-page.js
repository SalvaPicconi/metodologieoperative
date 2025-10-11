import { Progress } from './progress.js?v=20251016';

const DEFAULTS = {
  inputSelector: 'input:not([type="file"]), textarea, select',
  buttonId: 'saveProgressBtn',
  buttonLabel: '💾 Salva progressi',
  buttonStyles: 'position:fixed;right:16px;bottom:16px;padding:10px 14px;border-radius:10px;border:0;background:#0ea5e9;color:#fff;box-shadow:0 6px 14px rgba(0,0,0,.15);z-index:99999;cursor:pointer;',
  autoCreateButton: true,
  pagePath: null,
  onBeforeSave: null,
  onRestore: null,
  debug: false
};

const AUTO_KEY_MAP = new WeakMap();
let autoKeyCounter = 0;

function ensureFieldKey(el) {
  if (el.matches('[data-progress-ignore]')) return null;

  const existing = el.getAttribute('data-progress') || el.getAttribute('name') || el.id;
  if (existing) {
    AUTO_KEY_MAP.set(el, existing);
    return existing;
  }

  const cached = AUTO_KEY_MAP.get(el);
  if (cached) return cached;

  const generated = `auto_field_${autoKeyCounter++}`;
  el.setAttribute('data-progress', generated);
  AUTO_KEY_MAP.set(el, generated);
  return generated;
}

function prepareFields(selector) {
  document.querySelectorAll(selector).forEach(el => {
    ensureFieldKey(el);
  });
}

function escapeSelector(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return String(value).replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

function collectData(selector) {
  const data = {};
  document.querySelectorAll(selector).forEach(el => {
    const key = ensureFieldKey(el);
    if (!key) return;

    const type = (el.type || '').toLowerCase();

    if (type === 'checkbox') {
      data[key] = el.checked;
    } else if (type === 'radio') {
      if (el.checked) data[key] = el.value;
    } else if (type === 'select-multiple') {
      data[key] = Array.from(el.selectedOptions).map(opt => opt.value);
    } else if (el.isContentEditable) {
      data[key] = el.innerHTML;
    } else {
      data[key] = el.value;
    }
  });
  return data;
}

function restoreData(selector, saved) {
  if (!saved) return;
  Object.entries(saved).forEach(([key, value]) => {
    const escaped = escapeSelector(key);
    const elements = document.querySelectorAll(`${selector}[name="${key}"], ${selector}[data-progress="${key}"], ${selector}#${escaped}`);
    if (!elements.length) return;

    elements.forEach(el => {
      const type = (el.type || '').toLowerCase();
      if (type === 'checkbox') {
        el.checked = Boolean(value);
      } else if (type === 'radio') {
        el.checked = el.value === value;
      } else if (type === 'select-multiple' && Array.isArray(value)) {
        Array.from(el.options).forEach(opt => {
          opt.selected = value.includes(opt.value);
        });
      } else if (el.isContentEditable) {
        el.innerHTML = value ?? '';
      } else {
        el.value = value ?? '';
      }
    });
  });
}

function ensureButton({ buttonId, buttonLabel, buttonStyles, autoCreateButton }) {
  let button = document.getElementById(buttonId);
  if (!button && autoCreateButton) {
    button = document.createElement('button');
    button.id = buttonId;
    button.textContent = buttonLabel;
    button.type = 'button';
    button.style.cssText = buttonStyles;
    document.body.appendChild(button);
  }
  return button;
}

export async function setupProgress(options = {}) {
  const globalOptions = (typeof window !== 'undefined' && window.MO_PROGRESS_CONFIG)
    ? window.MO_PROGRESS_CONFIG
    : {};
  const config = { ...DEFAULTS, ...globalOptions, ...options };
  const pagePath = config.pagePath || window.location.pathname;
  const inputsSelector = config.inputSelector;

  prepareFields(inputsSelector);

  const button = ensureButton(config);
  if (!button) {
    console.warn('[Progress] Nessun bottone trovato o creato: salvataggio disattivato.');
    return;
  }

  async function loadAndRestore() {
    try {
      const saved = await Progress.load(pagePath);
      restoreData(inputsSelector, saved);
      if (typeof config.onRestore === 'function') {
        try {
          config.onRestore(saved);
        } catch (hookErr) {
          console.error('[Progress] Errore in onRestore:', hookErr);
        }
      }
      if (config.debug) {
        console.log('[Progress] Dati ripristinati', saved);
      }
    } catch (error) {
      console.error('[Progress] Errore durante il caricamento:', error);
    }
  }

  async function handleSave() {
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = '⏳ Salvataggio...';
    try {
      let data = collectData(inputsSelector);
      if (typeof config.onBeforeSave === 'function') {
        try {
          const extra = config.onBeforeSave(data) || {};
          if (extra && typeof extra === 'object') {
            data = { ...data, ...extra };
          }
        } catch (hookErr) {
          console.error('[Progress] Errore in onBeforeSave:', hookErr);
        }
      }
      await Progress.save(data, pagePath);
      if (typeof config.onSave === 'function') {
        try {
          config.onSave(data);
        } catch (hookErr) {
          console.error('[Progress] Errore in onSave:', hookErr);
        }
      }
      if (config.debug) console.log('[Progress] Salvataggio riuscito', data);
      alert('Progressi salvati!');
    } catch (error) {
      console.error('[Progress] Errore durante il salvataggio:', error);
      alert('Errore salvataggio: ' + (error.message || error));
    } finally {
      button.textContent = originalLabel;
      button.disabled = false;
    }
  }

  button.addEventListener('click', handleSave);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndRestore, { once: true });
  } else {
    await loadAndRestore();
  return {
    save: handleSave,
    reload: loadAndRestore,
    button
  };
}

export function resetProgressSession() {
  sessionStorage.removeItem('mo:class');
  sessionStorage.removeItem('mo:code');
  if (window.MOProgress) {
    window.MOProgress.identityCleared = true;
  }
}

// per debug manuale
if (window && !window.MOProgress) {
    window.MOProgress = { Progress, setupProgress, resetProgressSession };
}
