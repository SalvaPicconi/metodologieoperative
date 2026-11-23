/*
 * Correzione dentro la pagina dell'attività (23 novembre 2026).
 *
 * Alunno: sotto ogni risposta corretta compare la correzione del docente e la risposta si blocca;
 * le risposte senza correzione restano scrivibili. Le correzioni che non riguardano un campo
 * (attività a scelta, gruppi di domande) stanno nel riquadro in testa alla pagina, con la nota.
 *
 * Docente: aprendo il lavoro dell'alunno dall'Area docente (?docente=1&doc_class=…&doc_student=…)
 * vede la stessa pagina con le risposte, e sotto ognuna la correzione modificabile; «Salva correzione»
 * la salva già visibile all'alunno.
 */
const RPC_URL = 'https://ruplzgcnheddmqqdephp.supabase.co/rest/v1/rpc/';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cGx6Z2NuaGVkZG1xcWRlcGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTYyMjksImV4cCI6MjA3NTY5MjIyOX0.tOLIkgi5yTt61_0rMlXUqxnbil4DLD7kBaqZBVAv1CI';
const CAMPI = 'input:not([type=hidden]):not([type=button]):not([type=submit]), textarea, select';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function rpc(nome, args) {
    const res = await fetch(RPC_URL + nome, {
        method: 'POST',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
    });
    if (!res.ok) throw new Error(`${nome}: ${res.status}`);
    const testo = await res.text();
    return testo ? JSON.parse(testo) : null;
}

// Percorso come lo salva il database: dalla radice del sito, senza il vecchio prefisso /metodologieoperative.
function normalizza(path) {
    let p = String(path || '').replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0];
    if (!p.startsWith('/')) p = '/' + p;
    if (p === '/metodologieoperative' || p.startsWith('/metodologieoperative/')) p = p.slice('/metodologieoperative'.length) || '/';
    return p.replace(/\/{2,}/g, '/');
}

async function configPagina(percorsi) {
    const url = new URL('./verifiche-correzione.json?v=20261123d', import.meta.url);
    const cfg = await (await fetch(url)).json();
    return (cfg.verifiche || []).find(v => v.tipo === 'compito' && v.pagina
        && percorsi.some(p => p === '/' + v.pagina)) || null;
}

function parametriDocente() {
    const p = new URLSearchParams(location.search);
    const flag = (p.get('docente') || '').toLowerCase();
    if (flag !== '1' && flag !== 'true') return null;
    const studente = (p.get('doc_student') || '').trim();
    return studente ? { studente, classe: (p.get('doc_class') || '').trim() } : null;
}

function codiceAlunno() {
    try { return localStorage.getItem('mo:code') || sessionStorage.getItem('mo:code') || ''; } catch { return ''; }
}

// Elementi della pagina che corrispondono a un campo salvato (per id o per name).
function elementiDi(campo) {
    if (!campo || /^(act|blocco|answers|openAnswers|case)\./.test(campo)) return [];
    const perNome = [...document.getElementsByName(campo)].filter(el => el.matches(CAMPI));
    if (perNome.length) return perNome;
    const el = document.getElementById(campo);
    return el && el.matches(CAMPI) ? [el] : [];
}

function haRisposta(els) {
    return els.some(el => {
        if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
        return String(el.value || '').trim() !== '';
    });
}

function blocca(els) {
    els.forEach(el => {
        el.setAttribute('readonly', '');
        if (el instanceof HTMLSelectElement || el.type === 'checkbox' || el.type === 'radio') el.disabled = true;
        el.classList.add('mo-corr-bloccato');
    });
}

// Dove mettere il riquadro: subito dopo il campo (o dopo l'etichetta che lo contiene; per un gruppo di caselle, dopo l'ultima).
function ancora(els) {
    const ultimo = els[els.length - 1];
    return ultimo.closest('label') || ultimo;
}

function stile() {
    if (document.getElementById('mo-corr-stile')) return;
    const s = document.createElement('style');
    s.id = 'mo-corr-stile';
    s.textContent = `
.mo-corr{margin:.45rem 0 1rem;padding:.65rem .85rem;border-left:4px solid #d6105f;background:#fff4f8;border-radius:8px;
  color:#17385a;font:inherit;font-size:.95rem;line-height:1.45;white-space:pre-line;text-align:left}
.mo-corr b{display:block;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase;color:#d6105f;margin-bottom:.2rem}
.mo-corr textarea{width:100%;min-height:4.5rem;box-sizing:border-box;font:inherit;border:1px solid #e3b7c9;border-radius:6px;padding:.45rem;background:#fff;white-space:pre-wrap}
.mo-corr-pannello{margin:1rem auto;max-width:1100px;padding:1rem 1.1rem;border:2px solid #d6105f;border-radius:12px;background:#fff;color:#17385a}
.mo-corr-pannello h2{margin:0 0 .4rem;font-size:1.2rem;color:#17385a}
.mo-corr-pannello .mo-corr{margin:.5rem 0}
.mo-corr-bloccato{background:#f5f6fa !important;cursor:default}
.mo-corr-agg{margin:.3rem 0 .9rem;font:inherit;font-size:.85rem;color:#d6105f;background:none;border:1px dashed #d6105f;border-radius:6px;padding:.25rem .6rem;cursor:pointer}
.mo-corr-salva{position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;gap:.6rem;align-items:center;background:#17385a;color:#fff;
  padding:.6rem .8rem;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.2);font-size:.9rem}
.mo-corr-salva button{font:inherit;font-weight:600;background:#d6105f;color:#fff;border:0;border-radius:8px;padding:.45rem .9rem;cursor:pointer}
@media (max-width:600px){.mo-corr-salva{left:16px}}`;
    document.head.appendChild(s);
}

function pannello() {
    let p = document.getElementById('mo-corr-pannello');
    if (p) return p;
    p = document.createElement('section');
    p.id = 'mo-corr-pannello';
    p.className = 'mo-corr-pannello';
    const dove = document.querySelector('main') || document.body;
    const titolo = dove.querySelector('h1');
    if (titolo && titolo.parentNode) titolo.parentNode.insertBefore(p, titolo.nextSibling);
    else dove.insertBefore(p, dove.firstChild);
    return p;
}

// ---------- Alunno ----------
function mostraAlunno(corr) {
    const commenti = Array.isArray(corr.commenti) ? corr.commenti : [];
    if (!commenti.length && !corr.nota) return;
    stile();
    const restanti = [];
    commenti.forEach(c => {
        const els = elementiDi(c.campo);
        if (!els.length) { restanti.push(c); return; }
        if (haRisposta(els)) blocca(els);
        const box = document.createElement('div');
        box.className = 'mo-corr';
        box.innerHTML = `<b>Correzione</b>${esc(c.commento)}`;
        ancora(els).insertAdjacentElement('afterend', box);
    });
    const p = pannello();
    p.innerHTML = `<h2>La correzione del docente</h2>
        ${corr.nota ? `<div class="mo-corr">${esc(corr.nota)}</div>` : ''}
        <p style="margin:.3rem 0;font-size:.9rem">Sotto ogni risposta corretta trovi il commento: quelle risposte sono chiuse.
        Le domande ancora senza risposta puoi completarle.</p>
        ${restanti.map(c => `<div class="mo-corr"><b>${esc(c.etichetta || c.campo)}</b>${esc(c.commento)}</div>`).join('')}`;
}

async function avviaAlunno(percorsi, statoProtetto, correzioneProtetta) {
    let corr = null;
    const prot = typeof statoProtetto === 'function' ? statoProtetto() : null;
    if (prot && prot.id && typeof correzioneProtetta === 'function') {
        try { corr = await correzioneProtetta(prot.id); } catch { corr = null; }
    } else {
        const codice = codiceAlunno().trim();
        if (!codice) return;
        cerca: for (const percorso of percorsi) {
            for (const c of [...new Set([codice.toLowerCase(), codice])]) {
                try { corr = await rpc('progress_correzione', { p_student_code: c, p_page_path: percorso }); } catch { corr = null; }
                if (corr) break cerca;
            }
        }
    }
    if (corr && typeof corr === 'object') mostraAlunno(corr);
}

// ---------- Docente ----------
async function caricaAccessoDocente() {
    if (window.MODocente) return;
    await new Promise((ok, ko) => {
        const s = document.createElement('script');
        s.src = new URL('./docente-accesso.js?v=20261121', import.meta.url).href;
        s.onload = ok; s.onerror = ko;
        document.head.appendChild(s);
    });
}

async function avviaDocente(cfg, doc) {
    await caricaAccessoDocente();
    if (!window.MODocente.attivo() && !(await window.MODocente.assicura('Password dell\'Area docente per correggere:'))) return;
    const righe = await window.MODocente.chiama('verifiche_docente_elaborati', { p_chiave: cfg.chiave }) || [];
    const mie = righe.filter(r => String(r.student_code).toLowerCase() === doc.studente.toLowerCase()
        && (!doc.classe || String(r.class_code).toLowerCase() === doc.classe.toLowerCase()));
    if (!mie.length) return;
    const anno = Math.max(...mie.map(r => r.school_year || 0));
    const riga = mie.find(r => (r.school_year || 0) === anno);
    const el = await window.MODocente.chiama('verifiche_docente_apri', { p_id: riga.id });
    if (!el) return;
    let revisione = el.revisione || 0;
    const base = el.bozza || el.pubblicata || { tipo: 'compito', verifica: cfg.chiave, titolo: cfg.titolo, nota: '', commenti: [] };
    const commenti = Array.isArray(base.commenti) ? base.commenti.map(c => ({ ...c })) : [];
    stile();

    // In questa vista le risposte dell'alunno non si toccano.
    blocca([...document.querySelectorAll(CAMPI)].filter(x => !x.closest('.mo-corr, .mo-corr-pannello, .mo-corr-salva')));

    const aree = [];
    const etichetta = campo => (cfg.etichette && cfg.etichette[campo]) || campo;
    const areaPer = c => {
        const box = document.createElement('div');
        box.className = 'mo-corr';
        box.innerHTML = `<b>Correzione${c.etichetta && !elementiDi(c.campo).length ? ' · ' + esc(c.etichetta) : ''}</b><textarea></textarea>`;
        const ta = box.querySelector('textarea');
        ta.value = c.commento || '';
        aree.push({ c, ta });
        return box;
    };
    const restanti = [];
    commenti.forEach(c => {
        const els = elementiDi(c.campo);
        if (!els.length) { restanti.push(c); return; }
        ancora(els).insertAdjacentElement('afterend', areaPer(c));
    });
    // Risposte date ma senza correzione: si può aggiungerla.
    const fatti = new Set(commenti.map(c => c.campo));
    const nascosti = (cfg.nascosti || []).map(n => n.startsWith('^') ? new RegExp(n) : n);
    const visti = new Set();
    document.querySelectorAll(CAMPI).forEach(x => {
        const campo = x.name || x.id;
        if (!campo || visti.has(campo) || fatti.has(campo) || x.closest('.mo-corr, .mo-corr-pannello, .mo-corr-salva')) return;
        if (nascosti.some(n => typeof n === 'string' ? n === campo : n.test(campo))) return;
        visti.add(campo);
        const els = elementiDi(campo);
        if (!els.length || !haRisposta(els)) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mo-corr-agg';
        b.textContent = '＋ Aggiungi correzione';
        b.addEventListener('click', () => {
            const c = { campo, etichetta: etichetta(campo), commento: '' };
            commenti.push(c);
            const box = areaPer(c);
            b.replaceWith(box);
            box.querySelector('textarea').focus();
        });
        ancora(els).insertAdjacentElement('afterend', b);
    });

    const p = pannello();
    p.innerHTML = `<h2>Correzione · ${esc(doc.studente)}</h2>
        <p style="margin:.2rem 0 .6rem;font-size:.9rem">Sotto ogni risposta c'è la correzione: modificala se serve e premi «Salva correzione».
        È già visibile all'alunno; le risposte corrette per lui sono chiuse.</p>
        <div class="mo-corr"><b>Nota generale</b><textarea id="mo-corr-nota"></textarea></div>`;
    p.querySelector('#mo-corr-nota').value = base.nota || '';
    restanti.forEach(c => p.appendChild(areaPer(c)));

    const barra = document.createElement('div');
    barra.className = 'mo-corr-salva';
    barra.innerHTML = `<span id="mo-corr-stato">Correzione visibile all'alunno</span><button type="button">Salva correzione</button>`;
    document.body.appendChild(barra);
    const stato = barra.querySelector('#mo-corr-stato');
    barra.querySelector('button').addEventListener('click', async () => {
        aree.forEach(({ c, ta }) => { c.commento = ta.value.trim(); });
        const bozza = { ...base, tipo: 'compito', verifica: cfg.chiave, titolo: base.titolo || cfg.titolo,
            nota: p.querySelector('#mo-corr-nota').value.trim(), commenti: commenti.filter(c => c.commento) };
        stato.textContent = 'Salvataggio…';
        try {
            const esito = await window.MODocente.chiama('verifiche_docente_salva',
                { p_id: riga.id, p_bozza: bozza, p_mostra: true, p_revisione: revisione });
            revisione = esito && esito.revisione != null ? esito.revisione : revisione + 1;
            stato.textContent = 'Salvata · visibile all\'alunno';
        } catch (errore) {
            stato.textContent = 'Non salvata: ' + (window.MODocente.messaggioErrore ? window.MODocente.messaggioErrore(errore) : errore.message);
        }
    });
}

export async function avviaCorrezione({ pagePath, statoProtetto, correzioneProtetta } = {}) {
    try {
        const percorsi = [...new Set([normalizza(location.pathname), normalizza(pagePath)])];
        const cfg = await configPagina(percorsi);
        if (!cfg) return;
        const doc = parametriDocente();
        if (doc) await avviaDocente(cfg, doc);
        else await avviaAlunno(percorsi, statoProtetto, correzioneProtetta);
    } catch (errore) {
        console.warn('[Correzione] non disponibile:', errore);
    }
}
