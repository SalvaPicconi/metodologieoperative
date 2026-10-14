// La programmazione Carola arriva solo dal servizio autenticato: nessun JSON statico.
(function () {
 const sessionKey = 'mo:programmi-carola-session';
 const identityKey = 'mo:programmi-carola-identita';
 const privato = document.body.dataset.programmiCatalogo === 'carola' ||
   (location.pathname.endsWith('/programmazione.html') && new URLSearchParams(location.search).get('catalogo') === 'carola');
 const endpoint = 'https://ruplzgcnheddmqqdephp.supabase.co/functions/v1/programmi-carola';
 const publicKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cGx6Z2NuaGVkZG1xcWRlcGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTYyMjksImV4cCI6MjA3NTY5MjIyOX0.tOLIkgi5yTt61_0rMlXUqxnbil4DLD7kBaqZBVAv1CI';
 let pending = null;
 async function carica() {
   const token = sessionStorage.getItem(sessionKey) || '';
   if (!token || sessionStorage.getItem(identityKey) !== 'Pierluigi') throw new Error('Accedi alla programmazione Carola con la password dei Programmi.');
   if (!pending) pending = (async () => {
     const r = await fetch(endpoint, { method: 'POST', cache: 'no-store', headers: {
       apikey: publicKey, Authorization: 'Bearer ' + publicKey, 'Content-Type': 'application/json', 'X-Programmi-Session': token
     }, body: '{}' });
     const data = await r.json();
     if (!r.ok) throw new Error(data.error || 'Accesso non disponibile.');
     if (sessionStorage.getItem(sessionKey) !== token) throw new Error('Sessione terminata.');
     if (!data.documento || data.documento.moduli.some(m => m.origine !== 'C')) throw new Error('Catalogo non valido.');
     return data.documento;
   })().catch(e => { pending = null; throw e; });
   return pending;
 }
 window.MOProgrammiCarola = { privato, carica, pulisci() { pending = null; delete window.MO_CAROLA_DOCUMENTO; } };
 if (privato) window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
})();
