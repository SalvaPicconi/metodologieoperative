/*
 * Pagina «I miei lavori»: ingresso con il codice personale, ultimo lavoro da riprendere, archivio per
 * anno scolastico. Identità e permessi stanno nel database (funzioni alunni_*): qui si mostra solo ciò
 * che il server restituisce per la sessione della scheda. Tutto il testo entra nel DOM come testo.
 */
import { AreaAlunni } from './alunni-sessione.js?v=20261121';

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

let titoli = new Map();

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
    for (const id of ['aa-riprendi', 'aa-vuoto', 'aa-archivio']) mostra(id, false);
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
    info.textContent = `${formatData(lavoro.updated_at)} · ${statoLavoro(lavoro)}${lavoro.classe ? ` · classe ${String(lavoro.classe).replace(/\s/g, '').toLowerCase()}` : ''}`;
    testo.append(nome, info);
    li.append(testo);
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
    $('aa-classe').textContent = profilo && profilo.classe
        ? `Classe ${profilo.classe.toLowerCase()} · codice ${profilo.pseudonimo.toLowerCase()} · anno scolastico ${annoLabel(profilo.anno_corrente)}`
        : 'Per quest’anno non risulti ancora in una classe.';

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
        const [profilo, lavori] = await Promise.all([AreaAlunni.profilo(), AreaAlunni.lavori(), caricaTitoli()]);
        messaggio('');
        disegna(profilo, Array.isArray(lavori) ? lavori : []);
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

if (AreaAlunni.attiva()) caricaArea();
else mostraIngresso('');
