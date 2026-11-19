const SAFE_ORIGIN = (window.location.origin && window.location.origin !== 'null') ? window.location.origin : '';
const SITE_BASE = SAFE_ORIGIN.replace(/\/$/, '');
const BASE_PATHNAME = (() => {
    try {
        const path = window.location.pathname || '';
        return path.substring(0, path.lastIndexOf('/')) || '';
    } catch {
        return '';
    }
})();
const SITE_ROOT = SITE_BASE ? `${SITE_BASE}${BASE_PATHNAME}` : (BASE_PATHNAME || '');

const STROOP_BASE_URL = `${SITE_ROOT}/materiali/compresenza/test-stroop.html`;
const SUPER_STORAGE_KEY = 'mo:super-impersonations';
const SUPER_SESSION_DURATION = 1000 * 60 * 15;
const PAGE_ALIAS_OVERRIDES = {
    'attivita-materiali-ai-verifica-ia-modificata-01': '/materiali/ai/verifica_ia_modificata.html',
    '/materiali/peer_tutoring_platform.html': '/materiali/peer_tutoring/peer_tutoring_platform.html',
    '/metodologieoperative/materiali/peer_tutoring_platform.html': '/materiali/peer_tutoring/peer_tutoring_platform.html',
    'materiali/peer_tutoring_platform.html': '/materiali/peer_tutoring/peer_tutoring_platform.html',
    'peer_tutoring_platform.html': '/materiali/peer_tutoring/peer_tutoring_platform.html'
};

const PROGRESS_LIMIT = 1000;
const ASSESSMENT_LIMIT = 200;
const RECENT_DAYS = 30;
const UNKNOWN_CLASS = 'Senza classe';
const collator = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });
const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: 'numeric' });

const dashboardState = {
    period: 'recent',
    classCode: '',
    view: 'activities',
    renderedClass: '',
    records: [],
    assessments: [],
    assessmentUnavailable: false,
    ready: false,
    progressIndex: new Map(),
    assessmentIndex: new Map(),
    titles: new Map(),
    limits: [],
    session: 0
};

const elements = {};
const byId = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
    Object.assign(elements, {
        overlay: byId('docente-auth-overlay'),
        dashboard: byId('docente-dashboard-content'),
        sessionActions: byId('docente-session-actions'),
        loginForm: byId('docente-login-form'),
        passwordInput: byId('docente-password'),
        refreshBtn: byId('refresh-dashboard'),
        lastRefresh: byId('dashboard-last-refresh'),
        period: byId('dashboard-period'),
        back: byId('dashboard-back'),
        classList: byId('dashboard-class-list'),
        studentSearch: byId('dashboard-student-search'),
        activityGroupsContainer: byId('activity-groups-container'),
        assessmentDetailBody: byId('assessment-detail-body'),
        assessmentInsights: byId('assessment-insights'),
        assessmentModal: byId('assessment-modal'),
        assessmentModalBody: byId('assessment-modal-body'),
        progressModal: byId('progress-modal'),
        progressModalBody: byId('progress-modal-body')
    });

    elements.loginForm.addEventListener('submit', handleLogin);
    elements.refreshBtn.addEventListener('click', refreshDashboard);
    elements.period.addEventListener('change', () => {
        dashboardState.period = elements.period.value;
        resetStudentSearch();
        renderDashboard();
    });
    elements.back.addEventListener('click', () => {
        dashboardState.classCode = '';
        renderDashboard();
        byId('dashboard-classes-title').focus();
    });
    elements.studentSearch.addEventListener('input', () => renderStudents(classRecords()));
    byId('docente-cambia-password').addEventListener('click', cambiaPasswordDocente);
    byId('docente-esci').addEventListener('click', () => {
        window.MODocente.esci();
        mostraAccesso();
    });

    elements.dashboard.addEventListener('click', event => {
        const classButton = event.target.closest('[data-select-class]');
        const viewButton = event.target.closest('[data-class-view]');
        const studentButton = event.target.closest('[data-show-student]');
        if (classButton) {
            dashboardState.classCode = classButton.dataset.selectClass;
            dashboardState.view = 'activities';
            resetStudentSearch();
            renderDashboard();
            byId('dashboard-class-title').focus();
        }
        if (viewButton) {
            dashboardState.view = viewButton.dataset.classView;
            if (dashboardState.view === 'students') resetStudentSearch();
            renderDashboard();
        }
        if (studentButton) {
            dashboardState.view = 'students';
            resetStudentSearch();
            renderDashboard();
            const student = [...byId('dashboard-student-list').querySelectorAll('details')]
                .find(item => item.dataset.student === studentButton.dataset.showStudent);
            if (student) {
                student.open = true;
                student.querySelector('summary').focus();
            }
        }
    });

    document.addEventListener('click', event => {
        const work = event.target.closest('[data-open-as-docente]');
        const assessment = event.target.closest('[data-assessment-detail]');
        const progress = event.target.closest('[data-progress-detail]');
        if (work) openActivityAsDocente(work.dataset);
        if (assessment) openAssessmentDetail(assessment.dataset.assessmentDetail);
        if (progress) openProgressDetail(progress.dataset.progressDetail);
    });

    if (window.MODocente?.attivo()) mostraDashboard();
});

function mostraDashboard() {
    elements.overlay.classList.add('hidden');
    elements.dashboard.classList.remove('hidden');
    elements.sessionActions.hidden = false;
    refreshDashboard();
}

function mostraAccesso(messaggio) {
    dashboardState.session++;
    dashboardState.ready = false;
    dashboardState.records = [];
    dashboardState.assessments = [];
    dashboardState.progressIndex.clear();
    dashboardState.assessmentIndex.clear();
    dashboardState.limits = [];
    dashboardState.classCode = '';
    dashboardState.period = 'recent';
    dashboardState.view = 'activities';
    resetStudentSearch();
    for (const modal of [elements.progressModal, elements.assessmentModal]) {
        if (modal.open) modal.close();
    }
    for (const container of [
        elements.classList, elements.activityGroupsContainer, byId('dashboard-student-list'),
        byId('dashboard-stats'), byId('dashboard-class-title'), elements.assessmentInsights,
        elements.assessmentDetailBody, elements.progressModalBody, elements.assessmentModalBody,
        byId('dashboard-data-note')
    ]) container.replaceChildren();
    elements.dashboard.classList.add('hidden');
    elements.sessionActions.hidden = true;
    elements.overlay.classList.remove('hidden');
    if (messaggio) alert(messaggio);
    elements.passwordInput.focus();
}

async function handleLogin(event) {
    event.preventDefault();
    const button = elements.loginForm.querySelector('button');
    if (button.disabled) return;
    button.disabled = true;
    try {
        await window.MODocente.accedi(elements.passwordInput.value);
        elements.passwordInput.value = '';
        mostraDashboard();
        elements.period.focus();
    } catch (error) {
        alert(window.MODocente.messaggioErrore(error));
        elements.passwordInput.focus();
    } finally {
        button.disabled = false;
    }
}

async function cambiaPasswordDocente() {
    const attuale = prompt('Password attuale:');
    if (attuale === null) return;
    const nuova = prompt('Nuova password (almeno 10 caratteri; conta la differenza fra maiuscole e minuscole):');
    if (nuova === null) return;
    const conferma = prompt('Ripeti la nuova password:');
    if (conferma === null) return;
    if (nuova !== conferma) { alert('Le due password nuove non coincidono.'); return; }
    try {
        await window.MODocente.cambiaPassword(attuale, nuova);
        alert('Password cambiata. Da ora vale la nuova, anche per la modalità LIM e per le statistiche Stroop.');
    } catch (error) {
        alert(window.MODocente.messaggioErrore(error));
    }
}

async function refreshDashboard() {
    if (elements.refreshBtn.disabled) return;
    const session = dashboardState.session;
    elements.refreshBtn.disabled = true;
    elements.lastRefresh.textContent = 'Caricamento dati…';
    const initial = !dashboardState.ready;
    if (initial) renderDashboard();
    try {
        const [progress, stroop, titles] = await Promise.all([
            window.MODocente.chiama('progress_docente_elenco', { p_limite: PROGRESS_LIMIT }),
            fetchAssessmentData(),
            initial ? fetchActivityTitles() : dashboardState.titles
        ]);
        if (session !== dashboardState.session) return;

        const records = (progress || []).map(record => normalizeProgressRecord(record, parseProgressData(record?.meta)));
        dashboardState.records = records.filter(Boolean);
        dashboardState.assessments = (stroop || []).map(normalizeAssessmentRecord).filter(Boolean);
        dashboardState.assessmentUnavailable = stroop === null;
        dashboardState.titles = titles;
        dashboardState.progressIndex = new Map(dashboardState.records.map(entry => [String(entry.id), entry]));
        dashboardState.assessmentIndex = new Map(dashboardState.assessments.map(entry => [String(entry.id), entry]));
        dashboardState.limits = [];
        if (records.length >= PROGRESS_LIMIT) dashboardState.limits.push(`${PROGRESS_LIMIT} salvataggi`);
        if (dashboardState.assessments.length >= ASSESSMENT_LIMIT) dashboardState.limits.push(`${ASSESSMENT_LIMIT} test Stroop`);
        dashboardState.ready = true;
        renderPeriods();
        renderDashboard();
        elements.lastRefresh.textContent = `Aggiornato alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}`;
    } catch (error) {
        if (session !== dashboardState.session) return;
        if (error?.code === '42501') {
            window.MODocente.esci();
            mostraAccesso('Sessione docente scaduta. Accedi di nuovo.');
            return;
        }
        console.error('Caricamento area docente non riuscito', error);
        elements.lastRefresh.textContent = initial
            ? 'Caricamento non riuscito. Riprova con «Aggiorna dati».'
            : 'Aggiornamento non riuscito. Sono visibili i dati già caricati.';
        if (initial) elements.classList.innerHTML = emptyMessage('Dati delle classi non disponibili.');
    } finally {
        elements.refreshBtn.disabled = false;
        // Se si è usciti e rientrati durante il caricamento, avvia quello della nuova sessione.
        if (session !== dashboardState.session && !elements.dashboard.classList.contains('hidden')) refreshDashboard();
    }
}

async function fetchActivityTitles() {
    try {
        const response = await fetch('materiali.json', { signal: AbortSignal.timeout(3500) });
        if (!response.ok) return new Map();
        const catalog = await response.json();
        const entries = Object.values(catalog).filter(Array.isArray).flat();
        return new Map(entries.filter(entry => entry.file && entry.titolo && !entry.file.includes('?'))
            .map(entry => [resolveActivityPath(entry.file), entry.titolo]));
    } catch {
        return new Map();
    }
}

async function fetchAssessmentData() {
    try {
        return (await window.MODocente.chiama('stroop_docente_test', { p_limite: ASSESSMENT_LIMIT })) || [];
    } catch (error) {
        if (error?.code === '42501') throw error;
        console.warn('Caricamento risultati Stroop non riuscito', error);
        return null;
    }
}

function schoolYear(date) {
    if (!date || !Number.isFinite(Date.parse(date))) return 'undated';
    const parts = dateParts.formatToParts(new Date(date));
    const year = Number(parts.find(part => part.type === 'year').value);
    const month = Number(parts.find(part => part.type === 'month').value);
    return String(month >= 9 ? year : year - 1);
}

function currentSchoolYear() {
    return schoolYear(new Date().toISOString());
}

function renderPeriods() {
    const current = currentSchoolYear();
    const years = new Set([
        ...dashboardState.records.map(record => schoolYear(record.updated_at)),
        ...dashboardState.assessments.map(entry => schoolYear(entry.created_at))
    ]);
    years.delete(current);
    const undated = years.delete('undated');
    const yearLabel = year => `${year}/${Number(year) + 1}`;
    elements.period.replaceChildren(
        new Option('Ultimi 30 giorni', 'recent'),
        new Option(`Anno in corso · ${yearLabel(current)}`, current),
        ...[...years].sort().reverse().map(year => new Option(`Storico · ${yearLabel(year)}`, year)),
        ...(undated ? [new Option('Storico · Senza data', 'undated')] : [])
    );
    elements.period.value = dashboardState.period;
    if (!elements.period.value) elements.period.value = dashboardState.period = 'recent';
}

function matchesPeriod(date, roster = false) {
    const period = dashboardState.period;
    const year = schoolYear(date);
    if (period !== 'recent') return year === period;
    return year === currentSchoolYear() && (roster || Date.parse(date) >= Date.now() - RECENT_DAYS * 86400000);
}

function byLatest(a, b) {
    return (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0);
}

function groupBy(records, key) {
    const groups = new Map();
    for (const record of records) {
        const value = key(record);
        if (!groups.has(value)) groups.set(value, []);
        groups.get(value).push(record);
    }
    return groups;
}

function classRecords() {
    const all = dashboardState.records.filter(record => record.class_code === dashboardState.classCode);
    // Percorsi storici equivalenti possono avere più righe per lo stesso alunno.
    const latest = groupBy(all.filter(record => matchesPeriod(record.updated_at)).sort(byLatest),
        record => JSON.stringify([record.student_code.toLowerCase(), record.page_path || record.original_path]));
    return [...latest.values()].map(rows => rows[0]);
}

function resetStudentSearch() {
    elements.studentSearch.value = '';
}

function emptyMessage(message) {
    return `<p class="docente-empty">${escapeHtml(message)}</p>`;
}

function renderDashboard() {
    const classes = new Set([
        ...dashboardState.records.filter(record => matchesPeriod(record.updated_at, true)).map(record => record.class_code),
        ...dashboardState.assessments.filter(entry => matchesPeriod(entry.created_at, true)).map(entry => entry.classCode)
    ]);
    if (dashboardState.ready && !classes.has(dashboardState.classCode)) dashboardState.classCode = '';
    const code = dashboardState.classCode;
    if (dashboardState.renderedClass !== code) {
        elements.activityGroupsContainer.replaceChildren();
        byId('dashboard-student-list').replaceChildren();
        dashboardState.renderedClass = code;
    }
    byId('dashboard-classes').hidden = Boolean(code);
    byId('dashboard-class').hidden = !code;
    elements.back.hidden = !code;

    const note = byId('dashboard-data-note');
    note.hidden = dashboardState.limits.length === 0;
    note.textContent = note.hidden ? '' : `Vista limitata ai più recenti ${dashboardState.limits.join(' e ')} restituiti dal sito.`;

    if (!code) {
        renderClassList(classes);
        return;
    }

    const records = classRecords();
    const activities = groupBy(records, record => record.page_path || record.original_path);
    const studentCount = new Set(records.filter(record => record.student_code).map(record => record.student_code.toLowerCase())).size;
    byId('dashboard-class-title').textContent = code === UNKNOWN_CLASS ? code : `Classe ${code}`;
    byId('dashboard-stats').innerHTML = [
        ['Alunni con lavori nel periodo', studentCount],
        ['Attività con salvataggi', activities.size],
        ['Ultimo salvataggio', records.length ? formatDateTime(records[0].updated_at) : '—']
    ].map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');

    for (const button of elements.dashboard.querySelectorAll('[data-class-view]')) {
        const view = button.dataset.classView;
        const selected = view === dashboardState.view;
        button.setAttribute('aria-pressed', String(selected));
        byId(`dashboard-${view}`).hidden = !selected;
    }
    if (dashboardState.view === 'activities') renderActivities(activities);
    if (dashboardState.view === 'students') renderStudents(records);
    if (dashboardState.view === 'stroop') renderStroop(code);
}

function renderClassList(classes) {
    if (!classes.size) {
        elements.classList.innerHTML = emptyMessage(dashboardState.ready
            ? 'Nessuna classe con attività registrate nel periodo. Puoi scegliere un altro periodo.'
            : 'Caricamento delle classi…');
        return;
    }

    const periodRecords = groupBy(dashboardState.records.filter(record => matchesPeriod(record.updated_at)), record => record.class_code);
    const periodTests = groupBy(dashboardState.assessments.filter(entry => matchesPeriod(entry.created_at)), entry => entry.classCode);
    elements.classList.innerHTML = `<ul class="docente-class-grid">${[...classes].sort(collator.compare).map(code => {
        const records = periodRecords.get(code) || [];
        const tests = periodTests.get(code) || [];
        const activities = new Set(records.map(record => record.page_path || record.original_path)).size;
        const students = new Set(records.filter(record => record.student_code).map(record => record.student_code.toLowerCase())).size;
        const lastDate = [...records.map(record => record.updated_at), ...tests.map(test => test.created_at)]
            .sort((a, b) => (Date.parse(b) || 0) - (Date.parse(a) || 0))[0];
        const label = code === UNKNOWN_CLASS ? code : `Classe ${code}`;
        return `<li><button class="docente-class-card" type="button" data-select-class="${escapeHtml(code)}">
            <strong>${escapeHtml(label)}</strong>
            <span>${students} ${students === 1 ? 'alunno' : 'alunni'} con lavori <span aria-hidden="true">·</span> ${activities} attività</span>
            ${tests.length ? `<span>${tests.length} test Stroop</span>` : ''}
            <span class="docente-card-date">${lastDate ? `Ultimo dato ${formatShortDate(lastDate)}` : 'Nessun dato nel periodo'}</span>
        </button></li>`;
    }).join('')}</ul>`;
}

function formatShortDate(value) {
    return Number.isFinite(Date.parse(value))
        ? new Date(value).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' })
        : 'senza data';
}

function renderActivities(activities) {
    if (!activities.size) {
        elements.activityGroupsContainer.innerHTML = emptyMessage('Nessuna attività con salvataggi nel periodo. Puoi scegliere un altro periodo.');
        return;
    }
    const open = new Set([...elements.activityGroupsContainer.querySelectorAll('details[open]')].map(item => item.dataset.activity));
    elements.activityGroupsContainer.innerHTML = [...activities].map(([path, records]) => {
        const students = records.filter(record => record.student_code).length;
        const progress = records.map(record => progressPercent(record.progressMeta)).filter(value => value !== null);
        const average = progress.length ? ` · Avanzamento medio ${Math.round(progress.reduce((sum, value) => sum + value, 0) / progress.length)}% (${progress.length} con dato)` : '';
        const description = `${students} ${students === 1 ? 'alunno con lavoro' : 'alunni con lavori'}${average}`;
        const rows = [...records].sort((a, b) => collator.compare(a.student_code, b.student_code))
            .map(record => renderWork(record, 'student')).join('');
        return `<details class="docente-disclosure" data-activity="${escapeHtml(path)}"${open.has(path) ? ' open' : ''}>
            <summary><span class="docente-item-label"><strong>${escapeHtml(formatActivityName(path))}</strong>
                <span>${description}</span></span><span class="docente-item-date">${formatShortDate(records[0].updated_at)}</span></summary>
            <ul class="docente-work-list">${rows}</ul>
        </details>`;
    }).join('');
}

function renderStudents(records) {
    const search = elements.studentSearch.value.trim().toLocaleLowerCase('it');
    const known = groupBy(dashboardState.records.filter(record => record.class_code === dashboardState.classCode &&
        record.student_code && matchesPeriod(record.updated_at, true)), record => record.student_code.toLowerCase());
    const works = groupBy(records, record => record.student_code.toLowerCase());
    const students = [...known.keys()].filter(code => code.includes(search)).sort(collator.compare);
    const list = byId('dashboard-student-list');
    const open = new Set([...list.querySelectorAll('details[open]')].map(item => item.dataset.student));
    list.innerHTML = students.length ? students.map(code => {
        const studentWorks = works.get(code) || [];
        const name = known.get(code)[0].student_code;
        return `<details class="docente-disclosure" data-student="${escapeHtml(code)}"${open.has(code) ? ' open' : ''}>
            <summary><span class="docente-item-label"><strong>${escapeHtml(name)}</strong>
                <span>${studentWorks.length} ${studentWorks.length === 1 ? 'lavoro' : 'lavori'} nel periodo</span></span>
                ${studentWorks.length ? `<span class="docente-item-date">${formatShortDate(studentWorks[0].updated_at)}</span>` : ''}</summary>
            ${studentWorks.length
                ? `<ul class="docente-work-list">${studentWorks.map(record => renderWork(record, 'activity')).join('')}</ul>`
                : emptyMessage('Nessun lavoro nel periodo selezionato.')}
        </details>`;
    }).join('') : emptyMessage(search ? 'Nessun alunno corrisponde alla ricerca.' : 'Nessun alunno individuato dai salvataggi della classe.');
}

function canOpenWork(record) {
    return record.original_class && record.student_code && /\.html?$/i.test(record.page_path);
}

function renderWork(record, mode) {
    const activity = formatActivityName(record.page_path);
    const student = escapeHtml(record.student_code || 'Senza codice');
    const title = mode === 'activity' ? escapeHtml(activity) : record.student_code
        ? `<button type="button" class="btn-link" data-show-student="${escapeHtml(record.student_code.toLowerCase())}">${student}</button>`
        : student;
    return `<li class="docente-work">
        <div class="docente-work-name"><strong>${title}</strong><span>${formatDateTime(record.updated_at)}</span></div>
        <div class="docente-progress">${renderProgressBar(record.progressMeta)}</div>
        <div class="docente-actions">
            ${canOpenWork(record) ? `<button type="button" class="docente-button docente-primary" data-open-as-docente
                data-class-code="${escapeHtml(record.original_class)}"
                data-student-code="${student}"
                data-page-path="${escapeHtml(record.original_path)}">Vedi il lavoro</button>` : ''}
            ${record.id != null ? `<button type="button" class="docente-button" data-progress-detail="${escapeHtml(record.id)}">Risposte salvate</button>` : ''}
        </div>
    </li>`;
}

function renderStroop(classCode) {
    const results = byId('assessment-results');
    results.hidden = true;
    if (dashboardState.assessmentUnavailable) {
        elements.assessmentInsights.innerHTML = emptyMessage('Risultati Stroop non disponibili. Riprova con «Aggiorna dati».');
        return;
    }
    const data = dashboardState.assessments
        .filter(entry => entry.classCode === classCode && matchesPeriod(entry.created_at))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    renderAssessmentInsights(data);
    results.hidden = !data.length;
    renderAssessmentTable(data);
}

function renderAssessmentInsights(data) {
    if (!elements.assessmentInsights) return;
    if (!data.length) {
        elements.assessmentInsights.innerHTML = `
            <div class="empty-state">
                <p>Nessun test registrato nel periodo selezionato.</p>
            </div>
        `;
        return;
    }

    const total = data.length;
    const avgScore = data.reduce((sum, entry) => sum + (entry.results.finalScore || 0), 0) / total;
    const avgAccuracy = data.reduce((sum, entry) => sum + (entry.results.accuracy || 0), 0) / total;
    const avgTime = data.reduce((sum, entry) => sum + (entry.results.totalTime || 0), 0) / total;
    const recent = data[0];

    elements.assessmentInsights.innerHTML = `
        <article class="assessment-card">
            <h4>Test registrati</h4>
            <div class="value">${total}</div>
            <div class="meta">Ultimo aggiornamento ${formatDateTime(recent.created_at)}</div>
        </article>
        <article class="assessment-card">
            <h4>Punteggio medio</h4>
            <div class="value">${avgScore.toFixed(1)}</div>
            <div class="meta">Accuratezza media ${(avgAccuracy).toFixed(1)}%</div>
        </article>
        <article class="assessment-card">
            <h4>Tempo medio</h4>
            <div class="value">${formatSeconds(avgTime)}</div>
            <div class="meta">Durata media di completamento</div>
        </article>
    `;
}

function renderAssessmentTable(data) {
    if (!elements.assessmentDetailBody) return;
    if (!data.length) {
        elements.assessmentDetailBody.innerHTML = '<tr><td colspan="6">Nessun risultato disponibile.</td></tr>';
        return;
    }

    const rows = data
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(entry => {
            const duration = formatSeconds(entry.results.totalTime);
            const docLink = `${STROOP_BASE_URL}?docente=1&doc_class=${encodeURIComponent(entry.classCode.toLowerCase())}&doc_student=${encodeURIComponent(entry.studentCode.toLowerCase())}`;
            return `
                <tr>
                    <td>${escapeHtml(entry.participant.name || entry.studentCode || 'Anonimo')}</td>
                    <td>${entry.results.finalScore ?? 0}</td>
                    <td>${(entry.results.accuracy ?? 0).toFixed(1)}%</td>
                    <td>${duration}</td>
                    <td>${formatDateTime(entry.created_at)}</td>
                    <td><div class="docente-actions">
                        <button class="docente-button" type="button" data-assessment-detail="${escapeHtml(entry.id)}">Dettagli</button>
                        <a class="btn-link" href="${docLink}" target="_blank" rel="noopener">Apri test</a>
                    </div></td>
                </tr>
            `;
        });

    elements.assessmentDetailBody.innerHTML = rows.join('');
}

function normalizeClass(code) {
    return String(code || '').trim().toUpperCase() || UNKNOWN_CLASS;
}

function resolveActivityPath(path) {
    if (!path) return '';
    const trimmed = String(path).trim();
    if (!trimmed) return '';
    const normalized = normalizePath(trimmed);
    const candidates = [trimmed, normalized];

    if (normalized.startsWith('/metodologieoperative/')) {
        candidates.push(normalized.replace(/^\/metodologieoperative/, '') || '/');
    }

    for (const key of candidates) {
        if (Object.hasOwn(PAGE_ALIAS_OVERRIDES, key)) {
            return PAGE_ALIAS_OVERRIDES[key];
        }
    }

    // Strip /metodologieoperative prefix so paths are consistent regardless of deploy base
    if (normalized.startsWith('/metodologieoperative/')) {
        return normalized.replace(/^\/metodologieoperative/, '') || '/';
    }

    return normalized;
}

function normalizeAssessmentRecord(record) {
    if (!record) return null;
    const participant = record.participant || {};
    const results = record.results || {};
    return {
        id: record.id,
        classCode: normalizeClass(record.class_code),
        studentCode: String(record.student_code || '').trim(),
        participant: {
            name: participant.name || record.student_code || 'Anonimo',
            age: participant.age ?? null,
            gender: participant.gender || 'N/D'
        },
        results: {
            finalScore: Number(results.finalScore) || 0,
            accuracy: Number(results.accuracy) || 0,
            totalTime: results.totalTime != null ? Number(results.totalTime) : null,
            avgTime: results.avgTime ?? null,
            correctCount: results.correctCount ?? null,
            performanceLevel: results.performanceLevel || '',
            difficultyStats: results.difficultyStats || {}
        },
        responses: null,
        created_at: record.created_at
    };
}

function normalizeProgressRecord(record, metaFromIndex = null) {
    if (!record) return null;
    try {
        const pagePath = resolveActivityPath(record.page_path);
        return {
            id: record.id,
            class_code: normalizeClass(record.class_code),
            original_class: String(record.class_code || '').trim(),
            student_code: String(record.student_code || '').trim(),
            page_path: pagePath,
            original_path: record.page_path || pagePath,
            updated_at: record.updated_at,
            progressMeta: metaFromIndex || null
        };
    } catch (error) {
        console.warn('Salvataggio non leggibile:', error);
        return null;
    }
}

function parseProgressData(value) {
    if (value === null || value === undefined) return {};
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return { raw: value };
        }
    }
    return { value };
}

let detailRequest = 0;

async function showDetail(dialog, body, entry, load, render) {
    if (!entry) return;
    const request = ++detailRequest;
    body.innerHTML = '<p class="docente-muted">Caricamento…</p>';
    if (!dialog.open) dialog.showModal();
    try {
        const data = await load(entry.id);
        if (dialog.open && request === detailRequest) body.innerHTML = render({ ...entry, ...data });
    } catch (error) {
        if (!dialog.open || request !== detailRequest) return;
        if (error?.code === '42501') {
            window.MODocente.esci();
            mostraAccesso('Sessione docente scaduta. Accedi di nuovo.');
            return;
        }
        body.innerHTML = emptyMessage('Impossibile caricare il dettaglio. Chiudi e riprova.');
    }
}

function openAssessmentDetail(id) {
    showDetail(elements.assessmentModal, elements.assessmentModalBody, dashboardState.assessmentIndex.get(String(id)),
        fetchAssessmentDetail, buildAssessmentDetail);
}

function openProgressDetail(id) {
    showDetail(elements.progressModal, elements.progressModalBody, dashboardState.progressIndex.get(String(id)),
        fetchProgressDetail, buildProgressDetail);
}

function buildProgressDetail(entry) {
    const activity = formatActivityName(entry.page_path || entry.original_path);
    return `
        <h2>${escapeHtml(activity)}</h2>
        <p class="docente-muted">${escapeHtml(entry.class_code)} · ${escapeHtml(entry.student_code || 'Senza codice')} · ${formatDateTime(entry.updated_at)}</p>
        <h3>Risposte salvate</h3>
        ${formatProgressData(entry.data)}
    `;
}

function progressPercent(meta) {
    const value = meta?.percentuale;
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
}

function renderProgressBar(meta) {
    const value = progressPercent(meta);
    if (value === null) return '<span class="docente-muted">Avanzamento non registrato</span>';
    return `<progress max="100" value="${value}" aria-label="Avanzamento"></progress>
        <span>${value}%${Number.isFinite(meta.campiCompilati) && Number.isFinite(meta.totale)
            ? ` · ${meta.campiCompilati}/${meta.totale} campi` : ''}</span>`;
}

function buildAssessmentDetail(entry) {
    const result = entry.results || {};
    const docLink = `${STROOP_BASE_URL}?docente=1&doc_class=${encodeURIComponent(entry.classCode.toLowerCase())}&doc_student=${encodeURIComponent(entry.studentCode.toLowerCase())}`;
    const difficultyHtml = Object.entries(result.difficultyStats || {}).map(([level, stats]) => `
            <div class="assessment-detail-item">
                <span>${escapeHtml(formatDifficulty(level))}</span>
                <strong>${(Number(stats.accuracy) || 0).toFixed(1)}% accurate</strong>
                <p style="margin:0.25rem 0 0;font-size:0.85rem;color:#475569;">
                    ${Number(stats.correct) || 0}/${Number(stats.total) || 0} risposte · ${stats.avgTime ? Number(stats.avgTime).toFixed(2) + 's' : '-'}
                </p>
            </div>
        `).join('');

    const responsesRows = (entry.responses || []).map((response, index) => `
        <tr>
            <td>${escapeHtml(response.trialNumber ?? index + 1)}</td>
            <td>${escapeHtml(response.displayWord || '-')}</td>
            <td>${escapeHtml(response.displayColor || '-')}</td>
            <td>${escapeHtml(response.selectedColor || '-')}</td>
            <td>${formatSeconds(response.responseTime ? response.responseTime / 1000 : null)}</td>
            <td>${escapeHtml(formatDifficulty(response.difficulty))}</td>
            <td class="${response.isCorrect ? 'success' : 'error'}">${response.isCorrect ? '✓' : '✗'}</td>
        </tr>
    `).join('');

    return `
        <div class="assessment-modal-body">
            <h2 style="margin-top:0;">Dettaglio Test · ${escapeHtml(entry.classCode)}</h2>
            <p class="muted" style="margin-bottom:1rem;">${escapeHtml(entry.participant.name || entry.studentCode || 'Anonimo')} · ${formatDateTime(entry.created_at)}</p>

            <div class="assessment-detail-grid">
                <div class="assessment-detail-item">
                    <span>Punteggio</span>
                    <strong>${result.finalScore ?? 0}</strong>
                </div>
                <div class="assessment-detail-item">
                    <span>Accuratezza</span>
                    <strong>${(result.accuracy ?? 0).toFixed(1)}%</strong>
                </div>
                <div class="assessment-detail-item">
                    <span>Durata totale</span>
                    <strong>${formatSeconds(result.totalTime)}</strong>
                </div>
                <div class="assessment-detail-item">
                    <span>Risposte corrette</span>
                    <strong>${escapeHtml(result.correctCount ?? '—')} / ${(entry.responses || []).length}</strong>
                </div>
            </div>

            <div class="assessment-detail-grid">
                <div class="assessment-detail-item">
                    <span>Performance</span>
                    <strong>${escapeHtml(result.performanceLevel || '—')}</strong>
                </div>
                <div class="assessment-detail-item">
                    <span>Studente / codice</span>
                    <strong>${escapeHtml(entry.participant.name || entry.studentCode || 'Anonimo')}</strong>
                </div>
                <div class="assessment-detail-item">
                    <span>Classe</span>
                    <strong>${escapeHtml(entry.classCode)}</strong>
                </div>
                <div class="assessment-detail-item">
                    <span>Apri il test</span>
                    <strong><a href="${docLink}" target="_blank" rel="noopener">Apri test</a></strong>
                </div>
            </div>

            ${difficultyHtml ? `
                <h4>Prestazioni per difficoltà</h4>
                <div class="assessment-detail-grid">${difficultyHtml}</div>
            ` : ''}

            <h4>Risposte registrate</h4>
            ${responsesRows
                ? `<div class="table-wrapper"><table class="assessment-response-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Parola</th>
                                <th>Colore mostrato</th>
                                <th>Risposta</th>
                                <th>Tempo</th>
                                <th>Difficoltà</th>
                                <th>Esito</th>
                            </tr>
                        </thead>
                        <tbody>${responsesRows}</tbody>
                    </table></div>`
                : '<p class="muted">Nessuna risposta salvata.</p>'}
        </div>
    `;
}

async function fetchAssessmentDetail(id) {
    const row = await window.MODocente.chiama('stroop_docente_dettaglio', { p_id: id });
    if (!row) {
        throw new Error('Dettaglio test non trovato');
    }
    return { ...normalizeAssessmentRecord(row), responses: ensureArray(row.responses) };
}

async function fetchProgressDetail(id) {
    const data = await window.MODocente.chiama('progress_docente_dettaglio', { p_id: id });
    if (data === null || data === undefined) {
        throw new Error('Dettaglio salvataggio non trovato');
    }
    return {
        data: parseProgressData(data || {})
    };
}

function formatDateTime(value) {
    if (!Number.isFinite(Date.parse(value))) return 'Senza data';
    return new Date(value).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome' });
}

function formatActivityName(path) {
    if (!path) return 'Attività senza titolo';
    const title = dashboardState.titles.get(path);
    if (title) return title;
    if (String(path).includes('ripasso-terzo-anno')) {
        return 'Terzo anno · Dalla terza alla quarta: ripasso operativo';
    }
    let clean = path.replace(/^https?:\/\/[^/]+/i, '');
    clean = clean.replace(/^\//, '');
    const segments = clean.split('/');
    let name = segments.pop() || clean;
    name = name.replace(/\.[^.]+$/, '');
    name = name.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name) {
        name = clean;
    }
    const section = segments.pop();
    const label = capitalize(name);
    return section ? `${capitalize(section)} · ${label}` : label;
}

function capitalize(value) {
    if (!value) return '';
    return value.replace(/\b\w/g, match => match.toUpperCase());
}

function formatDifficulty(level) {
    if (!level) return '—';
    const map = {
        BASE: 'Base',
        MEDIUM: 'Intermedio',
        HIGH: 'Avanzato',
        MAX: 'Expert'
    };
    return map[level] || capitalize(level.toLowerCase());
}

function formatSeconds(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return '—';
    }
    const num = Number(value);
    if (num >= 60) {
        const rounded = Math.round(num);
        const minutes = Math.floor(rounded / 60);
        const seconds = rounded % 60;
        return `${minutes}m ${seconds}s`;
    }
    return `${num.toFixed(1)}s`;
}

function formatProgressData(data) {
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        return '<p class="muted">Nessun contenuto salvato.</p>';
    }
    if (data._activity === 'ripasso-terzo-anno') {
        return formatRipassoTerzoData(data);
    }
    const entries = Object.entries(data).filter(([key]) => !key.startsWith('_'));
    const fields = entries.map(([key, value]) => {
        const label = capitalize(key.replace(/[-_]+/g, ' '));
        const text = typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value ?? '—');
        return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(text)}</dd></div>`;
    }).join('');
    return `${fields ? `<dl class="docente-answers">${fields}</dl>` : ''}
        <details class="docente-raw"><summary>Dati originali del salvataggio</summary>
        <pre class="progress-json">${escapeHtml(JSON.stringify(data, null, 2))}</pre></details>`;
}

function formatRipassoTerzoData(data) {
    const missionLabels = [
        'Persona, bisogni e relazione d’aiuto',
        'Progetto individualizzato',
        'Reti, équipe e documentazione',
        'Autobiografia, memoria e narrazione',
        'Seconda infanzia, gioco e peer tutoring',
        'Dipendenze, SerD e colloquio motivazionale',
        'Intelligenza artificiale: funzionamento e verifica',
        'Analisi di un caso'
    ];
    const meta = data._meta || {};
    const progress = Number(meta.percentuale || 0);
    const completed = Number(meta.missioniComplete ?? meta.campiCompilati ?? 0);
    const total = Number(meta.missioniTotali ?? meta.totale ?? 0);
    const correct = Number(meta.risposteCorrette || 0);
    const answered = Number(meta.risposte || 0);
    const accuracy = Number(meta.accuratezza || 0);
    const openQuestionLabels = data.openQuestionLabels && typeof data.openQuestionLabels === 'object'
        ? data.openQuestionLabels
        : {};
    const openAnswers = Object.entries(data.openAnswers || {})
        .sort(([a], [b]) => Number(a) - Number(b))
        .flatMap(([missionId, values]) => (Array.isArray(values) ? values : []).map((value, questionIndex) => ({
            missionId,
            questionIndex,
            value: String(value || '').trim()
        })))
        .filter(item => item.value)
        .map(item => `
            <article style="padding:0.75rem 0;border-top:1px solid #e2e8f0;">
                <strong>${escapeHtml(missionLabels[Number(item.missionId)] || `Argomento ${Number(item.missionId) + 1}`)}</strong>
                <p style="margin:0.25rem 0;color:#475569;"><em>${escapeHtml(openQuestionLabels[item.missionId]?.[item.questionIndex] || `Domanda ${item.questionIndex + 1}`)}</em></p>
                <p style="margin:0.35rem 0 0;white-space:pre-wrap;">${escapeHtml(item.value)}</p>
            </article>`).join('');
    const legacyNotes = Object.entries(data.notes || {})
        .filter(([, value]) => String(value || '').trim())
        .map(([missionId, value]) => `
            <article style="padding:0.75rem 0;border-top:1px solid #e2e8f0;">
                <strong>${escapeHtml(missionLabels[Number(missionId)] || `Argomento ${Number(missionId) + 1}`)}</strong>
                <p style="margin:0.35rem 0 0;white-space:pre-wrap;">${escapeHtml(value)}</p>
            </article>`).join('');
    const caseData = data.case && typeof data.case === 'object' ? data.case : {};
    const needs = Array.isArray(caseData.needs) ? caseData.needs : [];
    const roles = Array.isArray(caseData.roles) ? caseData.roles : [];
    const caseHtml = caseData.facts || caseData.needsResources || caseData.objective || needs.length || roles.length
        ? `<section style="margin-top:1rem;">
            <h4>Analisi del caso</h4>
            <p><strong>Dati individuati:</strong> ${escapeHtml(caseData.facts || '—')}</p>
            <p><strong>Dimensioni considerate:</strong> ${needs.length ? needs.map(escapeHtml).join(', ') : '—'}</p>
            <p><strong>Bisogni, risorse e ipotesi:</strong> ${escapeHtml(caseData.needsResources || '—')}</p>
            <p><strong>Informazioni mancanti:</strong> ${escapeHtml(caseData.missing || caseData.action || '—')}</p>
            <p><strong>Rete:</strong> ${roles.length ? roles.map(escapeHtml).join(', ') : '—'}</p>
            <p><strong>Motivazione della rete:</strong> ${escapeHtml(caseData.network || '—')}</p>
            <p><strong>Obiettivo e primo intervento:</strong> ${escapeHtml(caseData.objective || '—')}</p>
            <p><strong>Verifica:</strong> ${escapeHtml(caseData.evaluation || '—')}</p>
        </section>`
        : '';

    return `<div class="assessment-detail-grid" style="margin-bottom:1rem;">
            <div class="assessment-detail-item"><span>Avanzamento</span><strong>${progress}%</strong><p>${completed}/${total} argomenti</p></div>
            <div class="assessment-detail-item"><span>Accuratezza</span><strong>${accuracy}%</strong><p>${correct}/${answered} risposte corrette</p></div>
            <div class="assessment-detail-item"><span>Percorso</span><strong>${escapeHtml(meta.percorso || data.route || '—')}</strong></div>
            <div class="assessment-detail-item"><span>Ultimo argomento</span><strong>${escapeHtml(String(meta.missioneCorrente || (Number(data.current) + 1) || '—'))}</strong></div>
        </div>
        <h4>Risposte aperte</h4>
        ${openAnswers || legacyNotes || '<p class="muted">Nessuna risposta aperta salvata.</p>'}
        ${caseHtml}`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    if (typeof value === 'object' && value !== null) {
        return Array.isArray(value) ? value : Object.values(value);
    }
    return [];
}

function normalizePath(path) {
    if (!path) return '';
    let clean = path.trim();
    clean = clean.replace(/^https?:\/\/[^/]+/i, '');
    if (!clean.startsWith('/')) {
        clean = `/${clean}`;
    }
    clean = clean.split(/[?#]/)[0];
    if (clean.length > 1 && clean.endsWith('/')) {
        clean = clean.slice(0, -1);
    }
    return clean.replace(/\/{2,}/g, '/');
}

function buildActivityLink(path, { superMode = false, classCode = '', studentCode = '' } = {}) {
    const resolvedPath = resolveActivityPath(path);
    if (!resolvedPath) return '#';
    const pathValue = resolvedPath;
    if (/^https?:\/\//i.test(pathValue)) {
        try {
            const url = new URL(pathValue);
            if (superMode) {
                url.searchParams.set('docente', '1');
                if (classCode) url.searchParams.set('doc_class', classCode);
                if (studentCode) url.searchParams.set('doc_student', studentCode);
            }
            return url.toString();
        } catch {
            return path;
        }
    }

    const normalized = pathValue.startsWith('/') ? pathValue : `/${pathValue}`;
    let href = '';
    const repoPath = BASE_PATHNAME && BASE_PATHNAME !== '/' ? BASE_PATHNAME : '';

    if (repoPath && normalized.startsWith(`${repoPath}/`)) {
        href = `${SITE_BASE}${normalized}`;
    } else if (repoPath && normalized === repoPath) {
        href = `${SITE_BASE}${repoPath}`;
    } else if (SITE_ROOT) {
        href = `${SITE_ROOT}${normalized}`;
    } else {
        const fallbackBase = window.location.pathname.replace(/\/[^\/]*$/, '') || '';
        href = `${fallbackBase}${normalized}`;
    }

    if (superMode) {
        const params = new URLSearchParams({ docente: '1' });
        if (classCode) params.set('doc_class', classCode);
        if (studentCode) params.set('doc_student', studentCode);
        href += (href.includes('?') ? '&' : '?') + params.toString();
    }
    return href;
}

function readSuperStore() {
    try {
        const raw = localStorage.getItem(SUPER_STORAGE_KEY);
        if (!raw) return {};
        const data = JSON.parse(raw) || {};
        const now = Date.now();
        let mutated = false;
        Object.keys(data).forEach(key => {
            const entry = data[key];
            if (entry.expires && entry.expires < now) {
                delete data[key];
                mutated = true;
            }
        });
        if (mutated) {
            localStorage.setItem(SUPER_STORAGE_KEY, JSON.stringify(data));
        }
        return data;
    } catch (error) {
        console.warn('Impossibile leggere le sessioni docente:', error);
        return {};
    }
}

function prepareSuperSession({ classCode, studentCode, pagePath }) {
    try {
        const resolved = resolveActivityPath(pagePath);
        const normalizedPath = normalizePath(resolved);
        if (!normalizedPath) {
            throw new Error('Percorso attività non valido.');
        }
        const store = readSuperStore();
        store[normalizedPath] = {
            classCode,
            studentCode,
            expires: Date.now() + SUPER_SESSION_DURATION
        };
        localStorage.setItem(SUPER_STORAGE_KEY, JSON.stringify(store));
        return true;
    } catch (error) {
        console.warn('Impossibile predisporre la modalità docente:', error);
        return false;
    }
}

function openActivityAsDocente(dataset = {}) {
    const classCode = (dataset.classCode || dataset.class || '').trim();
    const studentCode = (dataset.studentCode || '').trim();
    const rawPath = (dataset.pagePath || dataset.page || '').trim();
    const pagePath = resolveActivityPath(rawPath);
    if (!classCode || !studentCode || !pagePath) {
        alert('Seleziona una voce valida per aprire la modalità docente.');
        return;
    }
    prepareSuperSession({
        classCode,
        studentCode,
        pagePath
    });
    const link = buildActivityLink(pagePath, { superMode: true, classCode, studentCode });
    window.open(link, '_blank', 'noopener');
}
