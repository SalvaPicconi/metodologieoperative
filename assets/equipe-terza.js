/* Strumenti del caso Rosa. Identità e RPC restano nei moduli condivisi. */
(() => {
  'use strict';
  const PAGE = '/materiali/terzo/equipe_multiprofessionale.html';
  const GUEST_KEY = 'mo:equipe:guest:v1';
  const fields = () => Array.from(document.querySelectorAll('main textarea, main select'));
  const groups = {
    prima: ['eq_caso_porto', 'eq_caso_chiedo', 'eq_caso_decisione', 'eq_caso_verbale'],
    revisione: ['eq_rosa_nuova_informazione', 'eq_rosa_decisione_rivista', 'eq_rosa_responsabilita', 'eq_rosa_verifica']
  };
  let requestVersion = 0;
  const collect = () => Object.fromEntries(fields().map(el => [el.name || el.id, el.value]));
  window.MOEquipe = {
    restore(saved) {
      let data = saved;
      if (document.body.dataset.moGuest === 'true') {
        // L'ospite riprende solo la sua bozza, mai il fallback di un altro accesso.
        try { data = JSON.parse(localStorage.getItem(GUEST_KEY) || '{}'); } catch { data = {}; }
        return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
      }
      if (data && typeof data === 'object' && !Array.isArray(data)) return data;
      return saved;
    }
  };
  function saveGuest() {
    if (document.body.dataset.moGuest !== 'true') return;
    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify(window.MO_PROGRESS_CONFIG.onBeforeSave(collect())));
      document.getElementById('stato-lavoro').textContent = 'Ospite: lavoro conservato soltanto in questo browser.';
    } catch {
      document.getElementById('stato-lavoro').textContent = 'Memoria del browser non disponibile: scarica le risposte prima di chiudere.';
    }
  }
  function clearLim(message = '') {
    requestVersion++;
    document.getElementById('lim-risposte').replaceChildren();
    document.getElementById('lim-stato').textContent = message;
  }
  function closeLim() {
    clearLim();
    document.getElementById('pannello-lim').hidden = true;
    document.body.classList.remove('lim');
  }
  async function teacherAccess() {
    if (!window.MODocente) return false;
    try { return await window.MODocente.assicura(); }
    catch {
      const message = 'Questo browser non consente la richiesta di accesso docente. Apri la pagina in Safari o Chrome per vedere le risposte della classe.';
      document.getElementById('stato-lavoro').textContent = message;
      document.getElementById('lim-stato').textContent = message;
      return false;
    }
  }
  async function openLim() {
    const version = ++requestVersion;
    if (!(await teacherAccess()) || version !== requestVersion) return;
    document.getElementById('pannello-lim').hidden = false;
    document.body.classList.add('lim');
    const input = document.getElementById('lim-classe');
    try {
      const value = localStorage.getItem('mo:class') || '';
      if (!input.value && /^[1-5][a-z]{1,2}$/.test(value)) input.value = value;
    } catch { /* La classe si può inserire a mano. */ }
    input.focus();
    document.getElementById('pannello-lim').scrollIntoView({ block: 'start' });
  }
  async function loadLim() {
    clearLim();
    const version = requestVersion;
    const cls = document.getElementById('lim-classe').value.trim().toLowerCase();
    const moment = document.getElementById('lim-momento').value;
    const panel = document.getElementById('lim-risposte');
    const status = document.getElementById('lim-stato');
    const button = document.getElementById('aggiorna-lim');
    if (!/^[1-5][a-z]{1,2}$/.test(cls)) { status.textContent = 'Inserisci una classe valida, per esempio 3sa.'; return; }
    if (!(await teacherAccess()) || version !== requestVersion) return;
    button.disabled = true;
    status.textContent = 'Lettura delle risposte…';
    try {
      const result = await window.MODocente.chiama('progress_docente_classe', { p_class_code: cls, p_page_path: PAGE });
      if (version !== requestVersion || document.getElementById('pannello-lim').hidden) return;
      const rows = (Array.isArray(result) ? result : []).map(row => {
        try {
          const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
        } catch { return {}; }
      });
      const momentLabel = moment === 'prima' ? 'prima proposta' : 'revisione dopo la telefonata';
      status.textContent = `${cls.toUpperCase()} · ${rows.length} lavori salvati · ${momentLabel}.`;
      (groups[moment] || []).forEach(key => {
        const answers = rows.map(row => row[key]).filter(value => typeof value === 'string' && value.trim());
        if (!answers.length) return;
        // Per domanda, senza identità o numerazione persistente fra risposte diverse.
        answers.sort((a, b) => a.localeCompare(b, 'it'));
        const section = document.createElement('section'); section.className = 'lim-risposta';
        const heading = document.createElement('h3'); heading.textContent = document.querySelector(`label[for="${key}"]`).textContent;
        const list = document.createElement('ul');
        answers.forEach(answer => { const item = document.createElement('li'); item.textContent = answer; list.append(item); });
        section.append(heading, list); panel.append(section);
      });
      if (!panel.childElementCount) status.textContent += ' Nessuna risposta compilata per questo momento.';
    } catch (error) {
      if (version === requestVersion) { panel.replaceChildren(); status.textContent = window.MODocente.messaggioErrore(error); }
    } finally { button.disabled = false; }
  }
  function exportRosa() {
    const lines = ['CASO ROSA · RIUNIONE D’ÉQUIPE', 'Caso inventato · Metodologie Operative · Terzo anno', ''];
    fields().filter(el => el.id.startsWith('eq_caso_') || el.id.startsWith('eq_rosa_')).forEach(el => {
      const label = document.querySelector(`label[for="${el.id}"]`).textContent;
      const value = el.tagName === 'SELECT' ? el.selectedOptions[0]?.textContent : el.value;
      lines.push(label, el.value.trim() ? value : '[Non compilato]', '');
    });
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'caso-rosa-le-mie-risposte.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.addEventListener('mo:identity-change', () => { window.__moDatiCaricati = {}; closeLim(); });
  ['input', 'change'].forEach(type => document.addEventListener(type, event => {
    if (event.target.matches('main textarea, main select')) saveGuest();
  }));
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('apri-lim').addEventListener('click', openLim);
    document.getElementById('chiudi-lim').addEventListener('click', () => { closeLim(); document.getElementById('apri-lim').focus(); });
    document.getElementById('aggiorna-lim').addEventListener('click', loadLim);
    ['lim-classe', 'lim-momento'].forEach(id => document.getElementById(id).addEventListener(id === 'lim-classe' ? 'input' : 'change', () => clearLim('Premi “Leggi le risposte” per la selezione attuale.')));
    document.getElementById('esporta-rosa').addEventListener('click', exportRosa);
    requestAnimationFrame(() => {
      const tools = document.getElementById('identity-tools');
      ['studentLabel', 'resetStudent'].forEach(id => { const el = document.getElementById(id); if (el) tools.append(el); });
    });
  });
})();
