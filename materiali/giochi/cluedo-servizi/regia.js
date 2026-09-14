(() => {
    'use strict';

    const state = {
        data: null,
        currentCase: null,
        mode: 60,
        phaseIndex: 0,
        remaining: 0,
        timerId: null
    };

    const byId = (id) => document.getElementById(id);

    const phasesFor = (mode) => {
        if (mode === 90) {
            return [
                { name: 'Apertura del caso', minutes: 7, instruction: 'Leggi il dossier senza spiegare quali indizi siano importanti.', script: '«Non cerchiamo una persona colpevole. Cerchiamo il passaggio che ha fatto fallire il progetto.»' },
                { name: 'Ruoli e regole', minutes: 8, instruction: 'Nomina cinque testimoni. Dividi gli altri in squadre e fai assegnare interrogatore, archivista e cartografo.', script: '«Le carte non si mostrano. I testimoni dicono il vero, ma consegnano il dettaglio riservato solo a una domanda pertinente.»' },
                { name: 'Interrogatori', minutes: 18, instruction: 'Le squadre ruotano tra le cinque postazioni. Due o tre minuti per incontro, poi cambio.', script: '«Non chiedete: chi è il colpevole? Chiedete: che cosa hai visto, che cosa hai fatto, a chi l’hai comunicato?»' },
                { name: 'Tavolo delle prove', minutes: 15, instruction: 'Scopri le otto prove. Ogni squadra costruisce la cronologia e distingue fatti, inferenze e piste deboli.', script: '«Una prova non vale perché sembra convincente: vale se spiega un passaggio del percorso.»' },
                { name: 'Imprevisto', minutes: 10, instruction: 'Leggi l’imprevisto del caso. Le squadre devono modificare almeno una parte dell’ipotesi o motivare perché la confermano.', script: '' },
                { name: 'Accusa motivata', minutes: 10, instruction: 'Ogni squadra compila: errore, due codici-prova, sequenza di riparazione e un’ipotesi da scartare.', script: '«Non basta nominare il servizio giusto: dovete spiegare perché viene prima e che cosa accade dopo.»' },
                { name: 'Rivelazione', minutes: 5, instruction: 'Raccogli due accuse diverse, poi apri la soluzione docente e confronta il ragionamento.', script: '«La soluzione non premia chi indovina il nome: premia chi dimostra il meccanismo.»' },
                { name: 'Debriefing', minutes: 17, instruction: 'Usa le domande finali. Chiudi con l’exit ticket individuale.', script: '«Prima parliamo di come avete pensato e collaborato; poi fissiamo che cosa abbiamo ripreso sui servizi.»' }
            ];
        }

        return [
            { name: 'Apertura del caso', minutes: 5, instruction: 'Leggi il dossier senza spiegare quali indizi siano importanti.', script: '«Non cerchiamo una persona colpevole. Cerchiamo il passaggio che ha fatto fallire il progetto.»' },
            { name: 'Ruoli e regole', minutes: 5, instruction: 'Nomina cinque testimoni. Dividi gli altri in squadre e fai assegnare interrogatore, archivista e cartografo.', script: '«Le carte non si mostrano. I testimoni dicono il vero, ma consegnano il dettaglio riservato solo a una domanda pertinente.»' },
            { name: 'Interrogatori', minutes: 12, instruction: 'Le squadre ruotano tra le cinque postazioni. Circa due minuti per incontro, poi cambio.', script: '«Domandate che cosa è stato osservato, deciso e comunicato. Scrivete parole precise, non impressioni.»' },
            { name: 'Tavolo delle prove', minutes: 10, instruction: 'Scopri le otto prove. Ogni squadra costruisce la cronologia e distingue fatti, inferenze e piste deboli.', script: '«Scegliete le prove che spiegano il blocco, non quelle che fanno soltanto atmosfera.»' },
            { name: 'Accusa motivata', minutes: 8, instruction: 'Ogni squadra compila: errore, due codici-prova, sequenza di riparazione e un’ipotesi da scartare.', script: '«Non basta nominare il servizio giusto: dovete spiegare perché viene prima e che cosa accade dopo.»' },
            { name: 'Rivelazione', minutes: 5, instruction: 'Raccogli due accuse diverse, poi apri la soluzione docente e confronta il ragionamento.', script: '«La soluzione non premia chi indovina il nome: premia chi dimostra il meccanismo.»' },
            { name: 'Debriefing', minutes: 15, instruction: 'Usa le domande finali. Chiudi con l’exit ticket individuale.', script: '«Prima parliamo di come avete pensato e collaborato; poi fissiamo che cosa abbiamo ripreso sui servizi.»' }
        ];
    };

    const packPaths = {
        '3sa': '../../../output/pdf/cluedo-servizi-3sa.pdf',
        '3sb': '../../../output/pdf/cluedo-servizi-3sb.pdf',
        '4sb': '../../../output/pdf/cluedo-servizi-4sb.pdf',
        '5sa': '../../../output/pdf/cluedo-servizi-5sa.pdf'
    };

    const listInto = (element, items) => {
        element.replaceChildren(...items.map((item) => {
            const li = document.createElement('li');
            li.textContent = item;
            return li;
        }));
    };

    const renderTabs = () => {
        const container = byId('class-tabs');
        container.replaceChildren(...state.data.classi.map((scenario) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.role = 'tab';
            button.dataset.caseId = scenario.id;
            button.textContent = scenario.classe;
            button.setAttribute('aria-selected', String(scenario.id === state.currentCase.id));
            button.classList.toggle('is-active', scenario.id === state.currentCase.id);
            return button;
        }));
    };

    const renderCase = () => {
        const scenario = state.currentCase;
        renderTabs();
        byId('class-badge').textContent = scenario.classe;
        byId('case-focus').textContent = scenario.focus;
        byId('case-title').textContent = scenario.caso;
        byId('case-story').textContent = scenario.storia;
        byId('case-mission').textContent = scenario.missione;
        byId('case-surprise').textContent = scenario.imprevisto;
        byId('solution-title').textContent = scenario.soluzione.colpevole;
        byId('solution-explanation').textContent = scenario.soluzione.spiegazione;
        listInto(byId('prior-threads'), scenario.fili);
        listInto(byId('case-objectives'), scenario.obiettivi);
        listInto(byId('solution-proofs'), scenario.soluzione.prove);
        listInto(byId('solution-repair'), scenario.soluzione.riparazione);
        listInto(byId('debrief-list'), scenario.debrief);
        byId('pack-link').href = packPaths[scenario.id];
        byId('pack-link').textContent = `Apri le carte ${scenario.classe} da stampare`;
        byId('solution-panel').open = false;
        setPhase(0);
    };

    const pluralTeams = (groups) => groups === 1 ? 'squadra investigativa' : 'squadre investigative';

    const renderGroupSuggestion = () => {
        const input = byId('student-count');
        const count = Math.max(8, Math.min(36, Number.parseInt(input.value, 10) || 24));
        input.value = count;
        const witnesses = 5;
        const investigators = count - witnesses;
        const teams = Math.max(1, Math.round(investigators / 3));
        const baseSize = Math.floor(investigators / teams);
        const remainder = investigators % teams;
        const sizes = Array.from({ length: teams }, (_, index) => baseSize + (index < remainder ? 1 : 0));
        const frequencies = [...new Set(sizes)].sort((a, b) => b - a).map((size) => {
            const frequency = sizes.filter((value) => value === size).length;
            return `${frequency} ${frequency === 1 ? 'squadra' : 'squadre'} da ${size}`;
        });
        byId('group-suggestion').innerHTML = `<strong>Assetto consigliato:</strong> 5 testimoni fissi + ${teams} ${pluralTeams(teams)} (${frequencies.join(' e ')}). Nelle squadre: interrogatore, archivista e cartografo; se sono in quattro aggiungi il verificatore.`;
    };

    const stopTimer = () => {
        if (state.timerId !== null) {
            window.clearInterval(state.timerId);
            state.timerId = null;
        }
        byId('timer-toggle').textContent = 'Avvia timer';
    };

    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const renderTimer = () => {
        const timer = byId('timer');
        timer.textContent = formatTime(state.remaining);
        timer.classList.toggle('is-ending', state.remaining <= 60);
    };

    const setPhase = (index) => {
        stopTimer();
        const phases = phasesFor(state.mode);
        state.phaseIndex = Math.max(0, Math.min(phases.length - 1, index));
        const phase = phases[state.phaseIndex];
        state.remaining = phase.minutes * 60;
        byId('phase-number').textContent = state.phaseIndex + 1;
        byId('phase-total').textContent = phases.length;
        byId('phase-name').textContent = `${phase.name} · ${phase.minutes} min`;
        byId('phase-instruction').textContent = phase.instruction;
        byId('phase-script').textContent = phase.name === 'Imprevisto' ? `«${state.currentCase.imprevisto}»` : phase.script;
        byId('prev-phase').disabled = state.phaseIndex === 0;
        byId('next-phase').disabled = state.phaseIndex === phases.length - 1;
        renderTimer();
    };

    const toggleTimer = () => {
        if (state.timerId !== null) {
            stopTimer();
            return;
        }
        if (state.remaining <= 0) {
            setPhase(state.phaseIndex);
        }
        byId('timer-toggle').textContent = 'Pausa';
        state.timerId = window.setInterval(() => {
            state.remaining -= 1;
            renderTimer();
            if (state.remaining <= 0) {
                stopTimer();
            }
        }, 1000);
    };

    const setMode = (mode) => {
        state.mode = mode;
        document.querySelectorAll('.mode-button').forEach((button) => {
            button.classList.toggle('is-active', Number(button.dataset.mode) === mode);
        });
        setPhase(0);
    };

    const bindEvents = () => {
        byId('class-tabs').addEventListener('click', (event) => {
            const button = event.target.closest('[data-case-id]');
            if (!button) return;
            state.currentCase = state.data.classi.find((scenario) => scenario.id === button.dataset.caseId);
            renderCase();
        });

        document.querySelectorAll('.mode-button').forEach((button) => {
            button.addEventListener('click', () => setMode(Number(button.dataset.mode)));
        });

        document.querySelectorAll('[data-count-change]').forEach((button) => {
            button.addEventListener('click', () => {
                const input = byId('student-count');
                input.value = Number(input.value || 24) + Number(button.dataset.countChange);
                renderGroupSuggestion();
            });
        });

        byId('student-count').addEventListener('input', renderGroupSuggestion);
        byId('prev-phase').addEventListener('click', () => setPhase(state.phaseIndex - 1));
        byId('next-phase').addEventListener('click', () => setPhase(state.phaseIndex + 1));
        byId('timer-toggle').addEventListener('click', toggleTimer);
        byId('reset-timer').addEventListener('click', () => setPhase(state.phaseIndex));

        byId('projection-toggle').addEventListener('click', () => {
            const active = document.body.classList.toggle('projection');
            const button = byId('projection-toggle');
            button.setAttribute('aria-pressed', String(active));
            button.textContent = active ? 'Esci dalla proiezione' : 'Modalità proiezione';
        });

        document.addEventListener('keydown', (event) => {
            const tag = event.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (event.code === 'Space') {
                event.preventDefault();
                toggleTimer();
            } else if (event.code === 'ArrowRight') {
                setPhase(state.phaseIndex + 1);
            } else if (event.code === 'ArrowLeft') {
                setPhase(state.phaseIndex - 1);
            } else if (event.code === 'Escape' && document.body.classList.contains('projection')) {
                byId('projection-toggle').click();
            }
        });
    };

    fetch('scenari.json')
        .then((response) => {
            if (!response.ok) throw new Error(`Errore ${response.status}`);
            return response.json();
        })
        .then((data) => {
            state.data = data;
            state.currentCase = data.classi[0];
            bindEvents();
            renderCase();
            renderGroupSuggestion();
        })
        .catch((error) => {
            document.querySelector('main').innerHTML = `<section class="local-warning"><strong>Impossibile caricare gli scenari.</strong> Avvia la pagina dal server locale del sito. Dettaglio: ${error.message}</section>`;
        });
})();
