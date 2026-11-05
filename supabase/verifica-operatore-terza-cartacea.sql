alter table private.verifica_operatore_config add column modello_cartaceo bytea;

create function public.verifica_operatore_modello_cartaceo(p_token text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
    pdf bytea;
begin
    if private.progress_docente_sessione_ok(p_token) is not true then
        raise exception 'Sessione docente richiesta.' using errcode = '42501';
    end if;
    select modello_cartaceo into pdf from private.verifica_operatore_config where singleton;
    if pdf is null then
        raise exception 'Il modello cartaceo non è disponibile.' using errcode = 'P0002';
    end if;
    return encode(pdf, 'base64');
end;
$$;

revoke all on function public.verifica_operatore_modello_cartaceo(text) from public;
grant execute on function public.verifica_operatore_modello_cartaceo(text) to anon, authenticated;
