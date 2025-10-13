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
  studentCode: null
};

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
  const normalizedClass = String(cls || '').trim().toUpperCase();
  const normalizedCode = String(code || '').trim().toUpperCase();
  identityCache.classCode = normalizedClass;
  identityCache.studentCode = normalizedCode;
  try {
    // Salva in localStorage per persistenza
    localStorage.setItem(STORAGE_KEYS.classCode, normalizedClass);
    localStorage.setItem(STORAGE_KEYS.studentCode, normalizedCode);
    
    // Mantieni anche in sessionStorage per retrocompatibilità
    sessionStorage.setItem(STORAGE_KEYS.classCode, normalizedClass);
    sessionStorage.setItem(STORAGE_KEYS.studentCode, normalizedCode);
    
    console.log('[Progress] ✅ Identità salvata in localStorage:', normalizedClass, '-', normalizedCode);
  } catch (error) {
    console.warn('[Progress] Impossibile salvare in storage:', error);
  }

  notifyIdentityChange({ classCode: normalizedClass, studentCode: normalizedCode });
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
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#0007;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:12px;max-width:360px;width:90%;font:16px system-ui;color:#000;">
      <h3 style="margin-top:0;color:#000;">Accedi come studente</h3>
      <p style="margin:0 0 8px;color:#666;">Inserisci la tua classe e il codice personale.</p>
      <input id="cls" placeholder="Classe (es. 3B)" style="width:100%;margin-bottom:8px;padding:6px;border:1px solid #ccc;border-radius:6px;">
      <input id="cod" placeholder="Codice (es. 3B-AB12CD)" style="width:100%;margin-bottom:12px;padding:6px;border:1px solid #ccc;border-radius:6px;">
      <div style="text-align:right;">
        <button id="gen" style="margin-right:8px;padding:6px 10px;border:1px solid #ccc;background:#fff;border-radius:6px;cursor:pointer;">Genera codice</button>
        <button id="ok" style="background:#0ea5e9;color:#fff;padding:6px 10px;border:none;border-radius:6px;cursor:pointer;">Continua</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  return new Promise(resolve => {
    overlay.querySelector('#gen').onclick = () => {
      const c = overlay.querySelector('#cls').value.trim() || '3B';
      overlay.querySelector('#cod').value = `${c}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    };
    overlay.querySelector('#ok').onclick = () => {
      const c1 = overlay.querySelector('#cls').value.trim();
      const c2 = overlay.querySelector('#cod').value.trim();
      if (!c1 || !c2) return alert('Inserisci classe e codice');
      writeIdentity(c1, c2);
      overlay.remove();
      resolve({ classCode: c1, studentCode: c2 });
    };
  });
}

export const Progress = (() => {
  const store = new ProgressStore({ url: SUPABASE_URL, key: SUPABASE_ANON_KEY });
  let identityPromise = null;

  async function ensureIdentity() {
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
    console.log('[Progress] 📥 Caricamento da:', normalizedPath);
    return store.load({ studentCode: id.studentCode, pagePath: normalizedPath });
  }

  // ✅ MODIFICATO: Usa path normalizzato e log migliorati
  async function save(data, pagePath = location.pathname) {
    const normalizedPath = normalizePath(pagePath);
    const id = await ensureIdentity();
    console.log('[Progress] 💾 Salvataggio su:', normalizedPath, '| Campi:', Object.keys(data).length);
    return store.save({ 
      classCode: id.classCode, 
      studentCode: id.studentCode, 
      pagePath: normalizedPath, 
      data 
    });
  }

  return { load, save };
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
