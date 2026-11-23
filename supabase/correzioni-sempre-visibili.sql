-- Correzioni sempre visibili all'alunno (decisione del titolare, 23/11/2026).
-- Applicato in produzione il 23/11/2026 con execute_sql.
--
-- 1. public.verifiche_docente_salva: ogni salvataggio scrive anche la versione pubblicata
--    (pubblicata = bozza, pubblicata_il = now()). p_mostra resta nella firma ed è ignorato.
--    Corpo completo come in verifiche-correzione.sql, con questo blocco al posto dell'insert:
--
--    insert into private.verifiche_correzioni as c (progress_id, bozza, pubblicata, revisione, pubblicata_il)
--    values (p_id, p_bozza, p_bozza, 1, now())
--    on conflict (progress_id) do update
--       set bozza = excluded.bozza, pubblicata = excluded.bozza, pubblicata_il = now(),
--           revisione = c.revisione + 1, aggiornata_il = now();
--
-- 2. Le 62 correzioni salvate fino ad allora (tutte riservate) sono state rese visibili:
update private.verifiche_correzioni set pubblicata = bozza, pubblicata_il = now(), revisione = revisione + 1
 where pubblicata is null or pubblicata is distinct from bozza;
--
-- 3. public.verifica_operatore_restituzione_salva (verifica «L'operatore sociale» di terza): prima di
--    «if p_mostra then» si è aggiunto
--        if compilate = 5 then p_mostra := true; end if;
--    così la correzione con tutti e cinque i punteggi è sempre visibile.
--
-- 4. Regola nel database (23/11/2026, dopo che un'altra sessione aveva scritto correzioni riservate
--    direttamente nella tabella): qualunque inserimento o aggiornamento rende visibile la correzione.
create or replace function private.verifiche_correzioni_sempre_visibili()
returns trigger language plpgsql set search_path to '' as $$
begin
    if new.pubblicata is distinct from new.bozza then
        new.pubblicata := new.bozza;
        new.pubblicata_il := now();
    end if;
    return new;
end;
$$;
create or replace trigger sempre_visibili before insert or update on private.verifiche_correzioni
    for each row execute function private.verifiche_correzioni_sempre_visibili();
