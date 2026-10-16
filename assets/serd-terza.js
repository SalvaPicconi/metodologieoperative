/* Il laboratorio usa schede Word. Questo script conserva il solo diario preesistente. */
(() => {
  'use strict';
  const GUEST = 'mo:serd:ospite:v1';
  const note = () => document.querySelector('[name="progress_note"]');
  const guest = () => document.body.dataset.moGuest === 'true';
  const object = value => {
    try { const data = typeof value === 'string' ? JSON.parse(value) : value; return data && typeof data === 'object' && !Array.isArray(data) ? data : null; }
    catch { return null; }
  };
  const read = key => { try { return object(localStorage.getItem(key)); } catch { return null; } };
  const legacyDraft = () => object(read(`mo:progress-local:${location.pathname}`)?.data);
  const key = () => guest() ? GUEST : `mo:serd:diario:v1:${localStorage.getItem('mo:class') || ''}:${localStorage.getItem('mo:code') || ''}`;
  let loaded = {}, ready = false;
  const merge = (base, extra) => ({ ...base, ...extra, ...(base?._meta || extra?._meta ? { _meta: { ...object(base?._meta), ...object(extra?._meta) } } : {}) });
  const status = text => { document.getElementById('serd-stato').textContent = text; };
  function collect(data = {}) {
    if (!ready) return { __skipSave: true };
    // Le chiavi sconosciute e i metadati letti dal server restano nel payload.
    loaded = merge(loaded, data);
    loaded.progress_note = note().value;
    return loaded;
  }
  function restore(saved) {
    const remote = object(saved), own = read(key());
    const newer = own && (!remote || (remote._serdDiarioModificatoIl && own._serdDiarioModificatoIl > remote._serdDiarioModificatoIl));
    loaded = guest() ? (own || {}) : (newer ? merge(remote, own) : remote || own || {});
    note().value = loaded.progress_note || '';
    note().disabled = false;
    ready = true;
    document.querySelector('[data-save-progress]').disabled = false;
    const legacy = legacyDraft();
    document.getElementById('serd-importa').hidden = guest() || !!remote || !!own || !legacy?.progress_note;
    status(guest() ? 'Ospite: il diario resta in questo browser. Copialo per conservarlo altrove.' : 'La bozza si conserva in questo browser. Usa «Salva il diario» per inviarla con il tuo codice.');
    return loaded;
  }
  window.MO_PROGRESS_CONFIG = {
    pagePath: window.location.pathname,
    inputSelector: '.progress-box textarea',
    onRestore: restore,
    onBeforeSave: collect
  };
  function saveLocal() {
    if (!ready) return;
    loaded._serdDiarioModificatoIl = new Date().toISOString();
    try { localStorage.setItem(key(), JSON.stringify(collect())); }
    catch { status('La memoria del browser non è disponibile. Copia il diario prima di chiudere.'); }
  }
  document.addEventListener('DOMContentLoaded', () => {
    // Gli strumenti condivisi restano nel flusso, senza coprire titolo o menu su telefono.
    const tools = document.getElementById('serd-identita');
    const placeTools = () => {
      const nodes = ['#studentLabel', '#resetStudent', '.home-floating-link'].map(selector => document.querySelector(selector));
      nodes.filter(Boolean).forEach(node => { if (node.parentNode !== tools) tools.appendChild(node); });
      if (nodes.every(Boolean)) observer.disconnect();
    };
    const observer = new MutationObserver(placeTools);
    observer.observe(document.body, { childList: true });
    placeTools();
    note().addEventListener('input', saveLocal);
    document.getElementById('serd-importa').addEventListener('click', () => {
      const legacy = legacyDraft();
      if (guest() || !legacy?.progress_note || !confirm('Questa vecchia bozza non è associata a un codice. Riprendila solo se è il tuo diario. Vuoi continuare?')) return;
      loaded = merge(legacy, loaded);
      note().value = legacy.progress_note;
      saveLocal();
      document.getElementById('serd-importa').hidden = true;
    });
  });
  window.addEventListener('mo:identity-change', () => {
    ready = false;
    loaded = {};
    note().value = '';
    note().disabled = true;
    document.querySelector('[data-save-progress]').disabled = true;
  });
})();
