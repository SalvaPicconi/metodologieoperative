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

const STORAGE_KEYS = {
  classCode: 'mo:class',
  studentCode: 'mo:code'
};

const identityCache = {
  classCode: null,
  studentCode: null
};

function clearLegacyIdentity() {
  try {
    localStorage.removeItem(STORAGE_KEYS.classCode);
    localStorage.removeItem(STORAGE_KEYS.studentCode);
  } catch (error) {
    // ignoriamo browser che bloccano localStorage
  }
}

clearLegacyIdentity();

function readIdentity() {
  if (identityCache.classCode && identityCache.studentCode) {
    return { ...identityCache };
  }
  try {
    const cls = sessionStorage.getItem(STORAGE_KEYS.classCode);
    const code = sessionStorage.getItem(STORAGE_KEYS.studentCode);
    if (cls && code) {
      identityCache.classCode = cls;
      identityCache.studentCode = code;
      return { classCode: cls, studentCode: code };
    }
  } catch (error) {
    console.warn('SessionStorage non disponibile, uso memoria volatile:', error);
  }
  return identityCache.classCode && identityCache.studentCode
    ? { ...identityCache }
    : null;
}

function writeIdentity(cls, code) {
  identityCache.classCode = cls;
  identityCache.studentCode = code;
  try {
    sessionStorage.setItem(STORAGE_KEYS.classCode, cls);
    sessionStorage.setItem(STORAGE_KEYS.studentCode, code);
  } catch (error) {
    console.warn('Impossibile salvare in sessionStorage:', error);
  }
}

function askIdentity() {
  const existing = readIdentity();
  if (existing) return Promise.resolve(existing);

  // crea popup grafico
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#0007;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:12px;max-width:360px;width:90%;font:16px system-ui;">
      <h3>Accedi come studente</h3>
      <p style="margin:0 0 8px;">Inserisci la tua classe e il codice personale.</p>
      <input id="cls" placeholder="Classe (es. 3B)" style="width:100%;margin-bottom:8px;padding:6px;border:1px solid #ccc;border-radius:6px;">
      <input id="cod" placeholder="Codice (es. 3B-AB12CD)" style="width:100%;margin-bottom:12px;padding:6px;border:1px solid #ccc;border-radius:6px;">
      <div style="text-align:right;">
        <button id="gen" style="margin-right:8px;padding:6px 10px;">Genera codice</button>
        <button id="ok" style="background:#0ea5e9;color:#fff;padding:6px 10px;border:none;border-radius:6px;">Continua</button>
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

  async function load(pagePath = location.pathname) {
    const id = await ensureIdentity();
    return store.load({ studentCode: id.studentCode, pagePath });
  }

  async function save(data, pagePath = location.pathname) {
    const id = await ensureIdentity();
    return store.save({ classCode: id.classCode, studentCode: id.studentCode, pagePath, data });
  }

  return { load, save };
})();
