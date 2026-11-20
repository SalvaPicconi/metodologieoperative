-- Metodologie Operative. L'anno scolastico è identificato dal suo anno iniziale.
-- Le chiamate delle pagine già pubblicate conservano firme e formato delle risposte.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.progress in access exclusive mode;

-- Copia dei valori prima della migrazione, esclusa dall'API e dai ruoli applicativi.
create table private.progress_backup_pre_anno_20261120 as
select id, class_code, student_code, page_path, data, updated_at from public.progress;
alter table private.progress_backup_pre_anno_20261120 enable row level security;
revoke all on table private.progress_backup_pre_anno_20261120 from public, anon, authenticated, service_role;

create function private.progress_school_year(p_at timestamptz)
returns integer
language sql
immutable
strict
set search_path to ''
as $$
    select extract(year from (p_at at time zone 'Europe/Rome') - interval '8 months')::integer;
$$;

alter table public.progress add column school_year integer;
update public.progress
set school_year = private.progress_school_year(updated_at)
where updated_at is not null;

-- I dati privi di data rimangono storici senza anno. I nuovi inserimenti
-- ricevono l'anno del server, anche se effettuati con strumenti amministrativi.
alter table public.progress alter column school_year set default private.progress_school_year(now());
alter table public.progress add constraint progress_year_student_page_key
    unique (school_year, student_code, page_path);
alter table public.progress drop constraint progress_student_code_page_path_key;
drop index public.progress_student_page_unique;

create or replace function public.progress_salva(
    p_class_code text, p_student_code text, p_page_path text, p_data jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
    saved_at timestamptz := statement_timestamp();
begin
    if coalesce(btrim(p_student_code), '') = '' or length(p_student_code) > 60 then
        raise exception 'codice studente non valido' using errcode = '22023';
    end if;
    if coalesce(btrim(p_page_path), '') = '' or length(p_page_path) > 300 then
        raise exception 'pagina non valida' using errcode = '22023';
    end if;
    if p_class_code is not null and length(p_class_code) > 40 then
        raise exception 'classe non valida' using errcode = '22023';
    end if;
    if p_data is null or jsonb_typeof(p_data) <> 'object' then
        raise exception 'dati non validi' using errcode = '22023';
    end if;
    insert into public.progress (class_code, student_code, page_path, data, updated_at, school_year)
    values (p_class_code, p_student_code, p_page_path, p_data, saved_at, private.progress_school_year(saved_at))
    on conflict (school_year, student_code, page_path)
    do update set class_code = excluded.class_code,
                  data = excluded.data,
                  updated_at = excluded.updated_at;
end;
$$;

create or replace function public.progress_carica(p_student_code text, p_page_path text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
    select p.data
    from public.progress p
    where p.school_year = private.progress_school_year(statement_timestamp())
      and p.student_code = p_student_code
      and p.page_path = p_page_path;
$$;

create or replace function public.progress_docente_classe(p_token text, p_class_code text, p_page_path text)
returns table (student_code text, data jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $$
begin
    if private.progress_docente_sessione_ok(p_token) is not true then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    return query
        select p.student_code, p.data, p.updated_at
        from public.progress p
        where p.school_year = private.progress_school_year(statement_timestamp())
          and lower(p.class_code) = lower(p_class_code)
          and p.page_path = p_page_path
        order by p.student_code
        limit 200;
end;
$$;

-- Nuova lettura per l'area docente. Le pagine in uso possono continuare
-- a chiamare progress_docente_elenco con il formato originale.
create function public.progress_docente_elenco_con_anno(p_token text, p_limite integer default 1000)
returns table (
    id uuid, class_code text, student_code text, page_path text, updated_at timestamptz,
    meta jsonb, school_year integer
)
language plpgsql
security definer
set search_path to ''
as $$
begin
    if private.progress_docente_sessione_ok(p_token) is not true then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    return query
        select p.id, p.class_code, p.student_code, p.page_path, p.updated_at, p.data -> '_meta', p.school_year
        from public.progress p
        order by p.updated_at desc nulls last, p.id
        limit greatest(1, least(coalesce(p_limite, 1000), 5000));
end;
$$;

revoke all on function public.progress_docente_elenco_con_anno(text, integer) from public;
grant execute on function public.progress_docente_elenco_con_anno(text, integer) to anon, authenticated, service_role;

-- Annulla tutta la transazione se un valore precedente è cambiato.
do $$
begin
    if exists (
        select 1
        from private.progress_backup_pre_anno_20261120 b
        full join public.progress p using (id)
        where b.id is null or p.id is null
           or (b.class_code, b.student_code, b.page_path, b.data, b.updated_at)
              is distinct from (p.class_code, p.student_code, p.page_path, p.data, p.updated_at)
           or p.school_year is distinct from private.progress_school_year(b.updated_at)
    ) then
        raise exception 'La migrazione altererebbe salvataggi preesistenti';
    end if;
end;
$$;

commit;
