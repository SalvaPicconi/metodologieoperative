// Programmazione individuale: il docente sceglie classe e UDA, il sito compila il piano di lavoro
// nel modello di istituto (assets/modello-programmazione-individuale.docx) e lo scarica in Word.
// Le UDA si leggono da programmi.json: qui non si scrive nessun contenuto didattico.
(function () {
    const MODELLO_URL = 'assets/modello-programmazione-individuale.docx';
    const ARCHIVIO = 'mo-programmazione-individuale';
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const ORDINALI = { 'Primo anno': '1', 'Secondo anno': '2', 'Terzo anno': '3', 'Quarto anno': '4', 'Quinto anno': '5' };
    const RECUPERO = 'Ogni qualvolta si rendesse necessario, si provvederà al recupero delle conoscenze e delle abilità pregresse.';

    const $ = (id) => document.getElementById(id);
    const CAMPI = {
        docente: 'pi-docente', disciplina: 'pi-disciplina', anno: 'pi-anno', classe: 'pi-classe',
        annoScolastico: 'pi-as', ore: 'pi-ore', oreCompresenza: 'pi-ore-compresenza',
        luogo: 'pi-luogo', data: 'pi-data'
    };
    const METODO = {
        attivita: 'pi-m-attivita', strumenti: 'pi-m-strumenti', verifiche: 'pi-m-verifiche',
        criteri: 'pi-m-criteri', recupero: 'pi-m-recupero'
    };

    let dati = null;
    // scelte: [{ chiave, periodo, ore }] nell'ordine della scaletta
    let scelte = [];

    const esc = (testo) => String(testo ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
    const slug = (valore) => String(valore).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const righe = (testo) => String(testo || '').split('\n').map((r) => r.trim()).filter(Boolean);
    const unici = (voci) => [...new Set(voci.filter(Boolean))];

    // Stessa chiave che usa la pagina Programmi, dove le UDA si possono scegliere sfogliandole.
    function chiaveModulo(modulo) {
        const anno = slug(modulo.anno);
        if (modulo.alternativoA !== undefined) {
            return `${anno}-uda-${modulo.alternativoA}b`;
        }
        const haAlternativa = dati.moduli.some((m) => m.anno === modulo.anno && m.alternativoA === modulo.n);
        const suffisso = modulo.suffisso ? `-${slug(modulo.suffisso)}` : '';
        return `${anno}-uda-${modulo.n}${haAlternativa ? 'a' : ''}${suffisso}`;
    }

    /* ---------- le UDA scelte, condivise con la pagina Programmi ---------- */

    const SELEZIONE = 'mo-programmazione-selezione';

    function leggiSelezione() {
        try {
            const letta = JSON.parse(window.localStorage.getItem(SELEZIONE) || '{}');
            return letta && typeof letta === 'object' ? letta : {};
        } catch (errore) {
            return {};
        }
    }

    function scriviSelezione() {
        try {
            const selezione = leggiSelezione();
            selezione[$('pi-anno').value] = scelte.map((s) => s.chiave);
            window.localStorage.setItem(SELEZIONE, JSON.stringify(selezione));
        } catch (errore) {
            console.warn('Selezione non salvata:', errore);
        }
    }

    // Porta nella scaletta le UDA scelte nei Programmi per quell'anno, senza perdere
    // periodo e ore già corretti a mano né l'ordine già dato.
    function prendiSelezione(anno) {
        const chiavi = leggiSelezione()[anno];
        if (!Array.isArray(chiavi)) {
            return false;
        }
        const valide = chiavi.filter((c) => {
            const modulo = trovaModulo(c);
            return modulo && modulo.anno === anno;
        });
        const tenute = scelte.filter((s) => valide.includes(s.chiave));
        const nuove = moduliAnno(anno).map(chiaveModulo)
            .filter((c) => valide.includes(c) && !tenute.some((s) => s.chiave === c));
        scelte = tenute;
        nuove.forEach(aggiungi);
        return true;
    }

    function moduliAnno(anno) {
        return dati.moduli.filter((m) => m.anno === anno)
            .sort((a, b) => (a.alternativoA ?? a.n) - (b.alternativoA ?? b.n) || (a.alternativoA !== undefined ? 1 : -1));
    }

    function trovaModulo(chiave) {
        return dati.moduli.find((m) => chiaveModulo(m) === chiave);
    }

    const numeroOre = (testo) => {
        const trovato = String(testo || '').match(/\d+/);
        return trovato ? Number(trovato[0]) : 0;
    };

    /* ---------- avvio ---------- */

    fetch('programmi.json', { cache: 'no-cache' })
        .then((risposta) => {
            if (!risposta.ok) {
                throw new Error(`HTTP ${risposta.status}`);
            }
            return risposta.json();
        })
        .then((json) => {
            dati = json;
            prepara();
        })
        .catch((errore) => {
            console.error('Impossibile caricare programmi.json:', errore);
            $('pi-catalogo').innerHTML = '<div class="empty-state"><p>Non è stato possibile caricare le UDA.</p>'
                + '<p>Ricarica la pagina.</p></div>';
        });

    function prepara() {
        const selettore = $('pi-anno');
        dati.meta.anni.forEach((anno) => {
            const opzione = document.createElement('option');
            opzione.value = anno;
            opzione.textContent = anno;
            selettore.appendChild(opzione);
        });

        const oggi = new Date();
        $('pi-data').value = oggi.toISOString().slice(0, 10);
        const inizio = oggi.getMonth() >= 7 ? oggi.getFullYear() : oggi.getFullYear() - 1;
        $('pi-as').value = `${inizio}/${inizio + 1}`;
        metodoPredefinito();

        const bozza = leggiArchivio();
        if (bozza.corrente && bozza.voci[bozza.corrente]) {
            applica(bozza.voci[bozza.corrente]);
        }
        // Dai Programmi si arriva con ?anno=…: se la bozza aperta è di un altro anno si riparte puliti.
        const richiesto = new URLSearchParams(window.location.search).get('anno');
        if (richiesto && dati.meta.anni.includes(richiesto) && selettore.value !== richiesto) {
            selettore.value = richiesto;
            $('pi-classe').value = '';
            scelte = [];
        }
        // Le UDA scelte sfogliando i Programmi valgono più di quelle rimaste nella bozza.
        prendiSelezione(selettore.value);

        Object.values(CAMPI).concat(Object.values(METODO)).forEach((id) => {
            $(id).addEventListener('input', aggiorna);
        });
        selettore.addEventListener('change', () => {
            // Le UDA di un altro anno non hanno senso nella scaletta: si riparte da quelle già scelte per il nuovo.
            scelte = [];
            prendiSelezione(selettore.value);
            disegnaCatalogo();
            aggiorna();
        });
        $('pi-tutte').addEventListener('click', () => {
            moduliAnno(selettore.value).forEach((m) => aggiungi(chiaveModulo(m)));
            disegnaCatalogo();
            aggiorna();
        });
        $('pi-nessuna').addEventListener('click', () => {
            scelte = [];
            disegnaCatalogo();
            aggiorna();
        });
        $('pi-ripristina').addEventListener('click', () => {
            metodoPredefinito();
            aggiorna();
        });
        $('pi-scarica').addEventListener('click', scarica);
        $('pi-apri').addEventListener('click', () => {
            const archivio = leggiArchivio();
            const voce = archivio.voci[$('pi-salvate').value];
            if (voce) {
                applica(voce);
                disegnaCatalogo();
                aggiorna();
            }
        });
        $('pi-elimina').addEventListener('click', () => {
            const archivio = leggiArchivio();
            const nome = $('pi-salvate').value;
            if (nome && window.confirm(`Eliminare la programmazione «${nome}» da questo computer?`)) {
                delete archivio.voci[nome];
                if (archivio.corrente === nome) {
                    archivio.corrente = '';
                }
                scriviArchivio(archivio);
                disegnaSalvate();
            }
        });
        $('pi-nuova').addEventListener('click', () => {
            $('pi-classe').value = '';
            scelte = [];
            metodoPredefinito();
            disegnaCatalogo();
            aggiorna();
            $('pi-classe').focus();
        });

        disegnaCatalogo();
        aggiorna();
    }

    function metodoPredefinito() {
        const imp = dati.impiantoDidattico;
        $('pi-m-attivita').value = imp.metodologia;
        $('pi-m-strumenti').value = imp.strumenti.join('\n');
        $('pi-m-verifiche').value = imp.verifiche.join('\n');
        $('pi-m-criteri').value = [imp.valutazione].concat(imp.elementiTrasversali).join('\n');
        $('pi-m-recupero').value = RECUPERO;
    }

    /* ---------- salvataggio sul computer ---------- */

    function leggiArchivio() {
        try {
            const letto = JSON.parse(window.localStorage.getItem(ARCHIVIO) || '{}');
            return { corrente: letto.corrente || '', voci: letto.voci || {} };
        } catch (errore) {
            return { corrente: '', voci: {} };
        }
    }

    function scriviArchivio(archivio) {
        try {
            window.localStorage.setItem(ARCHIVIO, JSON.stringify(archivio));
        } catch (errore) {
            console.warn('Salvataggio locale non disponibile:', errore);
        }
    }

    function fotografa() {
        const voce = { scelte, campi: {}, metodo: {} };
        Object.entries(CAMPI).forEach(([nome, id]) => { voce.campi[nome] = $(id).value; });
        Object.entries(METODO).forEach(([nome, id]) => { voce.metodo[nome] = $(id).value; });
        return voce;
    }

    function applica(voce) {
        Object.entries(CAMPI).forEach(([nome, id]) => {
            if (voce.campi && voce.campi[nome] !== undefined) {
                $(id).value = voce.campi[nome];
            }
        });
        Object.entries(METODO).forEach(([nome, id]) => {
            if (voce.metodo && voce.metodo[nome] !== undefined) {
                $(id).value = voce.metodo[nome];
            }
        });
        // Una UDA tolta o rinumerata nei Programmi non deve restare appesa alla scaletta.
        scelte = (voce.scelte || []).filter((s) => trovaModulo(s.chiave));
    }

    function nomeBozza() {
        const classe = $('pi-classe').value.trim().toUpperCase();
        return classe ? `${classe} · ${$('pi-as').value.trim()}` : '';
    }

    function salva() {
        const nome = nomeBozza();
        if (!nome) {
            return;
        }
        const archivio = leggiArchivio();
        archivio.voci[nome] = fotografa();
        archivio.corrente = nome;
        scriviArchivio(archivio);
    }

    function disegnaSalvate() {
        const archivio = leggiArchivio();
        const nomi = Object.keys(archivio.voci).sort();
        $('pi-riprendi').hidden = nomi.length === 0;
        $('pi-salvate').innerHTML = nomi.map((nome) => (
            `<option value="${esc(nome)}"${nome === archivio.corrente ? ' selected' : ''}>${esc(nome)}</option>`
        )).join('');
    }

    /* ---------- catalogo e scaletta ---------- */

    function aggiungi(chiave) {
        if (scelte.some((s) => s.chiave === chiave)) {
            return;
        }
        const modulo = trovaModulo(chiave);
        scelte.push({ chiave, periodo: modulo.periodo || '', ore: modulo.monteOre || '' });
    }

    function disegnaCatalogo() {
        const anno = $('pi-anno').value;
        $('pi-catalogo-titolo').textContent = `Catalogo · ${anno}`;
        const sezioni = dati.meta.sezioni || {};
        $('pi-catalogo').innerHTML = moduliAnno(anno).map((modulo) => {
            const chiave = chiaveModulo(modulo);
            const spuntata = scelte.some((s) => s.chiave === chiave) ? ' checked' : '';
            const numero = modulo.alternativoA !== undefined ? `${modulo.alternativoA}B` : modulo.n;
            const etichetta = sezioni[modulo.sezione]
                ? `<span class="prog-tag-sezione prog-tag-sezione-${esc(modulo.sezione)}">${esc(sezioni[modulo.sezione])}</span>` : '';
            return `
            <label class="pi-voce">
              <input type="checkbox" value="${esc(chiave)}"${spuntata}>
              <span class="pi-voce-testo">
                <span class="pi-voce-titolo"><span class="pi-voce-num">UDA ${esc(numero)}</span> ${esc(modulo.titolo)} ${etichetta}</span>
                <span class="pi-voce-meta">${esc(modulo.periodo)} · ${esc(modulo.monteOre)}</span>
                <span class="pi-voce-sintesi">${esc(modulo.sintesi)}</span>
              </span>
            </label>`;
        }).join('');

        $('pi-catalogo').querySelectorAll('input[type="checkbox"]').forEach((casella) => {
            casella.addEventListener('change', () => {
                if (casella.checked) {
                    aggiungi(casella.value);
                } else {
                    scelte = scelte.filter((s) => s.chiave !== casella.value);
                }
                aggiorna();
            });
        });
    }

    function disegnaScaletta() {
        const lista = $('pi-scelte');
        lista.innerHTML = scelte.map((scelta, indice) => {
            const modulo = trovaModulo(scelta.chiave);
            return `
            <li class="pi-scelta" data-chiave="${esc(scelta.chiave)}">
              <div class="pi-scelta-testa">
                <span class="pi-scelta-titolo">${esc(modulo.titolo)}</span>
                <span class="pi-scelta-azioni">
                  <button type="button" data-azione="su" aria-label="Sposta su"${indice === 0 ? ' disabled' : ''}>▲</button>
                  <button type="button" data-azione="giu" aria-label="Sposta giù"${indice === scelte.length - 1 ? ' disabled' : ''}>▼</button>
                  <button type="button" data-azione="togli" aria-label="Togli dalla scaletta">✕</button>
                </span>
              </div>
              <div class="pi-scelta-campi">
                <label>Periodo <input type="text" data-campo="periodo" value="${esc(scelta.periodo)}"></label>
                <label>Ore <input type="text" data-campo="ore" value="${esc(scelta.ore)}"></label>
              </div>
            </li>`;
        }).join('');
        $('pi-vuota').hidden = scelte.length > 0;

        lista.querySelectorAll('.pi-scelta').forEach((riga) => {
            const indice = scelte.findIndex((s) => s.chiave === riga.dataset.chiave);
            riga.querySelectorAll('button').forEach((bottone) => {
                bottone.addEventListener('click', () => {
                    const azione = bottone.dataset.azione;
                    if (azione === 'togli') {
                        scelte.splice(indice, 1);
                    } else {
                        const altro = azione === 'su' ? indice - 1 : indice + 1;
                        [scelte[indice], scelte[altro]] = [scelte[altro], scelte[indice]];
                    }
                    disegnaCatalogo();
                    aggiorna();
                });
            });
            riga.querySelectorAll('input').forEach((campo) => {
                // Si aggiorna il dato senza ridisegnare la scaletta, altrimenti il cursore salta via.
                campo.addEventListener('input', () => {
                    scelte[indice][campo.dataset.campo] = campo.value;
                    aggiorna(false);
                });
            });
        });
    }

    function aggiorna(ridisegnaScaletta) {
        if (ridisegnaScaletta !== false) {
            disegnaScaletta();
        }
        const totale = scelte.reduce((somma, s) => somma + numeroOre(s.ore), 0);
        const settimanali = Number($('pi-ore').value) || 0;
        const annuali = settimanali * 33;
        $('pi-totale').textContent = scelte.length
            ? `${scelte.length} UDA · ${totale} ore` + (annuali ? ` su ${annuali} annuali` : '')
            : '';
        $('pi-totale').classList.toggle('pi-totale-oltre', annuali > 0 && totale > annuali);

        const classe = $('pi-classe').value.trim().toUpperCase();
        $('pi-riepilogo').textContent = [
            classe || 'Classe da indicare',
            $('pi-as').value.trim(),
            `${scelte.length} UDA`,
            `${totale} ore`
        ].filter(Boolean).join(' · ');
        $('pi-avviso').textContent = '';

        scriviSelezione();
        salva();
        disegnaSalvate();
        disegnaAnteprima();
    }

    /* ---------- il contenuto del documento ---------- */

    function traguardo(modulo, competenza) {
        return dati.curricolo.find((t) => t.periodo === modulo.periodoCurricolo && t.competenza === competenza);
    }

    function contenutoUda(scelta, posizione) {
        const modulo = trovaModulo(scelta.chiave);
        const focus = modulo.focus || {};
        const ripiego = focus.ripiego || {};

        // Il cappello va per primo: è la competenza su cui la UDA lavora davvero.
        const codici = unici([focus.competenza].concat(modulo.competenze || []));
        const traguardi = codici.map((c) => traguardo(modulo, c)).filter(Boolean);

        const competenze = traguardi.map((t) => t.competenzaTitolo);
        const intermedie = traguardi.map((t) => t.competenzaIntermedia);
        if (ripiego.europea) {
            competenze.push(`Competenza chiave europea: ${ripiego.europea}`);
        }
        if (ripiego.generale && ripiego.generale.titolo) {
            competenze.push(`Area generale, competenza n. ${ripiego.generale.competenza}: ${ripiego.generale.titolo}`);
        }
        if (ripiego.civica && ripiego.civica.titolo) {
            competenze.push(`Educazione civica, ${ripiego.civica.nucleo}: ${ripiego.civica.titolo}`);
        }

        const agganci = (modulo.contenuti || []).flatMap((c) => c.agganci || []);
        let conoscenze = unici((focus.conoscenze || []).concat(agganci.flatMap((a) => a.conoscenze || [])));
        let abilita = unici((focus.abilita || []).concat(agganci.flatMap((a) => a.abilita || [])));
        if (!conoscenze.length && ripiego.generale) {
            conoscenze = ripiego.generale.conoscenze || [];
        }
        if (!abilita.length && ripiego.generale) {
            abilita = ripiego.generale.abilita || [];
        }

        const contenuti = (modulo.contenuti || []).map((c) => `– ${c.attivita}`);
        const prova = modulo.provaEsperta || {};
        if (prova.titolo) {
            contenuti.push(`Prova esperta di laboratorio: ${prova.titolo}. ${prova.prodotto || ''}`.trim());
        }

        return {
            titolo: `UDA ${posizione} – ${modulo.titolo}`,
            competenze: competenze.length ? competenze : ['UDA trasversale'],
            intermedie: intermedie.length ? intermedie : ['UDA trasversale: nessuna competenza intermedia di indirizzo'],
            conoscenze,
            abilita,
            periodo: [scelta.periodo, scelta.ore].map((v) => String(v || '').trim()).filter(Boolean).join(' · '),
            contenuti
        };
    }

    function contenutoDocumento() {
        const valore = (nome) => $(CAMPI[nome]).value.trim();
        const disciplina = valore('disciplina') || 'Metodologie Operative';
        const info = [
            ['DOCENTE', valore('docente')],
            ['DISCIPLINA', disciplina],
            ['CLASSE/SEZIONE', valore('classe').toUpperCase()],
            ['ANNO SCOLASTICO', valore('annoScolastico')],
            ['ORE SETTIMANALI', valore('ore')]
        ];
        if (valore('oreCompresenza')) {
            info.push(['DI CUI IN COMPRESENZA', valore('oreCompresenza')]);
        }
        const data = valore('data') ? valore('data').split('-').reverse().join('/') : '__/__/____';
        return {
            titolo: `PIANO DI LAVORO DI ${disciplina.toUpperCase()}`,
            info,
            metodologia: [
                ['Attività', righe($('pi-m-attivita').value)],
                ['Strumenti', righe($('pi-m-strumenti').value)],
                ['Verifiche', righe($('pi-m-verifiche').value)],
                ['Criteri e modalità di valutazione', righe($('pi-m-criteri').value)],
                ['Attività di recupero in itinere', righe($('pi-m-recupero').value)]
            ],
            ordinale: ORDINALI[$('pi-anno').value] || '_',
            uda: scelte.map((s, i) => contenutoUda(s, i + 1)),
            luogo: valore('luogo') || 'Cagliari',
            data
        };
    }

    /* ---------- anteprima ---------- */

    function disegnaAnteprima() {
        const doc = contenutoDocumento();
        const paragrafi = (voci) => (voci.length ? voci : ['']).map((v) => `<p>${esc(v) || '&nbsp;'}</p>`).join('');
        const righeTabella = (voci) => voci.map((v) => `<tr><td>${esc(v)}</td></tr>`).join('');

        const uda = doc.uda.map((u) => `
          <table class="pi-doc-tab pi-doc-uda"><tr><th class="pi-doc-grigio">${esc(u.titolo)}</th></tr></table>
          <table class="pi-doc-tab"><tr><th>COMPETENZE</th></tr>${righeTabella(u.competenze)}</table>
          <table class="pi-doc-tab"><tr><th>COMPETENZE INTERMEDIE ${esc(doc.ordinale)}° ANNO</th></tr>${righeTabella(u.intermedie)}</table>
          <table class="pi-doc-tab">
            <tr><th>Conoscenze</th></tr><tr><td>${paragrafi(u.conoscenze)}</td></tr>
            <tr><th>Abilità</th></tr><tr><td>${paragrafi(u.abilita)}</td></tr>
          </table>
          <table class="pi-doc-tab">
            <tr><th>Periodo</th></tr><tr><td>${paragrafi([u.periodo])}</td></tr>
            <tr><th>Contenuti</th></tr><tr><td>${paragrafi(u.contenuti)}</td></tr>
          </table>`).join('');

        $('pi-anteprima').innerHTML = `
          <div class="pi-foglio">
            <p class="pi-doc-titolo">${esc(doc.titolo)}</p>
            <table class="pi-doc-tab pi-doc-info">
              <tr><th colspan="2" class="pi-doc-grigio">INFORMAZIONI GENERALI</th></tr>
              ${doc.info.map(([e, v]) => `<tr><td>${esc(e)}</td><td>${esc(v)}</td></tr>`).join('')}
            </table>
            <table class="pi-doc-tab">
              <tr><th class="pi-doc-grigio">METODOLOGIA</th></tr>
              ${doc.metodologia.map(([t, voci]) => `<tr><th>${esc(t)}</th></tr><tr><td>${paragrafi(voci)}</td></tr>`).join('')}
            </table>
          </div>
          <div class="pi-foglio">
            <p class="pi-doc-testata">SCANSIONE DEI CONTENUTI DISCIPLINARI</p>
            ${uda || '<p class="pi-vuota">Scegli almeno una UDA al passo 2 per vedere la scansione dei contenuti.</p>'}
            <p class="pi-doc-firma"><span>${esc(doc.luogo)}, ${esc(doc.data)}</span><span>Il/La docente</span></p>
          </div>`;
    }

    /* ---------- il file Word, costruito sul modello ---------- */

    const figli = (nodo, nome) => [...nodo.childNodes]
        .filter((c) => c.nodeType === 1 && c.namespaceURI === W && c.localName === nome);

    function togliGrassetto(nodo) {
        [...nodo.getElementsByTagNameNS(W, 'b'), ...nodo.getElementsByTagNameNS(W, 'bCs')]
            .forEach((b) => b.parentNode.removeChild(b));
    }

    // Un paragrafo nuovo con lo stesso formato di quello del modello e il testo dato.
    function paragrafoDa(modello, testo, tieniGrassetto) {
        const doc = modello.ownerDocument;
        const p = modello.cloneNode(false);
        const pPr = figli(modello, 'pPr')[0];
        let rPr = null;
        if (pPr) {
            const copia = pPr.cloneNode(true);
            if (!tieniGrassetto) {
                togliGrassetto(copia);
            }
            p.appendChild(copia);
            rPr = figli(copia, 'rPr')[0];
        }
        const primoRun = figli(modello, 'r')[0];
        if (primoRun && figli(primoRun, 'rPr')[0]) {
            rPr = figli(primoRun, 'rPr')[0];
        }
        if (testo) {
            const r = doc.createElementNS(W, 'w:r');
            if (rPr) {
                const copia = rPr.cloneNode(true);
                if (!tieniGrassetto) {
                    togliGrassetto(copia);
                }
                r.appendChild(copia);
            }
            const t = doc.createElementNS(W, 'w:t');
            t.setAttribute('xml:space', 'preserve');
            t.textContent = testo;
            r.appendChild(t);
            p.appendChild(r);
        }
        return p;
    }

    // Sostituisce i paragrafi di una cella con una riga per voce (almeno un paragrafo resta sempre).
    function scriviCella(cella, voci, tieniGrassetto) {
        const paragrafi = figli(cella, 'p');
        const modello = paragrafi[0];
        const nuovi = (voci.length ? voci : ['']).map((v) => paragrafoDa(modello, v, tieniGrassetto));
        paragrafi.forEach((p) => cella.removeChild(p));
        nuovi.forEach((p) => cella.appendChild(p));
    }

    const celle = (riga) => figli(riga, 'tc');

    // Una tabella «intestazione + una riga per voce»: la riga vuota del modello fa da stampo.
    function scriviElenco(tabella, intestazione, voci) {
        const tutte = figli(tabella, 'tr');
        if (intestazione) {
            scriviCella(celle(tutte[0])[0], [intestazione], true);
        }
        const stampo = tutte[1];
        tutte.slice(1).forEach((r) => tabella.removeChild(r));
        (voci.length ? voci : ['']).forEach((voce) => {
            const riga = stampo.cloneNode(true);
            scriviCella(celle(riga)[0], [voce], false);
            tabella.appendChild(riga);
        });
    }

    function compilaXml(xml, doc) {
        const documento = new DOMParser().parseFromString(xml, 'application/xml');
        if (documento.getElementsByTagName('parsererror').length) {
            throw new Error('Il modello Word non è leggibile.');
        }
        const corpo = documento.getElementsByTagNameNS(W, 'body')[0];
        const tabelle = figli(corpo, 'tbl');
        if (tabelle.length < 8) {
            throw new Error('Il modello Word non ha la struttura attesa.');
        }
        const [tInfo, tMetodo, tTitolo, tCompetenze, tIntermedie, tSaperi, tPeriodo, tPeriodoBis] = tabelle;

        // Titolo
        const titolo = figli(corpo, 'p')[0];
        corpo.replaceChild(paragrafoDa(titolo, doc.titolo, true), titolo);

        // Informazioni generali: le righe del modello dopo l'intestazione fanno da stampo.
        const righeInfo = figli(tInfo, 'tr');
        const stampoInfo = righeInfo[1];
        righeInfo.slice(1).forEach((r) => tInfo.removeChild(r));
        doc.info.forEach(([etichetta, valore]) => {
            const riga = stampoInfo.cloneNode(true);
            scriviCella(celle(riga)[0], [etichetta], false);
            scriviCella(celle(riga)[1], [valore], false);
            tInfo.appendChild(riga);
        });

        // Metodologia: righe alterne intestazione / contenuto, nell'ordine del modello.
        const righeMetodo = figli(tMetodo, 'tr');
        doc.metodologia.forEach(([, voci], indice) => {
            scriviCella(celle(righeMetodo[2 + indice * 2])[0], voci, false);
        });

        // Fra la metodologia e il cambio di sezione il modello ha due paragrafi vuoti: con la tabella
        // compilata la prima pagina è piena e quei due finirebbero da soli su una pagina bianca.
        // Si toglie quello libero e si riduce al minimo quello che porta il cambio di sezione.
        let nodo = tMetodo.nextSibling;
        while (nodo && nodo !== tTitolo) {
            const prossimo = nodo.nextSibling;
            if (nodo.nodeType === 1 && nodo.localName === 'p') {
                const pPr = figli(nodo, 'pPr')[0];
                if (!pPr || !figli(pPr, 'sectPr').length) {
                    corpo.removeChild(nodo);
                } else {
                    figli(pPr, 'spacing').concat(figli(pPr, 'rPr')).forEach((n) => pPr.removeChild(n));
                    const spazio = documento.createElementNS(W, 'w:spacing');
                    spazio.setAttribute('w:before', '0');
                    spazio.setAttribute('w:after', '0');
                    spazio.setAttribute('w:line', '20');
                    spazio.setAttribute('w:lineRule', 'exact');
                    const rPr = documento.createElementNS(W, 'w:rPr');
                    const sz = documento.createElementNS(W, 'w:sz');
                    sz.setAttribute('w:val', '2');
                    rPr.appendChild(sz);
                    // L'ordine degli elementi in pPr è fissato dallo schema: spacing, poi rPr, poi sectPr.
                    const sectPr = figli(pPr, 'sectPr')[0];
                    pPr.insertBefore(spazio, sectPr);
                    pPr.insertBefore(rPr, sectPr);
                }
            }
            nodo = prossimo;
        }

        // Blocco UDA: dal titolo alla prima tabella «Periodo / Contenuti», ripetuto per ogni UDA.
        const nodi = [...corpo.childNodes];
        const inizio = nodi.indexOf(tTitolo);
        const fineBlocco = nodi.indexOf(tPeriodo);
        const fineModello = nodi.indexOf(tPeriodoBis);
        const blocco = nodi.slice(inizio, fineBlocco + 1);
        const dopo = nodi[fineModello + 1];
        const separatore = nodi[inizio + 1];
        nodi.slice(inizio, fineModello + 1).forEach((n) => corpo.removeChild(n));

        doc.uda.forEach((uda, posizione) => {
            const copia = blocco.map((n) => n.cloneNode(true));
            const sue = copia.filter((n) => n.nodeType === 1 && n.localName === 'tbl');
            scriviCella(celle(figli(sue[0], 'tr')[0])[0], [uda.titolo], true);
            scriviElenco(sue[1], 'COMPETENZE', uda.competenze);
            scriviElenco(sue[2], `COMPETENZE INTERMEDIE ${doc.ordinale}° ANNO`, uda.intermedie);
            const saperi = figli(sue[3], 'tr');
            scriviCella(celle(saperi[1])[0], uda.conoscenze, false);
            scriviCella(celle(saperi[3])[0], uda.abilita, false);
            const periodo = figli(sue[4], 'tr');
            scriviCella(celle(periodo[1])[0], [uda.periodo], false);
            scriviCella(celle(periodo[3])[0], uda.contenuti, false);
            if (posizione > 0) {
                corpo.insertBefore(separatore.cloneNode(true), dopo);
                corpo.insertBefore(separatore.cloneNode(true), dopo);
            }
            copia.forEach((n) => corpo.insertBefore(n, dopo));
        });

        // Luogo e data, lasciando com'è «Il/La docente».
        figli(corpo, 'p').forEach((p) => {
            const testi = [...p.getElementsByTagNameNS(W, 't')];
            if (!testi.some((t) => t.textContent.startsWith('Cagliari'))) {
                return;
            }
            testi.forEach((t) => {
                if (t.textContent.startsWith('Cagliari')) {
                    t.textContent = `${doc.luogo}, `;
                } else if (t.textContent.includes('__/__')) {
                    t.textContent = doc.data;
                }
            });
        });

        const intestazione = xml.startsWith('<?xml') ? xml.slice(0, xml.indexOf('?>') + 2) + '\n' : '';
        const corpoXml = new XMLSerializer().serializeToString(documento).replace(/^<\?xml[^>]*\?>\s*/, '');
        return intestazione + corpoXml;
    }

    async function scarica() {
        const avviso = $('pi-avviso');
        if (!scelte.length) {
            avviso.textContent = 'Scegli almeno una UDA al passo 2.';
            $('pi-passo-2').scrollIntoView({ behavior: 'smooth' });
            return;
        }
        if (!$('pi-classe').value.trim()) {
            avviso.textContent = 'Indica la classe al passo 1.';
            $('pi-classe').focus();
            return;
        }
        if (!window.JSZip) {
            avviso.textContent = 'Serve la connessione a internet per preparare il file Word: ricarica la pagina.';
            return;
        }
        const bottone = $('pi-scarica');
        bottone.disabled = true;
        avviso.textContent = 'Preparo il file…';
        try {
            const risposta = await fetch(MODELLO_URL, { cache: 'no-cache' });
            if (!risposta.ok) {
                throw new Error(`HTTP ${risposta.status}`);
            }
            const zip = await window.JSZip.loadAsync(await risposta.arrayBuffer());
            const xml = await zip.file('word/document.xml').async('string');
            zip.file('word/document.xml', compilaXml(xml, contenutoDocumento()));
            const file = await zip.generateAsync({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                compression: 'DEFLATE'
            });
            const nome = `Programmazione_${slug($('pi-disciplina').value || 'disciplina')}_`
                + `${slug($('pi-classe').value)}_${slug($('pi-as').value)}.docx`;
            const collegamento = document.createElement('a');
            collegamento.href = URL.createObjectURL(file);
            collegamento.download = nome;
            document.body.appendChild(collegamento);
            collegamento.click();
            collegamento.remove();
            window.setTimeout(() => URL.revokeObjectURL(collegamento.href), 5000);
            avviso.textContent = `Scaricato: ${nome}`;
        } catch (errore) {
            console.error('Errore nella preparazione del file Word:', errore);
            avviso.textContent = 'Non sono riuscito a preparare il file Word. Ricarica la pagina e riprova.';
        } finally {
            bottone.disabled = false;
        }
    }

    // Esposto per poter verificare il file senza passare dal download.
    window.MOProgrammazione = { compilaXml, contenutoDocumento };
})();
