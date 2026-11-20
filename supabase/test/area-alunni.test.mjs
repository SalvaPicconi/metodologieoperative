// Collaudo locale della migrazione «Area alunni» su PGlite (Postgres in WebAssembly).
// Nessun collegamento al progetto remoto: tutti i dati sono inventati.
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
    esiti.push({ gruppo, nome, ok: Boolean(ok), evidenza: String(evidenza) });
    console.log(`${ok ? '✔' : '✘'} [${gruppo}] ${nome}${evidenza ? ` — ${evidenza}` : ''}`);
}

const firme = new Map();
async function firma(nome) {
    if (firme.has(nome)) return firme.get(nome);
    const r = await db.query(
        `select pg_get_function_identity_arguments(p.oid) a from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = $1`, [nome]);
    if (!r.rows.length) throw new Error(`funzione ${nome} assente`);
    const args = r.rows[0].a ? r.rows[0].a.split(', ').map(s => {
        const [n, ...t] = s.split(' ');
        return { n, t: t.join(' ').replace(/ DEFAULT .*/, '') };
    }) : [];
    firme.set(nome, args);
    return args;
}

// Chiamata come il browser: ruolo anon, solo funzioni esposte, intestazioni HTTP simulate.
async function rpc(nome, args = {}, { ip = '10.0.0.1' } = {}) {
    const def = await firma(nome);
    const usati = def.filter(d => Object.hasOwn(args, d.n));
    const sql = `select * from public.${nome}(${usati.map((d, i) => `${d.n} => $${i + 1}::${d.t}`).join(', ')})`;
    const valori = usati.map(d => {
        const v = args[d.n];
        return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
    });
    await db.exec(`set request.headers = '${JSON.stringify({ 'x-forwarded-for': ip }).replace(/'/g, "''")}'`);
    await db.exec('set role anon');
    try {
        const r = await db.query(sql, valori);
        return { ok: true, rows: r.rows };
    } catch (e) {
        return { ok: false, code: e.code, message: e.message, hint: e.hint };
    } finally {
        await db.exec('reset role');
    }
}
const uno = r => (r.ok ? r.rows[0] : null);
const val = (r, col) => (r.ok && r.rows[0] ? r.rows[0][col] : undefined);
async function ora(ts) { await db.exec(`set test.ora = '${ts}'`); }
async function sql(q, p) { return (await db.query(q, p)).rows; }

// ---------------------------------------------------------------------------
gruppo = 'Base';
await db.exec(baseline);
await ora('2026-11-20 10:00:00+01');
// Il collaudo simula la data: la funzione dell'anno legge test.ora se presente.
await db.exec(`create or replace function private.progress_school_year(p_at timestamptz)
returns integer language sql stable set search_path to '' as $$
  select extract(year from (coalesce(nullif(current_setting('test.ora', true), '')::timestamptz, p_at)
                 at time zone 'Europe/Rome') - interval '8 months')::integer; $$;`);

const PAG = {
    ripasso: '/materiali/terzo/ripasso-terzo-anno.html',
    percorsi: '/materiali/terzo/percorsi_autoapprendimento.html',
    tssas: '/materiali/biennio/tssas_percorso_completo_v2.html',
    lab: '/laboratorio.html'
};
// Salvataggi storici inventati.
await db.exec(`
insert into public.progress (class_code, student_code, page_path, data, updated_at, school_year) values
 ('3SB','ROSSIA','${PAG.ripasso}','{"r1":"risposta di prova A"}','2026-11-10 09:00+01',2026),
 ('3SB','BIANCHB','${PAG.percorsi}','{"p1":"risposta con codice digitato male"}','2026-11-11 09:00+01',2026),
 ('3SA','VERDIC','${PAG.ripasso}','{"r1":"stesso codice in 3SA"}','2026-11-12 09:00+01',2026),
 ('3SB','VERDIC','${PAG.percorsi}','{"p1":"stesso codice in 3SB"}','2026-11-12 10:00+01',2026),
 ('3SA','GIALLIG','${PAG.percorsi}','{"p1":"unica riga, classe diversa"}','2026-11-13 09:00+01',2026),
 ('2SB','ROSSIA','/metodologieoperative${PAG.tssas}','{"t1":"lavoro di seconda"}','2026-03-02 09:00+01',2025),
 ('4SA','NERID','${PAG.ripasso}','{"r1":"altra classe"}','2026-11-14 09:00+01',2026),
 ('3SB','ROSSIA','${PAG.lab}','{"l1":"pagina fuori dal perimetro"}','2026-11-15 09:00+01',2026);
`);
const primaMigrazione = await sql(`select md5(string_agg(id::text||data::text||updated_at::text||school_year, ',' order by id)) h, count(*) n from public.progress`);

let r = await rpc('progress_salva', { p_class_code: '3SB', p_student_code: 'ROSSIA', p_page_path: PAG.percorsi, p_data: { p1: 'legacy prima' } });
prova('Prima della migrazione il flusso storico salva', r.ok, r.message);
await db.exec(`delete from public.progress where student_code = 'ROSSIA' and page_path = '${PAG.percorsi}'`);

// ---------------------------------------------------------------------------
gruppo = 'Migrazione';
try {
    await db.exec(migrazione);
    prova('La migrazione si applica', true);
} catch (e) {
    prova('La migrazione si applica', false, e.message);
    throw e;
}
const dopo = await sql(`select md5(string_agg(id::text||data::text||updated_at::text||school_year, ',' order by id)) h, count(*) n,
    count(*) filter (where protetto or profilo_id is not null) toccate from public.progress`);
prova('Nessun salvataggio esistente cambia', dopo[0].h === primaMigrazione[0].h && dopo[0].n === primaMigrazione[0].n && Number(dopo[0].toccate) === 0,
    `${dopo[0].n} righe, impronta invariata`);
try {
    await db.exec(migrazione);
    prova('Rieseguire la migrazione non produce doppioni', false, 'è passata una seconda volta');
} catch (e) {
    await db.exec('rollback').catch(() => {});
    const n = await sql(`select count(*) n from private.alunni_config`);
    prova('Rieseguire la migrazione si ferma senza effetti', Number(n[0].n) === 1, e.message.slice(0, 60));
}
r = await rpc('progress_carica', { p_student_code: 'ROSSIA', p_page_path: PAG.ripasso });
prova('Dopo la migrazione, senza attivazione, il flusso storico legge come prima', r.ok && r.rows[0].progress_carica?.r1 === 'risposta di prova A');
r = await rpc('alunni_accesso', { p_codice: 'AAAA-BBBB-CCCC-DDDD' });
prova('Ingresso spento: risposta «non disponibile»', val(r, 'esito') === 'non_disponibile');

// ---------------------------------------------------------------------------
gruppo = 'Permessi';
for (const [descr, q] of [
    ['anon non legge progress', 'select count(*) from public.progress'],
    ['anon non legge i profili', 'select * from private.alunni_profili'],
    ['anon non legge le credenziali', 'select * from private.alunni_credenziali'],
    ['anon non esegue le funzioni interne', `select private.alunni_nuovo_codice()`],
    ['anon non scrive direttamente', `insert into public.progress (class_code, student_code, page_path) values ('x','x','/x')`]
]) {
    await db.exec('set role anon');
    let esito;
    try {
        const rr = await db.query(q);
        esito = q.startsWith('select count') ? Number(rr.rows[0].count) === 0 : false;
    } catch { esito = true; }
    await db.exec('reset role');
    prova(descr, esito);
}
r = await rpc('alunni_docente_stato', { p_token: 'x'.repeat(64) });
prova('Le funzioni docente rifiutano un token falso', !r.ok && r.code === '42501');

// ---------------------------------------------------------------------------
gruppo = 'Attivazione docente';
const tok = val(await rpc('progress_docente_accesso', { p_password: 'password-di-collaudo' }), 'token');
prova('Accesso docente di collaudo', Boolean(tok));
for (const [k, p] of Object.entries(PAG)) {
    if (k === 'lab') continue;
    r = await rpc('alunni_docente_pagina', { p_token: tok, p_page_path: p, p_titolo: `Attività ${k}`, p_abilitata: true });
    if (!r.ok) prova(`Abilita ${k}`, false, r.message);
}
r = await rpc('alunni_docente_ingresso', { p_token: tok, p_attivo: true });
prova('Ingresso attivato', r.ok, r.message);
const lista3SB = [
    { pseudonimo: 'Alunna A.', codice_storico: 'rossia' },
    { pseudonimo: 'Alunno B.', codice_storico: 'BIANCHIB' },
    { pseudonimo: 'Alunno C.', codice_storico: 'VERDIC' },
    { pseudonimo: 'Alunno G.', codice_storico: 'GIALLIG' }
];
r = await rpc('alunni_docente_importa', { p_token: tok, p_school_year: 2026, p_sigla: '3sb', p_elenco: lista3SB, p_conferma: false });
prova('Anteprima dell’importazione senza scritture', r.ok && r.rows.every(x => x.esito === 'nuovo')
    && Number((await sql('select count(*) n from private.alunni_profili'))[0].n) === 0, r.ok ? r.rows.map(x => x.esito).join(', ') : r.message);
r = await rpc('alunni_docente_importa', { p_token: tok, p_school_year: 2026, p_sigla: '3SB', p_elenco: lista3SB, p_conferma: true });
prova('Importazione confermata', r.ok && r.rows.length === 4, r.message);
r = await rpc('alunni_docente_importa', { p_token: tok, p_school_year: 2026, p_sigla: '3SB', p_elenco: lista3SB, p_conferma: true });
prova('Reimportare la stessa lista non crea doppioni', r.ok && r.rows.every(x => x.esito === 'già in questa classe')
    && Number((await sql('select count(*) n from private.alunni_profili'))[0].n) === 4,
    r.ok ? r.rows.map(x => x.esito).join(', ') : r.message);
r = await rpc('alunni_docente_importa', { p_token: tok, p_school_year: 2026, p_sigla: '3SA', p_elenco: [{ pseudonimo: 'Omonimo', codice_storico: 'VERDIC' }], p_conferma: false });
prova('Lo stesso codice non può andare a due alunni nello stesso anno', r.ok && /già usato/.test(r.rows[0].esito), r.ok ? r.rows[0].esito : r.message);
r = await rpc('alunni_docente_importa', { p_token: tok, p_school_year: 2026, p_sigla: '3SA', p_elenco: [{ pseudonimo: 'X', codice_storico: 'DOPPIO' }, { pseudonimo: 'Y', codice_storico: 'doppio' }], p_conferma: false });
prova('Codice ripetuto nella stessa lista segnalato', r.ok && r.rows[1].esito === 'codice ripetuto nella lista');

const classe = uno(await rpc('alunni_docente_classe', { p_token: tok, p_school_year: 2026, p_sigla: '3SB' })).alunni_docente_classe;
const id = Object.fromEntries(classe.alunni.map(a => [a.codice_storico, a.profilo_id]));
prova('La classe 3SB 2026 elenca quattro alunni', classe.alunni.length === 4);
const protette = await sql(`select student_code, page_path, protetto from public.progress where protetto order by 1, 2`);
prova('All’attivazione le righe dell’anno con codici protetti su pagine abilitate vanno in verifica',
    protette.length === 4 && protette.every(x => ['ROSSIA', 'VERDIC', 'GIALLIG'].includes(x.student_code)),
    protette.map(x => `${x.student_code}${x.page_path.slice(-12)}`).join(', '));
prova('La pagina fuori dal perimetro non viene toccata', protette.every(x => x.page_path !== PAG.lab));

// ---------------------------------------------------------------------------
gruppo = 'Confine storico';
r = await rpc('progress_carica', { p_student_code: 'ROSSIA', p_page_path: PAG.ripasso });
prova('progress_carica non restituisce più la riga passata in verifica', r.ok && r.rows[0].progress_carica === null);
r = await rpc('progress_salva', { p_class_code: '3SB', p_student_code: 'ROSSIA', p_page_path: PAG.ripasso, p_data: { r1: 'sovrascrittura' } });
prova('progress_salva non la modifica', !r.ok && r.code === '42501', r.message);
r = await rpc('progress_salva', { p_class_code: '3SB', p_student_code: 'ROSSIA', p_page_path: '/metodologieoperative' + PAG.ripasso, p_data: { r1: 'via percorso vecchio' } });
prova('Neppure dal percorso con il vecchio prefisso', !r.ok && r.code === '42501');
r = await rpc('progress_salva', { p_class_code: '3SB', p_student_code: 'rossia', p_page_path: PAG.percorsi, p_data: { p1: 'nuova riga storica' } });
prova('Una vecchia pagina non ricrea la posizione su una pagina abilitata (anche in minuscolo)', !r.ok && r.code === '42501');
r = await rpc('progress_salva', { p_class_code: '3SB', p_student_code: 'ROSSIA', p_page_path: PAG.lab, p_data: { l1: 'fuori perimetro aggiornato' } });
const lab = await rpc('progress_carica', { p_student_code: 'ROSSIA', p_page_path: PAG.lab });
prova('Fuori dal perimetro il vecchio accesso funziona come prima', r.ok && lab.rows[0].progress_carica?.l1 === 'fuori perimetro aggiornato');
r = await rpc('progress_salva', { p_class_code: '4SA', p_student_code: 'NERID', p_page_path: PAG.ripasso, p_data: { r1: 'altra classe ok' } });
prova('Gli alunni senza accesso personale continuano a salvare', r.ok, r.message);

// ---------------------------------------------------------------------------
gruppo = 'Codici e sessioni';
const codici = {};
for (const c of ['ROSSIA', 'BIANCHIB', 'VERDIC', 'GIALLIG']) {
    codici[c] = val(await rpc('alunni_docente_codice', { p_token: tok, p_profilo_id: id[c] }), 'alunni_docente_codice');
}
prova('Codice nel formato XXXX-XXXX-XXXX-XXXX', /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/.test(codici.ROSSIA), codici.ROSSIA.replace(/[A-Z0-9]/g, '•'));
const inChiaro = await sql(`select count(*) n from private.alunni_credenziali where impronta = $1 or impronta ilike '%' || $1 || '%'`, [codici.ROSSIA]);
prova('Nel database resta solo l’impronta', Number(inChiaro[0].n) === 0);
const sbagliato = await rpc('alunni_accesso', { p_codice: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ' });
const corto = await rpc('alunni_accesso', { p_codice: 'abc' });
prova('Codice errato: risposta generica', val(sbagliato, 'esito') === 'non_riconosciuto' && val(corto, 'esito') === 'non_riconosciuto' && !val(sbagliato, 'token'));
const tentativi = await sql(`select count(*) filter (where not riuscito) f from private.alunni_tentativi`);
prova('I tentativi falliti restano registrati (servono al limite)', Number(tentativi[0].f) === 2);
const variante = codici.ROSSIA.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
const sA = val(await rpc('alunni_accesso', { p_codice: variante }), 'token');
prova('Accetta minuscole, spazi e le lettere O/I/L lette come cifre', Boolean(sA));
const sB = val(await rpc('alunni_accesso', { p_codice: codici.BIANCHIB }), 'token');
const sC = val(await rpc('alunni_accesso', { p_codice: codici.VERDIC }), 'token');
r = uno(await rpc('alunni_profilo', { p_token: sA })).alunni_profilo;
prova('Il profilo restituisce classe e anno dalla sessione', r.classe === '3SB' && r.anno_corso === 3 && r.anno_corrente === 2026, JSON.stringify(r));

// ---------------------------------------------------------------------------
gruppo = 'Isolamento';
r = uno(await rpc('alunni_lavoro_apri', { p_token: sA, p_page_path: PAG.percorsi })).alunni_lavoro_apri;
prova('Pagina nuova per A: stato «nuovo»', r.stato === 'nuovo' && r.modificabile === true);
r = await rpc('alunni_lavoro_salva', { p_token: sA, p_page_path: PAG.percorsi, p_data: { p1: 'lavoro protetto di A', _meta: { percentuale: 40 } }, p_versione: null });
const versioneA = uno(r)?.alunni_lavoro_salva?.versione;
prova('A salva il proprio lavoro', r.ok && versioneA, r.message);
r = uno(await rpc('alunni_lavoro_apri', { p_token: sB, p_page_path: PAG.percorsi })).alunni_lavoro_apri;
prova('B sulla stessa pagina non vede il lavoro di A', r.stato !== 'in_corso' && !r.data, r.stato);
const idA = (await sql(`select id from public.progress where profilo_id = $1 and page_path = $2`, [id.ROSSIA, PAG.percorsi]))[0].id;
r = uno(await rpc('alunni_lavoro_apri', { p_token: sB, p_page_path: PAG.percorsi, p_id: idA })).alunni_lavoro_apri;
prova('Conoscere l’ID del lavoro di A non basta a B', r.stato === 'non_trovato');
r = await rpc('alunni_lavori', { p_token: sB });
prova('L’elenco di B non contiene lavori di A', r.ok && r.rows.every(x => x.id !== idA), `${r.rows?.length} righe`);
r = await rpc('alunni_lavoro_salva', { p_token: sB, p_page_path: PAG.percorsi, p_data: { p1: 'B' }, p_versione: versioneA });
prova('B non può scrivere sulla riga di A usando la versione di A', !r.ok, r.message);
r = await rpc('progress_carica', { p_student_code: 'ROSSIA', p_page_path: PAG.percorsi });
prova('Il lavoro protetto di A non è leggibile col vecchio accesso', r.ok && r.rows[0].progress_carica === null);
r = await rpc('alunni_lavoro_salva', { p_token: 'f'.repeat(64), p_page_path: PAG.percorsi, p_data: { p1: 'x' }, p_versione: null });
prova('Token inventato respinto', !r.ok && r.code === '42501' && r.hint === 'sessione');
r = await rpc('alunni_lavoro_salva', { p_token: sA, p_page_path: PAG.lab, p_data: { l1: 'x' }, p_versione: null });
prova('Pagina non abilitata: salvataggio protetto rifiutato', !r.ok && r.hint === 'pagina');
r = await rpc('alunni_lavoro_salva', { p_token: sA, p_page_path: PAG.percorsi, p_data: [1, 2], p_versione: versioneA });
prova('Payload non oggetto rifiutato', !r.ok && r.code === '22023');

// ---------------------------------------------------------------------------
gruppo = 'Versioni e schede';
r = await rpc('alunni_lavoro_salva', { p_token: sA, p_page_path: PAG.percorsi, p_data: { p1: 'scheda 1', x: '<img src=x onerror=alert(1)>' }, p_versione: versioneA });
const v2 = uno(r)?.alunni_lavoro_salva?.versione;
prova('Salvataggio con la versione corrente', r.ok && v2 && v2 !== versioneA, r.message);
r = await rpc('alunni_lavoro_salva', { p_token: sA, p_page_path: PAG.percorsi, p_data: { p1: 'scheda 2 rimasta indietro' }, p_versione: versioneA });
prova('Una seconda scheda con versione vecchia riceve un conflitto', !r.ok && r.code === '40001' && r.hint === 'conflitto');
r = uno(await rpc('alunni_lavoro_apri', { p_token: sA, p_page_path: PAG.percorsi })).alunni_lavoro_apri;
prova('Il contenuto rimasto è quello della scheda aggiornata', r.data.p1 === 'scheda 1' && r.data.x.includes('<img'), 'HTML conservato come testo: l’escape spetta alla pagina');

// ---------------------------------------------------------------------------
gruppo = 'Lavori storici';
let cand = (await rpc('alunni_docente_candidati', { p_token: tok, p_school_year: 2026, p_sigla: '3SB' })).rows;
const esito = (codice, pagina) => cand.find(c => c.student_code === codice && c.page_path === pagina);
prova('Stesso codice e stessa classe: «certo»', esito('ROSSIA', PAG.ripasso)?.esito === 'certo');
prova('Codice con una lettera mancante: «simile», al solo docente', esito('BIANCHB', PAG.percorsi)?.esito === 'simile'
    && esito('BIANCHB', PAG.percorsi)?.pseudonimo === 'Alunno B.');
prova('Stesso codice in due classi nello stesso anno: «da verificare»', esito('VERDIC', PAG.percorsi)?.esito === 'da_verificare'
    && esito('VERDIC', PAG.ripasso)?.esito === 'da_verificare', esito('VERDIC', PAG.percorsi)?.motivo);
prova('Unica riga rimasta con altra classe: «da verificare»', esito('GIALLIG', PAG.percorsi)?.esito === 'da_verificare', esito('GIALLIG', PAG.percorsi)?.motivo);
prova('Nessun abbinamento automatico', Number((await sql(`select count(*) n from public.progress where profilo_id is not null and student_code <> 'ROSSIA'`))[0].n) === 0);
r = await rpc('alunni_lavori', { p_token: sB });
prova('Prima della conferma B non vede il lavoro col codice sbagliato', r.ok && r.rows.length === 0);
const rigaB = esito('BIANCHB', PAG.percorsi).progress_id;
r = await rpc('alunni_docente_collega', { p_token: tok, p_progress_id: rigaB, p_profilo_id: id.BIANCHIB, p_motivo: 'errore di battitura' });
prova('Il docente conferma il collegamento', r.ok, r.message);
r = await rpc('alunni_docente_collega', { p_token: tok, p_progress_id: rigaB, p_profilo_id: id.VERDIC, p_motivo: 'secondo proprietario' });
prova('Una riga non può avere due proprietari', !r.ok && r.code === '23505');
r = await rpc('alunni_lavori', { p_token: sB });
prova('Dopo la conferma B lo vede', r.ok && r.rows.some(x => x.id === rigaB));
r = uno(await rpc('alunni_lavoro_apri', { p_token: sB, p_page_path: PAG.percorsi })).alunni_lavoro_apri;
prova('…e lo riprende con i dati compilati', r.stato === 'in_corso' && r.data.p1.startsWith('risposta con codice'));
r = await rpc('alunni_lavoro_salva', { p_token: sB, p_page_path: PAG.percorsi, p_data: { p1: 'continuato da B' }, p_versione: r.versione });
prova('…e lo continua', r.ok, r.message);
r = await rpc('progress_carica', { p_student_code: 'BIANCHB', p_page_path: PAG.percorsi });
prova('Il vecchio codice digitato male non apre più la riga', r.ok && r.rows[0].progress_carica === null);
r = await rpc('progress_salva', { p_class_code: '3SB', p_student_code: 'BIANCHB', p_page_path: PAG.percorsi, p_data: { p1: 'vecchia pagina in cache' } });
prova('…né la modifica da una pagina vecchia in cache', !r.ok && r.code === '42501');
r = await rpc('alunni_docente_collegamenti', { p_token: tok, p_school_year: 2026, p_sigla: '3SB' });
prova('Il docente vede il collegamento confermato da poter annullare', r.ok && r.rows.some(x => x.progress_id === rigaB && x.pseudonimo === 'Alunno B.'));
r = await rpc('alunni_docente_annulla', { p_token: tok, p_progress_id: rigaB, p_motivo: 'prova di annullamento' });
prova('Annullamento: il docente vede che la riga è cambiata dopo il collegamento', r.ok && uno(r).alunni_docente_annulla.modificato_dopo_il_collegamento === true);
r = await rpc('alunni_lavori', { p_token: sB });
prova('Annullamento: B perde subito l’accesso', r.ok && !r.rows.some(x => x.id === rigaB));
const rigaDopo = (await sql(`select protetto, profilo_id, data from public.progress where id = $1`, [rigaB]))[0];
prova('Annullamento: la riga resta, protetta e senza proprietario', rigaDopo.protetto && !rigaDopo.profilo_id && rigaDopo.data.p1 === 'continuato da B');
r = await rpc('progress_carica', { p_student_code: 'BIANCHB', p_page_path: PAG.percorsi });
prova('Annullamento: il vecchio accesso resta chiuso', r.ok && r.rows[0].progress_carica === null);
const registro = (await rpc('alunni_docente_registro', { p_token: tok })).rows.map(x => x.azione);
prova('Registro con conferma e annullamento', registro.includes('collegamento_confermato') && registro.includes('collegamento_annullato'));
r = await rpc('alunni_docente_sblocca', { p_token: tok, p_progress_id: esito('VERDIC', PAG.ripasso).progress_id });
prova('Non si sblocca una riga di un codice con accesso personale', !r.ok);

// Collegamento di un lavoro dell'anno precedente (percorso con vecchio prefisso).
await rpc('alunni_docente_importa', { p_token: tok, p_school_year: 2025, p_sigla: '2SB', p_elenco: [{ profilo_id: id.ROSSIA, codice_storico: 'ROSSIA' }], p_conferma: true });
cand = (await rpc('alunni_docente_candidati', { p_token: tok, p_school_year: 2025, p_sigla: '2SB' })).rows;
const vecchio = cand.find(c => c.student_code === 'ROSSIA');
prova('Lavoro 2025/26 di seconda proposto per lo stesso profilo', vecchio?.esito === 'certo' && vecchio.profilo_id === id.ROSSIA);
r = await rpc('alunni_docente_collega', { p_token: tok, p_progress_id: vecchio.progress_id, p_profilo_id: id.ROSSIA, p_motivo: 'storico seconda' });
const lavoriA = (await rpc('alunni_lavori', { p_token: sA })).rows;
const storico = lavoriA.find(x => x.school_year === 2025);
prova('Lo storico compare con anno, percorso normalizzato e sola lettura', storico && storico.page_path === PAG.tssas && storico.modificabile === false);
r = uno(await rpc('alunni_lavoro_apri', { p_token: sA, p_page_path: PAG.tssas, p_id: storico.id })).alunni_lavoro_apri;
prova('Lo storico si riapre con i dati, non modificabile', r.data?.t1 === 'lavoro di seconda' && r.modificabile === false && r.school_year === 2025);
r = uno(await rpc('alunni_lavoro_apri', { p_token: sA, p_page_path: PAG.tssas })).alunni_lavoro_apri;
prova('Rifare l’attività quest’anno apre un lavoro nuovo', r.stato === 'nuovo');

// ---------------------------------------------------------------------------
gruppo = '1° settembre';
await ora('2027-08-31 23:30:00+02');
r = await rpc('alunni_lavoro_salva', { p_token: sA, p_page_path: PAG.percorsi, p_data: { p1: 'ultima sera di agosto' }, p_versione: v2 });
const v3 = uno(r)?.alunni_lavoro_salva?.versione;
prova('31 agosto alle 23:30 (ora italiana) si scrive ancora nel 2026/27', r.ok, r.message);
await ora('2027-09-01 00:30:00+02');
r = uno(await rpc('alunni_lavoro_apri', { p_token: sA, p_page_path: PAG.percorsi })).alunni_lavoro_apri;
prova('1° settembre alle 00:30: senza iscrizione nel nuovo anno non si scrive', r.stato === 'non_iscritto' && r.modificabile === false);
r = await rpc('alunni_lavoro_salva', { p_token: sA, p_page_path: PAG.percorsi, p_data: { p1: 'scheda rimasta aperta' }, p_versione: v3 });
prova('Una scheda rimasta aperta non scrive nell’anno sbagliato', !r.ok && r.hint === 'iscrizione');
r = (await rpc('alunni_lavori', { p_token: sA })).rows;
prova('I lavori 2026/27 restano consultabili in sola lettura', r.filter(x => x.school_year === 2026).every(x => !x.modificabile));
r = await rpc('alunni_docente_importa', { p_token: tok, p_school_year: 2027, p_sigla: '4SB', p_elenco: [{ profilo_id: id.ROSSIA, codice_storico: 'ROSSIA' }], p_conferma: true });
prova('Passaggio in quarta: stesso profilo, nuova iscrizione', r.ok && r.rows[0].esito === 'portato dall\'anno precedente', r.ok ? r.rows[0].esito : r.message);
r = uno(await rpc('alunni_profilo', { p_token: sA })).alunni_profilo;
prova('Classe e anno di corso seguono l’iscrizione attuale', r.classe === '4SB' && r.anno_corso === 4);
r = await rpc('alunni_lavoro_salva', { p_token: sA, p_page_path: PAG.percorsi, p_data: { p1: 'rifatto in quarta' }, p_versione: null });
const righeA = await sql(`select school_year, class_code, data->>'p1' p1 from public.progress where profilo_id = $1 and page_path = $2 order by 1`, [id.ROSSIA, PAG.percorsi]);
prova('Nel nuovo anno nasce un lavoro nuovo, il vecchio resta intatto', r.ok && righeA.length === 2 && righeA[0].p1 === 'ultima sera di agosto' && righeA[1].class_code === '4SB',
    righeA.map(x => `${x.school_year}:${x.class_code}`).join(' / '));
r = await rpc('alunni_docente_importa', { p_token: tok, p_school_year: 2027, p_sigla: '3SB', p_elenco: [{ pseudonimo: 'Nuova alunna Z.', codice_storico: 'ZETAZ' }], p_conferma: true });
cand = (await rpc('alunni_docente_candidati', { p_token: tok, p_school_year: 2027, p_sigla: '3SB' })).rows;
prova('La 3SB del 2027/28 è un gruppo diverso: nessun lavoro del 2026/27 le viene proposto', r.ok && cand.every(c => c.school_year === 2027));
const classi = await sql(`select count(*) n from private.alunni_classi where anno_corso = 3 and sezione = 'SB'`);
prova('Due classi 3SB distinte per anno', Number(classi[0].n) === 2);
await ora('2026-11-20 10:00:00+01');

// ---------------------------------------------------------------------------
gruppo = 'Revoca e uscita';
r = await rpc('alunni_esci', { p_token: sC });
r = await rpc('alunni_lavori', { p_token: sC });
prova('Dopo «Esci» il token non vale più', !r.ok && r.hint === 'sessione');
const nuovoCodiceB = val(await rpc('alunni_docente_codice', { p_token: tok, p_profilo_id: id.BIANCHIB }), 'alunni_docente_codice');
r = await rpc('alunni_lavori', { p_token: sB });
prova('Codice sostituito: la vecchia sessione cade', !r.ok && r.hint === 'sessione');
prova('Codice sostituito: il vecchio codice non entra', val(await rpc('alunni_accesso', { p_codice: codici.BIANCHIB }), 'esito') === 'non_riconosciuto');
prova('Codice sostituito: il nuovo entra', val(await rpc('alunni_accesso', { p_codice: nuovoCodiceB }), 'esito') === 'ok');
await rpc('alunni_docente_revoca', { p_token: tok, p_profilo_id: id.GIALLIG });
prova('Codice revocato: stessa risposta di un codice errato', val(await rpc('alunni_accesso', { p_codice: codici.GIALLIG }), 'esito') === 'non_riconosciuto');
prova('Revoca e sostituzione non toccano i lavori', Number((await sql(`select count(*) n from public.progress where profilo_id is not null`))[0].n) >= 3);
await db.exec(`update private.alunni_sessioni set scade_il = now() - interval '1 minute' where profilo_id = '${id.ROSSIA}'`);
r = await rpc('alunni_lavoro_salva', { p_token: sA, p_page_path: PAG.ripasso, p_data: { r1: 'x' }, p_versione: null });
prova('Sessione scaduta: nessun salvataggio', !r.ok && r.hint === 'sessione');

// ---------------------------------------------------------------------------
gruppo = 'Sospensione';
const sA2 = val(await rpc('alunni_accesso', { p_codice: codici.ROSSIA }), 'token');
await rpc('alunni_docente_ingresso', { p_token: tok, p_attivo: false });
prova('Ingresso sospeso: niente nuovi accessi', val(await rpc('alunni_accesso', { p_codice: codici.ROSSIA }), 'esito') === 'non_disponibile');
r = await rpc('alunni_lavori', { p_token: sA2 });
prova('Ingresso sospeso: le sessioni aperte si fermano', !r.ok && r.hint === 'non_disponibile');
r = await rpc('progress_carica', { p_student_code: 'ROSSIA', p_page_path: PAG.percorsi });
const s2 = await rpc('progress_salva', { p_class_code: '3SB', p_student_code: 'ROSSIA', p_page_path: PAG.percorsi, p_data: { p1: 'riapertura?' } });
prova('Ingresso sospeso: i lavori protetti NON tornano al vecchio accesso', r.ok && r.rows[0].progress_carica === null && !s2.ok);
await rpc('alunni_docente_ingresso', { p_token: tok, p_attivo: true });

// ---------------------------------------------------------------------------
gruppo = 'Viste docente esistenti';
const elenco = (await rpc('progress_docente_elenco_con_anno', { p_token: tok, p_limite: 1000 })).rows;
const ids = elenco.map(x => x.id);
prova('I nuovi lavori compaiono nella vista docente una volta sola', new Set(ids).size === ids.length && ids.includes(idA));
r = uno(await rpc('progress_docente_dettaglio', { p_token: tok, p_id: idA }));
prova('Il docente apre il dettaglio di un lavoro protetto', r?.progress_docente_dettaglio?.p1 !== undefined);

// ---------------------------------------------------------------------------
gruppo = 'Limite dei tentativi';
for (let i = 0; i < 40; i++) await rpc('alunni_accesso', { p_codice: `ZZZZ-ZZZZ-ZZZZ-${String(i).padStart(4, '0')}` }, { ip: '203.0.113.9' });
prova('Dopo 40 errori dalla stessa rete in 15 minuti: blocco temporaneo',
    val(await rpc('alunni_accesso', { p_codice: codici.ROSSIA }, { ip: '203.0.113.9' }), 'esito') === 'troppi_tentativi');
prova('Un’altra rete non è bloccata', val(await rpc('alunni_accesso', { p_codice: codici.ROSSIA }, { ip: '198.51.100.7' }), 'esito') === 'ok');

// ---------------------------------------------------------------------------
const falliti = esiti.filter(e => !e.ok);
const righe = esiti.map(e => `| ${e.gruppo} | ${e.nome} | ${e.ok ? 'superata' : '**NON superata**'} | ${e.evidenza.replace(/\|/g, '/')} |`);
const versione = (await sql('select version() v'))[0].v.split(' on ')[0];
writeFileSync(join(qui, 'ESITO-COLLAUDO-DB.md'), `# Collaudo database dell’Area alunni

Ambiente: ${versione}, in memoria, con la struttura remota ricostruita in \`baseline.sql\` e dati inventati.
Comando: \`cd supabase/test && npm install && node area-alunni.test.mjs\`. Eseguito il ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}.
Esito: ${esiti.length - falliti.length} prove superate su ${esiti.length}.

Il progetto remoto usa Postgres 17: il collaudo locale non sostituisce la prova sul backend reale,
che va fatta solo dopo l’autorizzazione della migrazione.

| Gruppo | Prova | Esito | Evidenza |
| --- | --- | --- | --- |
${righe.join('\n')}
`);
console.log(`\n${esiti.length - falliti.length}/${esiti.length} prove superate`);
process.exit(falliti.length ? 1 : 0);
