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

document.addEventListener('DOMContentLoaded', function() {
    // Ottieni la sezione corrente dal nome del file
    let pagina = window.location.pathname.split('/').pop().replace('.html', '');
    if (!pagina) {
        pagina = 'index';
    }

    setupMobileNav();
    
    // Configurazioni delle pagine che richiedono il caricamento dei materiali
    const configurazioniPagine = {
        'biennio': { chiave: 'biennio' },
        'terzo': { chiave: 'terzo' },
        'quarto': { chiave: 'quarto' },
        'quinto': { chiave: 'quinto' },
        'laboratorio': { chiave: 'laboratorio' },
        'peer_tutoring': { chiave: 'peer_tutoring' },
        'compresenza': { chiave: 'compresenza' },
        'index': { chiave: 'ai', containerId: 'materiali-ai' }
    };
    
    const configurazione = configurazioniPagine[pagina];
    
    if (!configurazione) {
        console.log('Pagina non richiede caricamento materiali');
        return;
    }
    
    // Carica i materiali
    caricaMateriali(configurazione.chiave, configurazione.containerId);
});

async function caricaMateriali(sezione, containerId = 'materiali-lista') {
    const container = document.getElementById(containerId);
    
    if (!container) {
        console.error('Container materiali non trovato');
        return;
    }
    
    // Mostra stato di caricamento
    container.innerHTML = '<div class="loading">Caricamento materiali in corso...</div>';
    
    try {
        // Carica il file JSON
        const cacheBustParam = 'v=20251016';
        const response = await fetch(`${MATERIALI_JSON_URL}?${cacheBustParam}`, {
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error('Impossibile caricare i materiali');
        }
        
        const data = await response.json();
        const materiali = data[sezione] || [];
        
        // Ordina i materiali per data (più recenti prima)
        materiali.sort((a, b) => new Date(b.data) - new Date(a.data));
        
        const materialiPerTipo = materiali.reduce((acc, materiale) => {
            const tipo = determinaTipoMateriale(materiale);
            if (!acc[tipo]) {
                acc[tipo] = [];
            }
            acc[tipo].push(materiale);
            return acc;
        }, { download: [], interattivo: [], autentico: [], verifiche: [] });

        const tabsConfig = [
            { key: 'download', label: '📁 Materiali da scaricare', renderer: renderDownloadList },
            { key: 'interattivo', label: '🧠 Apprendimento interattivo', renderer: renderInteractiveList },
            { key: 'autentico', label: '🧪 Prove autentiche / Compiti di realtà', renderer: renderAuthenticList },
            { key: 'verifiche', label: '📝 Verifiche Sommative', renderer: renderVerificheList }
        ];

        const defaultTab = tabsConfig.find(tab => (materialiPerTipo[tab.key] || []).length)?.key || 'download';

        const tabButtonsHtml = tabsConfig.map(tab => `
            <button class="tab-btn ${defaultTab === tab.key ? 'active' : ''}" data-tab="${tab.key}">
                ${tab.label}
            </button>
        `).join('');

        const tabPanelsHtml = tabsConfig.map(tab => `
            <div class="tab-panel ${defaultTab === tab.key ? 'active' : ''}" data-panel="${tab.key}">
                ${tab.renderer(materialiPerTipo[tab.key] || [])}
            </div>
        `).join('');

        container.innerHTML = `
            <div class="materiali-tabs">
                ${tabButtonsHtml}
            </div>
            <div class="tab-panels">
                ${tabPanelsHtml}
            </div>
        `;

        inizializzaTab(container);
        
    } catch (error) {
        console.error('Errore nel caricamento dei materiali:', error);
        container.innerHTML = `
            <div class="empty-state">
                <p>⚠️ Errore nel caricamento dei materiali.</p>
                <p style="margin-top: 1rem;">Riprova più tardi o contatta il docente.</p>
            </div>
        `;
    }
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
        navList.style.maxHeight = `${navList.scrollHeight}px`;
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
            navList.style.maxHeight = `${navList.scrollHeight}px`;
        }
    });

    updateMode();
    handleScroll();
}

function renderDownloadList(materiali) {
    if (!materiali.length) {
        return creaMessaggioVuoto(
            '📁 Nessun materiale da scaricare disponibile al momento.',
            'A breve caricheremo nuovi materiali. Torna a controllare!'
        );
    }

    return materiali.map(renderDownloadCard).join('');
}

function renderInteractiveList(materiali) {
    if (!materiali.length) {
        return creaMessaggioVuoto(
            '🧠 Nessuna attività interattiva disponibile.',
            'Le attività verranno pubblicate nel corso dell\'anno scolastico.'
        );
    }

    return materiali.map(renderInteractiveCard).join('');
}

function renderAuthenticList(materiali) {
    if (!materiali.length) {
        return creaMessaggioVuoto(
            '🧪 Nessuna prova autentica o compito di realtà disponibile al momento.',
            'Caricheremo presto nuove prove autentiche. Torna a dare un\'occhiata!'
        );
    }

    return materiali.map(renderAuthenticCard).join('');
}

function renderDownloadCard(materiale) {
    const dataFormattata = formattaData(materiale.data);
    const rawFile = materiale.file || '';
    const filePath = escapeHtml(rawFile);
    const titolo = escapeHtml(materiale.titolo || 'Materiale');
    const descrizione = materiale.descrizione ? `<p>${escapeHtml(materiale.descrizione)}</p>` : '';
    const linkAttributes = rawFile ? 'download' : 'aria-disabled="true"';
    const label = '📥 Scarica';

    return `
        <div class="materiale-item">
            <div class="materiale-header">
                <h3>${titolo}</h3>
                <span class="materiale-data">${dataFormattata}</span>
            </div>
            ${descrizione}
            <a href="${filePath}" class="btn-download" ${linkAttributes}>
                ${label}
            </a>
        </div>
    `;
}

function renderInteractiveCard(materiale) {
    const dataFormattata = formattaData(materiale.data);
    const rawFile = materiale.file || '';
    const filePath = escapeHtml(rawFile);
    const titolo = escapeHtml(materiale.titolo || 'Attività interattiva');
    const descrizione = materiale.descrizione ? `<p>${escapeHtml(materiale.descrizione)}</p>` : '';

    return `
        <div class="materiale-item materiale-interattivo">
            <div class="materiale-header">
                <h3><a href="${filePath}" target="_blank" rel="noopener noreferrer">${titolo}</a></h3>
                <span class="materiale-data">${dataFormattata}</span>
            </div>
            ${descrizione}
            <a href="${filePath}" class="btn-download btn-interattivo" target="_blank" rel="noopener noreferrer">
                🚀 Apri attività
            </a>
        </div>
    `;
}

function renderAuthenticCard(materiale) {
    const dataFormattata = formattaData(materiale.data);
    const rawFile = materiale.file || '';
    const filePath = escapeHtml(rawFile);
    const href = filePath || '#';
    const titolo = escapeHtml(materiale.titolo || 'Prova autentica');
    const descrizione = materiale.descrizione ? `<p>${escapeHtml(materiale.descrizione)}</p>` : '';
    const isExternal = /^https?:\/\//.test(rawFile);
    const isHtml = rawFile.toLowerCase().endsWith('.html') || rawFile.toLowerCase().endsWith('.htm');
    const linkAttributes = rawFile
        ? (isExternal || isHtml ? 'target="_blank" rel="noopener noreferrer"' : 'download')
        : 'aria-disabled="true"';

    return `
        <div class="materiale-item materiale-prova">
            <div class="materiale-header">
                <h3>${titolo}</h3>
                <span class="materiale-data">${dataFormattata}</span>
            </div>
            ${descrizione}
            <a href="${href}" class="btn-download btn-prova" ${linkAttributes}>
                🧪 Apri prova
            </a>
        </div>
    `;
}

function creaMessaggioVuoto(titolo, sottotitolo) {
    return `
        <div class="empty-state">
            <p>${escapeHtml(titolo)}</p>
            <p style="margin-top: 1rem;">${escapeHtml(sottotitolo)}</p>
        </div>
    `;
}

function inizializzaTab(container) {
    const bottoni = container.querySelectorAll('.tab-btn');
    const pannelli = container.querySelectorAll('.tab-panel');

    bottoni.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;

            bottoni.forEach(b => b.classList.toggle('active', b === btn));
            pannelli.forEach(panel => {
                panel.classList.toggle('active', panel.dataset.panel === tab);
            });
        });
    });
}

// Funzione per formattare la data
function formattaData(dataString) {
    if (!dataString) return '';
    
    try {
        const data = new Date(dataString);
        const opzioni = { year: 'numeric', month: 'long', day: 'numeric' };
        return data.toLocaleDateString('it-IT', opzioni);
    } catch (error) {
        return dataString;
    }
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
        ? tipoDichiarato.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : tipoDichiarato;
    
    if (tipoNormalizzato.includes('verifica')) {
        return 'verifiche';
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

function renderVerificheList(materiali) {
    // Ordina prima per quadrimestre (1 poi 2), poi per data inversa
    // In realtà vogliamo mostrare: Primo Quadrimestre, poi Secondo
    // I materiali sono già ordinati per data inversa.
    
    // Separa per quadrimestre
    const primoQuad = materiali.filter(m => m.quadrimestre === 1 || m.quadrimestre === '1');
    const secondoQuad = materiali.filter(m => m.quadrimestre === 2 || m.quadrimestre === '2');
    
    // Se non ci sono materiali in assoluto
    if (primoQuad.length === 0 && secondoQuad.length === 0) {
        return creaMessaggioVuoto(
            '📝 Nessuna verifica sommativa disponibile.',
            'Qui troverai i materiali per le verifiche del primo e secondo quadrimestre.'
        );
    }

    let html = '';

    // Primo Quadrimestre
    html += `<h3 class="semester-title">1️⃣ Primo Quadrimestre</h3>`;
    if (primoQuad.length > 0) {
        html += primoQuad.map(renderVerificaCard).join('');
    } else {
        html += `<p class="muted" style="margin-bottom: 2rem;">Nessun materiale ancora disponibile per il primo quadrimestre.</p>`;
    }

    // Secondo Quadrimestre
    html += `<h3 class="semester-title">2️⃣ Secondo Quadrimestre</h3>`;
    if (secondoQuad.length > 0) {
        html += secondoQuad.map(renderVerificaCard).join('');
    } else {
        html += `<p class="muted">Nessun materiale ancora disponibile per il secondo quadrimestre.</p>`;
    }

    return html;
}

function renderVerificaCard(materiale) {
    const dataFormattata = formattaData(materiale.data);
    const rawFile = materiale.file || '';
    const filePath = escapeHtml(rawFile);
    const titolo = escapeHtml(materiale.titolo || 'Verifica Sommativa');
    const descrizione = materiale.descrizione ? `<p>${escapeHtml(materiale.descrizione)}</p>` : '';
    const linkAttributes = rawFile ? 'download' : 'aria-disabled="true"';
    
    return `
        <div class="materiale-item materiale-verifica">
            <div class="materiale-header">
                <h3>${titolo}</h3>
                <span class="materiale-data">${dataFormattata}</span>
            </div>
            ${descrizione}
            <a href="${filePath}" class="btn-download btn-verifica" ${linkAttributes}>
                📥 Scarica materiale
            </a>
        </div>
    `;
}
