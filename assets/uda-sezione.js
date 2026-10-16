// Elenca in una pagina di sezione (Compresenza, Laboratorio, Orientamento) le UDA dei Programmi
// che portano quella sezione. Le UDA restano scritte in un posto solo, programmi-src/: qui si
// leggono da programmi.json e ogni scheda rimanda ai Programmi, dove stanno tutte insieme.
(function () {
    const contenitore = document.getElementById('uda-sezione');
    if (!contenitore) {
        return;
    }
    const sezione = contenitore.dataset.sezione;

    const esc = (testo) => String(testo ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
    const slug = (valore) => String(valore).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    function scheda(modulo) {
        const chiave = `${slug(modulo.anno)}-uda-${modulo.n}`;
        // Cataloghi di attività: i contenuti curricolari restano nei Programmi,
        // il primo materiale HTML è l'ingresso al percorso per gli studenti.
        if (contenitore.dataset.attivita === 'true') {
            const pagina = (modulo.materiali || []).find(m => /\.html(?:[?#]|$)/i.test(m.file));
            return `<article class="civica-card">
              <p class="civica-eyebrow">UDA ${esc(modulo.n)} · ${esc(modulo.monteOre)}</p>
              <h4>${esc(modulo.titolo)}</h4><p>${esc(modulo.sintesi)}</p>
              <p><strong>Prodotto:</strong> ${esc(modulo.prodottoFinale)}</p>
              <div class="civica-azioni">
                ${pagina ? `<a class="civica-button" href="${esc(pagina.file)}">Apri il percorso →</a>` : ''}
                <a href="programmi.html?uda=${encodeURIComponent(chiave)}">Nella programmazione</a>
              </div></article>`;
        }
        const prova = modulo.provaEsperta || {};
        const attivita = (modulo.contenuti || []).map((c) => `<li>${esc(c.attivita)}</li>`).join('');
        return `
        <details class="uda-sezione-scheda">
          <summary>
            <span class="uda-sezione-titolo">${esc(modulo.titolo)}</span>
            <span class="uda-sezione-meta">UDA ${esc(modulo.n)} · ${esc(modulo.periodo)} · ${esc(modulo.monteOre)}</span>
          </summary>
          <div class="uda-sezione-corpo">
            <p>${esc(modulo.sintesi)}</p>
            <p class="uda-sezione-et">Contenuti e attività</p>
            <ul>${attivita}</ul>
            <p class="uda-sezione-et">Prodotto finale</p>
            <p>${esc(modulo.prodottoFinale)}</p>
            ${prova.titolo ? `<p class="uda-sezione-et">Prova esperta di laboratorio</p>
            <p><strong>${esc(prova.titolo)}</strong> — ${esc(prova.compito)}</p>` : ''}
            <p><a class="uda-sezione-link" href="programmi.html?uda=${encodeURIComponent(chiave)}">Apri la UDA completa nei Programmi →</a></p>
          </div>
        </details>`;
    }

    fetch('programmi.json', { cache: 'no-cache' })
        .then((risposta) => {
            if (!risposta.ok) {
                throw new Error(`HTTP ${risposta.status}`);
            }
            return risposta.json();
        })
        .then((dati) => {
            const sue = dati.moduli.filter((m) => m.sezione === sezione);
            if (!sue.length) {
                contenitore.hidden = true;
                return;
            }
            const perAnno = dati.meta.anni.map((anno) => {
                const delAnno = sue.filter((m) => m.anno === anno).sort((a, b) => a.n - b.n);
                if (!delAnno.length) {
                    return '';
                }
                const h = contenitore.dataset.attivita === 'true' ? 'h3' : 'h4';
                return `<${h} class="uda-sezione-anno">${esc(anno)}</${h}>${delAnno.map(scheda).join('')}`;
            }).join('');
            const h = contenitore.dataset.attivita === 'true' ? 'h2' : 'h3';
            contenitore.innerHTML = `
              <${h} class="uda-sezione-testata">${esc(contenitore.dataset.titolo || 'Unità di apprendimento')}</${h}>
              <p class="uda-sezione-intro">${esc(contenitore.dataset.intro || '')}
                 <a href="programmi.html?sezione=${encodeURIComponent(sezione)}">Vedile tutte nei Programmi</a>.</p>
              ${perAnno}`;
        })
        .catch((errore) => {
            console.error('Impossibile caricare le UDA della sezione:', errore);
            if (contenitore.dataset.attivita === 'true') {
                // Mantiene raggiungibile il materiale anche se il catalogo non si carica.
                contenitore.innerHTML = '<p>Il catalogo non è disponibile. Ricarica la pagina oppure <a href="materiali/educazione-civica/dall-informazione-alla-partecipazione.html">apri Dall’informazione alla partecipazione · terzo anno</a>.</p>';
            } else {
                contenitore.hidden = true;
            }
        });
})();
