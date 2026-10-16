/* Scheda e proiezione. Identità e accesso remoto usano i moduli condivisi del sito. */
(() => {
  'use strict';
  const PAGE = '/materiali/educazione-civica/dall-informazione-alla-partecipazione.html';
  const byId = id => document.getElementById(id);
  const inputs = () => [...document.querySelectorAll('[data-civica-field]')];
  const guest = () => document.body.dataset.moGuest === 'true';
  const object = value => {
    try {
      const data = typeof value === 'string' ? JSON.parse(value) : value;
      return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch { return null; }
  };
  const merge = (a, b) => ({ ...a, ...b, ...(a?._meta || b?._meta ? { _meta: { ...object(a?._meta), ...object(b?._meta) } } : {}) });
  function draftKey() {
    if (guest()) return 'mo:civica:partecipazione:v1:ospite';
    try { return `mo:civica:partecipazione:v1:${localStorage.getItem('mo:class') || ''}:${localStorage.getItem('mo:code') || ''}`; }
    catch { return null; }
  }
  function readDraft() {
    try { const key = draftKey(); return key ? object(localStorage.getItem(key)) : null; }
    catch { return null; }
  }
  let loaded = {}, ready = false, remoteReady = false, version = 0, offlineTimer;
  function wordCount() {
    const n = byId('ec_fatti').value.trim().split(/\s+/).filter(Boolean).length;
    byId('ec-conta-parole').textContent = `${n} / 120 parole${n > 120 ? ' · Rivedi la sintesi senza perdere le informazioni necessarie.' : ''}`;
  }
  function collect(data = {}) {
    loaded = merge(loaded, data);
    inputs().forEach(el => { loaded[el.name] = el.value; });
    return loaded;
  }
  function enableFields() {
    inputs().forEach(el => { el.value = typeof loaded[el.name] === 'string' ? loaded[el.name] : ''; el.disabled = false; });
    ready = true;
    document.querySelector('[data-save-progress]').disabled = !remoteReady;
    wordCount();
  }
  function restore(saved) {
    clearTimeout(offlineTimer);
    const remote = object(saved), local = readDraft();
    const localIsNewer = local && (!remote || (local._ecModificatoIl && local._ecModificatoIl > (remote._ecModificatoIl || '')));
    loaded = guest() ? local || {} : localIsNewer ? merge(remote, local) : remote || local || {};
    remoteReady = true;
    enableFields();
    byId('civica-stato').textContent = guest()
      ? 'Ospite: la scheda resta in questo browser. Scaricala per conservarla altrove.'
      : 'La scheda si conserva in questo browser e si salva con il tuo codice. Puoi usare anche «Salva il lavoro».';
    return loaded;
  }
  window.MO_PROGRESS_CONFIG = {
    pagePath: window.location.pathname,
    inputSelector: '[data-civica-field]',
    autoSave: true,
    homeUrl: '../../index.html',
    onRestore: restore,
    onBeforeSave(data) {
      // Il mancato caricamento remoto non deve sovrascrivere risposte sconosciute.
      return ready && remoteReady ? collect(data) : { __skipSave: true };
    }
  };
  window.MO_IDENTITY_CONFIG = {
    message: 'Inserisci la classe e il codice cognome+iniziale, tutto minuscolo. Puoi leggere il percorso anche come ospite.',
    classPlaceholder: 'Classe (es. 3sa)', classPattern: '^[1-5][a-z]{1,2}$', classExample: '3sa',
    classErrorMessage: 'Usa una cifra da 1 a 5 e 1–2 lettere minuscole, per esempio 3sa.',
    stripWhitespaceInClass: true, storeClassLowercase: true, storeClassUppercase: false,
    codePlaceholder: 'Codice (es. rossig)', codePattern: '^[a-zà-ü]{2,}[a-z]$', codeExample: 'rossig',
    codeErrorMessage: 'Usa il cognome minuscolo e l’iniziale del nome.',
    sanitizeCode: true, stripWhitespaceInCode: true, storeCodeLowercase: true, storeCodeUppercase: false,
    hideGenerator: true, guestAllowed: true, guestClassCode: 'ospite', guestStudentCode: 'ospite'
  };
  function localSave() {
    if (!ready) return;
    collect()._ecModificatoIl = new Date().toISOString();
    try {
      const key = draftKey();
      if (!key) throw new Error('Storage unavailable');
      localStorage.setItem(key, JSON.stringify(loaded));
    } catch { byId('civica-stato').textContent = 'Memoria del browser non disponibile: scarica la scheda prima di chiudere.'; }
  }
  function awaitRemote() {
    clearTimeout(offlineTimer);
    offlineTimer = setTimeout(() => {
      if (ready) return;
      let identified = guest();
      try { identified ||= Boolean(localStorage.getItem('mo:class') && localStorage.getItem('mo:code')); } catch { /* Nessuna identità locale. */ }
      if (!identified) return;
      loaded = readDraft() || {}; enableFields();
      byId('civica-stato').textContent = 'Caricamento online non riuscito: puoi lavorare in questo browser e scaricare la scheda. Ricarica la pagina quando torna la connessione prima di salvare online.';
    }, 12000);
  }
  function download() {
    const lines = ['DALL’INFORMAZIONE ALLA PARTECIPAZIONE', 'Educazione civica · Metodologie Operative · Terzo anno', ''];
    inputs().forEach(el => lines.push(document.querySelector(`label[for="${el.id}"]`).textContent, el.value.trim() || '[Non compilato]', ''));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'partecipazione-scheda-di-ricerca.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function clearLim(message = '') {
    version++;
    byId('civica-lim-risposte').replaceChildren(); byId('civica-lim-stato').textContent = message;
  }
  function closeLim() {
    clearLim(); byId('pannello-lim').hidden = true; document.body.classList.remove('lim');
  }
  async function teacher() {
    try { return window.MODocente ? await window.MODocente.assicura() : false; }
    catch { byId('civica-stato').textContent = 'Accesso docente non disponibile in questo browser. Apri la pagina in Safari o Chrome.'; return false; }
  }
  async function openLim() {
    const request = ++version;
    if (!(await teacher()) || request !== version) return;
    byId('pannello-lim').hidden = false; document.body.classList.add('lim');
    byId('civica-lim-classe').focus(); byId('pannello-lim').scrollIntoView({ block: 'start' });
  }
  async function loadLim() {
    clearLim();
    const request = version, cls = byId('civica-lim-classe').value.trim().toLowerCase();
    const id = byId('civica-lim-domanda').value, status = byId('civica-lim-stato');
    const panel = byId('civica-lim-risposte'), button = byId('civica-leggi-lim');
    if (!/^[1-5][a-z]{1,2}$/.test(cls)) { status.textContent = 'Inserisci una classe valida, per esempio 3sa.'; return; }
    if (!(await teacher()) || request !== version) return;
    button.disabled = true; status.textContent = 'Lettura delle risposte…';
    try {
      const result = await window.MODocente.chiama('progress_docente_classe', { p_class_code: cls, p_page_path: PAGE });
      if (request !== version || byId('pannello-lim').hidden) return;
      const rows = (Array.isArray(result) ? result : []).map(row => object(row.data) || {});
      const answers = rows.map(row => row[id]).filter(v => typeof v === 'string' && v.trim()).sort((a, b) => a.localeCompare(b, 'it'));
      const section = document.createElement('section'); section.className = 'lim-risposta';
      const h = document.createElement('h3'); h.textContent = document.querySelector(`label[for="${id}"]`).textContent;
      const list = document.createElement('ul');
      answers.forEach(answer => { const li = document.createElement('li'); li.textContent = answer; list.append(li); });
      section.append(h, list); panel.append(section);
      status.textContent = `${cls.toUpperCase()} · ${answers.length} risposte compilate. Nessun nome o codice associato.`;
    } catch (error) {
      if (request === version) { panel.replaceChildren(); status.textContent = window.MODocente.messaggioErrore(error); }
    } finally { button.disabled = false; }
  }
  function setupSlides() {
    const viewer = byId('civica-presentazione'), slides = [...viewer.querySelectorAll('[data-slide]')];
    const previous = byId('civica-slide-prev'), next = byId('civica-slide-next');
    let current = 0;
    const show = n => {
      current = Math.max(0, Math.min(slides.length - 1, n));
      slides.forEach((slide, i) => { slide.hidden = i !== current; });
      previous.disabled = current === 0; next.disabled = current === slides.length - 1;
      byId('civica-slide-stato').textContent = `Slide ${current + 1} di ${slides.length}`;
    };
    viewer.setAttribute('tabindex', '0'); viewer.setAttribute('role', 'region');
    viewer.setAttribute('aria-label', 'Presentazione, otto diapositive. Usa i pulsanti o le frecce della tastiera.');
    viewer.querySelector('.civica-slide-controls').hidden = false;
    previous.addEventListener('click', () => show(current - 1)); next.addEventListener('click', () => show(current + 1));
    viewer.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); show(current + (event.key === 'ArrowRight' ? 1 : -1)); }
    });
    show(0);
  }
  document.addEventListener('DOMContentLoaded', () => {
    inputs().forEach(el => {
      el.addEventListener('input', () => { localSave(); if (el.id === 'ec_fatti') wordCount(); });
      el.addEventListener('change', localSave);
      const option = document.createElement('option'); option.value = el.id;
      option.textContent = document.querySelector(`label[for="${el.id}"]`).textContent;
      byId('civica-lim-domanda').append(option);
    });
    byId('civica-scarica').addEventListener('click', download);
    byId('civica-stampa').addEventListener('click', () => { document.body.classList.add('print-scheda'); window.print(); });
    byId('civica-apri-lim').addEventListener('click', openLim);
    byId('civica-chiudi-lim').addEventListener('click', () => { closeLim(); byId('civica-apri-lim').focus(); });
    byId('civica-leggi-lim').addEventListener('click', loadLim);
    ['civica-lim-classe', 'civica-lim-domanda'].forEach(id => byId(id).addEventListener(id.endsWith('classe') ? 'input' : 'change', () => clearLim('Premi «Leggi le risposte» per la selezione attuale.')));
    const tools = byId('civica-identita');
    const place = () => {
      const nodes = ['#studentLabel', '#resetStudent', '.home-floating-link'].map(s => document.querySelector(s));
      nodes.filter(Boolean).forEach(n => { if (n.parentNode !== tools) tools.append(n); });
      if (nodes.every(Boolean)) observer.disconnect();
    };
    const observer = new MutationObserver(place); observer.observe(document.body, { childList: true }); place();
    setupSlides();
    awaitRemote();
  });
  window.addEventListener('beforeprint', () => {
    inputs().forEach(el => {
      const text = document.createElement('div'); text.className = 'print-answer';
      text.textContent = el.value; el.after(text); el.hidden = true;
    });
  });
  window.addEventListener('afterprint', () => {
    document.querySelectorAll('.print-answer').forEach(el => el.remove());
    inputs().forEach(el => { el.hidden = false; }); document.body.classList.remove('print-scheda');
  });
  window.addEventListener('mo:identity-change', () => {
    clearTimeout(offlineTimer); ready = false; remoteReady = false; loaded = {};
    inputs().forEach(el => { el.value = ''; el.disabled = true; });
    document.querySelector('[data-save-progress]').disabled = true; closeLim();
    // Anche senza rete si può continuare una bozza locale, senza inviarla sul server.
    awaitRemote();
  });
})();
