/*
 * Correzione comune delle verifiche online (sommative e intelligenza artificiale), sul modello della
 * verifica «L'operatore sociale»: commento per risposta, punti per sezione, voto, «Salva» riservato e
 * «Mostra all'alunno». Le risposte si leggono da public.progress con la sessione dell'Area docente.
 * Le domande si ricavano dalla pagina della verifica stessa, così non si copiano i testi.
 */
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const annoLabel = a => `${a}/${String((Number(a) + 1) % 100).padStart(2, '0')}`;
const STATI = { da_correggere: 'da correggere', bozza: 'corretta, riservata', visibile: 'visibile all’alunno' };
const chiama = (nome, args) => window.MODocente.chiama(nome, args);

let config = [];
let verifica = null;
let corrente = null;           // elaborato aperto
const domande = new Map();      // chiave verifica → { ordine: [campo], etichette: Map }

function regolaVoto(v, punti) {
    const r = v.voto || {};
    const max = v.sezioni.reduce((s, x) => s + x.max, 0);
    if (r.tipo === 'fasce') {
        const tondi = Math.round(punti);
        const f = r.fasce.find(([a, b]) => tondi >= a && tondi <= b);
        return f ? f[2] : '';
    }
    return String(Math.min(10, Math.round((punti * 10 / max) * 2) / 2)).replace('.', ',');
}

async function etichette(v) {
    if (domande.has(v.chiave)) return domande.get(v.chiave);
    const out = { ordine: [], etichette: new Map() };
    try {
        const html = await (await fetch(v.pagina, { cache: 'no-cache' })).text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script, style, nav, header, footer').forEach(n => n.remove());
        const pulisci = t => String(t || '').replace(/\s+/g, ' ').trim();
        let sezione = '';
        let quesito = '';
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
        for (let n = walker.currentNode; n; n = walker.nextNode()) {
            // Titoli di sezione e testi dei quesiti, nell'ordine della pagina.
            if (/^H[23]$/.test(n.tagName)) { const t = pulisci(n.textContent); if (t) { sezione = t.slice(0, 120); quesito = ''; } }
            if (/^H[45]$/.test(n.tagName) || n.matches('.question-text, .question-title, .domanda-testo, legend')) {
                const t = pulisci(n.textContent);
                if (t) quesito = t.slice(0, 240);
            }
            if (!n.matches('textarea, input[type="text"], input:not([type]), select, input[type="radio"], input[type="checkbox"]')) continue;
            const campo = n.name || n.id;
            if (!campo || out.etichette.has(campo)) continue;
            // Dettaglio vicino al campo: riga di tabella, etichetta del gruppo o etichetta collegata.
            let dettaglio = '';
            const riga = n.closest('tr');
            if (riga) {
                const prima = riga.querySelector('td, th');
                if (prima && !prima.contains(n)) dettaglio = pulisci(prima.textContent);
            }
            if (!dettaglio && n.id) dettaglio = pulisci(doc.querySelector(`label[for="${CSS.escape(n.id)}"]`)?.textContent);
            if (!dettaglio) {
                const gruppo = n.closest('.input-group, .form-group, .question-block, .domanda');
                const lab = gruppo?.querySelector('label');
                if (lab && !lab.contains(n)) dettaglio = pulisci(lab.textContent);
            }
            if (n.type === 'radio' || n.type === 'checkbox') dettaglio = dettaglio && !n.closest('label')?.contains(n) ? dettaglio : '';
            const testa = quesito || sezione;
            out.etichette.set(campo, [testa, dettaglio && dettaglio !== testa ? dettaglio.slice(0, 160) : ''].filter(Boolean).join(' — ') || campo);
            out.ordine.push(campo);
        }
    } catch { }
    domande.set(v.chiave, out);
    return out;
}

function testoRisposta(valore) {
    if (valore === null || valore === undefined || valore === '' || (Array.isArray(valore) && !valore.length)) return '';
    if (Array.isArray(valore)) return valore.join(', ');
    if (typeof valore === 'boolean') return valore ? 'sì' : 'no';
    if (typeof valore === 'object') return JSON.stringify(valore);
    return String(valore);
}

async function elenco() {
    $('vc-elaborato').hidden = true;
    $('vc-elenco').hidden = false;
    $('vc-elenco').innerHTML = '<p class="docente-muted">Caricamento…</p>';
    let righe;
    try { righe = await chiama('verifiche_docente_elaborati', { p_chiave: verifica.chiave }); }
    catch (e) { $('vc-elenco').innerHTML = `<p class="docente-notice">${esc(e.message)}</p>`; return; }
    if (!righe.length) { $('vc-elenco').innerHTML = '<p class="docente-muted">Nessun elaborato salvato per questa verifica.</p>'; return; }
    const anni = [...new Set(righe.map(r => r.school_year))];
    $('vc-elenco').innerHTML = anni.map(a => `<h3 class="vc-anno">Anno scolastico ${esc(annoLabel(a))}</h3><ul class="vc-lista">${
        righe.filter(r => r.school_year === a).map(r => `<li><button type="button" data-apri="${esc(r.id)}">
            <span><strong>${esc(String(r.class_code).toLowerCase())} · ${esc(String(r.student_code).toLowerCase())}</strong>
            <span class="docente-muted"> · salvato il ${esc(new Date(r.updated_at).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' }))}</span></span>
            <span class="vc-etichetta" data-stato="${esc(r.stato)}">${esc(STATI[r.stato] || r.stato)}</span></button></li>`).join('')
    }</ul>`).join('');
}

function bozzaDalModulo() {
    const sezioni = verifica.sezioni.map(s => {
        const punti = parseFloat(String($(`vc-punti-${s.id}`).value).replace(',', '.'));
        return { id: s.id, titolo: s.titolo, max: s.max, punti: Number.isFinite(punti) ? punti : null,
                 commento: $(`vc-comm-${s.id}`).value.trim() };
    });
    const totale = sezioni.reduce((t, s) => t + (s.punti || 0), 0);
    const commenti = [...document.querySelectorAll('[data-commento]')]
        .map(t => ({ campo: t.dataset.commento, etichetta: t.dataset.etichetta, commento: t.value.trim() }))
        .filter(c => c.commento);
    return {
        verifica: verifica.chiave, titolo: verifica.titolo, sezioni, totale,
        max: verifica.sezioni.reduce((t, s) => t + s.max, 0),
        voto_proposto: regolaVoto(verifica, totale), voto: $('vc-voto-finale').value.trim(),
        nota: $('vc-nota').value.trim(), commenti
    };
}

function aggiornaTotale() {
    const b = bozzaDalModulo();
    $('vc-totale').textContent = `Totale ${String(b.totale).replace('.', ',')} su ${b.max} · voto proposto ${b.voto_proposto || '—'}`;
    if (!$('vc-voto-finale').dataset.toccato) $('vc-voto-finale').value = b.voto_proposto;
}

function mostraStato(c) {
    const visibile = Boolean(c.pubblicata);
    $('vc-stato').textContent = visibile
        ? 'Correzione visibile all’alunno. Dopo una modifica premi di nuovo «Mostra all’alunno».'
        : (c.bozza ? 'Correzione salvata e riservata: l’alunno non la vede.' : 'Correzione da fare.');
    $('vc-ritira').hidden = !visibile;
}

async function apri(id) {
    let c;
    try { c = await chiama('verifiche_docente_apri', { p_id: id }); }
    catch (e) { alert(e.message); return; }
    corrente = c;
    const info = await etichette(verifica);
    const data = c.data || {};
    const bozza = c.bozza || {};
    const commenti = new Map((bozza.commenti || []).map(x => [x.campo, x.commento]));
    const campi = [...info.ordine.filter(k => Object.hasOwn(data, k)),
                   ...Object.keys(data).filter(k => !k.startsWith('_') && !info.ordine.includes(k))];
    $('vc-elaborato-titolo').textContent = `${String(c.class_code).toLowerCase()} · ${String(c.student_code).toLowerCase()} · ${annoLabel(c.school_year)}`;
    $('vc-risposte').innerHTML = campi.map(k => {
        const etichetta = info.etichette.get(k) || k;
        const testo = testoRisposta(data[k]);
        return `<div class="vc-risposta">
            <p class="vc-domanda">${esc(etichetta)}</p>
            ${testo ? `<p class="vc-testo">${esc(testo)}</p>` : '<p class="vc-testo vc-vuota">nessuna risposta</p>'}
            <label class="visually-hidden" for="vc-c-${esc(k)}">Commento</label>
            <textarea id="vc-c-${esc(k)}" rows="2" placeholder="Commento per l’alunno (facoltativo)" data-commento="${esc(k)}" data-etichetta="${esc(etichetta)}">${esc(commenti.get(k) || '')}</textarea>
        </div>`;
    }).join('') || '<p class="docente-muted">Nessuna risposta salvata.</p>';
    const perSezione = new Map((bozza.sezioni || []).map(s => [s.id, s]));
    $('vc-sezioni').innerHTML = verifica.sezioni.map(s => {
        const b = perSezione.get(s.id) || {};
        return `<div class="vc-sezione">
            <label for="vc-punti-${esc(s.id)}">${esc(s.titolo)} <span class="docente-muted">(max ${s.max})</span></label>
            <input id="vc-punti-${esc(s.id)}" type="text" inputmode="decimal" data-max="${s.max}" value="${b.punti ?? ''}">
            <textarea id="vc-comm-${esc(s.id)}" rows="2" placeholder="Commento sulla sezione">${esc(b.commento || '')}</textarea>
        </div>`;
    }).join('');
    $('vc-voto-finale').value = bozza.voto || '';
    $('vc-voto-finale').dataset.toccato = bozza.voto && bozza.voto !== bozza.voto_proposto ? '1' : '';
    $('vc-nota').value = bozza.nota || '';
    aggiornaTotale();
    mostraStato(c);
    $('vc-elenco').hidden = true;
    $('vc-elaborato').hidden = false;
    $('vc-elaborato-titolo').focus();
}

async function salva(mostra) {
    const b = bozzaDalModulo();
    for (const s of b.sezioni) {
        if (s.punti !== null && (s.punti < 0 || s.punti > s.max)) { alert(`${s.titolo}: i punti vanno da 0 a ${s.max}.`); return; }
    }
    if (mostra && (b.sezioni.some(s => s.punti === null) || !b.voto)) {
        alert('Per mostrarla all’alunno servono i punti di tutte le sezioni e il voto finale.');
        return;
    }
    try {
        const esito = await chiama('verifiche_docente_salva', { p_id: corrente.id, p_bozza: b, p_mostra: mostra, p_revisione: corrente.revisione });
        corrente.revisione = esito.revisione;
        corrente.bozza = b;
        if (mostra) corrente.pubblicata = b;
        mostraStato(corrente);
    } catch (e) {
        alert(e.hint === 'conflitto' ? 'Questa correzione è stata salvata da un’altra scheda: ricarica la pagina.' : e.message);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.MODocente?.token?.() && !localStorage.getItem('mo:docente-token')) { $('vc-accesso').hidden = false; return; }
    try { config = (await (await fetch('assets/verifiche-correzione.json?v=20261121', { cache: 'no-cache' })).json()).verifiche; }
    catch { $('vc-accesso').hidden = false; $('vc-accesso').textContent = 'Configurazione delle verifiche non disponibile.'; return; }
    $('vc-contenuto').hidden = false;
    $('vc-verifica').innerHTML = config.map(v => `<option value="${esc(v.chiave)}">${esc(v.titolo)}</option>`).join('');
    const scelta = new URLSearchParams(location.search).get('verifica');
    if (config.some(v => v.chiave === scelta)) $('vc-verifica').value = scelta;
    const cambia = () => {
        verifica = config.find(v => v.chiave === $('vc-verifica').value);
        $('vc-regola').textContent = `Regola del voto: ${verifica.voto.spiegazione}${verifica.voto.da_confermare ? ' (da confermare)' : ''}`;
        elenco();
    };
    $('vc-verifica').addEventListener('change', cambia);
    cambia();
    $('vc-elenco').addEventListener('click', e => { const b = e.target.closest('[data-apri]'); if (b) apri(b.dataset.apri); });
    $('vc-indietro').addEventListener('click', elenco);
    $('vc-sezioni').addEventListener('input', aggiornaTotale);
    $('vc-voto-finale').addEventListener('input', () => { $('vc-voto-finale').dataset.toccato = '1'; });
    $('vc-salva').addEventListener('click', () => salva(false));
    $('vc-mostra').addEventListener('click', () => { if (confirm('Rendere visibile la correzione all’alunno?')) salva(true); });
    $('vc-ritira').addEventListener('click', async () => {
        if (!confirm('Rendere di nuovo riservata la correzione? L’alunno non la vedrà più.')) return;
        try { await chiama('verifiche_docente_ritira', { p_id: corrente.id }); corrente.pubblicata = null; corrente.revisione += 1; mostraStato(corrente); }
        catch (e) { alert(e.message); }
    });
});
