// Collaudo locale della migrazione «Area alunni» (ingresso con classe e codice di sempre, unificazione
// automatica delle grafie) su PGlite. Nessun collegamento al progetto remoto: dati tutti inventati.
// Uso:  cd supabase/test && npm install && node area-alunni.test.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const qui = dirname(fileURLToPath(import.meta.url));
const baseline = readFileSync(join(qui, 'baseline.sql'), 'utf8');
const migrazione = readFileSync(join(qui, '..', 'area-alunni.sql'), 'utf8');
const db = await PGlite.create({ extensions: { pgcrypto } });
const esiti = [];
let gruppo = '';
function prova(nome, ok, evidenza = '') {
    esiti.push({ gruppo, nome, ok: Boolean(ok), evidenza: String(evidenza ?? '') });
    console.log(`${ok ? '✔' : '✘'} [${gruppo}] ${nome}${evidenza ? ` — ${evidenza}` : ''}`);
}
const firme = new Map();
async function firma(nome) {
    if (firme.has(nome)) return firme.get(nome);
    const r = await db.query(`select pg_get_function_identity_arguments(p.oid) a from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = $1`, [nome]);
    const args = r.rows[0].a ? r.rows[0].a.split(', ').map(s => { const [n, ...t] = s.split(' '); return { n, t: t.join(' ') }; }) : [];
    firme.set(nome, args);
    return args;
}
async function rpc(nome, args = {}, { ip = '10.0.0.1' } = {}) {
    const def = await firma(nome);
    const usati = def.filter(d => Object.hasOwn(args, d.n));
    const q = `select * from public.${nome}(${usati.map((d, i) => `${d.n} => $${i + 1}::${d.t}`).join(', ')})`;
    const valori = usati.map(d => (args[d.n] !== null && typeof args[d.n] === 'object' ? JSON.stringify(args[d.n]) : args[d.n]));
    await db.exec(`set request.headers = '${JSON.stringify({ 'x-forwarded-for': ip })}'`);
    await db.exec('set role anon');
    try { return { ok: true, rows: (await db.query(q, valori)).rows }; }
    catch (e) { return { ok: false, code: e.code, message: e.message, hint: e.hint }; }
    finally { await db.exec('reset role'); }
}
const val = (r, c) => (r.ok && r.rows[0] ? r.rows[0][c] : undefined);
const sql = async (q, p) => (await db.query(q, p)).rows;
const ora = ts => db.exec(`set test.ora = '${ts}'`);
const accedi = async (classe, codice) => rpc('alunni_accesso', { p_classe: classe, p_codice: codice });

// ---------------------------------------------------------------------------
gruppo = 'Base';
await db.exec(baseline);
await ora('2026-11-20 10:00:00+01');
await db.exec(`create or replace function private.progress_school_year(p_at timestamptz)
returns integer language sql stable set search_path to '' as $$
  select extract(year from (coalesce(nullif(current_setting('test.ora', true), '')::timestamptz, p_at)
                 at time zone 'Europe/Rome') - interval '8 months')::integer; $$;`);
const P = { a: '/materiali/terzo/percorsi_autoapprendimento.html', b: '/materiali/terzo/ripasso-terzo-anno.html',
    c: '/materiali/terzo/equipe_multiprofessionale.html', d: '/materiali/terzo/esercitazioni_servizi.html',
    e: '/materiali/biennio/tssas_percorso_completo_v2.html', lab: '/laboratorio.html' };
await db.exec(`insert into public.progress (class_code, student_code, page_path, data, updated_at, school_year) values
 ('3SB','rossig','${P.a}','{"x":"A di G"}','2026-11-10 09:00+01',2026),
 ('3sb','ROSSIG','${P.b}','{"x":"B di G","_meta":{"percentuale":40}}','2026-11-11 09:00+01',2026),
 ('3 SB','rossig','${P.c}','{"x":"C di G"}','2026-11-12 09:00+01',2026),
 ('3SB','rosig','${P.d}','{"x":"D di G, codice sbagliato"}','2026-11-13 09:00+01',2026),
 ('3SB','rossia','${P.a}','{"x":"A di Alessia"}','2026-11-10 10:00+01',2026),
 ('3SB','rossim','${P.a}','{"x":"A di Mario"}','2026-11-10 11:00+01',2026),
 ('3SB','verdic','${P.a}','{"x":"A di C"}','2026-11-10 12:00+01',2026),
 ('3SB','verdic','${P.b}','{"x":"B di C"}','2026-11-11 12:00+01',2026),
 ('3SA','verdic','${P.c}','{"x":"C di C con classe sbagliata"}','2026-11-12 12:00+01',2026),
 ('4SA','nerid','${P.b}','{"x":"altra classe"}','2026-11-12 13:00+01',2026),
 ('2SB','rossig','/metodologieoperative${P.e}','{"x":"seconda di G"}','2026-03-02 09:00+01',2025),
 ('2SB','rossig','${P.lab}','{"x":"lab di G in seconda"}','2026-03-03 09:00+01',2025);`);
const prima = await sql(`select md5(string_agg(id::text||data::text||updated_at::text||school_year, ',' order by id)) h, count(*) n from public.progress`);

// ---------------------------------------------------------------------------
gruppo = 'Migrazione';
await db.exec(migrazione);
prova('La migrazione si applica', true);
const dopo = await sql(`select md5(string_agg(id::text||data::text||updated_at::text||school_year, ',' order by id)) h, count(*) n,
    count(*) filter (where profilo_id is not null) attrib from public.progress`);
prova('Nessun salvataggio cambia', dopo[0].h === prima[0].h && Number(dopo[0].attrib) === 0, `${dopo[0].n} righe, impronta invariata`);
prova('Copia di sicurezza creata nello schema privato', Number((await sql('select count(*) n from private.progress_backup_pre_area_alunni_20261120'))[0].n) === Number(dopo[0].n));
try { await db.exec(migrazione); prova('Rieseguire si ferma', false); }
catch (e) { await db.exec('rollback').catch(() => {}); prova('Rieseguire la migrazione si ferma senza effetti', Number((await sql('select count(*) n from private.alunni_config'))[0].n) === 1, e.message.slice(0, 50)); }

// ---------------------------------------------------------------------------
gruppo = 'Unificazione automatica';
const iscr = await sql(`select c.sigla, i.codice, i.school_year, i.profilo_id,
    (select string_agg(v.classe||'/'||v.codice, ',' order by v.codice) from private.alunni_varianti v where v.iscrizione_id = i.id) varianti
    from private.alunni_iscrizioni i join private.alunni_classi c on c.id = i.classe_id order by 3, 1, 2`);
const trova = (anno, classe, codice) => iscr.find(x => x.school_year === anno && x.sigla === classe && x.codice === codice);
prova('ROSSIG in 3SB: un alunno, con «rosig» unito come variante', trova(2026, '3SB', 'ROSSIG')?.varianti === '3SB/ROSIG', trova(2026, '3SB', 'ROSSIG')?.varianti);
prova('Maiuscole, spazi e «3 SB» non creano alunni diversi', iscr.filter(x => x.school_year === 2026 && x.codice === 'ROSSIG').length === 1);
prova('ROSSIA e ROSSIM (stessa attività) restano due alunni', trova(2026, '3SB', 'ROSSIA') && trova(2026, '3SB', 'ROSSIM'));
prova('VERDIC salvato una volta con 3SA, attività diversa: unito come classe sbagliata', trova(2026, '3SB', 'VERDIC')?.varianti === '3SA/VERDIC' && !trova(2026, '3SA', 'VERDIC'));
prova('NERID in 4SA: alunno a sé', Boolean(trova(2026, '4SA', 'NERID')));
prova('Il profilo di ROSSIG continua dalla 2SB 2025/26 alla 3SB 2026/27', trova(2025, '2SB', 'ROSSIG')?.profilo_id === trova(2026, '3SB', 'ROSSIG')?.profilo_id);
prova('Nessun lavoro attribuito a mano: tutto viene dalle regole', Number((await sql('select count(*) n from public.progress where profilo_id is not null'))[0].n) === 0);

// ---------------------------------------------------------------------------
gruppo = 'Vecchio accesso invariato';
let r = await rpc('progress_carica', { p_student_code: 'ROSSIG', p_page_path: P.b });
prova('Le attività leggono come prima con classe e codice', r.ok && r.rows[0].progress_carica?.x === 'B di G');
r = await rpc('progress_salva', { p_class_code: '3SB', p_student_code: 'ROSSIG', p_page_path: P.b, p_data: { x: 'B di G aggiornato dal vecchio accesso' } });
prova('…e salvano come prima', r.ok, r.message);

// ---------------------------------------------------------------------------
gruppo = 'Ingresso';
r = await accedi('3sb', 'rossig');
const sG = val(r, 'token');
prova('Classe e codice di sempre: si entra', val(r, 'esito') === 'ok' && sG && val(r, 'classe') === '3SB' && val(r, 'codice') === 'ROSSIG');
const sG2 = val(await accedi('3SB', 'Rosig'), 'token');
prova('Con la grafia sbagliata già unita si entra nello stesso profilo', Boolean(sG2));
prova('Con la classe sbagliata già unita si entra (VERDIC con 3SA)', val(await accedi('3sa', 'verdic'), 'esito') === 'ok');
prova('Classe o codice inesistenti: risposta generica', val(await accedi('3SB', 'zzzz'), 'esito') === 'non_riconosciuto' && val(await accedi('5ZZ', 'rossig'), 'esito') === 'non_riconosciuto');
const sA = val(await accedi('3SB', 'rossia'), 'token');
const sM = val(await accedi('3SB', 'rossim'), 'token');
const profilo = (await rpc('alunni_profilo', { p_token: sG })).rows[0].alunni_profilo;
prova('Il profilo dice classe e anno', profilo.classe === '3SB' && profilo.anno_corso === 3 && profilo.anno_corrente === 2026, JSON.stringify(profilo));
await db.exec(`insert into public.progress (class_code, student_code, page_path, data, school_year) values ('3SB','nuovox','${P.a}','{"x":"nuovo arrivato"}',2026)`);
prova('Chi ha appena salvato la prima volta entra subito (profilo creato all’ingresso)', val(await accedi('3SB', 'nuovox'), 'esito') === 'ok');

// ---------------------------------------------------------------------------
gruppo = 'I miei lavori';
let lav = (await rpc('alunni_lavori', { p_token: sG })).rows;
const testi = lav.map(x => x.page_path.split('/').pop() + ':' + x.school_year);
prova('ROSSIG vede i suoi lavori, anche quello salvato come «rosig»', lav.length === 6 && testi.includes('esercitazioni_servizi.html:2026'), testi.join(', '));
prova('…e quelli di seconda, con il percorso normalizzato', lav.some(x => x.school_year === 2025 && x.page_path === P.e));
prova('Non vede i lavori di ROSSIA né di ROSSIM', !lav.some(x => ['A di Alessia', 'A di Mario'].includes(x.id)) && (await rpc('alunni_lavori', { p_token: sA })).rows.length === 1);
const idAlessia = (await sql(`select id from public.progress where student_code = 'rossia'`))[0].id;
r = (await rpc('alunni_lavoro_apri', { p_token: sG, p_page_path: P.a, p_id: idAlessia })).rows[0].alunni_lavoro_apri;
prova('Conoscere l’ID di un lavoro altrui non basta', r.stato === 'non_trovato');

// ---------------------------------------------------------------------------
gruppo = 'Riprendere e salvare';
r = (await rpc('alunni_lavoro_apri', { p_token: sG, p_page_path: P.b })).rows[0].alunni_lavoro_apri;
prova('Riapre il lavoro con i dati (anche quelli salvati dal vecchio accesso)', r.stato === 'in_corso' && r.data.x === 'B di G aggiornato dal vecchio accesso');
let s = await rpc('alunni_lavoro_salva', { p_token: sG, p_page_path: P.b, p_data: { x: 'B dall’area' }, p_versione: r.versione });
const vB = val(s, 'alunni_lavoro_salva')?.versione;
prova('Salva nella stessa riga', s.ok && vB, s.message);
r = await rpc('progress_carica', { p_student_code: 'ROSSIG', p_page_path: P.b });
prova('Il vecchio accesso vede subito lo stesso lavoro', r.rows[0].progress_carica?.x === 'B dall’area');
s = await rpc('alunni_lavoro_salva', { p_token: sG, p_page_path: P.b, p_data: { x: 'scheda vecchia' }, p_versione: r.versione ?? '2026-01-01T00:00:00Z' });
prova('Una scheda rimasta indietro riceve un conflitto', !s.ok && s.code === '40001' && s.hint === 'conflitto');
await db.exec(`insert into private.alunni_pagine (page_path, titolo, abilitata) values ('${P.d}', 'Esercitazioni', true), ('${P.c}', 'Equipe', true)`);
r = (await rpc('alunni_lavoro_apri', { p_token: sG, p_page_path: P.d })).rows[0].alunni_lavoro_apri;
prova('Il lavoro salvato con «rosig» si riapre', r.stato === 'in_corso' && r.data.x.startsWith('D di G'));
s = await rpc('alunni_lavoro_salva', { p_token: sG, p_page_path: P.d, p_data: { x: 'D continuato' }, p_versione: r.versione });
const rigaD = (await sql(`select student_code, data->>'x' x from public.progress where page_path = '${P.d}'`))[0];
prova('Salvando resta il codice con cui era stato salvato (la riga non si sposta)', s.ok && rigaD.student_code === 'rosig' && rigaD.x === 'D continuato');
await db.exec(`delete from private.alunni_pagine where page_path in ('${P.d}', '${P.c}')`);
r = (await rpc('alunni_lavoro_apri', { p_token: sG, p_page_path: P.e })).rows[0].alunni_lavoro_apri;
prova('Attività già fatta l’anno scorso: quest’anno si parte da un lavoro nuovo', r.stato === 'nuovo');
s = await rpc('alunni_lavoro_salva', { p_token: sG, p_page_path: P.e, p_data: { x: 'terza' }, p_versione: null });
const nuova = (await sql(`select class_code, student_code from public.progress where page_path = '${P.e}' and school_year = 2026`))[0];
prova('Il lavoro nuovo si salva con classe e codice principali', s.ok && nuova.class_code === '3SB' && nuova.student_code === 'ROSSIG');
const storico = lav.find(x => x.school_year === 2025 && x.page_path === P.e);
r = (await rpc('alunni_lavoro_apri', { p_token: sG, p_page_path: P.e, p_id: storico.id })).rows[0].alunni_lavoro_apri;
prova('Il lavoro di seconda si rilegge, non si modifica', r.data.x === 'seconda di G' && r.modificabile === false);
s = await rpc('alunni_lavoro_salva', { p_token: sG, p_page_path: P.lab, p_data: { x: 'x' }, p_versione: null });
prova('Pagina non abilitata: nessun salvataggio dall’area', !s.ok && s.hint === 'pagina');
s = await rpc('alunni_lavoro_salva', { p_token: 'f'.repeat(64), p_page_path: P.a, p_data: { x: 'x' }, p_versione: null });
prova('Token inventato respinto', !s.ok && s.hint === 'sessione');

// ---------------------------------------------------------------------------
gruppo = '1° settembre';
await ora('2027-08-31 23:30:00+02');
r = (await rpc('alunni_lavoro_apri', { p_token: sG, p_page_path: P.a })).rows[0].alunni_lavoro_apri;
prova('31 agosto 23:30: si lavora ancora nel 2026/27', r.stato === 'in_corso' && r.school_year === 2026);
await ora('2027-09-01 00:30:00+02');
r = (await rpc('alunni_lavoro_apri', { p_token: sG, p_page_path: P.a })).rows[0].alunni_lavoro_apri;
s = await rpc('alunni_lavoro_salva', { p_token: sG, p_page_path: P.a, p_data: { x: 'scheda aperta' }, p_versione: null });
prova('1° settembre 00:30: niente scritture nel nuovo anno senza classe', r.stato === 'non_iscritto' && !s.ok && s.hint === 'iscrizione');
await rpc('progress_salva', { p_class_code: '4SB', p_student_code: 'rossig', p_page_path: P.a, p_data: { x: 'quarta' } });
r = await accedi('4SB', 'rossig');
const p4 = (await rpc('alunni_profilo', { p_token: val(r, 'token') })).rows[0].alunni_profilo;
lav = (await rpc('alunni_lavori', { p_token: val(r, 'token') })).rows;
prova('In quarta lo stesso alunno ritrova anche terza e seconda', val(r, 'esito') === 'ok' && p4.classe === '4SB' && new Set(lav.map(x => x.school_year)).size === 3, [...new Set(lav.map(x => x.school_year))].join(','));
await ora('2026-11-20 10:00:00+01');

// ---------------------------------------------------------------------------
gruppo = 'Docente';
const tok = val(await rpc('progress_docente_accesso', { p_password: 'password-di-collaudo' }), 'token');
r = await rpc('alunni_docente_stato', { p_token: 'x'.repeat(64) });
prova('Senza sessione docente: rifiuto', !r.ok && r.code === '42501');
let cl = (await rpc('alunni_docente_classe', { p_token: tok, p_school_year: 2026, p_sigla: '3sb' })).rows[0].alunni_docente_classe;
prova('La classe elenca gli alunni con le grafie unite', cl.alunni.find(a => a.codice === 'ROSSIG')?.varianti.length === 1, cl.alunni.map(a => a.codice).join(','));
const coppia = cl.da_decidere.find(x => x.a === 'ROSSIA' && x.b === 'ROSSIM');
prova('ROSSIA/ROSSIM proposti come caso da decidere', Boolean(coppia));
await rpc('alunni_docente_diversi', { p_token: tok, p_iscrizione_a: coppia.iscrizione_a, p_iscrizione_b: coppia.iscrizione_b });
cl = (await rpc('alunni_docente_classe', { p_token: tok, p_school_year: 2026, p_sigla: '3SB' })).rows[0].alunni_docente_classe;
prova('«Alunni diversi»: la coppia non viene più proposta', !cl.da_decidere.some(x => x.a === 'ROSSIA' && x.b === 'ROSSIM'));
const varRosig = cl.alunni.find(a => a.codice === 'ROSSIG').varianti[0].id;
await rpc('alunni_docente_separa', { p_token: tok, p_variante: varRosig });
lav = (await rpc('alunni_lavori', { p_token: sG })).rows;
prova('«Separa»: il lavoro con «rosig» esce subito da ROSSIG', !lav.some(x => x.page_path === P.d));
cl = (await rpc('alunni_docente_classe', { p_token: tok, p_school_year: 2026, p_sigla: '3SB' })).rows[0].alunni_docente_classe;
prova('…e ROSIG diventa un alunno a sé che non viene riunito da solo', cl.alunni.some(a => a.codice === 'ROSIG') && cl.alunni.find(a => a.codice === 'ROSSIG').varianti.every(v => v.stato === 'separata'));
const iG = cl.alunni.find(a => a.codice === 'ROSSIG').iscrizione_id;
const iR = cl.alunni.find(a => a.codice === 'ROSIG').iscrizione_id;
r = await rpc('alunni_docente_unisci', { p_token: tok, p_iscrizione_a: iG, p_iscrizione_b: iR });
lav = (await rpc('alunni_lavori', { p_token: sG })).rows;
prova('«Stesso alunno»: il lavoro torna a ROSSIG', r.ok && lav.some(x => x.page_path === P.d), r.message);
const reg = (await rpc('alunni_docente_registro', { p_token: tok })).rows.map(x => x.azione);
prova('Registro delle decisioni', ['alunni_diversi', 'variante_separata', 'stesso_alunno'].every(a => reg.includes(a)));
const elenco = (await rpc('progress_docente_elenco_con_anno', { p_token: tok, p_limite: 1000 })).rows.map(x => x.id);
prova('Le viste docente esistenti contano ogni lavoro una volta', new Set(elenco).size === elenco.length);

// ---------------------------------------------------------------------------
gruppo = 'Sessione, uscita, sospensione';
await rpc('alunni_esci', { p_token: sG2 });
prova('Dopo «Esci» il token non vale più', (await rpc('alunni_lavori', { p_token: sG2 })).hint === 'sessione');
await db.exec(`update private.alunni_sessioni set scade_il = now() - interval '1 minute' where token_hash = encode(extensions.digest('${sM}', 'sha256'), 'hex')`);
prova('Sessione scaduta: nessuna lettura', (await rpc('alunni_lavori', { p_token: sM })).hint === 'sessione');
await rpc('alunni_docente_ingresso', { p_token: tok, p_attivo: false });
prova('Ingresso sospeso: nessun nuovo accesso', val(await accedi('3SB', 'rossig'), 'esito') === 'non_disponibile');
prova('Ingresso sospeso: le sessioni aperte si fermano', (await rpc('alunni_lavori', { p_token: sA })).hint === 'non_disponibile');
r = await rpc('progress_carica', { p_student_code: 'ROSSIG', p_page_path: P.b });
prova('Ingresso sospeso: il vecchio accesso dalle attività continua', r.ok && r.rows[0].progress_carica?.x === 'B dall’area');
await rpc('alunni_docente_ingresso', { p_token: tok, p_attivo: true });

// ---------------------------------------------------------------------------
gruppo = 'Permessi';
for (const [descr, q] of [['anon non legge progress', 'select count(*) from public.progress'],
    ['anon non legge le iscrizioni', 'select * from private.alunni_iscrizioni'],
    ['anon non esegue le funzioni interne', 'select private.alunni_unifica(2026)']]) {
    await db.exec('set role anon');
    let ok; try { const x = await db.query(q); ok = q.startsWith('select count') && Number(x.rows[0].count) === 0; } catch { ok = true; }
    await db.exec('reset role');
    prova(descr, ok);
}
for (let i = 0; i < 60; i++) await rpc('alunni_accesso', { p_classe: '3SB', p_codice: `nessuno${i}` }, { ip: '203.0.113.9' });
prova('Dopo 60 errori dalla stessa rete in 15 minuti: pausa', val(await rpc('alunni_accesso', { p_classe: '3SB', p_codice: 'rossig' }, { ip: '203.0.113.9' }), 'esito') === 'troppi_tentativi');

// ---------------------------------------------------------------------------
const falliti = esiti.filter(e => !e.ok);
const versione = (await sql('select version() v'))[0].v.split(' on ')[0];
writeFileSync(join(qui, 'ESITO-COLLAUDO-DB.md'), `# Collaudo database dell’Area alunni

Ambiente: ${versione}, in memoria, struttura remota ricostruita in \`baseline.sql\`, dati inventati.
Comando: \`cd supabase/test && npm install && node area-alunni.test.mjs\`. Eseguito il ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}.
Esito: ${esiti.length - falliti.length} prove superate su ${esiti.length}.

| Gruppo | Prova | Esito | Evidenza |
| --- | --- | --- | --- |
${esiti.map(e => `| ${e.gruppo} | ${e.nome} | ${e.ok ? 'superata' : '**NON superata**'} | ${e.evidenza.replace(/\|/g, '/')} |`).join('\n')}
`);
console.log(`\n${esiti.length - falliti.length}/${esiti.length} prove superate`);
process.exit(falliti.length ? 1 : 0);
