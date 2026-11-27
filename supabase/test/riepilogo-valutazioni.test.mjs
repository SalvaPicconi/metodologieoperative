// Collaudo del riepilogo sulla struttura PostgreSQL descritta dalle migrazioni del sito.
// Eseguire da supabase/test con Node dopo aver installato le dipendenze.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const leggi = nome => readFileSync(new URL(nome, import.meta.url), 'utf8');
const db = await PGlite.create({ extensions: { pgcrypto } });
try {
    await db.exec(leggi('baseline.sql'));
    await db.exec(`
        insert into public.progress(class_code, student_code, page_path, school_year, updated_at, data) values
            ('3SB','alunno','/esercizio-a.html',2026,'2026-11-25 10:00+01','{"_meta":{"percentuale":100},"testo":"RISPOSTA_PRIVATA"}'),
            ('3SB','alunno','/esercizio-c.html',2026,'2026-11-24 10:00+01','{}'),
            ('3SB','aluno','/esercizio-b.html',2026,'2026-11-23 10:00+01','{}'),
            ('3SB','secondo','/esercizio-a.html',2026,'2026-11-22 10:00+01','{}'),
            ('4SB','quarto','/esercizio-b.html',2026,'2026-10-20 10:00+02','{}'),
            ('2SB','alunno','/esercizio-b.html',2025,'2026-02-02 08:00+01','{}');
    `);
    for (const file of [
        'area-alunni.sql', 'verifiche-correzione.sql', 'verifica-operatore-terza.sql',
        'verifica-operatore-terza-cartacea.sql', 'verifica-operatore-terza-interattiva.sql',
        'verifica-operatore-terza-chiave-docente.sql', 'verifica-operatore-terza-commenti-docente.sql',
        'verifica-operatore-terza-restituzione.sql', 'docente-riepilogo-valutazioni.sql'
    ]) await db.exec(leggi('../' + file));

    await db.exec(`
        insert into private.verifiche_elenco values
            ('/esercizio-a.html','prova-a','Esercizio A'),
            ('/esercizio-b.html','prova-b','Esercizio B');
        insert into private.verifiche_correzioni(progress_id, bozza, pubblicata)
        select id, '{"voto":"10"}',
               '{"voto":"8","competenza":{"codice":"C5","livello":"B"},"nota":"COMMENTO_PRIVATO"}'
        from public.progress where student_code='alunno' and page_path='/esercizio-a.html';
        insert into private.verifiche_correzioni(progress_id, bozza)
        select id, '{"voto":"10"}' from public.progress where student_code='aluno';
        insert into private.verifiche_correzioni(progress_id, bozza, pubblicata)
        select id, '{"nota":"Attività da completare."}', '{"nota":"Attività da completare."}'
        from public.progress where student_code='secondo';
        insert into private.verifica_operatore_edizioni(numero,sezioni)
            values (1,'[]'), (3,'[]'), (4,'[]') on conflict (numero) do nothing;
        insert into private.verifica_operatore_elaborati(classe,codice,chiave_hash,edizione,aggiornato_il,consegnato_il)
            values ('3sb','alunno',decode('01','hex'),3,'2026-11-06 11:00+01','2026-11-06 11:00+01'),
                   ('3sa','fittizio',decode('02','hex'),4,'2026-11-07 11:00+01',null),
                   ('3sb','storico',decode('03','hex'),1,'2025-11-15 11:00+01','2025-11-15 11:00+01');
        insert into private.verifica_operatore_restituzioni(elaborato_id,bozza,pubblicata)
        select id,'{"voto":10}','{"valutazione":{"voto":7}}'
        from private.verifica_operatore_elaborati where edizione=3;
    `);

    await db.exec('set role anon');
    await assert.rejects(db.query("select public.docente_riepilogo_valutazioni('token-non-valido')"),
        error => error.code === '42501');
    const { rows: [accesso] } = await db.query("select * from public.progress_docente_accesso('password-di-collaudo')");
    const { rows: [{ quadro }] } = await db.query('select public.docente_riepilogo_valutazioni($1, 1000) quadro', [accesso.token]);

    assert.equal(quadro.lavori.length, 6);
    const valutato = quadro.lavori.find(r => r.page_path === '/esercizio-a.html' && r.student_code === 'alunno');
    assert.deepEqual(valutato.valutazione, { stato: 'pubblicata', voto: '8', competenza: 'C5', livello: 'B' });
    assert.deepEqual(valutato.meta, { percentuale: 100 });
    const alias = quadro.lavori.find(r => r.student_code === 'aluno');
    assert.equal(alias.codice_confermato, 'ALUNNO');
    assert.equal(alias.valutazione.stato, 'bozza');
    assert.equal(alias.valutazione.voto, null);
    assert.equal(quadro.lavori.find(r => r.student_code === 'secondo').valutazione.stato, 'in_corso');
    assert.equal(quadro.lavori.find(r => r.school_year === 2025).class_code, '2SB');
    assert.equal(quadro.operatore.find(r => r.edizione === 3).valutazione.voto, '7');
    assert.equal(quadro.operatore.find(r => r.edizione === 4).valutazione.stato, 'in_corso');
    assert.equal(quadro.operatore.find(r => r.edizione === 1).valutazione.voto, null);
    assert.equal(quadro.operatore.find(r => r.edizione === 1).school_year, 2025);
    assert(!/RISPOSTA_PRIVATA|COMMENTO_PRIVATO/.test(JSON.stringify(quadro)));
    console.log('Riepilogo verificato: accesso docente, voti pubblicati, bozza esclusa, grafie collegate e verifiche A/B.');
} finally {
    await db.close();
}
