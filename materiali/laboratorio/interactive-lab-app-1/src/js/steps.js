// This file handles the logic for navigating through the different steps of the interactive labs.

let currentStep = 0;
const steps = [];

// Function to initialize steps
function initializeSteps(stepData) {
    steps.push(...stepData);
    renderStep(currentStep);
}

// Function to render the current step
function renderStep(stepIndex) {
    const stepContent = document.getElementById('step-content');
    stepContent.innerHTML = steps[stepIndex].content;
}

// Function to go to the next step
function nextStep() {
    if (currentStep < steps.length - 1) {
        currentStep++;
        renderStep(currentStep);
    }
}

// Function to go to the previous step
function previousStep() {
    if (currentStep > 0) {
        currentStep--;
        renderStep(currentStep);
    }
}

// Exporting functions for use in other modules
export { initializeSteps, nextStep, previousStep };