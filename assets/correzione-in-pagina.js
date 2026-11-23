/*
 * Correzione nella pagina dell'attività (decisione del titolare, 23/11/2026).
 *
 * - Docente: «Apri la correzione» apre la pagina vera dell'attività con le risposte di quell'elaborato
 *   (?docente=1&doc_class=…&doc_student=…&correzione=<id>). Sotto ogni risposta c'è il commento del
 *   docente, modificabile; in testa punti, voto (verifiche) e commento finale. Tutto si salva da solo.
 *   Ogni salvataggio è subito visibile all'alunno (decisione del titolare: correzioni sempre visibili).
 * - Alunno: aprendo la propria attività (da «I miei lavori») vede gli stessi commenti sotto le sue risposte.
 *
 * Dati: le risposte restano in public.progress; la correzione è in private.verifiche_correzioni
 * (supabase/verifiche-correzione.sql), letta con verifiche_docente_apri / alunni_correzione.
 * In modalità correzione progress.js legge le risposte da window.MOCorrezioneDati e non salva mai.
 * Si include con <script src="…/assets/correzione-in-pagina.js"> PRIMA di progress.js.
 * Gli elementi aggiunti non hanno name né id: collectData() di progress-global non li raccoglie.
 */
(function () {
    'use strict';
    if (window.MOCorrezioneAvviata) return;
    window.MOCorrezioneAvviata = true;

    const VERSIONE = '20261123d';
    const sorgente = document.currentScript && document.currentScript.src;
    if (!sorgente) return;
    const BASE = new URL('.', sorgente);
    const params = new URLSearchParams(location.search);
    const idCorrezione = params.get('correzione');
    const modoDocente = Boolean(idCorrezione) && params.get('docente') === '1'
        && /^[0-9a-f-]{36}$/i.test(idCorrezione);

    const NASCOSTI = ['openQuestionLabels', 'completed', 'current', 'caseIndex'];
    const ZONA = 'mo-corr';                       // classe di tutto ciò che aggiunge questo script

    // ---------- utilità ----------
    const pulisci = t => String(t || '').replace(/\s+/g, ' ').trim();
    function el(tag, classe, testo) {
        const n = document.createElement(tag);
        if (classe) n.className = classe;
        if (testo !== undefined && testo !== null) n.textContent = testo;
        return n;
    }
    function testoRisposta(v) {
        if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return '';
        if (Array.isArray(v)) return v.join(', ');
        if (typeof v === 'boolean') return v ? 'sì' : 'no';
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
    }
    function percorsoPagina() {
        let p = location.pathname;
        try { p = decodeURIComponent(p); } catch { }
        return p.replace(/^\/metodologieoperative(?=\/)/, '');
    }
    function stile() {
        if (document.getElementById('mo-corr-stile')) return;
        const s = el('style');
        s.id = 'mo-corr-stile';
        s.textContent = `
.mo-corr-box{margin:.5rem 0 1rem;padding:.6rem .8rem;border-left:4px solid #d6105f;background:#fdeef4;border-radius:.4rem;color:#4a0d27;font:inherit;text-align:left}
.mo-corr-box strong{display:block;font-size:.9rem;color:#9b0d47;margin-bottom:.25rem}
.mo-corr-box p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.mo-corr-box textarea{display:block;width:100%;box-sizing:border-box;min-height:3.2rem;padding:.45rem;border:1px solid #e6a3bf;border-radius:.3rem;font:inherit;background:#fff;color:#2a0a17;resize:vertical}
.mo-corr-pannello{margin:1rem auto;max-width:60rem;padding:1rem 1.2rem;border:2px solid #17385a;border-radius:.6rem;background:#fff;color:#17385a;text-align:left;font:inherit}
.mo-corr-pannello h2{margin:.1rem 0 .5rem;font-size:1.3rem;color:#17385a}
.mo-corr-pannello h3{margin:1rem 0 .4rem;font-size:1.05rem;color:#17385a}
.mo-corr-pannello label{display:block;font-weight:700;margin:.5rem 0 .2rem}
.mo-corr-pannello input,.mo-corr-pannello textarea{font:inherit;box-sizing:border-box;padding:.4rem;border:1px solid #9eb2cb;border-radius:.3rem;background:#fff;color:#17385a}
.mo-corr-pannello textarea{width:100%;min-height:3rem}
.mo-corr-pannello input{width:6.5rem}
.mo-corr-voto{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem 1rem;padding:.6rem .9rem;border-radius:.45rem;background:#17385a;color:#fff;font-weight:700;margin:.5rem 0}
.mo-corr-voto strong{font-size:1.7rem}
.mo-corr-sezioni{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr));gap:.6rem}
.mo-corr-sezione{border:1px solid #b3c6de;border-radius:.4rem;padding:.4rem .7rem .6rem;background:#f5f8fc}
.mo-corr-sezione p{margin:.2rem 0;white-space:pre-wrap}
.mo-corr-azioni{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-top:.8rem}
.mo-corr-azioni button{font:inherit;cursor:pointer;padding:.5rem .9rem;border-radius:.4rem;border:1px solid #17385a;background:#fff;color:#17385a}
.mo-corr-azioni button.mo-corr-primario{background:#d6105f;border-color:#d6105f;color:#fff}
.mo-corr-stato{font-weight:700;margin:.3rem 0}
.mo-corr-salvataggio{position:fixed;left:.8rem;bottom:.8rem;z-index:9999;padding:.35rem .7rem;border-radius:.4rem;background:#17385a;color:#fff;font:600 .85rem/1.3 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.2)}
.mo-corr-altri .mo-corr-box{background:#fff7fa}
.mo-corr-domanda{font-weight:700;margin:.2rem 0}
.mo-corr-campo-bloccato{opacity:.95}
body[data-mo-correzione="docente"] #mo-salva,body[data-mo-correzione="docente"] #mo-barra .mo-stato{display:none!important}
`;
        document.head.appendChild(s);
    }

    // ---------- configurazione delle pagine correggibili ----------
    let configPromise = null;
    function config() {
        if (!configPromise) {
            configPromise = fetch(new URL(`verifiche-correzione.json?v=${VERSIONE}`, BASE), { cache: 'no-cache' })
                .then(r => r.json()).then(j => j.verifiche || []).catch(() => []);
        }
        return configPromise;
    }
    async function verificaDellaPagina(chiave) {
        const elenco = await config();
        if (chiave) return elenco.find(v => v.chiave === chiave) || null;
        const qui = percorsoPagina();
        return elenco.find(v => [v.pagina, ...(v.alias || [])].some(p => qui === '/' + String(p).replace(/^\//, ''))) || null;
    }

    // Campi dell'elaborato come [percorso, valore]; stessa logica della vista elenco (verifiche-correzione.js).
    function campiPiatti(data, v) {
        const nascosti = [...NASCOSTI, ...((v && v.nascosti) || [])];
        const fuori = k => k.split('.').some(p => p.startsWith('_') || /^stat(e|o_)/.test(p))
            || nascosti.some(n => n.startsWith('^') ? new RegExp(n).test(k) : k === n || k.startsWith(`${n}.`));
        const espandi = ['openAnswers', ...((v && v.espandi) || [])];
        const out = [];
        const visita = (valore, percorso) => {
            if (fuori(percorso)) return;
            const separa = Array.isArray(valore) && espandi.some(n => percorso === n || percorso.startsWith(`${n}.`));
            if (valore && typeof valore === 'object' && (!Array.isArray(valore) || separa)) {
                for (const [k, x] of Object.entries(valore)) visita(x, percorso ? `${percorso}.${k}` : k);
            } else out.push([percorso, valore]);
        };
        for (const [k, x] of Object.entries(data || {})) visita(x, k);
        return out;
    }

    // ---------- dove sta un campo nella pagina ----------
    const fuoriZona = n => !n.closest(`.${ZONA}, #mo-barra, #mo-area-avviso`);
    function elementiDelCampo(campo, v) {
        const mappa = (v && v.campi) || {};
        for (const [regola, modello] of Object.entries(mappa)) {
            const m = new RegExp(regola).exec(campo);
            if (!m) continue;
            const selettore = modello.replace(/\$(\d)/g, (_, i) => CSS.escape(m[Number(i)] || ''));
            try { return [...document.querySelectorAll(selettore)].filter(fuoriZona); } catch { return []; }
        }
        let gruppo = [...document.getElementsByName(campo)].filter(n => /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName) && fuoriZona(n));
        if (!gruppo.length) {
            const perId = document.getElementById(campo);
            if (perId && fuoriZona(perId)) gruppo = [perId];
        }
        if (!gruppo.length) {
            try { gruppo = [...document.querySelectorAll(`[data-id="${CSS.escape(campo)}"]`)].filter(fuoriZona); } catch { }
        }
        return gruppo;
    }
    function antenatoComune(nodi) {
        let a = nodi[0].parentElement;
        while (a && !nodi.every(n => a.contains(n))) a = a.parentElement;
        return a;
    }
    // Inserisce il riquadro del commento sotto la risposta (o in fondo al gruppo di scelte).
    function inserisci(gruppo, box) {
        if (gruppo.length > 1) {
            const contenitore = antenatoComune(gruppo);
            if (contenitore && !/^(BODY|MAIN|FORM|HTML)$/.test(contenitore.tagName)) { contenitore.append(box); return; }
            gruppo[gruppo.length - 1].after(box);
            return;
        }
        const n = gruppo[0];
        if (n.type === 'hidden' || getComputedStyle(n).display === 'none') { (n.parentElement || n).append(box); return; }
        const etichetta = n.closest('label');
        if (etichetta && etichetta.querySelectorAll('input,textarea,select').length === 1) { etichetta.after(box); return; }
        n.after(box);
    }
    function etichettaDom(gruppo) {
        const n = gruppo[0];
        if (gruppo.length === 1 && n.id) {
            const l = document.querySelector(`label[for="${CSS.escape(n.id)}"]`);
            if (l && pulisci(l.textContent)) return pulisci(l.textContent).slice(0, 240);
        }
        const base = gruppo.length > 1 ? antenatoComune(gruppo) : n;
        const blocco = base && base.closest('.open-question, .case-field, .question, .question-block, .domanda, fieldset, .form-group, .input-group, li, tr, .card, section');
        if (blocco) {
            const t = blocco.querySelector('legend, h2, h3, h4, h5, .question-text, .question-title, .domanda-testo, label, strong, p');
            if (t && pulisci(t.textContent)) return pulisci(t.textContent).slice(0, 240);
        }
        return '';
    }

    // Le verifiche si aprono con una password di classe: chi guarda una correzione entra direttamente.
    function sbloccaPagina() {
        const blocco = document.getElementById('lock-screen');
        if (blocco) {
            blocco.style.display = 'none';
            const contenuto = document.getElementById('verification-content');
            if (contenuto) contenuto.style.display = 'block';
            const stampa = document.getElementById('print-actions');
            if (stampa) stampa.style.display = 'flex';
        }
        if (typeof window.sbloccaVerifica === 'function') { try { window.sbloccaVerifica(true); } catch { } }
    }

    // ================================================================
    // DOCENTE
    // ================================================================
    function assicuraDocente() {
        if (window.MODocente) return Promise.resolve();
        return new Promise(risolvi => {
            const s = el('script');
            s.src = new URL('docente-accesso.js?v=20261121', BASE).href;
            s.onload = s.onerror = () => risolvi();
            document.head.appendChild(s);
        });
    }

    if (modoDocente) {
        const elaborato = assicuraDocente().then(() => {
            if (!window.MODocente || !window.MODocente.attivo()) return null;
            return window.MODocente.chiama('verifiche_docente_apri', { p_id: idCorrezione });
        }).catch(errore => { console.warn('[Correzione] elaborato non disponibile:', errore); return null; });
        // progress.js usa queste risposte al posto di quelle dell'anno corrente.
        window.MOCorrezioneDati = elaborato.then(c => (c && c.data) || null);
        const pronto = () => avviaDocente(elaborato);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pronto); else pronto();
    } else {
        // L'ascolto parte subito: progress.js annuncia il lavoro aperto («mo:area-alunni») appena lo carica.
        avviaAlunno();
    }

    async function avviaDocente(elaboratoPromise) {
        stile();
        document.body.setAttribute('data-mo-correzione', 'docente');
        const c = await elaboratoPromise;
        const pannello = el('section', `mo-corr-pannello ${ZONA}`);
        pannello.setAttribute('aria-label', 'Correzione del docente');
        (document.querySelector('main') || document.body).prepend(pannello);
        if (!c) {
            pannello.append(el('h2', null, 'Correzione'),
                el('p', null, 'Per correggere entra prima nell’Area docente con la tua password, poi riapri la correzione da lì.'));
            const a = el('a', null, 'Vai all’Area docente');
            a.href = new URL('../area_docente.html', BASE).href;
            pannello.append(a);
            return;
        }
        sbloccaPagina();
        // Verifica sull'IA: all'apertura ricarica anche le risposte rimaste in questo browser; si rimettono
        // quelle dell'elaborato.
        const rimetti = () => {
            if (typeof window.applySnapshotToForm === 'function' && c.data && c.data.inputs) {
                try { window.applySnapshotToForm(c.data); } catch { }
            }
        };
        window.addEventListener('mo:progress-restored', () => setTimeout(rimetti, 0));
        setTimeout(rimetti, 800);
        const v = await verificaDellaPagina(c.chiave);
        const compito = (v && v.tipo === 'compito') || (c.bozza && c.bozza.tipo === 'compito');
        const bozza = c.bozza ? JSON.parse(JSON.stringify(c.bozza)) : {};
        let revisione = c.revisione || 0;
        let visibile = Boolean(c.pubblicata);
        let bloccato = false;                       // conflitto con un'altra scheda

        const piatti = new Map(campiPiatti(c.data, v));
        const commenti = new Map();                 // campo → { etichetta, commento, risposta }
        (bozza.commenti || []).forEach(k => commenti.set(k.campo, { etichetta: k.etichetta || '', commento: k.commento || '', risposta: k.risposta }));
        // Ordine della pagina: prima le risposte salvate, poi i commenti per blocco.
        const ordine = [...piatti.keys()];
        for (const k of (bozza.commenti || []).map(x => x.campo)) if (!ordine.includes(k)) ordine.push(k);
        // Campi da commentare: le risposte date e quelle già commentate.
        const daCommentare = ordine.filter(k => commenti.has(k) || testoRisposta(piatti.get(k)));

        // --- pannello in testa ---
        const anno = Number(c.school_year);
        pannello.append(el('h2', null, `Correzione · ${String(c.class_code).toLowerCase()} · ${String(c.student_code).toLowerCase()} · ${anno}/${String((anno + 1) % 100).padStart(2, '0')}`));
        pannello.append(el('p', null, 'Questa è la pagina dell’alunno con le sue risposte, che qui non si possono modificare. Scrivi i commenti nei riquadri rosa sotto le risposte: si salvano da soli e l’alunno li vede subito.'));
        const statoVis = el('p', 'mo-corr-stato');
        statoVis.setAttribute('role', 'status');
        pannello.append(statoVis);

        const sezioniInput = [];
        let votoInput = null;
        let totaleP = null;
        if (!compito && v && Array.isArray(v.sezioni)) {
            pannello.append(el('h3', null, 'Valutazione per sezione'));
            const griglia = el('div', 'mo-corr-sezioni');
            const perSezione = new Map((bozza.sezioni || []).map(s => [s.id, s]));
            v.sezioni.forEach(s => {
                const b = perSezione.get(s.id) || {};
                const box = el('div', 'mo-corr-sezione');
                const lp = el('label', null, `${s.titolo} (max ${s.max})`);
                const punti = el('input');
                punti.type = 'text'; punti.inputMode = 'decimal'; punti.maxLength = 5;
                punti.setAttribute('aria-label', `Punti: ${s.titolo}`);
                punti.value = b.punti === null || b.punti === undefined ? '' : String(b.punti).replace('.', ',');
                const comm = el('textarea');
                comm.rows = 2; comm.placeholder = 'Commento sulla sezione';
                comm.setAttribute('aria-label', `Commento: ${s.titolo}`);
                comm.value = b.commento || '';
                box.append(lp, punti, comm);
                griglia.append(box);
                sezioniInput.push({ s, punti, comm });
            });
            pannello.append(griglia);
            totaleP = el('p');
            const lv = el('label', null, 'Voto finale');
            votoInput = el('input');
            votoInput.type = 'text'; votoInput.inputMode = 'decimal'; votoInput.maxLength = 6;
            votoInput.setAttribute('aria-label', 'Voto finale');
            votoInput.value = bozza.voto || '';
            votoInput.dataset.toccato = bozza.voto && bozza.voto !== bozza.voto_proposto ? '1' : '';
            votoInput.addEventListener('input', () => { votoInput.dataset.toccato = '1'; });
            pannello.append(totaleP, lv, votoInput);
        }
        const ln = el('label', null, 'Commento finale per l’alunno');
        const nota = el('textarea');
        nota.rows = 3;
        nota.setAttribute('aria-label', 'Commento finale per l’alunno');
        nota.value = bozza.nota || '';
        pannello.append(ln, nota);

        const altri = el('div', 'mo-corr-altri');
        pannello.append(altri);

        const azioni = el('div', 'mo-corr-azioni');
        const elenco = el('a', null, 'Torna all’elenco');
        elenco.href = new URL(`../verifiche_correzione.html?verifica=${encodeURIComponent(c.chiave)}&classe=${encodeURIComponent(c.class_code)}&anno=${encodeURIComponent(c.school_year)}`, BASE).href;
        azioni.append(elenco);
        pannello.append(azioni);

        const indicatore = el('div', `mo-corr-salvataggio ${ZONA}`, 'Correzione caricata');
        indicatore.setAttribute('aria-live', 'polite');
        document.body.append(indicatore);

        function regolaVoto(punti) {
            const r = (v && v.voto) || {};
            const max = v.sezioni.reduce((t, x) => t + x.max, 0);
            if (r.tipo === 'fasce') {
                const tondi = Math.round(punti);
                const f = (r.fasce || []).find(([a, b]) => tondi >= a && tondi <= b);
                return f ? f[2] : '';
            }
            return String(Math.min(10, Math.round((punti * 10 / max) * 2) / 2)).replace('.', ',');
        }
        function aggiornaStato() {
            statoVis.textContent = bloccato
                ? 'Questa correzione è stata modificata da un’altra scheda: ricarica la pagina prima di continuare.'
                : 'La correzione è visibile all’alunno: ogni modifica gli arriva appena salvata.';
        }
        function costruisciBozza() {
            const lista = ordine.filter(k => commenti.has(k) && pulisci(commenti.get(k).commento))
                .map(k => {
                    const x = commenti.get(k);
                    const risposta = piatti.has(k) ? testoRisposta(piatti.get(k)).slice(0, 4000) : x.risposta;
                    return { campo: k, etichetta: x.etichetta || (v && v.etichette && v.etichette[k]) || k,
                             commento: x.commento.trim(), ...(risposta ? { risposta } : {}) };
                });
            const titolo = bozza.titolo || (v && v.titolo) || '';
            if (compito) return { tipo: 'compito', verifica: c.chiave, titolo, nota: nota.value.trim(), commenti: lista };
            const sezioni = sezioniInput.map(({ s, punti, comm }) => {
                const n = parseFloat(String(punti.value).replace(',', '.'));
                return { id: s.id, titolo: s.titolo, max: s.max, punti: Number.isFinite(n) ? n : null, commento: comm.value.trim() };
            });
            const totale = sezioni.reduce((t, s) => t + (s.punti || 0), 0);
            const max = sezioni.reduce((t, s) => t + s.max, 0);
            const proposto = v ? regolaVoto(totale) : (bozza.voto_proposto || '');
            if (votoInput && !votoInput.dataset.toccato) votoInput.value = proposto;
            if (totaleP) totaleP.textContent = `Totale ${String(totale).replace('.', ',')} su ${max} · voto proposto ${proposto || '—'}`;
            return { verifica: c.chiave, titolo, sezioni, totale, max, voto_proposto: proposto,
                     voto: votoInput ? votoInput.value.trim() : (bozza.voto || ''), nota: nota.value.trim(), commenti: lista };
        }

        // --- salvataggio automatico ---
        let timer = null;
        let coda = Promise.resolve();
        let sporco = false;
        function segna(messaggio) { indicatore.textContent = messaggio; }
        function programma() {
            if (bloccato) return;
            sporco = true;
            segna('Modifiche da salvare…');
            clearTimeout(timer);
            timer = setTimeout(() => salva(true), 1000);
        }
        function salva(pubblica) {
            clearTimeout(timer);
            coda = coda.then(async () => {
                if (bloccato) return false;
                const b = costruisciBozza();
                for (const s of b.sezioni || []) {
                    if (s.punti !== null && (s.punti < 0 || s.punti > s.max)) {
                        segna(`Controlla i punti: ${s.titolo} va da 0 a ${s.max}.`);
                        return false;
                    }
                }
                sporco = false;
                segna('Salvataggio…');
                try {
                    const esito = await window.MODocente.chiama('verifiche_docente_salva',
                        { p_id: c.id, p_bozza: b, p_mostra: Boolean(pubblica), p_revisione: revisione });
                    revisione = esito.revisione;
                    visibile = Boolean(esito.visibile);
                    aggiornaStato();
                    segna(`Salvato alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · visibile all’alunno`);
                    return true;
                } catch (e) {
                    sporco = true;
                    if (e.code === '40001') { bloccato = true; aggiornaStato(); segna('Non salvato: ricarica la pagina.'); }
                    else segna(`Non salvato: ${window.MODocente.messaggioErrore(e)}`);
                    return false;
                }
            });
            return coda;
        }
        window.addEventListener('beforeunload', e => { if (sporco) { e.preventDefault(); e.returnValue = ''; } });

        pannello.addEventListener('input', e => { if (e.target.closest('.mo-corr-sezioni') || e.target === nota || e.target === votoInput) programma(); });
        // --- riquadri dei commenti sotto le risposte ---
        const riquadri = new Map();                 // campo → elemento
        function riquadro(campo, gruppo) {
            const x = commenti.get(campo) || { etichetta: '', commento: '' };
            if (!commenti.has(campo)) commenti.set(campo, x);
            if (!x.etichetta && gruppo) x.etichetta = (v && v.etichette && v.etichette[campo]) || etichettaDom(gruppo) || campo;
            const box = el('div', `mo-corr-box ${ZONA}`);
            box.dataset.campo = campo;
            const t = el('textarea');
            t.rows = 2;
            t.placeholder = 'Commento per l’alunno (facoltativo)';
            t.setAttribute('aria-label', `Commento del docente: ${x.etichetta || campo}`);
            t.value = x.commento;
            t.addEventListener('input', () => {
                x.commento = t.value;
                document.querySelectorAll(`.${ZONA} textarea[data-copia="${CSS.escape(campo)}"]`).forEach(o => { if (o !== t) o.value = t.value; });
                programma();
            });
            box.append(el('strong', null, 'Commento del docente'), t);
            return box;
        }
        function bloccaRisposte() {
            document.querySelectorAll('input, textarea, select').forEach(n => {
                if (!fuoriZona(n) || n.dataset.moCorrBloccato) return;
                n.dataset.moCorrBloccato = '1';
                n.classList.add('mo-corr-campo-bloccato');
                if (n.tagName === 'SELECT' || n.type === 'radio' || n.type === 'checkbox') n.disabled = true;
                else if (n.type !== 'hidden' && n.type !== 'button' && n.type !== 'submit') n.readOnly = true;
            });
        }
        let ultimiAltri = '';
        function disponi() {
            bloccaRisposte();
            for (const campo of daCommentare) {
                const esistente = riquadri.get(campo);
                if (esistente && esistente.isConnected) continue;
                const gruppo = elementiDelCampo(campo, v);
                if (!gruppo.length) continue;
                const box = riquadro(campo, gruppo);
                inserisci(gruppo, box);
                riquadri.set(campo, box);
            }
            // Commenti che ora non hanno un posto nella pagina (parte non visibile, commenti per blocco).
            const fuori = ordine.filter(k => commenti.has(k) && pulisci(commenti.get(k).commento) && !(riquadri.get(k) && riquadri.get(k).isConnected));
            const firma = fuori.join('|');
            if (firma === ultimiAltri || altri.contains(document.activeElement)) return;
            ultimiAltri = firma;
            altri.replaceChildren();
            if (!fuori.length) return;
            altri.append(el('h3', null, 'Commenti su parti che ora non sono in vista'),
                el('p', null, 'Compaiono anche sotto le risposte quando apri quella parte della pagina.'));
            for (const k of fuori) {
                const x = commenti.get(k);
                const box = el('div', 'mo-corr-box');
                box.append(el('p', 'mo-corr-domanda', x.etichetta || k));
                const t = el('textarea');
                t.rows = 2;
                t.dataset.copia = k;
                t.setAttribute('aria-label', `Commento del docente: ${x.etichetta || k}`);
                t.value = x.commento;
                t.addEventListener('input', () => { x.commento = t.value; programma(); });
                box.append(t);
                altri.append(box);
            }
        }
        let attesa = null;
        new MutationObserver(muta => {
            if (muta.every(m => [...m.addedNodes, ...m.removedNodes].every(n => n.nodeType !== 1 || n.classList.contains(ZONA)))) return;
            clearTimeout(attesa);
            attesa = setTimeout(disponi, 120);
        }).observe(document.body, { childList: true, subtree: true });
        costruisciBozza();
        aggiornaStato();
        disponi();
        // Le pagine che ricostruiscono le risposte dopo il caricamento: un secondo giro.
        setTimeout(disponi, 1500);
    }

    // ================================================================
    // ALUNNO
    // ================================================================
    function avviaAlunno() {
        let caricato = null;
        window.addEventListener('mo:area-alunni', async e => {
            const d = e.detail;
            if (!d || !d.id || caricato === d.id) return;
            caricato = d.id;
            const v = await verificaDellaPagina();
            if (!v) return;
            let correzione = null;
            try {
                const modulo = await import(new URL('alunni-sessione.js?v=20261122', BASE).href);
                correzione = await modulo.AreaAlunni.correzione(d.id);
            } catch { correzione = null; }
            if (!correzione || typeof correzione !== 'object') return;
            if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
            mostraAlunno(correzione, v);
        });
    }

    function mostraAlunno(c, v) {
        stile();
        sbloccaPagina();
        document.body.setAttribute('data-mo-correzione', 'alunno');
        const compito = c.tipo === 'compito';
        const pannello = el('section', `mo-corr-pannello ${ZONA}`);
        pannello.setAttribute('aria-label', 'Correzione del docente');
        pannello.append(el('h2', null, compito ? 'Il tuo lavoro corretto' : 'La tua verifica corretta'));
        if (!compito) {
            const voto = el('div', 'mo-corr-voto');
            voto.append(el('span', null, 'Voto'), el('strong', null, c.voto || '—'));
            const somma = (c.sezioni || []).reduce((t, x) => t + (Number(x.punti) || 0), 0);
            const totale = (c.sezioni || []).length ? somma : c.totale;
            if (c.max) voto.append(el('span', null, `Punti ${String(totale ?? '—').replace('.', ',')} su ${c.max}`));
            pannello.append(voto);
        }
        if (c.nota) {
            const n = el('div', 'mo-corr-box');
            n.append(el('strong', null, 'Commento del docente'), el('p', null, c.nota));
            pannello.append(n);
        }
        if ((c.sezioni || []).length) {
            const g = el('div', 'mo-corr-sezioni');
            c.sezioni.forEach(s => {
                const b = el('div', 'mo-corr-sezione');
                b.append(el('p', 'mo-corr-domanda', `${s.titolo}: ${s.punti === null || s.punti === undefined ? '—' : String(s.punti).replace('.', ',')} su ${s.max}`));
                if (s.commento) b.append(el('p', null, s.commento));
                g.append(b);
            });
            pannello.append(g);
        }
        const commenti = (c.commenti || []).filter(k => pulisci(k.commento));
        if (commenti.length) pannello.append(el('p', null, 'Trovi i commenti del docente nei riquadri rosa sotto le tue risposte.'));
        const altri = el('div', 'mo-corr-altri');
        pannello.append(altri);
        (document.querySelector('main') || document.body).prepend(pannello);

        const riquadri = new Map();
        let ultimiAltri = null;
        function disponi() {
            for (const k of commenti) {
                const esistente = riquadri.get(k.campo);
                if (esistente && esistente.isConnected) continue;
                const gruppo = elementiDelCampo(k.campo, v);
                if (!gruppo.length) continue;
                const box = el('div', `mo-corr-box ${ZONA}`);
                box.append(el('strong', null, 'Commento del docente'), el('p', null, k.commento));
                inserisci(gruppo, box);
                riquadri.set(k.campo, box);
            }
            const fuori = commenti.filter(k => !(riquadri.get(k.campo) && riquadri.get(k.campo).isConnected));
            const firma = fuori.map(k => k.campo).join('|');
            if (firma === ultimiAltri) return;
            ultimiAltri = firma;
            altri.replaceChildren();
            if (!fuori.length) return;
            altri.append(el('h3', null, 'Altri commenti'));
            for (const k of fuori) {
                const b = el('div', 'mo-corr-box');
                b.append(el('p', 'mo-corr-domanda', k.etichetta || ''));
                if (k.risposta) b.append(el('p', null, `La tua risposta: ${k.risposta}`));
                b.append(el('strong', null, 'Commento del docente'), el('p', null, k.commento));
                altri.append(b);
            }
        }
        let attesa = null;
        new MutationObserver(muta => {
            if (muta.every(m => [...m.addedNodes, ...m.removedNodes].every(n => n.nodeType !== 1 || n.classList.contains(ZONA)))) return;
            clearTimeout(attesa);
            attesa = setTimeout(disponi, 120);
        }).observe(document.body, { childList: true, subtree: true });
        disponi();
        setTimeout(disponi, 1500);
    }
})();
