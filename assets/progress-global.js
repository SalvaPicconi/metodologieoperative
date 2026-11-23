import { Progress } from './progress.js?v=20261122';
import { AreaAlunni } from './alunni-sessione.js?v=20261122';

console.log('✅ progress-global attivo');

const DEFAULT_CONFIG = {
  pathPrefixes: ['/metodologieoperative']
};

function resolveConfig() {
  const userConfig = window.MO_PROGRESS_CONFIG && typeof window.MO_PROGRESS_CONFIG === 'object'
    ? window.MO_PROGRESS_CONFIG
    : {};

  const merged = {
    ...DEFAULT_CONFIG,
    ...userConfig
  };

  const pathPrefixes = new Set(DEFAULT_CONFIG.pathPrefixes);
  if (Array.isArray(userConfig.pathPrefixes)) {
    userConfig.pathPrefixes.filter(Boolean).forEach(prefix => pathPrefixes.add(prefix));
  }
  merged.pathPrefixes = Array.from(pathPrefixes);
  window.MO_PROGRESS_CONFIG = merged;
  return merged;
}

const CONFIG = resolveConfig();

// Rileva ID della pagina (meta o path)
  const PAGE_ID = document.querySelector('meta[name="page-id"]')?.content || location.pathname;
  const IS_DISABLED = CONFIG.disabled === true;
  const HOME_URL = CONFIG.homeUrl || guessHomeUrl();
  // Salvataggio automatico acceso in tutte le pagine (una pagina può spegnerlo con autoSave: false).
  const AUTO_SAVE_ENABLED = CONFIG.autoSave !== false;
  // Tempi uguali in tutte le pagine (le vecchie impostazioni per pagina non valgono più):
  // si salva circa 3 secondi dopo l'ultima modifica, al massimo una volta ogni 10 secondi.
  const AUTO_SAVE_DEBOUNCE = 3000;
  const AUTO_SAVE_MIN_INTERVAL = 10000;
  const AUTO_SAVE_JITTER = 1500;
  const RITENTA_MS = 20000;
  const KEEPALIVE_MAX = 60000;

  if (IS_DISABLED) {
    console.log('⏸️ progress tracking disattivato su questa pagina');
  } else {
  const PAGE_PATH = CONFIG.pagePath || PAGE_ID;
  const INPUT_SELECTOR = CONFIG.inputSelector || 'input, textarea, select';
  const LOCAL_FALLBACK_KEY = `mo:progress-local:${PAGE_PATH}`;
  let studentLabel = null;      // testo «chi è entrato» nella barra
  let statoElement = null;      // stato del salvataggio nella barra
  let saveBtnElement = null;    // «Salva» della barra
  let esciBtnElement = null;    // «Esci» della barra
  let barraElement = null;
  let paginaSaveBtn = null;     // eventuale pulsante di salvataggio proprio della pagina
  let isGuestMode = false;
  let homeLinkElement = null;
  let autoSaveTimer = null;
  let ritentaTimer = null;
  let lastAutoSave = 0;
  let lastSavedSnapshot = null;
  let initialRestorePending = false;
  // L'autosalvataggio parte solo dopo il ripristino: niente scritture vuote sopra un lavoro esistente.
  let restoreCompleted = false;
  let avvisoElement = null;
  let modificheNonSalvate = false;
  let salvataggioInCorso = null;
  let salvaDiNuovo = false;
  let ultimoErrore = null;
  let inviatoInUscita = false;
  let uscendo = false;

  const isSuperMode = () => document.body?.dataset?.moSuper === 'true';

  // Foglio di stile della barra, accanto a questo script
  try {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./barra-lavoro.css?v=20261122b', import.meta.url).href;
    document.head.appendChild(link);
  } catch (error) {
    console.warn('Stile della barra non caricato:', error);
  }

  // Barra del lavoro: uguale in tutte le pagine
  document.addEventListener('DOMContentLoaded', () => {
    barraElement = document.createElement('div');
    barraElement.id = 'mo-barra';
    barraElement.setAttribute('role', 'region');
    barraElement.setAttribute('aria-label', 'Il tuo lavoro');
    barraElement.innerHTML = '<div class="mo-testi"><span class="mo-chi"></span><span class="mo-stato" aria-live="polite"></span></div>'
      + '<div class="mo-azioni"><button type="button" id="mo-salva">Salva</button><button type="button" id="mo-esci">Esci</button></div>';
    studentLabel = barraElement.querySelector('.mo-chi');
    statoElement = barraElement.querySelector('.mo-stato');
    saveBtnElement = barraElement.querySelector('#mo-salva');
    esciBtnElement = barraElement.querySelector('#mo-esci');
    const spazio = document.createElement('div');
    spazio.id = 'mo-barra-spazio';
    spazio.setAttribute('aria-hidden', 'true');
    document.body.append(spazio, barraElement);

    // Se la pagina ha un suo pulsante di salvataggio (es. «Salva il lavoro» in fondo a una scheda),
    // la barra lo usa: ne rispetta lo stato (attivo solo quando il lavoro è caricato) e i controlli.
    paginaSaveBtn = document.querySelector('[data-save-progress]');
    if (paginaSaveBtn) {
      const allinea = () => { saveBtnElement.disabled = paginaSaveBtn.disabled; };
      allinea();
      new MutationObserver(allinea).observe(paginaSaveBtn, { attributes: true, attributeFilter: ['disabled'] });
    }
    saveBtnElement.addEventListener('click', () => {
      if (paginaSaveBtn && document.contains(paginaSaveBtn)) paginaSaveBtn.click();
      else salvaManuale(saveBtnElement);
    });
    esciBtnElement.addEventListener('click', esci);

    if (!document.querySelector('.home-floating-link')) {
      homeLinkElement = document.createElement('a');
      homeLinkElement.href = HOME_URL;
      homeLinkElement.textContent = '🏠 Home';
      homeLinkElement.className = 'home-floating-link';
      homeLinkElement.title = 'Torna alla Home';
      document.body.appendChild(homeLinkElement);
    }

    isGuestMode = document.body?.dataset?.moGuest === 'true';
    updateSaveButtonsVisibility();
    updateStudentLabel();
    mostraStato(statoIniziale());
  });

  function statoIniziale() {
    if (isSuperMode()) return ['info', 'Modalità docente: nessun salvataggio automatico'];
    if (isGuestMode) return ['info', 'Ospite: le risposte restano su questo dispositivo'];
    if (!AUTO_SAVE_ENABLED) return ['info', 'Ricordati di premere «Salva»'];
    return ['info', 'Si salva da solo mentre scrivi'];
  }

  function mostraStato(stato) {
    if (!statoElement || !stato) return;
    const [tipo, testo] = stato;
    statoElement.dataset.tipo = tipo;
    statoElement.textContent = testo;
  }

  function ora() {
    return new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  function updateStudentLabel(detail) {
    if (!studentLabel) return;
    const detailData = detail || {};
    if (isSuperMode()) {
      const superClass = document.body?.dataset?.moSuperClass || detailData.classCode || '—';
      const superStudent = document.body?.dataset?.moSuperStudent || detailData.studentCode || '—';
      studentLabel.textContent = `Docente · ${superClass} · ${superStudent}`;
      if (esciBtnElement) esciBtnElement.textContent = 'Chiudi';
      return;
    }
    if (esciBtnElement) esciBtnElement.textContent = 'Esci';
    if (isGuestMode || detailData.guest) {
      studentLabel.textContent = 'Modalità ospite';
      return;
    }
    const c = detailData.classCode ?? localStorage.getItem('mo:class');
    const s = detailData.studentCode ?? localStorage.getItem('mo:code');
    studentLabel.textContent = c && s
      ? `${String(c).toLowerCase()} · ${String(s).toLowerCase()}`
      : 'Studente non identificato';
  }

  function updateSaveButtonsVisibility() {
    if (saveBtnElement) saveBtnElement.hidden = isGuestMode;
  }

  function dispatchProgressRestored(data) {
    try {
      const detail = { pageId: PAGE_PATH, data };
      const target = typeof window !== 'undefined' ? window : document;
      if (!target) return;
      let event;
      if (typeof CustomEvent === 'function') {
        event = new CustomEvent('mo:progress-restored', { detail });
      } else if (target.createEvent) {
        event = target.createEvent('CustomEvent');
        event.initCustomEvent('mo:progress-restored', false, false, detail);
      }
      if (event && typeof target.dispatchEvent === 'function') {
        target.dispatchEvent(event);
      }
    } catch (error) {
      console.warn('Impossibile inviare evento di ripristino progressi:', error);
    }
  }

  function autoSalvataggioPossibile() {
    if (!AUTO_SAVE_ENABLED || IS_DISABLED || isGuestMode || !restoreCompleted || uscendo) return false;
    // Il docente che consulta il lavoro di un alunno non deve modificarlo senza volerlo.
    if (isSuperMode()) return false;
    const statoArea = Progress.statoProtetto();
    if (statoArea && !statoArea.modificabile) return false;
    return true;
  }

  function segnaModifica() {
    if (!restoreCompleted || uscendo) return;
    modificheNonSalvate = true;
    if (autoSalvataggioPossibile()) {
      if (!ultimoErrore) mostraStato(['info', 'Modifiche in corso…']);
      scheduleAutoSave('input');
    } else if (!isGuestMode && !isSuperMode()) {
      mostraStato(['info', 'Modifiche da salvare']);
    }
  }

  function scheduleAutoSave(reason = 'input') {
    if (!autoSalvataggioPossibile()) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    const jitter = AUTO_SAVE_JITTER ? Math.random() * AUTO_SAVE_JITTER : 0;
    autoSaveTimer = setTimeout(runAutoSave, AUTO_SAVE_DEBOUNCE + jitter);
  }

  async function runAutoSave() {
    autoSaveTimer = null;
    if (!autoSalvataggioPossibile()) return;
    const elapsed = Date.now() - lastAutoSave;
    if (elapsed < AUTO_SAVE_MIN_INTERVAL) {
      const jitter = AUTO_SAVE_JITTER ? Math.random() * AUTO_SAVE_JITTER : 0;
      autoSaveTimer = setTimeout(runAutoSave, AUTO_SAVE_MIN_INTERVAL - elapsed + jitter);
      return;
    }
    await salvaOra('automatico');
  }

  // Un solo salvataggio alla volta: nell'area protetta due scritture insieme andrebbero in conflitto di versione.
  function salvaOra(motivo, opzioni = {}) {
    if (salvataggioInCorso) {
      salvaDiNuovo = true;
      return salvataggioInCorso;
    }
    const payload = collectData();
    if (!payload || payload.__skipSave) {
      modificheNonSalvate = false;
      return Promise.resolve({ ok: true, saltato: true });
    }
    let snapshot = null;
    try { snapshot = JSON.stringify(payload); } catch { snapshot = null; }
    if (motivo !== 'manuale' && snapshot && snapshot === lastSavedSnapshot) {
      modificheNonSalvate = false;
      return Promise.resolve({ ok: true, saltato: true });
    }
    const keepalive = Boolean(opzioni.keepalive) && snapshot && snapshot.length < KEEPALIVE_MAX;
    if (motivo !== 'uscita') mostraStato(['info', 'Salvataggio…']);
    salvataggioInCorso = (async () => {
      try {
        if (!restoreCompleted && Progress.statoProtetto()) {
          throw Object.assign(new Error('lavoro non ancora caricato'), { hint: 'rete', protetto: true });
        }
        await Progress.save(payload, PAGE_PATH, { keepalive });
        if (Progress.statoProtetto()) AreaAlunni.scartaBozza(PAGE_PATH);
        lastAutoSave = Date.now();
        lastSavedSnapshot = snapshot;
        ultimoErrore = null;
        if (ritentaTimer) { clearTimeout(ritentaTimer); ritentaTimer = null; }
        let attuale = null;
        try { attuale = JSON.stringify(collectData()); } catch { attuale = null; }
        modificheNonSalvate = attuale !== snapshot;
        mostraStato(['salvato', `Salvato alle ${ora()}`]);
        if (avvisoElement && !avvisoElement.hidden && avvisoElement.dataset.tipo === 'rete') nascondiAvviso();
        return { ok: true };
      } catch (error) {
        console.warn('Errore salvataggio progressi:', error);
        ultimoErrore = error || new Error('errore');
        if (error && error.protetto) {
          const messaggio = gestisciErroreArea(error, payload);
          mostraStato(['errore', 'Non salvato online']);
          if (error.hint === 'rete') programmaRitentativo();
          return { ok: false, messaggio };
        }
        if (error && /lavoro protetto/.test(error.message || '')) {
          saveLocalFallback(payload);
          mostraStato(['errore', 'Non salvato online']);
          return { ok: false, messaggio: 'Questo lavoro ora si apre da «I miei lavori» con il tuo codice personale. Le risposte non sono state salvate online.' };
        }
        const savedLocally = saveLocalFallback(payload);
        mostraStato(['errore', 'Non salvato online: riprovo tra poco']);
        programmaRitentativo();
        return {
          ok: false,
          messaggio: savedLocally
            ? 'Il sito dei salvataggi non risponde: le risposte sono al sicuro su questo dispositivo e riprovo a salvarle online tra poco.'
            : 'Errore di salvataggio: ' + (error && error.message ? error.message : 'sconosciuto')
        };
      } finally {
        salvataggioInCorso = null;
        if (salvaDiNuovo) {
          salvaDiNuovo = false;
          if (modificheNonSalvate) scheduleAutoSave('coda');
        }
      }
    })();
    return salvataggioInCorso;
  }

  function programmaRitentativo() {
    if (ritentaTimer || !autoSalvataggioPossibile()) return;
    ritentaTimer = setTimeout(() => {
      ritentaTimer = null;
      if (modificheNonSalvate && autoSalvataggioPossibile()) salvaOra('ritentativo');
    }, RITENTA_MS);
  }

  async function salvaManuale(button) {
    if (isGuestMode) {
      alert('Sei in modalità ospite: il salvataggio online è disattivato.');
      return;
    }
    if (salvataggioInCorso) {
      try { await salvataggioInCorso; } catch { }
    }
    const testoOriginale = button ? button.textContent : '';
    if (button) button.textContent = 'Salvo…';
    const esito = await salvaOra('manuale');
    if (button) {
      button.textContent = esito.ok ? '✓ Salvato' : testoOriginale;
      if (esito.ok) setTimeout(() => { button.textContent = testoOriginale; }, 1800);
    }
    if (!esito.ok && esito.messaggio) alert(esito.messaggio);
  }

  // Quando lo studente cambia scheda, chiude la pagina o ne apre un'altra: le ultime risposte partono subito.
  function salvaInUscita() {
    if (!modificheNonSalvate || !autoSalvataggioPossibile()) return;
    if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
    if (salvataggioInCorso) {
      salvaDiNuovo = true;
      if (Progress.statoProtetto()) AreaAlunni.salvaBozza(PAGE_PATH, collectData());
      return;
    }
    inviatoInUscita = true;
    salvaOra('uscita', { keepalive: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') salvaInUscita();
  });
  window.addEventListener('pagehide', salvaInUscita);
  window.addEventListener('pageshow', (event) => {
    // Pagina ripresa dalla cache del browser dopo un salvataggio in uscita: si ricarica per avere la versione aggiornata.
    if (event.persisted && inviatoInUscita && Progress.statoProtetto()) location.reload();
  });
  window.addEventListener('beforeunload', (event) => {
    // Avvisa solo se le risposte non possono partire da sole (rete assente o salvataggio automatico spento).
    if (!modificheNonSalvate || uscendo || isGuestMode || isSuperMode()) return;
    if (ultimoErrore || !autoSalvataggioPossibile()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  // «Esci»: salva quello che manca, poi libera il dispositivo per chi viene dopo.
  async function esci() {
    if (uscendo) return;
    if (isSuperMode()) {
      if (!confirm('Vuoi chiudere la modalità docente su questa pagina?')) return;
      if (typeof Progress?.clearSuperSession === 'function') Progress.clearSuperSession();
      location.reload();
      return;
    }
    const daSalvare = !isGuestMode && (modificheNonSalvate || salvataggioInCorso) && restoreCompleted;
    if (daSalvare) {
      const statoArea = Progress.statoProtetto();
      if (!statoArea || statoArea.modificabile) {
        if (esciBtnElement) esciBtnElement.disabled = true;
        mostraStato(['info', 'Salvo prima di uscire…']);
        const esito = await Promise.race([
          (async () => { if (salvataggioInCorso) { try { await salvataggioInCorso; } catch { } } return salvaOra('esci'); })(),
          new Promise(resolve => setTimeout(() => resolve({ ok: false, messaggio: 'tempo scaduto' }), 8000))
        ]);
        if (esciBtnElement) esciBtnElement.disabled = false;
        if (!esito.ok && !confirm('Le ultime risposte NON sono arrivate al sito. Se esci adesso potresti perderle.\n\nVuoi uscire lo stesso?')) return;
      }
    }
    const areaAttiva = Boolean(Progress.statoProtetto()) || AreaAlunni.eraAttiva();
    const domanda = isGuestMode
      ? 'Vuoi uscire dalla modalità ospite?'
      : areaAttiva
        ? 'Vuoi uscire da «I miei lavori» su questo dispositivo? Il tuo lavoro è salvato.'
        : 'Vuoi uscire? Il tuo lavoro è salvato. Chi usa il dispositivo dopo di te entrerà con il suo codice.';
    if (!confirm(domanda)) return;
    uscendo = true;
    restoreCompleted = false;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    if (ritentaTimer) clearTimeout(ritentaTimer);
    svuotaCampi();
    if (typeof Progress?.clearSuperSession === 'function') Progress.clearSuperSession();
    try {
      for (const k of ['mo:class', 'mo:code']) { localStorage.removeItem(k); sessionStorage.removeItem(k); }
    } catch { }
    if (areaAttiva) {
      AreaAlunni.esci().finally(() => { location.replace(areaUrl()); });
    } else {
      location.reload();
    }
  }

function collectData() {
  const data = {};
  const processedRadio = new Set();
  const processedCheckbox = new Set();

  document.querySelectorAll(INPUT_SELECTOR).forEach(el => {
    const key = el.name || el.id || el.getAttribute('data-id');
    if (!key) return;

    if (el instanceof HTMLInputElement && el.type === 'radio') {
      if (processedRadio.has(key)) return;
      processedRadio.add(key);
      const radios = Array.from(document.getElementsByName(key))
        .filter(node => node instanceof HTMLInputElement && node.type === 'radio');
      const checked = radios.find(radio => radio.checked);
      data[key] = checked ? checked.value : null;
      return;
    }

    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (processedCheckbox.has(key)) return;
      processedCheckbox.add(key);
      const checkboxes = Array.from(document.getElementsByName(key))
        .filter(node => node instanceof HTMLInputElement && node.type === 'checkbox');
      if (checkboxes.length > 1) {
        data[key] = checkboxes
          .filter(cb => cb.checked)
          .map(cb => cb.value ?? 'on');
      } else {
        data[key] = el.checked;
      }
      return;
    }

    if (el instanceof HTMLSelectElement && el.multiple) {
      data[key] = Array.from(el.selectedOptions).map(opt => opt.value);
      return;
    }

    data[key] = el.value;
  });

  let result = data;
  if (typeof CONFIG.onBeforeSave === 'function') {
    try {
      const hookResponse = CONFIG.onBeforeSave(result);
      if (hookResponse && typeof hookResponse === 'object') {
        result = hookResponse;
      } else if (hookResponse !== undefined) {
        result = hookResponse;
      }
    } catch (error) {
      console.error('Errore durante onBeforeSave progress:', error);
    }
  }

  return result;
}

function saveLocalFallback(data) {
  try {
    const payload = { data, savedAt: new Date().toISOString() };
    localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn('Impossibile salvare localmente il fallback:', error);
    return false;
  }
}

function loadLocalFallback() {
  try {
    const raw = localStorage.getItem(LOCAL_FALLBACK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data || null;
  } catch (error) {
    console.warn('Impossibile leggere il fallback locale:', error);
    return null;
  }
}

function restoreData(saved) {
  if (!saved) {
    dispatchProgressRestored(null);
    return;
  }

  for (const [name, value] of Object.entries(saved)) {
    const elements = name ? Array.from(document.getElementsByName(name)) : [];

    if (elements.length > 0) {
      const first = elements[0];

      if (first instanceof HTMLInputElement && first.type === 'radio') {
        elements.forEach(radio => {
          radio.checked = value === null ? false : radio.value === value;
        });
        continue;
      }

      if (first instanceof HTMLInputElement && first.type === 'checkbox') {
        if (elements.length > 1) {
          const values = Array.isArray(value) ? value.map(val => String(val)) : [];
          elements.forEach(node => {
            const cb = node;
            const cbValue = cb.value ?? 'on';
            cb.checked = values.includes(cbValue);
          });
        } else {
          (first).checked = Boolean(value);
        }
        continue;
      }

      if (first instanceof HTMLSelectElement && first.multiple) {
        const selectedValues = Array.isArray(value) ? value.map(val => String(val)) : [];
        Array.from(first.options).forEach(option => {
          option.selected = selectedValues.includes(option.value);
        });
        continue;
      }

      first.value = value ?? '';
      continue;
    }

    if (name) {
      const byId = document.getElementById(name);
      if (byId) {
        if (byId instanceof HTMLInputElement && byId.type === 'checkbox') {
          byId.checked = Boolean(value);
        } else if (byId instanceof HTMLSelectElement && byId.multiple && Array.isArray(value)) {
          Array.from(byId.options).forEach(option => {
            option.selected = value.includes(option.value);
          });
        } else {
          byId.value = value ?? '';
        }
        continue;
      }
      const byDataId = document.querySelector(`[data-id="${name}"]`);
      if (byDataId) {
        byDataId.value = value ?? '';
      }
    }
  }

  dispatchProgressRestored(saved);
}

// carica automaticamente i dati salvati
async function loadAndRestore() {
  try {
    const saved = await Progress.load(PAGE_PATH);
    // In area protetta non si mescolano bozze lasciate nel browser da altri accessi.
    const localFallback = Progress.statoProtetto() ? null : loadLocalFallback();
    let dataToRestore = saved || localFallback;
    if (typeof CONFIG.onRestore === 'function') {
      try {
        const hookResponse = CONFIG.onRestore(saved);
        if (hookResponse === false) {
          // La pagina ha ripristinato da sé le risposte: il salvataggio automatico può partire.
          restoreCompleted = true;
          applicaStatoArea();
          return;
        }
        if (hookResponse && typeof hookResponse === 'object') {
          dataToRestore = hookResponse;
        }
      } catch (error) {
        console.error('Errore durante onRestore progress:', error);
      }
    }
    restoreData(dataToRestore);
    restoreCompleted = true;
    applicaStatoArea();
  } catch (error) {
    console.error('Errore caricamento progressi:', error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initialRestorePending = true;
  try {
    await loadAndRestore();
  } finally {
    initialRestorePending = false;
  }
  // Correzione del docente dentro la pagina: risposte corrette chiuse, le altre ancora scrivibili.
  if (!IS_DISABLED) {
    import('./correzione-in-pagina.js?v=20261123')
      .then(m => m.avviaCorrezione({
        pagePath: PAGE_PATH,
        statoProtetto: () => Progress.statoProtetto(),
        correzioneProtetta: id => AreaAlunni.correzione(id)
      }))
      .catch(error => console.warn('[Correzione] modulo non caricato:', error));
  }
});

// Ogni modifica a un campo della pagina fa partire il salvataggio automatico (dopo una breve pausa).
function eCampoDellaPagina(target) {
  // Come prima: qualunque campo fuori dalla barra (alcune pagine salvano anche dati calcolati dai propri script).
  return target instanceof Element && !target.closest('#mo-barra, #mo-area-avviso');
}
document.addEventListener('input', (event) => { if (eCampoDellaPagina(event.target)) segnaModifica(); });
document.addEventListener('change', (event) => { if (eCampoDellaPagina(event.target)) segnaModifica(); });

// Pulsanti di salvataggio propri della pagina (es. «Salva il lavoro»)
document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-save-progress]') : null;
  if (button && !button.disabled) salvaManuale(button);
});

// Vecchio pulsante «Cambia studente» ancora presente nel codice di qualche pagina: ora vale come «Esci».
document.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('#resetStudent')) esci();
});

// ── Area «I miei lavori»: etichetta, avvisi, sola lettura, bozza della scheda ──
function areaUrl() {
  return HOME_URL.replace(/index\.html$/, '') + 'area_alunni.html';
}

function mostraAvviso(testo, azioni = [], tipo = '') {
  if (!document.body) return;
  if (!avvisoElement) {
    avvisoElement = document.createElement('div');
    avvisoElement.id = 'mo-area-avviso';
    avvisoElement.setAttribute('role', 'status');
    avvisoElement.style.cssText = 'position:sticky;top:0;z-index:10000;background:#17385a;color:#fff;padding:10px 16px;font:15px/1.4 system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.2);';
    document.body.prepend(avvisoElement);
  }
  avvisoElement.replaceChildren();
  avvisoElement.dataset.tipo = tipo;
  const p = document.createElement('span');
  p.textContent = testo;
  avvisoElement.append(p);
  for (const azione of azioni) {
    const el = document.createElement(azione.href ? 'a' : 'button');
    el.textContent = azione.testo;
    el.style.cssText = 'background:#fff;color:#17385a;border:0;border-radius:8px;padding:6px 12px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;';
    if (azione.href) el.href = azione.href;
    else { el.type = 'button'; el.addEventListener('click', azione.click); }
    avvisoElement.append(el);
  }
  avvisoElement.hidden = false;
}

function nascondiAvviso() {
  if (avvisoElement) avvisoElement.hidden = true;
}

function rientro() {
  try { sessionStorage.setItem('mo:alunno-ritorno', location.pathname); } catch { }
  return areaUrl();
}

function bloccaCampi() {
  document.querySelectorAll(INPUT_SELECTOR).forEach(el => {
    if (el.type !== 'hidden') el.setAttribute('readonly', '');
    if (el instanceof HTMLSelectElement || el.type === 'radio' || el.type === 'checkbox') el.disabled = true;
  });
  if (saveBtnElement) saveBtnElement.hidden = true;
  if (statoElement) mostraStato(['info', 'Sola lettura']);
}

// Su un dispositivo condiviso le risposte non devono riapparire col tasto Indietro.
function nonMemorizzareCampi() {
  document.querySelectorAll(INPUT_SELECTOR).forEach(el => el.setAttribute('autocomplete', 'off'));
  document.querySelectorAll('form').forEach(f => f.setAttribute('autocomplete', 'off'));
}

function svuotaCampi() {
  document.querySelectorAll(INPUT_SELECTOR).forEach(el => {
    if (el.type === 'radio' || el.type === 'checkbox') el.checked = false;
    else if (el instanceof HTMLSelectElement) el.selectedIndex = -1;
    else if (el.type !== 'hidden' && el.type !== 'button' && el.type !== 'submit') el.value = '';
  });
}

function applicaStatoArea() {
  const stato = Progress.statoProtetto();
  if (!stato) return;
  nonMemorizzareCampi();
  const profilo = AreaAlunni.profiloSalvato();
  if (studentLabel) {
    studentLabel.textContent = profilo
      ? `I miei lavori · ${String(profilo.classe || '').toLowerCase()} · ${String(profilo.pseudonimo || '').toLowerCase()}`
      : 'I miei lavori';
  }
  if (saveBtnElement && stato.modificabile) saveBtnElement.hidden = false;
  if (stato.stato === 'sessione') {
    mostraAvviso('La sessione di «I miei lavori» è scaduta: rientra con il tuo codice per riprendere e salvare.',
      [{ testo: 'Rientra', href: rientro() }]);
    bloccaCampi();
    return;
  }
  if (stato.stato === 'rete') {
    mostraAvviso('Non riesco a raggiungere il sito dei salvataggi. Il lavoro non è stato caricato: ricarica la pagina quando la rete torna.',
      [{ testo: 'Ricarica', click: () => location.reload() }]);
    bloccaCampi();
    return;
  }
  if (stato.stato === 'in_verifica') {
    mostraAvviso('Su questa attività c’è un lavoro salvato prima dell’accesso personale: il docente deve confermarlo. Per ora le risposte non si salvano.',
      [{ testo: 'I miei lavori', href: areaUrl() }]);
    bloccaCampi();
    return;
  }
  if (stato.stato === 'non_iscritto') {
    mostraAvviso('Per quest’anno scolastico non risulti ancora in una classe: puoi consultare i lavori, ma non salvarne di nuovi. Avvisa il docente.',
      [{ testo: 'I miei lavori', href: areaUrl() }]);
    bloccaCampi();
    return;
  }
  if (!stato.modificabile) {
    const anno = Number.isInteger(stato.schoolYear) ? ` del ${stato.schoolYear}/${String((stato.schoolYear + 1) % 100).padStart(2, '0')}` : '';
    mostraAvviso(`Stai rileggendo un lavoro${anno}: è in sola lettura.`, [{ testo: 'I miei lavori', href: areaUrl() }]);
    bloccaCampi();
    return;
  }
  const bozza = AreaAlunni.leggiBozza(PAGE_PATH);
  if (bozza) {
    mostraAvviso('In questa scheda ci sono risposte che non erano arrivate al sito. Vuoi recuperarle?', [
      // La bozza resta finché un salvataggio non riesce: recuperarla non basta a perderla.
      { testo: 'Recupera', click: () => { restoreData(bozza.data); nascondiAvviso(); scheduleAutoSave('bozza'); } },
      { testo: 'Scarta', click: () => { AreaAlunni.scartaBozza(PAGE_PATH); nascondiAvviso(); } }
    ]);
  } else {
    nascondiAvviso();
  }
}

function gestisciErroreArea(error, payload) {
  const hint = error && error.hint;
  if (hint === 'conflitto') {
    AreaAlunni.salvaBozza(PAGE_PATH, payload);
    mostraAvviso('Questo lavoro è stato salvato da un’altra scheda o da un altro dispositivo. Ricarica per vedere l’ultima versione: le risposte di questa scheda restano recuperabili.',
      [{ testo: 'Ricarica', click: () => location.reload() }]);
    return 'Non salvato: il lavoro è stato modificato altrove. Ricarica la pagina.';
  }
  if (hint === 'rete') {
    AreaAlunni.salvaBozza(PAGE_PATH, payload);
    mostraAvviso('Rete non raggiungibile: le risposte NON sono ancora salvate online. Riprovo da solo tra poco: non chiudere la pagina.', [], 'rete');
    return 'Non salvato: rete non raggiungibile. Le risposte restano in questa scheda.';
  }
  if (hint === 'sessione' || hint === 'non_disponibile') {
    AreaAlunni.salvaBozza(PAGE_PATH, payload);
    applicaStatoArea();
    return 'Non salvato: la sessione è scaduta. Rientra da «I miei lavori» per recuperare le risposte.';
  }
  applicaStatoArea();
  return 'Non salvato: questo lavoro al momento non si può modificare.';
}

window.addEventListener('mo:area-alunni', () => applicaStatoArea());

// Aggiorna UI quando cambia identità
window.addEventListener('mo:identity-change', (event) => {
  const detail = event?.detail || {};
  isGuestMode = Boolean(detail.guest);
  updateSaveButtonsVisibility();
  updateStudentLabel(detail);
  mostraStato(statoIniziale());
  // La lettura iniziale aspetta già l’identità, incluso l’accesso come ospite.
  if (CONFIG.reusePendingInitialRestore && initialRestorePending) return;
  loadAndRestore();
});
}

function guessHomeUrl() {
  try {
    const { origin, pathname } = window.location;
    const match = pathname.match(/^(.*?\/metodologieoperative)\//);
    if (match) {
      return `${origin}${match[1]}/index.html`;
    }
    if (origin && origin !== 'null' && origin !== 'file://') {
      return `${origin}/index.html`;
    }
  } catch (error) {
    console.warn('Impossibile determinare la home, uso percorso relativo:', error);
  }
  return 'index.html';
}
