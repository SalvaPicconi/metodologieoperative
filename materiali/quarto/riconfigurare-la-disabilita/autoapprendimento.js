(() => {
  const namespace = 'metodologie-operative-disabilita-modulo1:';
  const vistaDocente = new URLSearchParams(location.search).has('docente');
  const status = document.getElementById('stato-risposte');
  let storageAvailable = true;

  try {
    localStorage.setItem(namespace + 'disponibile', '1');
    localStorage.removeItem(namespace + 'disponibile');
  } catch (error) {
    storageAvailable = false;
    status.hidden = false;
    status.textContent = 'Il salvataggio in questo browser non è disponibile.';
  }

  function read(key) {
    if (!storageAvailable) return null;
    return localStorage.getItem(namespace + key);
  }

  // Ogni risposta resta anche nel browser e avvisa il salvataggio sul sito (assets/progress-global.js),
  // che la invia con classe e codice dell'alunno (25/11/2026).
  function avvisaSito() {
    document.getElementById('contenuto')?.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function save(key, value, silenzioso) {
    if (!storageAvailable) return;
    try {
      localStorage.setItem(namespace + key, value);
    } catch (error) {
      status.hidden = false;
      status.textContent = 'Il browser non ha salvato l’ultima risposta.';
    }
    if (!silenzioso) avvisaSito();
  }

  function chiavi() {
    return [
      ...Array.from(document.querySelectorAll('[data-risposta-aperta]'), field => field.name),
      ...Array.from(document.querySelectorAll('.verifica-attiva'), activity => activity.dataset.chiave),
    ].filter(Boolean);
  }

  // Ponte con il salvataggio sul sito: raccoglie le risposte del browser e, al ritorno, riporta nel browser
  // quelle salvate sul sito.
  window.MORiconfigura = {
    raccogli() {
      const dati = {};
      chiavi().forEach(key => {
        const value = read(key);
        if (value !== null && value !== '') dati[key] = value;
      });
      return dati;
    },
    scrivi(dati) {
      let cambiato = false;
      chiavi().forEach(key => {
        const value = typeof dati[key] === 'string' ? dati[key] : '';
        if (value === (read(key) ?? '')) return;
        cambiato = true;
        if (value) save(key, value, true);
        else if (storageAvailable) localStorage.removeItem(namespace + key);
      });
      return cambiato;
    },
    avvisaSito,
  };

  function normalize(answer) {
    return answer.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('it')
      .replace(/[.,;:!?«»“”"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function gradedFeedback(output, state, text) {
    output.dataset.stato = state;
    output.textContent = text;
  }

  function clearFeedback(output) {
    output.textContent = '';
    delete output.dataset.stato;
  }

  function previousAnswers(activity) {
    const legacyKey = 'risposta-' + activity.id;
    if (activity.dataset.chiave === legacyKey) return;
    const keys = [legacyKey];
    if (activity.id === 'applica-mappa') {
      keys.push('risposta-mappa-partecipazione', 'risposta-mappa-facilitatore');
    }
    const answers = keys.map(read).filter(answer => answer?.trim());
    if (!answers.length) return;
    const details = document.createElement('details');
    details.className = 'approfondimento';
    const summary = document.createElement('summary');
    summary.textContent = 'Le tue risposte della versione precedente';
    details.append(summary);
    answers.forEach(answer => {
      const paragraph = document.createElement('p');
      paragraph.textContent = answer;
      details.append(paragraph);
    });
    activity.append(details);
  }

  function choiceExercise(activity, output, stored) {
    const options = Array.from(activity.querySelectorAll('input[type="radio"]'));
    options.forEach(option => {
      option.checked = option.value === stored;
      option.addEventListener('change', () => {
        save(activity.dataset.chiave, option.value);
        clearFeedback(output);
      });
    });
    return () => {
      const answer = options.find(option => option.checked);
      if (!answer) {
        gradedFeedback(output, 'vuoto', 'Seleziona una risposta.');
      } else if (answer.hasAttribute('data-corretta')) {
        gradedFeedback(output, 'corretto', 'Corretto. ' + activity.dataset.spiegazione);
      } else {
        gradedFeedback(output, 'riprova', 'Non ancora. ' + answer.dataset.commento);
      }
    };
  }

  function wordExercise(activity, output, stored, checkButton) {
    const input = activity.querySelector('input[type="text"]');
    const accepted = input.dataset.accettate.split('|').map(normalize);
    input.value = stored ?? '';
    input.addEventListener('input', () => {
      save(activity.dataset.chiave, input.value);
      clearFeedback(output);
    });
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      checkButton.click();
    });
    return () => {
      const answer = normalize(input.value);
      if (!answer) {
        gradedFeedback(output, 'vuoto', 'Scrivi il termine richiesto.');
      } else if (accepted.includes(answer)) {
        gradedFeedback(output, 'corretto', 'Corretto. ' + activity.dataset.spiegazione);
      } else {
        gradedFeedback(output, 'riprova', 'Non ancora. ' + activity.dataset.indizio);
      }
    };
  }

  function placementExercise(activity, output, stored) {
    const cards = new Map(Array.from(activity.querySelectorAll('[data-carta]'),
      button => [button.dataset.carta, button]));
    const targetButtons = Array.from(activity.querySelectorAll('[data-posizione]'));
    const targets = targetButtons.map(button => ({
      button,
      label: button.previousElementSibling.textContent,
      text: button.querySelector('[data-testo-posizione]'),
      status: button.nextElementSibling,
    }));
    const actionStatus = activity.querySelector('[data-stato-carte]');
    const removeButton = activity.querySelector('[data-rimuovi]');
    const positions = Array(targets.length).fill(null);
    let selected = null;
    let dragging = null;

    function restorePositions(answer) {
      positions.fill(null);
      try {
        const saved = JSON.parse(answer);
        if (Array.isArray(saved) && saved.length === positions.length) {
          saved.forEach((value, index) => {
            if (cards.has(value) && !positions.includes(value)) positions[index] = value;
          });
        }
      } catch (error) {
        // A value from an earlier version may use a different format.
      }
    }

    if (vistaDocente) {
      // Gli abbinamenti non sono campi del modulo. Mostra le tessere dell’elaborato caricato dal sito.
      window.addEventListener('mo:progress-restored', event => {
        restorePositions(event.detail.data?.[activity.dataset.chiave]);
        render();
      });
    } else {
      restorePositions(stored);
    }

    function render() {
      cards.forEach((card, value) => {
        card.hidden = positions.includes(value);
        card.setAttribute('aria-pressed', String(selected === value));
      });
      targets.forEach((target, index) => {
        const value = positions[index];
        target.text.textContent = value ? cards.get(value).textContent : 'Inserisci un concetto';
        target.button.draggable = Boolean(value);
        target.button.setAttribute('aria-pressed', String(value !== null && selected === value));
      });
      removeButton.disabled = selected === null || !positions.includes(selected);
    }

    function select(value) {
      selected = selected === value ? null : value;
      actionStatus.textContent = selected
        ? 'Selezionato: ' + cards.get(selected).textContent + ' Scegli una posizione.'
        : 'Selezione annullata.';
      render();
    }

    function clearResults() {
      clearFeedback(output);
      targets.forEach(target => {
        target.status.textContent = '';
        delete target.status.dataset.stato;
      });
    }

    function commitChange(message) {
      selected = null;
      save(activity.dataset.chiave, JSON.stringify(positions));
      clearResults();
      render();
      actionStatus.textContent = message;
    }

    function place(value, index) {
      const origin = positions.indexOf(value);
      if (origin === index) {
        select(value);
        return;
      }
      const displaced = positions[index];
      positions[index] = value;
      if (origin >= 0) positions[origin] = displaced;
      commitChange('Inserito in «' + targets[index].label + '».');
    }

    cards.forEach((button, value) => button.addEventListener('click', () => select(value)));
    targets.forEach(({ button }, index) => {
      button.addEventListener('click', () => {
        if (selected) {
          place(selected, index);
        } else if (positions[index]) {
          select(positions[index]);
        } else {
          actionStatus.textContent = 'Seleziona prima un concetto.';
        }
      });
      button.addEventListener('dragover', event => {
        if (dragging === null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      });
      button.addEventListener('drop', event => {
        if (dragging === null) return;
        event.preventDefault();
        place(dragging, index);
        dragging = null;
      });
    });

    activity.addEventListener('dragstart', event => {
      const origin = event.target.closest('[data-carta], [data-posizione]');
      const value = origin?.dataset.carta ?? positions[Number(origin?.dataset.posizione)];
      if (!cards.has(value)) return;
      dragging = value;
      event.dataTransfer.setData('text/plain', value);
      event.dataTransfer.effectAllowed = 'move';
    });
    activity.addEventListener('dragend', () => { dragging = null; });

    removeButton.addEventListener('click', () => {
      const origin = positions.indexOf(selected);
      if (origin < 0) return;
      const restored = cards.get(selected);
      positions[origin] = null;
      commitChange('Il concetto è tornato tra quelli disponibili.');
      restored.focus();
    });
    render();

    return () => {
      const complete = positions.every(Boolean);
      let correctCount = 0;
      targets.forEach((target, index) => {
        const value = positions[index];
        const isCorrect = value === target.button.dataset.attesa;
        if (isCorrect) correctCount++;
        target.status.dataset.stato = isCorrect ? 'corretto' : 'riprova';
        target.status.textContent = isCorrect ? 'Corretto' : value ? 'Da rivedere' : 'Da completare';
      });

      if (correctCount === positions.length) {
        gradedFeedback(output, 'corretto', 'Corretto. ' + activity.dataset.spiegazione);
      } else if (!complete) {
        gradedFeedback(output, 'vuoto', 'Completa le posizioni vuote. ' + activity.dataset.indizio);
      } else {
        gradedFeedback(output, 'riprova', correctCount + ' su ' + positions.length + ' in posizione corretta. ' + activity.dataset.indizio);
      }
    };
  }

  document.querySelectorAll('[data-risposta-aperta]').forEach(field => {
    field.value = read(field.name) ?? '';
    field.addEventListener('input', () => save(field.name, field.value));
  });

  document.querySelectorAll('.verifica-attiva').forEach(activity => {
    const output = activity.querySelector('[data-esito]');
    const checkButton = activity.querySelector('[data-controlla]');
    const stored = read(activity.dataset.chiave);
    const kind = activity.dataset.tipo;
    let check;
    if (kind === 'scelta') check = choiceExercise(activity, output, stored);
    if (kind === 'completamento') check = wordExercise(activity, output, stored, checkButton);
    if (kind === 'abbinamento') check = placementExercise(activity, output, stored);
    checkButton.addEventListener('click', check);
    // La soluzione statica resta disponibile senza JavaScript.
    const solution = activity.querySelector(':scope > details.approfondimento');
    if (solution) solution.hidden = true;
    previousAnswers(activity);
  });
})();
