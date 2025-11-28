const labContent = (stepData) => {
    const contentContainer = document.createElement('div');
    contentContainer.className = 'lab-content';

    const title = document.createElement('h2');
    title.textContent = stepData.title;
    contentContainer.appendChild(title);

    const description = document.createElement('p');
    description.textContent = stepData.description;
    contentContainer.appendChild(description);

    const instructions = document.createElement('div');
    instructions.innerHTML = stepData.instructions;
    contentContainer.appendChild(instructions);

    return contentContainer;
};

export default labContent;