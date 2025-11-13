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
function sendDataToServer(testData) {
    if (!DATA_CONFIG.USE_GOOGLE_SHEETS || !DATA_CONFIG.GOOGLE_SHEETS_URL) {
        console.log('ℹ Google Sheets non configurato - solo salvataggio locale');
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

// === INVIO RIFLESSIONI ===
function sendReflectionToServer(reflections) {
    if (!DATA_CONFIG.USE_GOOGLE_SHEETS) {
        console.log('ℹ Riflessioni salvate solo localmente');
        return Promise.resolve(false);
    }
    
    // Aggiungi riflessioni all'ultimo test salvato
    try {
        let allTests = JSON.parse(localStorage.getItem(DATA_CONFIG.STORAGE_KEY) || '[]');
        if (allTests.length > 0) {
            allTests[allTests.length - 1].reflections = reflections;
            localStorage.setItem(DATA_CONFIG.STORAGE_KEY, JSON.stringify(allTests));
        }
    } catch (error) {
        console.error('Errore salvataggio riflessioni:', error);
    }
    
    return fetch(DATA_CONFIG.GOOGLE_SHEETS_URL, {
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
    })
    .catch(error => {
        console.error('Errore invio riflessioni:', error);
    });
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
