// Rendering della pagina Programmi: incrocia curricolo SSAS, livelli QNQ e moduli proposti.
// Il file programmi.json e' generato da scripts/programmi.py e non va modificato a mano.

const PROGRAMMI_JSON_URL = (() => {
    try {
        const currentScript = document.currentScript;
        if (currentScript) {
            const scriptUrl = new URL(currentScript.src, window.location.href);
            scriptUrl.pathname = scriptUrl.pathname.replace(/[^\/]+$/, 'programmi.json');
            scriptUrl.search = '';
            scriptUrl.hash = '';
            return scriptUrl.toString();
        }
    } catch (error) {
        console.warn('Impossibile determinare il percorso di programmi.json:', error);
    }
    return 'programmi.json';
})();

const stato = {
    dati: null,
    vista: 'contenuti',
    anno: '',
    ricerca: '',
    mostraCompetenze: false
};

document.addEventListener('DOMContentLoaded', caricaProgrammi);

async function caricaProgrammi() {
    const contenitore = document.getElementById('prog-lista');
    if (!contenitore) {
        return;
    }

    try {
        const risposta = await fetch(PROGRAMMI_JSON_URL, { cache: 'no-cache' });
        if (!risposta.ok) {
            throw new Error(`HTTP ${risposta.status}`);
        }
        stato.dati = await risposta.json();
    } catch (errore) {
        console.error('Errore nel caricamento di programmi.json:', errore);
        contenitore.innerHTML = '<div class="empty-state"><p>Non è stato possibile caricare i programmi.</p>'
            + '<p>Riprova più tardi o ricarica la pagina.</p></div>';
        return;
    }

    preparaLivelli();
    preparaImpianto();
    preparaControlli();
    disegnaLista();
}

/* ---------- livelli QNQ ---------- */

function preparaLivelli() {
    const contenitore = document.getElementById('prog-livelli-lista');
    const anni = stato.dati.meta.anni;
    contenitore.innerHTML = anni.map((anno) => schedaLivello(anno, stato.dati.livelliQNQ[anno])).join('');

    const dataVerifica = document.getElementById('prog-verifica-data');
    if (dataVerifica) {
        dataVerifica.textContent = 'Riferimenti normativi verificati il '
            + formattaData(stato.dati.meta.verificaNormativa)
            + '. Pagina aggiornata il ' + formattaData(stato.dati.meta.aggiornato) + '.';
    }
}

function schedaLivello(anno, scheda) {
    const ufficiale = scheda.ufficiale.transizione
        ? blocchiTransizione(scheda.ufficiale)
        : blocchiDescrittore(scheda.ufficiale);

    const op = scheda.operativo;
    const prove = scheda.proveEsperte;

    return `
    <details class="prog-qnq-scheda" id="qnq-${slug(anno)}">
      <summary>
        <span class="prog-qnq-badge">QNQ ${escapeHtml(scheda.livello)}</span>
        <span class="prog-qnq-anno">${escapeHtml(anno)}</span>
        <span class="prog-qnq-sintesi">${escapeHtml(scheda.sintesi)}</span>
      </summary>
      <div class="prog-qnq-corpo">
        <div class="prog-qnq-verbatim">
          <p class="prog-etichetta">Testo normativo — Tabella A del D.I. 8 gennaio 2018</p>
          ${ufficiale}
        </div>
        <div class="prog-qnq-derivato">
          <p class="prog-etichetta">Lettura operativa e taratura delle prove — proposta didattica, non testo normativo</p>
          <dl class="prog-dl">
            <dt>Contesto</dt><dd>${escapeHtml(op.contesto)}</dd>
            <dt>Supervisione</dt><dd>${escapeHtml(op.supervisione)}</dd>
            <dt>Chi decide il metodo</dt><dd>${escapeHtml(op.decisione)}</dd>
            <dt>Responsabilità sul risultato</dt><dd>${escapeHtml(op.responsabilita)}</dd>
            <dt>Consegna della prova</dt><dd>${escapeHtml(prove.consegna)}</dd>
            <dt>Imprevisto</dt><dd>${escapeHtml(prove.imprevisto)}</dd>
            <dt>Ruolo nel gruppo</dt><dd>${escapeHtml(prove.ruoloGruppo)}</dd>
            <dt>Che cosa si valuta</dt><dd>${escapeHtml(prove.valutazione)}</dd>
          </dl>
          ${prove.differenzaConSecondoAnno
            ? `<p class="small-note">${escapeHtml(prove.differenzaConSecondoAnno)}</p>`
            : ''}
        </div>
      </div>
    </details>`;
}

function blocchiDescrittore(descrittore) {
    return `
      <dl class="prog-dl">
        <dt>Conoscenze</dt><dd>«${escapeHtml(descrittore.conoscenze)}»</dd>
        <dt>Abilità</dt><dd>«${escapeHtml(descrittore.abilita)}»<br><em>Tipicamente: ${escapeHtml(descrittore.tipicamente)}</em></dd>
        <dt>Autonomia e responsabilità</dt><dd>«${escapeHtml(descrittore.autonomiaResponsabilita)}»</dd>
      </dl>`;
}

function blocchiTransizione(ufficiale) {
    return `
      <p class="small-note">La Tabella A non ha una riga per il livello 3-4: il quarto anno è la fase di
         transizione fra i due livelli, che vengono qui riportati entrambi.</p>
      <p class="prog-sotto-titolo">Livello 3</p>
      ${blocchiDescrittore(ufficiale.livello3)}
      <p class="prog-sotto-titolo">Livello 4</p>
      ${blocchiDescrittore(ufficiale.livello4)}
      <blockquote class="prog-citazione">
        ${ufficiale.citazioni.map((c) => `<p>«${escapeHtml(c)}»</p>`).join('')}
        <cite>Linee guida per i nuovi istituti professionali, Parte seconda</cite>
      </blockquote>`;
}

/* ---------- impianto didattico ---------- */

function preparaImpianto() {
    const contenitore = document.getElementById('prog-impianto');
    const imp = stato.dati.impiantoDidattico;
    contenitore.innerHTML = `
      <details class="prog-qnq-scheda">
        <summary>
          <span class="prog-qnq-anno">Impianto didattico e valutativo</span>
          <span class="prog-qnq-sintesi">Metodologia, strumenti, verifiche e criteri di valutazione</span>
        </summary>
        <div class="prog-qnq-corpo">
          <p class="prog-sotto-titolo">Metodologia</p>
          <p>${escapeHtml(imp.metodologia)}</p>
          <p class="prog-sotto-titolo">Strumenti</p>
          <ul>${imp.strumenti.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
          <p class="prog-sotto-titolo">Strumenti e tecniche di verifica</p>
          <ul>${imp.verifiche.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}</ul>
          <p class="prog-sotto-titolo">Criteri e modalità di valutazione</p>
          <p>${escapeHtml(imp.valutazione)}</p>
          <ul>${imp.elementiTrasversali.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
          <p class="prog-sotto-titolo">Riferimenti</p>
          <ul>${imp.riferimenti.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
        </div>
      </details>`;
}

/* ---------- controlli ---------- */

function preparaControlli() {
    const selettoreAnno = document.getElementById('prog-filtro-anno');
    stato.dati.meta.anni.forEach((anno) => {
        const opzione = document.createElement('option');
        opzione.value = anno;
        opzione.textContent = anno;
        selettoreAnno.appendChild(opzione);
    });

    // Le pagine dell'anno linkano qui con ?anno=Primo%20anno: si apre già filtrata.
    const annoRichiesto = new URLSearchParams(window.location.search).get('anno');
    if (annoRichiesto && stato.dati.meta.anni.includes(annoRichiesto)) {
        stato.anno = annoRichiesto;
        selettoreAnno.value = annoRichiesto;
    }

    document.getElementById('prog-mostra-competenze').addEventListener('change', (evento) => {
        stato.mostraCompetenze = evento.target.checked;
        document.getElementById('prog-contatori').hidden = !stato.mostraCompetenze;
        disegnaLista();
    });

    document.querySelectorAll('.prog-toggle .tab-btn').forEach((bottone) => {
        bottone.addEventListener('click', () => {
            document.querySelectorAll('.prog-toggle .tab-btn').forEach((b) => b.classList.remove('active'));
            bottone.classList.add('active');
            stato.vista = bottone.dataset.vista;
            disegnaLista();
        });
    });

    selettoreAnno.addEventListener('change', (evento) => {
        stato.anno = evento.target.value;
        disegnaLista();
    });

    document.getElementById('prog-cerca').addEventListener('input', (evento) => {
        stato.ricerca = evento.target.value.trim().toLowerCase();
        disegnaLista();
    });

}

/* ---------- selezione dei dati ---------- */

function corrispondeRicerca(modulo) {
    if (!stato.ricerca) {
        return true;
    }
    const prova = modulo.provaEsperta || {};
    const testo = [
        modulo.titolo,
        modulo.sintesi || '',
        (modulo.contenuti || []).map((c) => c.attivita).join(' '),
        prova.titolo || '',
        prova.compito || '',
        prova.prodotto || ''
    ].join(' ').toLowerCase();
    return testo.includes(stato.ricerca);
}

function traguardo(periodo, competenza) {
    return stato.dati.curricolo.find((t) => t.periodo === periodo && t.competenza === competenza);
}

function anniVisibili() {
    return stato.dati.meta.anni.filter((anno) => !stato.anno || anno === stato.anno);
}

/* ---------- lista ---------- */

function disegnaLista() {
    const contenitore = document.getElementById('prog-lista');
    const moduli = stato.dati.moduli.filter(corrispondeRicerca);
    aggiornaContatori(stato.dati.moduli);

    const html = stato.vista === 'competenza'
        ? disegnaPerCompetenza(moduli)
        : disegnaPerContenuti(moduli);

    contenitore.innerHTML = html
        || '<div class="empty-state"><p>Nessun modulo corrisponde alla ricerca.</p>'
        + '<p>Prova con un altro termine o azzera il filtro.</p></div>';
}

function disegnaPerCompetenza(moduli) {
    const competenze = [...new Set(stato.dati.curricolo.map((t) => t.competenza))]
        .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

    return competenze.map((competenza) => {
        const primo = stato.dati.curricolo.find((t) => t.competenza === competenza);
        const carte = anniVisibili().map((anno) => {
            const scheda = stato.dati.livelliQNQ[anno];
            const trg = traguardo(scheda.periodo, competenza);
            if (!trg) {
                return '';
            }
            const suoi = moduli.filter((m) => m.anno === anno && m.competenze.includes(competenza));
            return cartaCompetenza(trg, anno, scheda, suoi, competenza);
        }).filter(Boolean).join('');

        if (!carte) {
            return '';
        }

        return `
        <section class="prog-gruppo" id="${slug(competenza)}">
          <h3 class="prog-gruppo-titolo">Competenza ${competenza.slice(1)}</h3>
          <p class="prog-gruppo-sottotitolo">${escapeHtml(primo.competenzaTitolo)}</p>
          ${carte}
        </section>`;
    }).join('');
}

// Vista principale: i contenuti da trattare, anno per anno, modulo dopo modulo.
function disegnaPerContenuti(moduli) {
    return anniVisibili().map((anno) => {
        const scheda = stato.dati.livelliQNQ[anno];
        const suoi = moduli
            .filter((m) => m.anno === anno)
            .sort((a, b) => a.n - b.n || (a.suffisso ? 1 : -1));

        let notaAlternativaInserita = false;
        const corpo = suoi.length
            ? suoi.map((m) => {
                const coinvoltoInAlternativa = m.alternativoA !== undefined || haPercorsoAlternativo(m);
                const numeroAlternativa = m.alternativoA ?? m.n;
                const percorsiVisibili = suoi.filter(
                    (voce) => (voce.alternativoA ?? voce.n) === numeroAlternativa
                        && (voce.alternativoA !== undefined || haPercorsoAlternativo(voce))
                ).length;
                const nota = coinvoltoInAlternativa && !notaAlternativaInserita
                    ? notaPercorsiAlternativi(numeroAlternativa, percorsiVisibili > 1)
                    : '';
                if (coinvoltoInAlternativa) {
                    notaAlternativaInserita = true;
                }
                return nota + schedaModulo(m, anno);
            }).join('')
            : '<div class="prog-vuoto">Nessuna UDA ancora proposta per questo anno.</div>';

        const udaDistinte = new Set(suoi.map((m) => m.alternativoA ?? m.n)).size;
        const alternative = suoi.filter((m) => m.alternativoA !== undefined).length;
        const conteggio = `${udaDistinte} UDA${alternative ? ` · ${alternative} alternativa` : ''}`;

        return `
        <section class="prog-gruppo" id="${slug(anno)}">
          <div class="prog-anno-testata">
            <h3 class="prog-gruppo-titolo">${escapeHtml(anno)}</h3>
            <a class="prog-qnq-badge prog-qnq-link" href="#qnq-${slug(anno)}"
               title="${escapeHtml(scheda.sintesi)}">QNQ ${escapeHtml(scheda.livello)}</a>
            <span class="prog-anno-conteggio">${conteggio}</span>
          </div>
          <p class="prog-gruppo-sottotitolo">${escapeHtml(scheda.sintesi)}</p>
          <div class="prog-elenco-moduli">${corpo}</div>
        </section>`;
    }).join('');
}

function haPercorsoAlternativo(modulo) {
    return stato.dati.moduli.some(
        (m) => m.anno === modulo.anno && m.alternativoA === modulo.n
    );
}

function notaPercorsiAlternativi(numero, entrambiVisibili) {
    const spiegazione = entrambiVisibili
        ? `Sono presentate entrambe le proposte, ${escapeHtml(numero)}A e ${escapeHtml(numero)}B: nella programmazione se ne sceglie una.`
        : 'Questa UDA prevede due proposte alternative; il filtro mostra soltanto quella corrispondente.';
    return `
    <aside class="prog-percorsi-nota">
      <strong>UDA ${escapeHtml(numero)} · due percorsi alternativi</strong>
      <span>${spiegazione}</span>
    </aside>`;
}

function cartaCompetenza(trg, anno, scheda, moduli, competenza) {
    const compresenza = trg.conoscenze.some((c) => c.compresenzaScienzeUmane);
    const aperto = stato.ricerca ? ' open' : '';

    const abilita = trg.abilita.length
        ? `<ul>${trg.abilita.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`
        : '<p class="muted">Nessuna abilità elencata per questo traguardo.</p>';

    const conoscenze = trg.conoscenze.length
        ? `<ul>${trg.conoscenze.map((c) => `<li>${escapeHtml(c.nome)}`
            + (c.compresenzaScienzeUmane ? ' <span class="prog-tag-compresenza">in compresenza</span>' : '')
            + '</li>').join('')}</ul>`
        : '<p class="muted">Nel curricolo questa competenza non è presidiata da Metodologie Operative in questo periodo.</p>';

    const corpo = moduli.length
        ? moduli.map((m) => schedaModulo(m, anno)).join('')
        : '<div class="prog-vuoto">Nessuna UDA ancora proposta per questa competenza.</div>';

    return `
    <details class="prog-card"${aperto}>
      <summary class="prog-card-testata">
        <span class="prog-qnq-badge">QNQ ${escapeHtml(scheda.livello)}</span>
        <span class="prog-card-anno">${escapeHtml(anno)}</span>
        ${compresenza ? '<span class="prog-tag-compresenza">in compresenza con Scienze umane</span>' : ''}
        <span class="prog-intermedia">${escapeHtml(trg.competenzaIntermedia)}</span>
      </summary>
      <div class="prog-card-corpo">
        <div class="prog-colonne">
          <div>
            <p class="prog-sotto-titolo">Abilità</p>
            ${abilita}
          </div>
          <div>
            <p class="prog-sotto-titolo">Conoscenze · ${trg.conoscenze.length}</p>
            ${conoscenze}
          </div>
        </div>
        <div class="prog-moduli">${corpo}</div>
      </div>
    </details>`;
}

function schedaModulo(modulo, anno) {
    const haAlternativa = haPercorsoAlternativo(modulo);
    const numero = modulo.alternativoA !== undefined
        ? `${modulo.alternativoA}B`
        : haAlternativa
            ? `${modulo.n}A`
            : modulo.n + (modulo.suffisso ? ' ' + modulo.suffisso : '');
    const percorso = modulo.alternativoA !== undefined
        ? '<span class="prog-tag-alt">percorso B · alternativo</span>'
        : haAlternativa
            ? '<span class="prog-tag-alt">percorso A</span>'
            : '';
    const aperto = stato.ricerca ? ' open' : '';

    // I riferimenti al curricolo compaiono solo se l'utente li chiede.
    const attivita = (modulo.contenuti || []).map((c) => {
        if (!stato.mostraCompetenze) {
            return `<li>${escapeHtml(c.attivita)}</li>`;
        }
        if (c.aggancio === 'trasversale') {
            return `<li>${escapeHtml(c.attivita)}
              <span class="prog-tag-trasversale">trasversale</span>
              <span class="prog-nota">${escapeHtml(c.nota || '')}</span></li>`;
        }
        const codici = (c.agganci || []).map((a) => a.competenza).join(' · ');
        return `<li>${escapeHtml(c.attivita)}
          <span class="prog-tag-aggancio">${escapeHtml(codici)}</span></li>`;
    }).join('');

    const norme = (modulo.riferimentiNormativi || []).length
        ? `<details class="prog-norme">
             <summary>Riferimenti normativi del modulo</summary>
             <ul>${modulo.riferimentiNormativi.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
             ${modulo.verificaNormativa
                ? `<p class="small-note">Verificati il ${formattaData(modulo.verificaNormativa)}.</p>` : ''}
           </details>`
        : '';

    const meta = [
        modulo.periodo ? `<span class="prog-meta-voce"><span class="prog-meta-et">Periodo</span>${escapeHtml(modulo.periodo)}</span>` : '',
        modulo.monteOre ? `<span class="prog-meta-voce"><span class="prog-meta-et">Ore</span>${escapeHtml(modulo.monteOre)}</span>` : '',
        modulo.compresenza ? `<span class="prog-meta-voce"><span class="prog-meta-et">Compresenza</span>${escapeHtml(modulo.compresenza)}</span>` : ''
    ].filter(Boolean).join('');

    const fasi = (modulo.fasi || []).length
        ? `<div class="prog-fasi">
             <p class="prog-blocco-et">Fasi di lavoro</p>
             <ol>${modulo.fasi.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ol>
           </div>`
        : '';

    const prodotto = modulo.prodottoFinale
        ? `<p class="prog-prodotto"><span class="prog-prodotto-et">Prodotto finale</span>
             ${escapeHtml(modulo.prodottoFinale)}</p>`
        : '';

    return `
    <details class="prog-modulo"${aperto}>
      <summary class="prog-modulo-testata">
        <span class="prog-modulo-titolo"><span class="prog-uda-num">UDA ${escapeHtml(String(numero))}</span>
          ${escapeHtml(modulo.titolo)} ${percorso}</span>
        ${meta ? `<span class="prog-modulo-meta">${meta}</span>` : ''}
      </summary>
      <div class="prog-modulo-corpo">
        ${modulo.sintesi ? `<p class="prog-modulo-sintesi">${escapeHtml(modulo.sintesi)}</p>` : ''}
        ${prodotto}
        <div class="prog-blocco">
          <p class="prog-blocco-et">Contenuti e attività</p>
          <ul class="prog-attivita">${attivita}</ul>
        </div>
        ${fasi}
        ${norme}
        ${schedaProva(modulo.provaEsperta)}
        ${schedaMateriali(modulo.materiali)}
        ${stato.mostraCompetenze ? riepilogoCompetenze(modulo, anno) : ''}
      </div>
    </details>`;
}

// Elenco delle competenze che il modulo intercetta, con il traguardo dell'anno.
function riepilogoCompetenze(modulo, anno) {
    if (!anno || !modulo.competenze.length) {
        return '';
    }
    const periodo = stato.dati.livelliQNQ[anno].periodo;
    const voci = modulo.competenze.map((codice) => {
        const trg = traguardo(periodo, codice);
        if (!trg) {
            return '';
        }
        const compresenza = trg.conoscenze.some((c) => c.compresenzaScienzeUmane)
            ? ' <span class="prog-tag-compresenza">in compresenza</span>' : '';
        return `<li><span class="prog-tag-competenza">${escapeHtml(codice)}</span>
                ${escapeHtml(trg.competenzaIntermedia)}${compresenza}</li>`;
    }).filter(Boolean).join('');

    return `
    <details class="prog-competenze-modulo">
      <summary>Competenze di indirizzo intercettate (${modulo.competenze.length})</summary>
      <ul>${voci}</ul>
    </details>`;
}

function schedaProva(prova) {
    if (!prova) {
        return '';
    }
    return `
    <div class="prog-prova">
      <p class="prog-prova-etichetta">Prova esperta di laboratorio</p>
      <p class="prog-prova-titolo">${escapeHtml(prova.titolo)}</p>
      <dl class="prog-dl">
        <dt>Compito</dt><dd>${escapeHtml(prova.compito)}</dd>
        <dt>Contesto</dt><dd>${escapeHtml(prova.contesto)}</dd>
        <dt>Prodotto</dt><dd>${escapeHtml(prova.prodotto)}</dd>
        <dt>Durata e modalità</dt><dd>${escapeHtml(prova.durata)} — ${escapeHtml(prova.modalita)}</dd>
        <dt>Risorse</dt><dd>${prova.risorse.map(escapeHtml).join(' · ')}</dd>
        ${prova.imprevisto
          ? `<dt>Imprevisto</dt><dd>${escapeHtml(prova.imprevisto)}</dd>`
          : '<dt>Imprevisto</dt><dd class="muted">Nessuno: al livello 2 il compito resta quello annunciato.</dd>'}
        <dt>Che cosa si valuta</dt><dd>${prova.evidenze.map(escapeHtml).join(' · ')}</dd>
      </dl>
    </div>`;
}

function schedaMateriali(materiali) {
    const voci = materiali || [];
    const corpo = voci.length
        ? voci.map((m) => `<a class="prog-materiale" href="${escapeHtml(m.file)}">${escapeHtml(m.titolo)}</a>`).join('')
        : '<span class="prog-materiale-vuoto">da collegare</span>';
    return `<div class="prog-materiali"><span class="prog-materiali-etichetta">Materiali</span>${corpo}</div>`;
}

/* ---------- contatori ---------- */

function aggiornaContatori(moduli) {
    const contenitore = document.getElementById('prog-contatori');
    const righe = anniVisibili().map((anno) => {
        const scheda = stato.dati.livelliQNQ[anno];
        const attive = stato.dati.curricolo.filter((t) => t.periodo === scheda.periodo).length;
        const coperte = new Set();
        moduli.filter((m) => m.anno === anno).forEach((m) => m.competenze.forEach((c) => coperte.add(c)));
        return `<span class="prog-contatore"><strong>${escapeHtml(anno)}</strong>
                  ${coperte.size}/${attive} competenze con moduli</span>`;
    });
    contenitore.innerHTML = righe.join('');
}

/* ---------- utilita' ---------- */

function escapeHtml(valore) {
    return String(valore ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function slug(valore) {
    return String(valore).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formattaData(iso) {
    if (!iso) {
        return '';
    }
    const [anno, mese, giorno] = iso.split('-');
    const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
        'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    return `${Number(giorno)} ${mesi[Number(mese) - 1]} ${anno}`;
}
