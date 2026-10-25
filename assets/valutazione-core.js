(function(root){
  'use strict';
  const data=typeof module!=='undefined'&&module.exports?require('./valutazione-rubriche.js'):root.MORubrics;
  const KEY='mo-valutazione-artefatti-v1';
  const id=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const empty=()=>({version:1,rubricVersion:1,activities:[],activeId:null});
  const completed=entry=>entry.scores.length===5&&entry.scores.every(x=>Number.isInteger(x)&&x>=1&&x<=5);
  const count=entry=>entry.scores.filter(x=>x!==null).length;
  const sum=entry=>entry.scores.reduce((s,x)=>s+(x??0),0);
  function ranking(entries){
    const sorted=entries.filter(completed).slice().sort((a,b)=>sum(b)-sum(a)||a.name.localeCompare(b.name,'it'));
    const frequencies=new Map();for(const e of sorted)frequencies.set(sum(e),(frequencies.get(sum(e))||0)+1);
    let last=null,position=0;
    return sorted.map((entry,i)=>{const total=sum(entry);if(total!==last)position=i+1;last=total;return {entry,total,position,tied:frequencies.get(total)>1};});
  }
  const cleanName=value=>value.trim().replace(/\s+/g,' ');
  function newActivity(fields){
    return {id:id(),title:cleanName(fields.title),className:fields.className.trim(),date:fields.date,type:fields.type,year:fields.year,mode:fields.mode,rankingEnabled:false,entries:[]};
  }
  function addEntry(activity,name){
    name=cleanName(name);
    if(!name||name.length>100)throw Error('Inserisci un nome da 1 a 100 caratteri.');
    if(activity.entries.length>=200)throw Error('Questa attività ha già 200 schede.');
    if(activity.entries.some(e=>e.name.toLocaleLowerCase('it')===name.toLocaleLowerCase('it')))throw Error('Questo nome è già presente nell’attività.');
    const entry={id:id(),name,scores:[null,null,null,null,null],strength:'',nextStep:''};activity.entries.push(entry);return entry;
  }
  function validate(value){
    const fail=()=>{throw Error('Copia non valida o non compatibile. I dati attuali non sono stati modificati.');};
    if(!value||value.version!==1||value.rubricVersion!==1||!Array.isArray(value.activities)||value.activities.length>100)fail();
    const ids=new Set();
    function validId(x){if(typeof x!=='string'||!x||x.length>100||ids.has(x))fail();ids.add(x);return x;}
    function text(x,max,required=false){if(typeof x!=='string'||x.length>max||(required&&!x.trim()))fail();return x;}
    const activities=value.activities.map(a=>{
      if(!a||!Object.hasOwn(data.rubrics,a.type)||!Object.hasOwn(data.years,a.year)||!['individuale','gruppo'].includes(a.mode)||typeof a.rankingEnabled!=='boolean'||!Array.isArray(a.entries)||a.entries.length>200||!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||!Number.isFinite(Date.parse(a.date))||new Date(a.date).toISOString().slice(0,10)!==a.date)fail();
      const names=new Set();
      return {id:validId(a.id),title:text(a.title,120,true),className:text(a.className,40),date:a.date,type:a.type,year:String(a.year),mode:a.mode,rankingEnabled:a.rankingEnabled,entries:a.entries.map(e=>{
        if(!e||!Array.isArray(e.scores)||e.scores.length!==5||!e.scores.every(x=>x===null||(Number.isInteger(x)&&x>=1&&x<=5)))fail();
        const name=cleanName(text(e.name,100,true)),key=name.toLocaleLowerCase('it');if(names.has(key))fail();names.add(key);
        return {id:validId(e.id),name,scores:[...e.scores],strength:text(e.strength,2000),nextStep:text(e.nextStep,2000)};
      })};
    });
    if(value.activeId!==null&&!activities.some(a=>a.id===value.activeId))fail();
    return {version:1,rubricVersion:1,activities,activeId:value.activeId};
  }
  const escape=value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  function csv(activity){
    const rank=ranking(activity.entries),positions=new Map(rank.map(r=>[r.entry.id,r.position]));
    const entries=activity.rankingEnabled?[...rank.map(r=>r.entry),...activity.entries.filter(e=>!completed(e))]:activity.entries;
    const rows=[['Attività','Classe','Anno','Data','Tipo','Valutazione',...(activity.rankingEnabled?['Posizione']:[]),'Nome',...data.rubrics[activity.type].criteria.map(c=>c.title),'Totale /25','Criteri osservati','Punto di forza','Da migliorare']];
    for(const e of entries)rows.push([activity.title,activity.className,data.years[activity.year].label,activity.date,data.rubrics[activity.type].title,activity.mode,...(activity.rankingEnabled?[positions.get(e.id)??'']:[]),e.name,...e.scores,completed(e)?sum(e):'',count(e)+'/5',e.strength,e.nextStep]);
    const cell=v=>{let s=String(v??'');if(/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
  }
  const api={KEY,id,empty,completed,count,sum,ranking,cleanName,newActivity,addEntry,validate,escape,csv};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MOAssessment=api;
})(typeof globalThis!=='undefined'?globalThis:this);
