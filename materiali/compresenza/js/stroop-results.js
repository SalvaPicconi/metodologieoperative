/* ========================================
   STROOP TEST - RESULTS & CHARTS
   Prof. Salvatore Picconi - IIS Meucci Mattei
   Gestione visualizzazione risultati e certificato PDF
   ======================================== */

// === CARICAMENTO CHART.JS DA CDN ===
(function() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = function() {
        console.log('Chart.js caricato con successo');
        if (typeof initializeCharts === 'function') {
            initializeCharts();
        }
    };
    document.head.appendChild(script);
})();

// === CARICAMENTO JSPDF DA CDN ===
(function() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    script.onload = function() {
        console.log('jsPDF caricato con successo');
    };
    document.head.appendChild(script);
})();

// === GENERAZIONE GRAFICO TEMPI DI RISPOSTA ===
function displayResponseChart() {
    // Attendi che Chart.js sia caricato
    if (typeof Chart === 'undefined') {
        setTimeout(displayResponseChart, 500);
        return;
    }
    
    const canvas = document.getElementById('response-chart');
    if (!canvas) return;
    
    const responses = window.StroopTest.appState.testData.responses;
    
    // Prepara dati
    const labels = responses.map(r => r.trialNumber);
    const times = responses.map(r => r.responseTime / 1000);
    const colors = responses.map(r => {
        if (r.difficulty === 'BASE') return 'rgba(16, 185, 129, 0.5)';
        if (r.difficulty === 'MEDIUM') return 'rgba(245, 158, 11, 0.5)';
        if (r.difficulty === 'HIGH') return 'rgba(249, 115, 22, 0.5)';
        return 'rgba(239, 68, 68, 0.5)';
    });
    
    // Crea grafico
    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tempo di Risposta (secondi)',
                data: times,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.5', '1')),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Secondi'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Numero Prova'
                    }
                }
            }
        }
    });
}

// === GENERAZIONE GRAFICI STATISTICHE CLASSE ===
function displayClassCharts(allTests) {
    if (typeof Chart === 'undefined') {
        setTimeout(() => displayClassCharts(allTests), 500);
        return;
    }
    
    // Grafico distribuzione punteggi
    displayScoreDistribution(allTests);
    
    // Grafico performance per età
    displayAgePerformance(allTests);
}

function displayScoreDistribution(allTests) {
    const canvas = document.getElementById('score-distribution-chart');
    if (!canvas) return;
    
    // Raggruppa punteggi in intervalli
    const bins = {
        '0-200': 0,
        '200-400': 0,
        '400-600': 0,
        '600-700': 0,
        '700-800': 0,
        '800-900': 0,
        '900-1000': 0
    };
    
    allTests.forEach(test => {
        const score = test.testData.results.finalScore;
        if (score < 200) bins['0-200']++;
        else if (score < 400) bins['200-400']++;
        else if (score < 600) bins['400-600']++;
        else if (score < 700) bins['600-700']++;
        else if (score < 800) bins['700-800']++;
        else if (score < 900) bins['800-900']++;
        else bins['900-1000']++;
    });
    
    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: Object.keys(bins),
            datasets: [{
                label: 'Numero Studenti',
                data: Object.values(bins),
                backgroundColor: 'rgba(37, 99, 235, 0.6)',
                borderColor: 'rgba(37, 99, 235, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: 'Numero Studenti'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Fascia Punteggio'
                    }
                }
            }
        }
    });
}

function displayAgePerformance(allTests) {
    const canvas = document.getElementById('age-performance-chart');
    if (!canvas) return;
    
    // Raggruppa per età
    const ageGroups = {};
    allTests.forEach(test => {
        const age = test.participant.age;
        if (!ageGroups[age]) {
            ageGroups[age] = {
                scores: [],
                count: 0
            };
        }
        ageGroups[age].scores.push(test.testData.results.finalScore);
        ageGroups[age].count++;
    });
    
    // Calcola medie
    const ages = Object.keys(ageGroups).sort((a, b) => parseInt(a) - parseInt(b));
    const avgScores = ages.map(age => {
        const scores = ageGroups[age].scores;
        return scores.reduce((sum, s) => sum + s, 0) / scores.length;
    });
    
    new Chart(canvas, {
        type: 'line',
        data: {
            labels: ages,
            datasets: [{
                label: 'Punteggio Medio',
                data: avgScores,
                backgroundColor: 'rgba(8, 145, 178, 0.2)',
                borderColor: 'rgba(8, 145, 178, 1)',
                borderWidth: 3,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1000,
                    title: {
                        display: true,
                        text: 'Punteggio Medio'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Età'
                    }
                }
            }
        }
    });
}

// === GENERAZIONE CERTIFICATO PDF ===
function generateCertificatePDF(participantData, results) {
    // Attendi che jsPDF sia caricato
    if (typeof window.jspdf === 'undefined') {
        alert('Caricamento libreria PDF in corso. Riprova tra qualche secondo.');
        setTimeout(() => generateCertificatePDF(participantData, results), 1000);
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    // Colori
    const primaryColor = [37, 99, 235];
    const secondaryColor = [8, 145, 178];
    const textColor = [55, 65, 81];
    
    // === HEADER ===
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('ATTESTATO', 105, 15, { align: 'center' });
    
    doc.setFontSize(16);
    doc.text('Test di Stroop - Valutazione Cognitiva', 105, 25, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('IIS Meucci Mattei - Decimomannu', 105, 33, { align: 'center' });
    
    // === CORPO ===
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    
    // Intestazione certificato
    doc.setFontSize(12);
    doc.text('Si certifica che', 20, 55);
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(participantData.name, 105, 65, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const date = new Date(participantData.timestamp);
    doc.text(`ha completato il Test di Stroop in data ${date.toLocaleDateString('it-IT')}`, 105, 75, { align: 'center' });
    
    // Box punteggio principale
    doc.setFillColor(240, 249, 255);
    doc.roundedRect(40, 85, 130, 35, 3, 3, 'F');
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PUNTEGGIO FINALE', 105, 95, { align: 'center' });
    
    doc.setFontSize(36);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${results.finalScore}/1000`, 105, 110, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(results.performanceLevel, 105, 117, { align: 'center' });
    
    // Statistiche dettagliate
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Statistiche Dettagliate', 20, 135);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    const stats = [
        ['Tempo Totale:', `${results.totalTime.toFixed(1)} secondi`],
        ['Tempo Medio per Risposta:', `${results.avgTime.toFixed(2)} secondi`],
        ['Risposte Corrette:', `${results.correctCount}/30 (${results.accuracy.toFixed(1)}%)`],
        ['Livello di Accuratezza:', results.accuracy >= 90 ? 'Eccellente' : results.accuracy >= 80 ? 'Ottimo' : results.accuracy >= 70 ? 'Buono' : 'Discreto']
    ];
    
    let yPos = 145;
    stats.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, 25, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(value, 90, yPos);
        yPos += 8;
    });
    
    // Performance per livello
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Performance per Livello di Difficoltà', 20, 185);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    yPos = 195;
    const diffLabels = {
        'BASE': 'Base',
        'MEDIUM': 'Media',
        'HIGH': 'Alta',
        'MAX': 'Massima'
    };
    
    Object.keys(results.difficultyStats).forEach(level => {
        const stat = results.difficultyStats[level];
        doc.setFont('helvetica', 'bold');
        doc.text(`${diffLabels[level]}:`, 25, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(`${stat.correct}/${stat.total} corrette (${stat.accuracy.toFixed(0)}%) - Tempo medio: ${stat.avgTime.toFixed(2)}s`, 50, yPos);
        yPos += 7;
    });
    
    // Note
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(20, 225, 170, 25, 2, 2, 'F');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Nota: Questo test è uno strumento didattico utilizzato nel corso di Metodologie', 25, 232);
    doc.text('Operative per i Servizi Sociosanitari. I risultati non costituiscono una valutazione', 25, 237);
    doc.text('clinica e devono essere interpretati esclusivamente in ambito educativo.', 25, 242);
    
    // Footer
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 270, 210, 27, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Metodologie Operative - Servizi Sociosanitari', 105, 280, { align: 'center' });
    doc.text('Laboratorio Compresenza Scienze Umane', 105, 286, { align: 'center' });
    doc.text('IIS Meucci Mattei - Sede Decimomannu', 105, 292, { align: 'center' });
    
    // Salva PDF
    const filename = `Attestato_Stroop_${participantData.name.replace(/\s+/g, '_')}_${date.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}

// === ESPORTA FUNZIONI ===
window.generateCertificatePDF = generateCertificatePDF;
window.displayResponseChart = displayResponseChart;
window.displayClassCharts = displayClassCharts;

// === AUTO-INIT ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('Stroop Results module loaded');
});
