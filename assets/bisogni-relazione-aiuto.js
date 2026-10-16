/* Bisogni: strumenti della nuova attività; i moduli condivisi gestiscono identità e RPC. */
(() => {
  'use strict';
  const PAGE = '/materiali/biennio/bisogni-relazione-aiuto.html';
  const GUEST_KEY = 'mo:bisogni:guest:v1';
  const fields = () => Array.from(document.querySelectorAll('main textarea, main select'));
  let preserved = {};
  let requestVersion = 0;
  const feedback = {
    fatto: {
      fatto: 'Sì: è un comportamento descritto nel caso. Non dice ancora perché Samuele sia rimasto da solo.',
      ipotesi: 'Qui viene riportato ciò che è accaduto. Un’ipotesi cercherebbe di spiegarne il motivo, che ancora non conosciamo.',
      domanda: 'La frase descrive un comportamento; non chiede un’informazione. La domanda viene dopo, per comprenderlo.'
    },
    ipotesi: {
      fatto: 'Il timore non è stato raccontato da Samuele: lo stiamo ipotizzando. Occorre verificarlo con lui.',
      ipotesi: 'Sì: “forse” segnala una spiegazione possibile. Potrebbero esserci altre spiegazioni.',
      domanda: 'La frase propone una spiegazione. Per trasformarla in domanda potremmo chiedere come si trova con i compagni.'
    },
    domanda: {
      fatto: 'Non racconta un fatto già noto: invita Samuele a dare un’informazione sul suo punto di vista.',
      ipotesi: 'Non anticipa una spiegazione: lascia a Samuele la possibilità di descrivere la propria esperienza.',
      domanda: 'Sì: è una domanda aperta. La risposta può confermare o cambiare la nostra lettura.'
    },
    servizio: {
      centro: 'È una proposta pertinente al desiderio espresso: attività e incontri. Va concordata con Ada e resta da verificare il tragitto; il centro non include il trasporto.',
      sportello: 'Lo sportello può aiutare se emergono altre difficoltà. Da solo, però, non risponde al desiderio già espresso di tornare alla ceramica e incontrare persone.',
      famiglia: 'Figlia e vicino sono risorse possibili, con disponibilità da verificare. Non possono essere dati per disponibili sempre, né scegliere al posto di Ada.'
    }
  };
  function collect() {
    return Object.fromEntries(fields().map(el => [el.name || el.id, el.value]));
  }
  window.MOBisogni = {
    merge(data) {
      const all = { ...preserved, ...data };
      const list = fields();
      all._meta = { ...(preserved._meta || {}), campiCompilati: list.filter(el => el.value.trim()).length, totale: list.length };
      all._meta.percentuale = list.length ? Math.round(all._meta.campiCompilati / list.length * 100) : 0;
      return all;
    },
    restore(saved) {
      let value = saved;
      if (!value && document.body.dataset.moGuest === 'true') {
        try { value = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null'); } catch { value = null; }
      }
      preserved = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
      // L'ospite usa solo la sua bozza: non importare il fallback generico di un altro accesso.
      return { ...preserved };
    }
  };
  function updateFeedback(el) {
    const box = el.nextElementSibling;
    if (!box?.classList.contains('feedback')) return;
    box.textContent = feedback[el.dataset.feedback]?.[el.value] || '';
  }
  function updateAll() { fields().filter(el => el.dataset.feedback).forEach(updateFeedback); }
  function saveGuest() {
    if (document.body.dataset.moGuest !== 'true') return;
    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify(window.MOBisogni.merge(collect())));
      document.getElementById('stato-lavoro').textContent = 'Ospite: lavoro conservato soltanto in questo browser.';
    } catch {
      document.getElementById('stato-lavoro').textContent = 'Memoria del browser non disponibile: scarica le risposte prima di chiudere.';
    }
  }
  window.addEventListener('mo:identity-change', () => { preserved = {}; closeLim(); });
  window.addEventListener('mo:progress-restored', e => {
    if (e.detail?.data && typeof e.detail.data === 'object') preserved = { ...e.detail.data };
    updateAll();
  });
  document.addEventListener('input', e => {
    if (e.target.matches('main textarea, main select')) saveGuest();
  });
  document.addEventListener('change', e => {
    if (e.target.matches('main select[data-feedback]')) updateFeedback(e.target);
    if (e.target.matches('main textarea, main select')) saveGuest();
  });
  function exportText() {
    const lines = ['BISOGNI UMANI E RELAZIONE D’AIUTO', 'Metodologie Operative · lavoro personale', ''];
    fields().forEach(el => {
      const label = document.querySelector(`label[for="${el.id}"]`)?.textContent || el.id;
      const value = el instanceof HTMLSelectElement ? el.selectedOptions[0]?.textContent : el.value;
      lines.push(label, value?.trim() && el.value ? value : '[Non compilato]', '');
    });
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'bisogni-le-mie-risposte.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function preparePrint() {
    document.querySelectorAll('.print-answer').forEach(el => el.remove());
    fields().forEach(el => {
      const div = document.createElement('div'); div.className = 'print-answer';
      div.textContent = el.value ? (el instanceof HTMLSelectElement ? el.selectedOptions[0].textContent : el.value) : '________________________________________________________________';
      el.insertAdjacentElement('afterend', div);
    });
  }
  function closeLim() {
    requestVersion++;
    document.getElementById('pannello-lim').hidden = true;
    document.getElementById('lim-risposte').replaceChildren();
    document.getElementById('lim-stato').textContent = '';
    document.body.classList.remove('lim');
  }
  async function openLim() {
    if (!window.MODocente) return;
    if (!(await window.MODocente.assicura())) return;
    document.getElementById('pannello-lim').hidden = false;
    document.body.classList.add('lim');
    const cls = document.getElementById('lim-classe');
    const saved = localStorage.getItem('mo:class') || '';
    if (!cls.value && /^[1-5][a-z]{1,2}$/.test(saved)) cls.value = saved;
    cls.focus();
    document.getElementById('pannello-lim').scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  async function loadLim() {
    const version = ++requestVersion;
    const cls = document.getElementById('lim-classe').value.trim().toLowerCase();
    const stage = document.getElementById('lim-tappa').value;
    const panel = document.getElementById('lim-risposte');
    const status = document.getElementById('lim-stato');
    const button = document.getElementById('aggiorna-lim');
    panel.replaceChildren();
    if (!/^[1-5][a-z]{1,2}$/.test(cls)) { status.textContent = 'Inserisci una classe valida, per esempio 1sa.'; return; }
    if (!(await window.MODocente.assicura())) return;
    button.disabled = true; status.textContent = 'Lettura delle risposte…';
    try {
      const result = await window.MODocente.chiama('progress_docente_classe', { p_class_code: cls, p_page_path: PAGE });
      if (version !== requestVersion || document.getElementById('pannello-lim').hidden) return;
      const rows = (Array.isArray(result) ? result : []).map(row => {
        try { const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data; return data && typeof data === 'object' ? data : {}; } catch { return {}; }
      });
      status.textContent = `${cls.toUpperCase()} · ${rows.length} lavori salvati · tappa ${stage}.`;
      if (!rows.length) { status.textContent += ' Nessuna risposta disponibile per questa pagina.'; return; }
      const keys = Array.from(document.querySelectorAll(`#tappa${stage} textarea, #tappa${stage} select`));
      keys.forEach(el => {
        const answers = rows.map(data => data[el.name || el.id]).filter(value => typeof value === 'string' && value.trim());
        if (!answers.length) return;
        // Raggruppamento per domanda: nessun codice, nome o numero persistente dello studente.
        answers.sort((a, b) => a.localeCompare(b, 'it'));
        const section = document.createElement('section'); section.className = 'lim-risposta';
        const h = document.createElement('h3'); h.textContent = document.querySelector(`label[for="${el.id}"]`).textContent;
        const list = document.createElement('ol');
        answers.forEach(answer => {
          const li = document.createElement('li');
          if (el instanceof HTMLSelectElement) {
            li.textContent = Array.from(el.options).find(option => option.value === answer)?.textContent || 'Scelta non più disponibile';
          } else li.textContent = answer;
          list.append(li);
        });
        section.append(h, list); panel.append(section);
      });
      if (!panel.childElementCount) status.textContent += ' Nessuna risposta compilata in questa tappa.';
    } catch (error) {
      if (version === requestVersion) { panel.replaceChildren(); status.textContent = window.MODocente.messaggioErrore(error); }
    } finally { button.disabled = false; }
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('esporta-lavoro').addEventListener('click', exportText);
    document.getElementById('stampa-lavoro').addEventListener('click', () => { preparePrint(); window.print(); });
    document.getElementById('apri-lim').addEventListener('click', openLim);
    document.getElementById('chiudi-lim').addEventListener('click', () => { closeLim(); document.getElementById('apri-lim').focus(); });
    document.getElementById('aggiorna-lim').addEventListener('click', loadLim);
    document.getElementById('lim-tappa').addEventListener('change', () => {
      requestVersion++; document.getElementById('lim-risposte').replaceChildren(); document.getElementById('lim-stato').textContent = 'Premi “Leggi le risposte” per la tappa scelta.';
    });
    document.getElementById('lim-classe').addEventListener('input', () => {
      requestVersion++; document.getElementById('lim-risposte').replaceChildren(); document.getElementById('lim-stato').textContent = 'Premi “Leggi le risposte” per la classe scelta.';
    });
    requestAnimationFrame(() => {
      const tools = document.getElementById('identity-tools');
      ['studentLabel', 'resetStudent'].forEach(id => { const el = document.getElementById(id); if (el) tools.append(el); });
    });
    updateAll();
  });
  window.addEventListener('beforeprint', preparePrint);
})();
