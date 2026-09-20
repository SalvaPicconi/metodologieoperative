/* node scripts/test_gioco_3sa.cjs - nessuna dipendenza esterna */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const base=path.join(root,'materiali/giochi/cluedo-servizi');
const read=name=>JSON.parse(fs.readFileSync(path.join(base,name),'utf8'));
const rules=read('regole.json');
const story=read('storie/'+read('storia-attiva.json').storia+'.json');
const sandbox={module:{exports:{}}};
require('node:vm').runInNewContext(fs.readFileSync(path.join(base,'gioco.js'),'utf8'),sandbox);
const {assetto,piano}=sandbox.module.exports;
for(let n=2;n<=24;n++){
 const a=assetto(n);
 assert.equal(a.conduttore+a.testimoni+a.squadre.reduce((x,y)=>x+y,0),n);
 assert(a.squadre.every(x=>x>=1));assert(a.testimoni<=3);
 if(a.squadre.length===2)assert(Math.abs(a.squadre[0]-a.squadre[1])<=1);
 for(const minutes of [60,120]){
  const rounds=piano(a.giri,minutes,rules.tempiGiro);
  assert.equal(rounds.reduce((sum,r)=>sum+r.pescata,0),4);
  assert.equal(rounds[0].prima,'A');assert.equal(rounds[1].prima,'B');
  assert.equal(JSON.stringify(rounds[0].tempi),JSON.stringify(piano(a.giri,minutes)[0].tempi));
  assert(rounds.length*rounds[0].tempi.reduce((x,y)=>x+y,0)<=rules.fasi[1].minuti[minutes===120?1:0]);
 }
}
assert.equal(JSON.stringify(assetto(12).squadre),'[4,4]');assert.equal(JSON.stringify(assetto(10).squadre),'[3,3]');
for(const culprit of story.personaggi){
 for(const sign of culprit.segni)assert.equal(story.personaggi.filter(p=>p.segni.includes(sign)).length,2);
 assert.deepEqual(story.personaggi.filter(p=>culprit.segni.every(s=>p.segni.includes(s))).map(p=>p.id),[culprit.id]);
}
const permute=a=>a.length?a.flatMap((v,i)=>permute(a.filter((_,j)=>j!==i)).map(rest=>[v,...rest])):[[]];
for(const deck of permute(story.indizi.map(x=>x.id))){
 for(const n of [10,12]){
  let position=0;const received=[];
  for(const round of piano(assetto(n).giri,60,rules.tempiGiro)){received.push(...deck.slice(position,position+round.pescata));position+=round.pescata;}
  assert.deepEqual(received.slice().sort(),['I1','I2','I3','I4']);
 }
}
const student=fs.readFileSync(path.join(base,'guida-studente-3sa.html'),'utf8');
assert(!student.includes('CERCHIO'));assert(!student.includes('storie/elena.json'));assert(!student.includes('cluedo-servizi-3sa.pdf"'));
for(const instruction of story.consegne)assert(student.includes(instruction.titolo)||student.includes(instruction.testo));
for(const file of ['guida-studente-3sa.html','docente-3sa.html','nuove-storie.html']){
 const source=fs.readFileSync(path.join(base,file),'utf8');
 const ids=[...source.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,file+' ID duplicati');
 for(const m of source.matchAll(/(?:href|src)="([^"]+)"/g)){
  const uri=m[1].split(/[?#]/)[0];
  if(uri&&!/^(https?:|data:)/.test(uri))assert(fs.existsSync(path.resolve(base,uri)),file+': '+uri);
 }
}
console.log('PASS: 23 distribuzioni; 46 piani; 3 impostori; 48 ordini di pescata; link e guida senza soluzione.');
