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
        if (mode === 45) {
            return [
                { name: 'Apertura del fascicolo', minutes: 4, instruction: 'Leggi il caso come un giallo. Non spiegare quali dettagli saranno importanti.', script: '«Questa è una scena del crimine professionale: nessuna vittima, molti indizi e un sabotatore invisibile.»' },
                { name: 'Ruoli e missione segreta', minutes: 5, instruction: 'Assegna testimoni e ruoli, fai pescare le Missioni e spiega i richiami «Indizio sbloccato!» e «Sabotaggio!».', script: '«I testimoni non mentono. Le squadre, invece, possono innamorarsi di una pista falsa: tenete gli occhi aperti.»' },
                { name: 'Interrogatori lampo', minutes: 10, instruction: 'Le squadre partono da postazioni diverse e ruotano ogni due minuti. Chi attende lavora alla Base investigativa.', script: '«Non chiedete chi è il colpevole. Chiedete: che cosa hai osservato, deciso e comunicato?»' },
                { name: 'Caccia alle prove', minutes: 8, instruction: 'Scopri le otto prove. Le squadre scelgono quelle decisive e scartano almeno una pista debole.', script: '«Un indizio fa atmosfera; una prova spiega un passaggio. Non sono la stessa cosa.»' },
                { name: 'Accusa e soluzione', minutes: 7, instruction: 'Ogni squadra completa il foglio e prepara l’accusa corale: tutti devono pronunciare almeno una parte.', script: '«La squadra vincente non è quella che indovina: è quella che dimostra e sa correggersi.»' },
                { name: 'Rivelazione', minutes: 4, instruction: 'Raccogli due ipotesi diverse, poi apri la soluzione docente.', script: '«Il sabotatore non porta un nome e cognome: è un errore di metodo che può tornare.»' },
                { name: 'Debriefing', minutes: 7, instruction: 'Usa due domande finali e chiudi con l’exit ticket individuale.', script: '«Che cosa vi ha ingannato? Che cosa farete diversamente nel prossimo caso?»' }
            ];
        }

        if (mode === 90) {
            return [
                { name: 'Apertura del fascicolo', minutes: 7, instruction: 'Leggi il caso come un giallo senza spiegare quali indizi siano importanti.', script: '«Questa è una scena del crimine professionale: nessuna vittima, molti indizi e un sabotatore invisibile.»' },
                { name: 'Ruoli e regole', minutes: 8, instruction: 'Assegna testimoni e ruoli, fai pescare le Missioni e spiega i richiami «Indizio sbloccato!» e «Sabotaggio!».', script: '«Le carte non si mostrano. I testimoni dicono il vero, ma il dettaglio riservato si conquista con una domanda pertinente.»' },
                { name: 'Interrogatori', minutes: 18, instruction: 'Le squadre partono da postazioni diverse e ruotano ogni due o tre minuti. Chi attende lavora alla Base investigativa.', script: '«Non chiedete: chi è il colpevole? Chiedete: che cosa hai visto, che cosa hai fatto, a chi l’hai comunicato?»' },
                { name: 'Tavolo delle prove', minutes: 15, instruction: 'Scopri le otto prove. Ogni squadra costruisce la cronologia e distingue fatti, inferenze e piste deboli.', script: '«Una prova non vale perché sembra convincente: vale se spiega un passaggio del percorso.»' },
                { name: 'Missione segreta', minutes: 8, instruction: 'Ogni squadra esegue la propria carta senza rivelarla alle altre. Assegna il bonus solo se rispetta la consegna.', script: '«Avete otto minuti per guadagnare il punto più difficile: quello che premia il modo in cui collaborate.»' },
                { name: 'Imprevisto', minutes: 10, instruction: 'Leggi l’imprevisto del caso. Le squadre devono modificare almeno una parte dell’ipotesi o motivare perché la confermano.', script: '' },
                { name: 'Accusa motivata', minutes: 10, instruction: 'Ogni squadra completa il foglio e prepara l’accusa corale: tutti devono pronunciare almeno una parte.', script: '«Non basta trovare una risposta: dovete dimostrare perché regge e come ripara il percorso.»' },
                { name: 'Rivelazione', minutes: 5, instruction: 'Raccogli due accuse diverse, poi apri la soluzione docente e confronta il ragionamento.', script: '«La soluzione non premia chi indovina il nome: premia chi dimostra il meccanismo.»' },
                { name: 'Debriefing', minutes: 9, instruction: 'Usa le domande finali. Chiudi con l’exit ticket individuale.', script: '«Prima scopriamo che cosa ci ha ingannato; poi fissiamo la regola professionale che portiamo via.»' }
            ];
        }

        return [
            { name: 'Apertura del fascicolo', minutes: 5, instruction: 'Leggi il caso come un giallo senza spiegare quali indizi siano importanti.', script: '«Questa è una scena del crimine professionale: nessuna vittima, molti indizi e un sabotatore invisibile.»' },
            { name: 'Ruoli e regole', minutes: 6, instruction: 'Assegna testimoni e ruoli, fai pescare le Missioni e spiega i richiami «Indizio sbloccato!» e «Sabotaggio!».', script: '«I testimoni non mentono. Il segreto si conquista soltanto con una domanda pertinente.»' },
            { name: 'Interrogatori', minutes: 14, instruction: 'Le squadre partono da postazioni diverse e ruotano ogni due minuti. Chi attende lavora alla Base investigativa.', script: '«Domandate che cosa è stato osservato, deciso e comunicato. Scrivete fatti, non impressioni.»' },
            { name: 'Tavolo delle prove', minutes: 10, instruction: 'Scopri le otto prove. Ogni squadra costruisce la cronologia e distingue fatti, inferenze e piste deboli.', script: '«Scegliete le prove che spiegano il blocco, non quelle che fanno soltanto atmosfera.»' },
            { name: 'Missione segreta', minutes: 5, instruction: 'Ogni squadra esegue la propria carta senza rivelarla alle altre. Assegna il bonus solo se rispetta la consegna.', script: '«Questo punto non si vince indovinando: si vince collaborando meglio.»' },
            { name: 'Accusa motivata', minutes: 8, instruction: 'Ogni squadra completa il foglio e prepara l’accusa corale: tutti devono pronunciare almeno una parte.', script: '«La risposta vale solo se sapete provarla e trasformarla in una soluzione praticabile.»' },
            { name: 'Rivelazione', minutes: 4, instruction: 'Raccogli due accuse diverse, poi apri la soluzione docente e confronta il ragionamento.', script: '«Il sabotatore non è una persona: è il passaggio che tutti potevano vedere e nessuno ha collegato.»' },
            { name: 'Debriefing', minutes: 8, instruction: 'Usa due o tre domande finali. Chiudi con l’exit ticket individuale.', script: '«Che cosa vi ha ingannato? Quale regola professionale portate via?»' }
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

    const renderMissions = (missions) => {
        const items = missions.map((mission) => {
            const li = document.createElement('li');
            const title = document.createElement('strong');
            title.textContent = mission.titolo;
            const text = document.createElement('span');
            text.textContent = ` — ${mission.testo} ${mission.bonus}`;
            li.append(title, text);
            return li;
        });
        byId('secret-missions').replaceChildren(...items);
    };

    const renderRoleGuide = (scenario) => {
        const witnesses = scenario.testimoni.map((witness, index) => {
            const li = document.createElement('li');
            li.textContent = `${index + 1}. ${witness.ruolo}`;
            return li;
        });
        byId('witness-role-list').replaceChildren(...witnesses);

        const roleDefinitions = scenario.compitiRuoli || scenario.ruoliSquadra.map((role) => ({ ruolo: role, compito: '' }));
        const roleEntries = roleDefinitions.flatMap((role) => {
            const term = document.createElement('dt');
            term.textContent = role.ruolo;
            if (!role.compito) return [term];
            const description = document.createElement('dd');
            description.textContent = role.compito;
            return [term, description];
        });
        byId('team-role-list').replaceChildren(...roleEntries);

        const roles = scenario.ruoliSquadra;
        byId('role-plan-3').innerHTML = `<strong>Squadra da 3:</strong> ${roles[0]}; ${roles[1]}; una persona unisce ${roles[2]} e ${roles[3]}.`;
        byId('role-plan-2').innerHTML = `<strong>Squadra da 2:</strong> una persona unisce ${roles[0]} e ${roles[3]}; l’altra unisce ${roles[1]} e ${roles[2]}.`;
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
        byId('guide-scope').textContent = scenario.id === '3sa'
            ? 'Questa è la guida completa della 3SA: spiegazione, vittoria, ruoli sostituibili e distribuzione dei materiali. La console più sotto serve quando la partita è iniziata.'
            : `Per ${scenario.classe} resta disponibile la struttura precedente; la revisione completa sarà svolta in una sessione dedicata.`;
        byId('case-story').textContent = scenario.storia;
        byId('case-mission').textContent = scenario.missione;
        byId('accusation-question').textContent = scenario.domandaAccusa;
        byId('forbidden-phrase').textContent = `«${scenario.parolaVietata}»`;
        byId('case-surprise').textContent = scenario.imprevisto;
        byId('solution-title').textContent = scenario.soluzione.colpevole;
        byId('solution-explanation').textContent = scenario.soluzione.spiegazione;
        listInto(byId('prior-threads'), scenario.fili);
        listInto(byId('case-objectives'), scenario.obiettivi);
        listInto(byId('solution-proofs'), scenario.soluzione.prove);
        listInto(byId('solution-repair'), scenario.soluzione.riparazione);
        listInto(byId('debrief-list'), scenario.debrief);
        renderMissions(scenario.missioniSegrete);
        renderRoleGuide(scenario);
        byId('guide-pack-link').href = packPaths[scenario.id];
        byId('guide-pack-link').textContent = `Apri il mazzo ${scenario.classe}`;
        byId('solution-panel').open = false;
        setPhase(0);
    };

    const pluralTeams = (groups) => groups === 1 ? 'squadra investigativa' : 'squadre investigative';

    const renderGroupSuggestion = () => {
        const input = byId('student-count');
        const count = Math.max(3, Math.min(36, Number.parseInt(input.value, 10) || 24));
        input.value = count;
        const witnesses = count >= 11 ? 5 : count >= 10 ? 4 : count >= 6 ? 3 : 0;
        const investigators = count - witnesses;
        const teams = Math.min(6, Math.max(1, Math.round(investigators / 3)));
        const baseSize = Math.floor(investigators / teams);
        const remainder = investigators % teams;
        const sizes = Array.from({ length: teams }, (_, index) => baseSize + (index < remainder ? 1 : 0));
        const frequencies = [...new Set(sizes)].sort((a, b) => b - a).map((size) => {
            const frequency = sizes.filter((value) => value === size).length;
            return `${frequency} ${frequency === 1 ? 'squadra' : 'squadre'} da ${size}`;
        });
        const roles = state.currentCase.ruoliSquadra.join(', ');
        const witnessText = witnesses === 5
            ? '5 testimoni, una carta ciascuno'
            : witnesses === 4
                ? '4 testimoni; l’ultimo interpreta anche il quinto'
                : witnesses === 3
                    ? '3 testimoni che si dividono le cinque carte'
                    : 'nessun testimone fisso; il docente interpreta le cinque carte';
        const winText = teams === 1 ? ' La squadra gioca contro il sabotatore e vince con almeno 7 punti su 10.' : '';
        byId('group-suggestion').innerHTML = `<strong>Assetto consigliato con ${count} presenti:</strong> ${witnessText} + ${teams} ${pluralTeams(teams)} (${frequencies.join(' e ')}). Ruoli da distribuire o accorpare: ${roles}.${winText}`;
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
        timer.classList.toggle('is-done', state.remaining <= 0);
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
                document.body.classList.add('time-up');
                window.setTimeout(() => document.body.classList.remove('time-up'), 1200);
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
            const url = new URL(window.location.href);
            url.searchParams.set('classe', state.currentCase.id);
            window.history.replaceState({}, '', url);
            renderCase();
            renderGroupSuggestion();
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
            const requestedCase = new URLSearchParams(window.location.search).get('classe');
            state.currentCase = data.classi.find((scenario) => scenario.id === requestedCase) || data.classi[0];
            bindEvents();
            renderCase();
            renderGroupSuggestion();
        })
        .catch((error) => {
            document.querySelector('main').innerHTML = `<section class="local-warning"><strong>Impossibile caricare gli scenari.</strong> Avvia la pagina dal server locale del sito. Dettaglio: ${error.message}</section>`;
        });
})();
