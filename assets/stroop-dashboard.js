const SUPABASE_URL = 'https://ruplzgcnheddmqqdephp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cGx6Z2NuaGVkZG1xcWRlcGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTYyMjksImV4cCI6MjA3NTY5MjIyOX0.tOLIkgi5yTt61_0rMlXUqxnbil4DLD7kBaqZBVAv1CI';
const STROOP_ENDPOINT = `${SUPABASE_URL}/rest/v1/stroop_tests`;
const DOCENTE_SESSION_KEY = 'mo:docente-session';
const DOCENTE_SESSION_DURATION = 1000 * 60 * 60 * 6;

const state = {
  records: [],
  filtered: [],
  classFilter: '',
  searchTerm: ''
};

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  state.classFilter = params.get('classe') || '';

  const overlay = $('stroop-auth-overlay');
  const dashboard = $('stroop-dashboard-content');
  const form = $('stroop-login-form');
  const refreshBtn = $('stroop-refresh');
  const classSelect = $('stroop-class-filter');
  const searchInput = $('stroop-student-search');
  const exportBtn = $('stroop-export');

  const sessionValid = isDocenteSessionValid();

  if (sessionValid) {
    overlay?.classList.add('hidden');
    dashboard?.classList.remove('hidden');
    refresh();
  }

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = $('stroop-password')?.value?.trim().toLowerCase();
      if (value === 'metodologie!237038') {
        persistDocenteSession();
        overlay?.classList.add('hidden');
        dashboard?.classList.remove('hidden');
        refresh();
      } else {
        alert('Password non corretta');
        $('stroop-password')?.focus();
      }
    });
  }

  refreshBtn?.addEventListener('click', refresh);
  classSelect?.addEventListener('change', (event) => {
    state.classFilter = event.target.value;
    applyFilters();
  });
  searchInput?.addEventListener('input', (event) => {
    state.searchTerm = event.target.value.trim().toLowerCase();
    applyFilters();
  });
  exportBtn?.addEventListener('click', exportCSV);
});

async function refresh() {
  setLoading(true);
  try {
    const records = await fetchStroopData();
    state.records = records.map(normalizeRecord);
    populateClassFilter(state.records);
    applyFilters();
    $('stroop-last-refresh').textContent = new Date().toLocaleString('it-IT');
  } catch (error) {
    console.error('Errore caricamento dati Stroop:', error);
    alert('Impossibile caricare i dati. Riprova più tardi.');
  } finally {
    setLoading(false);
  }
}

async function fetchStroopData() {
  const params = new URLSearchParams({
    select: 'id,class_code,student_code,participant,results,created_at',
    order: 'created_at.desc',
    limit: '1000'
  });
  const response = await fetch(`${STROOP_ENDPOINT}?${params.toString()}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  if (!response.ok) {
    throw new Error(`Supabase error ${response.status}`);
  }
  return response.json();
}

function populateClassFilter(records) {
  const select = $('stroop-class-filter');
  if (!select) return;
  const classes = Array.from(
    new Set(
      records
        .map(record => record.classCode?.toLowerCase())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'it', { numeric: true }));

  const options = ['<option value="">Tutte le classi</option>'];
  classes.forEach(cls => {
    const selected = state.classFilter && state.classFilter.toLowerCase() === cls ? 'selected' : '';
    options.push(`<option value="${cls}" ${selected}>${cls.toUpperCase()}</option>`);
  });
  select.innerHTML = options.join('');
  if (state.classFilter) {
    select.value = state.classFilter.toLowerCase();
  }
}

function applyFilters() {
  let dataset = [...state.records];
  if (state.classFilter) {
    const key = state.classFilter.toLowerCase();
    dataset = dataset.filter(item => item.classCode.toLowerCase() === key);
  }
  if (state.searchTerm) {
    dataset = dataset.filter(item =>
      item.studentCode.toLowerCase().includes(state.searchTerm) ||
      (item.participant.name || '').toLowerCase().includes(state.searchTerm)
    );
  }
  state.filtered = dataset;
  updateStats(dataset);
  renderClassSummary(dataset);
  renderDetailTable(dataset);
}

function updateStats(records) {
  const participants = records.length;
  const avgScore = participants
    ? records.reduce((sum, item) => sum + (item.results.finalScore || 0), 0) / participants
    : 0;
  const avgAccuracy = participants
    ? records.reduce((sum, item) => sum + (item.results.accuracy || 0), 0) / participants
    : 0;
  const last = records[0]?.created_at ? formatDateTime(records[0].created_at) : '-';

  $('stroop-stat-students').textContent = participants;
  $('stroop-stat-score').textContent = avgScore.toFixed(1);
  $('stroop-stat-accuracy').textContent = avgAccuracy.toFixed(1) + '%';
  $('stroop-stat-last').textContent = last;
}

function renderClassSummary(records) {
  const tbody = $('stroop-class-summary');
  if (!tbody) return;

  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="5">Nessun dato disponibile.</td></tr>';
    return;
  }

  const map = new Map();
  records.forEach(record => {
    const key = record.classCode;
    if (!map.has(key)) {
      map.set(key, { count: 0, sumScore: 0, sumAccuracy: 0, last: record.created_at });
    }
    const entry = map.get(key);
    entry.count += 1;
    entry.sumScore += record.results.finalScore || 0;
    entry.sumAccuracy += record.results.accuracy || 0;
    if (new Date(record.created_at) > new Date(entry.last)) {
      entry.last = record.created_at;
    }
  });

  const rows = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'it', { numeric: true }))
    .map(([cls, entry]) => `
        <tr>
            <td>${cls}</td>
            <td>${entry.count}</td>
            <td>${(entry.sumScore / entry.count).toFixed(1)}</td>
            <td>${(entry.sumAccuracy / entry.count).toFixed(1)}%</td>
            <td>${formatDateTime(entry.last)}</td>
        </tr>
    `);

  tbody.innerHTML = rows.join('');
}

function renderDetailTable(records) {
  const tbody = $('stroop-detail-body');
  if (!tbody) return;
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="5">Nessun risultato disponibile.</td></tr>';
    return;
  }

  const rows = records
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(record => `
        <tr>
            <td>${record.classCode}</td>
            <td>${record.participant.name || record.studentCode}</td>
            <td>${record.results.finalScore ?? 0}</td>
            <td>${(record.results.accuracy ?? 0).toFixed(1)}%</td>
            <td>${formatDateTime(record.created_at)}</td>
        </tr>
    `);

  tbody.innerHTML = rows.join('');
}

function exportCSV() {
  const data = state.filtered.length ? state.filtered : state.records;
  if (!data.length) {
    alert('Nessun dato da esportare.');
    return;
  }

  let csv = 'Classe,Studente,Punteggio,Accuratezza,Data\n';
  data.forEach(record => {
    csv += `${record.classCode},`;
    csv += `"${record.participant.name || record.studentCode}",`;
    csv += `${record.results.finalScore ?? 0},`;
    csv += `${(record.results.accuracy ?? 0).toFixed(1)},`;
    csv += `${formatDateTime(record.created_at)}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `stroop_results_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

function normalizeRecord(record) {
  const participant = record.participant || {};
  const results = record.results || {};
  return {
    id: record.id,
    classCode: (record.class_code || 'N/D').toUpperCase(),
    studentCode: record.student_code || 'sconosciuto',
    participant: {
      name: participant.name || '',
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

function setLoading(isLoading) {
  const btn = $('stroop-refresh');
  if (btn) {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Carico...' : '🔄 Aggiorna dati';
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

function persistDocenteSession() {
  try {
    const payload = {
      issuedAt: Date.now(),
      expiresAt: Date.now() + DOCENTE_SESSION_DURATION
    };
    localStorage.setItem(DOCENTE_SESSION_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Impossibile salvare la sessione docente:', error);
  }
}

function isDocenteSessionValid() {
  try {
    const raw = localStorage.getItem(DOCENTE_SESSION_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data?.expiresAt) return false;
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(DOCENTE_SESSION_KEY);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Impossibile leggere la sessione docente:', error);
    return false;
  }
}
