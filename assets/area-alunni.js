/*
 * Pagina «I miei lavori»: ingresso con il codice personale, ultimo lavoro da riprendere, archivio per
 * anno scolastico. Identità e permessi stanno nel database (funzioni alunni_*): qui si mostra solo ciò
 * che il server restituisce per la sessione della scheda. Tutto il testo entra nel DOM come testo.
 */
import { AreaAlunni } from './alunni-sessione.js?v=20261122';


const $ = id => document.getElementById(id);
const formatoData = new Intl.DateTimeFormat('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome'
});

// Le poche parole del curricolo: una riga e una domanda per ricordare, nessuna risposta da scrivere.
// Proposte da validare con il docente (vedi AREA_ALUNNI.md).
const PAROLE = {
    1: { parole: 'Persona · Bisogno · Relazione d’aiuto', domanda: 'Quale bisogno riconosci nella situazione che stai per riprendere?' },
    2: { parole: 'Persona · Bisogno · Relazione d’aiuto', domanda: 'Quale bisogno riconosci nella situazione che stai per riprendere?' },
    3: { parole: 'Bisogno · Servizio · Équipe', domanda: 'Quale bisogno hai riconosciuto nel caso? Chi può intervenire?' },
    4: { parole: 'Barriere · Partecipazione · Progetto di vita', domanda: 'Quale barriera limita la partecipazione della persona?' },
    5: { parole: 'Autonomia · Ambiente di vita · Sostegno', domanda: 'Che cosa serve alla persona per restare autonoma nel suo ambiente di vita?' }
};
const PAROLE_WELFARE = { parole: 'Bisogno · Risposta · Welfare', domanda: 'A quale bisogno risponde il servizio che stai studiando?' };
const PAGINA_ANNO = { 1: 'biennio.html', 2: 'biennio.html', 3: 'terzo.html', 4: 'quarto.html', 5: 'quinto.html' };

// Competenze in uscita (D.M. 92/2018), con un nome breve per gli studenti.
const COMPETENZE = {
    C1: 'Progetti e reti dei servizi', C2: 'Lavoro in équipe', C3: 'Comunicazione con persone e gruppi',
    C4: 'Cura dei bisogni di base', C5: 'Presa in carico socio-assistenziale', C6: 'Ambiente di vita e sicurezza',
    C7: 'Informazione e orientamento ai servizi', C8: 'Attività educative e di animazione',
    C9: 'Sostegno e tutela della persona fragile', C10: 'Dati e documentazione professionale'
};
const ANNI = { 1: 'Primo anno', 2: 'Secondo anno', 3: 'Terzo anno', 4: 'Quarto anno', 5: 'Quinto anno' };
let curricolo = new Map();

let titoli = new Map();
let corrette = new Set();

function annoLabel(anno) {
    return Number.isInteger(anno) ? `${anno}/${String((anno + 1) % 100).padStart(2, '0')}` : 'anno non indicato';
}

function formatData(valore) {
    const t = Date.parse(valore);
    return Number.isFinite(t) ? formatoData.format(new Date(t)) : 'data non disponibile';
}

function titolo(path) {
    if (titoli.has(path)) return titoli.get(path);
    const nome = String(path || '').split('/').pop().replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    return nome ? nome.charAt(0).toUpperCase() + nome.slice(1) : 'Attività';
}

// Stessa regola dell'Area docente: percentuale solo se la pagina la registra davvero.
function statoLavoro(lavoro) {
    const meta = lavoro.meta || {};
    const p = meta.percentuale;
    if (Number.isFinite(p) && p >= 0 && p <= 100) return `${Math.round(p)}% completato`;
    const f = meta.campiCompilati;
    const t = meta.totale;
    if (Number.isInteger(f) && Number.isInteger(t) && t > 0 && f >= 0 && f <= t) {
        return f === t ? 'Completato' : `${Math.min(99, Math.round(100 * f / t))}% completato`;
    }
    return 'Lavoro salvato';
}

// Si apre solo un indirizzo vero del sito; gli identificativi interni restano consultabili dal docente.
function hrefPagina(path) {
    return /^\/(?!\/)[A-Za-z0-9_./%-]+\.html$/.test(path || '') ? path.slice(1) : null;
}

async function caricaCurricolo() {
    try {
        const dati = await (await fetch('materiali-curricolo.json', { cache: 'no-cache' })).json();
        curricolo = new Map(Object.entries(dati.materiali || {}).map(([file, voci]) => ['/' + file, voci]));
    } catch { curricolo = new Map(); }
}

function percento(lavoro) {
    const meta = lavoro.meta || {};
    if (Number.isFinite(meta.percentuale) && meta.percentuale >= 0 && meta.percentuale <= 100) return Math.round(meta.percentuale);
    const f = meta.campiCompilati, t = meta.totale;
    if (Number.isInteger(f) && Number.isInteger(t) && t > 0 && f >= 0 && f <= t) return f === t ? 100 : Math.min(99, Math.round(100 * f / t));
    return null;
}

function anello(valore, etichetta, dimensione = 56) {
    const ns = 'http://www.w3.org/2000/svg';
    const r = 18, c = 2 * Math.PI * r;
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 44 44');
    svg.setAttribute('width', dimensione);
    svg.setAttribute('height', dimensione);
    svg.setAttribute('class', 'aa-anello');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', etichetta);
    const fondo = document.createElementNS(ns, 'circle');
    const arco = document.createElementNS(ns, 'circle');
    for (const el of [fondo, arco]) { el.setAttribute('cx', 22); el.setAttribute('cy', 22); el.setAttribute('r', r); }
    fondo.setAttribute('class', 't');
    arco.setAttribute('class', 'v');
    arco.style.strokeDasharray = c;
    arco.style.strokeDashoffset = c;
    requestAnimationFrame(() => requestAnimationFrame(() => {
        arco.style.strokeDashoffset = c * (1 - Math.max(0, Math.min(100, valore)) / 100);
    }));
    const testo = document.createElementNS(ns, 'text');
    testo.setAttribute('x', 22); testo.setAttribute('y', 26.5); testo.setAttribute('text-anchor', 'middle');
    testo.textContent = `${Math.round(valore)}%`;
    svg.append(fondo, arco, testo);
    return svg;
}

function barra(valore, etichetta) {
    const b = document.createElement('div');
    b.className = 'aa-barra';
    b.setAttribute('role', 'img');
    b.setAttribute('aria-label', etichetta);
    const r = document.createElement('span');
    r.style.width = `${Math.max(4, Math.min(100, valore))}%`;
    b.append(r);
    return b;
}

// Simboli stilizzati per le competenze (tratto semplice, nessuna misura).
const ICONE = {
    C1: '<path d="M6 18a3 3 0 1 0 0-.01M18 6a3 3 0 1 0 0-.01M18 18a3 3 0 1 0 0-.01M8.5 16.5l7-9M9 18h6"/>',
    C2: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5"/>',
    C3: '<path d="M4 5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-4-3h-3"/>',
    C4: '<path d="M12 20s-7-4.4-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.6 12 20 12 20z"/>',
    C5: '<path d="M4 14c2-1 4-1 6 0l3 1.5a1.5 1.5 0 0 1-1 2.8L9 17.5M4 14v6M10 18l5 1.5 5-3"/><circle cx="15" cy="7" r="3"/>',
    C6: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    C7: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    C8: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5S14 15 15.5 15H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
    C9: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9.5 12l2 2 3.5-4"/>',
    C10: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>'
};

function simbolo(codice) {
    const span = document.createElement('span');
    span.className = 'aa-comp-simbolo';
    span.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONE[codice] || ''}</svg>`;
    return span;
}

// Competenze dell'anno: solo i nomi e che cosa si impara, nessuna misura.
function disegnaCompetenze(profilo) {
    const anno = profilo && ANNI[profilo.anno_corso];
    if (!anno || !curricolo.size) return;
    const perComp = new Map();
    for (const voci of curricolo.values()) {
        for (const v of voci) {
            if (v.anno === anno && v.competenza && COMPETENZE[v.competenza] && !perComp.has(v.competenza)) {
                perComp.set(v.competenza, v.competenzaIntermedia);
            }
        }
    }
    if (!perComp.size) return;
    const griglia = $('aa-comp-griglia');
    griglia.replaceChildren();
    const ordinate = [...perComp.entries()].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)));
    ordinate.forEach(([codice, intermedia], i) => {
        const card = document.createElement('details');
        card.className = `aa-comp aa-tinta-${i % 5}`;
        const sum = document.createElement('summary');
        const nome = document.createElement('span'); nome.className = 'aa-comp-nome'; nome.textContent = COMPETENZE[codice];
        sum.append(simbolo(codice), nome);
        const testo = document.createElement('p');
        testo.textContent = intermedia;
        card.append(sum, testo);
        griglia.append(card);
    });
    mostra('aa-competenze', true);
}

async function caricaTitoli() {
    try {
        const res = await fetch('materiali.json', { cache: 'no-cache' });
        const dati = await res.json();
        const mappa = new Map();
        for (const [chiave, valore] of Object.entries(dati)) {
            if (!Array.isArray(valore)) continue;
            for (const m of valore) {
                if (m && m.file && m.titolo && !mappa.has('/' + m.file)) {
                    mappa.set('/' + m.file, chiave === 'archivio' ? `${m.titolo} (versione precedente)` : m.titolo);
                }
            }
        }
        titoli = mappa;
    } catch { }
}

function mostra(id, visibile) { $(id).hidden = !visibile; }

function messaggio(testo) {
    const el = $('aa-stato');
    el.textContent = testo || '';
    el.hidden = !testo;
}

function svuotaArea() {
    $('aa-anni').replaceChildren();
    $('aa-riprendi-nome').textContent = '';
    $('aa-riprendi-data').textContent = '';
    $('aa-parole').textContent = '';
    $('aa-classe').textContent = '';
    $('aa-saluto').textContent = 'I miei lavori';
    for (const id of ['aa-riprendi', 'aa-vuoto', 'aa-archivio', 'aa-competenze']) mostra(id, false);
    $('aa-comp-griglia').replaceChildren();
    messaggio('');
}

function mostraIngresso(errore = '') {
    svuotaArea();
    mostra('aa-area', false);
    mostra('aa-ingresso', true);
    $('aa-errore').textContent = errore;
    $('aa-codice').value = '';
    $('aa-classe-input').value = '';
}

function apri(lavoro, link) {
    link.addEventListener('click', () => AreaAlunni.preparaApertura(lavoro.id, lavoro.page_path));
}

let annoCorrente = null;

function voceLavoro(lavoro) {
    const li = document.createElement('li');
    li.className = 'aa-lavoro';
    const testo = document.createElement('div');
    const nome = document.createElement('p');
    nome.className = 'aa-lavoro-nome';
    nome.textContent = titolo(lavoro.page_path);
    const info = document.createElement('p');
    info.className = 'aa-lavoro-info';
    const p = percento(lavoro);
    info.textContent = `${formatData(lavoro.updated_at)} · ${statoLavoro(lavoro)}${lavoro.classe ? ` · classe ${String(lavoro.classe).replace(/\s/g, '').toLowerCase()}` : ''}`;
    testo.append(nome, info);
    li.append(testo);
    if (corrette.has(lavoro.id)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'aa-azione';
        b.textContent = 'Vedi la correzione';
        b.addEventListener('click', () => mostraCorrezione(lavoro.id));
        li.append(b);
    }
    const href = hrefPagina(lavoro.page_path);
    if (href) {
        const a = document.createElement('a');
        a.href = href;
        // Quest'anno, su un'attività non collegata all'area: si apre e si continua come sempre.
        const daContinuare = !lavoro.modificabile && lavoro.school_year === annoCorrente;
        a.className = lavoro.modificabile || daContinuare ? 'aa-azione' : 'aa-azione aa-azione-lettura';
        a.textContent = lavoro.modificabile ? 'Riprendi' : daContinuare ? 'Apri' : 'Rileggi';
        a.setAttribute('aria-label', `${a.textContent}: ${nome.textContent}`);
        if (!daContinuare) apri(lavoro, a);
        li.append(a);
    } else {
        const s = document.createElement('span');
        s.className = 'aa-lavoro-nota';
        s.textContent = 'Lo consulta il docente';
        li.append(s);
    }
    return li;
}

function disegna(profilo, lavori) {
    annoCorrente = profilo ? profilo.anno_corrente : null;
    $('aa-saluto').textContent = 'I miei lavori';
    $('aa-avatar').textContent = profilo && profilo.pseudonimo ? profilo.pseudonimo.charAt(0).toUpperCase() : '';
    $('aa-classe').textContent = profilo && profilo.classe
        ? `Classe ${profilo.classe.toLowerCase()} · codice ${profilo.pseudonimo.toLowerCase()} · anno scolastico ${annoLabel(profilo.anno_corrente)}`
        : 'Per quest’anno non risulti ancora in una classe.';
    const lavoriAnno = lavori.filter(l => profilo && l.school_year === profilo.anno_corrente);
    disegnaCompetenze(profilo);

    const riprendibile = lavori.find(l => l.modificabile && hrefPagina(l.page_path));
    if (riprendibile) {
        $('aa-riprendi-nome').textContent = titolo(riprendibile.page_path);
        $('aa-riprendi-data').textContent = `Ultimo salvataggio: ${formatData(riprendibile.updated_at)} · ${statoLavoro(riprendibile)}`;
        const link = $('aa-riprendi-link');
        link.href = hrefPagina(riprendibile.page_path);
        apri(riprendibile, link);
        const richiamo = /welfare/i.test(riprendibile.page_path) && profilo && profilo.anno_corso <= 2
            ? PAROLE_WELFARE : PAROLE[profilo && profilo.anno_corso];
        $('aa-parole').textContent = richiamo ? `${richiamo.parole}. ${richiamo.domanda}` : '';
        mostra('aa-riprendi', true);
    }

    if (!lavori.length) {
        $('aa-vuoto-link').href = (profilo && PAGINA_ANNO[profilo.anno_corso]) || 'index.html';
        mostra('aa-vuoto', true);
        return;
    }

    const perAnno = new Map();
    for (const l of lavori) {
        const k = Number.isInteger(l.school_year) ? l.school_year : -1;
        if (!perAnno.has(k)) perAnno.set(k, []);
        perAnno.get(k).push(l);
    }
    const anni = [...perAnno.keys()].sort((a, b) => b - a);
    const contenitore = $('aa-anni');
    for (const anno of anni) {
        const elenco = document.createElement('ul');
        elenco.className = 'aa-elenco';
        perAnno.get(anno).forEach(l => elenco.append(voceLavoro(l)));
        const corrente = Boolean(profilo) && anno === profilo.anno_corrente;
        const blocco = document.createElement(corrente ? 'section' : 'details');
        blocco.className = 'aa-anno';
        const intestazione = document.createElement(corrente ? 'h3' : 'summary');
        const n = perAnno.get(anno).length;
        intestazione.textContent = `${corrente ? 'Quest’anno' : 'Anno scolastico'} ${annoLabel(anno)} · ${n} ${n === 1 ? 'lavoro' : 'lavori'}`;
        blocco.append(intestazione);
        if (!corrente) {
            const nota = document.createElement('p');
            nota.className = 'aa-nota';
            nota.textContent = 'I lavori degli anni precedenti si rileggono senza modificarli. Se rifai l’attività, quest’anno nasce un lavoro nuovo.';
            blocco.append(nota);
        }
        blocco.append(elenco);
        contenitore.append(blocco);
    }
    mostra('aa-archivio', true);
}

async function caricaArea() {
    svuotaArea();
    mostra('aa-ingresso', false);
    mostra('aa-area', true);
    messaggio('Carico i tuoi lavori…');
    try {
        const [profilo, lavori, correzioni] = await Promise.all([
            AreaAlunni.profilo(), AreaAlunni.lavori(), AreaAlunni.correzioni().catch(() => []), caricaTitoli(), caricaCurricolo()]);
        corrette = new Set((correzioni || []).map(c => c.id));
        messaggio('');
        disegna(profilo, Array.isArray(lavori) ? lavori : []);
        // Comparsa a cascata delle sezioni (se l'utente non ha ridotto le animazioni).
        document.querySelectorAll('#aa-area > section:not([hidden]), .aa-comp, .aa-lavoro').forEach((el, i) => {
            el.style.setProperty('--ritardo', `${Math.min(i, 14) * 60}ms`);
            el.classList.add('aa-entra');
        });
        $('aa-saluto').focus();
    } catch (errore) {
        if (errore.hint === 'sessione') {
            mostraIngresso('La sessione è scaduta: inserisci di nuovo il codice.');
        } else if (errore.hint === 'non_disponibile') {
            mostraIngresso('L’area «I miei lavori» non è disponibile in questo momento.');
        } else {
            messaggio('Non riesco a raggiungere il sito dei salvataggi. Controlla la connessione e ricarica la pagina.');
        }
    }
}

function elemento(tag, testo, classe) {
    const el = document.createElement(tag);
    if (testo !== undefined && testo !== null) el.textContent = testo;
    if (classe) el.className = classe;
    return el;
}

async function mostraCorrezione(id) {
    const dialogo = $('aa-correzione');
    const corpo = $('aa-correzione-corpo');
    corpo.replaceChildren(elemento('p', 'Carico la correzione…'));
    dialogo.showModal();
    let c;
    try { c = await AreaAlunni.correzione(id); } catch { c = null; }
    corpo.replaceChildren();
    if (!c) { corpo.append(elemento('p', 'La correzione non è disponibile.')); return; }
    const h = elemento('h2', c.titolo || 'La tua verifica corretta');
    h.id = 'aa-correzione-titolo';
    corpo.append(h, elemento('p', `Voto: ${c.voto || '—'}`, 'aa-voto'),
        elemento('p', `Punti: ${String(c.totale).replace('.', ',')} su ${c.max}`, 'aa-nota'));
    if (c.nota) corpo.append(elemento('p', c.nota, 'aa-commento'));
    const sez = elemento('ul', null, 'aa-elenco');
    for (const s of c.sezioni || []) {
        const li = elemento('li', null, 'aa-lavoro aa-sezione');
        const d = elemento('div');
        d.append(elemento('p', `${s.titolo}: ${s.punti === null ? '—' : String(s.punti).replace('.', ',')} su ${s.max}`, 'aa-lavoro-nome'));
        if (s.commento) d.append(elemento('p', s.commento, 'aa-lavoro-info'));
        li.append(d);
        sez.append(li);
    }
    corpo.append(sez);
    if ((c.commenti || []).length) {
        corpo.append(elemento('h3', 'Commenti alle risposte'));
        for (const k of c.commenti) {
            const box = elemento('div', null, 'aa-commento-risposta');
            box.append(elemento('p', k.etichetta, 'aa-lavoro-nome'), elemento('p', k.commento, 'aa-lavoro-info'));
            corpo.append(box);
        }
    }
}

function ritornoValido() {
    try {
        const r = sessionStorage.getItem('mo:alunno-ritorno');
        sessionStorage.removeItem('mo:alunno-ritorno');
        if (r && /^\/(?!\/)[A-Za-z0-9_./%-]+\.html$/.test(r)) return r;
    } catch { }
    return null;
}

$('aa-form').addEventListener('submit', async event => {
    event.preventDefault();
    const classe = $('aa-classe-input').value;
    const codice = $('aa-codice').value;
    const pulsante = $('aa-entra');
    $('aa-errore').textContent = '';
    if (!/^\s*[1-5]\s*[A-Za-z]{1,4}\s*$/.test(classe)) {
        $('aa-errore').textContent = 'Scrivi la classe con numero e lettere, tutto minuscolo: per esempio 3sb.';
        $('aa-classe-input').focus();
        return;
    }
    if (codice.replace(/[^A-Za-z0-9]/g, '').length < 2) {
        $('aa-errore').textContent = 'Scrivi il codice che usi nelle attività: cognome e iniziale.';
        $('aa-codice').focus();
        return;
    }
    pulsante.disabled = true;
    pulsante.textContent = 'Controllo…';
    try {
        const esito = await AreaAlunni.accedi(classe, codice);
        if (esito === 'ok') {
            $('aa-codice').value = '';
            $('aa-classe-input').value = '';
            const ritorno = ritornoValido();
            if (ritorno) { location.href = ritorno; return; }
            await caricaArea();
        } else if (esito === 'troppi_tentativi') {
            $('aa-errore').textContent = 'Troppi tentativi da questa rete. Aspetta qualche minuto e riprova.';
        } else if (esito === 'non_disponibile') {
            $('aa-errore').textContent = 'L’area «I miei lavori» non è disponibile in questo momento.';
        } else {
            $('aa-errore').textContent = 'Non trovo lavori con questa classe e questo codice quest’anno. Controllali: sono quelli che scrivi nelle attività.';
        }
    } catch {
        $('aa-errore').textContent = 'Non riesco a raggiungere il sito dei salvataggi. Controlla la connessione e riprova.';
    } finally {
        pulsante.disabled = false;
        pulsante.textContent = 'Entra';
    }
});

$('aa-esci').addEventListener('click', async () => {
    await AreaAlunni.esci();
    mostraIngresso('');
    // La pagina che resta nella cronologia è quella dell'ingresso, non l'elenco dei lavori.
    history.replaceState(null, '', location.pathname);
    $('aa-classe-input').focus();
});

// Se la sessione scade mentre la pagina è aperta, o si esce da un'altra scheda, si torna all'ingresso.
window.addEventListener('mo:alunno-sessione-scaduta', () => mostraIngresso('La sessione è scaduta: inserisci di nuovo il codice.'));
// Tornando indietro dalla cache del browser dopo l'uscita, i dati non devono ricomparire.
window.addEventListener('pageshow', event => {
    if (event.persisted && !AreaAlunni.attiva()) mostraIngresso('');
});

// Se lo studente è già entrato in un'attività con classe e codice, entra direttamente anche qui.
async function avvio() {
    if (AreaAlunni.attiva()) return caricaArea();
    const id = AreaAlunni.identitaAttivita();
    if (id) {
        try {
            if (await AreaAlunni.accedi(id.classe, id.codice) === 'ok') return caricaArea();
        } catch { }
    }
    mostraIngresso('');
}
avvio();
