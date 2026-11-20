/*
 * Sessione dell'alunno («I miei lavori»).
 *
 * Classe e codice di sempre (quelli delle attività) si scambiano con un token di sessione, verificato
 * dal database a ogni chiamata. Il token sta in sessionStorage: vale per la scheda in cui si è entrati (e per le
 * attività aperte nella stessa scheda) e sparisce chiudendola. Nessun identificativo nell'URL.
 * Usato da area_alunni.html e da assets/progress.js.
 */
const RPC_PROD = 'https://ruplzgcnheddmqqdephp.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cGx6Z2NuaGVkZG1xcWRlcGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTYyMjksImV4cCI6MjA3NTY5MjIyOX0.tOLIkgi5yTt61_0rMlXUqxnbil4DLD7kBaqZBVAv1CI';
const CHIAVE = 'mo:alunno-sessione';
const CHIAVE_APRI = 'mo:alunno-apri';
const PREFISSO_BOZZA = 'mo:alunno-bozza:';
// Ricorda che in questa scheda si era entrati con il codice personale: se la sessione scade,
// le attività non devono ripiegare da sole sul vecchio accesso con classe e codice.
const ERA_ATTIVO = 'mo:alunno-era-attivo';

// Anteprima locale: solo su localhost si può puntare a un backend di collaudo, mai in produzione.
export function apiBase() {
    try {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            const locale = window.localStorage.getItem('mo:api-locale');
            if (locale && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(locale)) return locale;
        }
    } catch { }
    return RPC_PROD;
}

function leggi() {
    try {
        const s = JSON.parse(window.sessionStorage.getItem(CHIAVE) || 'null');
        if (s && /^[0-9a-f]{64}$/.test(s.token) && Date.parse(s.scade) > Date.now()) return s;
    } catch { }
    return null;
}

function scrivi(valore) {
    try {
        if (valore) window.sessionStorage.setItem(CHIAVE, JSON.stringify(valore));
        else window.sessionStorage.removeItem(CHIAVE);
    } catch { }
}

function annunciaScadenza() {
    try { window.dispatchEvent(new CustomEvent('mo:alunno-sessione-scaduta')); } catch { }
}

async function rpc(nome, args) {
    let res;
    try {
        res = await fetch(`${apiBase()}/rest/v1/rpc/${nome}`, {
            method: 'POST',
            cache: 'no-store',
            credentials: 'omit',
            headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(args || {})
        });
    } catch {
        const errore = new Error('rete non raggiungibile');
        errore.hint = 'rete';
        throw errore;
    }
    const testo = await res.text();
    let dati = null;
    try { dati = testo ? JSON.parse(testo) : null; } catch { dati = null; }
    if (!res.ok) {
        const errore = new Error((dati && dati.message) || `HTTP ${res.status}`);
        errore.code = dati && dati.code;
        errore.hint = (dati && dati.hint) || (res.status >= 500 ? 'rete' : null);
        throw errore;
    }
    return dati;
}

async function chiama(nome, args) {
    const s = leggi();
    if (!s) {
        const errore = new Error('sessione scaduta');
        errore.code = '42501';
        errore.hint = 'sessione';
        throw errore;
    }
    try {
        return await rpc(nome, Object.assign({ p_token: s.token }, args || {}));
    } catch (errore) {
        if (errore.code === '42501' && (errore.hint === 'sessione' || errore.hint === 'non_disponibile')) {
            scrivi(null);
            annunciaScadenza();
        }
        throw errore;
    }
}

function pulisciBozze() {
    try {
        const s = window.sessionStorage;
        for (let i = s.length - 1; i >= 0; i--) {
            const k = s.key(i);
            if (k && (k.startsWith(PREFISSO_BOZZA) || k === CHIAVE_APRI || k === 'mo:alunno-profilo')) s.removeItem(k);
        }
    } catch { }
}

export const AreaAlunni = {
    attiva: () => Boolean(leggi()),

    eraAttiva() {
        try { return window.sessionStorage.getItem(ERA_ATTIVO) === '1'; } catch { return false; }
    },

    async accedi(classe, codice) {
        const righe = await rpc('alunni_accesso', { p_classe: String(classe || ''), p_codice: String(codice || '') });
        const riga = Array.isArray(righe) ? righe[0] : righe;
        if (riga && riga.esito === 'ok' && riga.token) {
            const precedente = this.profiloSalvato();
            scrivi({ token: riga.token, scade: riga.scade_il });
            try { window.sessionStorage.setItem(ERA_ATTIVO, '1'); } catch { }
            // Le bozze restano solo se rientra lo stesso alunno: lo si controlla col profilo.
            try {
                const p = await this.profilo();
                if (!precedente || precedente.pseudonimo !== p.pseudonimo || precedente.classe !== p.classe) pulisciBozze();
                window.sessionStorage.setItem('mo:alunno-profilo', JSON.stringify({ pseudonimo: p.pseudonimo, classe: p.classe }));
            } catch { pulisciBozze(); }
        }
        return riga ? riga.esito : 'non_riconosciuto';
    },

    async esci() {
        const s = leggi();
        scrivi(null);
        pulisciBozze();
        try { window.sessionStorage.removeItem(ERA_ATTIVO); } catch { }
        if (s) {
            try { await rpc('alunni_esci', { p_token: s.token }); } catch { }
        }
    },

    async profilo() {
        const p = await chiama('alunni_profilo');
        try { window.sessionStorage.setItem('mo:alunno-profilo', JSON.stringify({ pseudonimo: p.pseudonimo, classe: p.classe })); } catch { }
        return p;
    },

    profiloSalvato() {
        try { return JSON.parse(window.sessionStorage.getItem('mo:alunno-profilo') || 'null'); } catch { return null; }
    },

    lavori: () => chiama('alunni_lavori'),

    // Correzioni delle verifiche che il docente ha reso visibili.
    correzioni: () => chiama('alunni_correzioni'),
    correzione: id => chiama('alunni_correzione', { p_id: id }),

    // La pagina «I miei lavori» indica quale lavoro aprire senza metterlo nell'URL.
    preparaApertura(id, path) {
        try { window.sessionStorage.setItem(CHIAVE_APRI, JSON.stringify({ id, path })); } catch { }
    },

    async apri(path) {
        let id = null;
        try {
            const richiesta = JSON.parse(window.sessionStorage.getItem(CHIAVE_APRI) || 'null');
            window.sessionStorage.removeItem(CHIAVE_APRI);
            if (richiesta && richiesta.path === path && typeof richiesta.id === 'string') id = richiesta.id;
        } catch { }
        return chiama('alunni_lavoro_apri', { p_page_path: path, p_id: id });
    },

    salva: (path, data, versione, id) =>
        chiama('alunni_lavoro_salva', { p_page_path: path, p_data: data, p_versione: versione || null, p_id: id || null }),

    // Bozza della sola scheda, per non perdere ciò che non è arrivato al server. Si recupera solo
    // su richiesta esplicita e solo se appartiene allo stesso alunno.
    salvaBozza(path, data) {
        try {
            const p = this.profiloSalvato();
            window.sessionStorage.setItem(PREFISSO_BOZZA + path, JSON.stringify({
                proprietario: p ? `${p.pseudonimo}|${p.classe}` : '', data, salvata: new Date().toISOString()
            }));
            return true;
        } catch { return false; }
    },

    leggiBozza(path) {
        try {
            const b = JSON.parse(window.sessionStorage.getItem(PREFISSO_BOZZA + path) || 'null');
            const p = this.profiloSalvato();
            if (!b || !p || b.proprietario !== `${p.pseudonimo}|${p.classe}`) return null;
            return b;
        } catch { return null; }
    },

    scartaBozza(path) {
        try { window.sessionStorage.removeItem(PREFISSO_BOZZA + path); } catch { }
    }
};

if (typeof window !== 'undefined') window.MOAreaAlunni = AreaAlunni;
