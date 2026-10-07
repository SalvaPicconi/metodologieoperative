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
                return `<h4 class="uda-sezione-anno">${esc(anno)}</h4>${delAnno.map(scheda).join('')}`;
            }).join('');
            contenitore.innerHTML = `
              <h3 class="uda-sezione-testata">${esc(contenitore.dataset.titolo || 'Unità di apprendimento')}</h3>
              <p class="uda-sezione-intro">${esc(contenitore.dataset.intro || '')}
                 <a href="programmi.html?sezione=${encodeURIComponent(sezione)}">Vedile tutte nei Programmi</a>.</p>
              ${perAnno}`;
        })
        .catch((errore) => {
            console.error('Impossibile caricare le UDA della sezione:', errore);
            contenitore.hidden = true;
        });
})();
