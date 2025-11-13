/* ========================================
   STROOP TEST - MAIN LOGIC
   Prof. Salvatore Picconi - IIS Meucci Mattei
   ======================================== */

// === CONFIGURAZIONE GLOBALE ===
const CONFIG = {
    TOTAL_TRIALS: 30,
    DIFFICULTY_LEVELS: {
        BASE: { start: 1, end: 8, label: 'BASE' },
        MEDIUM: { start: 9, end: 16, label: 'MEDIA' },
        HIGH: { start: 17, end: 24, label: 'ALTA' },
        MAX: { start: 25, end: 30, label: 'MASSIMA' }
    },
    COLORS: [
        { name: 'ROSSO', hex: '#FF0000' },
        { name: 'BLU', hex: '#0000FF' },
        { name: 'VERDE', hex: '#00AA00' },
        { name: 'GIALLO', hex: '#FFD700' },
        { name: 'VIOLA', hex: '#800080' },
        { name: 'ARANCIONE', hex: '#FF6600' }
    ]
};

// === STATO DELL'APPLICAZIONE ===
const appState = {
    currentSection: 'intro',
    participantData: null,
    testData: {
        trials: [],
        currentTrial: 0,
        startTime: null,
        responses: []
    }
};

// === GESTIONE SEZIONI ===
function showSection(sectionId) {
    // Nascondi tutte le sezioni
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Mostra la sezione richiesta
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.remove('hidden');
        appState.currentSection = sectionId;
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// === GENERAZIONE PROVE ===
function generateTrials() {
    const trials = [];
    
    for (let i = 1; i <= CONFIG.TOTAL_TRIALS; i++) {
        // Determina difficoltà
        let difficulty;
        if (i <= CONFIG.DIFFICULTY_LEVELS.BASE.end) {
            difficulty = 'BASE';
        } else if (i <= CONFIG.DIFFICULTY_LEVELS.MEDIUM.end) {
            difficulty = 'MEDIUM';
        } else if (i <= CONFIG.DIFFICULTY_LEVELS.HIGH.end) {
            difficulty = 'HIGH';
        } else {
            difficulty = 'MAX';
        }
        
        // Seleziona colori disponibili in base alla difficoltà
        let availableColors;
        if (difficulty === 'BASE') {
            availableColors = CONFIG.COLORS.slice(0, 3); // Solo primi 3 colori
        } else if (difficulty === 'MEDIUM') {
            availableColors = CONFIG.COLORS.slice(0, 4); // Primi 4 colori
        } else if (difficulty === 'HIGH') {
            availableColors = CONFIG.COLORS.slice(0, 5); // Primi 5 colori
        } else {
            availableColors = CONFIG.COLORS; // Tutti i 6 colori
        }
        
        // Seleziona parola e colore (sempre incongruenti)
        const wordColor = availableColors[Math.floor(Math.random() * availableColors.length)];
        let inkColor;
        do {
            inkColor = availableColors[Math.floor(Math.random() * availableColors.length)];
        } while (inkColor.name === wordColor.name); // Assicura incongruenza
        
        trials.push({
            trialNumber: i,
            difficulty: difficulty,
            word: wordColor.name,
            inkColor: inkColor.hex,
            correctAnswer: inkColor.name,
            availableColors: availableColors
        });
    }
    
    return trials;
}

// === INIZIALIZZAZIONE ===
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Event listeners per i bottoni principali
    document.getElementById('btn-start')?.addEventListener('click', () => {
        showSection('data-collection');
    });
    
    document.getElementById('btn-theory')?.addEventListener('click', () => {
        showSection('theory');
    });
    
    document.getElementById('btn-close-theory')?.addEventListener('click', () => {
        showSection('intro');
    });
    
    document.getElementById('btn-start-from-theory')?.addEventListener('click', () => {
        showSection('data-collection');
    });
    
    // Form partecipante
    document.getElementById('form-participant')?.addEventListener('submit', handleParticipantForm);
    
    // Bottone inizio test
    document.getElementById('btn-start-test')?.addEventListener('click', startTest);
    
    // Bottoni risultati
    document.getElementById('btn-download-certificate')?.addEventListener('click', downloadCertificate);
    document.getElementById('btn-reflect')?.addEventListener('click', () => showSection('reflection'));
    document.getElementById('btn-restart')?.addEventListener('click', restartTest);
    
    // Form riflessione
    document.getElementById('form-reflection')?.addEventListener('submit', handleReflectionForm);
    document.getElementById('btn-cases')?.addEventListener('click', () => showSection('cases'));
    
    // Bottoni casi clinici
    document.getElementById('btn-restart-from-cases')?.addEventListener('click', restartTest);
    document.getElementById('btn-view-class-stats')?.addEventListener('click', showClassStats);
    
    // Autenticazione statistiche
    document.getElementById('form-auth')?.addEventListener('submit', handleAuth);
    document.getElementById('btn-close-auth')?.addEventListener('click', () => showSection('cases'));
    
    // Esportazione dati
    document.getElementById('btn-export-data')?.addEventListener('click', exportClassData);
}

// === GESTIONE FORM PARTECIPANTE ===
function handleParticipantForm(e) {
    e.preventDefault();
    
    const name = document.getElementById('participant-name').value.trim() || 'Anonimo';
    const age = parseInt(document.getElementById('participant-age').value);
    const gender = document.getElementById('participant-gender').value;
    const consent = document.getElementById('consent').checked;
    
    if (!consent) {
        alert('Devi acconsentire al trattamento dei dati per procedere.');
        return;
    }
    
    if (age < 14 || age > 99) {
        alert('Inserisci un\'età valida (14-99 anni).');
        return;
    }
    
    // Salva dati partecipante
    appState.participantData = {
        name: name,
        age: age,
        gender: gender,
        timestamp: new Date().toISOString()
    };
    
    // Mostra istruzioni
    showSection('instructions');
}

// === INIZIO TEST ===
function startTest() {
    // Genera le prove
    appState.testData.trials = generateTrials();
    appState.testData.currentTrial = 0;
    appState.testData.responses = [];
    appState.testData.startTime = Date.now();
    
    // Mostra sezione test
    showSection('test');
    
    // Aggiorna UI
    document.getElementById('total-trials').textContent = CONFIG.TOTAL_TRIALS;
    
    // Mostra prima prova
    showTrial();
}

// === MOSTRA PROVA ===
function showTrial() {
    const trial = appState.testData.trials[appState.testData.currentTrial];
    if (!trial) {
        // Test completato
        endTest();
        return;
    }
    
    // Aggiorna header
    document.getElementById('current-trial').textContent = trial.trialNumber;
    const difficultyEl = document.getElementById('current-difficulty');
    difficultyEl.textContent = trial.difficulty;
    difficultyEl.className = 'difficulty-indicator';
    difficultyEl.style.background = getDifficultyColor(trial.difficulty);
    
    // Aggiorna progress bar
    const progress = (trial.trialNumber / CONFIG.TOTAL_TRIALS) * 100;
    document.getElementById('progress-bar').style.width = progress + '%';
    
    // Mostra parola stimolo
    const stimulusEl = document.getElementById('stimulus-word');
    stimulusEl.textContent = trial.word;
    stimulusEl.style.color = trial.inkColor;
    
    // Genera bottoni colori
    const buttonsContainer = document.getElementById('color-buttons');
    buttonsContainer.innerHTML = '';
    
    // Randomizza ordine bottoni
    const shuffledColors = [...trial.availableColors].sort(() => Math.random() - 0.5);
    
    shuffledColors.forEach(color => {
        const button = document.createElement('button');
        button.className = 'color-button';
        button.textContent = color.name;
        button.dataset.color = color.name;
        button.addEventListener('click', () => handleResponse(color.name));
        buttonsContainer.appendChild(button);
    });
    
    // Avvia timer per questa prova
    trial.trialStartTime = Date.now();
    updateTimer();
}

// === TIMER ===
let timerInterval;
function updateTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const elapsed = (Date.now() - appState.testData.startTime) / 1000;
        document.getElementById('timer-display').textContent = elapsed.toFixed(1) + 's';
    }, 100);
}

// === GESTIONE RISPOSTA ===
function handleResponse(selectedColor) {
    const trial = appState.testData.trials[appState.testData.currentTrial];
    const responseTime = Date.now() - trial.trialStartTime;
    const isCorrect = selectedColor === trial.correctAnswer;
    
    // Salva risposta
    appState.testData.responses.push({
        trialNumber: trial.trialNumber,
        difficulty: trial.difficulty,
        word: trial.word,
        inkColor: trial.inkColor,
        correctAnswer: trial.correctAnswer,
        selectedAnswer: selectedColor,
        isCorrect: isCorrect,
        responseTime: responseTime
    });
    
    // Passa alla prova successiva
    appState.testData.currentTrial++;
    
    // Breve pausa prima della prova successiva
    setTimeout(showTrial, 300);
}

// === FINE TEST ===
function endTest() {
    clearInterval(timerInterval);
    appState.testData.endTime = Date.now();
    
    // Calcola risultati
    calculateResults();
    
    // Mostra sezione risultati
    showSection('results');
    
    // Salva dati (localStorage + invio al server se configurato)
    saveTestData();
}

// === CALCOLO RISULTATI ===
function calculateResults() {
    const responses = appState.testData.responses;
    const totalTime = (appState.testData.endTime - appState.testData.startTime) / 1000;
    
    // Statistiche base
    const correctCount = responses.filter(r => r.isCorrect).length;
    const accuracy = (correctCount / responses.length) * 100;
    const avgTime = responses.reduce((sum, r) => sum + r.responseTime, 0) / responses.length / 1000;
    
    // Calcolo punteggio (max 1000)
    const accuracyScore = (accuracy / 100) * 600; // 60% del punteggio
    const speedScore = Math.max(0, 400 - (avgTime - 1.5) * 100); // 40% del punteggio
    const finalScore = Math.round(Math.max(0, Math.min(1000, accuracyScore + speedScore)));
    
    // Performance level
    let performanceLevel;
    if (finalScore >= 900) {
        performanceLevel = 'Eccellente - Prestazione Superiore';
    } else if (finalScore >= 800) {
        performanceLevel = 'Ottimo - Prestazione nella Norma Alta';
    } else if (finalScore >= 700) {
        performanceLevel = 'Buono - Prestazione nella Norma';
    } else if (finalScore >= 600) {
        performanceLevel = 'Discreto - Prestazione Accettabile';
    } else {
        performanceLevel = 'Da Migliorare - Suggerito Ripetere il Test';
    }
    
    // Analisi per difficoltà
    const difficultyStats = {};
    ['BASE', 'MEDIUM', 'HIGH', 'MAX'].forEach(level => {
        const levelResponses = responses.filter(r => r.difficulty === level);
        if (levelResponses.length > 0) {
            const levelCorrect = levelResponses.filter(r => r.isCorrect).length;
            const levelAvgTime = levelResponses.reduce((sum, r) => sum + r.responseTime, 0) / levelResponses.length / 1000;
            difficultyStats[level] = {
                correct: levelCorrect,
                total: levelResponses.length,
                accuracy: (levelCorrect / levelResponses.length) * 100,
                avgTime: levelAvgTime
            };
        }
    });
    
    // Salva risultati
    appState.testData.results = {
        totalTime: totalTime,
        avgTime: avgTime,
        correctCount: correctCount,
        accuracy: accuracy,
        finalScore: finalScore,
        performanceLevel: performanceLevel,
        difficultyStats: difficultyStats
    };
    
    // Aggiorna UI
    displayResults();
}

// === MOSTRA RISULTATI ===
function displayResults() {
    const results = appState.testData.results;
    
    // Punteggio principale
    document.getElementById('final-score').textContent = results.finalScore;
    document.getElementById('performance-level').textContent = results.performanceLevel;
    
    // Statistiche
    document.getElementById('total-time').textContent = results.totalTime.toFixed(1) + 's';
    document.getElementById('avg-time').textContent = results.avgTime.toFixed(2) + 's';
    document.getElementById('correct-answers').textContent = results.correctCount + '/' + CONFIG.TOTAL_TRIALS;
    document.getElementById('accuracy').textContent = results.accuracy.toFixed(1) + '%';
    
    // Grafico tempi di risposta
    displayResponseChart();
    
    // Analisi per difficoltà
    displayDifficultyStats();
    
    // Interpretazione
    displayInterpretation();
}

// === GRAFICO TEMPI DI RISPOSTA ===
function displayResponseChart() {
    // Nota: Questa è una versione semplificata
    // In produzione useremo Chart.js che verrà caricato in stroop-results.js
    const canvas = document.getElementById('response-chart');
    const ctx = canvas.getContext('2d');
    
    // Per ora mostra un placeholder
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#374151';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Grafico generato da stroop-results.js', canvas.width / 2, canvas.height / 2);
}

// === STATISTICHE PER DIFFICOLTÀ ===
function displayDifficultyStats() {
    const container = document.getElementById('difficulty-stats');
    const stats = appState.testData.results.difficultyStats;
    
    container.innerHTML = '';
    
    Object.keys(stats).forEach(level => {
        const stat = stats[level];
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <h4><span class="level-badge ${level.toLowerCase()}">${level}</span></h4>
            <p><strong>Corrette:</strong> ${stat.correct}/${stat.total}</p>
            <p><strong>Accuratezza:</strong> ${stat.accuracy.toFixed(1)}%</p>
            <p><strong>Tempo Medio:</strong> ${stat.avgTime.toFixed(2)}s</p>
        `;
        container.appendChild(card);
    });
}

// === INTERPRETAZIONE RISULTATI ===
function displayInterpretation() {
    const container = document.getElementById('interpretation-text');
    const results = appState.testData.results;
    
    let interpretation = '<p>';
    
    if (results.finalScore >= 900) {
        interpretation += 'Le tue prestazioni sono <strong>eccellenti</strong>. Hai dimostrato ottime capacità di attenzione selettiva, controllo inibitorio e velocità di elaborazione. ';
    } else if (results.finalScore >= 800) {
        interpretation += 'Le tue prestazioni sono <strong>molto buone</strong> e si collocano nella norma alta. Mostri buone capacità cognitive con margine di miglioramento nella velocità o precisione. ';
    } else if (results.finalScore >= 700) {
        interpretation += 'Le tue prestazioni sono <strong>nella norma</strong>. Hai completato il test con risultati adeguati, anche se potresti migliorare con più pratica. ';
    } else if (results.finalScore >= 600) {
        interpretation += 'Le tue prestazioni sono <strong>accettabili</strong> ma mostrano alcuni margini di miglioramento. Potresti beneficiare di maggiore pratica. ';
    } else {
        interpretation += 'Le tue prestazioni indicano <strong>difficoltà significative</strong>. Potrebbe essere utile ripetere il test in condizioni ottimali (riposato, concentrato). ';
    }
    
    interpretation += '</p><p>';
    
    if (results.avgTime < 1.5) {
        interpretation += 'I tuoi tempi di reazione sono molto rapidi, suggerendo buona velocità di elaborazione. ';
    } else if (results.avgTime < 2.5) {
        interpretation += 'I tuoi tempi di reazione sono nella norma. ';
    } else {
        interpretation += 'I tuoi tempi di reazione sono più lenti della media, suggerendo un approccio cauto o possibile rallentamento nell\'elaborazione. ';
    }
    
    if (results.accuracy >= 90) {
        interpretation += 'La tua accuratezza è eccellente, dimostrando ottimo controllo inibitorio. ';
    } else if (results.accuracy >= 80) {
        interpretation += 'La tua accuratezza è buona. ';
    } else if (results.accuracy >= 70) {
        interpretation += 'La tua accuratezza è discreta, con alcuni errori che potrebbero indicare difficoltà nel controllo inibitorio. ';
    } else {
        interpretation += 'La tua accuratezza è bassa, suggerendo significative difficoltà nel controllo inibitorio o impulsività nelle risposte. ';
    }
    
    interpretation += '</p><div class="note"><strong>⚠️ Importante:</strong> Questo è uno strumento didattico. I risultati non costituiscono una diagnosi clinica e devono essere interpretati nel contesto educativo.</div>';
    
    container.innerHTML = interpretation;
}

// === UTILITY ===
function getDifficultyColor(difficulty) {
    const colors = {
        'BASE': '#10b981',
        'MEDIUM': '#f59e0b',
        'HIGH': '#f97316',
        'MAX': '#ef4444'
    };
    return colors[difficulty] || '#6b7280';
}

// === SALVATAGGIO DATI ===
function saveTestData() {
    const fullData = {
        participant: appState.participantData,
        testData: {
            trials: appState.testData.trials,
            responses: appState.testData.responses,
            results: appState.testData.results,
            startTime: appState.testData.startTime,
            endTime: appState.testData.endTime
        }
    };
    
    // Salva in localStorage
    let allTests = JSON.parse(localStorage.getItem('stroopTests') || '[]');
    allTests.push(fullData);
    localStorage.setItem('stroopTests', JSON.stringify(allTests));
    
    // Invia al server (se configurato)
    // Questa funzione sarà implementata in stroop-data.js
    if (typeof sendDataToServer === 'function') {
        sendDataToServer(fullData);
    }
}

// === CERTIFICATO PDF ===
function downloadCertificate() {
    // Questa funzionalità sarà implementata in stroop-results.js con jsPDF
    if (typeof generateCertificatePDF === 'function') {
        generateCertificatePDF(appState.participantData, appState.testData.results);
    } else {
        alert('Funzionalità certificato in fase di implementazione');
    }
}

// === FORM RIFLESSIONE ===
function handleReflectionForm(e) {
    e.preventDefault();
    
    const reflections = {
        feeling: document.getElementById('reflection-1').value,
        difficulty: document.getElementById('reflection-2').value,
        interference: document.getElementById('reflection-3').value,
        elderly: document.getElementById('reflection-4').value,
        deficit: document.getElementById('reflection-5').value
    };
    
    // Salva riflessioni
    appState.reflections = reflections;
    
    // Salva in localStorage
    const currentData = JSON.parse(localStorage.getItem('stroopTests') || '[]');
    if (currentData.length > 0) {
        currentData[currentData.length - 1].reflections = reflections;
        localStorage.setItem('stroopTests', JSON.stringify(currentData));
    }
    
    // Invia al server
    if (typeof sendReflectionToServer === 'function') {
        sendReflectionToServer(reflections);
    }
    
    // Mostra messaggio di ringraziamento
    document.getElementById('form-reflection').classList.add('hidden');
    document.getElementById('reflection-thanks').classList.remove('hidden');
}

// === STATISTICHE CLASSE ===
function showClassStats() {
    showSection('class-stats');
}

function handleAuth(e) {
    e.preventDefault();
    const password = document.getElementById('auth-password').value;
    
    // Password semplice per demo (in produzione usare autenticazione seria)
    if (password === 'metodologie2024' || password === 'picconi') {
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('stats-content').classList.remove('hidden');
        loadClassStatistics();
    } else {
        alert('Password errata');
    }
}

function loadClassStatistics() {
    const allTests = JSON.parse(localStorage.getItem('stroopTests') || '[]');
    
    if (allTests.length === 0) {
        document.getElementById('stats-content').innerHTML = '<p>Nessun dato disponibile. Completa almeno un test per vedere le statistiche.</p>';
        return;
    }
    
    // Calcola statistiche aggregate
    const totalParticipants = allTests.length;
    const avgScore = allTests.reduce((sum, test) => sum + test.testData.results.finalScore, 0) / totalParticipants;
    const avgTime = allTests.reduce((sum, test) => sum + test.testData.results.avgTime, 0) / totalParticipants;
    const avgAccuracy = allTests.reduce((sum, test) => sum + test.testData.results.accuracy, 0) / totalParticipants;
    
    // Aggiorna UI
    document.getElementById('total-participants').textContent = totalParticipants;
    document.getElementById('class-avg-score').textContent = Math.round(avgScore);
    document.getElementById('class-avg-time').textContent = avgTime.toFixed(2) + 's';
    document.getElementById('class-avg-accuracy').textContent = avgAccuracy.toFixed(1) + '%';
    
    // Popola tabella
    const tbody = document.getElementById('participants-tbody');
    tbody.innerHTML = '';
    
    allTests.forEach(test => {
        const row = document.createElement('tr');
        const date = new Date(test.participant.timestamp);
        row.innerHTML = `
            <td>${date.toLocaleDateString('it-IT')} ${date.toLocaleTimeString('it-IT')}</td>
            <td>${test.participant.name}</td>
            <td>${test.participant.age}</td>
            <td>${test.participant.gender}</td>
            <td>${test.testData.results.finalScore}</td>
            <td>${test.testData.results.totalTime.toFixed(1)}s</td>
            <td>${test.testData.results.accuracy.toFixed(1)}%</td>
        `;
        tbody.appendChild(row);
    });
    
    // Genera grafici (implementato in stroop-results.js)
    if (typeof displayClassCharts === 'function') {
        displayClassCharts(allTests);
    }
}

function exportClassData() {
    const allTests = JSON.parse(localStorage.getItem('stroopTests') || '[]');
    
    if (allTests.length === 0) {
        alert('Nessun dato da esportare');
        return;
    }
    
    // Crea CSV
    let csv = 'Data,Nome,Età,Sesso,Punteggio,Tempo Totale,Tempo Medio,Accuratezza\n';
    
    allTests.forEach(test => {
        const date = new Date(test.participant.timestamp);
        csv += `${date.toLocaleDateString('it-IT')},`;
        csv += `${test.participant.name},`;
        csv += `${test.participant.age},`;
        csv += `${test.participant.gender},`;
        csv += `${test.testData.results.finalScore},`;
        csv += `${test.testData.results.totalTime.toFixed(1)},`;
        csv += `${test.testData.results.avgTime.toFixed(2)},`;
        csv += `${test.testData.results.accuracy.toFixed(1)}\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'stroop_test_data_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
}

// === RIAVVIO TEST ===
function restartTest() {
    if (confirm('Vuoi davvero rifare il test? I dati precedenti sono già stati salvati.')) {
        // Reset stato
        appState.testData = {
            trials: [],
            currentTrial: 0,
            startTime: null,
            responses: []
        };
        
        // Torna all'inizio
        showSection('intro');
    }
}

// === EXPORT PER USO ESTERNO ===
window.StroopTest = {
    showSection,
    restartTest,
    appState
};
