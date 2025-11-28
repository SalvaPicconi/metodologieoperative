// This file initializes the application, sets up event listeners, and manages the overall application state.

import { initializeLabs } from './labs.js';
import { setupStepNavigation } from '../components/step-navigation.js';
import { createHeader } from '../components/header.js';

document.addEventListener('DOMContentLoaded', () => {
    createHeader();
    initializeLabs();
    setupStepNavigation();
});