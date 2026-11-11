-- Area docente: compiti assegnati, elenchi delle classi e riepilogo dell'avanzamento.
-- Migrazione «area_docente_compiti», novembre 2026.
--
-- Come funziona
-- - Il docente assegna un compito (classe + pagina del sito + scadenza) e scrive l'elenco dei codici
--   studente di ogni classe, con eventuali codici sbagliati da ricondurre all'alunno giusto (alias).
-- - Le tabelle stanno nello schema private: il sito non le raggiunge. Si leggono e si scrivono solo
--   con le funzioni qui sotto, che chiedono il token della sessione docente come progress_docente_*.
-- - progress_docente_riepilogo restituisce i salvataggi senza il contenuto, con il conteggio dei
--   campi compilati: basta per le barre di avanzamento, le risposte si aprono con progress_docente_dettaglio.
-- - Gli studenti non vedono niente di tutto questo e il loro salvataggio non cambia.

create table if not exists private.docente_classi (
    class_code text primary key check (class_code ~ '^[a-z0-9]{1,12}$'),
    studenti jsonb not null default '[]'::jsonb check (jsonb_typeof(studenti) = 'array'),
    aggiornato_il timestamptz not null default now()
);

create table if not exists private.docente_compiti (
    id uuid primary key default gen_random_uuid(),
    class_code text not null check (class_code ~ '^[a-z0-9]{1,12}$'),
    page_path text not null check (page_path ~ '^/' and length(page_path) <= 300),
    titolo text not null check (length(btrim(titolo)) between 1 and 200),
    assegnato_il date not null default current_date,
    scadenza date,
    note text check (note is null or length(note) <= 2000),
    archiviato boolean not null default false,
    creato_il timestamptz not null default now(),
    aggiornato_il timestamptz not null default now()
);
create index if not exists docente_compiti_classe on private.docente_compiti (class_code, archiviato);

alter table private.docente_classi enable row level security;
alter table private.docente_compiti enable row level security;
revoke all on private.docente_classi, private.docente_compiti from public, anon, authenticated;

-- Campi compilati e campi totali di un salvataggio: si contano le foglie (testi, numeri, scelte)
-- escludendo le chiavi di servizio che iniziano con «_» (_meta, _activity…).
create or replace function private.progress_conta(p_data jsonb, out totali int, out compilati int)
language sql immutable set search_path to ''
as $$
    with pulito as (
        select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb) as d
          from jsonb_each(case when jsonb_typeof(p_data) = 'object' then p_data else '{}'::jsonb end) e(k, v)
         where e.k not like '\_%'
    ), foglie as (
        select x
          from pulito, jsonb_path_query(pulito.d, 'strict $.**') x
         where jsonb_typeof(x) in ('string', 'number', 'boolean')
    )
    select count(*)::int,
           count(*) filter (where (jsonb_typeof(x) = 'string' and btrim(x #>> '{}') <> '')
                               or jsonb_typeof(x) = 'number'
                               or x = 'true'::jsonb)::int
      from foglie;
$$;

create or replace function public.progress_docente_riepilogo(p_token text, p_dal timestamptz default null, p_limite int default 5000)
returns table(id uuid, class_code text, student_code text, page_path text, updated_at timestamptz,
              meta jsonb, compilati int, totali int)
language plpgsql security definer set search_path to ''
as $$
begin
    if not private.progress_docente_sessione_ok(p_token) then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    return query
        select p.id, p.class_code, p.student_code, p.page_path, p.updated_at, p.data -> '_meta',
               c.compilati, c.totali
          from public.progress p
          cross join lateral private.progress_conta(p.data) c
         where p_dal is null or p.updated_at >= p_dal
         order by p.updated_at desc nulls last
         limit greatest(1, least(coalesce(p_limite, 5000), 10000));
end;
$$;

create or replace function public.docente_classi_elenco(p_token text)
returns table(class_code text, studenti jsonb, aggiornato_il timestamptz)
language plpgsql security definer set search_path to ''
as $$
begin
    if not private.progress_docente_sessione_ok(p_token) then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    return query select c.class_code, c.studenti, c.aggiornato_il
                   from private.docente_classi c order by c.class_code;
end;
$$;

-- p_studenti: [{"codice": "rossim", "alias": ["rossi"]}, …]. Un elenco vuoto cancella la classe.
create or replace function public.docente_classe_salva(p_token text, p_class_code text, p_studenti jsonb)
returns void
language plpgsql security definer set search_path to ''
as $$
declare
    v_classe text := lower(btrim(coalesce(p_class_code, '')));
    v_puliti jsonb;
begin
    if not private.progress_docente_sessione_ok(p_token) then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    if v_classe !~ '^[a-z0-9]{1,12}$' then
        raise exception 'codice classe non valido' using errcode = '22023';
    end if;
    if p_studenti is null or jsonb_typeof(p_studenti) <> 'array' then
        raise exception 'elenco studenti non valido' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
               'codice', s.codice,
               'alias', coalesce((select jsonb_agg(distinct lower(btrim(a)))
                                    from jsonb_array_elements_text(coalesce(s.voce -> 'alias', '[]'::jsonb)) a
                                   where btrim(a) <> '' and lower(btrim(a)) <> s.codice), '[]'::jsonb))
             order by s.codice), '[]'::jsonb)
      into v_puliti
      from (select distinct on (lower(btrim(v ->> 'codice'))) lower(btrim(v ->> 'codice')) as codice, v as voce
              from jsonb_array_elements(p_studenti) v
             where jsonb_typeof(v) = 'object' and btrim(coalesce(v ->> 'codice', '')) <> '') s;
    if jsonb_array_length(v_puliti) > 60 then
        raise exception 'troppi studenti in una classe' using errcode = '22023';
    end if;
    if jsonb_array_length(v_puliti) = 0 then
        delete from private.docente_classi where class_code = v_classe;
        return;
    end if;
    insert into private.docente_classi (class_code, studenti, aggiornato_il)
    values (v_classe, v_puliti, now())
    on conflict (class_code) do update set studenti = excluded.studenti, aggiornato_il = now();
end;
$$;

create or replace function public.docente_compiti_elenco(p_token text)
returns table(id uuid, class_code text, page_path text, titolo text, assegnato_il date, scadenza date,
              note text, archiviato boolean, aggiornato_il timestamptz)
language plpgsql security definer set search_path to ''
as $$
begin
    if not private.progress_docente_sessione_ok(p_token) then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    return query select c.id, c.class_code, c.page_path, c.titolo, c.assegnato_il, c.scadenza,
                        c.note, c.archiviato, c.aggiornato_il
                   from private.docente_compiti c
                  order by c.archiviato, c.scadenza nulls last, c.assegnato_il desc;
end;
$$;

-- Nuovo compito con p_id null, altrimenti modifica di quello esistente.
create or replace function public.docente_compito_salva(p_token text, p_id uuid, p_class_code text, p_page_path text,
                                                       p_titolo text, p_assegnato_il date, p_scadenza date, p_note text)
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare
    v_id uuid;
begin
    if not private.progress_docente_sessione_ok(p_token) then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    if p_id is null then
        insert into private.docente_compiti (class_code, page_path, titolo, assegnato_il, scadenza, note)
        values (lower(btrim(p_class_code)), btrim(p_page_path), btrim(p_titolo),
                coalesce(p_assegnato_il, current_date), p_scadenza, nullif(btrim(coalesce(p_note, '')), ''))
        returning id into v_id;
    else
        update private.docente_compiti
           set class_code = lower(btrim(p_class_code)), page_path = btrim(p_page_path), titolo = btrim(p_titolo),
               assegnato_il = coalesce(p_assegnato_il, assegnato_il), scadenza = p_scadenza,
               note = nullif(btrim(coalesce(p_note, '')), ''), aggiornato_il = now()
         where id = p_id
        returning id into v_id;
        if v_id is null then
            raise exception 'compito non trovato' using errcode = 'P0002';
        end if;
    end if;
    return v_id;
end;
$$;

create or replace function public.docente_compito_archivia(p_token text, p_id uuid, p_archiviato boolean)
returns void
language plpgsql security definer set search_path to ''
as $$
begin
    if not private.progress_docente_sessione_ok(p_token) then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    update private.docente_compiti set archiviato = coalesce(p_archiviato, true), aggiornato_il = now() where id = p_id;
end;
$$;

-- Cancella solo l'assegnazione: le risposte degli studenti restano in progress.
create or replace function public.docente_compito_elimina(p_token text, p_id uuid)
returns void
language plpgsql security definer set search_path to ''
as $$
begin
    if not private.progress_docente_sessione_ok(p_token) then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    delete from private.docente_compiti where id = p_id;
end;
$$;

revoke all on function private.progress_conta(jsonb) from public, anon, authenticated;
revoke all on function public.progress_docente_riepilogo(text, timestamptz, int) from public;
revoke all on function public.docente_classi_elenco(text) from public;
revoke all on function public.docente_classe_salva(text, text, jsonb) from public;
revoke all on function public.docente_compiti_elenco(text) from public;
revoke all on function public.docente_compito_salva(text, uuid, text, text, text, date, date, text) from public;
revoke all on function public.docente_compito_archivia(text, uuid, boolean) from public;
revoke all on function public.docente_compito_elimina(text, uuid) from public;
grant execute on function public.progress_docente_riepilogo(text, timestamptz, int) to anon, authenticated;
grant execute on function public.docente_classi_elenco(text) to anon, authenticated;
grant execute on function public.docente_classe_salva(text, text, jsonb) to anon, authenticated;
grant execute on function public.docente_compiti_elenco(text) to anon, authenticated;
grant execute on function public.docente_compito_salva(text, uuid, text, text, text, date, date, text) to anon, authenticated;
grant execute on function public.docente_compito_archivia(text, uuid, boolean) to anon, authenticated;
grant execute on function public.docente_compito_elimina(text, uuid) to anon, authenticated;

-- Migrazione «area_docente_conteggi_cache»: contare i campi su tutti i salvataggi a ogni apertura
-- richiedeva più di 20 secondi. I conteggi stanno in una cache privata, aggiornata a ogni apertura
-- dell'area docente per i soli salvataggi nuovi o cambiati (al massimo 40 per volta).
create table if not exists private.progress_conteggi (
    id uuid primary key,
    updated_at timestamptz,
    compilati int not null,
    totali int not null
);
alter table private.progress_conteggi enable row level security;
revoke all on private.progress_conteggi from public, anon, authenticated;

create or replace function private.progress_conteggi_aggiorna(p_max int default 80)
returns int
language plpgsql security definer set search_path to ''
as $$
declare
    v_n int;
begin
    with da_fare as materialized (
        select p.id, p.updated_at, p.data
          from public.progress p
          left join private.progress_conteggi k on k.id = p.id
         where k.id is null or k.updated_at is distinct from p.updated_at
         order by p.updated_at desc nulls last
         limit greatest(1, p_max)
    )
    insert into private.progress_conteggi (id, updated_at, compilati, totali)
    select d.id, d.updated_at, c.compilati, c.totali
      from da_fare d cross join lateral private.progress_conta(d.data) c
    on conflict (id) do update
       set updated_at = excluded.updated_at, compilati = excluded.compilati, totali = excluded.totali;
    get diagnostics v_n = row_count;
    return v_n;
end;
$$;
revoke all on function private.progress_conteggi_aggiorna(int) from public, anon, authenticated;

-- Sostituisce la versione sopra: legge i conteggi dalla cache.
create or replace function public.progress_docente_riepilogo(p_token text, p_dal timestamptz default null, p_limite int default 5000)
returns table(id uuid, class_code text, student_code text, page_path text, updated_at timestamptz,
              meta jsonb, compilati int, totali int)
language plpgsql security definer set search_path to ''
as $$
begin
    if not private.progress_docente_sessione_ok(p_token) then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    perform private.progress_conteggi_aggiorna(40);
    return query
        select p.id, p.class_code, p.student_code, p.page_path, p.updated_at, p.data -> '_meta',
               k.compilati, k.totali
          from public.progress p
          left join private.progress_conteggi k on k.id = p.id and k.updated_at is not distinct from p.updated_at
         where p_dal is null or p.updated_at >= p_dal
         order by p.updated_at desc nulls last
         limit greatest(1, least(coalesce(p_limite, 5000), 10000));
end;
$$;
-- Il primo riempimento della cache si è fatto una volta a mano: select private.progress_conteggi_aggiorna(400);
