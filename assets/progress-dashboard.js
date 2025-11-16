const SUPABASE_URL = 'https://ruplzgcnheddmqqdephp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cGx6Z2NuaGVkZG1xcWRlcGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTYyMjksImV4cCI6MjA3NTY5MjIyOX0.tOLIkgi5yTt61_0rMlXUqxnbil4DLD7kBaqZBVAv1CI';
const PROGRESS_ENDPOINT = `${SUPABASE_URL}/rest/v1/progress`;
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
const STROOP_STATS_URL = `${SITE_ROOT}/stroop_statistiche.html`;
const SUPER_STORAGE_KEY = 'mo:super-impersonations';
const SUPER_SESSION_DURATION = 1000 * 60 * 15;
const PAGE_ALIAS_OVERRIDES = {
    'attivita-materiali-ai-verifica-ia-modificata-01': '/materiali/ai/verifica_ia_modificata.html'
};

const dashboardState = {
    records: [],
    filtered: [],
    classFilter: '',
    activityFilter: '',
    searchTerm: '',
    assessments: [],
    filteredAssessments: [],
    assessmentIndex: new Map()
};

const elements = {};

document.addEventListener('DOMContentLoaded', () => {
    elements.overlay = document.getElementById('docente-auth-overlay');
    elements.dashboard = document.getElementById('docente-dashboard-content');
    elements.loginForm = document.getElementById('docente-login-form');
    elements.passwordInput = document.getElementById('docente-password');
    elements.refreshBtn = document.getElementById('refresh-dashboard');
    elements.classFilter = document.getElementById('dashboard-class-filter');
    elements.activityFilter = document.getElementById('dashboard-activity-filter');
    elements.studentSearch = document.getElementById('dashboard-student-search');
    elements.lastRefresh = document.getElementById('dashboard-last-refresh');
    elements.statStudents = document.getElementById('doc-stat-students');
    elements.statActivities = document.getElementById('doc-stat-activities');
    elements.statEntries = document.getElementById('doc-stat-entries');
    elements.statLastUpdate = document.getElementById('doc-stat-last-update');
    elements.classFocus = document.getElementById('doc-class-focus');
    elements.activityFocus = document.getElementById('doc-activity-focus');
    elements.activityBody = document.getElementById('activity-summary-body');
    elements.studentBody = document.getElementById('student-detail-body');
    elements.assessmentClassBody = document.getElementById('assessment-class-summary');
    elements.assessmentDetailBody = document.getElementById('assessment-detail-body');
    elements.assessmentInsights = document.getElementById('assessment-insights');
    elements.classProgressContainer = document.getElementById('class-student-progress');
    elements.assessmentModal = document.getElementById('assessment-modal');
    elements.assessmentModalBody = document.getElementById('assessment-modal-body');

    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', handleLogin);
    }
    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', refreshDashboard);
    }
    if (elements.classFilter) {
        elements.classFilter.addEventListener('change', () => {
            dashboardState.classFilter = elements.classFilter.value;
            applyFilters();
        });
    }
    if (elements.activityFilter) {
        elements.activityFilter.addEventListener('change', () => {
            dashboardState.activityFilter = elements.activityFilter.value;
            applyFilters();
        });
    }
    if (elements.studentSearch) {
        elements.studentSearch.addEventListener('input', () => {
            dashboardState.searchTerm = elements.studentSearch.value.trim().toLowerCase();
            applyFilters();
        });
    }
});

document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-as-docente]');
    if (trigger) {
        event.preventDefault();
        openActivityAsDocente(trigger.dataset);
    }

    const detailTrigger = event.target.closest('[data-assessment-detail]');
    if (detailTrigger) {
        event.preventDefault();
        openAssessmentDetail(detailTrigger.dataset.assessmentDetail);
    }

    if (event.target.matches('[data-assessment-close]') || event.target === elements.assessmentModal) {
        closeAssessmentDetail();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeAssessmentDetail();
    }
});

function handleLogin(event) {
    event.preventDefault();
    const value = elements.passwordInput?.value ?? '';
    const normalized = value.trim().toLowerCase();
    const allowed = ['metodologie2024', 'picconi'];

    if (allowed.includes(normalized)) {
        elements.overlay?.classList.add('hidden');
        elements.dashboard?.classList.remove('hidden');
        refreshDashboard();
    } else {
        alert('Password non corretta');
        elements.passwordInput?.focus();
    }
}

async function refreshDashboard() {
    setStatus('Caricamento dati...');
    toggleLoading(true);
    try {
        const [records, assessments] = await Promise.all([
            fetchProgressData(),
            fetchAssessmentData()
        ]);
        dashboardState.records = records;
        dashboardState.assessments = assessments.map(normalizeAssessmentRecord);
        dashboardState.assessmentIndex = new Map();
        dashboardState.assessments.forEach(entry => {
            if (entry?.id !== undefined) {
                dashboardState.assessmentIndex.set(String(entry.id), entry);
            }
        });
        populateFilters(records);
        dashboardState.classFilter = elements.classFilter?.value || '';
        dashboardState.activityFilter = elements.activityFilter?.value || '';
        applyFilters();
        applyAssessmentFilter(dashboardState.classFilter || '');
        const now = new Date();
        if (elements.lastRefresh) {
            elements.lastRefresh.textContent = now.toLocaleString('it-IT');
        }
    } catch (error) {
        console.error('Impossibile caricare i dati dalla dashboard docente:', error);
        alert('Errore durante il caricamento dei dati. Riprova più tardi.');
    } finally {
        toggleLoading(false);
    }
}

async function fetchProgressData() {
    const params = new URLSearchParams({
        select: 'id,class_code,student_code,page_path,updated_at',
        order: 'updated_at.desc',
        limit: '1000'
    });
    const response = await fetch(`${PROGRESS_ENDPOINT}?${params.toString()}`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: 'return=minimal'
        }
    });
    if (!response.ok) {
        throw new Error(`Supabase error ${response.status}`);
    }
    return response.json();
}

async function fetchAssessmentData() {
    const params = new URLSearchParams({
        select: 'id,class_code,student_code,participant,results,responses,created_at,started_at,ended_at',
        order: 'created_at.desc',
        limit: '500'
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/stroop_tests?${params.toString()}`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    if (!response.ok) {
        console.warn('Impossibile caricare i test strutturati:', response.status);
        return [];
    }
    return response.json();
}

function populateFilters(records) {
    const classSet = new Set();
    const activitySet = new Set();
    records.forEach(record => {
        if (record.class_code) {
            classSet.add(record.class_code.toLowerCase());
        }
        if (record.page_path) {
            activitySet.add(record.page_path);
        }
    });

    if (elements.classFilter) {
        const options = ['<option value="">Tutte le classi</option>'];
        Array.from(classSet)
            .sort((a, b) => a.localeCompare(b, 'it', { numeric: true }))
            .forEach(cls => {
                const label = cls.toUpperCase();
                options.push(`<option value="${cls}">${label}</option>`);
            });
        elements.classFilter.innerHTML = options.join('');
    }

    if (elements.activityFilter) {
        const options = ['<option value="">Tutte le attività</option>'];
        Array.from(activitySet)
            .sort((a, b) => a.localeCompare(b))
            .forEach(path => {
                options.push(`<option value="${path}">${formatActivityName(path)}</option>`);
            });
        elements.activityFilter.innerHTML = options.join('');
    }
}

function applyFilters() {
    let dataset = [...dashboardState.records];
    const classFilter = dashboardState.classFilter?.toLowerCase();
    const activityFilter = dashboardState.activityFilter;
    const search = dashboardState.searchTerm;

    if (classFilter) {
        dataset = dataset.filter(record => (record.class_code || '').toLowerCase() === classFilter);
    }
    if (activityFilter) {
        dataset = dataset.filter(record => record.page_path === activityFilter);
    }
    if (search) {
        dataset = dataset.filter(record => {
            const student = (record.student_code || '').toLowerCase();
            return student.includes(search);
        });
    }

    dashboardState.filtered = dataset;
    updateStats(dataset);
    renderActivitySummary(dataset);
    renderStudentTable(dataset);
    renderClassGroups(dataset);

    const classLabel = classFilter ? classFilter.toUpperCase() : 'tutte le classi';
    if (elements.classFocus) {
        elements.classFocus.textContent = classLabel;
    }
    const activityLabel = activityFilter ? formatActivityName(activityFilter) : 'tutte le attività';
    if (elements.activityFocus) {
        elements.activityFocus.textContent = activityLabel;
    }
}

function updateStats(records) {
    const studentSet = new Set();
    const activitySet = new Set();
    let lastUpdate = null;

    records.forEach(record => {
        if (record.student_code) {
            const key = `${(record.class_code || '').toLowerCase()}|${record.student_code.toLowerCase()}`;
            studentSet.add(key);
        }
        if (record.page_path) {
            activitySet.add(record.page_path);
        }
        if (record.updated_at) {
            if (!lastUpdate || new Date(record.updated_at) > new Date(lastUpdate)) {
                lastUpdate = record.updated_at;
            }
        }
    });

    if (elements.statStudents) {
        elements.statStudents.textContent = studentSet.size;
    }
    if (elements.statActivities) {
        elements.statActivities.textContent = activitySet.size;
    }
    if (elements.statEntries) {
        elements.statEntries.textContent = records.length;
    }
    if (elements.statLastUpdate) {
        elements.statLastUpdate.textContent = lastUpdate ? formatDateTime(lastUpdate) : '-';
    }
}

function renderActivitySummary(records) {
    if (!elements.activityBody) return;
    if (!records.length) {
        elements.activityBody.innerHTML = '<tr><td colspan="5">Nessun dato disponibile per i filtri selezionati.</td></tr>';
        return;
    }

    const map = new Map();
    records.forEach(record => {
        const classKey = (record.class_code || 'N/D').toUpperCase();
        const page = record.page_path || '—';
        const key = `${classKey}|${page}`;
        if (!map.has(key)) {
            map.set(key, {
                classCode: classKey,
                pagePath: page,
                students: new Set(),
                lastUpdate: record.updated_at
            });
        }
        const entry = map.get(key);
        if (record.student_code) {
            entry.students.add(record.student_code.toLowerCase());
        }
        if (!entry.lastUpdate || new Date(record.updated_at) > new Date(entry.lastUpdate)) {
            entry.lastUpdate = record.updated_at;
        }
    });

    const rows = Array.from(map.values())
        .sort((a, b) => new Date(b.lastUpdate || 0) - new Date(a.lastUpdate || 0))
        .map(entry => {
            const resolvedPath = resolveActivityPath(entry.pagePath);
            const link = buildActivityLink(resolvedPath || entry.pagePath);
            return `
                <tr>
                    <td>${formatActivityName(resolvedPath || entry.pagePath)}</td>
                    <td>${entry.classCode}</td>
                    <td>${entry.students.size}</td>
                    <td>${formatDateTime(entry.lastUpdate)}</td>
                    <td><a class="btn-link" href="${link}" target="_blank" rel="noopener">Apri</a></td>
                </tr>
            `;
        });

    elements.activityBody.innerHTML = rows.join('');
}

function renderStudentTable(records) {
    if (!elements.studentBody) return;
    if (!records.length) {
        elements.studentBody.innerHTML = '<tr><td colspan="5">Nessun studente trovato.</td></tr>';
        return;
    }

    const map = new Map();
    records.forEach(record => {
        const classCode = (record.class_code || 'N/D').toUpperCase();
        const student = (record.student_code || 'sconosciuto').trim();
        const key = `${classCode}|${student.toLowerCase()}`;
        if (!map.has(key)) {
            map.set(key, {
                classCode,
                classCodeRaw: record.class_code || classCode,
                studentCode: student,
                lastUpdate: record.updated_at,
                pagePath: record.page_path
            });
        } else {
            const current = map.get(key);
            if (new Date(record.updated_at) > new Date(current.lastUpdate)) {
                current.lastUpdate = record.updated_at;
                current.pagePath = record.page_path;
            }
        }
    });

    const rows = Array.from(map.values())
        .sort((a, b) => new Date(b.lastUpdate || 0) - new Date(a.lastUpdate || 0))
        .map(entry => {
            const link = buildActivityLink(entry.pagePath);
            const statsLink = `${STROOP_STATS_URL}?classe=${encodeURIComponent(entry.classCode.toLowerCase())}`;
            return `
                <tr>
                    <td>${entry.classCode}</td>
                    <td>${entry.studentCode}</td>
                    <td>${formatActivityName(resolveActivityPath(entry.pagePath))}</td>
                    <td>${formatDateTime(entry.lastUpdate)}</td>
                    <td>
                        <a class="btn-link" href="#" role="button" data-open-as-docente data-class-code="${entry.classCodeRaw}" data-student-code="${entry.studentCode}" data-page-path="${entry.pagePath}">Modalità docente</a>
                        <span class="divider">·</span>
                        <a class="btn-link" href="${link}" target="_blank" rel="noopener">Pagina</a>
                        <span class="divider">·</span>
                        <a class="btn-link" href="${statsLink}" target="_blank" rel="noopener">Statistiche</a>
                    </td>
                </tr>
            `;
        });

    elements.studentBody.innerHTML = rows.join('');
}

function renderClassGroups(records) {
    if (!elements.classProgressContainer) return;
    if (!records.length) {
        elements.classProgressContainer.innerHTML = `
            <div class="empty-state">
                <p>Nessun dato disponibile per la combinazione di filtri selezionata.</p>
            </div>
        `;
        return;
    }

    const classMap = new Map();
    records.forEach(record => {
        if (!record.page_path) return;
        const classCode = (record.class_code || 'N/D').toUpperCase();
        const studentCode = (record.student_code || 'Sconosciuto').trim();
        const normalizedStudent = studentCode.toLowerCase();
        const resolvedPath = resolveActivityPath(record.page_path);
        const normalizedPath = normalizePath(resolvedPath);

        if (!classMap.has(classCode)) {
            classMap.set(classCode, {
                label: classCode,
                rawCode: record.class_code || classCode,
                students: new Map(),
                lastUpdate: record.updated_at
            });
        }
        const classEntry = classMap.get(classCode);
        if (!classEntry.lastUpdate || new Date(record.updated_at) > new Date(classEntry.lastUpdate)) {
            classEntry.lastUpdate = record.updated_at;
        }

        if (!classEntry.students.has(normalizedStudent)) {
            classEntry.students.set(normalizedStudent, {
                label: studentCode,
                classCode: record.class_code || classEntry.rawCode || classCode,
                displayClass: classCode,
                activities: new Map()
            });
        }
        const studentEntry = classEntry.students.get(normalizedStudent);
        const existingActivity = studentEntry.activities.get(normalizedPath);
        if (!existingActivity || new Date(record.updated_at) > new Date(existingActivity.updated_at)) {
            studentEntry.activities.set(normalizedPath, {
                pagePath: resolvedPath,
                originalPath: record.page_path,
                updated_at: record.updated_at
            });
        }
    });

    if (!classMap.size) {
        elements.classProgressContainer.innerHTML = `
            <div class="empty-state">
                <p>Nessun dato disponibile per la combinazione di filtri selezionata.</p>
            </div>
        `;
        return;
    }

    const classBlocks = Array.from(classMap.values())
        .sort((a, b) => a.label.localeCompare(b.label, 'it', { numeric: true }))
        .map((classEntry, index) => {
            const studentCards = Array.from(classEntry.students.values())
                .sort((a, b) => a.label.localeCompare(b.label, 'it', { numeric: true }))
                .map(studentEntry => {
                    const rows = Array.from(studentEntry.activities.values())
                        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
                        .map(activity => `
                            <tr>
                                <td>${formatActivityName(activity.pagePath || activity.originalPath)}</td>
                                <td>${formatDateTime(activity.updated_at)}</td>
                                <td>
                                    <a class="btn-link" href="#" role="button"
                                        data-open-as-docente
                                        data-class-code="${studentEntry.classCode}"
                                        data-student-code="${studentEntry.label}"
                                        data-page-path="${activity.originalPath || activity.pagePath}">
                                        Apri come docente
                                    </a>
                                    <span class="divider">·</span>
                                    <a class="btn-link" href="${buildActivityLink(activity.pagePath || activity.originalPath)}" target="_blank" rel="noopener">Apri pagina</a>
                                </td>
                            </tr>
                        `).join('');

                    return `
                        <details class="student-block">
                            <summary>
                                <div class="student-meta">
                                    <strong>${studentEntry.label}</strong>
                                    <span>${studentEntry.activities.size} attività monitorate</span>
                                </div>
                                <span class="student-chevron" aria-hidden="true">›</span>
                            </summary>
                            <div class="student-activities">
                                <table class="data-table compact">
                                    <thead>
                                        <tr>
                                            <th>Attività</th>
                                            <th>Aggiornato</th>
                                            <th>Azioni</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${rows}
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    `;
                }).join('');

            const totalActivities = Array.from(classEntry.students.values())
                .reduce((sum, student) => sum + student.activities.size, 0);
            const lastInfo = classEntry.lastUpdate ? ` · Ultimo aggiornamento ${formatDateTime(classEntry.lastUpdate)}` : '';

            return `
                <details class="class-block"${index === 0 ? ' open' : ''}>
                    <summary>
                        <div class="class-info">
                            <h4>Classe ${classEntry.label}</h4>
                            <p>${classEntry.students.size} studenti attivi · ${totalActivities} attività tracciate${lastInfo}</p>
                        </div>
                        <span class="class-chevron" aria-hidden="true">›</span>
                    </summary>
                    <div class="class-body">
                        ${studentCards || '<p class="muted">Nessuno studente attivo.</p>'}
                    </div>
                </details>
            `;
        });

    elements.classProgressContainer.innerHTML = classBlocks.join('');
}

function applyAssessmentFilter(classCode = '') {
    let dataset = dashboardState.assessments;
    if (classCode) {
        dataset = dataset.filter(entry => entry.classCode.toLowerCase() === classCode.toLowerCase());
    }
    dashboardState.filteredAssessments = dataset;
    renderAssessmentInsights(dataset);
    renderAssessmentSummary(dataset);
    renderAssessmentTable(dataset);
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
    const best = data.reduce((prev, curr) => (curr.results.finalScore > prev.results.finalScore ? curr : prev), data[0]);
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
        <article class="assessment-card">
            <h4>Migliore prestazione</h4>
            <div class="value">${best.results.finalScore ?? 0}</div>
            <div class="meta">${best.classCode} · ${best.participant.name || best.studentCode}</div>
            <div class="trend positive">Accuratezza ${(best.results.accuracy ?? 0).toFixed(1)}%</div>
        </article>
    `;
}

function renderAssessmentSummary(data) {
    if (!elements.assessmentClassBody) return;
    if (!data.length) {
        elements.assessmentClassBody.innerHTML = '<tr><td colspan="5">Nessun risultato disponibile.</td></tr>';
        return;
    }

    const map = new Map();
    data.forEach(entry => {
        const key = entry.classCode;
        if (!map.has(key)) {
            map.set(key, {
                label: key.toUpperCase(),
                count: 0,
                sumScore: 0,
                sumAccuracy: 0,
                lastUpdate: entry.created_at
            });
        }
        const obj = map.get(key);
        obj.count += 1;
        obj.sumScore += entry.results.finalScore || 0;
        obj.sumAccuracy += entry.results.accuracy || 0;
        if (!obj.lastUpdate || new Date(entry.created_at) > new Date(obj.lastUpdate)) {
            obj.lastUpdate = entry.created_at;
        }
    });

    const rows = Array.from(map.values())
        .sort((a, b) => a.label.localeCompare(b.label, 'it', { numeric: true }))
        .map(entry => `
            <tr>
                <td>${entry.label}</td>
                <td>${entry.count}</td>
                <td>${(entry.sumScore / entry.count).toFixed(1)}</td>
                <td>${(entry.sumAccuracy / entry.count).toFixed(1)}%</td>
                <td>${formatDateTime(entry.lastUpdate)}</td>
            </tr>
        `);

    elements.assessmentClassBody.innerHTML = rows.join('');
}

function renderAssessmentTable(data) {
    if (!elements.assessmentDetailBody) return;
    if (!data.length) {
        elements.assessmentDetailBody.innerHTML = '<tr><td colspan="7">Nessun risultato disponibile.</td></tr>';
        return;
    }

    const rows = data
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(entry => {
            const duration = formatSeconds(entry.results.totalTime);
            const docLink = `${STROOP_BASE_URL}?docente=1&doc_class=${encodeURIComponent(entry.classCode.toLowerCase())}&doc_student=${encodeURIComponent((entry.studentCode || '').toLowerCase())}`;
            return `
                <tr>
                    <td>${entry.classCode}</td>
                    <td>${entry.participant.name || entry.studentCode || 'Anonimo'}</td>
                    <td>${entry.results.finalScore ?? 0}</td>
                    <td>${(entry.results.accuracy ?? 0).toFixed(1)}%</td>
                    <td>${duration}</td>
                    <td>${formatDateTime(entry.created_at)}</td>
                    <td>
                        <button class="btn-link" type="button" data-assessment-detail="${entry.id}">Dettagli</button>
                        <span class="divider">·</span>
                        <a class="btn-link" href="${docLink}" target="_blank" rel="noopener">Apri test</a>
                    </td>
                </tr>
            `;
        });

    elements.assessmentDetailBody.innerHTML = rows.join('');
}

function resolveActivityPath(path) {
    if (!path) return '';
    const trimmed = String(path).trim();
    if (!trimmed) return '';
    if (PAGE_ALIAS_OVERRIDES[trimmed]) {
        return PAGE_ALIAS_OVERRIDES[trimmed];
    }
    return trimmed;
}

function normalizeAssessmentRecord(record) {
    if (!record) return null;
    const participant = record.participant || {};
    const results = record.results || {};
    const responses = ensureArray(record.responses);
    return {
        id: record.id,
        classCode: (record.class_code || 'N/D').toUpperCase(),
        studentCode: record.student_code || '',
        participant: {
            name: participant.name || record.student_code || 'Anonimo',
            age: participant.age ?? null,
            gender: participant.gender || 'N/D'
        },
        results: {
            finalScore: results.finalScore ?? 0,
            accuracy: results.accuracy ?? 0,
            totalTime: results.totalTime ?? null,
            avgTime: results.avgTime ?? null,
            correctCount: results.correctCount ?? null,
            performanceLevel: results.performanceLevel || '',
            difficultyStats: results.difficultyStats || {}
        },
        responses,
        started_at: record.started_at || null,
        ended_at: record.ended_at || null,
        created_at: record.created_at || new Date().toISOString()
    };
}

function openAssessmentDetail(id) {
    if (!elements.assessmentModal) return;
    const entry = dashboardState.assessmentIndex.get(String(id));
    if (!entry) {
        alert('Impossibile trovare il test selezionato.');
        return;
    }

    const detailsHtml = buildAssessmentDetail(entry);
    if (elements.assessmentModalBody) {
        elements.assessmentModalBody.innerHTML = detailsHtml;
    }
    elements.assessmentModal.classList.add('open');
    elements.assessmentModal.setAttribute('aria-hidden', 'false');
}

function closeAssessmentDetail() {
    if (!elements.assessmentModal) return;
    elements.assessmentModal.classList.remove('open');
    elements.assessmentModal.setAttribute('aria-hidden', 'true');
}

function buildAssessmentDetail(entry) {
    const result = entry.results || {};
    const docLink = `${STROOP_BASE_URL}?docente=1&doc_class=${encodeURIComponent(entry.classCode.toLowerCase())}&doc_student=${encodeURIComponent((entry.studentCode || '').toLowerCase())}`;
    const difficultyHtml = Object.entries(result.difficultyStats || {})
        .map(([level, stats]) => `
            <div class="assessment-detail-item">
                <span>${formatDifficulty(level)}</span>
                <strong>${(stats.accuracy ?? 0).toFixed(1)}% accurate</strong>
                <p style="margin:0.25rem 0 0;font-size:0.85rem;color:#475569;">
                    ${stats.correct ?? 0}/${stats.total ?? 0} risposte · ${stats.avgTime ? stats.avgTime.toFixed(2) + 's' : '-'}
                </p>
            </div>
        `).join('');

    const responsesRows = (entry.responses || []).map((response, index) => `
        <tr>
            <td>${response.trialNumber ?? index + 1}</td>
            <td>${response.displayWord || '-'}</td>
            <td>${response.displayColor || '-'}</td>
            <td>${response.selectedColor || '-'}</td>
            <td>${formatSeconds(response.responseTime ? response.responseTime / 1000 : null)}</td>
            <td>${formatDifficulty(response.difficulty)}</td>
            <td class="${response.isCorrect ? 'success' : 'error'}">${response.isCorrect ? '✓' : '✗'}</td>
        </tr>
    `).join('');

    return `
        <div class="assessment-modal-body">
            <h2 style="margin-top:0;">Dettaglio Test · ${entry.classCode}</h2>
            <p class="muted" style="margin-bottom:1rem;">${entry.participant.name || entry.studentCode || 'Anonimo'} · ${formatDateTime(entry.created_at)}</p>

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
                    <strong>${result.correctCount ?? '-'} / ${(entry.responses || []).length}</strong>
                </div>
            </div>

            <div class="assessment-detail-grid">
                <div class="assessment-detail-item">
                    <span>Performance</span>
                    <strong>${result.performanceLevel || '—'}</strong>
                </div>
                <div class="assessment-detail-item">
                    <span>Studente / codice</span>
                    <strong>${entry.participant.name || entry.studentCode || 'Anonimo'}</strong>
                </div>
                <div class="assessment-detail-item">
                    <span>Classe</span>
                    <strong>${entry.classCode}</strong>
                </div>
                <div class="assessment-detail-item">
                    <span>Apri il test</span>
                    <strong><a href="${docLink}" target="_blank" rel="noopener">Modalità docente →</a></strong>
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

function toggleLoading(isLoading) {
    if (elements.refreshBtn) {
        elements.refreshBtn.disabled = isLoading;
        elements.refreshBtn.textContent = isLoading ? 'Carico...' : '🔄 Aggiorna dati';
    }
}

function setStatus(message) {
    if (elements.lastRefresh && message) {
        elements.lastRefresh.textContent = message;
    }
}

function formatDateTime(value) {
    if (!value) return '-';
    try {
        return new Date(value).toLocaleString('it-IT');
    } catch {
        return value;
    }
}

function formatActivityName(path) {
    if (!path) return '—';
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
        const minutes = Math.floor(num / 60);
        const seconds = Math.round(num % 60);
        return `${minutes}m ${seconds}s`;
    }
    return `${num.toFixed(1)}s`;
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
