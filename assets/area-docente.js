/*
 * Area docente del sito Metodologie Operative.
 *
 * Quattro schede:
 * - Compiti: il docente assegna una pagina del sito a una classe, con scadenza, e vede l'avanzamento
 *   di ogni alunno (completato, in corso, non iniziato);
 * - Classi: per ogni classe, la griglia alunni × compiti attivi e l'elenco dei codici studente,
 *   con i codici sbagliati ricondotti all'alunno giusto (alias);
 * - Attività recenti: chi ha lavorato su che cosa, per periodo;
 * - Verifiche e strumenti: correzione delle verifiche, statistiche e risultati del test di Stroop.
 *
 * Tutti i dati passano dalle funzioni protette di Supabase (supabase/area-docente-compiti.sql e
 * supabase/progress-protezione.sql) con la sessione aperta da assets/docente-accesso.js.
 * Nel browser non c'è nessuna password; i codici studente arrivano dal database e si mostrano
 * sempre passando da esc().
 */
(function () {
    'use strict';

    const GIORNO = 24 * 60 * 60 * 1000;
    const SOGLIA_COMPLETATO = 90;   // percentuale da cui un lavoro conta come completato
    const GIORNI_FERMO = 3;         // un lavoro non finito senza salvataggi da tanti giorni è «fermo»
    const VISTA_KEY = 'mo:area-docente-vista';
    const SUPER_STORAGE_KEY = 'mo:super-impersonations';
    const SUPER_SESSION_DURATION = 15 * 60 * 1000;
    const PAGE_ALIAS = {
        'attivita-materiali-ai-verifica-ia-modificata-01': '/materiali/ai/verifica_ia_modificata.html',
        '/materiali/peer_tutoring_platform.html': '/materiali/peer_tutoring/peer_tutoring_platform.html'
    };
    const SEZIONI = {
        biennio: 'Biennio', terzo: 'Terzo anno', quarto: 'Quarto anno', quinto: 'Quinto anno',
        laboratorio: 'Laboratorio', peer_tutoring: 'Peer tutoring', compresenza: 'Compresenza',
        ai: 'Intelligenza artificiale'
    };

    const stato = {
        righe: [],               // salvataggi senza contenuto, con conteggio dei campi
        classi: new Map(),       // classe → [{ codice, alias: [] }]
        compiti: [],
        catalogo: new Map(),     // percorso → { titolo, sezione }
        totaliPagina: new Map(), // percorso → numero massimo di campi visto
        vista: 'compiti',
        filtroCompiti: '',
        classeScelta: '',
        compitiAperti: new Set(),
        stroop: null,
        caricato: false
    };

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    // ───────────────────────── utilità ─────────────────────────

    function esc(valore) {
        return String(valore == null ? '' : valore)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function normPath(path) {
        if (!path) return '';
        let p = String(path).trim();
        if (PAGE_ALIAS[p]) return PAGE_ALIAS[p];
        p = p.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0];
        if (!p.startsWith('/')) p = '/' + p;
        p = p.replace(/\/{2,}/g, '/').replace(/^\/metodologieoperative(?=\/)/, '');
        try { p = decodeURI(p); } catch { /* resta com'è */ }
        return PAGE_ALIAS[p] || p;
    }

    function normCodice(c) { return String(c || '').trim().toLowerCase(); }

    function titoloPagina(path) {
        const voce = stato.catalogo.get(path);
        if (voce) return voce.titolo;
        let nome = String(path || '').split('/').pop().replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
        if (!nome) return path || '—';
        return nome.charAt(0).toUpperCase() + nome.slice(1);
    }

    function sezionePagina(path) {
        const voce = stato.catalogo.get(path);
        if (voce) return voce.sezione;
        const parti = String(path).split('/');
        return parti.length > 2 ? (SEZIONI[parti[2]] || parti[2]) : '';
    }

    function inizioAnnoScolastico() {
        const ora = new Date();
        const anno = ora.getMonth() >= 8 ? ora.getFullYear() : ora.getFullYear() - 1;
        return new Date(anno, 8, 1);
    }

    function oggiISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function dataBreve(valore) {
        if (!valore) return '—';
        const d = new Date(valore);
        if (isNaN(d)) return '—';
        return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) + ' ' +
            d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    }

    function dataGiorno(iso) {
        if (!iso) return '';
        const [a, m, g] = String(iso).split('-').map(Number);
        return new Date(a, m - 1, g).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
    }

    function giorniFa(valore) {
        if (!valore) return null;
        return Math.floor((Date.now() - new Date(valore).getTime()) / GIORNO);
    }

    function quandoFa(valore) {
        const g = giorniFa(valore);
        if (g === null) return 'mai';
        if (g <= 0) return 'oggi';
        if (g === 1) return 'ieri';
        return `${g} giorni fa`;
    }

    function giorniAllaScadenza(iso) {
        if (!iso) return null;
        const [a, m, g] = String(iso).split('-').map(Number);
        const scad = new Date(a, m - 1, g);
        const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
        return Math.round((scad - oggi) / GIORNO);
    }

    function nomeClasse(c) { return String(c || '').toUpperCase(); }

    function ordinaClassi(lista) {
        return Array.from(new Set(lista)).filter(Boolean).sort((a, b) => a.localeCompare(b, 'it', { numeric: true }));
    }

    // ───────────────────────── avanzamento ─────────────────────────

    function percentuale(riga) {
        if (!riga) return null;
        const meta = riga.meta || {};
        if (typeof meta.percentuale === 'number' && meta.percentuale > 0) return Math.min(100, Math.round(meta.percentuale));
        const tot = Math.max(stato.totaliPagina.get(riga.page_path) || 0, riga.totali || 0, Number(meta.totale) || 0);
        if (!tot) return typeof meta.percentuale === 'number' ? Math.round(meta.percentuale) : 0;
        return Math.min(100, Math.round((riga.compilati || 0) * 100 / tot));
    }

    function statoLavoro(riga) {
        if (!riga) return { chiave: 'zero', etichetta: 'Non iniziato', pct: 0 };
        const pct = percentuale(riga);
        if (pct >= SOGLIA_COMPLETATO) return { chiave: 'fatto', etichetta: 'Completato', pct };
        if (!pct) return { chiave: 'zero', etichetta: 'Aperto, vuoto', pct: 0 };
        return { chiave: 'corso', etichetta: 'In corso', pct };
    }

    const COLORI = { fatto: '#16a34a', corso: '#f59e0b', zero: '#dc2626' };

    function barraAvanzamento(riga) {
        const s = statoLavoro(riga);
        const colore = COLORI[s.chiave];
        return `<div class="ad-barra-avanz" title="${riga ? `${riga.compilati || 0} campi compilati` : 'nessun salvataggio'}">
            <div class="ad-traccia"><div class="ad-riempi" style="width:${s.pct}%;background:${colore}"></div></div>
            <small>${s.pct}%</small></div>`;
    }

    function badgeStato(riga) {
        const s = statoLavoro(riga);
        let fermo = '';
        if (riga && s.chiave !== 'fatto') {
            const g = giorniFa(riga.updated_at);
            if (g >= GIORNI_FERMO) fermo = `<span class="ad-fermo">fermo da ${g} giorni</span>`;
        }
        return `<span class="ad-stato ad-stato-${s.chiave}">${s.etichetta}</span>${fermo}`;
    }

    // Elenco della classe: codici con i loro alias. Se manca, si usano i codici visti quest'anno.
    function alunniDellaClasse(classe) {
        const elenco = stato.classi.get(classe);
        if (elenco && elenco.length) return { daElenco: true, alunni: elenco };
        const dal = inizioAnnoScolastico().getTime();
        const codici = ordinaClassi(stato.righe
            .filter(r => r.class_code === classe && new Date(r.updated_at).getTime() >= dal)
            .map(r => r.student_code));
        return { daElenco: false, alunni: codici.map(codice => ({ codice, alias: [] })) };
    }

    function mappaAlias(classe) {
        const mappa = new Map();
        (stato.classi.get(classe) || []).forEach(a => {
            mappa.set(a.codice, a.codice);
            (a.alias || []).forEach(x => mappa.set(x, a.codice));
        });
        return mappa;
    }

    function migliore(a, b) {
        if (!a) return b;
        if (!b) return a;
        const pa = percentuale(a), pb = percentuale(b);
        if (pa !== pb) return pa > pb ? a : b;
        return new Date(a.updated_at) >= new Date(b.updated_at) ? a : b;
    }

    // Per un compito: una riga per alunno dell'elenco, più chi ha salvato con un codice fuori elenco.
    function avanzamentoCompito(compito) {
        const { daElenco, alunni } = alunniDellaClasse(compito.class_code);
        const alias = mappaAlias(compito.class_code);
        const perCodice = new Map();
        const fuori = new Map();
        stato.righe
            .filter(r => r.class_code === compito.class_code && r.page_path === compito.page_path)
            .forEach(r => {
                const canonico = daElenco ? alias.get(r.student_code) : r.student_code;
                if (canonico) {
                    perCodice.set(canonico, migliore(perCodice.get(canonico), r));
                } else {
                    fuori.set(r.student_code, migliore(fuori.get(r.student_code), r));
                }
            });
        const righe = alunni.map(a => ({ codice: a.codice, riga: perCodice.get(a.codice) || null, fuoriElenco: false }));
        fuori.forEach((riga, codice) => righe.push({ codice, riga, fuoriElenco: true }));
        righe.sort((x, y) => x.codice.localeCompare(y.codice, 'it'));
        const conta = { fatto: 0, corso: 0, zero: 0 };
        let somma = 0;
        righe.forEach(r => { const s = statoLavoro(r.riga); conta[s.chiave] += 1; somma += s.pct; });
        return { daElenco, righe, conta, media: righe.length ? Math.round(somma / righe.length) : 0 };
    }

    function pila(conta) {
        const tot = conta.fatto + conta.corso + conta.zero;
        if (!tot) return '<div class="ad-pila"></div><div class="ad-pila-legenda">Nessun alunno</div>';
        const pezzo = (k) => conta[k] ? `<span class="ad-c-${k}" style="width:${conta[k] * 100 / tot}%"></span>` : '';
        return `<div class="ad-pila" role="img" aria-label="${conta.fatto} completati, ${conta.corso} in corso, ${conta.zero} non iniziati">${pezzo('fatto')}${pezzo('corso')}${pezzo('zero')}</div>
            <div class="ad-pila-legenda">
                <span><i class="ad-pallino ad-c-fatto"></i>${conta.fatto} completati</span>
                <span><i class="ad-pallino ad-c-corso"></i>${conta.corso} in corso</span>
                <span><i class="ad-pallino ad-c-zero"></i>${conta.zero} da iniziare</span>
            </div>`;
    }

    function azioniAlunno(classe, codice, riga, pagePath) {
        if (!riga) return '<span class="ad-etichetta">nessun salvataggio</span>';
        return `<button class="ad-btn ad-btn-piccolo" type="button" data-risposte="${esc(riga.id)}">Risposte</button>` +
            `<button class="ad-btn ad-btn-piccolo ad-btn-quieto" type="button" data-come-alunno data-classe="${esc(riga.class_code)}" data-codice="${esc(riga.student_code)}" data-pagina="${esc(pagePath || riga.page_path)}">Apri come alunno</button>`;
    }

    // ───────────────────────── caricamento ─────────────────────────

    async function caricaCatalogo() {
        try {
            const res = await fetch('materiali.json', { cache: 'no-cache' });
            const dati = await res.json();
            Object.keys(SEZIONI).forEach(chiave => {
                (dati[chiave] || []).forEach(m => {
                    if (!m || !m.file || !/\.html?(\?|$)/i.test(m.file)) return;
                    const p = normPath(m.file);
                    if (!stato.catalogo.has(p)) stato.catalogo.set(p, { titolo: m.titolo || p, sezione: SEZIONI[chiave], tipo: m.tipo || '' });
                });
            });
            (dati.archivio || []).forEach(m => {
                if (!m || !m.file) return;
                const p = normPath(m.file);
                if (!stato.catalogo.has(p)) stato.catalogo.set(p, { titolo: m.titolo || p, sezione: 'Archivio', archiviato: true });
            });
        } catch (e) {
            console.warn('Catalogo dei materiali non disponibile:', e);
        }
    }

    async function caricaTutto() {
        const pulsante = $('#ad-aggiorna');
        if (pulsante) { pulsante.disabled = true; pulsante.textContent = 'Aggiornamento…'; }
        try {
            const [righe, classi, compiti] = await Promise.all([
                window.MODocente.chiama('progress_docente_riepilogo', { p_limite: 10000 }),
                window.MODocente.chiama('docente_classi_elenco', {}),
                window.MODocente.chiama('docente_compiti_elenco', {}),
                stato.catalogo.size ? null : caricaCatalogo()
            ]);
            stato.righe = (righe || []).map(r => {
                let meta = r.meta;
                if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = null; } }
                return {
                    id: r.id,
                    class_code: normCodice(r.class_code),
                    student_code: normCodice(r.student_code),
                    page_path: normPath(r.page_path),
                    updated_at: r.updated_at,
                    meta: meta && typeof meta === 'object' ? meta : {},
                    compilati: r.compilati || 0,
                    totali: r.totali || 0
                };
            }).filter(r => r.student_code && r.page_path);
            stato.totaliPagina = new Map();
            stato.righe.forEach(r => {
                stato.totaliPagina.set(r.page_path, Math.max(stato.totaliPagina.get(r.page_path) || 0, r.totali));
            });
            stato.classi = new Map((classi || []).map(c => [normCodice(c.class_code),
                (Array.isArray(c.studenti) ? c.studenti : []).map(s => ({ codice: normCodice(s.codice), alias: (s.alias || []).map(normCodice) }))]));
            stato.compiti = (compiti || []).map(c => ({ ...c, class_code: normCodice(c.class_code), page_path: normPath(c.page_path) }));
            stato.caricato = true;
            $('#ad-ora').textContent = new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            aggiornaContatori();
            disegna();
        } catch (errore) {
            gestisciErrore(errore, 'Non riesco a caricare i dati');
        } finally {
            if (pulsante) { pulsante.disabled = false; pulsante.textContent = 'Aggiorna'; }
        }
    }

    function gestisciErrore(errore, contesto) {
        if (errore && errore.code === '42501') {
            mostraAccesso('Sessione docente scaduta: inserisci di nuovo la password.');
            return;
        }
        console.error(contesto, errore);
        alert(`${contesto}: ${(errore && errore.message) || errore}. Riprova tra poco.`);
    }

    // Classi note: quelle con elenco, quelle con compiti, quelle con salvataggi quest'anno.
    function classiNote() {
        const dal = inizioAnnoScolastico().getTime();
        return ordinaClassi([
            ...stato.classi.keys(),
            ...stato.compiti.filter(c => !c.archiviato).map(c => c.class_code),
            ...stato.righe.filter(r => new Date(r.updated_at).getTime() >= dal).map(r => r.class_code)
        ]);
    }

    // ───────────────────────── schede ─────────────────────────

    function scegliVista(vista) {
        stato.vista = vista;
        try { localStorage.setItem(VISTA_KEY, vista); } catch { }
        $$('.ad-scheda').forEach(b => {
            const attiva = b.dataset.vista === vista;
            b.setAttribute('aria-selected', String(attiva));
            b.tabIndex = attiva ? 0 : -1;
        });
        $$('.ad-vista').forEach(v => { v.hidden = v.id !== `vista-${vista}`; });
        if (history.replaceState) history.replaceState(null, '', `#${vista}`);
        disegna();
    }

    function aggiornaContatori() {
        const attivi = stato.compiti.filter(c => !c.archiviato).length;
        const tab = $('#tab-compiti');
        if (tab) tab.innerHTML = `Compiti${attivi ? `<span class="ad-conta">${attivi}</span>` : ''}`;
    }

    function disegna() {
        if (!stato.caricato) return;
        if (stato.vista === 'compiti') disegnaCompiti();
        else if (stato.vista === 'classi') disegnaClassi();
        else if (stato.vista === 'recenti') disegnaRecenti();
        else if (stato.vista === 'verifiche') disegnaVerifiche();
    }

    // ───────────────────────── Compiti ─────────────────────────

    function disegnaCompiti() {
        const mostraArchiviati = $('#compiti-archiviati').checked;
        const classi = ordinaClassi(stato.compiti.filter(c => mostraArchiviati || !c.archiviato).map(c => c.class_code));
        if (stato.filtroCompiti && !classi.includes(stato.filtroCompiti)) stato.filtroCompiti = '';
        $('#compiti-filtro-classi').innerHTML = classi.length > 1
            ? [`<button class="ad-filtro" type="button" data-filtro-compiti="" aria-pressed="${!stato.filtroCompiti}">Tutte</button>`,
                ...classi.map(c => `<button class="ad-filtro" type="button" data-filtro-compiti="${esc(c)}" aria-pressed="${stato.filtroCompiti === c}">${esc(nomeClasse(c))}</button>`)].join('')
            : '';

        const lista = stato.compiti.filter(c => (mostraArchiviati || !c.archiviato) && (!stato.filtroCompiti || c.class_code === stato.filtroCompiti));
        const box = $('#compiti-elenco');
        if (!lista.length) {
            box.innerHTML = stato.compiti.length
                ? '<p class="ad-vuoto">Nessun compito con questi filtri.</p>'
                : `<div class="ad-vuoto"><p><strong>Non hai ancora assegnato compiti.</strong></p>
                    <p>Premi «+ Assegna compito», scegli classe e attività: qui vedrai a colpo d'occhio chi ha finito, chi è a metà e chi non ha cominciato.</p>
                    <p>Puoi anche partire dalla scheda «Attività recenti» e premere «Assegna come compito» su un'attività che la classe sta già facendo.</p></div>`;
            return;
        }
        const attivi = lista.filter(c => !c.archiviato);
        const archiviati = lista.filter(c => c.archiviato);
        let html = attivi.map(schedaCompito).join('');
        if (archiviati.length) html += `<h3 class="ad-gruppo-titolo">Archiviati</h3>` + archiviati.map(schedaCompito).join('');
        box.innerHTML = html;
    }

    function infoScadenza(c) {
        const parti = [`assegnato ${esc(dataGiorno(c.assegnato_il))}`];
        if (c.scadenza) {
            const g = giorniAllaScadenza(c.scadenza);
            let testo = `scadenza ${esc(dataGiorno(c.scadenza))}`;
            if (!c.archiviato) {
                if (g < 0) testo = `<span class="ad-scaduto">scaduto ${esc(dataGiorno(c.scadenza))}</span>`;
                else if (g === 0) testo = `<span class="ad-scade-presto">scade oggi</span>`;
                else if (g <= 2) testo = `<span class="ad-scade-presto">scade ${g === 1 ? 'domani' : `tra ${g} giorni`}</span>`;
            }
            parti.push(testo);
        }
        return parti.join(' · ');
    }

    function schedaCompito(c) {
        const av = avanzamentoCompito(c);
        const aperto = stato.compitiAperti.has(c.id);
        const sezione = sezionePagina(c.page_path);
        const avvisoElenco = av.daElenco ? '' :
            `<div class="ad-avviso">Per la ${esc(nomeClasse(c.class_code))} non c'è ancora l'elenco degli alunni: chi non ha mai aperto l'attività non compare.
             <button class="ad-link" type="button" data-vai-classe="${esc(c.class_code)}">Scrivi l'elenco della classe</button></div>`;
        const righe = av.righe.map(r => `
            <tr class="${r.riga ? '' : 'ad-riga-zero'}">
                <td class="ad-codice">${esc(r.codice)}${r.fuoriElenco ? '<span class="ad-etichetta" title="Codice che non è nell\'elenco della classe">fuori elenco</span>' : ''}</td>
                <td>${barraAvanzamento(r.riga)}</td>
                <td>${badgeStato(r.riga)}</td>
                <td>${r.riga ? `${esc(dataBreve(r.riga.updated_at))}<br><small class="muted">${esc(quandoFa(r.riga.updated_at))}</small>` : '—'}</td>
                <td class="ad-azioni-cella">${azioniAlunno(c.class_code, r.codice, r.riga, c.page_path)}</td>
            </tr>`).join('');
        return `<article class="ad-compito${aperto ? ' ad-aperto' : ''}${c.archiviato ? ' ad-archiviato' : ''}" data-compito="${esc(c.id)}">
            <div class="ad-compito-testa" data-apri-compito="${esc(c.id)}" role="button" tabindex="0" aria-expanded="${aperto}">
                <span class="ad-classe">${esc(nomeClasse(c.class_code))}</span>
                <div>
                    <div class="ad-compito-nome">${esc(c.titolo)}</div>
                    <div class="ad-compito-info">${sezione ? esc(sezione) + ' · ' : ''}${infoScadenza(c)}</div>
                </div>
                <div class="ad-compito-barra">${pila(av.conta)}</div>
                <span class="ad-apri" aria-hidden="true">›</span>
            </div>
            <div class="ad-compito-corpo">
                ${c.note ? `<div class="ad-nota">${esc(c.note)}</div>` : ''}
                ${avvisoElenco}
                ${av.righe.length ? `<div class="ad-tabella-box"><table class="ad-tabella">
                    <thead><tr><th>Alunno</th><th>Avanzamento</th><th>Stato</th><th>Ultimo salvataggio</th><th></th></tr></thead>
                    <tbody>${righe}</tbody></table></div>` : '<p class="ad-vuoto">Nessun alunno ha ancora salvato questa attività.</p>'}
                <p class="ad-compito-info" style="margin-top:.6rem">Media della classe: <strong>${av.media}%</strong> ·
                    <a href="${esc(linkPagina(c.page_path))}" target="_blank" rel="noopener">apri l'attività</a></p>
                <div class="ad-compito-azioni">
                    <button class="ad-btn ad-btn-piccolo" type="button" data-modifica-compito="${esc(c.id)}">Modifica</button>
                    <button class="ad-btn ad-btn-piccolo" type="button" data-archivia-compito="${esc(c.id)}" data-valore="${c.archiviato ? 'false' : 'true'}">${c.archiviato ? 'Riporta tra gli attivi' : 'Archivia (concluso)'}</button>
                    ${c.archiviato ? `<button class="ad-btn ad-btn-piccolo ad-btn-pericolo" type="button" data-elimina-compito="${esc(c.id)}">Elimina</button>` : ''}
                </div>
            </div>
        </article>`;
    }

    function opzioniAttivita(selezionata) {
        const gruppi = new Map();
        stato.catalogo.forEach((v, p) => {
            if (v.archiviato) return;
            if (!gruppi.has(v.sezione)) gruppi.set(v.sezione, []);
            gruppi.get(v.sezione).push([p, v.titolo]);
        });
        const conSalvataggi = ordinaClassi(stato.righe.map(r => r.page_path)).filter(p => !stato.catalogo.has(p) || stato.catalogo.get(p).archiviato);
        if (conSalvataggi.length) gruppi.set('Altre pagine con salvataggi', conSalvataggi.map(p => [p, titoloPagina(p)]));
        if (selezionata && !Array.from(gruppi.values()).some(l => l.some(([p]) => p === selezionata))) {
            gruppi.set('Pagina scelta', [[selezionata, titoloPagina(selezionata)]]);
        }
        let html = '<option value="">Scegli l\'attività…</option>';
        gruppi.forEach((voci, sezione) => {
            html += `<optgroup label="${esc(sezione)}">` + voci.map(([p, t]) =>
                `<option value="${esc(p)}"${p === selezionata ? ' selected' : ''}>${esc(t)}</option>`).join('') + '</optgroup>';
        });
        return html;
    }

    function apriModulo(compito, preset) {
        const box = $('#compiti-modulo');
        const c = compito || { class_code: (preset && preset.classe) || stato.filtroCompiti || '', page_path: (preset && preset.pagina) || '', titolo: '', assegnato_il: oggiISO(), scadenza: '', note: '' };
        const classi = classiNote();
        const spunte = compito
            ? `<label><input type="radio" name="classe" value="${esc(c.class_code)}" checked> ${esc(nomeClasse(c.class_code))}</label>`
            : classi.map(k => `<label><input type="checkbox" name="classe" value="${esc(k)}"${k === c.class_code ? ' checked' : ''}> ${esc(nomeClasse(k))}</label>`).join('') +
              `<label>altra: <input type="text" name="classe-nuova" placeholder="es. 1sa" maxlength="12" aria-label="Altra classe"></label>`;
        box.innerHTML = `<form id="modulo-compito">
            <h3>${compito ? 'Modifica il compito' : 'Assegna un compito'}</h3>
            <div class="ad-modulo-griglia">
                <fieldset><legend>Classe${compito ? '' : ' (puoi sceglierne più di una)'}</legend><div class="ad-spunte">${spunte}</div></fieldset>
                <label class="ad-largo">Attività del sito
                    <select name="pagina" required>${opzioniAttivita(c.page_path)}</select>
                </label>
                <label class="ad-largo">Titolo che vedrai nell'elenco
                    <input type="text" name="titolo" maxlength="200" value="${esc(c.titolo)}" placeholder="Si compila da solo con il nome dell'attività">
                </label>
                <label>Assegnato il <input type="date" name="assegnato" value="${esc(c.assegnato_il || oggiISO())}"></label>
                <label>Scadenza <input type="date" name="scadenza" value="${esc(c.scadenza || '')}"></label>
                <label class="ad-largo">Note per te (facoltative)
                    <textarea name="note" rows="2" maxlength="2000" placeholder="Es. solo le fasi 1 e 2; da finire a casa">${esc(c.note || '')}</textarea>
                </label>
            </div>
            <div class="ad-modulo-azioni">
                <button class="ad-btn ad-btn-primario" type="submit">${compito ? 'Salva le modifiche' : 'Assegna'}</button>
                <button class="ad-btn ad-btn-quieto" type="button" data-chiudi-modulo>Annulla</button>
            </div>
        </form>`;
        box.hidden = false;
        const form = $('#modulo-compito');
        form.dataset.id = compito ? compito.id : '';
        const selPagina = form.elements.pagina;
        const titolo = form.elements.titolo;
        let titoloToccato = Boolean(c.titolo);
        titolo.addEventListener('input', () => { titoloToccato = true; });
        selPagina.addEventListener('change', () => { if (!titoloToccato) titolo.value = selPagina.value ? titoloPagina(selPagina.value) : ''; });
        if (!c.titolo && c.page_path) titolo.value = titoloPagina(c.page_path);
        form.addEventListener('submit', salvaCompito);
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function salvaCompito(evento) {
        evento.preventDefault();
        const form = evento.currentTarget;
        const id = form.dataset.id || null;
        const classi = $$('input[name="classe"]:checked', form).map(i => i.value);
        const nuova = normCodice(form.elements['classe-nuova'] && form.elements['classe-nuova'].value);
        if (nuova) {
            if (!/^[a-z0-9]{1,12}$/.test(nuova)) { alert('Il codice della classe usa solo lettere e numeri, per esempio 1sa.'); return; }
            classi.push(nuova);
        }
        const pagina = form.elements.pagina.value;
        const titolo = form.elements.titolo.value.trim() || titoloPagina(pagina);
        const scadenza = form.elements.scadenza.value || null;
        const assegnato = form.elements.assegnato.value || null;
        if (!classi.length) { alert('Scegli almeno una classe.'); return; }
        if (!pagina) { alert('Scegli l\'attività da assegnare.'); return; }
        if (scadenza && assegnato && scadenza < assegnato) { alert('La scadenza è prima della data di assegnazione.'); return; }
        const bottone = form.querySelector('button[type="submit"]');
        bottone.disabled = true;
        try {
            for (const classe of ordinaClassi(classi)) {
                await window.MODocente.chiama('docente_compito_salva', {
                    p_id: id, p_class_code: classe, p_page_path: pagina, p_titolo: titolo,
                    p_assegnato_il: assegnato, p_scadenza: scadenza, p_note: form.elements.note.value
                });
            }
            chiudiModulo();
            await caricaTutto();
        } catch (errore) {
            bottone.disabled = false;
            gestisciErrore(errore, 'Il compito non è stato salvato');
        }
    }

    function chiudiModulo() {
        const box = $('#compiti-modulo');
        box.hidden = true;
        box.innerHTML = '';
    }

    async function archiviaCompito(id, valore) {
        try {
            await window.MODocente.chiama('docente_compito_archivia', { p_id: id, p_archiviato: valore });
            await caricaTutto();
        } catch (errore) { gestisciErrore(errore, 'Operazione non riuscita'); }
    }

    async function eliminaCompito(id) {
        const c = stato.compiti.find(x => x.id === id);
        if (!c || !confirm(`Eliminare il compito «${c.titolo}» della ${nomeClasse(c.class_code)}?\n\nLe risposte degli alunni restano salvate: si toglie solo l'assegnazione.`)) return;
        try {
            await window.MODocente.chiama('docente_compito_elimina', { p_id: id });
            await caricaTutto();
        } catch (errore) { gestisciErrore(errore, 'Eliminazione non riuscita'); }
    }

    // ───────────────────────── Classi ─────────────────────────

    function disegnaClassi() {
        const classi = classiNote();
        if (!stato.classeScelta || !classi.includes(stato.classeScelta)) {
            // si parte dalla classe che ha lavorato per ultima
            const recente = stato.righe.find(r => classi.includes(r.class_code));
            stato.classeScelta = recente ? recente.class_code : (classi[0] || '');
        }
        $('#classi-scelta').innerHTML = classi.map(c =>
            `<button class="ad-filtro" type="button" data-scegli-classe="${esc(c)}" aria-pressed="${stato.classeScelta === c}">${esc(nomeClasse(c))}</button>`).join('') +
            `<button class="ad-filtro" type="button" data-nuova-classe>+ Nuova classe</button>`;
        const box = $('#classi-contenuto');
        if (!stato.classeScelta) { box.innerHTML = '<p class="ad-vuoto">Nessuna classe con salvataggi quest\'anno.</p>'; return; }

        const classe = stato.classeScelta;
        const { daElenco, alunni } = alunniDellaClasse(classe);
        const alias = mappaAlias(classe);
        const compiti = stato.compiti.filter(c => c.class_code === classe && !c.archiviato);
        const avanz = compiti.map(c => ({ compito: c, av: avanzamentoCompito(c) }));
        const dal7 = Date.now() - 7 * GIORNO;
        const righeClasse = stato.righe.filter(r => r.class_code === classe);
        const ultimo = new Map();
        const recenti = new Map();
        righeClasse.forEach(r => {
            const codice = daElenco ? (alias.get(r.student_code) || null) : r.student_code;
            if (!codice) return;
            if (!ultimo.has(codice) || new Date(r.updated_at) > new Date(ultimo.get(codice))) ultimo.set(codice, r.updated_at);
            if (new Date(r.updated_at).getTime() >= dal7) {
                if (!recenti.has(codice)) recenti.set(codice, new Set());
                recenti.get(codice).add(r.page_path);
            }
        });
        const attiviSettimana = alunni.filter(a => recenti.has(a.codice)).length;
        const daRecuperare = alunni.filter(a => avanz.some(x => {
            const r = x.av.righe.find(y => y.codice === a.codice);
            return !r || statoLavoro(r.riga).chiave === 'zero';
        })).length;

        const intest = avanz.map(({ compito: c }) => `<th class="ad-col-compito" title="${esc(c.titolo)}">${esc(c.titolo.length > 42 ? c.titolo.slice(0, 40) + '…' : c.titolo)}${c.scadenza ? `<small>entro ${esc(dataGiorno(c.scadenza))}</small>` : ''}</th>`).join('');
        const corpo = alunni.map(a => {
            const celle = avanz.map(({ compito: c, av }) => {
                const r = av.righe.find(y => y.codice === a.codice);
                const s = statoLavoro(r && r.riga);
                const titolo = `${c.titolo}: ${s.etichetta}${r && r.riga ? `, ultimo salvataggio ${dataBreve(r.riga.updated_at)}` : ''}`;
                return `<td class="ad-cella"><button class="ad-cella-btn ad-stato-${s.chiave}" type="button" title="${esc(titolo)}" ${r && r.riga ? `data-risposte="${esc(r.riga.id)}"` : 'disabled'}>${r && r.riga ? s.pct + '%' : '—'}</button></td>`;
            }).join('');
            const ult = ultimo.get(a.codice);
            const g = giorniFa(ult);
            const nRecenti = recenti.has(a.codice) ? recenti.get(a.codice).size : 0;
            return `<tr>
                <td class="ad-codice">${esc(a.codice)}${(a.alias || []).length ? `<span class="ad-etichetta" title="Anche: ${esc(a.alias.join(', '))}">+${a.alias.length}</span>` : ''}</td>
                ${celle}
                <td>${ult ? `${esc(quandoFa(ult))}${g >= 7 ? ' <span class="ad-stato ad-stato-zero">assente</span>' : ''}` : '<span class="ad-stato ad-stato-zero">mai</span>'}</td>
                <td>${nRecenti || '—'}</td>
            </tr>`;
        }).join('');

        box.innerHTML = `
            ${daElenco ? '' : `<div class="ad-avviso">Per la ${esc(nomeClasse(classe))} manca l'elenco degli alunni: qui sotto vedi solo chi ha salvato almeno una volta quest'anno, e i codici scritti male contano come alunni diversi. Sistemalo in fondo, in «Elenco degli alunni».</div>`}
            <div class="ad-riepilogo-classe">
                <div class="ad-numero"><strong>${alunni.length}</strong><span>alunni${daElenco ? ' in elenco' : ' visti quest\'anno'}</span></div>
                <div class="ad-numero"><strong>${attiviSettimana}</strong><span>hanno lavorato negli ultimi 7 giorni</span></div>
                <div class="ad-numero"><strong>${compiti.length}</strong><span>compiti attivi</span></div>
                <div class="ad-numero"><strong>${compiti.length ? daRecuperare : '—'}</strong><span>con almeno un compito da iniziare</span></div>
            </div>
            ${alunni.length ? `<div class="ad-tabella-box"><table class="ad-tabella ad-matrice">
                <thead><tr><th>Alunno</th>${intest}<th>Ultima attività</th><th>Attività in 7 gg</th></tr></thead>
                <tbody>${corpo}</tbody></table></div>` : '<p class="ad-vuoto">Nessun alunno.</p>'}
            ${compiti.length ? '' : `<p class="ad-compito-info" style="margin-top:.6rem">Nessun compito attivo per questa classe. <button class="ad-link" type="button" data-assegna-classe="${esc(classe)}">Assegnane uno</button></p>`}
            ${pannelloElenco(classe, daElenco, alias)}`;
    }

    function pannelloElenco(classe, daElenco, alias) {
        const elenco = stato.classi.get(classe) || [];
        const testo = elenco.map(a => a.alias && a.alias.length ? `${a.codice} = ${a.alias.join(', ')}` : a.codice).join('\n');
        const dal = inizioAnnoScolastico().getTime();
        const sconosciuti = daElenco ? ordinaClassi(stato.righe
            .filter(r => r.class_code === classe && new Date(r.updated_at).getTime() >= dal && !alias.has(r.student_code))
            .map(r => r.student_code)) : [];
        const opzioni = elenco.map(a => `<option value="${esc(a.codice)}">${esc(a.codice)}</option>`).join('');
        const lista = sconosciuti.map(cod => {
            const ultimo = stato.righe.filter(r => r.class_code === classe && r.student_code === cod).map(r => r.updated_at).sort().pop();
            return `<li><strong>${esc(cod)}</strong> <small class="muted">ultimo salvataggio ${esc(quandoFa(ultimo))}</small>
                <span>è lo stesso alunno di</span>
                <select data-alias-di="${esc(cod)}"><option value="">scegli…</option>${opzioni}</select>
                <button class="ad-btn ad-btn-piccolo" type="button" data-collega-alias="${esc(cod)}">Collega</button>
                <button class="ad-btn ad-btn-piccolo ad-btn-quieto" type="button" data-aggiungi-alunno="${esc(cod)}">È un alunno nuovo</button></li>`;
        }).join('');
        return `<details class="ad-elenco-alunni"${daElenco && !sconosciuti.length ? '' : ' open'}>
            <summary>Elenco degli alunni della ${esc(nomeClasse(classe))}${daElenco ? ` · ${elenco.length}` : ' · da scrivere'}${sconosciuti.length ? ` · ${sconosciuti.length} ${sconosciuti.length === 1 ? 'codice' : 'codici'} da sistemare` : ''}</summary>
            <div class="ad-elenco-corpo">
                <p>Un codice per riga, come lo scrivono gli alunni (cognome e iniziale del nome, senza spazi). Se un alunno ha usato anche un codice sbagliato, scrivilo dopo un uguale: <code>karimk = karim</code>. Così i suoi lavori si riuniscono e chi non ha mai aperto un compito compare in rosso.</p>
                <textarea id="elenco-testo" spellcheck="false" placeholder="rossim&#10;bianchia = bianchi">${esc(testo)}</textarea>
                <div class="ad-modulo-azioni">
                    <button class="ad-btn ad-btn-primario" type="button" data-salva-elenco="${esc(classe)}">Salva l'elenco</button>
                    <button class="ad-btn" type="button" data-proponi-elenco="${esc(classe)}">Proponi i codici usati quest'anno</button>
                </div>
                ${sconosciuti.length ? `<div class="ad-sconosciuti"><p><strong>Codici usati quest'anno che non sono in elenco.</strong> Spesso sono errori di battitura: collegali all'alunno giusto.</p><ul>${lista}</ul></div>` : ''}
            </div>
        </details>`;
    }

    function leggiElenco(testo) {
        const visti = new Set();
        const alunni = [];
        String(testo || '').split(/\r?\n/).forEach(rigo => {
            const [primo, resto] = rigo.split('=');
            const codice = normCodice(primo).replace(/\s+/g, '');
            if (!codice || visti.has(codice)) return;
            visti.add(codice);
            const alias = String(resto || '').split(/[,;\s]+/).map(normCodice).filter(x => x && x !== codice);
            alunni.push({ codice, alias });
        });
        return alunni;
    }

    async function salvaElenco(classe, alunni) {
        try {
            await window.MODocente.chiama('docente_classe_salva', { p_class_code: classe, p_studenti: alunni });
            await caricaTutto();
        } catch (errore) { gestisciErrore(errore, 'Elenco non salvato'); }
    }

    // ───────────────────────── Attività recenti ─────────────────────────

    function disegnaRecenti() {
        const periodo = $('#recenti-periodo').value;
        const selClasse = $('#recenti-classe');
        const classeFiltro = selClasse.value;
        const cerca = normCodice($('#recenti-cerca').value);
        const classi = ordinaClassi(stato.righe.map(r => r.class_code));
        selClasse.innerHTML = '<option value="">Tutte</option>' + classi.map(c => `<option value="${esc(c)}"${c === classeFiltro ? ' selected' : ''}>${esc(nomeClasse(c))}</option>`).join('');

        let dal = 0;
        if (periodo === '7') dal = Date.now() - 7 * GIORNO;
        else if (periodo === '30') dal = Date.now() - 30 * GIORNO;
        else if (periodo === 'anno') dal = inizioAnnoScolastico().getTime();
        const righe = stato.righe.filter(r => new Date(r.updated_at).getTime() >= dal
            && (!classeFiltro || r.class_code === classeFiltro)
            && (!cerca || r.student_code.includes(cerca)));
        const box = $('#recenti-elenco');
        if (!righe.length) { box.innerHTML = '<p class="ad-vuoto">Nessun salvataggio nel periodo scelto.</p>'; return; }

        const gruppi = new Map();
        righe.forEach(r => {
            if (!gruppi.has(r.page_path)) gruppi.set(r.page_path, []);
            gruppi.get(r.page_path).push(r);
        });
        const ordinati = Array.from(gruppi.entries())
            .map(([p, lista]) => ({ p, lista, ultimo: lista.reduce((m, r) => r.updated_at > m ? r.updated_at : m, '') }))
            .sort((a, b) => b.ultimo.localeCompare(a.ultimo));
        box.innerHTML = ordinati.map((g, i) => {
            const classiG = ordinaClassi(g.lista.map(r => r.class_code));
            const media = Math.round(g.lista.reduce((s, r) => s + statoLavoro(r).pct, 0) / g.lista.length);
            const lista = g.lista.slice().sort((a, b) => a.class_code.localeCompare(b.class_code, 'it', { numeric: true }) || a.student_code.localeCompare(b.student_code, 'it'));
            const assegnato = classiG.filter(c => stato.compiti.some(x => !x.archiviato && x.class_code === c && x.page_path === g.p));
            return `<details class="ad-attivita"${i === 0 ? ' open' : ''}>
                <summary>
                    <div>
                        <div class="ad-compito-nome">${esc(titoloPagina(g.p))}</div>
                        <div class="ad-compito-info">${classiG.map(c => `<span class="ad-classe" style="font-size:.72rem;padding:.1rem .4rem">${esc(nomeClasse(c))}</span>`).join(' ')}
                            · ${g.lista.length} ${g.lista.length === 1 ? 'alunno' : 'alunni'} · media ${media}% · ultimo salvataggio ${esc(quandoFa(g.ultimo))}
                            ${assegnato.length ? ` · <strong>compito per ${esc(assegnato.map(nomeClasse).join(', '))}</strong>` : ''}</div>
                    </div>
                    <button class="ad-btn ad-btn-piccolo" type="button" data-assegna-pagina="${esc(g.p)}" data-assegna-classe="${esc(classiG.length === 1 ? classiG[0] : '')}">Assegna come compito</button>
                </summary>
                <div class="ad-attivita-corpo"><div class="ad-tabella-box"><table class="ad-tabella">
                    <thead><tr><th>Classe</th><th>Alunno</th><th>Avanzamento</th><th>Ultimo salvataggio</th><th></th></tr></thead>
                    <tbody>${lista.map(r => `<tr>
                        <td>${esc(nomeClasse(r.class_code))}</td>
                        <td class="ad-codice">${esc(r.student_code)}</td>
                        <td>${barraAvanzamento(r)}</td>
                        <td>${esc(dataBreve(r.updated_at))}</td>
                        <td class="ad-azioni-cella">${azioniAlunno(r.class_code, r.student_code, r, g.p)}</td></tr>`).join('')}</tbody>
                </table></div></div>
            </details>`;
        }).join('');
    }

    // ───────────────────────── Verifiche e Stroop ─────────────────────────

    async function disegnaVerifiche() {
        const box = $('#stroop-contenuto');
        if (!stato.stroop) {
            box.innerHTML = '<p class="ad-vuoto">Caricamento…</p>';
            try {
                stato.stroop = (await window.MODocente.chiama('stroop_docente_test', { p_limite: 500 })) || [];
            } catch (errore) {
                if (errore && errore.code === '42501') { gestisciErrore(errore); return; }
                box.innerHTML = '<p class="ad-vuoto">I risultati del test di Stroop non sono disponibili in questo momento.</p>';
                return;
            }
        }
        const dati = stato.stroop.map(t => ({
            id: t.id, classe: nomeClasse(t.class_code) || 'N/D', codice: t.student_code || (t.participant && t.participant.name) || '',
            punteggio: Number((t.results || {}).finalScore || 0), accuratezza: Number((t.results || {}).accuracy || 0),
            tempo: (t.results || {}).totalTime, data: t.created_at
        }));
        if (!dati.length) { box.innerHTML = '<p class="ad-vuoto">Nessun test di Stroop registrato.</p>'; return; }
        const perClasse = new Map();
        dati.forEach(d => {
            const v = perClasse.get(d.classe) || { n: 0, p: 0, a: 0, ultimo: '' };
            v.n += 1; v.p += d.punteggio; v.a += d.accuratezza; if (d.data > v.ultimo) v.ultimo = d.data;
            perClasse.set(d.classe, v);
        });
        box.innerHTML = `<div class="ad-tabella-box"><table class="ad-tabella">
                <thead><tr><th>Classe</th><th>Test</th><th>Punteggio medio</th><th>Accuratezza media</th><th>Ultimo</th></tr></thead>
                <tbody>${Array.from(perClasse.entries()).sort().map(([c, v]) => `<tr><td class="ad-codice">${esc(c)}</td><td>${v.n}</td><td>${(v.p / v.n).toFixed(1)}</td><td>${(v.a / v.n).toFixed(1)}%</td><td>${esc(dataBreve(v.ultimo))}</td></tr>`).join('')}</tbody>
            </table></div>
            <details class="ad-attivita" style="margin-top:1rem"><summary><div class="ad-compito-nome">Tutti i test (${dati.length})</div></summary>
            <div class="ad-attivita-corpo"><div class="ad-tabella-box"><table class="ad-tabella">
                <thead><tr><th>Classe</th><th>Alunno</th><th>Punteggio</th><th>Accuratezza</th><th>Data</th><th></th></tr></thead>
                <tbody>${dati.sort((a, b) => String(b.data).localeCompare(String(a.data))).map(d => `<tr><td>${esc(d.classe)}</td><td class="ad-codice">${esc(d.codice)}</td><td>${d.punteggio}</td><td>${d.accuratezza.toFixed(1)}%</td><td>${esc(dataBreve(d.data))}</td>
                    <td><a class="ad-btn ad-btn-piccolo" href="materiali/compresenza/test-stroop.html?docente=1&doc_class=${encodeURIComponent(d.classe.toLowerCase())}&doc_student=${encodeURIComponent(String(d.codice).toLowerCase())}" target="_blank" rel="noopener">Apri</a></td></tr>`).join('')}</tbody>
            </table></div></div></details>`;
    }

    // ───────────────────────── Risposte di un alunno ─────────────────────────

    function apriFinestra(html) {
        $('#ad-finestra-corpo').innerHTML = html;
        const f = $('#ad-finestra');
        f.classList.add('open');
        f.setAttribute('aria-hidden', 'false');
        const chiudi = f.querySelector('[data-chiudi-finestra]');
        if (chiudi) chiudi.focus();
    }

    function chiudiFinestra() {
        const f = $('#ad-finestra');
        f.classList.remove('open');
        f.setAttribute('aria-hidden', 'true');
    }

    function etichettaCampo(percorso) {
        return percorso.map(p => typeof p === 'number' ? `n. ${p + 1}` : String(p).replace(/[-_]+/g, ' ')).join(' › ');
    }

    function foglie(valore, percorso, out) {
        if (valore === null || valore === undefined) { out.push([percorso, '']); return; }
        if (Array.isArray(valore)) {
            if (!valore.length) out.push([percorso, '']);
            else if (valore.every(v => v === null || typeof v !== 'object')) out.push([percorso, valore.filter(v => v !== null && v !== '').join(', ')]);
            else valore.forEach((v, i) => foglie(v, percorso.concat(i), out));
            return;
        }
        if (typeof valore === 'object') {
            Object.keys(valore).forEach(k => foglie(valore[k], percorso.concat(k), out));
            return;
        }
        if (typeof valore === 'boolean') { out.push([percorso, valore ? 'sì' : '']); return; }
        out.push([percorso, String(valore)]);
    }

    async function mostraRisposte(id) {
        const riga = stato.righe.find(r => r.id === id);
        if (!riga) return;
        apriFinestra('<p style="padding:1rem">Caricamento delle risposte…</p>');
        let dati;
        try {
            dati = await window.MODocente.chiama('progress_docente_dettaglio', { p_id: id });
            if (typeof dati === 'string') { try { dati = JSON.parse(dati); } catch { dati = { testo: dati }; } }
        } catch (errore) {
            chiudiFinestra();
            gestisciErrore(errore, 'Risposte non disponibili');
            return;
        }
        dati = dati && typeof dati === 'object' ? dati : {};
        const pulito = {};
        Object.keys(dati).filter(k => !k.startsWith('_')).forEach(k => { pulito[k] = dati[k]; });
        const elenco = [];
        foglie(pulito, [], elenco);
        const compilate = elenco.filter(([, v]) => String(v).trim());
        const vuote = elenco.length - compilate.length;
        const corpo = dati._activity === 'ripasso-terzo-anno'
            ? formatRipassoTerzo(dati)
            : (compilate.length
                ? `<dl>${compilate.map(([p, v]) => `<dt>${esc(etichettaCampo(p))}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
                   ${vuote ? `<p class="ad-compito-info" style="margin-top:.6rem">${vuote === 1 ? '1 campo ancora vuoto' : `${vuote} campi ancora vuoti`}.</p>` : ''}`
                : '<p class="ad-vuoto">Nessuna risposta compilata.</p>');
        apriFinestra(`<div class="ad-risposte">
            <h2 id="ad-finestra-titolo" style="margin:0 2rem 0 0;font-size:1.3rem;color:var(--color-primary)">${esc(riga.student_code)} · ${esc(titoloPagina(riga.page_path))}</h2>
            <div class="ad-risposte-testa">
                <span>Classe <strong>${esc(nomeClasse(riga.class_code))}</strong></span>
                <span>Ultimo salvataggio <strong>${esc(dataBreve(riga.updated_at))}</strong></span>
                <span>${badgeStato(riga)}</span>
            </div>
            <p><button class="ad-btn ad-btn-piccolo" type="button" data-come-alunno data-classe="${esc(riga.class_code)}" data-codice="${esc(riga.student_code)}" data-pagina="${esc(riga.page_path)}">Apri la pagina come la vede l'alunno</button></p>
            ${corpo}
            <details style="margin-top:1rem"><summary class="muted" style="cursor:pointer">Dati tecnici salvati</summary>
                <pre class="progress-json" style="white-space:pre-wrap;font-size:.8rem;max-height:20rem;overflow:auto">${esc(JSON.stringify(dati, null, 2))}</pre></details>
        </div>`);
    }

    // Il ripasso del terzo anno salva risposte strutturate: si mostrano per argomento.
    function formatRipassoTerzo(data) {
        const missionLabels = [
            'Persona, bisogni e relazione d’aiuto',
            'Progetto individualizzato',
            'Reti, équipe e documentazione',
            'Autobiografia, memoria e narrazione',
            'Seconda infanzia, gioco e peer tutoring',
            'Dipendenze, SerD e colloquio motivazionale',
            'Intelligenza artificiale: funzionamento e verifica',
            'Analisi di un caso'
        ];
        const meta = data._meta || {};
        const progress = Number(meta.percentuale || 0);
        const completed = Number(meta.missioniComplete ?? meta.campiCompilati ?? 0);
        const total = Number(meta.missioniTotali ?? meta.totale ?? 0);
        const correct = Number(meta.risposteCorrette || 0);
        const answered = Number(meta.risposte || 0);
        const accuracy = Number(meta.accuratezza || 0);
        const openQuestionLabels = data.openQuestionLabels && typeof data.openQuestionLabels === 'object'
            ? data.openQuestionLabels
            : {};
        const openAnswers = Object.entries(data.openAnswers || {})
            .sort(([a], [b]) => Number(a) - Number(b))
            .flatMap(([missionId, values]) => (Array.isArray(values) ? values : []).map((value, questionIndex) => ({
                missionId,
                questionIndex,
                value: String(value || '').trim()
            })))
            .filter(item => item.value)
            .map(item => `
                <article style="padding:0.75rem 0;border-top:1px solid #e2e8f0;">
                    <strong>${esc(missionLabels[Number(item.missionId)] || `Argomento ${Number(item.missionId) + 1}`)}</strong>
                    <p style="margin:0.25rem 0;color:#475569;"><em>${esc(openQuestionLabels[item.missionId]?.[item.questionIndex] || `Domanda ${item.questionIndex + 1}`)}</em></p>
                    <p style="margin:0.35rem 0 0;white-space:pre-wrap;">${esc(item.value)}</p>
                </article>`).join('');
        const legacyNotes = Object.entries(data.notes || {})
            .filter(([, value]) => String(value || '').trim())
            .map(([missionId, value]) => `
                <article style="padding:0.75rem 0;border-top:1px solid #e2e8f0;">
                    <strong>${esc(missionLabels[Number(missionId)] || `Argomento ${Number(missionId) + 1}`)}</strong>
                    <p style="margin:0.35rem 0 0;white-space:pre-wrap;">${esc(value)}</p>
                </article>`).join('');
        const caseData = data.case && typeof data.case === 'object' ? data.case : {};
        const needs = Array.isArray(caseData.needs) ? caseData.needs : [];
        const roles = Array.isArray(caseData.roles) ? caseData.roles : [];
        const caseHtml = caseData.facts || caseData.needsResources || caseData.objective || needs.length || roles.length
            ? `<section style="margin-top:1rem;">
                <h4>Analisi del caso</h4>
                <p><strong>Dati individuati:</strong> ${esc(caseData.facts || '—')}</p>
                <p><strong>Dimensioni considerate:</strong> ${needs.length ? needs.map(escapeHtml).join(', ') : '—'}</p>
                <p><strong>Bisogni, risorse e ipotesi:</strong> ${esc(caseData.needsResources || '—')}</p>
                <p><strong>Informazioni mancanti:</strong> ${esc(caseData.missing || caseData.action || '—')}</p>
                <p><strong>Rete:</strong> ${roles.length ? roles.map(escapeHtml).join(', ') : '—'}</p>
                <p><strong>Motivazione della rete:</strong> ${esc(caseData.network || '—')}</p>
                <p><strong>Obiettivo e primo intervento:</strong> ${esc(caseData.objective || '—')}</p>
                <p><strong>Verifica:</strong> ${esc(caseData.evaluation || '—')}</p>
            </section>`
            : '';

        return `<div class="assessment-detail-grid" style="margin-bottom:1rem;">
                <div class="assessment-detail-item"><span>Avanzamento</span><strong>${progress}%</strong><p>${completed}/${total} argomenti</p></div>
                <div class="assessment-detail-item"><span>Accuratezza</span><strong>${accuracy}%</strong><p>${correct}/${answered} risposte corrette</p></div>
                <div class="assessment-detail-item"><span>Percorso</span><strong>${esc(meta.percorso || data.route || '—')}</strong></div>
                <div class="assessment-detail-item"><span>Ultimo argomento</span><strong>${esc(String(meta.missioneCorrente || (Number(data.current) + 1) || '—'))}</strong></div>
            </div>
            <h4>Risposte aperte</h4>
            ${openAnswers || legacyNotes || '<p class="muted">Nessuna risposta aperta salvata.</p>'}
            ${caseHtml}`;
    }

    // ───────────────────────── apri come alunno ─────────────────────────

    function linkPagina(path, extra) {
        const base = window.location.pathname.replace(/\/[^/]*$/, '');
        let href = base + (path.startsWith('/') ? path : '/' + path);
        if (extra) href += (href.includes('?') ? '&' : '?') + new URLSearchParams(extra).toString();
        return href;
    }

    function apriComeAlunno(classe, codice, pagina) {
        if (!classe || !codice || !pagina) return;
        try {
            const store = JSON.parse(localStorage.getItem(SUPER_STORAGE_KEY) || '{}') || {};
            const ora = Date.now();
            Object.keys(store).forEach(k => { if (store[k] && store[k].expires < ora) delete store[k]; });
            store[pagina] = { classCode: classe, studentCode: codice, expires: ora + SUPER_SESSION_DURATION };
            localStorage.setItem(SUPER_STORAGE_KEY, JSON.stringify(store));
        } catch { /* la pagina legge comunque i parametri */ }
        window.open(linkPagina(pagina, { docente: '1', doc_class: classe, doc_student: codice }), '_blank', 'noopener');
    }

    // ───────────────────────── accesso ed eventi ─────────────────────────

    function mostraDashboard() {
        $('#docente-auth-overlay').classList.add('hidden');
        $('#docente-dashboard-content').classList.remove('hidden');
        caricaTutto();
    }

    function mostraAccesso(messaggio) {
        $('#docente-dashboard-content').classList.add('hidden');
        $('#docente-auth-overlay').classList.remove('hidden');
        if (messaggio) alert(messaggio);
        const pw = $('#docente-password');
        if (pw) pw.focus();
    }

    async function cambiaPassword() {
        const attuale = prompt('Password attuale:');
        if (attuale === null) return;
        const nuova = prompt('Nuova password (almeno 10 caratteri; maiuscole e minuscole contano):');
        if (nuova === null) return;
        const conferma = prompt('Ripeti la nuova password:');
        if (conferma === null) return;
        if (nuova !== conferma) { alert('Le due password nuove non coincidono.'); return; }
        try {
            await window.MODocente.cambiaPassword(attuale, nuova);
            alert('Password cambiata. Da ora vale la nuova, anche per la modalità LIM e per le statistiche Stroop.');
        } catch (errore) { alert(window.MODocente.messaggioErrore(errore)); }
    }

    function collega() {
        $('#docente-login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pw = $('#docente-password');
            try {
                await window.MODocente.accedi(pw.value);
                pw.value = '';
                mostraDashboard();
            } catch (errore) {
                alert(window.MODocente.messaggioErrore(errore));
                pw.focus();
            }
        });
        $('#ad-aggiorna').addEventListener('click', () => { stato.stroop = null; caricaTutto(); });
        $('#ad-password').addEventListener('click', cambiaPassword);
        $('#ad-esci').addEventListener('click', () => { window.MODocente.esci(); mostraAccesso(); });
        $('#compiti-nuovo').addEventListener('click', () => apriModulo(null));
        $('#compiti-archiviati').addEventListener('change', disegnaCompiti);
        ['recenti-periodo', 'recenti-classe'].forEach(id => $('#' + id).addEventListener('change', disegnaRecenti));
        $('#recenti-cerca').addEventListener('input', disegnaRecenti);

        const schede = $$('.ad-scheda');
        schede.forEach((b, i) => {
            b.addEventListener('click', () => scegliVista(b.dataset.vista));
            b.addEventListener('keydown', (e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                const prossima = schede[(i + (e.key === 'ArrowRight' ? 1 : schede.length - 1)) % schede.length];
                prossima.focus();
                scegliVista(prossima.dataset.vista);
            });
        });

        document.addEventListener('click', (e) => {
            const t = e.target.closest('button, [data-apri-compito], a');
            if (!t) { if (e.target.id === 'ad-finestra') chiudiFinestra(); return; }
            const d = t.dataset;
            if (d.risposte) { e.preventDefault(); e.stopPropagation(); mostraRisposte(d.risposte); return; }
            if ('comeAlunno' in d) { e.preventDefault(); e.stopPropagation(); apriComeAlunno(d.classe, d.codice, d.pagina); return; }
            if ('chiudiFinestra' in d) { chiudiFinestra(); return; }
            if (d.apriCompito) {
                if (stato.compitiAperti.has(d.apriCompito)) stato.compitiAperti.delete(d.apriCompito); else stato.compitiAperti.add(d.apriCompito);
                const art = t.closest('.ad-compito');
                art.classList.toggle('ad-aperto');
                t.setAttribute('aria-expanded', String(art.classList.contains('ad-aperto')));
                return;
            }
            if (d.filtroCompiti !== undefined) { stato.filtroCompiti = d.filtroCompiti; disegnaCompiti(); return; }
            if (d.modificaCompito) { apriModulo(stato.compiti.find(c => c.id === d.modificaCompito)); return; }
            if (d.archiviaCompito) { archiviaCompito(d.archiviaCompito, d.valore === 'true'); return; }
            if (d.eliminaCompito) { eliminaCompito(d.eliminaCompito); return; }
            if ('chiudiModulo' in d) { chiudiModulo(); return; }
            if (d.assegnaPagina !== undefined || (d.assegnaClasse !== undefined && t.matches('[data-assegna-classe]'))) {
                e.preventDefault(); e.stopPropagation();
                scegliVista('compiti');
                apriModulo(null, { pagina: d.assegnaPagina || '', classe: d.assegnaClasse || '' });
                return;
            }
            if (d.vaiClasse) { stato.classeScelta = d.vaiClasse; scegliVista('classi'); return; }
            if (d.scegliClasse) { stato.classeScelta = d.scegliClasse; disegnaClassi(); return; }
            if ('nuovaClasse' in d) {
                const nome = normCodice(prompt('Codice della classe, come lo usano gli alunni (es. 1sa):') || '');
                if (!nome) return;
                if (!/^[a-z0-9]{1,12}$/.test(nome)) { alert('Solo lettere e numeri, per esempio 1sa.'); return; }
                stato.classeScelta = nome;
                if (!stato.classi.has(nome)) stato.classi.set(nome, []);
                disegnaClassi();
                return;
            }
            if (d.salvaElenco) {
                const alunni = leggiElenco($('#elenco-testo').value);
                if (!alunni.length && !confirm(`L'elenco è vuoto: cancellare l'elenco della ${nomeClasse(d.salvaElenco)}?`)) return;
                salvaElenco(d.salvaElenco, alunni);
                return;
            }
            if (d.proponiElenco) {
                const dal = inizioAnnoScolastico().getTime();
                const codici = ordinaClassi(stato.righe.filter(r => r.class_code === d.proponiElenco && new Date(r.updated_at).getTime() >= dal).map(r => r.student_code));
                const area = $('#elenco-testo');
                const presenti = new Set(leggiElenco(area.value).flatMap(a => [a.codice, ...a.alias]));
                const nuovi = codici.filter(c => !presenti.has(c));
                area.value = [area.value.trim(), ...nuovi].filter(Boolean).join('\n');
                area.focus();
                if (!nuovi.length) alert('Tutti i codici usati quest\'anno sono già nell\'elenco.');
                return;
            }
            if (d.collegaAlias) {
                const classe = stato.classeScelta;
                const sel = document.querySelector(`select[data-alias-di="${CSS.escape(d.collegaAlias)}"]`);
                if (!sel || !sel.value) { alert('Scegli prima l\'alunno a cui appartiene il codice.'); return; }
                const elenco = (stato.classi.get(classe) || []).map(a => ({ codice: a.codice, alias: a.alias.slice() }));
                const alunno = elenco.find(a => a.codice === sel.value);
                if (alunno && !alunno.alias.includes(d.collegaAlias)) alunno.alias.push(d.collegaAlias);
                salvaElenco(classe, elenco);
                return;
            }
            if (d.aggiungiAlunno) {
                const classe = stato.classeScelta;
                const elenco = (stato.classi.get(classe) || []).map(a => ({ codice: a.codice, alias: a.alias.slice() }));
                elenco.push({ codice: d.aggiungiAlunno, alias: [] });
                salvaElenco(classe, elenco);
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') chiudiFinestra();
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-apri-compito]')) {
                e.preventDefault();
                e.target.click();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        collega();
        let iniziale = (location.hash || '').replace('#', '');
        if (!['compiti', 'classi', 'recenti', 'verifiche'].includes(iniziale)) {
            try { iniziale = localStorage.getItem(VISTA_KEY) || 'compiti'; } catch { iniziale = 'compiti'; }
        }
        scegliVista(['compiti', 'classi', 'recenti', 'verifiche'].includes(iniziale) ? iniziale : 'compiti');
        if (window.MODocente && window.MODocente.attivo()) mostraDashboard();
    });
})();
