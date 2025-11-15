const LAB_STORAGE_PREFIX = 'mo_lab_autobio_';
const LAB_PHASES_KEY = `${LAB_STORAGE_PREFIX}completedPhases`;

// Navigation and Phase Management
document.addEventListener('DOMContentLoaded', function() {
    // Get all phase buttons
    const phaseButtons = document.querySelectorAll('.phase-btn');
    const phaseContents = document.querySelectorAll('.phase-content');
    
    // Set initial state - show first phase
    if (phaseContents.length > 0) {
        phaseContents[0].classList.add('active');
        if (phaseButtons.length > 0) {
            phaseButtons[0].classList.add('active');
        }
    }
    
    // Add click handlers to phase buttons
    phaseButtons.forEach(button => {
        button.addEventListener('click', function() {
            const phaseName = this.dataset.phase;
            
            // Remove active class from all buttons and contents
            phaseButtons.forEach(btn => btn.classList.remove('active'));
            phaseContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Show corresponding content
            const targetContent = document.getElementById(`fase-${phaseName}`);
            if (targetContent) {
                targetContent.classList.add('active');
                
                // Smooth scroll to content
                setTimeout(() => {
                    targetContent.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });
                }, 100);
            }
        });
    });
    
    // Smooth scroll for internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Add fade-in animation to cards on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe all cards and sections
    const elementsToAnimate = document.querySelectorAll('.concept-card, .transform-option, .project-phase, .benefit, .step, .prompt-card');
    elementsToAnimate.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(element);
    });
    
    // Interactive phrase cards hover effect
    const phrases = document.querySelectorAll('.phrase-mini');
    phrases.forEach(phrase => {
        phrase.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.05)';
        });
        phrase.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Print functionality for workshop materials
    window.printWorkshopMaterial = function(phaseId) {
        const content = document.getElementById(phaseId);
        if (content) {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Materiale Laboratorio - ${phaseId}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            padding: 20px;
                            line-height: 1.6;
                        }
                        h2, h3, h4 { color: #333; margin-top: 20px; }
                        .concept-card { margin: 20px 0; padding: 15px; border-left: 4px solid #38bdf8; }
                        ul, ol { margin-left: 20px; }
                        li { margin: 10px 0; }
                        @media print {
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    ${content.innerHTML}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    };
    
    // Progress tracking
    const phases = ['teoria', 'mappe', 'scrittura', 'condivisione', 'trasfigurazione', 'conduzione'];
    let completedPhases = JSON.parse(localStorage.getItem(LAB_PHASES_KEY) || '[]');
    
    // Mark phase as completed (you can add buttons in HTML to trigger this)
    window.markPhaseComplete = function(phaseName) {
        if (!completedPhases.includes(phaseName)) {
            completedPhases.push(phaseName);
            localStorage.setItem(LAB_PHASES_KEY, JSON.stringify(completedPhases));
            updateProgressIndicators();
        }
    };
    
    // Update visual indicators for completed phases
    function updateProgressIndicators() {
        phaseButtons.forEach(button => {
            const phaseName = button.dataset.phase;
            if (completedPhases.includes(phaseName)) {
                button.style.borderColor = '#10b981';
                button.insertAdjacentHTML('beforeend', '<span style="color: #10b981; margin-left: 10px;">✓</span>');
            }
        });
    }
    
    // Initialize progress indicators
    updateProgressIndicators();
    
    // Add keyboard navigation
    document.addEventListener('keydown', function(e) {
        const activePhase = document.querySelector('.phase-btn.active');
        if (!activePhase) return;
        
        const currentIndex = Array.from(phaseButtons).indexOf(activePhase);
        
        if (e.key === 'ArrowRight' && currentIndex < phaseButtons.length - 1) {
            phaseButtons[currentIndex + 1].click();
        } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
            phaseButtons[currentIndex - 1].click();
        }
    });
    
    // Copy text to clipboard functionality
    window.copyToClipboard = function(text) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Copiato negli appunti!');
        }).catch(err => {
            console.error('Errore nella copia:', err);
        });
    };
    
    // Simple notification system
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Add CSS animations for notifications
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Interactive timeline for mental maps (if needed)
    window.createTimeline = function(events) {
        // This function can be expanded to create interactive timelines
        console.log('Creating timeline with events:', events);
    };
    
    // Export/Save functionality
    window.exportNotes = function() {
        const notes = {
            completedPhases: completedPhases,
            timestamp: new Date().toISOString(),
            projectName: 'Laboratorio Autobiografico'
        };
        
        const dataStr = JSON.stringify(notes, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'progresso-laboratorio-autobiografico.json';
        link.click();
        URL.revokeObjectURL(url);
        
        showNotification('Progressi salvati!');
    };
    
    // Add tooltips for better UX
    const elementsWithTooltips = document.querySelectorAll('[data-tooltip]');
    elementsWithTooltips.forEach(element => {
        element.addEventListener('mouseenter', function(e) {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.dataset.tooltip;
            tooltip.style.cssText = `
                position: absolute;
                background: rgba(15, 23, 42, 0.95);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 14px;
                z-index: 1000;
                pointer-events: none;
                white-space: nowrap;
                border: 1px solid rgba(56, 189, 248, 0.3);
            `;
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
            
            this._tooltip = tooltip;
        });
        
        element.addEventListener('mouseleave', function() {
            if (this._tooltip) {
                this._tooltip.remove();
                this._tooltip = null;
            }
        });
    });
    
    // Accessibility improvements
    phaseButtons.forEach((button, index) => {
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
        button.setAttribute('tabindex', index === 0 ? '0' : '-1');
    });
    
    phaseContents.forEach((content, index) => {
        content.setAttribute('role', 'tabpanel');
        content.setAttribute('aria-hidden', index !== 0 ? 'true' : 'false');
    });
    
    console.log('Laboratorio Autobiografico - Sistema inizializzato');
});

// Additional utility functions

// Format date in Italian
function formatDateIT(date) {
    return new Date(date).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// Generate unique ID for saved items
function generateID() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Local storage helper
const labStorageKey = (key) => `${LAB_STORAGE_PREFIX}${key}`;

const storage = {
    set: (key, value) => {
        try {
            localStorage.setItem(labStorageKey(key), JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Errore nel salvataggio:', e);
            return false;
        }
    },
    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(labStorageKey(key));
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Errore nel recupero:', e);
            return defaultValue;
        }
    },
    remove: (key) => {
        localStorage.removeItem(labStorageKey(key));
    },
    clear: () => {
        if (confirm('Vuoi davvero cancellare tutti i progressi salvati?')) {
            Object.keys(localStorage)
                .filter(key => key.startsWith(LAB_STORAGE_PREFIX))
                .forEach(key => localStorage.removeItem(key));
            location.reload();
        }
    }
};
