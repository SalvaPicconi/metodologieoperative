/* Tre sintesi del progetto: il diario precedente conserva la propria chiave. */
(() => {
  'use strict';
  const PAGE='/lab_infanzia.html',FIELDS=['infanzia_obiettivo','infanzia_revisione','infanzia_verifica'];
  const byId=id=>document.getElementById(id),guest=()=>document.body.dataset.moGuest==='true';
  const object=value=>{try{const data=typeof value==='string'?JSON.parse(value):value;return data&&typeof data==='object'&&!Array.isArray(data)?data:null;}catch{return null;}};
  const read=key=>{try{return object(localStorage.getItem(key));}catch{return null;}};
  const key=()=>guest()?'mo:infanzia:ospite:v1':`mo:infanzia:bozza:v1:${localStorage.getItem('mo:class')||''}:${localStorage.getItem('mo:code')||''}`;
  const legacy=()=>object(read(`mo:progress-local:${location.pathname}`)?.data);
  const merge=(a,b)=>({...a,...b,...(a?._meta||b?._meta?{_meta:{...object(a?._meta),...object(b?._meta)}}:{})});
  let loaded={},ready=false,version=0;
  const inputs=()=>[...document.querySelectorAll('[data-infanzia-field],.progress-box textarea')];
  function grow(el){el.style.height='auto';el.style.height=`${Math.max(144,el.scrollHeight+4)}px`;}
  function collect(data={}){
    if(!ready)return {__skipSave:true};
    loaded=merge(loaded,data);inputs().forEach(el=>{loaded[el.name]=el.value;});return loaded;
  }
  function restore(saved){
    const remote=object(saved),own=read(key());
    const newer=own&&(!remote||(remote._infanziaModificatoIl&&own._infanziaModificatoIl>remote._infanziaModificatoIl));
    loaded=guest()?(own||{}):(newer?merge(remote,own):remote||own||{});
    inputs().forEach(el=>{el.value=typeof loaded[el.name]==='string'?loaded[el.name]:'';el.disabled=false;grow(el);});
    ready=true;document.querySelector('[data-save-progress]').disabled=false;
    byId('infanzia-importa').hidden=guest()||!!remote||!!own||!legacy()?.progress_note;
    byId('infanzia-stato').textContent=guest()?'Ospite: la bozza resta in questo browser. Scarica le sintesi per conservarle altrove.':'La bozza si conserva in questo browser e si salva con il tuo codice. Puoi usare anche «Salva il lavoro».';
    return loaded;
  }
  window.MO_PROGRESS_CONFIG={pagePath:window.location.pathname,inputSelector:'[data-infanzia-field], .progress-box textarea',autoSave:true,onRestore:restore,onBeforeSave:collect};
  function localSave(){if(!ready)return;loaded._infanziaModificatoIl=new Date().toISOString();try{localStorage.setItem(key(),JSON.stringify(collect()));}catch{byId('infanzia-stato').textContent='Memoria del browser non disponibile: scarica le sintesi prima di chiudere.';}}
  function download(){
    const lines=['METODOLOGIE OPERATIVE · TERZO ANNO · UDA 3.6','Sintesi del progetto per l’infanzia',''];
    FIELDS.forEach(id=>lines.push(document.querySelector(`label[for="${id}"]`).textContent,byId(id).value.trim()||'[Non compilato]',''));
    const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='infanzia-tre-sintesi.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function clearLim(message=''){version++;byId('infanzia-lim-risposte').replaceChildren();byId('infanzia-lim-stato').textContent=message;}
  function closeLim(){clearLim();byId('pannello-lim').hidden=true;document.body.classList.remove('lim');}
  async function teacher(){try{return window.MODocente?await window.MODocente.assicura():false;}catch{byId('infanzia-stato').textContent='Questo browser non consente l’accesso docente. Apri la pagina in Safari o Chrome.';return false;}}
  async function openLim(){const request=++version;if(!(await teacher())||request!==version)return;byId('pannello-lim').hidden=false;document.body.classList.add('lim');try{const cls=localStorage.getItem('mo:class')||'';if(!byId('infanzia-lim-classe').value&&/^[1-5][a-z]{1,2}$/.test(cls))byId('infanzia-lim-classe').value=cls;}catch{}byId('infanzia-lim-classe').focus();byId('pannello-lim').scrollIntoView({block:'start'});}
  async function loadLim(){
    clearLim();const request=version,cls=byId('infanzia-lim-classe').value.trim().toLowerCase(),status=byId('infanzia-lim-stato'),panel=byId('infanzia-lim-risposte'),button=byId('infanzia-leggi-lim');
    if(!/^[1-5][a-z]{1,2}$/.test(cls)){status.textContent='Inserisci una classe valida, per esempio 3sa.';return;}
    if(!(await teacher())||request!==version)return;
    button.disabled=true;status.textContent='Lettura delle risposte…';
    try{
      const res=await window.MODocente.chiama('progress_docente_classe',{p_class_code:cls,p_page_path:PAGE});
      if(request!==version||byId('pannello-lim').hidden)return;
      const rows=(Array.isArray(res)?res:[]).map(row=>object(row.data)||{});
      FIELDS.forEach(id=>{
        const answers=rows.map(data=>data[id]).filter(x=>typeof x==='string'&&x.trim()).sort((a,b)=>a.localeCompare(b,'it'));
        if(!answers.length)return;const section=document.createElement('section');section.className='lim-risposta';const h=document.createElement('h3');h.textContent=document.querySelector(`label[for="${id}"]`).textContent;const ul=document.createElement('ul');answers.forEach(answer=>{const li=document.createElement('li');li.textContent=answer;ul.append(li);});section.append(h,ul);panel.append(section);
      });
      status.textContent=`${cls.toUpperCase()} · ${rows.length} lavori salvati. Risposte raggruppate per domanda, senza nomi o codici associati.`;
    }catch(e){if(request===version){panel.replaceChildren();status.textContent=window.MODocente.messaggioErrore(e);}}
    finally{button.disabled=false;}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const old=document.createElement('button');old.type='button';old.id='infanzia-importa';old.textContent='Riprendi una vecchia bozza locale del diario';old.hidden=true;byId('diario-infanzia').append(old);
    old.addEventListener('click',()=>{const data=legacy();if(guest()||!data?.progress_note||!confirm('Questa vecchia bozza non è associata a un codice. Riprendila soltanto se è il tuo diario. Vuoi continuare?'))return;loaded=merge(data,loaded);byId('infanzia-diario').value=data.progress_note;localSave();old.hidden=true;});
    inputs().forEach(el=>el.addEventListener('input',()=>{grow(el);localSave();}));
    byId('infanzia-scarica').addEventListener('click',download);byId('infanzia-apri-lim').addEventListener('click',openLim);
    byId('infanzia-leggi-lim').addEventListener('click',loadLim);byId('infanzia-chiudi-lim').addEventListener('click',()=>{closeLim();byId('infanzia-apri-lim').focus();});
    byId('infanzia-lim-classe').addEventListener('input',()=>clearLim('Premi «Leggi le risposte» per la classe attuale.'));
    const tools=byId('infanzia-identita');const place=()=>{const nodes=['#studentLabel','#resetStudent','.home-floating-link'].map(s=>document.querySelector(s));nodes.filter(Boolean).forEach(n=>{if(n.parentNode!==tools)tools.append(n);});if(nodes.every(Boolean))observer.disconnect();};const observer=new MutationObserver(place);observer.observe(document.body,{childList:true});place();
  });
  window.addEventListener('mo:identity-change',()=>{ready=false;loaded={};inputs().forEach(el=>{el.value='';el.disabled=true;});document.querySelector('[data-save-progress]').disabled=true;closeLim();});
})();
