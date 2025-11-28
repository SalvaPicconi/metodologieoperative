// This file contains functions to load and display lab content based on user interactions, fetching data from the labs-config.json file.

async function fetchLabsConfig() {
    const response = await fetch('./data/labs-config.json');
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return await response.json();
}

function displayLabContent(lab) {
    const labContainer = document.getElementById('lab-content');
    labContainer.innerHTML = `
        <h2>${lab.title}</h2>
        <p>${lab.description}</p>
        <div>${lab.content}</div>
    `;
}

async function loadLab(labId) {
    try {
        const labs = await fetchLabsConfig();
        const lab = labs.find(l => l.id === labId);
        if (lab) {
            displayLabContent(lab);
        } else {
            console.error('Lab not found');
        }
    } catch (error) {
        console.error('Error loading lab content:', error);
    }
}

export { loadLab };