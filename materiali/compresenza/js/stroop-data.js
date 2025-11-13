/* ========================================
   STROOP TEST - DATA MANAGEMENT
   Prof. Salvatore Picconi - IIS Meucci Mattei
   Gestione raccolta, salvataggio e invio dati
   ======================================== */

// === CONFIGURAZIONE ===
const DATA_CONFIG = {
    // Google Sheets API (da configurare)
    GOOGLE_SHEETS_URL: '', // Inserire URL del Google Apps Script
    USE_GOOGLE_SHEETS: false, // Abilitare quando configurato
    
    // Opzioni localStorage
    STORAGE_KEY: 'stroopTests',
    MAX_LOCAL_STORAGE: 100 // Numero massimo test in localStorage
};

const SUPABASE_CONFIG = {
    ENABLED: true,
    URL: 'https://ruplzgcnheddmqqdephp.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cGx6Z2NuaGVkZG1xcWRlcGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTYyMjksImV4cCI6MjA3NTY5MjIyOX0.tOLIkgi5yTt61_0rMlXUqxnbil4DLD7kBaqZBVAv1CI',
    TESTS_TABLE: 'stroop_tests',
    REFLECTIONS_TABLE: 'stroop_reflections'
};

function getStoredIdentity() {
    try {
        const classCode = localStorage.getItem('mo:class') || sessionStorage.getItem('mo:class');
        const studentCode = localStorage.getItem('mo:code') || sessionStorage.getItem('mo:code');
        if (classCode && studentCode) {
            return { classCode, studentCode };
        }
    } catch (error) {
        console.warn('Impossibile leggere i dati di identità:', error);
    }
    return null;
}

async function supabaseRequest(path, options = {}) {
    if (!SUPABASE_CONFIG.ENABLED) {
        return Promise.resolve(null);
    }
    const url = `${SUPABASE_CONFIG.URL}/rest/v1/${path}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            apikey: SUPABASE_CONFIG.ANON_KEY,
            Authorization: `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
            ...(options.headers || {})
        }
    });

    const text = await response.text();
    if (!response.ok) {
        const errorMessage = `Supabase error ${response.status}: ${text}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function fetchTestsFromSupabase(filter = {}) {
    if (!SUPABASE_CONFIG.ENABLED) {
        return Promise.resolve([]);
    }

    const params = new URLSearchParams();
    params.set('select', 'id,class_code,student_code,participant,results,responses,created_at,started_at,ended_at');
    params.set('order', 'created_at.desc');
    if (filter.classCode) {
        params.set('class_code', `eq.${filter.classCode}`);
    }

    return supabaseRequest(`${SUPABASE_CONFIG.TESTS_TABLE}?${params.toString()}`);
}

function fetchReflectionsFromSupabase(filter = {}) {
    if (!SUPABASE_CONFIG.ENABLED) {
        return Promise.resolve([]);
    }
    const params = new URLSearchParams();
    params.set('select', 'id,class_code,student_code,participant,reflections,submitted_at');
    params.set('order', 'submitted_at.desc');
    if (filter.classCode) {
        params.set('class_code', `eq.${filter.classCode}`);
    }
    return supabaseRequest(`${SUPABASE_CONFIG.REFLECTIONS_TABLE}?${params.toString()}`);
}

// === SALVATAGGIO LOCALE ===
function saveToLocalStorage(testData) {
    try {
        let allTests = JSON.parse(localStorage.getItem(DATA_CONFIG.STORAGE_KEY) || '[]');
        
        // Aggiungi nuovo test
        allTests.push({
            ...testData,
            savedAt: new Date().toISOString(),
            id: generateUniqueId()
        });
        
        // Limita dimensione storage
        if (allTests.length > DATA_CONFIG.MAX_LOCAL_STORAGE) {
            allTests = allTests.slice(-DATA_CONFIG.MAX_LOCAL_STORAGE);
        }
        
        localStorage.setItem(DATA_CONFIG.STORAGE_KEY, JSON.stringify(allTests));
        console.log('✓ Dati salvati in localStorage');
        return true;
    } catch (error) {
        console.error('✗ Errore salvataggio localStorage:', error);
        return false;
    }
}

// === INVIO DATI AL SERVER (GOOGLE SHEETS) ===
function sendToGoogleSheets(testData) {
    if (!DATA_CONFIG.USE_GOOGLE_SHEETS || !DATA_CONFIG.GOOGLE_SHEETS_URL) {
        return Promise.resolve(false);
    }

    return fetch(DATA_CONFIG.GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            timestamp: new Date().toISOString(),
            participant: testData.participant,
            results: testData.testData.results,
            responses: testData.testData.responses
        })
    })
    .then(() => {
        console.log('✓ Dati inviati a Google Sheets');
        return true;
    })
    .catch(error => {
        console.error('✗ Errore invio Google Sheets:', error);
        return false;
    });
}

function sendDataToSupabase(testData) {
    if (!SUPABASE_CONFIG.ENABLED) {
        return Promise.resolve(false);
    }

    const identity = getStoredIdentity();
    const payload = {
        class_code: identity?.classCode || null,
        student_code: identity?.studentCode || null,
        participant: testData.participant,
        results: testData.testData?.results,
        responses: testData.testData?.responses,
        started_at: testData.testData?.startTime ? new Date(testData.testData.startTime).toISOString() : null,
        ended_at: testData.testData?.endTime ? new Date(testData.testData.endTime).toISOString() : null
    };

    return supabaseRequest(`${SUPABASE_CONFIG.TESTS_TABLE}`, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
    .then(() => {
        console.log('✓ Dati inviati a Supabase');
        return true;
    })
    .catch(error => {
        console.error('✗ Errore invio Supabase:', error);
        return false;
    });
}

function sendDataToServer(testData) {
    const operations = [];
    if (DATA_CONFIG.USE_GOOGLE_SHEETS && DATA_CONFIG.GOOGLE_SHEETS_URL) {
        operations.push(sendToGoogleSheets(testData));
    }
    if (SUPABASE_CONFIG.ENABLED) {
        operations.push(sendDataToSupabase(testData));
    }

    if (!operations.length) {
        console.log('ℹ Nessun backend configurato - dati solo locali');
        return Promise.resolve(false);
    }

    return Promise.allSettled(operations).then(results => {
        return results.some(result => result.status === 'fulfilled' && result.value);
    });
}

// === INVIO RIFLESSIONI ===
function sendReflectionToServer(reflections, participant = null) {
    const tasks = [];
    
    if (DATA_CONFIG.USE_GOOGLE_SHEETS && DATA_CONFIG.GOOGLE_SHEETS_URL) {
        tasks.push(
            fetch(DATA_CONFIG.GOOGLE_SHEETS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'reflection',
                    timestamp: new Date().toISOString(),
                    reflections: reflections
                })
            }).catch(error => {
                console.error('Errore invio riflessioni a Google Sheets:', error);
            })
        );
    }

    if (SUPABASE_CONFIG.ENABLED) {
        const identity = getStoredIdentity();
        const payload = {
            class_code: identity?.classCode || null,
            student_code: identity?.studentCode || null,
            participant: participant || null,
            reflections,
            submitted_at: new Date().toISOString()
        };
        tasks.push(
            supabaseRequest(`${SUPABASE_CONFIG.REFLECTIONS_TABLE}`, {
                method: 'POST',
                body: JSON.stringify(payload)
            }).then(() => {
                console.log('✓ Riflessioni inviate a Supabase');
            }).catch(error => {
                console.error('Errore invio riflessioni a Supabase:', error);
            })
        );
    }
    
    if (!tasks.length) {
        console.log('ℹ Riflessioni salvate solo localmente');
        return Promise.resolve(false);
    }

    return Promise.allSettled(tasks);
}

// === RECUPERO DATI ===
function getAllTestsFromStorage() {
    try {
        return JSON.parse(localStorage.getItem(DATA_CONFIG.STORAGE_KEY) || '[]');
    } catch (error) {
        console.error('Errore recupero dati:', error);
        return [];
    }
}

function getTestById(id) {
    const allTests = getAllTestsFromStorage();
    return allTests.find(test => test.id === id);
}

// === CANCELLAZIONE DATI ===
function clearLocalStorage() {
    if (confirm('Sei sicuro di voler cancellare TUTTI i dati locali? Questa azione non può essere annullata.')) {
        localStorage.removeItem(DATA_CONFIG.STORAGE_KEY);
        console.log('✓ Dati locali cancellati');
        return true;
    }
    return false;
}

function deleteTestById(id) {
    try {
        let allTests = getAllTestsFromStorage();
        allTests = allTests.filter(test => test.id !== id);
        localStorage.setItem(DATA_CONFIG.STORAGE_KEY, JSON.stringify(allTests));
        console.log('✓ Test eliminato');
        return true;
    } catch (error) {
        console.error('Errore eliminazione test:', error);
        return false;
    }
}

// === EXPORT DATI ===
function exportToJSON() {
    const allTests = getAllTestsFromStorage();
    const dataStr = JSON.stringify(allTests, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stroop_data_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function exportToCSV() {
    const allTests = getAllTestsFromStorage();
    
    if (allTests.length === 0) {
        alert('Nessun dato da esportare');
        return;
    }
    
    // Header CSV
    let csv = 'ID,Data,Ora,Nome,Età,Sesso,Punteggio,Livello,Tempo_Totale,Tempo_Medio,Corrette,Accuratezza,%\n';
    
    // Righe dati
    allTests.forEach(test => {
        const date = new Date(test.participant.timestamp);
        const results = test.testData.results;
        
        csv += `${test.id},`;
        csv += `${date.toLocaleDateString('it-IT')},`;
        csv += `${date.toLocaleTimeString('it-IT')},`;
        csv += `"${test.participant.name}",`;
        csv += `${test.participant.age},`;
        csv += `${test.participant.gender},`;
        csv += `${results.finalScore},`;
        csv += `"${results.performanceLevel}",`;
        csv += `${results.totalTime.toFixed(2)},`;
        csv += `${results.avgTime.toFixed(2)},`;
        csv += `${results.correctCount},`;
        csv += `${results.accuracy.toFixed(1)}\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stroop_data_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

function exportDetailedCSV() {
    const allTests = getAllTestsFromStorage();
    
    if (allTests.length === 0) {
        alert('Nessun dato da esportare');
        return;
    }
    
    // Header CSV con dettagli per ogni prova
    let csv = 'Test_ID,Partecipante,Età,Sesso,Prova_N,Difficoltà,Parola,Colore_Inchiostro,Risposta_Corretta,Risposta_Data,Corretto,Tempo_Risposta_ms\n';
    
    // Righe dati
    allTests.forEach(test => {
        test.testData.responses.forEach(response => {
            csv += `${test.id},`;
            csv += `"${test.participant.name}",`;
            csv += `${test.participant.age},`;
            csv += `${test.participant.gender},`;
            csv += `${response.trialNumber},`;
            csv += `${response.difficulty},`;
            csv += `${response.word},`;
            csv += `${response.inkColor},`;
            csv += `${response.correctAnswer},`;
            csv += `${response.selectedAnswer},`;
            csv += `${response.isCorrect ? 'SI' : 'NO'},`;
            csv += `${response.responseTime}\n`;
        });
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stroop_detailed_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// === STATISTICHE AGGREGATE ===
function getAggregateStats() {
    const allTests = getAllTestsFromStorage();
    
    if (allTests.length === 0) {
        return null;
    }
    
    const stats = {
        totalTests: allTests.length,
        avgScore: 0,
        avgTime: 0,
        avgAccuracy: 0,
        scoreDistribution: {
            excellent: 0,
            good: 0,
            fair: 0,
            poor: 0
        },
        ageGroups: {},
        genderStats: {
            M: { count: 0, avgScore: 0 },
            F: { count: 0, avgScore: 0 },
            A: { count: 0, avgScore: 0 }
        }
    };
    
    allTests.forEach(test => {
        const results = test.testData.results;
        
        // Medie
        stats.avgScore += results.finalScore;
        stats.avgTime += results.avgTime;
        stats.avgAccuracy += results.accuracy;
        
        // Distribuzione punteggi
        if (results.finalScore >= 900) stats.scoreDistribution.excellent++;
        else if (results.finalScore >= 700) stats.scoreDistribution.good++;
        else if (results.finalScore >= 600) stats.scoreDistribution.fair++;
        else stats.scoreDistribution.poor++;
        
        // Gruppi età
        const age = test.participant.age;
        if (!stats.ageGroups[age]) {
            stats.ageGroups[age] = { count: 0, totalScore: 0 };
        }
        stats.ageGroups[age].count++;
        stats.ageGroups[age].totalScore += results.finalScore;
        
        // Statistiche per genere
        const gender = test.participant.gender;
        if (stats.genderStats[gender]) {
            stats.genderStats[gender].count++;
            stats.genderStats[gender].avgScore += results.finalScore;
        }
    });
    
    // Calcola medie
    stats.avgScore = Math.round(stats.avgScore / allTests.length);
    stats.avgTime = (stats.avgTime / allTests.length).toFixed(2);
    stats.avgAccuracy = (stats.avgAccuracy / allTests.length).toFixed(1);
    
    // Medie per genere
    Object.keys(stats.genderStats).forEach(gender => {
        if (stats.genderStats[gender].count > 0) {
            stats.genderStats[gender].avgScore = Math.round(
                stats.genderStats[gender].avgScore / stats.genderStats[gender].count
            );
        }
    });
    
    return stats;
}

// === UTILITY ===
function generateUniqueId() {
    return 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('it-IT') + ' ' + date.toLocaleTimeString('it-IT');
}

// === PRIVACY E GDPR ===
function anonymizeData(testData) {
    const anonymized = JSON.parse(JSON.stringify(testData));
    anonymized.participant.name = 'Anonimo_' + Math.random().toString(36).substr(2, 6);
    return anonymized;
}

// === EXPORT FUNZIONI ===
window.saveToLocalStorage = saveToLocalStorage;
window.sendDataToServer = sendDataToServer;
window.sendReflectionToServer = sendReflectionToServer;
window.getAllTestsFromStorage = getAllTestsFromStorage;
window.getTestById = getTestById;
window.clearLocalStorage = clearLocalStorage;
window.deleteTestById = deleteTestById;
window.exportToJSON = exportToJSON;
window.exportToCSV = exportToCSV;
window.exportDetailedCSV = exportDetailedCSV;
window.getAggregateStats = getAggregateStats;
window.anonymizeData = anonymizeData;
window.StroopDataAPI = {
    isSupabaseEnabled: () => SUPABASE_CONFIG.ENABLED,
    fetchAllTests: () => fetchTestsFromSupabase(),
    fetchTestsByClass: (classCode) => fetchTestsFromSupabase({ classCode }),
    fetchReflections: (classCode) => fetchReflectionsFromSupabase({ classCode })
};

// === CONFIGURAZIONE GOOGLE SHEETS (GUIDA) ===
window.STROOP_DATA_SETUP = {
    setupGoogleSheets: function() {
        console.log(`
========================================
GUIDA SETUP GOOGLE SHEETS
========================================

1. Crea un nuovo Google Sheet
2. Vai su "Estensioni" > "Apps Script"
3. Incolla il seguente codice:

-------- INIZIO CODICE --------
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Test Stroop');
  
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Test Stroop');
    sheet.appendRow(['Timestamp', 'Nome', 'Età', 'Sesso', 'Punteggio', 'Livello', 'Tempo Totale', 'Tempo Medio', 'Corrette', 'Accuratezza']);
  }
  
  var data = JSON.parse(e.postData.contents);
  
  if (data.type === 'reflection') {
    // Gestisci riflessioni in un altro sheet
    return ContentService.createTextOutput(JSON.stringify({result: 'success'}));
  }
  
  sheet.appendRow([
    data.timestamp,
    data.participant.name,
    data.participant.age,
    data.participant.gender,
    data.results.finalScore,
    data.results.performanceLevel,
    data.results.totalTime,
    data.results.avgTime,
    data.results.correctCount,
    data.results.accuracy
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({result: 'success'}));
}
-------- FINE CODICE --------

4. Clicca su "Deploy" > "New deployment"
5. Type: "Web app"
6. Execute as: "Me"
7. Who has access: "Anyone"
8. Clicca "Deploy"
9. Copia l'URL generato
10. Incolla l'URL in DATA_CONFIG.GOOGLE_SHEETS_URL
11. Imposta DATA_CONFIG.USE_GOOGLE_SHEETS = true

FATTO! I dati verranno automaticamente inviati al Google Sheet.
        `);
    }
};

// === AUTO-INIT ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('Stroop Data Management module loaded');
    console.log('Per configurare Google Sheets: window.STROOP_DATA_SETUP.setupGoogleSheets()');
});
