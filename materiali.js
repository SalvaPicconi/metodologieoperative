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
        
        // Genera l'HTML per ogni materiale
        container.innerHTML = materiali.map(materiale => {
            const dataFormattata = formattaData(materiale.data);
            return `
                <div class="materiale-item">
                    <div class="materiale-header">
                        <h3>${escapeHtml(materiale.titolo)}</h3>
                        <span class="materiale-data">${dataFormattata}</span>
                    </div>
                    ${materiale.descrizione ? `<p>${escapeHtml(materiale.descrizione)}</p>` : ''}
                    <a href="${escapeHtml(materiale.file)}" class="btn-download" download>
                        📥 Scarica
                    </a>
                </div>
            `;
        }).join('');
        
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
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
