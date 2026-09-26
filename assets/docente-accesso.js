/*
 * Accesso docente del sito Metodologie Operative.
 *
 * La password non si controlla più nel browser: la verifica il database, che restituisce un
 * token di sessione valido 6 ore. Il token sta in questo browser (localStorage) e accompagna
 * ogni lettura delle risposte degli studenti. Senza token valido il database non restituisce
 * niente. Usato da area docente, statistiche Stroop e vista LIM delle pagine interattive.
 */
(function () {
    if (window.MODocente) return;

    const RPC_URL = 'https://ruplzgcnheddmqqdephp.supabase.co/rest/v1/rpc/';
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cGx6Z2NuaGVkZG1xcWRlcGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTYyMjksImV4cCI6MjA3NTY5MjIyOX0.tOLIkgi5yTt61_0rMlXUqxnbil4DLD7kBaqZBVAv1CI';
    const TOKEN_KEY = 'mo:docente-token';
    const VECCHIA_SESSIONE = 'mo:docente-session';

    async function rpc(nome, args) {
        const res = await fetch(RPC_URL + nome, {
            method: 'POST',
            headers: {
                apikey: ANON_KEY,
                Authorization: `Bearer ${ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(args || {})
        });
        const text = await res.text();
        let dati = null;
        try { dati = text ? JSON.parse(text) : null; } catch { dati = text; }
        if (!res.ok) {
            const errore = new Error((dati && dati.message) || `HTTP ${res.status}`);
            errore.code = dati && dati.code;
            errore.status = res.status;
            throw errore;
        }
        return dati;
    }

    function token() {
        try {
            const salvato = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
            if (salvato && salvato.token && Date.parse(salvato.scade) > Date.now()) return salvato.token;
        } catch { }
        return null;
    }

    function dimentica() {
        try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(VECCHIA_SESSIONE);
        } catch { }
    }

    async function accedi(password) {
        const righe = await rpc('progress_docente_accesso', { p_password: String(password || '') });
        const riga = Array.isArray(righe) ? righe[0] : righe;
        if (!riga || !riga.token) throw new Error('Accesso non riuscito');
        try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: riga.token, scade: riga.scade_il })); } catch { }
        return true;
    }

    function esci() {
        const t = token();
        dimentica();
        if (t) rpc('progress_docente_esci', { p_token: t }).catch(() => { });
    }

    async function chiama(nome, args) {
        const t = token();
        if (!t) {
            const errore = new Error('sessione docente scaduta');
            errore.code = '42501';
            throw errore;
        }
        try {
            return await rpc(nome, Object.assign({ p_token: t }, args || {}));
        } catch (errore) {
            if (errore.code === '42501') dimentica();
            throw errore;
        }
    }

    function messaggioErrore(errore) {
        if (!errore) return 'Accesso non riuscito.';
        if (errore.code === '28P01') return 'Password non corretta.';
        if (errore.code === '42501') return errore.message.includes('tentativi') ? 'Troppi tentativi sbagliati: riprova tra 15 minuti.' : 'Sessione docente scaduta: accedi di nuovo.';
        return errore.message || 'Accesso non riuscito.';
    }

    // Per le pagine che chiedono la password con una finestra semplice (modalità LIM)
    async function assicura(domanda) {
        if (token()) return true;
        const pw = window.prompt(domanda || 'Inserisci la password dell\'Area docente:');
        if (pw === null) return false;
        try {
            await accedi(pw);
            return true;
        } catch (errore) {
            window.alert(messaggioErrore(errore));
            return false;
        }
    }

    async function cambiaPassword(attuale, nuova) {
        return chiama('progress_docente_cambia_password', { p_attuale: attuale, p_nuova: nuova });
    }

    window.MODocente = {
        accedi,
        esci,
        chiama,
        assicura,
        cambiaPassword,
        messaggioErrore,
        attivo: () => Boolean(token())
    };
})();
