-- Area docente: abbinamenti dei codici alunni condivisi fra dispositivi.
-- Migrazione «docente_abbinamenti_codici», novembre 2026.
--
-- Nella «Verifica codici» il docente attribuisce i lavori salvati con un codice digitato male al
-- codice giusto (es. karim → karimk), per una classe e un anno scolastico. Fino a questa migrazione
-- l'abbinamento stava solo nel browser (localStorage «mo:docente-code-links»); ora sta qui e vale
-- da ogni dispositivo. Ogni abbinamento collega due salvataggi di public.progress con il loro id,
-- come faceva il browser. La tabella è nello schema private: si legge e si scrive solo con le
-- funzioni qui sotto, che chiedono la sessione docente come le progress_docente_*.

create table if not exists private.docente_abbinamenti (
    anno text not null check (anno ~ '^[0-9]{4}$'),
    class_code text not null check (length(class_code) between 1 and 40),
    da_id uuid not null,
    a_id uuid not null check (a_id <> da_id),
    creato_il timestamptz not null default now(),
    primary key (anno, class_code, da_id)
);
alter table private.docente_abbinamenti enable row level security;
revoke all on private.docente_abbinamenti from public, anon, authenticated;

create or replace function public.docente_abbinamenti_elenco(p_token text)
returns table(anno text, class_code text, da_id uuid, a_id uuid)
language plpgsql security definer set search_path to ''
as $$
begin
    if not private.progress_docente_sessione_ok(p_token) then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    return query select x.anno, x.class_code, x.da_id, x.a_id
                   from private.docente_abbinamenti x order by x.creato_il;
end;
$$;

-- Aggiunge un abbinamento; se lo stesso codice di partenza era già abbinato, non cambia nulla.
create or replace function public.docente_abbinamento_aggiungi(p_token text, p_anno text, p_class_code text, p_da uuid, p_a uuid)
returns boolean
language plpgsql security definer set search_path to ''
as $$
begin
    if not private.progress_docente_sessione_ok(p_token) then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    if not exists (select 1 from public.progress where id = p_da)
       or not exists (select 1 from public.progress where id = p_a) then
        raise exception 'salvataggio non trovato' using errcode = 'P0002';
    end if;
    insert into private.docente_abbinamenti (anno, class_code, da_id, a_id)
    values (p_anno, p_class_code, p_da, p_a)
    on conflict do nothing;
    return found;
end;
$$;

create or replace function public.docente_abbinamento_rimuovi(p_token text, p_anno text, p_class_code text, p_da uuid)
returns void
language plpgsql security definer set search_path to ''
as $$
begin
    if not private.progress_docente_sessione_ok(p_token) then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    delete from private.docente_abbinamenti
     where anno = p_anno and class_code = p_class_code and da_id = p_da;
end;
$$;

revoke all on function public.docente_abbinamenti_elenco(text) from public;
revoke all on function public.docente_abbinamento_aggiungi(text, text, text, uuid, uuid) from public;
revoke all on function public.docente_abbinamento_rimuovi(text, text, text, uuid) from public;
grant execute on function public.docente_abbinamenti_elenco(text) to anon, authenticated;
grant execute on function public.docente_abbinamento_aggiungi(text, text, text, uuid, uuid) to anon, authenticated;
grant execute on function public.docente_abbinamento_rimuovi(text, text, text, uuid) to anon, authenticated;
