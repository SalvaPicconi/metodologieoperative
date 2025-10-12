import { Progress } from './progress.js?v=20251020';

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

// ✅ NUOVA FUNZIONE: Sistema di notifiche eleganti
function showNotification(message, type = 'info') {
  // Rimuovi notifiche esistenti
  document.querySelectorAll('.mo-notification').forEach(el => el.remove());
  
  const notification = document.createElement('div');
  notification.className = 'mo-notification';
  notification.textContent = message;
  
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${colors[type] || colors.info};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 100000;
    font-weight: 500;
    animation: slideIn 0.3s ease-out;
    font-family: system-ui, -apple-system, sans-serif;
  `;
  
  // Aggiungi animazione
  if (!document.querySelector('#mo-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'mo-notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Rimuovi dopo 3 secondi
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

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
      const isArrayValue = Array.isArray(value);
      const isPlainObject = value && typeof value === 'object' && !isArrayValue;
      const normalized = isPlainObject ? '' : value;

      const normalizedStr = normalized == null ? '' : String(normalized);
      const safeValue = normalizedStr === '[object Object]' ? '' : normalizedStr;

      if (type === 'checkbox') {
        el.checked = Boolean(normalized);
      } else if (type === 'radio') {
        el.checked = normalizedStr && el.value === normalizedStr;
      } else if (type === 'date') {
        if (safeValue) {
          try {
            const key = el.id || el.name || el.getAttribute('data-progress');
            if (key) sessionStorage.setItem(`mo:date:${key}`, safeValue);
            el.value = safeValue;
          } catch (storageError) {
            el.value = safeValue;
          }
        } else {
          const key = el.id || el.name || el.getAttribute('data-progress');
          if (key) {
            const stored = sessionStorage.getItem(`mo:date:${key}`);
            if (stored) {
              el.value = stored;
            } else {
              el.value = '';
            }
          } else {
            el.value = '';
          }
        }
      } else if (type === 'select-multiple' && isArrayValue) {
        Array.from(el.options).forEach(opt => {
          opt.selected = normalized.includes(opt.value);
        });
      } else if (el.isContentEditable) {
        el.innerHTML = safeValue;
      } else {
        el.value = safeValue;
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

  // ✅ MODIFICATO: Feedback migliorato sul caricamento
  async function loadAndRestore() {
    try {
      const saved = await Progress.load(pagePath);
      restoreData(inputsSelector, saved);
      
      // ✅ AGGIUNTO: Notifica visiva sul ripristino
      if (saved && Object.keys(saved).length > 0) {
        const filledCount = Object.keys(saved).length;
        showNotification(`✅ ${filledCount} ${filledCount === 1 ? 'campo ripristinato' : 'campi ripristinati'}`, 'success');
        console.log('[Progress] Dati ripristinati:', filledCount, 'campi');
      } else {
        console.log('[Progress] Nessun dato salvato trovato per questa pagina');
      }
      
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
      showNotification('⚠️ Errore nel caricamento dei progressi', 'error');
    }
  }

  // ✅ MODIFICATO: Feedback migliorato sul salvataggio
  async function handleSave() {
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = '⏳ Salvataggio...';
    try {
      let data = collectData(inputsSelector);
      
      // ✅ AGGIUNTO: Conta campi effettivamente compilati
      const filledFields = Object.entries(data).filter(([k, v]) => {
        if (typeof v === 'string') return v.trim().length > 0;
        if (typeof v === 'boolean') return v;
        if (Array.isArray(v)) return v.length > 0;
        return v != null;
      }).length;
      
      if (filledFields === 0) {
        showNotification('⚠️ Nessun campo da salvare', 'warning');
        return;
      }
      
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
      
      // ✅ MIGLIORATO: Feedback più informativo
      showNotification(`✅ ${filledFields} ${filledFields === 1 ? 'campo salvato' : 'campi salvati'}!`, 'success');
    } catch (error) {
      console.error('[Progress] Errore durante il salvataggio:', error);
      // ✅ MIGLIORATO: Messaggio di errore più chiaro
      const errorMsg = error.message || 'Errore sconosciuto';
      showNotification('❌ Errore nel salvataggio: ' + errorMsg, 'error');
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

  return {
    save: handleSave,
    reload: loadAndRestore,
    button
  };
}

export function resetProgressSession() {
  sessionStorage.removeItem('mo:class');
  sessionStorage.removeItem('mo:code');
  localStorage.removeItem('mo:class');
  localStorage.removeItem('mo:code');
  if (window.MOProgress) {
    window.MOProgress.identityCleared = true;
  }
  console.log('[Progress] Sessione resettata');
}

// ✅ NUOVA FUNZIONE: Mostra informazioni studente corrente
export function showCurrentStudent() {
  if (typeof window !== 'undefined' && window.MODebug) {
    window.MODebug.showIdentity();
  }
}

// per debug manuale
if (window && !window.MOProgress) {
  window.MOProgress = { 
    Progress, 
    setupProgress, 
    resetProgressSession,
    showCurrentStudent  // ✅ AGGIUNTO
  };
}
