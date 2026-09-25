// Script per caricare e visualizzare i materiali dal file JSON
const MATERIALI_JSON_URL = (() => {
    try {
        const currentScript = document.currentScript;
        if (currentScript) {
            const scriptUrl = new URL(currentScript.src, window.location.href);
            scriptUrl.pathname = scriptUrl.pathname.replace(/[^\/]+$/, 'materiali.json');
            scriptUrl.search = '';
            scriptUrl.hash = '';
            return scriptUrl.toString();
        }
    } catch (error) {
        console.warn('Impossibile determinare il percorso di materiali.json:', error);
    }
    return 'materiali.json';
})();

// Pagine che caricano i materiali: nome file → chiave in materiali.json
const CONFIGURAZIONI_PAGINE = {
    'biennio': 'biennio',
    'terzo': 'terzo',
    'quarto': 'quarto',
    'quinto': 'quinto',
    'laboratorio': 'laboratorio',
    'peer_tutoring': 'peer_tutoring',
    'compresenza': 'compresenza',
    'intelligenza-artificiale': 'ai'
};

// Categorie di materiale, nell'ordine in cui compaiono dentro un argomento
const TIPI = {
    laboratorio: { etichetta: '🧪 Laboratorio', bottone: 'Entra →' },
    teoria: { etichetta: '📖 Teoria', bottone: '📖 Studia' },
    download: { etichetta: '📄 Dispensa', bottone: '📥 Scarica' },
    interattivo: { etichetta: '🧠 Attività interattiva', bottone: '🚀 Apri attività' },
    autentico: { etichetta: '🧪 Compito di realtà', bottone: '🧪 Apri prova' }
};
const ORDINE_TIPI = ['laboratorio', 'teoria', 'download', 'interattivo', 'autentico'];

// Versioni differenziate: la semplificata è pensata per il sostegno
const LIVELLI = {
    intermedio: '🟡 Livello intermedio',
    semplificato: '🟢 Versione semplificata · sostegno'
};
const ORDINE_LIVELLI = ['', 'intermedio', 'semplificato'];

document.addEventListener('DOMContentLoaded', function () {
    const pagina = window.location.pathname.split('/').pop().replace('.html', '') || 'index';

    setupMobileNav();

    const chiave = CONFIGURAZIONI_PAGINE[pagina];
    if (chiave) {
        caricaMateriali(chiave);
    } else {
        costruisciIndicePagina();
    }
});

async function caricaMateriali(sezione, containerId = 'materiali-lista') {
    const container = document.getElementById(containerId);

    if (!container) {
        console.error('Container materiali non trovato');
        return;
    }

    container.innerHTML = '<div class="loading">Caricamento materiali in corso...</div>';

    try {
        const cacheBustParam = 'v=20260925';
        const response = await fetch(`${MATERIALI_JSON_URL}?${cacheBustParam}`, {
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error('Impossibile caricare i materiali');
        }

        const data = await response.json();
        const materiali = (data[sezione] || []).filter(m => m && m.file);
        const argomenti = (data.argomenti && data.argomenti[sezione]) || [];

        container.innerHTML = renderSezione(materiali, argomenti, container.dataset);
    } catch (error) {
        console.error('Errore nel caricamento dei materiali:', error);
        container.innerHTML = `
            <div class="empty-state">
                <p>⚠️ Errore nel caricamento dei materiali.</p>
                <p style="margin-top: 1rem;">Riprova più tardi o contatta il docente.</p>
            </div>
        `;
    }

    costruisciIndicePagina();
}

// Gerarchia: argomento → materiali (teoria, dispense, attività, prove), poi le verifiche.
// Si mostra solo ciò che ha contenuto: niente categorie o argomenti vuoti.
function renderSezione(materiali, argomenti, opzioni = {}) {
    if (!materiali.length) {
        return `
            <div class="empty-state">
                <p>I materiali di questa sezione vengono pubblicati durante l'anno.</p>
            </div>
        `;
    }

    const verifiche = materiali.filter(m => determinaTipoMateriale(m) === 'verifiche');
    const studio = materiali.filter(m => determinaTipoMateriale(m) !== 'verifiche');

    let gruppi;
    if (argomenti.length) {
        const noti = new Set(argomenti.map(a => a.id));
        gruppi = argomenti.map(a => ({
            id: a.id,
            titolo: a.titolo,
            descrizione: a.descrizione,
            materiali: studio.filter(m => m.argomento === a.id)
        }));
        gruppi.push({
            id: 'altri',
            titolo: 'Altri materiali',
            materiali: studio.filter(m => !noti.has(m.argomento))
        });
    } else {
        // Sezioni senza argomenti (laboratorio, peer tutoring…): si raggruppa per tipo
        gruppi = ORDINE_TIPI.map(tipo => ({
            id: tipo,
            titolo: TIPI[tipo].etichetta.replace(/^\S+\s/, ''),
            materiali: studio.filter(m => determinaTipoMateriale(m) === tipo)
        }));
    }
    gruppi = gruppi.filter(g => g.materiali.length);

    // Se c'è un solo gruppo senza argomenti, il titolo del gruppo è superfluo
    const mostraTitoliGruppo = argomenti.length || gruppi.length > 1;

    let html = '';
    if (gruppi.length) {
        html += `
            <section class="mat-blocco" id="materiali" data-indice="${escapeHtml(opzioni.etichetta || 'Materiali')}">
                ${argomenti.length ? `<h2 class="mat-blocco-titolo">${escapeHtml(opzioni.titolo || '📚 Materiali per argomento')}</h2>` : ''}
                ${gruppi.map(g => renderGruppo(g, mostraTitoliGruppo)).join('')}
            </section>
        `;
    }
    if (verifiche.length) {
        html += `
            <section class="mat-blocco" id="verifiche" data-indice="Verifiche">
                <h2 class="mat-blocco-titolo">📝 Verifiche</h2>
                ${renderVerifiche(verifiche)}
            </section>
        `;
    }
    return html;
}

function renderGruppo(gruppo, mostraTitolo) {
    const ordinati = [...gruppo.materiali].sort((a, b) => {
        const ta = ORDINE_TIPI.indexOf(determinaTipoMateriale(a));
        const tb = ORDINE_TIPI.indexOf(determinaTipoMateriale(b));
        if (ta !== tb) return ta - tb;
        // Dentro lo stesso tipo: prima la versione completa, poi quelle facilitate
        const la = ORDINE_LIVELLI.indexOf(a.livello || '');
        const lb = ORDINE_LIVELLI.indexOf(b.livello || '');
        if (la !== lb) return la - lb;
        return confrontaDate(a, b);
    });
    const intestazione = mostraTitolo ? `
        <div class="mat-gruppo-head">
            <h3>${escapeHtml(gruppo.titolo)}</h3>
            ${gruppo.descrizione ? `<p>${escapeHtml(gruppo.descrizione)}</p>` : ''}
        </div>
    ` : '';
    return `
        <div class="mat-gruppo" id="arg-${escapeHtml(gruppo.id)}">
            ${intestazione}
            <div class="mat-grid">${ordinati.map(renderCard).join('')}</div>
        </div>
    `;
}

function renderCard(materiale) {
    const tipo = determinaTipoMateriale(materiale);
    const info = TIPI[tipo] || TIPI.download;
    const rawFile = materiale.file || '';
    const filePath = escapeHtml(rawFile);
    const isHtml = /\.html?(\?|#|$)/i.test(rawFile) || /^https?:\/\//.test(rawFile);
    // Le pagine del sito (es. lab_dipendenze.html) si aprono nella stessa scheda
    const linkAttributes = tipo === 'laboratorio' ? ''
        : isHtml ? 'target="_blank" rel="noopener noreferrer"' : 'download';
    const bottone = !isHtml && tipo !== 'download' ? '📥 Scarica' : info.bottone;
    const titolo = escapeHtml(materiale.titolo || 'Materiale');
    const descrizione = materiale.descrizione ? `<p>${escapeHtml(materiale.descrizione)}</p>` : '';

    return `
        <article class="materiale-item mat-${tipo}">
            <span class="mat-tipo">${info.etichetta}</span>
            ${LIVELLI[materiale.livello] ? `<span class="mat-livello mat-livello-${materiale.livello}">${LIVELLI[materiale.livello]}</span>` : ''}
            <h4><a href="${filePath}" ${linkAttributes}>${titolo}</a></h4>
            ${descrizione}
            <a href="${filePath}" class="btn-download" ${linkAttributes}>${bottone}</a>
        </article>
    `;
}

function renderVerifiche(verifiche) {
    const ordinate = [...verifiche].sort(confrontaDate);
    const perQuad = { 1: [], 2: [], altre: [] };
    ordinate.forEach(m => {
        const q = String(m.quadrimestre || '');
        (perQuad[q] || perQuad.altre).push(m);
    });
    const blocchi = [
        { titolo: '1° quadrimestre', voci: perQuad[1] },
        { titolo: '2° quadrimestre', voci: perQuad[2] },
        { titolo: '', voci: perQuad.altre }
    ].filter(b => b.voci.length);
    const conTitoli = blocchi.length > 1 || blocchi[0].titolo;

    return blocchi.map(b => `
        <div class="mat-gruppo">
            ${conTitoli && b.titolo ? `<div class="mat-gruppo-head"><h3>${b.titolo}</h3></div>` : ''}
            <div class="mat-grid">${b.voci.map(renderVerificaCard).join('')}</div>
        </div>
    `).join('');
}

function renderVerificaCard(materiale) {
    const rawFile = materiale.file || '';
    const filePath = escapeHtml(rawFile);
    const titolo = escapeHtml(materiale.titolo || 'Verifica');
    const descrizione = materiale.descrizione ? `<p>${escapeHtml(materiale.descrizione)}</p>` : '';
    const isHtml = /\.html?(\?|#|$)/i.test(rawFile);
    const linkAttributes = isHtml ? 'target="_blank" rel="noopener noreferrer"' : 'download';
    const btnLabel = isHtml ? '🔗 Apri' : '📥 Scarica';

    return `
        <article class="materiale-item mat-verifica">
            <span class="mat-tipo">📝 Verifica</span>
            <h4><a href="${filePath}" ${linkAttributes}>${titolo}</a></h4>
            ${descrizione}
            <a href="${filePath}" class="btn-download" ${linkAttributes}>${btnLabel}</a>
        </article>
    `;
}

// Indice "In questa pagina": raccoglie le sezioni marcate con data-indice
function costruisciIndicePagina() {
    const indice = document.getElementById('indice-pagina');
    if (!indice) return;
    const sezioni = [...document.querySelectorAll('main [data-indice][id]')];
    if (sezioni.length < 2) {
        indice.hidden = true;
        return;
    }
    indice.innerHTML = sezioni
        .map(s => `<a href="#${s.id}">${escapeHtml(s.dataset.indice)}</a>`)
        .join('');
    indice.hidden = false;
}

function confrontaDate(a, b) {
    const da = Date.parse(a.data) || 0;
    const db = Date.parse(b.data) || 0;
    return db - da;
}

function setupMobileNav() {
    const nav = document.querySelector('nav');
    const navList = nav?.querySelector('ul');
    if (!nav || !navList) {
        return;
    }

    if (!navList.id) {
        navList.id = 'site-navigation';
    }

    if (nav.querySelector('.nav-toggle')) {
        return;
    }

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', navList.id);
    toggle.setAttribute('aria-label', 'Apri il menu di navigazione');
    toggle.innerHTML = '<span class="nav-toggle-label">Menu</span><span class="nav-toggle-icon" aria-hidden="true">☰</span>';
    nav.insertBefore(toggle, nav.firstChild);

    // Con i sottomenu scrollHeight sottostima l'altezza: si sommano le voci
    const altezzaMenu = () => Math.max(
        navList.scrollHeight,
        [...navList.children].reduce((tot, li) => tot + li.offsetHeight, 0)
    );

    const mobileQuery = window.matchMedia('(max-width: 768px)');
    let lastScrollY = window.scrollY || 0;

    const collapseNav = () => {
        nav.classList.remove('nav-open');
        if (mobileQuery.matches) {
            navList.style.maxHeight = '0px';
            navList.style.opacity = '0';
            navList.style.visibility = 'hidden';
            navList.style.pointerEvents = 'none';
            toggle.setAttribute('aria-expanded', 'false');
        } else {
            navList.style.maxHeight = '';
            navList.style.opacity = '';
            navList.style.visibility = '';
            navList.style.pointerEvents = '';
            toggle.setAttribute('aria-expanded', 'true');
        }
    };

    const expandNav = () => {
        nav.classList.add('nav-open');
        navList.style.maxHeight = `${altezzaMenu()}px`;
        navList.style.opacity = '1';
        navList.style.visibility = 'visible';
        navList.style.pointerEvents = 'auto';
        toggle.setAttribute('aria-expanded', 'true');
        nav.classList.remove('nav-hidden');
    };

    const updateMode = () => {
        if (mobileQuery.matches) {
            nav.classList.add('nav-collapsible');
            collapseNav();
        } else {
            nav.classList.remove('nav-collapsible', 'nav-hidden', 'nav-open');
            navList.style.maxHeight = '';
            navList.style.opacity = '';
            navList.style.visibility = '';
            navList.style.pointerEvents = '';
            toggle.setAttribute('aria-expanded', 'true');
        }
    };

    const handleScroll = () => {
        if (!mobileQuery.matches) {
            nav.classList.remove('nav-hidden');
            lastScrollY = window.scrollY || 0;
            return;
        }

        const current = window.scrollY || 0;
        if (nav.classList.contains('nav-open')) {
            lastScrollY = current;
            return;
        }

        if (current > lastScrollY && current > 80) {
            nav.classList.add('nav-hidden');
        } else {
            nav.classList.remove('nav-hidden');
        }
        lastScrollY = current;
    };

    toggle.addEventListener('click', () => {
        if (nav.classList.contains('nav-open')) {
            collapseNav();
        } else {
            expandNav();
        }
    });

    navList.addEventListener('click', event => {
        if (mobileQuery.matches && event.target.closest('a')) {
            collapseNav();
        }
    });

    const onMediaChange = () => {
        updateMode();
        handleScroll();
    };

    if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', onMediaChange);
    } else if (typeof mobileQuery.addListener === 'function') {
        mobileQuery.addListener(onMediaChange);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', () => {
        if (nav.classList.contains('nav-open') && mobileQuery.matches) {
            navList.style.maxHeight = `${altezzaMenu()}px`;
        }
    });

    updateMode();
    handleScroll();
}

// Funzione per escape HTML (sicurezza)
function escapeHtml(text) {
    if (text === undefined || text === null) {
        return '';
    }

    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function determinaTipoMateriale(materiale) {
    const tipoDichiarato = (materiale.tipo || '').toLowerCase().trim();
    const tipoNormalizzato = typeof tipoDichiarato.normalize === 'function'
        ? tipoDichiarato.normalize('NFD').replace(/[̀-ͯ]/g, '')
        : tipoDichiarato;

    if (tipoNormalizzato.includes('verifica')) {
        return 'verifiche';
    }

    if (tipoNormalizzato === 'laboratorio') {
        return 'laboratorio';
    }

    if (tipoNormalizzato === 'teoria') {
        return 'teoria';
    }

    const paroleChiaveAutentico = ['autentico', 'autentica', 'prove', 'prova', 'compito', 'compiti', 'realta'];

    if (paroleChiaveAutentico.some(keyword => tipoNormalizzato.includes(keyword))) {
        return 'autentico';
    }

    if (tipoNormalizzato === 'interattivo' || tipoNormalizzato === 'interactive') {
        return 'interattivo';
    }

    if (tipoNormalizzato === 'download') {
        return 'download';
    }

    const estensione = (materiale.file || '').trim().toLowerCase();
    if (estensione.endsWith('.html') || estensione.endsWith('.htm')) {
        return 'interattivo';
    }

    return 'download';
}
