-- Le funzioni per alunni restituiscono solo le sezioni, mai la chiave.
alter table private.verifica_operatore_edizioni
    add column chiave_scelte jsonb not null default '{}'::jsonb
    check (jsonb_typeof(chiave_scelte) = 'object');

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
            'chiave_scelte', c.chiave_scelte)
        from private.verifica_operatore_elaborati as e
        join private.verifica_operatore_edizioni as c on c.numero = e.edizione
        where e.id = p_id
    );
end;
$$;
