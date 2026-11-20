-- Ricostruzione locale dello stato remoto al 20/11/2026 (sola struttura, nessun dato reale).
-- Fonte: lettura in sola lettura del progetto «Scuola e presenza online» (ruplzgcnheddmqqdephp):
-- colonne, vincoli e definizioni pg_get_functiondef delle funzioni usate dal sito.
-- Serve soltanto a collaudare supabase/area-alunni.sql in PGlite.

create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema private;
revoke all on schema private from public;
grant usage on schema public to anon, authenticated, service_role;

create function private.progress_school_year(p_at timestamptz)
returns integer language sql immutable strict set search_path to '' as $$
    select extract(year from (p_at at time zone 'Europe/Rome') - interval '8 months')::integer;
$$;

create table public.progress (
    id uuid primary key default gen_random_uuid(),
    class_code text not null,
    student_code text not null,
    page_path text not null,
    data jsonb not null default '{}'::jsonb,
    updated_at timestamptz default now(),
    school_year integer default private.progress_school_year(now()),
    constraint progress_year_student_page_key unique (school_year, student_code, page_path)
);
alter table public.progress enable row level security;
-- Come in remoto: privilegi di tabella presenti, nessuna policy (RLS nega tutto).
grant all on public.progress to anon, authenticated;

create table private.progress_docente_config (singleton boolean primary key default true, password_hash text, aggiornato_il timestamptz default now());
create table private.progress_docente_sessioni (token_hash text primary key, creata_il timestamptz default now(), scade_il timestamptz, ultimo_uso timestamptz default now());
create table private.progress_docente_tentativi (id bigint generated always as identity primary key, avvenuto_il timestamptz default now(), riuscito boolean);
create table private.progress_conteggi (id uuid primary key, updated_at timestamptz, compilati integer, totali integer);
-- Password docente fittizia del solo collaudo.
insert into private.progress_docente_config (password_hash)
values (extensions.crypt('password-di-collaudo', extensions.gen_salt('bf', 4)));

create function private.progress_docente_password_ok(p_password text)
returns boolean language sql stable security definer set search_path to '' as $$
    select coalesce((
        select case
            when c.password_hash like 'sha256:%'
                then encode(extensions.digest(lower(btrim(coalesce(p_password, ''))), 'sha256'), 'hex') = substr(c.password_hash, 8)
            else extensions.crypt(btrim(coalesce(p_password, '')), c.password_hash) = c.password_hash
        end
        from private.progress_docente_config c where c.singleton), false);
$$;

create function private.progress_docente_sessione_ok(p_token text)
returns boolean language plpgsql security definer set search_path to '' as $$
declare v_hash text;
begin
    if p_token is null or length(p_token) < 32 then return false; end if;
    v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
    update private.progress_docente_sessioni set ultimo_uso = now() where token_hash = v_hash and scade_il > now();
    return found;
end;
$$;

create function public.progress_docente_accesso(p_password text)
returns table(token text, scade_il timestamptz) language plpgsql security definer set search_path to '' as $$
declare v_falliti int; v_token text; v_scade timestamptz := now() + interval '6 hours';
begin
    select count(*) into v_falliti from private.progress_docente_tentativi t
     where not t.riuscito and t.avvenuto_il > now() - interval '15 minutes';
    if v_falliti >= 10 then raise exception 'troppi tentativi: riprova tra 15 minuti' using errcode = '42501'; end if;
    if not private.progress_docente_password_ok(p_password) then
        insert into private.progress_docente_tentativi (riuscito) values (false);
        raise exception 'password non corretta' using errcode = '28P01';
    end if;
    insert into private.progress_docente_tentativi (riuscito) values (true);
    delete from private.progress_docente_sessioni s where s.scade_il < now();
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    insert into private.progress_docente_sessioni (token_hash, scade_il)
    values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_scade);
    return query select v_token, v_scade;
end;
$$;

create function private.progress_conta(p_data jsonb, out totali integer, out compilati integer)
returns record language sql immutable set search_path to '' as $$
    with pulito as (
        select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb) as d
          from jsonb_each(case when jsonb_typeof(p_data) = 'object' then p_data else '{}'::jsonb end) e(k, v)
         where e.k not like '\_%'
    ), foglie as (
        select x from pulito, jsonb_path_query(pulito.d, 'strict $.**') x
         where jsonb_typeof(x) in ('string', 'number', 'boolean')
    )
    select count(*)::int,
           count(*) filter (where (jsonb_typeof(x) = 'string' and btrim(x #>> '{}') <> '')
                               or jsonb_typeof(x) = 'number' or x = 'true'::jsonb)::int
      from foglie;
$$;

create function public.progress_carica(p_student_code text, p_page_path text)
returns jsonb language sql stable security definer set search_path to '' as $$
    select p.data from public.progress p
    where p.school_year = private.progress_school_year(statement_timestamp())
      and p.student_code = p_student_code and p.page_path = p_page_path;
$$;

create function public.progress_salva(p_class_code text, p_student_code text, p_page_path text, p_data jsonb)
returns void language plpgsql security definer set search_path to '' as $$
declare saved_at timestamptz := statement_timestamp();
begin
    if coalesce(btrim(p_student_code), '') = '' or length(p_student_code) > 60 then raise exception 'codice studente non valido' using errcode = '22023'; end if;
    if coalesce(btrim(p_page_path), '') = '' or length(p_page_path) > 300 then raise exception 'pagina non valida' using errcode = '22023'; end if;
    if p_class_code is not null and length(p_class_code) > 40 then raise exception 'classe non valida' using errcode = '22023'; end if;
    if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'dati non validi' using errcode = '22023'; end if;
    insert into public.progress (class_code, student_code, page_path, data, updated_at, school_year)
    values (p_class_code, p_student_code, p_page_path, p_data, saved_at, private.progress_school_year(saved_at))
    on conflict (school_year, student_code, page_path)
    do update set class_code = excluded.class_code, data = excluded.data, updated_at = excluded.updated_at;
end;
$$;

create function public.progress_docente_elenco_con_anno(p_token text, p_limite integer default 1000)
returns table (id uuid, class_code text, student_code text, page_path text, updated_at timestamptz, meta jsonb, school_year integer)
language plpgsql security definer set search_path to '' as $$
begin
    if private.progress_docente_sessione_ok(p_token) is not true then raise exception 'sessione docente scaduta' using errcode = '42501'; end if;
    return query select p.id, p.class_code, p.student_code, p.page_path, p.updated_at, p.data -> '_meta', p.school_year
        from public.progress p order by p.updated_at desc nulls last, p.id
        limit greatest(1, least(coalesce(p_limite, 1000), 5000));
end;
$$;

create function public.progress_docente_dettaglio(p_token text, p_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
    if not private.progress_docente_sessione_ok(p_token) then raise exception 'sessione docente scaduta' using errcode = '42501'; end if;
    return (select p.data from public.progress p where p.id = p_id);
end;
$$;

revoke all on function public.progress_carica(text, text), public.progress_salva(text, text, text, jsonb),
    public.progress_docente_accesso(text), public.progress_docente_elenco_con_anno(text, integer),
    public.progress_docente_dettaglio(text, uuid) from public;
grant execute on function public.progress_carica(text, text), public.progress_salva(text, text, text, jsonb),
    public.progress_docente_accesso(text), public.progress_docente_elenco_con_anno(text, integer),
    public.progress_docente_dettaglio(text, uuid) to anon, authenticated, service_role;
revoke all on function private.progress_conta(jsonb),
    private.progress_docente_password_ok(text), private.progress_docente_sessione_ok(text) from public;
