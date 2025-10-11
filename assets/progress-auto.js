import { setupProgress } from './progress-page.js?v=20251019';

document.addEventListener('DOMContentLoaded', () => {
  setupProgress().catch((error) => {
    console.error('[Progress] impossibile inizializzare la pagina:', error);
  });
});
