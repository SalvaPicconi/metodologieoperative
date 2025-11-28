function createStepNavigation(steps, currentStep, onStepChange) {
    const navContainer = document.createElement('div');
    navContainer.className = 'step-navigation';

    steps.forEach((step, index) => {
        const stepButton = document.createElement('button');
        stepButton.innerText = step.title;
        stepButton.disabled = index === currentStep;
        stepButton.addEventListener('click', () => onStepChange(index));
        navContainer.appendChild(stepButton);
    });

    return navContainer;
}

export default createStepNavigation;