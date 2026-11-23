/*
 * Correzione comune delle verifiche online (sommative e intelligenza artificiale), sul modello della
 * verifica «L'operatore sociale»: commento per risposta, punti per sezione, voto, «Salva» riservato e
 * «Mostra all'alunno». Le risposte si leggono da public.progress con la sessione dell'Area docente.
 * Le domande si ricavano dalla pagina della verifica stessa, così non si copiano i testi.
 * I compiti («tipo": "compito" in verifiche-correzione.json) usano lo stesso flusso senza punti né voto:
 * un commento per risposta, commenti per blocco (es. domande a scelta) e un commento finale.
 * Le risposte annidate (es. openAnswers del ripasso) si leggono come percorsi «chiave.sottochiave».
 */
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const annoLabel = a => `${a}/${String((Number(a) + 1) % 100).padStart(2, '0')}`;
const STATI = { da_correggere: 'da correggere', bozza: 'corretta, riservata', visibile: 'visibile all’alunno' };
const chiama = (nome, args) => window.MODocente.chiama(nome, args);

let config = [];
let verifica = null;
let corrente = null;           // elaborato aperto
let righe = [];                // elaborati della verifica scelta (tutti gli anni e le classi)
const compito = () => verifica?.tipo === 'compito';
const siglaClasse = c => String(c || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const NASCOSTI = ['openQuestionLabels', 'completed', 'current', 'caseIndex'];
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

// Campi dell'elaborato come coppie [percorso, valore]; gli oggetti annidati diventano «a.b.c».
function campiPiatti(data) {
    const nascosti = [...NASCOSTI, ...(verifica.nascosti || [])];
    // «nascosti»: nomi esatti, prefissi «a.b» o espressioni regolari che iniziano con ^.
    const fuori = k => k.split('.').some(p => p.startsWith('_') || /^stat(e|o_)/.test(p)) || nascosti.some(n => n.startsWith('^') ? new RegExp(n).test(k) : k === n || k.startsWith(`${n}.`));
    // Elenchi di risposte (una per domanda) da separare; gli altri elenchi (caselle spuntate) restano interi.
    const espandi = ['openAnswers', ...(verifica.espandi || [])];
    const out = [];
    const visita = (valore, percorso) => {
        if (fuori(percorso)) return;
        const separa = Array.isArray(valore) && espandi.some(n => percorso === n || percorso.startsWith(`${n}.`));
        if (valore && typeof valore === 'object' && (!Array.isArray(valore) || separa)) {
            for (const [k, v] of Object.entries(valore)) visita(v, percorso ? `${percorso}.${k}` : k);
        } else out.push([percorso, valore]);
    };
    for (const [k, v] of Object.entries(data || {})) visita(v, k);
    return out;
}

// Etichetta di un campo: configurazione, pagina, domande salvate con l'elaborato, bozza.
function etichettaCampo(campo, info, data, bozzaEtichette) {
    const daConfig = verifica.etichette?.[campo];
    if (daConfig) return daConfig;
    const daPagina = info.etichette.get(campo);
    if (daPagina) return daPagina;
    const m = /^openAnswers\.(\d+)\.(\d+)$/.exec(campo);
    const salvata = m && data?.openQuestionLabels?.[m[1]]?.[m[2]];
    if (salvata) return `Missione ${Number(m[1]) + 1} · ${salvata}`;
    return bozzaEtichette.get(campo) || campo;
}

async function elenco() {
    $('vc-elaborato').hidden = true;
    $('vc-elenco').hidden = false;
    $('vc-elenco').innerHTML = '<p class="docente-muted">Caricamento…</p>';
    try { righe = await chiama('verifiche_docente_elaborati', { p_chiave: verifica.chiave }); }
    catch (e) { righe = []; $('vc-elenco').innerHTML = `<p class="docente-notice">${esc(e.message)}</p>`; return; }
    filtri();
    disegnaElenco();
}

// Anni e classi presenti negli elaborati; si conserva la scelta se ancora disponibile.
function filtri() {
    const params = new URLSearchParams(location.search);
    const anni = [...new Set(righe.map(r => r.school_year))].sort((a, b) => b - a);
    const annoPrima = $('vc-anno').value || params.get('anno') || '';
    $('vc-anno').innerHTML = anni.map(a => `<option value="${esc(a)}">${esc(annoLabel(a))}</option>`).join('') + '<option value="">tutti</option>';
    $('vc-anno').value = anni.map(String).includes(annoPrima) || annoPrima === '' && $('vc-anno').dataset.scelto ? annoPrima : String(anni[0] ?? '');
    const classi = [...new Set(righe.filter(r => !$('vc-anno').value || String(r.school_year) === $('vc-anno').value)
        .map(r => siglaClasse(r.class_code)))].sort((a, b) => b.localeCompare(a, 'it', { numeric: true }));
    const classePrima = $('vc-classe').value || siglaClasse(params.get('classe'));
    $('vc-classe').innerHTML = '<option value="">tutte</option>' + classi.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    $('vc-classe').value = classi.includes(classePrima) ? classePrima : '';
}

function disegnaElenco() {
    const anno = $('vc-anno').value;
    const classe = $('vc-classe').value;
    const scelte = righe.filter(r => (!anno || String(r.school_year) === anno) && (!classe || siglaClasse(r.class_code) === classe));
    if (!scelte.length) { $('vc-elenco').innerHTML = `<p class="docente-muted">Nessun elaborato salvato per ${compito() ? 'questo compito' : 'questa verifica'}${classe || anno ? ' con questi filtri' : ''}.</p>`; return; }
    const anni = [...new Set(scelte.map(r => r.school_year))];
    $('vc-elenco').innerHTML = anni.map(a => `<h3 class="vc-anno">Anno scolastico ${esc(annoLabel(a))}</h3><ul class="vc-lista">${
        scelte.filter(r => r.school_year === a).map(r => `<li><button type="button" data-apri="${esc(r.id)}">
            <span><strong>${esc(String(r.class_code).toLowerCase())} · ${esc(String(r.student_code).toLowerCase())}</strong>
            <span class="docente-muted"> · salvato il ${esc(new Date(r.updated_at).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' }))}</span></span>
            <span class="vc-etichetta" data-stato="${esc(r.stato)}">${esc(STATI[r.stato] || r.stato)}</span></button></li>`).join('')
    }</ul>`).join('');
}

function commentiDalModulo() {
    const ordine = (corrente?.bozza?.commenti || []).map(c => c.campo);
    return [...document.querySelectorAll('[data-commento]')]
        .map((t, i) => ({ campo: t.dataset.commento, etichetta: t.dataset.etichetta, commento: t.value.trim(),
                          ...(t.dataset.risposta ? { risposta: t.dataset.risposta } : {}),
                          pos: ordine.includes(t.dataset.commento) ? ordine.indexOf(t.dataset.commento) : 1e6 + i }))
        .filter(c => c.commento)
        .sort((a, b) => a.pos - b.pos)
        .map(({ pos, ...c }) => c);
}

function bozzaDalModulo() {
    if (compito()) {
        return { tipo: 'compito', verifica: verifica.chiave, titolo: verifica.titolo,
                 nota: $('vc-nota').value.trim(), commenti: commentiDalModulo() };
    }
    const sezioni = verifica.sezioni.map(s => {
        const punti = parseFloat(String($(`vc-punti-${s.id}`).value).replace(',', '.'));
        return { id: s.id, titolo: s.titolo, max: s.max, punti: Number.isFinite(punti) ? punti : null,
                 commento: $(`vc-comm-${s.id}`).value.trim() };
    });
    const totale = sezioni.reduce((t, s) => t + (s.punti || 0), 0);
    const commenti = commentiDalModulo();
    return {
        verifica: verifica.chiave, titolo: verifica.titolo, sezioni, totale,
        max: verifica.sezioni.reduce((t, s) => t + s.max, 0),
        voto_proposto: regolaVoto(verifica, totale), voto: $('vc-voto-finale').value.trim(),
        nota: $('vc-nota').value.trim(), commenti
    };
}

function aggiornaTotale() {
    if (compito()) return;
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
    const bozzaEtichette = new Map((bozza.commenti || []).map(x => [x.campo, x.etichetta]));
    const piatti = new Map(campiPiatti(data));
    const campi = [...info.ordine.filter(k => piatti.has(k)), ...[...piatti.keys()].filter(k => !info.ordine.includes(k))];
    $('vc-elaborato-titolo').textContent = `${String(c.class_code).toLowerCase()} · ${String(c.student_code).toLowerCase()} · ${annoLabel(c.school_year)}`;
    $('vc-risposte').innerHTML = campi.map(k => {
        const etichetta = etichettaCampo(k, info, data, bozzaEtichette);
        const testo = testoRisposta(piatti.get(k));
        return `<div class="vc-risposta">
            <p class="vc-domanda">${esc(etichetta)}</p>
            ${testo ? `<p class="vc-testo">${esc(testo)}</p>` : '<p class="vc-testo vc-vuota">nessuna risposta</p>'}
            <label class="visually-hidden" for="vc-c-${esc(k)}">Commento</label>
            <textarea id="vc-c-${esc(k)}" rows="2" placeholder="Commento per l’alunno (facoltativo)" data-commento="${esc(k)}" data-etichetta="${esc(etichetta)}" data-risposta="${esc(testo.slice(0, 4000))}">${esc(commenti.get(k) || '')}</textarea>
        </div>`;
    }).join('') || '<p class="docente-muted">Nessuna risposta salvata.</p>';
    // Commenti che non riguardano un singolo campo (es. riepilogo delle domande a scelta di una missione).
    const blocchi = (bozza.commenti || []).filter(x => !piatti.has(x.campo));
    $('vc-blocchi').innerHTML = blocchi.length ? `<h3>Commenti per blocco</h3>${blocchi.map(x => `<div class="vc-risposta">
            <p class="vc-domanda">${esc(x.etichetta || x.campo)}</p>
            <label class="visually-hidden" for="vc-c-${esc(x.campo)}">Commento</label>
            <textarea id="vc-c-${esc(x.campo)}" rows="3" data-commento="${esc(x.campo)}" data-etichetta="${esc(x.etichetta || x.campo)}">${esc(x.commento)}</textarea>
        </div>`).join('')}` : '';
    $('vc-valutazione').hidden = compito();
    if (compito()) {
        $('vc-nota').value = bozza.nota || '';
        mostraStato(c);
        $('vc-elenco').hidden = true;
        $('vc-elaborato').hidden = false;
        $('vc-elaborato-titolo').focus();
        return;
    }
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

// Anteprima: la correzione com'è in questo momento, impaginata come in «I miei lavori» dell'alunno.
function anteprima() {
    const b = bozzaDalModulo();
    const voto = compito() ? '' : `<p class="vc-ant-voto">Voto: ${esc(b.voto || '—')} · Punti: ${esc(String(b.totale).replace('.', ','))} su ${esc(b.max)}</p>`;
    $('vc-anteprima-corpo').innerHTML = `<p class="docente-muted">Anteprima: così la vedrà l’alunno dopo «Mostra all’alunno».</p>
        <h2 id="vc-anteprima-titolo">${esc(b.titolo)}</h2>${voto}
        ${b.nota ? `<p class="vc-ant-nota">${esc(b.nota)}</p>` : ''}
        ${(b.sezioni || []).map(x => `<p><strong>${esc(x.titolo)}</strong>: ${x.punti ?? '—'} su ${x.max}${x.commento ? ` · ${esc(x.commento)}` : ''}</p>`).join('')}
        ${b.commenti.length ? '<h3>Commenti alle risposte</h3>' : '<p>Nessun commento.</p>'}
        ${b.commenti.map(k => `<div class="vc-ant-voce"><p class="vc-domanda">${esc(k.etichetta)}</p>
            ${k.risposta ? `<p class="vc-ant-risposta">La tua risposta: ${esc(k.risposta)}</p>` : ''}
            <p class="vc-ant-commento">${esc(k.commento)}</p></div>`).join('')}`;
    $('vc-anteprima-dialogo').showModal();
}

async function salva(mostra) {
    const b = bozzaDalModulo();
    if (compito()) {
        if (mostra && !b.commenti.length && !b.nota) { alert('Per mostrarla all’alunno scrivi almeno un commento.'); return; }
    } else for (const s of b.sezioni) {
        if (s.punti !== null && (s.punti < 0 || s.punti > s.max)) { alert(`${s.titolo}: i punti vanno da 0 a ${s.max}.`); return; }
    }
    if (mostra && !compito() && (b.sezioni.some(s => s.punti === null) || !b.voto)) {
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
    try { config = (await (await fetch('assets/verifiche-correzione.json?v=20261123c', { cache: 'no-cache' })).json()).verifiche; }
    catch { $('vc-accesso').hidden = false; $('vc-accesso').textContent = 'Configurazione delle verifiche non disponibile.'; return; }
    $('vc-contenuto').hidden = false;
    const gruppo = (tipo, nome) => {
        const voci = config.filter(v => (v.tipo || 'verifica') === tipo);
        return voci.length ? `<optgroup label="${nome}">${voci.map(v => `<option value="${esc(v.chiave)}">${esc(v.titolo)}</option>`).join('')}</optgroup>` : '';
    };
    $('vc-verifica').innerHTML = gruppo('verifica', 'Verifiche') + gruppo('compito', 'Compiti');
    const scelta = new URLSearchParams(location.search).get('verifica');
    if (config.some(v => v.chiave === scelta)) $('vc-verifica').value = scelta;
    // Dall'Area docente si arriva con ?verifica=…&id=…: si apre subito quell'elaborato.
    let daAprire = new URLSearchParams(location.search).get('id');
    const cambia = async () => {
        verifica = config.find(v => v.chiave === $('vc-verifica').value);
        $('vc-regola').textContent = compito()
            ? 'Compito: un commento per risposta e un commento finale, senza punti né voto.'
            : `Regola del voto: ${verifica.voto.spiegazione}${verifica.voto.da_confermare ? ' (da confermare)' : ''}`;
        await elenco();
        if (daAprire) {
            const id = daAprire;
            daAprire = null;
            const riga = righe.find(r => String(r.id) === id);
            if (riga) {
                $('vc-anno').value = String(riga.school_year);
                filtri();
                $('vc-classe').value = siglaClasse(riga.class_code);
                disegnaElenco();
            }
            apri(id);
        }
    };
    $('vc-verifica').addEventListener('change', cambia);
    $('vc-anno').addEventListener('change', () => { $('vc-anno').dataset.scelto = '1'; filtri(); disegnaElenco(); });
    $('vc-classe').addEventListener('change', disegnaElenco);
    cambia();
    $('vc-elenco').addEventListener('click', e => { const b = e.target.closest('[data-apri]'); if (b) apri(b.dataset.apri); });
    $('vc-indietro').addEventListener('click', elenco);
    $('vc-sezioni').addEventListener('input', aggiornaTotale);
    $('vc-voto-finale').addEventListener('input', () => { $('vc-voto-finale').dataset.toccato = '1'; });
    $('vc-salva').addEventListener('click', () => salva(false));
    $('vc-anteprima').addEventListener('click', anteprima);
    $('vc-mostra').addEventListener('click', () => { if (confirm('Rendere visibile la correzione all’alunno?')) salva(true); });
    $('vc-ritira').addEventListener('click', async () => {
        if (!confirm('Rendere di nuovo riservata la correzione? L’alunno non la vedrà più.')) return;
        try { await chiama('verifiche_docente_ritira', { p_id: corrente.id }); corrente.pubblicata = null; corrente.revisione += 1; mostraStato(corrente); }
        catch (e) { alert(e.message); }
    });
});
