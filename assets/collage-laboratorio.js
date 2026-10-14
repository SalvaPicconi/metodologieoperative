/* Laboratorio centrale e compatibilità con gli appunti già salvati. */
(() => {
  'use strict';
  const preview = document.body.dataset.preview === 'true';
  let legacyProgress = {};
  let quizChoices = {};
  let skillRatings = {};
  let previousExtras = {};
  const situationHint = document.getElementById('collage_situazione-hint');
  const aimHint = document.getElementById('collage_possibilita-hint');
  const defaultSituationHint = situationHint.textContent;
  const defaultAimHint = aimHint.textContent;

  function updateGuidance() {
    const title = document.getElementById('collage_nucleo').value.trim();
    const buttons = Array.from(document.querySelectorAll('[data-nucleus]'));
    const selected = buttons.find(button => button.dataset.nucleus === title);
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button === selected)));
    document.getElementById('selected-guide').hidden = !selected;
    document.getElementById('selected-visual').textContent = selected?.dataset.visual || '';
    situationHint.textContent = selected ? 'Esempio per «' + title + '»: ' + selected.dataset.situation + ' Scrivi qui il momento che riguarda te.' : defaultSituationHint;
    aimHint.textContent = selected ? 'Un’idea da cui partire: «' + selected.dataset.aim + '» Scrivi ciò che vuoi raccontare tu.' : defaultAimHint;
    document.getElementById('collage_situazione').placeholder = selected?.dataset.situation || 'Per esempio: quando devo parlare davanti alla classe…';
    document.getElementById('collage_possibilita').placeholder = selected?.dataset.aim || 'Per esempio: voglio mostrare che sono contento del lavoro e allo stesso tempo mi sento agitato…';
  }

  function restoreExtras(data) {
    const extras = data?.__collageLab;
    if (!extras || typeof extras !== 'object') return;
    previousExtras = { ...extras };
    quizChoices = extras.quizChoices || {};
    skillRatings = extras.skillRatings || {};
    repaintChoices();
    updateGuidance();
  }

  function readLocal() {
    if (preview) return;
    try {
      legacyProgress = JSON.parse(localStorage.getItem('collageProgress') || '{}');
      previousExtras = { ...(legacyProgress.collageLab || {}) };
      quizChoices = legacyProgress.collageLab?.quizChoices || {};
      skillRatings = legacyProgress.collageLab?.skillRatings || legacyProgress.skillRatings || {};
      document.querySelectorAll('textarea[id]').forEach(el => {
        const saved = localStorage.getItem(el.id);
        if (saved !== null) el.value = saved;
      });
    } catch (error) { console.warn('Gli appunti locali non sono disponibili.', error); }
  }

  function saveLocal() {
    if (preview) return;
    try {
      document.querySelectorAll('textarea[id]').forEach(el => { localStorage.setItem(el.id, el.value); });
      const progress = { ...legacyProgress, collageLab: window.collageLabExtras(), timestamp: new Date().toISOString() };
      localStorage.setItem('collageProgress', JSON.stringify(progress));
    } catch (error) { console.warn('Impossibile conservare gli appunti su questo dispositivo.', error); }
  }

  // I metadati precedenti restano disponibili: il nuovo percorso non li reinterpreta.
  window.collageLabExtras = () => ({ ...previousExtras, quizChoices: { ...quizChoices }, skillRatings: { ...skillRatings } });
  window.addEventListener('mo:progress-restored', event => { restoreExtras(event.detail?.data); });
  window.addEventListener('mo:identity-change', () => {
    legacyProgress = {};
    quizChoices = {};
    skillRatings = {};
    previousExtras = {};
    document.querySelectorAll('textarea, input[type="checkbox"]').forEach(el => {
      if (el.matches('textarea')) el.value = '';
      else el.checked = false;
    });
    if (!preview) {
      try {
        localStorage.removeItem('collageProgress');
        document.querySelectorAll('textarea[id]').forEach(el => { localStorage.removeItem(el.id); });
      } catch (_) { /* La pagina resta utilizzabile se lo storage non è disponibile. */ }
    }
    repaintChoices();
    updateGuidance();
  });

  const answers = { q1:'a', q2:'b', q3:'b', q4:'b', final1:'b', final2:'a', final3:'d', final4:'b', final5:'c', final6:'b', final7:'a', final8:'b', final9:'c', final10:'d' };
  function repaintChoices() {
    document.querySelectorAll('.quiz-option').forEach(el => {
      const chosen = quizChoices[el.dataset.quiz] === el.dataset.answer;
      el.classList.toggle('selected', chosen);
      el.setAttribute('aria-pressed', String(chosen));
    });
    document.querySelectorAll('.scale-option').forEach(el => {
      const chosen = String(skillRatings[el.dataset.skill]) === el.dataset.value;
      el.classList.toggle('selected', chosen);
      el.setAttribute('aria-pressed', String(chosen));
    });
  }

  function setupOptionalExercises() {
    document.querySelectorAll('.quiz-option, .scale-option').forEach(el => {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); el.click(); }
      });
      el.addEventListener('click', () => {
        if (el.classList.contains('quiz-option')) {
          quizChoices[el.dataset.quiz] = el.dataset.answer;
          const feedback = document.getElementById('feedback-' + el.dataset.quiz);
          if (feedback) {
            feedback.className = 'feedback show';
            feedback.setAttribute('role', 'status');
            feedback.textContent = answers[el.dataset.quiz] === el.dataset.answer ? 'Risposta corretta.' : 'Rivedi la scheda di ripasso e prova ancora.';
          }
        } else skillRatings[el.dataset.skill] = Number(el.dataset.value);
        repaintChoices();
        saveLocal();
        // Riusa il normale autosalvataggio della pagina, anche per i pulsanti di scelta.
        document.querySelector('textarea[id]')?.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  }

  function exportNotes() {
    const fields = [
      ['collage_nucleo', 'Il nucleo'], ['collage_situazione', 'La situazione'], ['collage_possibilita', 'Ciò che voglio esprimere o immaginare'],
      ['collage_sceltavisiva', 'La scelta visiva'], ['title', 'Titolo del collage'], ['collage_variante', 'La spiegazione delle scelte']
    ];
    let content = 'IL COLLAGE AUTOBIOGRAFICO\n' + new Date().toLocaleDateString('it-IT') + '\n';
    fields.forEach(([id, title]) => { const value = document.getElementById(id).value.trim(); if (value) content += '\n' + title + '\n' + value + '\n'; });
    content += '\nAPPUNTI ED ESERCITAZIONI PRECEDENTI\n';
    document.querySelectorAll('.previous-work textarea[id]').forEach(el => {
      if (el.value.trim()) {
        const heading = el.previousElementSibling?.textContent || el.id;
        content += '\n' + heading.trim() + '\n' + el.value.trim() + '\n';
      }
    });
    const url = URL.createObjectURL(new Blob([content], { type:'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'Collage_appunti_' + new Date().toISOString().slice(0,10) + '.txt';
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    readLocal();
    updateGuidance();
    setupOptionalExercises();
    repaintChoices();
    document.querySelectorAll('[data-nucleus]').forEach(button => button.addEventListener('click', () => {
      const field = document.getElementById('collage_nucleo');
      const feedback = document.getElementById('nucleus-feedback');
      field.value = button.dataset.nucleus;
      field.dispatchEvent(new Event('input', { bubbles:true }));
      feedback.textContent = 'Hai scelto «' + button.dataset.nucleus + '». Il primo campo è compilato; ora scrivi la tua situazione e ciò che vuoi raccontare.';
      updateGuidance();
      field.closest('.project-card').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start' });
      field.focus({ preventScroll:true });
    }));
    document.addEventListener('input', event => {
      if (event.target.id === 'collage_nucleo') updateGuidance();
      if (event.target.matches('textarea')) saveLocal();
    });
    document.getElementById('export-notes').addEventListener('click', exportNotes);
  });
})();
