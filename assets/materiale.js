// Comportamenti comuni delle pagine dei materiali (va insieme ad assets/materiale.css).
(function () {
    'use strict';

    // Etichetta studente e «Cambia studente» (creati da progress-global.js) entrano nel
    // contenitore .identita della pagina, invece di galleggiare sopra il testo.
    function sistemaIdentita() {
        const box = document.querySelector('[data-identita]');
        if (!box) return;
        const sposta = () => {
            const nodi = ['#studentLabel', '#resetStudent'].map(s => document.querySelector(s));
            nodi.filter(Boolean).forEach(n => { if (n.parentNode !== box) box.append(n); });
            return nodi.every(Boolean);
        };
        if (sposta()) return;
        const osservatore = new MutationObserver(() => { if (sposta()) osservatore.disconnect(); });
        osservatore.observe(document.body, { childList: true });
    }

    // In stampa si aprono gli approfondimenti chiusi, poi si richiudono.
    function stampaCompleta() {
        let aperti = [];
        window.addEventListener('beforeprint', () => {
            aperti = [...document.querySelectorAll('details:not([open]):not(.non-stampare)')];
            aperti.forEach(d => d.setAttribute('open', ''));
        });
        window.addEventListener('afterprint', () => aperti.forEach(d => d.removeAttribute('open')));
    }

    // L'indice segnala la sezione che si sta leggendo.
    function indiceAttivo() {
        const link = [...document.querySelectorAll('.indice a[href^="#"]')];
        if (!link.length || !('IntersectionObserver' in window)) return;
        const perId = new Map(link.map(a => [decodeURIComponent(a.hash.slice(1)), a]));
        const oss = new IntersectionObserver(voci => {
            voci.forEach(v => {
                if (!v.isIntersecting) return;
                link.forEach(a => a.removeAttribute('aria-current'));
                const a = perId.get(v.target.id);
                if (a) {
                    a.setAttribute('aria-current', 'true');
                    const lista = a.closest('ol');
                    if (lista) {
                        const dx = a.getBoundingClientRect().left - lista.getBoundingClientRect().left;
                        lista.scrollLeft += dx - 16;
                    }
                }
            });
        }, { rootMargin: '-30% 0px -60% 0px' });
        perId.forEach((_, id) => { const el = document.getElementById(id); if (el) oss.observe(el); });
    }

    function avvia() { sistemaIdentita(); stampaCompleta(); indiceAttivo(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
    else avvia();
})();
