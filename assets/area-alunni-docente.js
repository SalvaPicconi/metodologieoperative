/*
 * Area docente · pannello «Accessi alunni» (I miei lavori).
 * Ogni operazione passa da MODocente.chiama, quindi dalla sessione docente verificata dal database.
 * Il codice personale in chiaro si vede una volta sola, subito dopo averlo creato, e non si conserva.
 */
const contenitore = () => document.getElementById('accessi-contenuto');
let contesto = { classCode: '', schoolYear: '' };
let titoli = new Map();
let codiceMostrato = null;

const esc = valore => String(valore ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const data = valore => Number.isFinite(Date.parse(valore))
    ? new Date(valore).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Rome' })
    : '—';
const annoLabel = anno => `${anno}/${String((Number(anno) + 1) % 100).padStart(2, '0')}`;
const sigla = codice => String(codice || '').replace(/\s/g, '').toUpperCase();

const ESITI = {
    certo: ['Certo', 'Stesso codice e stessa classe: nessuna alternativa nei dati.'],
    da_verificare: ['Da verificare', ''],
    simile: ['Codice simile', ''],
    conflitto: ['Più alunni possibili', ''],
    nessuno: ['Nessun abbinamento', '']
};

async function chiama(nome, args) {
    return window.MODocente.chiama(nome, args);
}

async function caricaTitoli() {
    if (titoli.size) return;
    try {
        const dati = await (await fetch('materiali.json', { cache: 'no-cache' })).json();
        for (const [chiave, voci] of Object.entries(dati)) {
            if (!Array.isArray(voci)) continue;
            for (const m of voci) if (m?.file && m?.titolo && !titoli.has('/' + m.file)) {
                titoli.set('/' + m.file, chiave === 'archivio' ? `${m.titolo} (archivio)` : m.titolo);
            }
        }
    } catch { }
}

function titolo(path) {
    const pulito = String(path || '').replace(/^\/metodologieoperative(?=\/)/, '');
    return titoli.get(pulito) || pulito.split('/').pop() || 'Attività';
}

function avviso(testo, tipo = 'info') {
    const el = document.getElementById('accessi-esito');
    if (!el) return;
    el.textContent = testo;
    el.dataset.tipo = tipo;
}

function erroreTesto(errore) {
    if (errore?.code === '42501') return 'Sessione docente scaduta: accedi di nuovo.';
    return errore?.message || 'Operazione non riuscita.';
}

async function disegna() {
    const box = contenitore();
    if (!box) return;
    const anno = Number(contesto.schoolYear);
    const classe = sigla(contesto.classCode);
    if (!/^[1-5][A-Z]{1,4}$/.test(classe) || !Number.isInteger(anno)) {
        box.innerHTML = '<p class="docente-muted">Gli accessi personali si gestiscono per una classe con sigla del tipo 3SB e un anno scolastico preciso.</p>';
        return;
    }
    box.innerHTML = '<p class="docente-muted">Caricamento…</p>';
    let stato, dettaglio, candidati, collegamenti;
    try {
        await caricaTitoli();
        [stato, dettaglio, candidati, collegamenti] = await Promise.all([
            chiama('alunni_docente_stato'),
            chiama('alunni_docente_classe', { p_school_year: anno, p_sigla: classe }),
            chiama('alunni_docente_candidati', { p_school_year: anno, p_sigla: classe }),
            chiama('alunni_docente_collegamenti', { p_school_year: anno, p_sigla: classe })
        ]);
    } catch (errore) {
        box.innerHTML = `<p class="docente-notice">${esc(erroreTesto(errore))}</p>`;
        return;
    }
    const alunni = dettaglio?.alunni || [];
    const precedenti = dettaglio?.anno_precedente || [];
    candidati = Array.isArray(candidati) ? candidati : [];
    collegamenti = Array.isArray(collegamenti) ? collegamenti : [];
    const pagineAbilitate = (stato?.pagine || []).filter(p => p.abilitata);
    // Un codice che appartiene a un alunno con accesso personale non si riapre al vecchio accesso.
    const codiciAttivi = new Set(alunni.map(a => sigla(a.codice_storico)));

    const opzioniAlunni = alunni.map(a => `<option value="${esc(a.profilo_id)}">${esc(a.pseudonimo)} · ${esc(a.codice_storico)}</option>`).join('');
    const righeAlunni = alunni.map(a => `<tr>
            <th scope="row">${esc(a.pseudonimo)}</th>
            <td><code>${esc(a.codice_storico)}</code></td>
            <td>${a.codice_attivo ? `attivo dal ${esc(data(a.codice_emesso_il))}` : '<span class="docente-muted">nessuno</span>'}</td>
            <td>${a.ultimo_accesso ? esc(data(a.ultimo_accesso)) : '—'}</td>
            <td>${Number(a.lavori) || 0}</td>
            <td class="accessi-azioni">
                <button type="button" class="docente-button" data-codice="${esc(a.profilo_id)}" data-nome="${esc(a.pseudonimo)}">${a.codice_attivo ? 'Sostituisci codice' : 'Crea codice'}</button>
                ${a.codice_attivo ? `<button type="button" class="docente-button" data-revoca="${esc(a.profilo_id)}" data-nome="${esc(a.pseudonimo)}">Revoca</button>` : ''}
            </td>
        </tr>`).join('');

    const gruppi = ['certo', 'da_verificare', 'simile', 'conflitto', 'nessuno'].map(esito => {
        const voci = candidati.filter(c => c.esito === esito);
        if (!voci.length) return '';
        const [etichetta, spiegazione] = ESITI[esito];
        const righe = voci.map(c => `<li class="accessi-candidato">
                <div>
                    <strong>${esc(titolo(c.page_path))}</strong>
                    <span>salvato come <code>${esc(c.student_code)}</code> in ${esc(c.class_code)} · ${esc(data(c.updated_at))}${c.protetto ? ' · chiuso al vecchio accesso' : ''}</span>
                    ${c.motivo ? `<span class="docente-muted">${esc(c.motivo)}</span>` : ''}
                </div>
                <div class="accessi-scelta">
                    <label class="visually-hidden" for="cand-${esc(c.progress_id)}">Alunno a cui attribuire il lavoro</label>
                    <select id="cand-${esc(c.progress_id)}" data-scelta="${esc(c.progress_id)}">
                        <option value="">Scegli l’alunno…</option>
                        ${alunni.map(a => `<option value="${esc(a.profilo_id)}"${a.profilo_id === c.profilo_id && esito !== 'conflitto' ? ' selected' : ''}>${esc(a.pseudonimo)} · ${esc(a.codice_storico)}</option>`).join('')}
                    </select>
                    <button type="button" class="docente-button" data-collega="${esc(c.progress_id)}" data-esito="${esc(esito)}">Conferma</button>
                    ${!c.protetto || codiciAttivi.has(sigla(c.student_code)) ? '' : `<button type="button" class="docente-button docente-button-quiet" data-sblocca="${esc(c.progress_id)}" title="Riapre la riga al vecchio accesso con classe e codice">Lascia al vecchio accesso</button>`}
                </div>
            </li>`).join('');
        return `<section class="accessi-gruppo" data-gruppo="${esito}">
                <h5>${esc(etichetta)} <span class="docente-muted">(${voci.length})</span></h5>
                ${spiegazione ? `<p class="docente-muted">${esc(spiegazione)}</p>` : ''}
                ${esito === 'certo' && voci.length > 1 ? '<p><button type="button" class="docente-button" data-conferma-certi>Conferma tutti i «certi»</button></p>' : ''}
                <ul class="accessi-lista">${righe}</ul>
            </section>`;
    }).join('');

    const righeCollegati = collegamenti.map(c => `<li class="accessi-candidato">
            <div><strong>${esc(c.pseudonimo)}</strong> · ${esc(titolo(c.page_path))}
                <span class="docente-muted">anno ${esc(annoLabel(c.school_year))} · salvato come <code>${esc(c.codice_sorgente)}</code> · confermato il ${esc(data(c.confermato_il))}</span></div>
            <div><button type="button" class="docente-button" data-annulla="${esc(c.progress_id)}">Annulla collegamento</button></div>
        </li>`).join('');

    box.innerHTML = `
        <p id="accessi-esito" class="accessi-esito" role="status"></p>
        <div class="accessi-stato">
            <p><strong>Ingresso «I miei lavori»: ${stato?.ingresso_attivo ? 'attivo' : 'spento'}.</strong>
               <span class="docente-muted">Vale per tutto il sito. Spegnendolo gli alunni non entrano più, i lavori restano protetti e non tornano al vecchio accesso.</span></p>
            <button type="button" class="docente-button" data-ingresso="${stato?.ingresso_attivo ? 'off' : 'on'}">${stato?.ingresso_attivo ? 'Sospendi l’ingresso' : 'Attiva l’ingresso'}</button>
            <details class="accessi-pagine">
                <summary>Attività abilitate al salvataggio personale (${pagineAbilitate.length})</summary>
                <ul>${pagineAbilitate.map(p => `<li>${esc(titolo(p.page_path))} <code>${esc(p.page_path)}</code></li>`).join('') || '<li class="docente-muted">Nessuna.</li>'}</ul>
                <p class="docente-muted">L’elenco si decide prima del rilascio: vedi AREA_ALUNNI.md nel repository.</p>
            </details>
        </div>

        <div id="accessi-codice" class="accessi-codice" hidden></div>

        <h4>Alunni della classe ${esc(classe)} · ${esc(annoLabel(anno))}</h4>
        ${alunni.length ? `<div class="table-wrapper"><table class="data-table accessi-tabella">
            <thead><tr><th scope="col">Nome mostrato</th><th scope="col">Codice delle attività</th><th scope="col">Codice personale</th><th scope="col">Ultimo accesso</th><th scope="col">Lavori</th><th scope="col">Azioni</th></tr></thead>
            <tbody>${righeAlunni}</tbody></table></div>`
        : '<p class="docente-muted">Nessun alunno con accesso personale in questa classe per quest’anno.</p>'}

        <details class="accessi-aggiungi"${alunni.length ? '' : ' open'}>
            <summary>Aggiungi alunni</summary>
            <p class="docente-muted">Una riga per alunno: il nome che vedrà nella sua pagina (basta nome e iniziale) e il codice che usa già nelle attività, separati da punto e virgola. Esempio: <code>Giulia R.; ROSSIG</code></p>
            <label for="accessi-lista-testo" class="visually-hidden">Elenco alunni</label>
            <textarea id="accessi-lista-testo" rows="5" spellcheck="false"></textarea>
            ${precedenti.length ? `<fieldset class="accessi-precedenti"><legend>Dall’anno scolastico ${esc(annoLabel(anno - 1))}</legend>
                ${precedenti.map(a => `<label><input type="checkbox" data-precedente="${esc(a.profilo_id)}" data-codice-storico="${esc(a.codice_storico)}"> ${esc(a.pseudonimo)} <span class="docente-muted">(${esc(a.classe)} · ${esc(a.codice_storico)})</span></label>`).join('')}
            </fieldset>` : ''}
            <p><button type="button" class="docente-button" data-anteprima>Anteprima</button></p>
            <div id="accessi-anteprima"></div>
        </details>

        <h4>Lavori già salvati da attribuire</h4>
        <p class="docente-muted">Nessun lavoro passa a un alunno senza la tua conferma. Finché non confermi, il lavoro resta visibile solo a te.</p>
        ${gruppi || '<p class="docente-muted">Nessun lavoro da attribuire per questa classe e quest’anno.</p>'}

        <details class="accessi-collegati">
            <summary>Collegamenti confermati (${collegamenti.length})</summary>
            <p class="docente-muted">Annullando, l’alunno perde subito l’accesso; il lavoro resta, protetto, e torna fra quelli da attribuire.</p>
            <ul class="accessi-lista">${righeCollegati || '<li class="docente-muted">Nessuno.</li>'}</ul>
        </details>

        <details class="accessi-registro">
            <summary>Registro delle operazioni</summary>
            <div id="accessi-registro-elenco"><p class="docente-muted">Si carica all’apertura.</p></div>
        </details>`;
    box.dataset.opzioni = opzioniAlunni ? '1' : '';
    if (codiceMostrato) mostraCodice(codiceMostrato.nome, codiceMostrato.codice);
}

function mostraCodice(nome, codice) {
    const el = document.getElementById('accessi-codice');
    if (!el) return;
    codiceMostrato = { nome, codice };
    el.hidden = false;
    el.innerHTML = `<p><strong>Codice personale di ${esc(nome)}</strong></p>
        <p class="accessi-codice-valore" aria-label="Codice">${esc(codice)}</p>
        <p class="docente-muted">Da consegnare solo a questo alunno. Dopo «Fatto» non sarà più visibile: se si perde, se ne crea uno nuovo e i lavori restano.</p>
        <p><button type="button" class="docente-button" data-copia>Copia</button>
           <button type="button" class="docente-button" data-chiudi-codice>Fatto</button></p>`;
    el.querySelector('[data-chiudi-codice]').focus();
}

function chiudiCodice() {
    codiceMostrato = null;
    const el = document.getElementById('accessi-codice');
    if (el) { el.replaceChildren(); el.hidden = true; }
}

function leggiLista() {
    const righe = (document.getElementById('accessi-lista-testo')?.value || '').split(/\r?\n/).map(r => r.trim()).filter(Boolean);
    const elenco = righe.map(r => {
        const [nome, codice] = r.split(/[;\t]/).map(x => (x || '').trim());
        return { pseudonimo: nome, codice_storico: codice };
    });
    document.querySelectorAll('[data-precedente]:checked').forEach(cb => {
        elenco.push({ profilo_id: cb.dataset.precedente, codice_storico: cb.dataset.codiceStorico });
    });
    return elenco;
}

async function importa(conferma) {
    const elenco = leggiLista();
    const out = document.getElementById('accessi-anteprima');
    if (!elenco.length) { out.innerHTML = '<p class="docente-muted">Scrivi almeno una riga o scegli un alunno dall’anno precedente.</p>'; return; }
    try {
        const righe = await chiama('alunni_docente_importa', {
            p_school_year: Number(contesto.schoolYear), p_sigla: sigla(contesto.classCode), p_elenco: elenco, p_conferma: conferma
        });
        if (conferma) {
            const aggiunti = righe.filter(r => /^(nuovo|portato|cambio)/.test(r.esito)).length;
            await disegna();
            avviso(`Importazione completata: ${aggiunti} ${aggiunti === 1 ? 'alunno aggiunto' : 'alunni aggiunti'}. Crea il codice personale di ciascuno quando sei pronto a consegnarlo.`, 'ok');
            return;
        }
        const buoni = righe.filter(r => /^(nuovo|portato|cambio)/.test(r.esito)).length;
        out.innerHTML = `<table class="data-table"><thead><tr><th>Riga</th><th>Nome</th><th>Codice</th><th>Esito</th></tr></thead><tbody>
            ${righe.map(r => `<tr><td>${r.riga}</td><td>${esc(r.pseudonimo)}</td><td><code>${esc(r.codice_storico)}</code></td><td>${esc(r.esito)}</td></tr>`).join('')}
            </tbody></table>
            ${buoni ? `<p><button type="button" class="docente-button" data-conferma-import>Conferma ${buoni} ${buoni === 1 ? 'alunno' : 'alunni'}</button></p>` : '<p class="docente-muted">Nessuna riga da importare.</p>'}`;
    } catch (errore) {
        out.innerHTML = `<p class="docente-notice">${esc(erroreTesto(errore))}</p>`;
    }
}

async function caricaRegistro() {
    const el = document.getElementById('accessi-registro-elenco');
    try {
        const righe = await chiama('alunni_docente_registro', { p_limite: 100 });
        el.innerHTML = righe.length ? `<ul class="accessi-lista">${righe.map(r => `<li>${esc(data(r.avvenuto_il))} · ${esc(r.azione.replace(/_/g, ' '))}${r.pseudonimo ? ` · ${esc(r.pseudonimo)}` : ''}${r.page_path ? ` · ${esc(titolo(r.page_path))}` : ''}</li>`).join('')}</ul>`
            : '<p class="docente-muted">Nessuna operazione registrata.</p>';
    } catch (errore) {
        el.innerHTML = `<p class="docente-notice">${esc(erroreTesto(errore))}</p>`;
    }
}

async function azione(fn, messaggioOk) {
    try {
        await fn();
        if (messaggioOk) avviso(messaggioOk, 'ok');
        const messaggio = document.getElementById('accessi-esito')?.textContent;
        await disegna();
        if (messaggio) avviso(messaggio, 'ok');
    } catch (errore) {
        avviso(erroreTesto(errore), 'errore');
    }
}

document.addEventListener('click', async event => {
    if (!contenitore()?.contains(event.target)) return;
    const t = event.target.closest('button');
    if (!t) return;
    if (t.dataset.codice) {
        const nome = t.dataset.nome;
        if (t.textContent.startsWith('Sostituisci') && !confirm(`Sostituire il codice di ${nome}? Il codice attuale smette subito di funzionare e le sessioni aperte si chiudono. I lavori restano.`)) return;
        try {
            const codice = await chiama('alunni_docente_codice', { p_profilo_id: t.dataset.codice });
            await disegna();
            mostraCodice(nome, codice);
        } catch (errore) { avviso(erroreTesto(errore), 'errore'); }
    } else if (t.dataset.revoca) {
        if (!confirm(`Revocare il codice di ${t.dataset.nome}? Non potrà più entrare finché non crei un codice nuovo. I lavori restano.`)) return;
        await azione(() => chiama('alunni_docente_revoca', { p_profilo_id: t.dataset.revoca }), `Codice di ${t.dataset.nome} revocato.`);
    } else if (t.hasAttribute('data-copia')) {
        try { await navigator.clipboard.writeText(codiceMostrato?.codice || ''); t.textContent = 'Copiato'; } catch { t.textContent = 'Copia non riuscita: selezionalo a mano'; }
    } else if (t.hasAttribute('data-chiudi-codice')) {
        chiudiCodice();
    } else if (t.dataset.ingresso) {
        const attivo = t.dataset.ingresso === 'on';
        if (!attivo && !confirm('Sospendere l’ingresso a «I miei lavori» per tutti gli alunni?')) return;
        await azione(() => chiama('alunni_docente_ingresso', { p_attivo: attivo }), attivo ? 'Ingresso attivato.' : 'Ingresso sospeso.');
    } else if (t.hasAttribute('data-anteprima')) {
        await importa(false);
    } else if (t.hasAttribute('data-conferma-import')) {
        await importa(true);
    } else if (t.dataset.collega) {
        const scelta = document.querySelector(`[data-scelta="${CSS.escape(t.dataset.collega)}"]`)?.value;
        if (!scelta) { avviso('Scegli prima l’alunno a cui attribuire il lavoro.', 'errore'); return; }
        await azione(() => chiama('alunni_docente_collega', { p_progress_id: t.dataset.collega, p_profilo_id: scelta, p_motivo: t.dataset.esito }), 'Collegamento confermato.');
    } else if (t.hasAttribute('data-conferma-certi')) {
        const certi = [...document.querySelectorAll('[data-gruppo="certo"] [data-collega]')];
        if (!confirm(`Confermare ${certi.length} lavori «certi»? Ogni collegamento si può annullare.`)) return;
        await azione(async () => {
            for (const b of certi) {
                const scelta = document.querySelector(`[data-scelta="${CSS.escape(b.dataset.collega)}"]`)?.value;
                if (scelta) await chiama('alunni_docente_collega', { p_progress_id: b.dataset.collega, p_profilo_id: scelta, p_motivo: 'certo' });
            }
        }, 'Collegamenti «certi» confermati.');
    } else if (t.dataset.annulla) {
        if (!confirm('Annullare il collegamento? L’alunno non vedrà più questo lavoro.')) return;
        await azione(async () => {
            const esito = await chiama('alunni_docente_annulla', { p_progress_id: t.dataset.annulla, p_motivo: 'annullato dal docente' });
            avviso(esito?.modificato_dopo_il_collegamento
                ? 'Collegamento annullato. Attenzione: l’alunno aveva modificato il lavoro dopo il collegamento.'
                : 'Collegamento annullato.', 'ok');
        });
    } else if (t.dataset.sblocca) {
        if (!confirm('Riaprire questo lavoro al vecchio accesso con classe e codice?')) return;
        await azione(() => chiama('alunni_docente_sblocca', { p_progress_id: t.dataset.sblocca }), 'Lavoro riaperto al vecchio accesso.');
    }
});

document.addEventListener('toggle', event => {
    if (event.target.classList?.contains('accessi-registro') && event.target.open) caricaRegistro();
}, true);

window.addEventListener('mo:docente-accessi', event => {
    const nuovo = { classCode: event.detail?.classCode || '', schoolYear: String(event.detail?.schoolYear || '') };
    if (nuovo.classCode !== contesto.classCode || nuovo.schoolYear !== contesto.schoolYear) chiudiCodice();
    contesto = nuovo;
    disegna();
});
