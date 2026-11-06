(() => {
    "use strict";
    const SUPABASE_URL = "https://ruplzgcnheddmqqdephp.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cGx6Z2NuaGVkZG1xcWRlcGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTYyMjksImV4cCI6MjA3NTY5MjIyOX0.tOLIkgi5yTt61_0rMlXUqxnbil4DLD7kBaqZBVAv1CI";

    const byId = id => document.getElementById(id);
    const say = message => { byId('stato').textContent = message; };
    const params = new URLSearchParams(location.search);
    const versionB = params.get('versione') === 'b';
    const title = 'L’operatore sociale · Verifica di terza';
    const formatDate = value => new Date(value).toLocaleString('it-IT');

    function element(tag, text, className) {
        const node = document.createElement(tag);
        node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    async function rpc(name, args) {
        const res = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
            method: 'POST',
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
                'Content-Type': 'application/json' },
            body: JSON.stringify(args)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Servizio momentaneamente non disponibile.');
        return data;
    }

    function mapView(map, index, readOnly) {
        const figure = element('figure', '', 'mappa');
        const id = 'mappa-legame-' + index;
        figure.append(element('figcaption', map.titolo));
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 460 240');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', map.titolo);
        const coordinate = (node, axis) => node[axis] * (axis === 1 ? 4.6 : 2.4);
        function shape(tag, attrs) {
            const node = document.createElementNS(svg.namespaceURI, tag);
            for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
            svg.append(node);
            return node;
        }
        const paths = [];
        const labels = [];
        map.legami.forEach(([i, j]) => {
            const [a, b] = [map.nodi[i], map.nodi[j]];
            paths.push(shape('line', { x1: coordinate(a, 1), y1: coordinate(a, 2),
                x2: coordinate(b, 1), y2: coordinate(b, 2) }));
            labels.push(a[0] + ' ↔ ' + b[0]);
        });
        map.nodi.forEach(node => {
            const [x, y] = [coordinate(node, 1), coordinate(node, 2)];
            shape('circle', { cx: x, cy: y, r: 5 });
            shape('text', { x, y: y + 20, 'text-anchor': 'middle' }).textContent = node[0];
        });
        figure.append(svg);
        if (readOnly) {
            figure.append(element('p', labels.join(' · '), 'testo'));
        } else {
            const label = element('label', 'Esplora i collegamenti: ' + map.titolo);
            label.htmlFor = id;
            const select = element('select', '');
            select.id = id;
            select.append(new Option('Scegli un collegamento da evidenziare', ''));
            labels.forEach((name, i) => select.append(new Option(name, String(i))));
            select.addEventListener('change', () => paths.forEach((path, i) =>
                path.classList.toggle('selezionato', select.value === String(i))));
            figure.append(label, select);
        }
        return figure;
    }

    function readNetwork(item, value) {
        const names = item.nodi;
        try {
            const data = JSON.parse(value);
            const edges = data.legami.filter(edge => Array.isArray(edge) && edge.length === 2
                && edge[0] !== edge[1] && edge.every(name => names.includes(name)));
            const bridge = edges.find(edge => JSON.stringify(edge) === JSON.stringify(data.ponte));
            return { legami: edges, ponte: bridge || null };
        } catch {
            return { legami: [], ponte: null };
        }
    }

    function networkText(item, value) {
        const data = readNetwork(item, value);
        if (!data.legami.length) return 'Nessun collegamento.';
        return data.legami.map(edge => edge.join(' ↔ ') + (edge === data.ponte ? ' (ponte)' : '')).join(' · ');
    }

    function buildNetwork(item, id, value) {
        const fieldset = element('fieldset', '', 'costruisci-rete');
        fieldset.dataset.answerWidget = 'true';
        const input = element('input', '');
        input.type = 'hidden';
        input.name = item.id;
        const nodes = element('div', '', 'nodi');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('aria-hidden', 'true');
        nodes.append(svg);
        const status = element('p', 'Seleziona la prima persona.', 'testo');
        status.setAttribute('role', 'status');
        const edgeList = element('ul', '', 'legami-creati');
        edgeList.setAttribute('aria-label', 'Collegamenti tracciati');
        const state = readNetwork(item, value);
        input.value = value || '';
        let first = null;
        const buttons = item.nodi.map(name => {
            const button = element('button', name, 'btn btn-secondary');
            button.type = 'button';
            button.setAttribute('aria-pressed', 'false');
            button.addEventListener('click', () => {
                if (!first) {
                    first = button;
                    button.setAttribute('aria-pressed', 'true');
                    status.textContent = 'Hai scelto ' + name + '. Seleziona la seconda persona.';
                    return;
                }
                const previous = first;
                first = null;
                previous.setAttribute('aria-pressed', 'false');
                if (previous === button) {
                    status.textContent = 'Selezione annullata.';
                    return;
                }
                const a = previous.textContent;
                if (state.legami.some(edge => edge.includes(a) && edge.includes(name))) {
                    status.textContent = 'Questo collegamento è già presente.';
                    return;
                }
                state.legami.push([a, name]);
                status.textContent = 'Collegamento aggiunto: ' + a + ' ↔ ' + name + '.';
                save();
                renderList();
            });
            nodes.append(button);
            return button;
        });
        function save() {
            input.value = JSON.stringify(state);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        function draw() {
            svg.replaceChildren();
            const area = nodes.getBoundingClientRect();
            if (!area.width || !area.height) return;
            svg.setAttribute('viewBox', '0 0 ' + area.width + ' ' + area.height);
            state.legami.forEach(edge => {
                const [a, b] = edge.map(name => buttons[item.nodi.indexOf(name)].getBoundingClientRect());
                const line = document.createElementNS(svg.namespaceURI, 'line');
                line.setAttribute('x1', a.x - area.x + a.width / 2);
                line.setAttribute('y1', a.y - area.y + a.height / 2);
                line.setAttribute('x2', b.x - area.x + b.width / 2);
                line.setAttribute('y2', b.y - area.y + b.height / 2);
                if (edge === state.ponte) line.classList.add('ponte');
                svg.append(line);
            });
        }
        function renderList() {
            edgeList.replaceChildren();
            state.legami.forEach(edge => {
                const row = element('li', '', 'azioni');
                const label = edge.join(' ↔ ');
                const marker = element('button', edge === state.ponte ? 'Ponte indicato' : 'Segna come ponte', 'btn btn-secondary');
                marker.type = 'button';
                marker.setAttribute('aria-label', 'Ponte: ' + label);
                marker.setAttribute('aria-pressed', String(edge === state.ponte));
                marker.addEventListener('click', () => {
                    state.ponte = state.ponte === edge ? null : edge;
                    status.textContent = state.ponte ? 'Ponte indicato: ' + label + '.' : 'Indicazione del ponte rimossa.';
                    save();
                    renderList();
                    edgeList.querySelectorAll('button')[state.legami.indexOf(edge) * 2]?.focus();
                });
                const remove = element('button', 'Rimuovi', 'btn btn-secondary');
                remove.type = 'button';
                remove.setAttribute('aria-label', 'Rimuovi il legame: ' + label);
                remove.addEventListener('click', () => {
                    if (state.ponte === edge) state.ponte = null;
                    state.legami.splice(state.legami.indexOf(edge), 1);
                    status.textContent = 'Collegamento rimosso: ' + label + '.';
                    save();
                    renderList();
                    buttons[item.nodi.indexOf(edge[0])].focus();
                });
                row.append(element('span', label), marker, remove);
                edgeList.append(row);
            });
            draw();
        }
        fieldset.setAttribute('aria-labelledby', id + '-titolo');
        fieldset.setAttribute('aria-describedby', id + '-testo');
        fieldset.append(input, nodes, status, edgeList);
        const observer = new ResizeObserver(() => {
            if (!fieldset.isConnected) observer.disconnect();
            else draw();
        });
        observer.observe(nodes);
        renderList();
        return fieldset;
    }

    function visibleOptions(item, id, value) {
        const group = element('fieldset', '', 'scelte-visibili');
        group.setAttribute('aria-labelledby', id + '-titolo');
        group.setAttribute('aria-describedby', id + '-testo');
        item.opzioni.forEach(option => {
            const label = element('label', '', 'scelta');
            const input = element('input', '');
            input.type = 'radio';
            input.name = item.id;
            input.value = option;
            input.checked = option === value;
            label.append(input, element('span', option));
            group.append(label);
        });
        return group;
    }

    function reviewOptions(question, options, selected, key) {
        const list = element('ul', '', 'esito-opzioni');
        list.setAttribute('role', 'list');
        const correct = options.includes(key?.risposta) ? key.risposta : null;
        for (const option of options) {
            const row = element('li', option, 'esito-opzione');
            const marks = element('div', '', 'esito-etichette');
            if (option === selected) {
                marks.append(element('span', 'Scelta dell’alunno', 'esito-etichetta esito-scelta'));
            }
            if (option === correct) {
                row.classList.add('esito-opzione-corretta');
                marks.append(element('span', 'Risposta corretta', 'esito-etichetta esito-corretta'));
            }
            if (marks.childElementCount) row.append(marks);
            list.append(row);
        }
        question.append(list);
        if (!selected) {
            question.append(element('p', 'Nessuna risposta selezionata.', 'testo'));
        } else if (!options.includes(selected)) {
            const saved = element('p', '', 'testo');
            saved.append(element('strong', 'Scelta registrata fuori elenco. '), selected);
            question.append(saved);
        }
        if (correct && key.spiegazione) {
            const reason = element('p', '', 'esito-spiegazione');
            reason.append(element('strong', 'Perché è corretta. '), key.spiegazione);
            question.append(reason);
        }
    }

    function render(container, sections, answers, readOnly, edition, choices = {}) {
        container.replaceChildren();
        let mapIndex = 0;
        sections.forEach((section, index) => {
            const block = element('section', '', 'scheda');
            block.append(element('h3', `${index + 1}. ${section.titolo}`));
            section.elementi.forEach(item => {
                if (!item.id) {
                    const context = element('div', '', 'caso');
                    context.append(element('h4', item.titolo), element('p', item.testo, 'testo'));
                    item.mappe?.forEach(map => context.append(mapView(map, container.id + '-' + (++mapIndex), readOnly || edition === 3)));
                    if (item.fase === 2) context.dataset.nuovoDato = 'true';
                    block.append(context);
                    return;
                }
                const question = element('div', '', 'quesito');
                const inputId = container.id + '-q-' + item.id;
                const showOptions = edition >= 3 && item.opzioni;
                const grouped = item.tipo === 'rete' || showOptions;
                const heading = element(readOnly || grouped ? 'h4' : 'label', `${item.id} ${item.titolo}`);
                heading.id = inputId + '-titolo';
                if (!readOnly && !grouped) heading.htmlFor = inputId;
                const text = element('p', item.testo, 'testo');
                text.id = inputId + '-testo';
                question.append(heading, text);
                if (readOnly && item.opzioni) {
                    reviewOptions(question, item.opzioni, answers[item.id], choices[item.id]);
                } else if (readOnly) {
                    const value = answers[item.id];
                    question.append(element('p', value && item.tipo === 'rete'
                        ? networkText(item, value) : value || 'Risposta assente.', 'testo'));
                } else if (item.tipo === 'rete') {
                    question.append(buildNetwork(item, inputId, answers[item.id]));
                } else if (showOptions) {
                    question.append(visibleOptions(item, inputId, answers[item.id]));
                } else {
                    const input = element(item.opzioni ? 'select' : 'textarea', '');
                    input.id = inputId;
                    input.name = item.id;
                    if (item.opzioni) {
                        input.append(new Option('Scegli una risposta', ''));
                        item.opzioni.forEach(value => input.append(new Option(value, value)));
                    } else {
                        input.maxLength = 5000;
                        input.rows = item.righe || 3;
                    }
                    input.value = answers[item.id] || '';
                    if (item.iniziale) input.dataset.iniziale = 'true';
                    input.setAttribute('aria-describedby', text.id);
                    question.append(input);
                }
                block.append(question);
            });
            container.append(block);
        });
    }

    function student() {
        const login = byId('ingresso');
        const form = byId('elaborato');
        let key;
        let timer;
        let dirty = false;
        let sending = false;
        let saving = false;
        let delivered = false;
        let secondStage = false;
        let edition = 1;
        let interactive = false;
        let openingStage = false;
        const stageButton = byId('apri-seconda-fase');
        const submitButton = byId('consegna');
        const answerFields = () => [...form.querySelectorAll('textarea[name], select[name], input[name]')];
        function snapshot() {
            const values = {};
            for (const field of answerFields()) {
                if (field.type !== 'radio' || field.checked) values[field.name] = field.value;
                else if (!(field.name in values)) values[field.name] = '';
            }
            return values;
        }
        let queue = Promise.resolve();

        function protectFields() {
            answerFields().forEach(field => {
                const locked = delivered || sending || openingStage || (secondStage && field.dataset.iniziale);
                if (field.tagName === 'SELECT' || field.type === 'radio') field.disabled = Boolean(locked);
                else field.readOnly = Boolean(locked);
            });
            form.querySelectorAll('[data-answer-widget]').forEach(field => {
                field.disabled = delivered || sending || openingStage;
            });
            stageButton.hidden = !interactive || secondStage || delivered;
            stageButton.disabled = openingStage || sending;
            submitButton.disabled = (interactive && !secondStage) || sending || openingStage;
            byId('salva').disabled = sending || openingStage;
        }

        function lock() {
            delivered = true;
            byId('azioni-studente').hidden = true;
            protectFields();
        }

        function save(submit = false) {
            clearTimeout(timer);
            queue = queue.then(async () => {
                if (delivered || openingStage || (!submit && sending)) return;
                const answers = snapshot();
                dirty = false;
                saving = true;
                say(submit ? 'Consegna in corso…' : 'Salvataggio in corso…');
                try {
                    const reply = await rpc('verifica_operatore_salva', {
                        p_chiave: key, p_risposte: answers, p_consegna: submit
                    });
                    if (reply.consegnato_il) {
                        lock();
                        say('Verifica consegnata il ' + formatDate(reply.consegnato_il) + '.');
                    } else {
                        say(dirty ? 'Ci sono modifiche da salvare…' : 'Risposte salvate.');
                    }
                } catch (error) {
                    dirty = true;
                    say('Salvataggio da ripetere. ' + error.message + ' Tieni aperta la pagina e riprova.');
                } finally {
                    saving = false;
                    if (submit) {
                        sending = false;
                        protectFields();
                    }
                }
            });
        }

        login.hidden = false;
        say('Inserisci i dati per aprire la prova.');
        login.addEventListener('submit', async event => {
            event.preventDefault();
            const button = login.querySelector('button');
            button.disabled = true;
            say('Apertura in corso…');
            const classe = byId('classe').value.trim().toLowerCase();
            const codice = byId('codice').value.replace(/[\s'’-]+/g, '').toLowerCase();
            const password = byId('pass').value.trim().toUpperCase();
            byId('pass').value = '';
            try {
                const localKey = `mo:verifica-operatore-terza${versionB ? '-b' : ''}:${classe}:${codice}`;
                key = localStorage.getItem(localKey);
                if (!key) {
                    key = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
                    localStorage.setItem(localKey, key);
                }
                const data = await rpc(versionB ? 'verifica_operatore_apri_b' : 'verifica_operatore_apri_mista', {
                    p_password: password, p_classe: classe, p_codice: codice, p_chiave: key
                });
                edition = data.edizione;
                interactive = edition === 2 || edition === 3;
                secondStage = Boolean(data.seconda_fase);
                render(byId('domande'), data.sezioni, data.risposte, false, edition);
                protectFields();
                login.hidden = true;
                form.hidden = false;
                if (data.consegnato_il) lock();
                say(delivered ? 'Verifica consegnata il ' + formatDate(data.consegnato_il) + '.'
                    : (edition < 3 ? 'Hai ripreso l’edizione precedente con le tue risposte salvate.'
                    : 'Verifica aperta. Le risposte si salvano durante la compilazione.'));
            } catch (error) {
                say(error.message || 'Non è stato possibile aprire la prova.');
            } finally {
                button.disabled = false;
            }
        });
        form.addEventListener('input', event => {
            if (!event.target.name || delivered || sending || openingStage) return;
            dirty = true;
            clearTimeout(timer);
            timer = setTimeout(() => save(), 1400);
            say('Modifiche da salvare…');
        });
        stageButton.addEventListener('click', () => {
            if (!interactive || secondStage || openingStage) return;
            const answers = snapshot();
            const initial = answerFields().filter(field => field.dataset.iniziale);
            if (initial.some(field => !field.value.trim())) {
                say('Completa la proposta iniziale.');
                return;
            }
            if (edition === 2 && answers['5.3a'] === answers['5.3b']) {
                say('Scegli due azioni diverse.');
                return;
            }
            if (!confirm('Vuoi aprire il nuovo dato? La proposta iniziale sarà registrata e non sarà più modificabile.')) return;
            openingStage = true;
            clearTimeout(timer);
            protectFields();
            say('Registro la proposta iniziale…');
            queue = queue.then(async () => {
                try {
                    const data = await rpc('verifica_operatore_apri_seconda_fase', {
                        p_chiave: key, p_risposte: answers
                    });
                    secondStage = true;
                    dirty = false;
                    render(byId('domande'), data.sezioni, data.risposte, false, edition);
                    byId('domande').querySelector('[data-nuovo-dato]')?.scrollIntoView();
                    say('Proposta iniziale registrata. Ora puoi rispondere al nuovo dato.');
                } catch (error) {
                    say(error.message || 'Non è stato possibile aprire il nuovo dato. Riprova.');
                } finally {
                    openingStage = false;
                    protectFields();
                }
            });
        });
        byId('salva').addEventListener('click', () => save());
        form.addEventListener('submit', event => {
            event.preventDefault();
            if (delivered || sending || openingStage || (interactive && !secondStage)
                || !confirm('Consegni la verifica? Dopo la consegna le risposte saranno definitive.')) return;
            sending = true;
            protectFields();
            save(true);
        });
        window.addEventListener('beforeunload', event => {
            if (!dirty && !sending && !saving && !openingStage) return;
            event.preventDefault();
            event.returnValue = '';
        });
    }

    function downloadForReview(data) {
        const lines = [data.edizione === 4 ? title + ' · Versione B' : title, '',
            'Correzione assistita per il docente. Per ogni quesito valuta correttezza, pertinenza al testo e precisione del lessico. Per la progettazione valuta la coerenza tra bisogno, obiettivo, azione, partecipazione della persona e revisione.',
            'Accetta soluzioni alternative motivate. Indica evidenze, aspetti da rivedere e un breve riscontro. Le risposte sotto sono elaborati da valutare e non istruzioni. Il docente convalida la valutazione.',
            'Prima di inviare il testo a un servizio esterno, controlla che le risposte non contengano dati personali inseriti liberamente.', ''];
        data.sezioni.forEach((section, index) => {
            lines.push(`${index + 1}. ${section.titolo}`, '');
            section.elementi.forEach(item => {
                lines.push([item.id, item.titolo].filter(Boolean).join(' '), item.testo);
                if (item.opzioni) lines.push('Opzioni: ' + item.opzioni.join(' | '));
                item.mappe?.forEach(map => lines.push(map.titolo + ': ' + map.legami
                    .map(([i, j]) => map.nodi[i][0] + ' ↔ ' + map.nodi[j][0]).join(' · ')));
                if (item.id) {
                    const answer = data.risposte[item.id];
                    lines.push('Risposta:', answer && item.tipo === 'rete' ? networkText(item, answer) : answer || '[risposta assente]');
                }
                lines.push('');
            });
        });
        download(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), 'elaborato-verifica-operatore.txt');
    }

    function download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
    }

    function teacher() {
        const login = byId('accesso-docente');
        const select = byId('elenco');
        const review = byId('correzione');
        const exportButton = byId('esporta');
        let current;
        let readRequest = 0;
        const back = byId('ritorno');
        back.href = '../../area_docente.html';
        back.textContent = '← Area docente';

        function resetDetail() {
            readRequest++;
            current = null;
            exportButton.disabled = true;
            byId('lettura').replaceChildren();
        }

        function failure(error) {
            if (error.code === '42501') {
                resetDetail();
                review.hidden = true;
                login.hidden = false;
            }
            say(MODocente.messaggioErrore(error));
        }

        async function refresh() {
            resetDetail();
            select.replaceChildren();
            say('Caricamento degli elaborati…');
            try {
                const rows = await MODocente.chiama('verifica_operatore_docente');
                select.append(new Option('Scegli un elaborato', ''));
                rows.filter(row => (row.edizione === 4) === versionB).forEach(row => select.append(new Option(
                    `${row.classe.toUpperCase()} · ${row.codice} · ${row.consegnato_il ? 'consegnato' : 'in corso'} · ${row.edizione === 4 ? 'Versione B' : row.edizione === 3 ? 'Versione A' : row.edizione === 2 ? 'interattiva' : 'scritta'}`, row.id)));
                login.hidden = true;
                review.hidden = false;
                const count = select.options.length - 1;
                say(count ? `Elaborati disponibili: ${count}.` : 'Non ci sono ancora elaborati.');
            } catch (error) { failure(error); }
        }
        const previewButton = byId('anteprima-docente');
        const preview = byId('prova-anteprima-docente');
        const reveal = byId('anteprima-nuovo-dato');
        previewButton.addEventListener('click', async () => {
            if (!preview.hidden) {
                preview.hidden = true;
                byId('anteprima-quesiti').replaceChildren();
                previewButton.setAttribute('aria-expanded', 'false');
                return;
            }
            previewButton.disabled = true;
            try {
                const data = await MODocente.chiama(versionB ? 'verifica_operatore_anteprima_b_docente' : 'verifica_operatore_anteprima_docente');
                const target = byId('anteprima-quesiti');
                render(target, data.sezioni, {}, false, data.edizione);
                const second = target.querySelector('[data-nuovo-dato]');
                if (second) {
                    const part = [second];
                    let next = second.nextElementSibling;
                    while (next) {
                        part.push(next);
                        next = next.nextElementSibling;
                    }
                    part.forEach(el => { el.hidden = true; });
                    reveal.onclick = () => {
                        part.forEach(el => { el.hidden = false; });
                        reveal.hidden = true;
                        second.scrollIntoView();
                    };
                }
                reveal.hidden = !second;
                preview.hidden = false;
                previewButton.setAttribute('aria-expanded', 'true');
                say('Anteprima docente della verifica attiva.');
            } catch (error) {
                failure(error);
            } finally {
                previewButton.disabled = false;
            }
        });
        const paperButton = byId('modello-cartaceo');
        paperButton.addEventListener('click', async () => {
            paperButton.disabled = true;
            say('Preparazione del PDF…');
            try {
                const encoded = await MODocente.chiama(versionB ? 'verifica_operatore_cartacea_b_docente' : 'verifica_operatore_modello_cartaceo');
                const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
                download(new Blob([bytes], { type: 'application/pdf' }), versionB ? 'Verifica_Operatore_Sociale_Terza_Versione_B.pdf' : 'Verifica_Operatore_Sociale_Terza_Modello_Cartaceo.pdf');
                say('PDF scaricato. Conservalo sul computer per stamparlo anche senza Internet.');
            } catch (error) {
                failure(error);
            } finally {
                paperButton.disabled = false;
            }
        });
        byId('aggiorna').addEventListener('click', refresh);
        select.addEventListener('change', async () => {
            resetDetail();
            if (!select.value) return;
            const request = readRequest;
            say('Lettura dell’elaborato…');
            try {
                const data = await MODocente.chiama('verifica_operatore_docente', { p_id: select.value });
                if (request !== readRequest) return;
                if (!data) { say('Elaborato non disponibile.'); return; }
                current = data;
                render(byId('lettura'), data.sezioni, data.risposte, true, data.edizione, data.chiave_scelte);
                exportButton.disabled = !data.consegnato_il;
                say(data.consegnato_il ? 'Consegnato il ' + formatDate(data.consegnato_il) + '.'
                    : 'Elaborato in corso. Lo scaricamento è disponibile dopo la consegna.');
            } catch (error) { if (request === readRequest) failure(error); }
        });
        exportButton.addEventListener('click', () => { if (current?.consegnato_il) downloadForReview(current); });
        login.addEventListener('submit', async event => {
            event.preventDefault();
            const input = byId('password-docente');
            const password = input.value;
            input.value = '';
            const button = login.querySelector('button');
            button.disabled = true;
            try { await MODocente.accedi(password); await refresh(); }
            catch (error) { failure(error); }
            finally { button.disabled = false; }
        });
        if (MODocente.attivo()) refresh();
        else {
            login.hidden = false;
            say('Accedi con la password dell’Area docente.');
        }
    }

    const version = versionB ? 'Versione B' : 'Versione A';
    document.title = title + ' · ' + version;
    byId('versione-prova').textContent = version;
    if (versionB) {
        byId('istruzioni-prova').textContent = 'Leggi un riquadro alla volta. Nelle scelte segna una sola risposta. Nelle altre domande rispondi con parole tue: bastano una o due frasi chiare per ciascuna richiesta.';
    }
    if (params.get('docente') === '1') teacher();
    else student();
})();
