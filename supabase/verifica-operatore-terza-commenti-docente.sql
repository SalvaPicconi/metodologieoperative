set local lock_timeout = '5s';

create table private.verifica_operatore_commenti (
    elaborato_id uuid not null references private.verifica_operatore_elaborati(id) on delete cascade,
    quesito text not null,
    testo text not null check (char_length(testo) <= 1200),
    primary key (elaborato_id, quesito)
);
alter table private.verifica_operatore_commenti enable row level security;
revoke all on private.verifica_operatore_commenti from public, anon, authenticated;

create or replace function public.verifica_operatore_docente(p_token text, p_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
    if private.progress_docente_sessione_ok(p_token) is not true then
        raise exception 'Sessione docente richiesta.' using errcode = '42501';
    end if;
    if p_id is null then
        return coalesce((
            select jsonb_agg(jsonb_build_object('id', id, 'classe', classe, 'codice', codice, 'edizione', edizione,
                'consegnato_il', consegnato_il, 'aggiornato_il', aggiornato_il) order by classe, codice)
            from private.verifica_operatore_elaborati
        ), '[]'::jsonb);
    end if;
    return (
        select jsonb_build_object('classe', e.classe, 'codice', e.codice, 'risposte', e.risposte,
            'consegnato_il', e.consegnato_il, 'edizione', e.edizione, 'sezioni', c.sezioni,
            'chiave_scelte', c.chiave_scelte, 'commenti', coalesce((
                select jsonb_object_agg(f.quesito, f.testo)
                from private.verifica_operatore_commenti f where f.elaborato_id = e.id
            ), '{}'::jsonb))
        from private.verifica_operatore_elaborati as e
        join private.verifica_operatore_edizioni as c on c.numero = e.edizione
        where e.id = p_id
    );
end;
$$;

create function public.verifica_operatore_commento_salva(
    p_token text, p_id uuid, p_quesito text, p_testo text, p_precedente text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
    salvato text;
begin
    if private.progress_docente_sessione_ok(p_token) is not true then
        raise exception 'Sessione docente richiesta.' using errcode = '42501';
    end if;
    if p_testo is null or char_length(p_testo) > 1200 or p_precedente is null then
        raise exception 'Il commento deve contenere al massimo 1200 caratteri.' using errcode = '22023';
    end if;
    if not exists (
        select 1 from private.verifica_operatore_elaborati e
        join private.verifica_operatore_edizioni d on d.numero = e.edizione
        cross join lateral jsonb_array_elements(d.sezioni) s
        cross join lateral jsonb_array_elements(s->'elementi') q
        where e.id = p_id and e.consegnato_il is not null
          and q->>'id' = p_quesito and not (q ? 'opzioni') and coalesce(q->>'tipo', '') <> 'rete'
    ) then
        raise exception 'Il commento richiede una domanda aperta di una prova consegnata.' using errcode = '22023';
    end if;
    insert into private.verifica_operatore_commenti as f (elaborato_id, quesito, testo)
    values (p_id, p_quesito, btrim(p_testo))
    on conflict (elaborato_id, quesito) do update set testo = excluded.testo
        where f.testo = p_precedente or f.testo = excluded.testo
    returning testo into salvato;
    if not found then
        raise exception 'Il commento è stato aggiornato in un’altra scheda. Copia il tuo testo e riapri l’elaborato.' using errcode = '40001';
    end if;
    return salvato;
end;
$$;

revoke all on function public.verifica_operatore_commento_salva(text,uuid,text,text,text) from public;
grant execute on function public.verifica_operatore_commento_salva(text,uuid,text,text,text) to anon, authenticated;
