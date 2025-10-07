// Script per caricare e visualizzare i materiali dal file JSON
document.addEventListener('DOMContentLoaded', function() {
    // Ottieni la sezione corrente dal nome del file
    const pagina = window.location.pathname.split('/').pop().replace('.html', '');
    
    // Mappa delle pagine alle chiavi del JSON
    const mappaSezioni = {
        'biennio': 'biennio',
        'terzo': 'terzo',
        'quarto': 'quarto',
        'quinto': 'quinto'
    };
    
    const sezione = mappaSezioni[pagina];
    
    if (!sezione) {
        console.log('Pagina non richiede caricamento materiali');
        return;
    }
    
    // Carica i materiali
    caricaMateriali(sezione);
});

async function caricaMateriali(sezione) {
    const container = document.getElementById('materiali-lista');
    
    if (!container) {
        console.error('Container materiali non trovato');
        return;
    }
    
    // Mostra stato di caricamento
    container.innerHTML = '<div class="loading">Caricamento materiali in corso...</div>';
    
    try {
        // Carica il file JSON
        const response = await fetch('materiali.json');
        
        if (!response.ok) {
            throw new Error('Impossibile caricare i materiali');
        }
        
        const data = await response.json();
        const materiali = data[sezione] || [];
        
        // Controlla se ci sono materiali
        if (materiali.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>📭 Nessun materiale disponibile al momento.</p>
                    <p style="margin-top: 1rem;">I materiali verranno caricati durante l'anno scolastico.</p>
                </div>
            `;
            return;
        }
        
        // Ordina i materiali per data (più recenti prima)
        materiali.sort((a, b) => new Date(b.data) - new Date(a.data));
        
        const materialiPerTipo = materiali.reduce((acc, materiale) => {
            const tipo = determinaTipoMateriale(materiale);
            acc[tipo].push(materiale);
            return acc;
        }, { download: [], interattivo: [] });

        container.innerHTML = `
            <div class="materiali-tabs">
                <button class="tab-btn active" data-tab="download">📁 Materiali da scaricare</button>
                <button class="tab-btn" data-tab="interattivo">🧠 Apprendimento interattivo</button>
            </div>
            <div class="tab-panels">
                <div class="tab-panel active" data-panel="download">
                    ${renderDownloadList(materialiPerTipo.download)}
                </div>
                <div class="tab-panel" data-panel="interattivo">
                    ${renderInteractiveList(materialiPerTipo.interattivo)}
                </div>
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
    const tipoDichiarato = (materiale.tipo || '').toLowerCase();
    
    if (tipoDichiarato === 'interattivo') {
        return 'interattivo';
    }
    
    if (tipoDichiarato === 'download') {
        return 'download';
    }
    
    const estensione = (materiale.file || '').trim().toLowerCase();
    if (estensione.endsWith('.html') || estensione.endsWith('.htm')) {
        return 'interattivo';
    }
    
    return 'download';
}
