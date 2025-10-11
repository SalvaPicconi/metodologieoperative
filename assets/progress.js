const SUPABASE_URL = "https://IL-MIO-PROJECT-URL.supabase.co";
const SUPABASE_ANON_KEY = "LA-MIA-ANON-KEY";

// Libreria per salvare e caricare i progressi degli studenti
class ProgressStore {
  constructor({ url, key }) {
    this.url = url;
    this.key = key;
    this.table = 'progress';
  }

  async _req(path, opts = {}) {
    const res = await fetch(`${this.url}/rest/v1/${path}`, {
      ...opts,
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(opts.headers || {})
      }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.headers.get('content-type')?.includes('application/json') ? res.json() : res.text();
  }

  async save({ classCode, studentCode, pagePath, data }) {
    const body = [{ class_code: classCode, student_code: studentCode, page_path: pagePath, data }];
    return this._req(`${this.table}?on_conflict=student_code,page_path`, {
      method: 'POST',
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

export const Progress = (() => {
  const store = new ProgressStore({ url: SUPABASE_URL, key: SUPABASE_ANON_KEY });

  async function load(pagePath = location.pathname) {
    let cls = localStorage.getItem('mo:class');
    let code = localStorage.getItem('mo:code');
    if (!cls || !code) {
      cls = prompt('Inserisci la tua classe (es. 3B):') || '3B';
      code = prompt('Inserisci o genera il tuo codice (es. 3B-XYZ123):') || `${cls}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      localStorage.setItem('mo:class', cls);
      localStorage.setItem('mo:code', code);
    }
    const saved = await store.load({ studentCode: code, pagePath });
    return saved;
  }

  async function save(data, pagePath = location.pathname) {
    let cls = localStorage.getItem('mo:class');
    let code = localStorage.getItem('mo:code');
    if (!cls || !code) {
      cls = prompt('Inserisci la tua classe (es. 3B):') || '3B';
      code = prompt('Inserisci o genera il tuo codice (es. 3B-XYZ123):') || `${cls}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      localStorage.setItem('mo:class', cls);
      localStorage.setItem('mo:code', code);
    }
    return store.save({ classCode: cls, studentCode: code, pagePath, data });
  }

  return { load, save };
})();
