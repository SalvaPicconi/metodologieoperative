create function public.verifica_operatore_anteprima_docente(p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
    if private.progress_docente_sessione_ok(p_token) is not true then
        raise exception 'Sessione docente richiesta.' using errcode = '42501';
    end if;
    return (
        select jsonb_build_object('sezioni', c.sezioni, 'edizione', c.edizione)
        from private.verifica_operatore_config c where singleton
    );
end;
$$;

revoke all on function public.verifica_operatore_anteprima_docente(text) from public;
grant execute on function public.verifica_operatore_anteprima_docente(text) to anon, authenticated;
