// Script per caricare e visualizzare i materiali dal file JSON
document.addEventListener('DOMContentLoaded', function() {
    // Ottieni la sezione corrente dal nome del file
    let pagina = window.location.pathname.split('/').pop().replace('.html', '');
    if (!pagina) {
        pagina = 'index';
    }
    
    // Configurazioni delle pagine che richiedono il caricamento dei materiali
    const configurazioniPagine = {
        'biennio': { chiave: 'biennio' },
        'terzo': { chiave: 'terzo' },
        'quarto': { chiave: 'quarto' },
        'quinto': { chiave: 'quinto' },
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
        const response = await fetch(`materiali.json?${cacheBustParam}`, {
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
        }, { download: [], interattivo: [], autentico: [] });

        const tabsConfig = [
            { key: 'download', label: '📁 Materiali da scaricare', renderer: renderDownloadList },
            { key: 'interattivo', label: '🧠 Apprendimento interattivo', renderer: renderInteractiveList },
            { key: 'autentico', label: '🧪 Prove autentiche / Compiti di realtà', renderer: renderAuthenticList }
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
