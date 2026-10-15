/* Lucia: i vettori delle venti risposte precedenti restano separati dal dossier. */
(() => {
  'use strict';
  const PAGE = '/materiali/terzo/esercitazioni_servizi.html';
  const LEGACY_KEY = 'esercitazione_servizi';
  const GUEST_KEY = 'mo:servizi:ospite:v1';
  const fields = ['lucia_strumento', 'lucia_motivo', 'lucia_dati_domande', 'lucia_percorso', 'lucia_revisione', 'lucia_verifica'];
  const legacy = () => Array.from(document.querySelectorAll('[data-servizi-legacy]'));
  const byId = id => document.getElementById(id);
  const object = value => {
    try { const data = typeof value === 'string' ? JSON.parse(value) : value; return data && typeof data === 'object' && !Array.isArray(data) ? data : null; }
    catch { return null; }
  };
  const guest = () => document.body.dataset.moGuest === 'true';
  const key = () => guest() ? GUEST_KEY : `mo:servizi:bozza:${localStorage.getItem('mo:class') || ''}:${localStorage.getItem('mo:code') || ''}`;
  let loaded = {}, ready = false, requestVersion = 0, printing = null;
  const read = storageKey => { try { return object(localStorage.getItem(storageKey)); } catch { return null; } };
  function merge(remote, local) {
    const result = { ...(object(remote) || {}) };
    Object.entries(object(local) || {}).forEach(([key, value]) => {
      const nested = value && typeof value === 'object' && !Array.isArray(value);
      Object.defineProperty(result, key, { value: nested ? merge(result[key], value) : value, enumerable: true, configurable: true, writable: true });
    });
    return result;
  }
  const dossier = () => Object.fromEntries(fields.map(id => [id, byId(id).value]));
  const payload = () => ({ nome: byId('nome').value, classe: byId('classe').value, data: byId('data').value, risposte: [...legacy().map(el => el.value), ...(Array.isArray(loaded._esercitazioneServizi?.risposte) ? loaded._esercitazioneServizi.risposte.slice(20) : [])] });
  function metadata(previous, current) {
    return { ...(object(previous) || {}), ...(object(current) || {}), luciaDossier: { ...(object(previous?.luciaDossier) || {}), compilati: fields.filter(id => byId(id).value.trim()).length, totale: fields.length } };
  }
  function collect(data = {}) {
    const previous = object(loaded) || {};
    const result = { ...previous, ...data, _esercitazioneServizi: { ...(object(previous._esercitazioneServizi) || {}), ...payload() }, _luciaDossier: { ...(object(previous._luciaDossier) || {}), ...dossier() }, _meta: metadata(previous._meta, data._meta), _serviziModificatoIl: new Date().toISOString() };
    // Anche le copie con chiave nominata devono riflettere gli stessi venti valori.
    legacy().forEach(el => { result[el.name] = el.value; });
    fields.forEach(id => { result[id] = byId(id).value; });
    ['nome', 'classe', 'data', 'materia'].forEach(id => { result[id] = byId(id).value; });
    loaded = result;
    return result;
  }
  function grow(el) { if (el.tagName === 'TEXTAREA') { el.style.height = 'auto'; el.style.height = `${Math.max(120, el.scrollHeight + 4)}px`; } }
  function restoreData(saved) {
    let own = null;
    try { own = read(key()); } catch { /* Memoria disabilitata: resta il salvataggio condiviso. */ }
    const remote = object(saved);
    // L'ospite non riceve mai cache o fallback di una precedente identità.
    const localNewer = own && (!remote || (own._serviziModificatoIl || '') > (remote._serviziModificatoIl || ''));
    const selected = guest() ? (own || {}) : (localNewer ? merge(remote, own) : remote || own || {});
    loaded = selected;
    const old = object(selected._esercitazioneServizi) || {};
    const extra = object(selected._luciaDossier) || {};
    legacy().forEach((el, index) => { el.value = Array.isArray(old.risposte) ? (old.risposte[index] ?? '') : (selected[el.name] ?? ''); grow(el); });
    fields.forEach(id => { byId(id).value = extra[id] ?? selected[id] ?? ''; grow(byId(id)); });
    ['nome', 'classe', 'data'].forEach(id => { byId(id).value = old[id] ?? selected[id] ?? ''; });
    if (!byId('data').value) byId('data').value = new Date().toLocaleDateString('en-CA');
    const oldLocal = read(LEGACY_KEY);
    byId('riprendi-legacy').hidden = guest() || Boolean(remote) || !Array.isArray(oldLocal?.risposte);
    ready = true;
    byId('salva-lavoro').disabled = false;
    byId('stato-lavoro').textContent = guest() ? 'Ospite: la bozza resta soltanto in questo browser. Scarica le risposte per conservarne una copia.' : 'La bozza si conserva in questo browser. Usa «Salva il lavoro» per inviarla con il tuo codice.';
    return selected;
  }
  window.MO_PROGRESS_CONFIG = {
    pagePath: window.location.pathname,
    inputSelector: '[data-servizi-legacy], [data-lucia-field], #nome, #classe, #data, #materia',
    onBeforeSave: collect,
    onRestore: restoreData
  };
  function saveLocal() {
    if (!ready) return;
    try { localStorage.setItem(key(), JSON.stringify(collect())); }
    catch { byId('stato-lavoro').textContent = 'La memoria del browser non è disponibile. Scarica le risposte prima di chiudere.'; }
  }
  function importLegacy() {
    const state = read(LEGACY_KEY);
    if (guest() || !Array.isArray(state?.risposte)) return;
    if (!confirm('Questa bozza precedente non è associata a un codice. Riprendila soltanto se è il tuo lavoro. Vuoi continuare?')) return;
    legacy().forEach((el, index) => { el.value = state.risposte[index] ?? ''; grow(el); });
    ['nome', 'classe', 'data'].forEach(id => { if (state[id]) byId(id).value = state[id]; });
    saveLocal();
    byId('riprendi-legacy').hidden = true;
    byId('stato-lavoro').textContent = 'Bozza precedente ripresa. Controlla le risposte, poi usa «Salva il lavoro».';
  }
  function download() {
    const lines = ['CASO LUCIA · DOSSIER OPERATIVO', 'Caso inventato · Metodologie Operative · Terzo anno', ''];
    legacy().slice(0, 4).forEach(el => { lines.push(document.querySelector(`label[for="${el.id}"]`).textContent, el.value.trim() || '[Non compilato]', ''); });
    fields.forEach(id => { const el = byId(id); const value = el.tagName === 'SELECT' ? el.selectedOptions[0]?.textContent : el.value; lines.push(document.querySelector(`label[for="${id}"]`).textContent, el.value.trim() ? value : '[Non compilato]', ''); });
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'caso-lucia-le-mie-risposte.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function beforePrint() {
    if (printing) return;
    printing = Array.from(document.querySelectorAll('#schede-contesto')).map(el => ({ el, open: el.open }));
    printing.forEach(({ el }) => { el.open = true; });
    document.querySelectorAll('textarea').forEach(grow);
  }
  function afterPrint() { printing?.forEach(({ el, open }) => { el.open = open; }); printing = null; document.body.classList.remove('print-lucia'); }
  window.exportPDF = function () {
    if (!window.html2pdf) { alert('Il download PDF non è disponibile. Usa «Stampa» e scegli Salva come PDF.'); return; }
    const nome = byId('nome').value || 'Studente', classe = byId('classe').value || 'Classe';
    const position = { x: window.scrollX, y: window.scrollY }, behavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    beforePrint();
    const finish = () => { afterPrint(); window.scrollTo(position.x, position.y); document.documentElement.style.scrollBehavior = behavior; };
    const canvasOptions = { scale: 1, scrollX: 0, scrollY: 0, onclone(doc) {
      doc.querySelectorAll('.strumenti-pagina,.strumenti-lucia,.buttons,.back-link,.site-footer,#mostra-imprevisto').forEach(el => { el.style.display = 'none'; });
      doc.querySelectorAll('[placeholder]').forEach(el => el.removeAttribute('placeholder'));
    } };
    window.html2pdf().set({ margin: 10, filename: `Esercitazione_${nome.replace(/\s+/g, '_')}_${classe}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: canvasOptions, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(byId('content')).toContainer().get('container').then(function (container) {
      // Misura il contenitore già impaginato: documenti lunghi restano entro i limiti del canvas.
      this.set({ html2canvas: { ...canvasOptions, scale: Math.min(1, 16000 / Math.max(container.scrollHeight, container.scrollWidth, 1)) } });
    }).save().then(finish, () => { finish(); alert('Usa «Stampa» per salvare il lavoro come PDF.'); });
  };
  // Il comando precedente resta disponibile senza toccare chiavi sconosciute.
  window.clearAll = function () {
    if (!confirm('Vuoi svuotare le risposte visibili di tutti i casi?')) return;
    [...legacy(), ...fields.map(byId)].forEach(el => { el.value = ''; grow(el); });
    byId('nome').value = ''; byId('classe').value = ''; saveLocal();
  };
  function clearLim(message = '') { requestVersion++; byId('lim-risposte').replaceChildren(); byId('lim-stato').textContent = message; }
  function closeLim() { clearLim(); byId('pannello-lim').hidden = true; document.body.classList.remove('lim'); }
  async function teacherAccess() {
    if (!window.MODocente) return false;
    try { return await window.MODocente.assicura(); }
    catch { const message = 'Questo browser non consente la richiesta di accesso docente. Apri la pagina in Safari o Chrome.'; byId('lim-stato').textContent = message; byId('stato-lavoro').textContent = message; return false; }
  }
  async function openLim() {
    const version = ++requestVersion;
    if (!(await teacherAccess()) || version !== requestVersion) return;
    byId('pannello-lim').hidden = false; document.body.classList.add('lim');
    try { const cls = localStorage.getItem('mo:class') || ''; if (!byId('lim-classe').value && /^[1-5][a-z]{1,2}$/.test(cls)) byId('lim-classe').value = cls; } catch { /* Campo compilabile. */ }
    byId('lim-classe').focus(); byId('pannello-lim').scrollIntoView({ block: 'start' });
  }
  function answersFor(data, moment) {
    if (moment === 'prima') {
      const old = object(data._esercitazioneServizi) || {};
      return legacy().slice(0, 4).map((el, i) => [el.id, old.risposte?.[i] ?? data[el.name] ?? '']);
    }
    const selected = moment === 'revisione' ? fields.slice(4) : fields.slice(0, 4);
    return selected.map(id => [id, data._luciaDossier?.[id] ?? data[id] ?? '']);
  }
  async function loadLim() {
    clearLim(); const version = requestVersion;
    const cls = byId('lim-classe').value.trim().toLowerCase(), moment = byId('lim-momento').value;
    const status = byId('lim-stato'), panel = byId('lim-risposte'), button = byId('aggiorna-lim');
    if (!/^[1-5][a-z]{1,2}$/.test(cls)) { status.textContent = 'Inserisci una classe valida, per esempio 3sa.'; return; }
    if (!(await teacherAccess()) || version !== requestVersion) return;
    button.disabled = true; status.textContent = 'Lettura delle risposte…';
    try {
      const result = await window.MODocente.chiama('progress_docente_classe', { p_class_code: cls, p_page_path: PAGE });
      if (version !== requestVersion || byId('pannello-lim').hidden) return;
      const rows = (Array.isArray(result) ? result : []).map(row => object(row.data) || {});
      const grouped = new Map();
      rows.forEach(data => answersFor(data, moment).forEach(([id, answer]) => { if (typeof answer === 'string' && answer.trim()) { if (!grouped.has(id)) grouped.set(id, []); grouped.get(id).push(answer); } }));
      grouped.forEach((answers, id) => {
        const section = document.createElement('section'); section.className = 'lim-risposta';
        const h = document.createElement('h3'); h.textContent = document.querySelector(`label[for="${id}"]`).textContent;
        const ul = document.createElement('ul');
        answers.sort((a, b) => a.localeCompare(b, 'it')).forEach(answer => { const li = document.createElement('li'); li.textContent = id === 'lucia_strumento' ? ({ griglia: 'Griglia bisogni–risorse–vincoli', mappa: 'Mappa della rete con note' }[answer] || answer) : answer; ul.append(li); });
        section.append(h, ul); panel.append(section);
      });
      status.textContent = `${cls.toUpperCase()} · ${rows.length} lavori salvati. ${grouped.size ? 'Risposte raggruppate per domanda, senza codici o nomi associati.' : 'Nessuna risposta compilata per questa selezione.'}`;
    } catch (error) { if (version === requestVersion) { panel.replaceChildren(); status.textContent = window.MODocente.messaggioErrore(error); } }
    finally { button.disabled = false; }
  }
  window.addEventListener('mo:identity-change', () => { loaded = {}; ready = false; byId('salva-lavoro').disabled = true; closeLim(); });
  window.addEventListener('beforeprint', beforePrint);
  window.addEventListener('afterprint', afterPrint);
  document.addEventListener('DOMContentLoaded', () => {
    byId('riprendi-legacy').addEventListener('click', importLegacy);
    byId('scarica-lucia').addEventListener('click', download);
    byId('stampa-lucia').addEventListener('click', () => { document.body.classList.add('print-lucia'); window.print(); });
    byId('mostra-imprevisto').addEventListener('click', () => { byId('imprevisto-lucia').hidden = false; byId('mostra-imprevisto').setAttribute('aria-expanded', 'true'); byId('mostra-imprevisto').textContent = 'Nuova informazione aperta'; });
    byId('apri-lim').addEventListener('click', openLim);
    byId('chiudi-lim').addEventListener('click', () => { closeLim(); byId('apri-lim').focus(); });
    byId('aggiorna-lim').addEventListener('click', loadLim);
    ['lim-classe', 'lim-momento'].forEach(id => byId(id).addEventListener(id === 'lim-classe' ? 'input' : 'change', () => clearLim('Premi «Leggi le risposte» per la selezione attuale.')));
    document.querySelectorAll('textarea').forEach(grow);
    requestAnimationFrame(() => { ['studentLabel', 'resetStudent'].forEach(id => { const el = byId(id); if (el) byId('identity-tools').append(el); }); });
  });
  ['input', 'change'].forEach(type => document.addEventListener(type, event => { if (event.target.matches(window.MO_PROGRESS_CONFIG.inputSelector)) { grow(event.target); saveLocal(); } }));
})();
