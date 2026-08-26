const SUPABASE_URL = 'https://ruplzgcnheddmqqdephp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cGx6Z2NuaGVkZG1xcWRlcGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTYyMjksImV4cCI6MjA3NTY5MjIyOX0.tOLIkgi5yTt61_0rMlXUqxnbil4DLD7kBaqZBVAv1CI';
const REVISION_API = `${SUPABASE_URL}/functions/v1/programmi-revisioni`;
const SESSION_KEY = 'mo:programmi-revisione-session';
const IDENTITY_KEY = 'mo:programmi-revisione-identita';
const CHIAVE_NOTA_GENERALE = 'pagina-programmi';
const EDITORI = ['Salvatore', 'Pierluigi'];

const GRUPPI_CAMPI = [
    {
        titolo: 'Dati essenziali',
        aperto: true,
        campi: [
            campo('titolo', 'Titolo', 'testo'),
            campo('sintesi', 'Sintesi', 'testo-lungo'),
            campo('periodo', 'Periodo', 'testo'),
            campo('monteOre', 'Monte ore', 'testo'),
            campo('prodottoFinale', 'Prodotto finale', 'testo-lungo')
        ]
    },
    {
        titolo: 'Contenuti e fasi di lavoro',
        aperto: true,
        campi: [
            campo('contenuti', 'Contenuti e attività', 'lista', (modulo) =>
                (modulo.contenuti || []).map((voce) => voce.attivita)),
            campo('fasi', 'Fasi di lavoro', 'lista')
        ]
    },
    {
        titolo: 'Prova esperta di laboratorio',
        aperto: false,
        campi: [
            campo('provaEsperta.titolo', 'Titolo della prova', 'testo'),
            campo('provaEsperta.compito', 'Compito', 'testo-lungo'),
            campo('provaEsperta.contesto', 'Contesto', 'testo-lungo'),
            campo('provaEsperta.prodotto', 'Prodotto', 'testo-lungo'),
            campo('provaEsperta.durata', 'Durata', 'testo'),
            campo('provaEsperta.modalita', 'Modalità', 'testo'),
            campo('provaEsperta.risorse', 'Risorse', 'lista'),
            campo('provaEsperta.imprevisto', 'Imprevisto', 'testo-lungo'),
            campo('provaEsperta.evidenze', 'Che cosa si valuta', 'lista')
        ]
    }
];

const ETICHETTE_CAMPI = new Map(
    GRUPPI_CAMPI.flatMap((gruppo) => gruppo.campi.map((voce) => [voce.chiave, voce.etichetta]))
);

const stato = {
    token: '',
    editorName: '',
    editorAutorizzato: false,
    datiProgrammi: null,
    moduli: new Map(),
    revisioni: new Map(),
    moduloAttivo: null,
    notaGeneraleAttiva: false
};

const ui = {};

document.addEventListener('DOMContentLoaded', inizializza);

async function inizializza() {
    raccogliElementi();
    collegaEventi();
    const autorizzata = await ripristinaSessione();
    if (autorizzata) {
        await attivaAreaRiservata();
    } else {
        mostraBloccoPagina();
    }
}

function campo(chiave, etichetta, tipo, lettore = null) {
    return { chiave, etichetta, tipo, lettore };
}

function raccogliElementi() {
    ui.accesso = document.getElementById('prog-accesso-revisione');
    ui.toolbar = document.getElementById('prog-revisione-toolbar');
    ui.identita = document.getElementById('prog-revisione-identita');
    ui.contatore = document.getElementById('prog-revisione-contatore');
    ui.notaGenerale = document.getElementById('prog-annotazione-generale');
    ui.vediAnnotazioni = document.getElementById('prog-vedi-annotazioni');
    ui.esci = document.getElementById('prog-esci-revisione');

    ui.authDialog = document.getElementById('prog-auth-dialog');
    ui.authForm = document.getElementById('prog-auth-form');
    ui.authPassword = document.getElementById('prog-auth-password');
    ui.authNames = [...document.querySelectorAll('input[name="editor-name"]')];
    ui.authMessaggio = document.getElementById('prog-auth-messaggio');

    ui.editorDialog = document.getElementById('prog-editor-dialog');
    ui.editorForm = document.getElementById('prog-editor-form');
    ui.editorEyebrow = document.getElementById('prog-editor-eyebrow');
    ui.editorTitolo = document.getElementById('prog-editor-title');
    ui.editorSottotitolo = document.getElementById('prog-editor-sottotitolo');
    ui.editorAvviso = document.getElementById('prog-editor-avviso');
    ui.editorCampi = document.getElementById('prog-editor-campi');
    ui.editorNota = document.getElementById('prog-editor-nota-generale');
    ui.editorMessaggio = document.getElementById('prog-editor-messaggio');

    ui.elencoDialog = document.getElementById('prog-elenco-dialog');
    ui.elencoAnno = document.getElementById('prog-elenco-anno');
    ui.elencoStato = document.getElementById('prog-elenco-stato');
    ui.elencoAutore = document.getElementById('prog-elenco-autore');
    ui.elencoMessaggio = document.getElementById('prog-elenco-messaggio');
    ui.elencoContenuto = document.getElementById('prog-elenco-contenuto');
    ui.esporta = document.getElementById('prog-esporta-annotazioni');
}

function collegaEventi() {
    ui.accesso?.addEventListener('click', apriAccesso);
    ui.authForm?.addEventListener('submit', eseguiAccesso);
    ui.esci?.addEventListener('click', eseguiUscita);
    ui.notaGenerale?.addEventListener('click', () => apriEditorNotaGenerale());
    ui.vediAnnotazioni?.addEventListener('click', apriElenco);
    ui.editorForm?.addEventListener('submit', salvaBozza);
    ui.elencoAnno?.addEventListener('change', disegnaElenco);
    ui.elencoStato?.addEventListener('change', disegnaElenco);
    ui.elencoAutore?.addEventListener('change', disegnaElenco);
    ui.esporta?.addEventListener('click', esportaMarkdown);

    document.addEventListener('click', (evento) => {
        const chiudi = evento.target.closest('[data-prog-dialog-close]');
        if (chiudi) {
            chiudi.closest('dialog')?.close();
            return;
        }

        const azione = evento.target.closest('[data-programmi-revisione-azione]');
        if (azione) {
            apriEditorModulo(azione.dataset.programmiRevisioneAzione);
        }
    });

    document.querySelectorAll('.prog-dialog').forEach((dialogo) => {
        dialogo.addEventListener('click', (evento) => {
            if (evento.target === dialogo && dialogo !== ui.authDialog) {
                dialogo.close();
            }
        });
    });

    ui.authDialog?.addEventListener('cancel', (evento) => {
        if (document.body.dataset.programmiLocked === 'true') {
            evento.preventDefault();
        }
    });

    document.addEventListener('mo:programmi-rendered', aggiornaIndicatoriUDA);
}

async function caricaProgrammi() {
    try {
        const url = new URL('../programmi.json', import.meta.url);
        url.search = '';
        const risposta = await fetch(url, { cache: 'no-cache' });
        if (!risposta.ok) {
            throw new Error(`HTTP ${risposta.status}`);
        }
        stato.datiProgrammi = await risposta.json();
        stato.moduli.clear();
        (stato.datiProgrammi.moduli || []).forEach((modulo) => {
            stato.moduli.set(chiaveModulo(modulo, stato.datiProgrammi.moduli), modulo);
        });
        popolaFiltroAnni();
    } catch (errore) {
        console.error('Impossibile preparare l’area di revisione:', errore);
        ui.accesso?.setAttribute('disabled', '');
        ui.accesso && (ui.accesso.textContent = 'Revisione non disponibile');
    }
}

async function ripristinaSessione() {
    const token = sessionStorage.getItem(SESSION_KEY) || '';
    const editorName = sessionStorage.getItem(IDENTITY_KEY) || '';
    if (!token || !EDITORI.includes(editorName)) {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(IDENTITY_KEY);
        impostaModalitaEditor(false);
        return false;
    }
    stato.token = token;
    stato.editorName = editorName;
    try {
        const data = await chiamaApi('session');
        if (data.author_name !== editorName) throw new Error('Identità della sessione non valida.');
        impostaModalitaEditor(true);
        return true;
    } catch {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(IDENTITY_KEY);
        impostaModalitaEditor(false);
        return false;
    }
}

function apriAccesso() {
    if (stato.editorAutorizzato) {
        ui.toolbar?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    messaggio(ui.authMessaggio, '');
    ui.authPassword.value = '';
    ui.authDialog.showModal();
    window.setTimeout(() => ui.authPassword.focus(), 50);
}

async function eseguiAccesso(evento) {
    evento.preventDefault();
    const editorName = ui.authNames.find((input) => input.checked)?.value || '';
    if (!EDITORI.includes(editorName)) {
        messaggio(ui.authMessaggio, 'Scegli chi sta lavorando.', 'errore');
        return;
    }
    const bottone = ui.authForm.querySelector('button[type="submit"]');
    bottone.disabled = true;
    messaggio(ui.authMessaggio, 'Verifica delle credenziali…');

    try {
        const data = await chiamaApi('login', {
            password: ui.authPassword.value,
            author_name: editorName
        }, { senzaSessione: true });
        ui.authPassword.value = '';
        if (!data.token) throw new Error('Accesso non riuscito.');
        stato.token = data.token;
        stato.editorName = data.author_name;
        sessionStorage.setItem(SESSION_KEY, data.token);
        sessionStorage.setItem(IDENTITY_KEY, data.author_name);
        impostaModalitaEditor(true);
        await attivaAreaRiservata();

        messaggio(ui.authMessaggio, 'Accesso completato.', 'successo');
    } catch (errore) {
        messaggio(ui.authMessaggio, errore.message || 'Accesso non riuscito.', 'errore');
    } finally {
        bottone.disabled = false;
    }
}

function impostaModalitaEditor(attiva) {
    stato.editorAutorizzato = Boolean(attiva);
    if (!attiva) {
        stato.token = '';
        stato.editorName = '';
        stato.revisioni.clear();
    }
    document.body.toggleAttribute('data-programmi-editor', Boolean(attiva));
    if (attiva) {
        document.body.setAttribute('data-programmi-editor', 'true');
    }
    ui.toolbar.hidden = !attiva;
    ui.accesso.hidden = Boolean(attiva);
    ui.identita.textContent = attiva ? `${stato.editorName} · linea di revisione personale` : '';
    aggiornaContatore();
    aggiornaIndicatoriUDA();
}

async function eseguiUscita() {
    ui.esci.disabled = true;
    try {
        await chiamaApi('logout');
    } catch {
        // La sessione locale viene rimossa anche se il server non è raggiungibile.
    }
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(IDENTITY_KEY);
    impostaModalitaEditor(false);
    mostraBloccoPagina();
    ui.esci.disabled = false;
}

async function attivaAreaRiservata() {
    document.body.dataset.programmiLocked = 'false';
    if (ui.authDialog?.open) ui.authDialog.close();
    document.dispatchEvent(new CustomEvent('mo:programmi-unlocked'));
    await Promise.all([caricaProgrammi(), caricaRevisioni()]);
}

function mostraBloccoPagina() {
    document.body.dataset.programmiLocked = 'true';
    document.body.removeAttribute('data-programmi-editor');
    messaggio(ui.authMessaggio, '');
    ui.authPassword.value = '';
    if (!ui.authDialog.open) ui.authDialog.showModal();
    window.setTimeout(() => ui.authPassword.focus(), 50);
}

async function caricaRevisioni() {
    if (!stato.editorAutorizzato) return;
    try {
        const data = await chiamaApi('list');
        stato.revisioni = new Map((data.revisions || []).map((voce) => [chiaveRevisione(voce.module_key, voce.author_name), voce]));
    } catch (errore) {
        console.error('Impossibile caricare le revisioni:', errore.message);
        return;
    }
    aggiornaContatore();
    aggiornaIndicatoriUDA();
}

function aggiornaContatore() {
    if (!ui.contatore) return;
    const attive = [...stato.revisioni.values()].filter((voce) => voce.stato !== 'archiviata');
    ui.contatore.textContent = String(attive.length);
}

function aggiornaIndicatoriUDA() {
    document.querySelectorAll('[data-programmi-revisione-stato]').forEach((badge) => {
        const revisioni = revisioniModulo(badge.dataset.programmiRevisioneStato)
            .filter((voce) => voce.stato !== 'archiviata');
        badge.hidden = revisioni.length === 0;
        badge.textContent = revisioni.length > 1
            ? `${revisioni.length} proposte`
            : revisioni.length === 1
                ? `${revisioni[0].author_name} · ${etichettaStato(revisioni[0].stato)}`
                : '';
    });
}

function apriEditorModulo(chiave) {
    if (!stato.editorAutorizzato) {
        apriAccesso();
        return;
    }
    const modulo = stato.moduli.get(chiave);
    if (!modulo) {
        return;
    }
    stato.moduloAttivo = modulo;
    stato.notaGeneraleAttiva = false;
    preparaEditor(chiave, modulo);
}

function apriEditorNotaGenerale() {
    if (!stato.editorAutorizzato) return;
    stato.moduloAttivo = null;
    stato.notaGeneraleAttiva = true;
    preparaEditor(CHIAVE_NOTA_GENERALE, null);
}

function preparaEditor(chiave, modulo) {
    const revisione = revisionePersonale(chiave);
    ui.editorForm.dataset.moduleKey = chiave;
    ui.editorCampi.replaceChildren();
    ui.editorAvviso.hidden = true;
    messaggio(ui.editorMessaggio, '');

    if (!modulo) {
        ui.editorEyebrow.textContent = 'Revisione della pagina';
        ui.editorTitolo.textContent = 'Annotazione generale';
        ui.editorSottotitolo.textContent = 'Nota non collegata a una singola UDA';
        ui.editorCampi.hidden = true;
    } else {
        ui.editorEyebrow.textContent = `${modulo.anno} · UDA ${numeroModulo(modulo, stato.datiProgrammi.moduli)}`;
        ui.editorTitolo.textContent = modulo.titolo;
        ui.editorSottotitolo.textContent = 'Il testo originale resta pubblico finché la bozza non viene applicata ai file sorgente.';
        ui.editorCampi.hidden = false;
        GRUPPI_CAMPI.forEach((gruppo) => ui.editorCampi.appendChild(creaGruppoCampi(gruppo, modulo, revisione)));

        const snapshotAttuale = creaSnapshot(modulo);
        if (revisione && snapshotDifferente(revisione.originale || {}, snapshotAttuale)) {
            ui.editorAvviso.hidden = false;
            ui.editorAvviso.textContent = 'Le modifiche salvate qui restano in bozza e non cambiano il contenuto pubblico. Il testo verrà modificato nel codice solo dopo una decisione condivisa.';
        }
    }

    ui.editorNota.value = revisione?.nota_generale || '';
    ui.editorDialog.showModal();
}

function creaGruppoCampi(gruppo, modulo, revisione) {
    const details = document.createElement('details');
    details.className = 'prog-editor-gruppo';
    details.open = gruppo.aperto;

    const summary = document.createElement('summary');
    summary.textContent = gruppo.titolo;
    details.appendChild(summary);

    const corpo = document.createElement('div');
    corpo.className = 'prog-editor-gruppo-corpo';
    gruppo.campi.forEach((definizione) => corpo.appendChild(creaCampo(definizione, modulo, revisione)));
    details.appendChild(corpo);
    return details;
}

function creaCampo(definizione, modulo, revisione) {
    const originale = leggiCampo(modulo, definizione);
    const propostaSalvata = revisione?.modifiche && Object.hasOwn(revisione.modifiche, definizione.chiave)
        ? revisione.modifiche[definizione.chiave]
        : originale;

    const contenitore = document.createElement('section');
    contenitore.className = 'prog-rev-campo';
    contenitore.dataset.chiave = definizione.chiave;
    contenitore.dataset.tipo = definizione.tipo;

    const intestazione = document.createElement('div');
    intestazione.className = 'prog-rev-campo-intestazione';
    const label = document.createElement('label');
    const id = `prog-rev-${definizione.chiave.replaceAll('.', '-')}`;
    label.htmlFor = id;
    label.textContent = definizione.etichetta;
    const guida = document.createElement('span');
    guida.textContent = definizione.tipo === 'lista' ? 'Una voce per riga' : 'Originale a sinistra · proposta a destra';
    intestazione.append(label, guida);

    const originaleBox = document.createElement('div');
    originaleBox.className = 'prog-rev-originale';
    originaleBox.setAttribute('aria-label', `${definizione.etichetta}: testo originale`);
    originaleBox.textContent = formattaValore(originale);

    const input = document.createElement('textarea');
    input.id = id;
    input.name = definizione.chiave;
    input.rows = definizione.tipo === 'testo' ? 3 : definizione.tipo === 'lista' ? 7 : 5;
    input.value = formattaValore(propostaSalvata);
    input.dataset.originale = JSON.stringify(originale ?? '');
    input.addEventListener('input', () => aggiornaStatoCampo(contenitore, input));

    contenitore.append(intestazione, originaleBox, input);
    aggiornaStatoCampo(contenitore, input);
    return contenitore;
}

function aggiornaStatoCampo(contenitore, input) {
    const attuale = valoreInput(input, contenitore.dataset.tipo);
    const originale = JSON.parse(input.dataset.originale);
    contenitore.dataset.modificato = String(!valoriUguali(attuale, originale));
}

async function salvaBozza(evento) {
    evento.preventDefault();
    if (!stato.editorAutorizzato) return;

    const chiave = ui.editorForm.dataset.moduleKey;
    const modulo = stato.moduloAttivo;
    const modifiche = {};
    let originale = {};

    if (modulo) {
        originale = creaSnapshot(modulo);
        ui.editorCampi.querySelectorAll('.prog-rev-campo').forEach((contenitore) => {
            const input = contenitore.querySelector('textarea');
            const nuovoValore = valoreInput(input, contenitore.dataset.tipo);
            const valoreOriginale = originale[contenitore.dataset.chiave];
            if (!valoriUguali(nuovoValore, valoreOriginale)) {
                modifiche[contenitore.dataset.chiave] = nuovoValore;
            }
        });
    }

    const nota = ui.editorNota.value.trim();
    if (!nota && Object.keys(modifiche).length === 0) {
        messaggio(ui.editorMessaggio, 'Scrivi un’annotazione oppure modifica almeno un campo.', 'errore');
        return;
    }

    const bottone = ui.editorForm.querySelector('button[type="submit"]');
    bottone.disabled = true;
    messaggio(ui.editorMessaggio, 'Salvataggio della bozza…');

    const esistente = revisionePersonale(chiave);
    const payload = {
        module_key: chiave,
        author_name: stato.editorName,
        anno: modulo?.anno || 'Pagina generale',
        numero: modulo ? String(numeroModulo(modulo, stato.datiProgrammi.moduli)) : '',
        titolo_modulo: modulo?.titolo || 'Programmi SSAS',
        originale,
        modifiche,
        nota_generale: nota,
        stato: esistente?.stato || 'bozza',
        source_version: stato.datiProgrammi?.meta?.aggiornato || null,
        updated_at: new Date().toISOString()
    };
    try {
        const data = await chiamaApi('upsert', { revision: payload });
        stato.revisioni.set(chiaveRevisione(data.revision.module_key, data.revision.author_name), data.revision);
        aggiornaContatore();
        aggiornaIndicatoriUDA();
        messaggio(ui.editorMessaggio, 'Bozza salvata nell’area riservata.', 'successo');
        window.setTimeout(() => ui.editorDialog.close(), 550);
    } catch (errore) {
        console.error('Salvataggio bozza non riuscito:', errore.message);
        messaggio(ui.editorMessaggio, errore.message || 'Non è stato possibile salvare. Riprova tra poco.', 'errore');
    } finally {
        bottone.disabled = false;
    }
}

function creaSnapshot(modulo) {
    const snapshot = {};
    GRUPPI_CAMPI.forEach((gruppo) => gruppo.campi.forEach((definizione) => {
        snapshot[definizione.chiave] = leggiCampo(modulo, definizione);
    }));
    return snapshot;
}

function leggiCampo(modulo, definizione) {
    if (definizione.lettore) {
        return definizione.lettore(modulo);
    }
    return definizione.chiave.split('.').reduce((valore, parte) => valore?.[parte], modulo) ?? '';
}

function valoreInput(input, tipo) {
    if (tipo === 'lista') {
        return input.value.split('\n').map((voce) => voce.trim()).filter(Boolean);
    }
    return input.value.trim();
}

function formattaValore(valore) {
    return Array.isArray(valore) ? valore.join('\n') : String(valore ?? '');
}

function valoriUguali(a, b) {
    return JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
}

function snapshotDifferente(originale, attuale) {
    const chiavi = new Set([...Object.keys(originale || {}), ...Object.keys(attuale || {})]);
    return [...chiavi].some((chiave) => !valoriUguali(originale?.[chiave], attuale?.[chiave]));
}

async function apriElenco() {
    if (!stato.editorAutorizzato) return;
    messaggio(ui.elencoMessaggio, 'Aggiornamento delle annotazioni…');
    await caricaRevisioni();
    messaggio(ui.elencoMessaggio, '');
    disegnaElenco();
    ui.elencoDialog.showModal();
}

function disegnaElenco() {
    const anno = ui.elencoAnno.value;
    const statoFiltro = ui.elencoStato.value;
    const autore = ui.elencoAutore.value;
    const voci = [...stato.revisioni.values()]
        .filter((voce) => !anno || voce.anno === anno)
        .filter((voce) => !statoFiltro || voce.stato === statoFiltro)
        .filter((voce) => !autore || voce.author_name === autore)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    ui.elencoContenuto.replaceChildren();
    if (!voci.length) {
        const vuoto = document.createElement('p');
        vuoto.className = 'prog-revisione-vuoto';
        vuoto.textContent = 'Nessuna annotazione corrisponde ai filtri selezionati.';
        ui.elencoContenuto.appendChild(vuoto);
        return;
    }

    voci.forEach((voce) => ui.elencoContenuto.appendChild(creaCardRevisione(voce)));
}

function creaCardRevisione(voce) {
    const card = document.createElement('article');
    card.className = 'prog-revisione-card';
    card.dataset.stato = voce.stato;

    const testata = document.createElement('div');
    testata.className = 'prog-revisione-card-testata';
    const titoloBox = document.createElement('div');
    const titolo = document.createElement('h3');
    titolo.textContent = voce.module_key === CHIAVE_NOTA_GENERALE
        ? 'Annotazione generale della pagina'
        : `${voce.anno} · UDA ${voce.numero} — ${voce.titolo_modulo}`;
    const meta = document.createElement('p');
    meta.className = 'prog-revisione-card-meta';
    meta.textContent = `Aggiornata ${formattaDataOra(voce.updated_at)}`;
    const autore = document.createElement('span');
    autore.className = 'prog-revisione-card-autore';
    autore.textContent = voce.author_name;
    titoloBox.append(autore, titolo, meta);

    const select = document.createElement('select');
    select.setAttribute('aria-label', `Stato: ${titolo.textContent}`);
    select.disabled = voce.author_name !== stato.editorName;
    if (select.disabled) select.title = `Solo ${voce.author_name} può cambiare lo stato di questa bozza.`;
    [
        ['bozza', 'Da valutare'],
        ['approvata', 'Approvata'],
        ['applicata', 'Applicata'],
        ['archiviata', 'Archiviata']
    ].forEach(([valore, etichetta]) => {
        const option = document.createElement('option');
        option.value = valore;
        option.textContent = etichetta;
        option.selected = voce.stato === valore;
        select.appendChild(option);
    });
    select.addEventListener('change', () => aggiornaStatoRevisione(voce, select, card));
    testata.append(titoloBox, select);
    card.appendChild(testata);

    if (voce.nota_generale) {
        const nota = document.createElement('p');
        nota.className = 'prog-revisione-card-nota';
        nota.textContent = voce.nota_generale;
        card.appendChild(nota);
    }

    const chiavi = Object.keys(voce.modifiche || {});
    if (chiavi.length) {
        const campi = document.createElement('div');
        campi.className = 'prog-revisione-card-campi';
        chiavi.forEach((chiave) => {
            const badge = document.createElement('span');
            badge.textContent = ETICHETTE_CAMPI.get(chiave) || chiave;
            campi.appendChild(badge);
        });
        card.appendChild(campi);

        const confronto = document.createElement('details');
        confronto.className = 'prog-revisione-confronto';
        const riepilogo = document.createElement('summary');
        riepilogo.textContent = 'Confronta i testi proposti';
        confronto.appendChild(riepilogo);
        chiavi.forEach((chiave) => {
            const sezione = document.createElement('section');
            const etichetta = document.createElement('h4');
            etichetta.textContent = ETICHETTE_CAMPI.get(chiave) || chiave;
            const griglia = document.createElement('div');
            griglia.className = 'prog-revisione-confronto-griglia';
            griglia.append(
                creaTestoConfronto('Testo attuale', voce.originale?.[chiave]),
                creaTestoConfronto(`Proposta di ${voce.author_name}`, voce.modifiche?.[chiave])
            );
            sezione.append(etichetta, griglia);
            confronto.appendChild(sezione);
        });
        card.appendChild(confronto);
    }

    const azioni = document.createElement('div');
    azioni.className = 'prog-revisione-card-azioni';
    if (voce.author_name === stato.editorName) {
        const modifica = document.createElement('button');
        modifica.type = 'button';
        modifica.className = 'prog-btn-secondario';
        modifica.textContent = 'Apri la mia bozza';
        modifica.addEventListener('click', () => {
            ui.elencoDialog.close();
            if (voce.module_key === CHIAVE_NOTA_GENERALE) {
                apriEditorNotaGenerale();
            } else {
                apriEditorModulo(voce.module_key);
            }
        });
        azioni.appendChild(modifica);
    }

    if (voce.module_key !== CHIAVE_NOTA_GENERALE) {
        const vai = document.createElement('button');
        vai.type = 'button';
        vai.className = 'prog-btn-secondario';
        vai.textContent = 'Mostra nella pagina';
        vai.addEventListener('click', () => mostraModuloNellaPagina(voce.module_key));
        azioni.appendChild(vai);
    }
    card.appendChild(azioni);
    return card;
}

async function aggiornaStatoRevisione(voce, select, card) {
    const precedente = voce.stato;
    select.disabled = true;
    const nuovoStato = select.value;
    try {
        const data = await chiamaApi('status', { id: voce.id, state: nuovoStato });
        stato.revisioni.set(chiaveRevisione(data.revision.module_key, data.revision.author_name), data.revision);
        card.dataset.stato = data.revision.stato;
        aggiornaContatore();
        aggiornaIndicatoriUDA();
        messaggio(ui.elencoMessaggio, 'Stato aggiornato.', 'successo');
    } catch {
        select.value = precedente;
        messaggio(ui.elencoMessaggio, 'Impossibile aggiornare lo stato.', 'errore');
    } finally {
        select.disabled = false;
    }
}

function mostraModuloNellaPagina(chiave) {
    ui.elencoDialog.close();
    const modulo = document.querySelector(`[data-programmi-modulo="${CSS.escape(chiave)}"]`);
    if (!modulo) {
        apriEditorModulo(chiave);
        return;
    }
    modulo.open = true;
    let genitore = modulo.parentElement?.closest('details');
    while (genitore) {
        genitore.open = true;
        genitore = genitore.parentElement?.closest('details');
    }
    modulo.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function esportaMarkdown() {
    const voci = [...stato.revisioni.values()]
        .filter((voce) => voce.stato !== 'archiviata')
        .sort((a, b) => `${a.anno}-${a.numero}`.localeCompare(`${b.anno}-${b.numero}`, 'it'));
    if (!voci.length) {
        messaggio(ui.elencoMessaggio, 'Non ci sono annotazioni da esportare.', 'errore');
        return;
    }

    const righe = [
        '# Annotazioni Programmi SSAS',
        '',
        `Esportate il ${new Date().toLocaleString('it-IT')}.`,
        ''
    ];

    voci.forEach((voce) => {
        righe.push(`## ${voce.module_key === CHIAVE_NOTA_GENERALE ? 'Pagina generale' : `${voce.anno} · UDA ${voce.numero} — ${voce.titolo_modulo}`}`);
        righe.push('', `- Autore: ${voce.author_name}`, `- Stato: ${etichettaStato(voce.stato)}`, `- Chiave: ${voce.module_key}`);
        if (voce.nota_generale) {
            righe.push('', '### Annotazione', '', voce.nota_generale);
        }
        Object.entries(voce.modifiche || {}).forEach(([chiave, proposta]) => {
            righe.push('', `### ${ETICHETTE_CAMPI.get(chiave) || chiave}`, '', '**Testo originale**', '', formattaValore(voce.originale?.[chiave]), '', '**Proposta**', '', formattaValore(proposta));
        });
        righe.push('', '---', '');
    });

    const blob = new Blob([righe.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `annotazioni-programmi-ssas-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    messaggio(ui.elencoMessaggio, 'Esportazione completata.', 'successo');
}

function popolaFiltroAnni() {
    if (!ui.elencoAnno || !stato.datiProgrammi) return;
    const selezionato = ui.elencoAnno.value;
    ui.elencoAnno.querySelectorAll('option:not(:first-child)').forEach((option) => option.remove());
    [...stato.datiProgrammi.meta.anni, 'Pagina generale'].forEach((anno) => {
        const option = document.createElement('option');
        option.value = anno;
        option.textContent = anno;
        ui.elencoAnno.appendChild(option);
    });
    ui.elencoAnno.value = selezionato;
}

function chiaveRevisione(moduleKey, authorName) {
    return `${moduleKey}::${authorName}`;
}

function revisionePersonale(moduleKey) {
    return stato.revisioni.get(chiaveRevisione(moduleKey, stato.editorName));
}

function revisioniModulo(moduleKey) {
    return [...stato.revisioni.values()].filter((voce) => voce.module_key === moduleKey);
}

function creaTestoConfronto(etichetta, valore) {
    const box = document.createElement('div');
    const titolo = document.createElement('strong');
    titolo.textContent = etichetta;
    const testo = document.createElement('p');
    testo.textContent = formattaValore(valore);
    box.append(titolo, testo);
    return box;
}

function chiaveModulo(modulo, moduli) {
    const anno = slug(modulo.anno || 'senza-anno');
    if (modulo.alternativoA !== undefined) {
        return `${anno}-uda-${modulo.alternativoA}b`;
    }
    const alternativa = moduli.some((voce) => voce.anno === modulo.anno && voce.alternativoA === modulo.n) ? 'a' : '';
    const suffisso = modulo.suffisso ? `-${slug(modulo.suffisso)}` : '';
    return `${anno}-uda-${modulo.n}${alternativa}${suffisso}`;
}

function numeroModulo(modulo, moduli) {
    if (modulo.alternativoA !== undefined) return `${modulo.alternativoA}B`;
    if (moduli.some((voce) => voce.anno === modulo.anno && voce.alternativoA === modulo.n)) return `${modulo.n}A`;
    return modulo.n + (modulo.suffisso ? ` ${modulo.suffisso}` : '');
}

function slug(valore) {
    return String(valore).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function etichettaStato(valore) {
    return {
        bozza: 'Da valutare',
        approvata: 'Approvata',
        applicata: 'Applicata',
        archiviata: 'Archiviata'
    }[valore] || valore;
}

function formattaDataOra(iso) {
    if (!iso) return '';
    return new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(iso));
}

function messaggio(elemento, testo, tipo = '') {
    if (!elemento) return;
    elemento.textContent = testo;
    if (tipo) {
        elemento.dataset.tipo = tipo;
    } else {
        delete elemento.dataset.tipo;
    }
}

async function chiamaApi(action, payload = {}, opzioni = {}) {
    const headers = {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json'
    };
    if (!opzioni.senzaSessione && stato.token) {
        headers['X-Programmi-Session'] = stato.token;
    }
    const risposta = await fetch(REVISION_API, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, ...payload })
    });
    const data = await risposta.json().catch(() => ({}));
    if (!risposta.ok) {
        if (risposta.status === 401 && action !== 'login') {
            sessionStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(IDENTITY_KEY);
            impostaModalitaEditor(false);
            mostraBloccoPagina();
        }
        throw new Error(data.error || 'Servizio temporaneamente non disponibile.');
    }
    return data;
}
