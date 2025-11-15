const SUPABASE_URL = "https://ruplzgcnheddmqqdephp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cGx6Z2NuaGVkZG1xcWRlcGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTYyMjksImV4cCI6MjA3NTY5MjIyOX0.tOLIkgi5yTt61_0rMlXUqxnbil4DLD7kBaqZBVAv1CI";

class ProgressStore {
  constructor({ url, key }) {
    this.url = url;
    this.key = key;
    this.table = 'progress';
  }

  async _req(path, opts = {}) {
    const url = `${this.url}/rest/v1/${path}`;
    console.log('[SUPABASE REQUEST]', opts.method || 'GET', url, opts.body || null);
    const res = await fetch(url, {
      ...opts,
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(opts.headers || {})
      }
    });
    const text = await res.text();
    if (!res.ok) {
      const msg = `HTTP ${res.status} ${res.statusText} — ${text.slice(0, 200)}`;
      console.error('[SUPABASE ERROR]', msg);
      throw new Error(msg);
    }
    try { return JSON.parse(text); } catch { return text; }
  }

  async save({ classCode, studentCode, pagePath, data }) {
    const body = [{ class_code: classCode, student_code: studentCode, page_path: pagePath, data }];
    return this._req(`${this.table}?on_conflict=student_code,page_path`, {
      method: 'POST',
      headers: {
        'Prefer': 'return=representation,resolution=merge-duplicates'
      },
      body: JSON.stringify(body)
    });
  }

  async load({ studentCode, pagePath }) {
    const q = new URLSearchParams({
      select: '*',
      student_code: `eq.${studentCode}`,
      page_path: `eq.${pagePath}`,
      limit: '1'
    }).toString();
    const rows = await this._req(`${this.table}?${q}`);
    return rows?.[0]?.data || null;
  }
}

// ✅ NUOVA FUNZIONE: Normalizza il path per evitare duplicati
function normalizePath(path) {
  if (!path) return '/';
  
  // Rimuovi il dominio se presente
  path = path.replace(/^https?:\/\/[^\/]+/, '');
  
  // Assicurati che inizi con /
  if (!path.startsWith('/')) path = '/' + path;
  
  // Rimuovi trailing slash (eccetto per root)
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  
  // Rimuovi query string e hash
  path = path.split('?')[0].split('#')[0];
  
  return path;
}

const STORAGE_KEYS = {
  classCode: 'mo:class',
  studentCode: 'mo:code'
};

const identityCache = {
  classCode: null,
  studentCode: null,
  isGuest: false
};

const SUPER_STORAGE_KEY = 'mo:super-impersonations';
const SUPER_PARAM_KEYS = ['docente', 'super'];
const SUPER_SESSION_DURATION = 1000 * 60 * 15;
const CURRENT_PAGE_PATH = typeof window !== 'undefined' ? normalizePath(window.location.pathname) : '/';
const SUPER_PARAM_ACTIVE = (() => {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return SUPER_PARAM_KEYS.some(key => params.has(key));
  } catch {
    return false;
  }
})();
let superIdentity = null;

function setGuestMode(isGuest) {
  identityCache.isGuest = Boolean(isGuest);
  try {
    if (typeof document !== 'undefined' && document.body) {
      if (identityCache.isGuest) {
        document.body.setAttribute('data-mo-guest', 'true');
      } else {
        document.body.removeAttribute('data-mo-guest');
      }
    }
  } catch (error) {
    console.warn('[Progress] Impossibile aggiornare stato guest:', error);
  }
}

function setSuperModeAttributes(identity) {
  try {
    if (typeof document === 'undefined' || !document.body) return;
    if (identity) {
      document.body.setAttribute('data-mo-super', 'true');
      if (identity.classCode) {
        document.body.setAttribute('data-mo-super-class', identity.classCode);
      }
      if (identity.studentCode) {
        document.body.setAttribute('data-mo-super-student', identity.studentCode);
      }
    } else {
      document.body.removeAttribute('data-mo-super');
      document.body.removeAttribute('data-mo-super-class');
      document.body.removeAttribute('data-mo-super-student');
    }
  } catch (error) {
    console.warn('[Progress] Impossibile aggiornare attributi super user:', error);
  }
}

function getSuperStore() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(SUPER_STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) || {};
    const now = Date.now();
    let mutated = false;
    Object.keys(data).forEach(key => {
      if (data[key].expires && data[key].expires < now) {
        delete data[key];
        mutated = true;
      }
    });
    if (mutated) {
      sessionStorage.setItem(SUPER_STORAGE_KEY, JSON.stringify(data));
    }
    return data;
  } catch (error) {
    console.warn('[Progress] Impossibile leggere archivio super user:', error);
    return {};
  }
}

function readSuperSessionEntry(path = CURRENT_PAGE_PATH) {
  if (!SUPER_PARAM_ACTIVE) return null;
  try {
    const store = getSuperStore();
    return store[path] || null;
  } catch (error) {
    console.warn('[Progress] Impossibile leggere la sessione docente:', error);
    return null;
  }
}

function clearSuperSessionEntry(path = CURRENT_PAGE_PATH) {
  if (typeof window === 'undefined') return;
  try {
    if (path === '*') {
      sessionStorage.removeItem(SUPER_STORAGE_KEY);
      return;
    }
    const normalized = normalizePath(path);
    const store = getSuperStore();
    if (store[normalized]) {
      delete store[normalized];
      sessionStorage.setItem(SUPER_STORAGE_KEY, JSON.stringify(store));
    }
  } catch (error) {
    console.warn('[Progress] Impossibile cancellare la sessione docente:', error);
  }
}

function getIdentityConfig() {
  if (typeof window === 'undefined') return {};
  const cfg = window.MO_IDENTITY_CONFIG;
  return cfg && typeof cfg === 'object' ? cfg : {};
}

function notifyIdentityChange(detail) {
  try {
    const target = typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'
      ? window
      : (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function' ? document : null);

    if (!target) return;

    let event;
    if (typeof CustomEvent === 'function') {
      event = new CustomEvent('mo:identity-change', { detail });
    } else if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
      event = document.createEvent('CustomEvent');
      event.initCustomEvent('mo:identity-change', false, false, detail);
    }

    if (event) {
      target.dispatchEvent(event);
    }
  } catch (error) {
    console.warn('[Progress] Impossibile notificare il cambio identità:', error);
  }
}

function clearLegacyIdentity() {
  // Funzione deprecata - manteniamo per retrocompatibilità ma non fa nulla
  console.log('[Progress] clearLegacyIdentity: funzione deprecata');
}

clearLegacyIdentity();

const initialSuperEntry = readSuperSessionEntry(CURRENT_PAGE_PATH);
if (initialSuperEntry && initialSuperEntry.classCode && initialSuperEntry.studentCode) {
  superIdentity = {
    classCode: initialSuperEntry.classCode,
    studentCode: initialSuperEntry.studentCode,
    superUser: true
  };
  identityCache.classCode = initialSuperEntry.classCode;
  identityCache.studentCode = initialSuperEntry.studentCode;
  identityCache.isGuest = false;
  setSuperModeAttributes(superIdentity);
  notifyIdentityChange({ ...superIdentity, superUser: true });
}

// ✅ MODIFICATO: Usa localStorage invece di sessionStorage per persistenza
function readIdentity() {
  if (identityCache.classCode && identityCache.studentCode) {
    return { ...identityCache };
  }
  try {
    // Prova prima localStorage (persistente tra sessioni)
    let cls = localStorage.getItem(STORAGE_KEYS.classCode);
    let code = localStorage.getItem(STORAGE_KEYS.studentCode);
    
    // Fallback a sessionStorage per retrocompatibilità
    if (!cls || !code) {
      cls = sessionStorage.getItem(STORAGE_KEYS.classCode);
      code = sessionStorage.getItem(STORAGE_KEYS.studentCode);
      
      // Se trovato in sessionStorage, migra a localStorage
      if (cls && code) {
        console.log('[Progress] Migrazione da sessionStorage a localStorage');
        localStorage.setItem(STORAGE_KEYS.classCode, cls);
        localStorage.setItem(STORAGE_KEYS.studentCode, code);
      }
    }

    if (cls && code) {
      identityCache.classCode = cls;
      identityCache.studentCode = code;
      setGuestMode(false);
      console.log('[Progress] ✅ Identità caricata:', cls, '-', code);
      return { classCode: cls, studentCode: code };
    }
  } catch (error) {
    console.warn('[Progress] Storage non disponibile, uso memoria volatile:', error);
  }
  return identityCache.classCode && identityCache.studentCode
    ? { ...identityCache }
    : null;
}

// ✅ MODIFICATO: Salva in localStorage per persistenza tra sessioni
function writeIdentity(cls, code) {
  const config = getIdentityConfig();
  const normalizedClass = String(cls || '').trim();
  const normalizedCode = String(code || '').trim();

  let finalClass = normalizedClass;
  if (config.storeClassLowercase) {
    finalClass = finalClass.toLowerCase();
  } else if (config.storeClassUppercase ?? true) {
    finalClass = finalClass.toUpperCase();
  }

  let finalCode = normalizedCode;
  if (config.storeCodeLowercase) {
    finalCode = finalCode.toLowerCase();
  } else if (config.storeCodeUppercase ?? true) {
    finalCode = finalCode.toUpperCase();
  }

  identityCache.classCode = finalClass;
  identityCache.studentCode = finalCode;
  setGuestMode(false);
  try {
    // Salva in localStorage per persistenza
    localStorage.setItem(STORAGE_KEYS.classCode, finalClass);
    localStorage.setItem(STORAGE_KEYS.studentCode, finalCode);

    // Mantieni anche in sessionStorage per retrocompatibilità
    sessionStorage.setItem(STORAGE_KEYS.classCode, finalClass);
    sessionStorage.setItem(STORAGE_KEYS.studentCode, finalCode);

    console.log('[Progress] ✅ Identità salvata in storage:', finalClass, '-', finalCode);
  } catch (error) {
    console.warn('[Progress] Impossibile salvare in storage:', error);
  }

  notifyIdentityChange({ classCode: finalClass, studentCode: finalCode });
}

// ✅ NUOVA FUNZIONE: Visualizza identità corrente (per debug)
function getCurrentIdentity() {
  const identity = readIdentity();
  if (identity) {
    console.log('👤 Studente attivo:', identity.classCode, '-', identity.studentCode);
    return identity;
  }
  console.log('❌ Nessuna identità salvata');
  return null;
}

// ✅ NUOVA FUNZIONE: Cancella identità (per debug e reset)
function clearIdentity() {
  try {
    localStorage.removeItem(STORAGE_KEYS.classCode);
    localStorage.removeItem(STORAGE_KEYS.studentCode);
    sessionStorage.removeItem(STORAGE_KEYS.classCode);
    sessionStorage.removeItem(STORAGE_KEYS.studentCode);
    identityCache.classCode = null;
    identityCache.studentCode = null;
    superIdentity = null;
    clearSuperSessionEntry('*');
    setSuperModeAttributes(null);
    console.log('✅ Identità cancellata');
  } catch (error) {
    console.warn('Errore durante cancellazione identità:', error);
  }

  notifyIdentityChange({ classCode: null, studentCode: null });
}

function askIdentity() {
  const existing = readIdentity();
  if (existing) return Promise.resolve(existing);

  // crea popup grafico
  const config = getIdentityConfig();
  const classPlaceholder = config.classPlaceholder || 'Classe (es. 3B)';
  const codePlaceholder = config.codePlaceholder || (config.codeExample ? `Codice (es. ${config.codeExample})` : 'Codice (es. 3B-AB12CD)');
  const instructions = config.message || (config.codeExample
    ? `Inserisci la tua classe e il codice personale. Es.: ${config.codeExample}`
    : 'Inserisci la tua classe e il codice personale.');
  const showGenerator = !config.hideGenerator;
  const allowGuest = Boolean(config.guestAllowed);

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#0007;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:12px;max-width:360px;width:90%;font:16px system-ui;color:#000;">
      <h3 style="margin-top:0;color:#000;">Accedi come studente</h3>
      <p style="margin:0 0 8px;color:#666;">${instructions}</p>
      <input id="cls" placeholder="${classPlaceholder}" style="width:100%;margin-bottom:8px;padding:6px;border:1px solid #ccc;border-radius:6px;">
      <input id="cod" placeholder="${codePlaceholder}" style="width:100%;margin-bottom:12px;padding:6px;border:1px solid #ccc;border-radius:6px;">
      <div style="display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;">
        ${allowGuest ? '<button id="guest" style="padding:6px 10px;border:1px solid #ccc;background:#fff;border-radius:6px;cursor:pointer;">Entra come ospite</button>' : ''}
        ${showGenerator ? '<button id="gen" style="padding:6px 10px;border:1px solid #ccc;background:#fff;border-radius:6px;cursor:pointer;">Genera codice</button>' : ''}
        <button id="ok" style="background:#0ea5e9;color:#fff;padding:6px 10px;border:none;border-radius:6px;cursor:pointer;">Continua</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const classPattern = config.classPattern ? new RegExp(config.classPattern) : null;
  const codePattern = config.codePattern ? new RegExp(config.codePattern) : null;

  const sanitizeClass = (value) => {
    let v = String(value ?? '');
    if (config.stripWhitespaceInClass) v = v.replace(/\s+/g, '');
    if (config.classLowercase) v = v.toLowerCase();
    if (config.classUppercase) v = v.toUpperCase();
    if (config.classSanitizeFn && typeof config.classSanitizeFn === 'function') {
      try { v = config.classSanitizeFn(v); } catch (error) { console.warn('classSanitizeFn error:', error); }
    }
    return v.trim();
  };

  const sanitizeCode = (value) => {
    let v = String(value ?? '');
    if (config.stripWhitespaceInCode) v = v.replace(/\s+/g, '');
    if (config.sanitizeCode) v = v.replace(/[^A-Za-z0-9]/g, '');
    if (config.codeUppercase) v = v.toUpperCase();
    if (config.codeLowercase) v = v.toLowerCase();
    if (config.codeSanitizeFn && typeof config.codeSanitizeFn === 'function') {
      try { v = config.codeSanitizeFn(v); } catch (error) { console.warn('codeSanitizeFn error:', error); }
    }
    return v.trim();
  };

  return new Promise(resolve => {
    const classInput = overlay.querySelector('#cls');
    const codeInput = overlay.querySelector('#cod');

    const getClassValue = () => sanitizeClass(classInput.value);
    const getCodeValue = () => sanitizeCode(codeInput.value);

    const generatorBtn = overlay.querySelector('#gen');
    if (generatorBtn) {
      generatorBtn.onclick = () => {
        const prefixRaw = getClassValue() || '3b';
        const prefix = config.generatorUppercasePrefix ? prefixRaw.toUpperCase() : prefixRaw;
        codeInput.value = `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      };
    }

    const completeIdentity = (cls, cod, isGuest = false) => {
      overlay.remove();
      if (isGuest) {
        identityCache.classCode = cls;
        identityCache.studentCode = cod;
        setGuestMode(true);
        notifyIdentityChange({ classCode: cls, studentCode: cod, guest: true });
        resolve({ classCode: cls, studentCode: cod, isGuest: true });
        return;
      }
      writeIdentity(cls, cod);
      overlay.remove();
      resolve({ classCode: cls, studentCode: cod, isGuest: false });
    };

    const okBtn = overlay.querySelector('#ok');
    overlay.querySelector('#ok').onclick = () => {
      let cls = getClassValue();
      let cod = getCodeValue();

      classInput.value = cls;
      codeInput.value = cod;

      if ((config.classRequired ?? true) && !cls) {
        alert(config.classRequiredMessage || 'Inserisci la classe.');
        return;
      }
      if (classPattern && cls && !classPattern.test(cls)) {
        alert(config.classErrorMessage || (config.classExample ? `Formato classe non valido. Esempio: ${config.classExample}` : 'Formato classe non valido.'));
        return;
      }

      if ((config.codeRequired ?? true) && !cod) {
        alert(config.codeRequiredMessage || 'Inserisci il codice personale.');
        return;
      }
      if (codePattern && cod && !codePattern.test(cod)) {
        alert(config.codeErrorMessage || (config.codeExample ? `Formato codice non valido. Esempio: ${config.codeExample}` : 'Formato codice non valido.'));
        return;
      }

      completeIdentity(cls, cod, false);
    };

    const guestBtn = overlay.querySelector('#guest');
    if (guestBtn) {
      guestBtn.onclick = () => {
        const guestClass = config.guestClassCode || 'ospite';
        const guestCode = config.guestStudentCode || 'ospite';
        completeIdentity(guestClass, guestCode, true);
      };
    };
  });
}

export const Progress = (() => {
  const store = new ProgressStore({ url: SUPABASE_URL, key: SUPABASE_ANON_KEY });
  let identityPromise = null;

  async function ensureIdentity() {
    if (superIdentity) {
      return superIdentity;
    }
    const cached = readIdentity();
    if (cached) return cached;
    if (!identityPromise) {
      identityPromise = askIdentity().finally(() => {
        identityPromise = null;
      });
    }
    return identityPromise;
  }

  // ✅ MODIFICATO: Usa path normalizzato
  async function load(pagePath = location.pathname) {
    const normalizedPath = normalizePath(pagePath);
    const id = await ensureIdentity();
    if (!id || id.isGuest) {
      console.log('[Progress] 📥 Modalità ospite attiva: caricamento remoto disabilitato.');
      return null;
    }
    console.log('[Progress] 📥 Caricamento da:', normalizedPath);
    return store.load({ studentCode: id.studentCode, pagePath: normalizedPath });
  }

  // ✅ MODIFICATO: Usa path normalizzato e log migliorati
  async function save(data, pagePath = location.pathname) {
    const normalizedPath = normalizePath(pagePath);
    const id = await ensureIdentity();
    if (!id || id.isGuest) {
      console.log('[Progress] ⚠️ Modalità ospite: salvataggio remoto saltato.');
      return null;
    }
    console.log('[Progress] 💾 Salvataggio su:', normalizedPath, '| Campi:', Object.keys(data).length);
    return store.save({ 
      classCode: id.classCode, 
      studentCode: id.studentCode, 
      pagePath: normalizedPath, 
      data 
    });
  }

  function clearSuperSession(path = CURRENT_PAGE_PATH) {
    clearSuperSessionEntry(path);
    if (superIdentity && normalizePath(path) === CURRENT_PAGE_PATH) {
      superIdentity = null;
      identityCache.classCode = null;
      identityCache.studentCode = null;
      setSuperModeAttributes(null);
      notifyIdentityChange({ classCode: null, studentCode: null });
    }
  }

  return { load, save, clearSuperSession };
})();

// ✅ Esponi funzioni di debug globalmente
if (typeof window !== 'undefined' && !window.MODebug) {
  window.MODebug = {
    getCurrentIdentity,
    clearIdentity,
    showIdentity: () => {
      const id = getCurrentIdentity();
      if (id) {
        alert(`👤 Studente attivo:\n\nClasse: ${id.classCode}\nCodice: ${id.studentCode}\n\n✅ L'identità è salvata e persisterà anche dopo aver chiuso il browser.`);
      } else {
        alert('❌ Nessuno studente è attualmente loggato.\n\nAll\'apertura della prossima pagina interattiva ti verrà chiesto di inserire i dati.');
      }
      return id;
    }
  };
  console.log('[Progress] 🔧 Debug abilitato: usa window.MODebug nel console');
}
