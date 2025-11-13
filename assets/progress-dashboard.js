const SUPABASE_URL = 'https://ruplzgcnheddmqqdephp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cGx6Z2NuaGVkZG1xcWRlcGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTYyMjksImV4cCI6MjA3NTY5MjIyOX0.tOLIkgi5yTt61_0rMlXUqxnbil4DLD7kBaqZBVAv1CI';
const PROGRESS_ENDPOINT = `${SUPABASE_URL}/rest/v1/progress`;
const SITE_BASE = window.location.origin.replace(/\/$/, '');

const STROOP_BASE_URL = `${SITE_BASE}/materiali/compresenza/test-stroop.html`;

const dashboardState = {
    records: [],
    filtered: [],
    classFilter: '',
    activityFilter: '',
    searchTerm: '',
    assessments: [],
    filteredAssessments: []
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
        select: 'id,class_code,student_code,participant,results,created_at',
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
            const link = entry.pagePath ? `${SITE_BASE}${entry.pagePath.startsWith('/') ? '' : '/'}${entry.pagePath}` : '#';
            return `
                <tr>
                    <td>${formatActivityName(entry.pagePath)}</td>
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
        const student = record.student_code || 'sconosciuto';
        const key = `${classCode}|${student.toLowerCase()}`;
        if (!map.has(key)) {
            map.set(key, {
                classCode,
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
            const link = entry.pagePath ? `${SITE_BASE}${entry.pagePath.startsWith('/') ? '' : '/'}${entry.pagePath}` : '#';
            const statsLink = `${STROOP_STATS_URL}?classe=${encodeURIComponent(entry.classCode.toLowerCase())}`;
            return `
                <tr>
                    <td>${entry.classCode}</td>
                    <td>${entry.studentCode}</td>
                    <td>${formatActivityName(entry.pagePath)}</td>
                    <td>${formatDateTime(entry.lastUpdate)}</td>
                    <td>
                        <a class="btn-link" href="${statsLink}" target="_blank" rel="noopener">Statistiche</a>
                        <span class="divider">·</span>
                        <a class="btn-link" href="${link}" target="_blank" rel="noopener">Pagina</a>
                    </td>
                </tr>
            `;
        });

    elements.studentBody.innerHTML = rows.join('');
}

function applyAssessmentFilter(classCode = '') {
    let dataset = dashboardState.assessments;
    if (classCode) {
        dataset = dataset.filter(entry => entry.classCode.toLowerCase() === classCode.toLowerCase());
    }
    dashboardState.filteredAssessments = dataset;
    renderAssessmentSummary(dataset);
    renderAssessmentTable(dataset);
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
        elements.assessmentDetailBody.innerHTML = '<tr><td colspan="6">Nessun risultato disponibile.</td></tr>';
        return;
    }

    const rows = data
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(entry => `
            <tr>
                <td>${entry.classCode}</td>
                <td>${entry.participant.name || 'Anonimo'}</td>
                <td>${entry.results.finalScore ?? 0}</td>
                <td>${(entry.results.accuracy ?? 0).toFixed(1)}%</td>
                <td>${formatDateTime(entry.created_at)}</td>
                <td>
                    <a class="btn-link" href="${STROOP_STATS_URL}?classe=${encodeURIComponent(entry.classCode.toLowerCase())}" target="_blank" rel="noopener">Statistiche</a>
                    <span class="divider">·</span>
                    <a class="btn-link" href="${STROOP_BASE_URL}" target="_blank" rel="noopener">Pagina</a>
                </td>
            </tr>
        `);

    elements.assessmentDetailBody.innerHTML = rows.join('');
}
 
function normalizeAssessmentRecord(record) {
    if (!record) return null;
    const participant = record.participant || {};
    const results = record.results || {};
    return {
        id: record.id,
        classCode: (record.class_code || 'N/D').toUpperCase(),
        participant: {
            name: participant.name || 'Anonimo',
            age: participant.age ?? null,
            gender: participant.gender || 'N/D'
        },
        results: {
            finalScore: results.finalScore ?? 0,
            accuracy: results.accuracy ?? 0
        },
        created_at: record.created_at || new Date().toISOString()
    };
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

function formatActivityName(path) {
    if (!path) return '—';
    const clean = path.replace(/^\//, '').replace(/-/g, ' ').replace(/_/g, ' ');
    return clean.length ? clean : path;
}

function formatDateTime(value) {
    if (!value) return '-';
    try {
        return new Date(value).toLocaleString('it-IT');
    } catch {
        return value;
    }
}
