/*
 * Area docente · vista «Accessi alunni» (I miei lavori).
 * Gli alunni entrano con classe e codice di sempre. Qui il docente vede come il sito ha raggruppato le
 * grafie di ogni alunno (codici e classi scritti male), separa un'unione sbagliata e decide i casi dubbi.
 * Ogni operazione passa da MODocente.chiama, cioè dalla sessione docente verificata dal database.
 */
const contenitore = () => document.getElementById('accessi-contenuto');
let contesto = { classCode: '', schoolYear: '' };

const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const annoLabel = a => `${a}/${String((Number(a) + 1) % 100).padStart(2, '0')}`;
const sigla = c => String(c || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const data = v => Number.isFinite(Date.parse(v))
    ? new Date(v).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }) : '—';
const AZIONI = {
    stesso_alunno: 'unite due grafie come stesso alunno', alunni_diversi: 'segnati come alunni diversi',
    variante_separata: 'grafia separata', ingresso_attivato: 'ingresso attivato', ingresso_sospeso: 'ingresso sospeso'
};

const chiama = (nome, args) => window.MODocente.chiama(nome, args);

function avviso(testo, tipo = 'ok') {
    const el = document.getElementById('accessi-esito');
    if (el) { el.textContent = testo; el.dataset.tipo = tipo; }
}

function erroreTesto(e) {
    return e?.code === '42501' ? 'Sessione docente scaduta: accedi di nuovo.' : (e?.message || 'Operazione non riuscita.');
}

async function disegna(messaggio) {
    const box = contenitore();
    if (!box) return;
    const anno = Number(contesto.schoolYear);
    const classe = sigla(contesto.classCode);
    if (!/^[1-5][A-Z]{1,4}$/.test(classe) || !Number.isInteger(anno)) {
        box.innerHTML = '<p class="docente-muted">Questa vista vale per una classe con sigla del tipo 3SB e un anno scolastico preciso.</p>';
        return;
    }
    box.innerHTML = '<p class="docente-muted">Caricamento…</p>';
    let stato, dettaglio;
    try {
        [stato, dettaglio] = await Promise.all([
            chiama('alunni_docente_stato'),
            chiama('alunni_docente_classe', { p_school_year: anno, p_sigla: classe })
        ]);
    } catch (e) {
        box.innerHTML = `<p class="docente-notice">${esc(erroreTesto(e))}</p>`;
        return;
    }
    const alunni = dettaglio?.alunni || [];
    const dubbi = dettaglio?.da_decidere || [];
    const pagine = (stato?.pagine || []).filter(p => p.abilitata);

    const righe = alunni.map(a => {
        const unite = a.varianti.filter(v => v.stato === 'unita');
        const separate = a.varianti.filter(v => v.stato === 'separata');
        return `<tr>
            <th scope="row"><code>${esc(a.codice.toLowerCase())}</code></th>
            <td>${Number(a.lavori) || 0}</td>
            <td>${unite.length ? unite.map(v => `<span class="accessi-grafia"><code>${esc(v.codice.toLowerCase())}</code>${v.classe !== classe ? ` in ${esc(v.classe)}` : ''}
                    <button type="button" class="docente-button docente-button-quiet" data-separa="${esc(v.id)}" data-grafia="${esc(v.codice.toLowerCase())}">Separa</button></span>`).join(' ')
                : '<span class="docente-muted">nessuna</span>'}
                ${separate.length ? `<span class="docente-muted"> · separate: ${separate.map(v => esc(v.codice.toLowerCase())).join(', ')}</span>` : ''}</td>
            <td>${a.anni_precedenti ? `sì (${a.anni_precedenti})` : '—'}</td>
        </tr>`;
    }).join('');

    const casi = dubbi.map(d => `<li class="accessi-candidato">
            <div><strong><code>${esc(d.a.toLowerCase())}</code> e <code>${esc(d.b.toLowerCase())}</code></strong>
                <span class="docente-muted">Codici quasi uguali che hanno salvato le stesse attività: di solito sono due alunni.</span></div>
            <div class="accessi-scelta">
                <button type="button" class="docente-button" data-diversi="${esc(d.iscrizione_a)}|${esc(d.iscrizione_b)}">Alunni diversi</button>
                <button type="button" class="docente-button" data-stesso="${esc(d.iscrizione_a)}|${esc(d.iscrizione_b)}" data-nomi="${esc(d.a.toLowerCase())} e ${esc(d.b.toLowerCase())}">Stesso alunno</button>
            </div>
        </li>`).join('');

    box.innerHTML = `
        <p id="accessi-esito" class="accessi-esito" role="status"></p>
        <div class="accessi-stato">
            <p><strong>Ingresso «I miei lavori»: ${stato?.ingresso_attivo ? 'attivo' : 'sospeso'}.</strong>
               <span class="docente-muted">Gli alunni entrano con classe e codice di sempre. Vale per tutto il sito; le attività funzionano comunque come prima.</span></p>
            <button type="button" class="docente-button" data-ingresso="${stato?.ingresso_attivo ? 'off' : 'on'}">${stato?.ingresso_attivo ? 'Sospendi l’ingresso' : 'Attiva l’ingresso'}</button>
            <details class="accessi-pagine"><summary>Attività che si riprendono dall’area (${pagine.length})</summary>
                <ul>${pagine.map(p => `<li>${esc(p.titolo)}</li>`).join('') || '<li class="docente-muted">Nessuna.</li>'}</ul>
                <p class="docente-muted">Le altre attività si aprono dall’area come sempre, chiedendo classe e codice.</p></details>
        </div>

        ${dubbi.length ? `<h4>Da decidere (${dubbi.length})</h4><ul class="accessi-lista">${casi}</ul>` : ''}

        <h4>Alunni della ${esc(classe)} · ${esc(annoLabel(anno))}</h4>
        <p class="docente-muted">Elenco ricavato dai salvataggi. Le grafie unite sono codici scritti male (una lettera diversa o due scambiate) o con la classe sbagliata, che non hanno mai salvato le stesse attività del codice principale: li ho uniti in automatico. Se un’unione è sbagliata, «Separa».</p>
        ${alunni.length ? `<div class="table-wrapper"><table class="data-table accessi-tabella">
            <thead><tr><th scope="col">Codice</th><th scope="col">Lavori quest’anno</th><th scope="col">Grafie unite</th><th scope="col">Anni precedenti</th></tr></thead>
            <tbody>${righe}</tbody></table></div>` : '<p class="docente-muted">Nessun alunno con lavori salvati in questa classe per quest’anno.</p>'}

        <details class="accessi-registro"><summary>Registro delle decisioni</summary>
            <div id="accessi-registro-elenco"><p class="docente-muted">Si carica all’apertura.</p></div></details>`;
    if (messaggio) avviso(messaggio);
}

async function caricaRegistro() {
    const el = document.getElementById('accessi-registro-elenco');
    try {
        const righe = await chiama('alunni_docente_registro', { p_limite: 100 });
        el.innerHTML = righe.length ? `<ul class="accessi-lista">${righe.map(r => `<li>${esc(data(r.avvenuto_il))} · ${esc(AZIONI[r.azione] || r.azione)}${r.dettagli?.a && !/^[0-9a-f-]{36}$/.test(r.dettagli.a) ? ` · ${esc(String(r.dettagli.a).toLowerCase())} / ${esc(String(r.dettagli.b || '').toLowerCase())}` : ''}${r.dettagli?.codice ? ` · ${esc(String(r.dettagli.codice).toLowerCase())}` : ''}</li>`).join('')}</ul>`
            : '<p class="docente-muted">Nessuna decisione registrata.</p>';
    } catch (e) { el.innerHTML = `<p class="docente-notice">${esc(erroreTesto(e))}</p>`; }
}

async function esegui(fn, ok) {
    try { await fn(); await disegna(ok); }
    catch (e) { avviso(erroreTesto(e), 'errore'); }
}

document.addEventListener('click', async event => {
    if (!contenitore()?.contains(event.target)) return;
    const b = event.target.closest('button');
    if (!b) return;
    if (b.dataset.separa) {
        if (!confirm(`Separare «${b.dataset.grafia}»? I suoi lavori non compariranno più a questo alunno.`)) return;
        await esegui(() => chiama('alunni_docente_separa', { p_variante: b.dataset.separa }), `«${b.dataset.grafia}» separata.`);
    } else if (b.dataset.stesso) {
        const [a, c] = b.dataset.stesso.split('|');
        if (!confirm(`Unire ${b.dataset.nomi} come stesso alunno? Vedrà i lavori di entrambe le grafie.`)) return;
        await esegui(() => chiama('alunni_docente_unisci', { p_iscrizione_a: a, p_iscrizione_b: c }), 'Unite come stesso alunno.');
    } else if (b.dataset.diversi) {
        const [a, c] = b.dataset.diversi.split('|');
        await esegui(() => chiama('alunni_docente_diversi', { p_iscrizione_a: a, p_iscrizione_b: c }), 'Segnati come alunni diversi.');
    } else if (b.dataset.ingresso) {
        const attivo = b.dataset.ingresso === 'on';
        if (!attivo && !confirm('Sospendere l’ingresso a «I miei lavori» per tutti gli alunni?')) return;
        await esegui(() => chiama('alunni_docente_ingresso', { p_attivo: attivo }), attivo ? 'Ingresso attivato.' : 'Ingresso sospeso.');
    }
});

document.addEventListener('toggle', event => {
    if (event.target.classList?.contains('accessi-registro') && event.target.open) caricaRegistro();
}, true);

window.addEventListener('mo:docente-accessi', event => {
    contesto = { classCode: event.detail?.classCode || '', schoolYear: String(event.detail?.schoolYear || '') };
    disegna();
});
