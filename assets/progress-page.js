import { Progress } from './progress.js?v=20251015';

const DEFAULTS = {
  inputSelector: 'input[name], textarea[name], select[name]',
  buttonId: 'saveProgressBtn',
  buttonLabel: '💾 Salva progressi',
  buttonStyles: 'position:fixed;right:16px;bottom:16px;padding:10px 14px;border-radius:10px;border:0;background:#0ea5e9;color:#fff;box-shadow:0 6px 14px rgba(0,0,0,.15);z-index:99999;cursor:pointer;',
  autoCreateButton: true,
  pagePath: null,
  debug: false
};

function collectData(selector) {
  const data = {};
  document.querySelectorAll(selector).forEach(el => {
    const name = el.getAttribute('name');
    if (!name) return;

    if (el.type === 'checkbox') {
      data[name] = el.checked;
    } else if (el.type === 'radio') {
      if (el.checked) data[name] = el.value;
    } else {
      data[name] = el.value;
    }
  });
  return data;
}

function restoreData(selector, saved) {
  if (!saved) return;
  Object.entries(saved).forEach(([name, value]) => {
    const elements = document.querySelectorAll(`${selector}[name="${name}"]`);
    if (!elements.length) return;

    elements.forEach(el => {
      if (el.type === 'checkbox') {
        el.checked = Boolean(value);
      } else if (el.type === 'radio') {
        el.checked = el.value === value;
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
  const config = { ...DEFAULTS, ...options };
  const pagePath = config.pagePath || window.location.pathname;
  const inputsSelector = config.inputSelector;

  const button = ensureButton(config);
  if (!button) {
    console.warn('[Progress] Nessun bottone trovato o creato: salvataggio disattivato.');
    return;
  }

  async function loadAndRestore() {
    try {
      const saved = await Progress.load(pagePath);
      restoreData(inputsSelector, saved);
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
      const data = collectData(inputsSelector);
      await Progress.save(data, pagePath);
      if (config.onSave) config.onSave(data);
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
  }
}

// per debug manuale
if (window && !window.MOProgress) {
  window.MOProgress = { Progress, setupProgress };
}
