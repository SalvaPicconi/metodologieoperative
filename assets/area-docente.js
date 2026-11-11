/*
 * Area docente del sito Metodologie Operative.
 *
 * Un solo percorso: classe → alunni → attività.
 * - Le tue classi: un riquadro per classe con i numeri di sintesi;
 * - una classe: riepilogo, tabella degli alunni (attività aperte, completate, media) e tabella delle
 *   attività (le pagine del sito su cui la classe ha lavorato, con i risultati aggregati);
 *   in fondo l'elenco dei codici della classe, con i codici sbagliati ricondotti all'alunno giusto;
 * - un alunno: tutte le attività della classe, con «Correggi nella pagina» (la pagina aperta in
 *   modalità docente con le risposte dell'alunno) e «Leggi le risposte».
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
    const PERIODO_KEY = 'mo:area-docente-periodo';
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
        compiti: [],             // tabella dei compiti assegnati: per ora non mostrata
        catalogo: new Map(),     // percorso → { titolo, sezione }
        totaliPagina: new Map(), // percorso → numero massimo di campi visto
        periodo: 'anno',
        attivitaAperte: new Set(),
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
        return `<button class="ad-btn ad-btn-piccolo" type="button" data-come-alunno data-classe="${esc(riga.class_code)}" data-codice="${esc(riga.student_code)}" data-pagina="${esc(pagePath || riga.page_path)}">Correggi nella pagina</button>` +
            `<button class="ad-btn ad-btn-piccolo ad-btn-quieto" type="button" data-risposte="${esc(riga.id)}">Leggi le risposte</button>`;
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
            const [righe, classi] = await Promise.all([
                window.MODocente.chiama('progress_docente_riepilogo', { p_limite: 10000 }),
                window.MODocente.chiama('docente_classi_elenco', {}),
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
            stato.caricato = true;
            $('#ad-ora').textContent = new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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


    // ───────────────────────── percorso: classi → classe → alunno ─────────────────────────
    // L'indirizzo dice dove si è: «#» le classi, «#classe/5sa» una classe,
    // «#classe/5sa/alunno/rossim» un alunno. Così il tasto Indietro del browser funziona.

    function leggiPercorso() {
        const parti = (location.hash || '').replace(/^#\/?/, '').split('/').map(p => { try { return decodeURIComponent(p); } catch { return p; } });
        if (parti[0] === 'classe' && parti[1]) {
            return { classe: normCodice(parti[1]), alunno: parti[2] === 'alunno' && parti[3] ? normCodice(parti[3]) : '' };
        }
        return { classe: '', alunno: '' };
    }

    function vai(classe, alunno) {
        let h = '';
        if (classe) h = `#classe/${encodeURIComponent(classe)}`;
        if (classe && alunno) h += `/alunno/${encodeURIComponent(alunno)}`;
        if (location.hash === h || (!h && !location.hash)) disegna();
        else location.hash = h;
        window.scrollTo({ top: 0 });
    }

    function disegna() {
        if (!stato.caricato) return;
        const { classe, alunno } = leggiPercorso();
        const percorso = $('#ad-percorso');
        if (!classe) {
            percorso.innerHTML = '<span>Le tue classi</span>';
            disegnaHome();
        } else if (!alunno) {
            percorso.innerHTML = `<button class="ad-link" type="button" data-vai="">Le tue classi</button><span aria-hidden="true">›</span><span>${esc(nomeClasse(classe))}</span>`;
            disegnaClasse(classe);
        } else {
            percorso.innerHTML = `<button class="ad-link" type="button" data-vai="">Le tue classi</button><span aria-hidden="true">›</span>
                <button class="ad-link" type="button" data-vai="${esc(classe)}">${esc(nomeClasse(classe))}</button><span aria-hidden="true">›</span>
                <span>${esc(alunno)}</span>`;
            disegnaAlunno(classe, alunno);
        }
    }

    function inizioPeriodo() {
        if (stato.periodo === '7') return Date.now() - 7 * GIORNO;
        if (stato.periodo === '30') return Date.now() - 30 * GIORNO;
        return inizioAnnoScolastico().getTime();
    }

    const NOMI_PERIODO = { anno: "quest'anno scolastico", '30': 'ultimi 30 giorni', '7': 'ultimi 7 giorni' };

    // Tutto ciò che serve per una classe nel periodo scelto:
    // - alunni (dall'elenco, oppure i codici visti quest'anno) con i codici sbagliati ricondotti;
    // - attività (pagine) su cui almeno un alunno ha salvato nel periodo;
    // - per ogni alunno e attività il salvataggio migliore.
    function datiClasse(classe) {
        const { daElenco, alunni } = alunniDellaClasse(classe);
        const alias = mappaAlias(classe);
        const dal = inizioPeriodo();
        const lavori = new Map();       // codice → Map(pagina → riga)
        const fuori = new Set();        // codici fuori elenco
        const pagine = new Map();       // pagina → ultimo salvataggio
        alunni.forEach(a => lavori.set(a.codice, new Map()));
        stato.righe.forEach(r => {
            if (r.class_code !== classe || new Date(r.updated_at).getTime() < dal) return;
            const codice = daElenco ? alias.get(r.student_code) : r.student_code;
            if (!codice) { fuori.add(r.student_code); return; }
            if (!lavori.has(codice)) lavori.set(codice, new Map());
            const m = lavori.get(codice);
            m.set(r.page_path, migliore(m.get(r.page_path), r));
            if (!pagine.has(r.page_path) || r.updated_at > pagine.get(r.page_path)) pagine.set(r.page_path, r.updated_at);
        });
        const elencoAlunni = Array.from(lavori.keys()).sort((a, b) => a.localeCompare(b, 'it'));
        const attivita = Array.from(pagine.entries()).sort((a, b) => b[1].localeCompare(a[1])).map(([p, ultimo]) => {
            const conta = { fatto: 0, corso: 0, zero: 0 };
            let somma = 0;
            elencoAlunni.forEach(cod => { const s = statoLavoro(lavori.get(cod).get(p)); conta[s.chiave] += 1; somma += s.pct; });
            return { pagina: p, ultimo, conta, media: elencoAlunni.length ? Math.round(somma / elencoAlunni.length) : 0,
                     aperta: elencoAlunni.filter(cod => lavori.get(cod).has(p)).length };
        });
        const perAlunno = elencoAlunni.map(cod => {
            const m = lavori.get(cod);
            let somma = 0, fatte = 0, ultimo = '';
            attivita.forEach(a => {
                const r = m.get(a.pagina);
                const s = statoLavoro(r);
                somma += s.pct;
                if (s.chiave === 'fatto') fatte += 1;
                if (r && r.updated_at > ultimo) ultimo = r.updated_at;
            });
            return { codice: cod, aperte: m.size, fatte, media: attivita.length ? Math.round(somma / attivita.length) : 0, ultimo, lavori: m };
        });
        return { daElenco, alias, alunni: elencoAlunni, attivita, perAlunno, fuori: Array.from(fuori).sort() };
    }

    function percento(n) { return `<span class="ad-percento ad-percento-${n >= SOGLIA_COMPLETATO ? 'fatto' : n >= 40 ? 'corso' : 'zero'}">${n}%</span>`; }

    // ───────────────────────── 1. Le classi ─────────────────────────

    function disegnaHome() {
        const classi = classiNote();
        const salvaPeriodo = stato.periodo;
        stato.periodo = 'anno';
        const schede = classi.map(classe => {
            const d = datiClasse(classe);
            const media = d.perAlunno.length ? Math.round(d.perAlunno.reduce((s, a) => s + a.media, 0) / d.perAlunno.length) : 0;
            const ultimo = d.perAlunno.map(a => a.ultimo).filter(Boolean).sort().pop();
            const settimana = Date.now() - 7 * GIORNO;
            const attivi = d.perAlunno.filter(a => a.ultimo && new Date(a.ultimo).getTime() >= settimana).length;
            return `<button class="ad-classe-scheda" type="button" data-vai="${esc(classe)}">
                <span class="ad-classe-nome">${esc(nomeClasse(classe))}</span>
                <span class="ad-classe-numeri">
                    <span><strong>${d.alunni.length}</strong> alunni</span>
                    <span><strong>${d.attivita.length}</strong> attività</span>
                    <span><strong>${media}%</strong> media</span>
                </span>
                <span class="ad-classe-dati">${attivi} hanno lavorato negli ultimi 7 giorni · ultimo lavoro ${esc(quandoFa(ultimo))}</span>
                ${d.daElenco ? '' : '<span class="ad-classe-allarme">Elenco alunni da completare</span>'}
            </button>`;
        }).join('');
        stato.periodo = salvaPeriodo;
        $('#ad-vista').innerHTML = `
            ${classi.length ? `<div class="ad-classi-griglia">${schede}</div>` : '<p class="ad-vuoto">Nessuna classe con lavori salvati quest\'anno.</p>'}
            <p class="ad-piccolo"><button class="ad-link" type="button" data-nuova-classe>+ Aggiungi una classe</button> che non ha ancora usato il sito.</p>
            <h3 class="ad-sezione-titolo">Altri strumenti</h3>
            <div class="ad-strumenti">
                <a class="ad-strumento" href="materiali/biennio/verifica-operatore-terza.html?docente=1"><strong>Correggi la verifica di terza</strong><span>L’operatore sociale: elaborati, correzione e restituzione.</span></a>
                <a class="ad-strumento" href="stroop_statistiche.html"><strong>Test di Stroop</strong><span>Risultati e grafici per classe.</span></a>
                <a class="ad-strumento" href="programmazione.html"><strong>Programmazione individuale</strong><span>Il piano di lavoro di una classe, in Word.</span></a>
            </div>`;
    }

    // ───────────────────────── 2. Una classe ─────────────────────────

    function disegnaClasse(classe) {
        const d = datiClasse(classe);
        const nAlunni = d.alunni.length;
        const mediaClasse = d.perAlunno.length ? Math.round(d.perAlunno.reduce((s, a) => s + a.media, 0) / d.perAlunno.length) : 0;
        const settimana = Date.now() - 7 * GIORNO;
        const attivi = d.perAlunno.filter(a => a.ultimo && new Date(a.ultimo).getTime() >= settimana).length;
        const senzaLavori = d.perAlunno.filter(a => !a.aperte).length;

        const righeAttivita = d.attivita.map((a, i) => {
            const aperta = stato.attivitaAperte.has(`${classe}|${a.pagina}`);
            const dettaglio = aperta ? `<tr class="ad-dettaglio"><td colspan="5"><div class="ad-tabella-box"><table class="ad-tabella ad-tabella-interna"><tbody>${
                d.alunni.map(cod => {
                    const r = d.perAlunno.find(x => x.codice === cod).lavori.get(a.pagina);
                    return `<tr class="${r ? '' : 'ad-riga-zero'}"><td class="ad-codice"><button class="ad-link" type="button" data-vai="${esc(classe)}" data-alunno="${esc(cod)}">${esc(cod)}</button></td>
                        <td>${barraAvanzamento(r)}</td><td>${badgeStato(r)}</td>
                        <td>${r ? esc(dataBreve(r.updated_at)) : '—'}</td>
                        <td class="ad-azioni-cella">${azioniAlunno(classe, cod, r, a.pagina)}</td></tr>`;
                }).join('')}</tbody></table></div></td></tr>` : '';
            return `<tr class="ad-riga-attivita" data-apri-attivita="${esc(classe)}|${esc(a.pagina)}" tabindex="0" aria-expanded="${aperta}">
                    <td><span class="ad-apri${aperta ? ' ad-ruota' : ''}" aria-hidden="true">›</span> <strong>${esc(titoloPagina(a.pagina))}</strong><br><small class="muted">${esc(sezionePagina(a.pagina))}</small></td>
                    <td class="ad-num">${a.aperta}/${nAlunni}</td>
                    <td style="min-width:170px">${pila(a.conta)}</td>
                    <td class="ad-num">${percento(a.media)}</td>
                    <td>${esc(quandoFa(a.ultimo))}</td>
                </tr>${dettaglio}`;
        }).join('');

        const righeAlunni = d.perAlunno.map(a => `
            <tr class="${a.aperte ? '' : 'ad-riga-zero'}">
                <td class="ad-codice"><button class="ad-link ad-link-forte" type="button" data-vai="${esc(classe)}" data-alunno="${esc(a.codice)}">${esc(a.codice)}</button></td>
                <td class="ad-num">${a.aperte}/${d.attivita.length}</td>
                <td class="ad-num">${a.fatte}</td>
                <td class="ad-num">${percento(a.media)}</td>
                <td>${a.ultimo ? esc(quandoFa(a.ultimo)) : '<span class="ad-stato ad-stato-zero">nessun lavoro</span>'}</td>
                <td class="ad-azioni-cella"><button class="ad-btn ad-btn-piccolo" type="button" data-vai="${esc(classe)}" data-alunno="${esc(a.codice)}">Apri e correggi</button></td>
            </tr>`).join('');

        $('#ad-vista').innerHTML = `
            <div class="ad-classe-testa">
                <h3 class="ad-classe-titolo">${esc(nomeClasse(classe))}</h3>
                <label class="ad-periodo">Periodo
                    <select data-periodo>
                        ${Object.entries(NOMI_PERIODO).map(([k, v]) => `<option value="${k}"${stato.periodo === k ? ' selected' : ''}>${v.charAt(0).toUpperCase() + v.slice(1)}</option>`).join('')}
                    </select>
                </label>
            </div>

            ${d.daElenco ? '' : `<div class="ad-avviso">L'elenco degli alunni della ${esc(nomeClasse(classe))} non è ancora completo: compaiono solo quelli che hanno salvato almeno un lavoro, e chi ha sbagliato codice risulta due volte. Sistemalo in fondo alla pagina.</div>`}

            <div class="ad-riepilogo-classe">
                <div class="ad-numero"><strong>${nAlunni}</strong><span>alunni</span></div>
                <div class="ad-numero"><strong>${d.attivita.length}</strong><span>attività svolte (${esc(NOMI_PERIODO[stato.periodo])})</span></div>
                <div class="ad-numero"><strong>${mediaClasse}%</strong><span>completamento medio della classe</span></div>
                <div class="ad-numero"><strong>${attivi}/${nAlunni}</strong><span>hanno lavorato negli ultimi 7 giorni</span></div>
            </div>

            <section class="ad-blocco">
                <h4 class="ad-blocco-titolo">Alunni</h4>
                <p class="ad-piccolo">Per ogni alunno: quante attività ha aperto e quante ha completato, e la media di completamento su tutte le attività della classe. Clicca sul nome per vedere i suoi lavori e correggerli.${senzaLavori ? ` <strong>${senzaLavori} senza nessun lavoro nel periodo.</strong>` : ''}</p>
                ${d.perAlunno.length ? `<div class="ad-tabella-box"><table class="ad-tabella">
                    <thead><tr><th>Alunno</th><th class="ad-num">Attività aperte</th><th class="ad-num">Completate</th><th class="ad-num">Media</th><th>Ultimo lavoro</th><th></th></tr></thead>
                    <tbody>${righeAlunni}</tbody></table></div>` : '<p class="ad-vuoto">Nessun alunno.</p>'}
            </section>

            <section class="ad-blocco">
                <h4 class="ad-blocco-titolo">Attività</h4>
                <p class="ad-piccolo">Le pagine del sito su cui la classe ha lavorato, dalla più recente. La barra conta tutti gli alunni: verde chi ha completato, arancio chi è a metà, rosso chi non l'ha fatta. Clicca su un'attività per vedere alunno per alunno.</p>
                ${d.attivita.length ? `<div class="ad-tabella-box"><table class="ad-tabella">
                    <thead><tr><th>Attività</th><th class="ad-num">Aperta da</th><th>Risultati</th><th class="ad-num">Media</th><th>Ultimo lavoro</th></tr></thead>
                    <tbody>${righeAttivita}</tbody></table></div>` : `<p class="ad-vuoto">Nessuna attività salvata nel periodo scelto.</p>`}
            </section>

            <section class="ad-blocco">
                ${pannelloElenco(classe, d.daElenco, d.alias)}
            </section>`;
    }

    // ───────────────────────── 3. Un alunno ─────────────────────────

    function disegnaAlunno(classe, codice) {
        const d = datiClasse(classe);
        const io = d.perAlunno.find(a => a.codice === codice);
        const voce = (stato.classi.get(classe) || []).find(a => a.codice === codice);
        const lavori = d.attivita.map(a => ({ a, r: io ? io.lavori.get(a.pagina) : null }));
        const righe = lavori.map(({ a, r }) => `
            <tr class="${r ? '' : 'ad-riga-zero'}">
                <td><strong>${esc(titoloPagina(a.pagina))}</strong><br><small class="muted">${esc(sezionePagina(a.pagina))}${r && r.student_code !== codice ? ` · salvato come «${esc(r.student_code)}»` : ''}</small></td>
                <td>${barraAvanzamento(r)}</td>
                <td>${badgeStato(r)}</td>
                <td>${r ? `${esc(dataBreve(r.updated_at))}<br><small class="muted">${esc(quandoFa(r.updated_at))}</small>` : '—'}</td>
                <td class="ad-azioni-cella">${r
                    ? `<button class="ad-btn ad-btn-piccolo ad-btn-primario" type="button" data-come-alunno data-classe="${esc(r.class_code)}" data-codice="${esc(r.student_code)}" data-pagina="${esc(a.pagina)}">Correggi nella pagina</button>
                       <button class="ad-btn ad-btn-piccolo" type="button" data-risposte="${esc(r.id)}">Leggi le risposte</button>`
                    : '<span class="ad-etichetta">non svolta</span>'}</td>
            </tr>`).join('');
        $('#ad-vista').innerHTML = `
            <div class="ad-classe-testa">
                <h3 class="ad-classe-titolo">${esc(codice)} <small>· ${esc(nomeClasse(classe))}</small></h3>
                <label class="ad-periodo">Periodo
                    <select data-periodo>
                        ${Object.entries(NOMI_PERIODO).map(([k, v]) => `<option value="${k}"${stato.periodo === k ? ' selected' : ''}>${v.charAt(0).toUpperCase() + v.slice(1)}</option>`).join('')}
                    </select>
                </label>
            </div>
            ${voce && voce.alias && voce.alias.length ? `<p class="ad-piccolo">Conta anche i lavori salvati come: ${esc(voce.alias.join(', '))}.</p>` : ''}
            <div class="ad-riepilogo-classe">
                <div class="ad-numero"><strong>${io ? io.aperte : 0}/${d.attivita.length}</strong><span>attività della classe aperte</span></div>
                <div class="ad-numero"><strong>${io ? io.fatte : 0}</strong><span>completate</span></div>
                <div class="ad-numero"><strong>${io ? io.media : 0}%</strong><span>completamento medio</span></div>
                <div class="ad-numero"><strong>${esc(io && io.ultimo ? quandoFa(io.ultimo) : 'mai')}</strong><span>ultimo lavoro</span></div>
            </div>
            <section class="ad-blocco">
                <h4 class="ad-blocco-titolo">Attività</h4>
                <p class="ad-piccolo">«Correggi nella pagina» apre l'attività con le risposte di ${esc(codice)}, come la vede l'alunno, in modalità docente. «Leggi le risposte» le mostra qui, in elenco.</p>
                ${lavori.length ? `<div class="ad-tabella-box"><table class="ad-tabella">
                    <thead><tr><th>Attività</th><th>Avanzamento</th><th>Stato</th><th>Ultimo salvataggio</th><th></th></tr></thead>
                    <tbody>${righe}</tbody></table></div>` : '<p class="ad-vuoto">La classe non ha attività nel periodo scelto.</p>'}
            </section>`;
    }

    // ───────────────────────── elenco degli alunni ─────────────────────────

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
            <summary>Elenco degli alunni${daElenco ? ` (${elenco.length})` : ' · da completare'}${sconosciuti.length ? ` · ${sconosciuti.length} ${sconosciuti.length === 1 ? 'codice' : 'codici'} da sistemare` : ''}</summary>
            <div class="ad-elenco-corpo">
                <p>Scrivi un codice per riga, come lo scrivono gli alunni quando entrano nelle attività (cognome e iniziale del nome, senza spazi). Con l'elenco completo, chi non ha mai lavorato compare comunque, in rosso.</p>
                <p>Se un alunno ha usato anche un codice sbagliato, scrivilo dopo il segno uguale: <code>karimk = karim</code>. I lavori salvati con i due codici verranno contati insieme.</p>
                <textarea id="elenco-testo" spellcheck="false" placeholder="rossim&#10;bianchia = bianchi">${esc(testo)}</textarea>
                <div class="ad-modulo-azioni">
                    <button class="ad-btn ad-btn-primario" type="button" data-salva-elenco="${esc(classe)}">Salva l'elenco</button>
                    <button class="ad-btn" type="button" data-proponi-elenco="${esc(classe)}">Inserisci i codici usati quest'anno</button>
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
            <p><button class="ad-btn ad-btn-piccolo" type="button" data-come-alunno data-classe="${esc(riga.class_code)}" data-codice="${esc(riga.student_code)}" data-pagina="${esc(riga.page_path)}">Correggi nella pagina</button></p>
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
        $('#ad-aggiorna').addEventListener('click', caricaTutto);
        $('#ad-password').addEventListener('click', cambiaPassword);
        $('#ad-esci').addEventListener('click', () => { window.MODocente.esci(); mostraAccesso(); });
        window.addEventListener('hashchange', disegna);

        document.addEventListener('change', (e) => {
            if (e.target.matches('[data-periodo]')) {
                stato.periodo = e.target.value;
                try { localStorage.setItem(PERIODO_KEY, stato.periodo); } catch { }
                disegna();
            }
        });

        document.addEventListener('click', (e) => {
            const t = e.target.closest('button, [data-apri-attivita]');
            if (!t) { if (e.target.id === 'ad-finestra') chiudiFinestra(); return; }
            const d = t.dataset;
            if (d.risposte) { e.preventDefault(); e.stopPropagation(); mostraRisposte(d.risposte); return; }
            if ('comeAlunno' in d) { e.preventDefault(); e.stopPropagation(); apriComeAlunno(d.classe, d.codice, d.pagina); return; }
            if ('chiudiFinestra' in d) { chiudiFinestra(); return; }
            if (d.vai !== undefined) { e.stopPropagation(); chiudiFinestra(); vai(d.vai, d.alunno || ''); return; }
            if (d.apriAttivita) {
                if (stato.attivitaAperte.has(d.apriAttivita)) stato.attivitaAperte.delete(d.apriAttivita); else stato.attivitaAperte.add(d.apriAttivita);
                disegna();
                return;
            }
            if ('nuovaClasse' in d) {
                const nome = normCodice(prompt('Codice della classe, come lo usano gli alunni (es. 1sa):') || '');
                if (!nome) return;
                if (!/^[a-z0-9]{1,12}$/.test(nome)) { alert('Solo lettere e numeri, per esempio 1sa.'); return; }
                if (!stato.classi.has(nome)) stato.classi.set(nome, []);
                vai(nome, '');
                return;
            }
            const classe = leggiPercorso().classe;
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
                else alert(`Inseriti ${nuovi.length} codici. Controlla l'elenco: togli chi non è della classe, unisci i doppioni con «=» e premi «Salva l'elenco».`);
                return;
            }
            if (d.collegaAlias) {
                const sel = document.querySelector(`select[data-alias-di="${CSS.escape(d.collegaAlias)}"]`);
                if (!sel || !sel.value) { alert('Scegli prima l\'alunno a cui appartiene il codice.'); return; }
                const elenco = (stato.classi.get(classe) || []).map(a => ({ codice: a.codice, alias: a.alias.slice() }));
                const alunno = elenco.find(a => a.codice === sel.value);
                if (alunno && !alunno.alias.includes(d.collegaAlias)) alunno.alias.push(d.collegaAlias);
                salvaElenco(classe, elenco);
                return;
            }
            if (d.aggiungiAlunno) {
                const elenco = (stato.classi.get(classe) || []).map(a => ({ codice: a.codice, alias: a.alias.slice() }));
                elenco.push({ codice: d.aggiungiAlunno, alias: [] });
                salvaElenco(classe, elenco);
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') chiudiFinestra();
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-apri-attivita]')) {
                e.preventDefault();
                e.target.click();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        try { stato.periodo = localStorage.getItem(PERIODO_KEY) || 'anno'; } catch { stato.periodo = 'anno'; }
        if (!NOMI_PERIODO[stato.periodo]) stato.periodo = 'anno';
        collega();
        if (window.MODocente && window.MODocente.attivo()) mostraDashboard();
    });
})();
