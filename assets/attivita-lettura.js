/*
 * Supporto allo stile di lettura comune (assets/attivita-lettura.css).
 * Copia il titolo di ogni colonna nelle celle delle tabelle, così sul telefono ogni riga diventa una scheda
 * leggibile. Aggiunge solo attributi di presentazione: campi, identificativi e salvataggi non cambiano.
 */
(function () {
    function etichetta() {
        document.querySelectorAll('body.lettura table').forEach(function (tabella) {
            var titoli = Array.prototype.map.call(tabella.querySelectorAll('thead th'), function (th) {
                return th.textContent.replace(/\s+/g, ' ').trim();
            });
            if (!titoli.length) return;
            tabella.querySelectorAll('tbody tr').forEach(function (riga) {
                Array.prototype.forEach.call(riga.children, function (cella, i) {
                    if (titoli[i] && !cella.hasAttribute('data-etichetta')) cella.setAttribute('data-etichetta', titoli[i]);
                });
            });
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', etichetta);
    else etichetta();
})();
