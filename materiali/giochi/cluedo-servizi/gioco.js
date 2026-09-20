/* Regole comuni: non contiene identità dell'impostore o soluzione didattica. */
(function () {
  'use strict';
  function assetto(n) {
    n = Math.max(2, Math.min(24, Number.parseInt(n, 10) || 12));
    const conduttore = n >= 8 ? 1 : 0;
    const testimoni = n >= 10 ? 3 : n >= 3 ? 2 : 0;
    const restanti = n - conduttore - testimoni;
    const squadre = restanti < 2 || n === 2 ? [restanti] : [Math.ceil(restanti / 2), Math.floor(restanti / 2)];
    return {presenti:n, conduttore, testimoni, squadre, giri: Math.max(...squadre) > 3 ? 3 : 4};
  }
  function piano(giri, minuti, tempiGiro) {
    const tempi = tempiGiro ? tempiGiro[`${minuti}-${giri}`] : minuti === 120 ? (giri === 3 ? [6,6,4] : [4,4,4]) : (giri === 3 ? [3,3,2] : [2,2,2]);
    return Array.from({length:giri}, (_, i) => ({giro:i+1, prima:i%2 ? 'B' : 'A', pescata:giri===3 && i===2 ? 2 : 1, tempi}));
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {assetto,piano};
  if (typeof document === 'undefined') return;
  const byId = id => document.getElementById(id);
  const config = JSON.parse(byId('game-config').textContent);
  let mode = 60, phase = 0, remaining = 600, running = null, deadline = 0;
  function stop(){if(running) clearInterval(running);running=null;byId('timer-toggle').textContent='Avvia';}
  function clock(){byId('timer').textContent=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');}
  function renderPhase(){stop();const p=config.fasi[phase];remaining=p.minuti[mode===120?1:0]*60;byId('phase-title').textContent=p.titolo;byId('phase-copy').textContent=p.consegna;byId('phase-number').textContent=`Fase ${phase+1} di ${config.fasi.length}`;byId('prev').disabled=phase===0;byId('next').disabled=phase===config.fasi.length-1;byId('round-plan').hidden=p.id!=='indagine';byId('timer-status').textContent='';clock();}
  function renderSetup(){
    const a=assetto(byId('presenti').value);byId('presenti').value=a.presenti;
    if(a.presenti>16){mode=120;byId('durata').value='120';}
    const gruppi=a.squadre.length===1?`una squadra da ${a.squadre[0]}`:`squadra A da ${a.squadre[0]} e squadra B da ${a.squadre[1]}`;
    byId('assetto').textContent=`${a.presenti} presenti: ${a.conduttore?'uno studente conduce':'conduce il docente'}, ${a.testimoni} personaggi interpretati da studenti, ${gruppi}. ${a.giri} giri. ${a.testimoni===2?'Gli studenti ricevono le prime due carte-personaggio; il docente legge la terza, sempre leale.':a.testimoni===0?'Il docente interpreta tutti i personaggi e sorteggia in segreto il personaggio impostore.':''}`;
    const rows=piano(a.giri,mode,config.tempiGiro).map(p=>`<li><strong>Giro ${p.giro}:</strong> inizia ${a.squadre.length===1?'la squadra':p.prima}. ${a.squadre.length===1?'Domande':`Turni A e B`}: ${p.tempi[0]} minuti ${a.squadre.length===1?'per le domande e altrettanti per rileggere gli indizi':'ciascuno'}; pescata di ${p.pescata} ${p.pescata===1?'carta':'carte'} e confronto: ${p.tempi[2]} minuti.${p.giro===1?' Poi il docente mostra T1.':''}${p.giro===a.giri?' Poi il docente mostra T2.':''}</li>`);
    byId('rounds').innerHTML=rows.join('');
    byId('round-note').textContent=a.squadre.length===1?'Nel tempo del turno senza avversari la squadra rilegge gli indizi e prepara le domande. Restano invariati i tempi totali.':'Le domande si distribuiscono fra i componenti. Tutti hanno la parola una volta per turno; entrambe le squadre ascoltano tutte le risposte.';
    renderPhase();
  }
  byId('presenti').addEventListener('change',renderSetup);
  byId('durata').addEventListener('change',e=>{mode=Number(e.target.value);renderSetup();});
  byId('timer-toggle').addEventListener('click',()=>{if(running){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));stop();clock();return;}if(remaining===0)renderPhase();deadline=Date.now()+remaining*1000;byId('timer-toggle').textContent='Pausa';running=setInterval(()=>{remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));clock();if(!remaining){stop();byId('timer-status').textContent='Tempo della fase terminato. Completate la consegna, poi passate alla fase successiva.';}},250);});
  byId('reset').addEventListener('click',renderPhase);
  byId('prev').addEventListener('click',()=>{if(phase>0){phase--;renderPhase();}});
  byId('next').addEventListener('click',()=>{if(phase<config.fasi.length-1){phase++;renderPhase();}});
  if(byId('tracce-personaggio'))byId('tracce-personaggio').addEventListener('change',e=>{document.querySelectorAll('[data-tracce]').forEach(el=>el.hidden=el.dataset.tracce!==e.target.value);});
  renderSetup();
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('../../../service-worker.js'));
})();
