-- Metodologie Operative · Area «I miei lavori»
-- Decisione del titolare (20/11/2026): gli alunni entrano con la classe e il codice che usano già nelle
-- attività (cognome + iniziale). Niente codici nuovi. Le varianti scritte male dello stesso codice si
-- unificano in automatico quando i dati lo consentono; i casi dubbi restano al docente.
-- Collaudo locale: supabase/test/area-alunni.test.mjs (PGlite, dati inventati).
--
-- Che cosa aggiunge
-- - Profili alunno che attraversano gli anni, classi per anno, iscrizioni con il codice principale,
--   varianti (codice e classe scritti male), sessioni (solo impronta del token), registro minimo.
-- - Una colonna facoltativa public.progress.profilo_id per le attribuzioni fatte a mano dal docente.
-- - Funzioni alunni_* (alunno) e alunni_docente_* (docente con la sessione esistente).
--
-- Che cosa NON fa
-- - Non cambia progress_carica, progress_salva né alcun salvataggio esistente: il vecchio accesso dalle
--   attività funziona come prima. L'area è un modo in più per ritrovare e riprendere i lavori.
-- - Con questa scelta chi conosce classe e codice di un compagno può aprirne i lavori, come già oggi
--   dalle attività (limite accettato dal titolare).
begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

lock table public.progress in share row exclusive mode;

-- Copia di sicurezza dei salvataggi prima della migrazione, nello schema privato, esclusa dall'API.
create table private.progress_backup_pre_area_alunni_20261120 as
select id, class_code, student_code, page_path, data, updated_at, school_year from public.progress;
alter table private.progress_backup_pre_area_alunni_20261120 enable row level security;
revoke all on table private.progress_backup_pre_area_alunni_20261120 from public, anon, authenticated, service_role;

create temporary table _area_alunni_prima on commit drop as
select count(*) as righe,
       md5(coalesce(string_agg(
           id::text || '|' || class_code || '|' || student_code || '|' || page_path || '|' ||
           data::text || '|' || coalesce(updated_at::text, '') || '|' || coalesce(school_year::text, ''),
           E'\n' order by id), '')) as impronta
from public.progress;

-- ---------------------------------------------------------------------------
-- 1. Normalizzazioni
-- ---------------------------------------------------------------------------
create function private.alunni_percorso(p_path text)
returns text language sql immutable strict set search_path to '' as $$
    -- Come assets/progress.js: senza dominio, query, frammento, prefisso /metodologieoperative e barra finale.
    select case when q = '' then '/' else q end
    from (select regexp_replace(
                 regexp_replace(
                     regexp_replace(split_part(split_part(p_path, '?', 1), '#', 1), '^https?://[^/]+', ''),
                     '^/metodologieoperative(/|$)', '/'),
                 '(.)/$', '\1') as q) s;
$$;

create function private.alunni_codice(p text)
returns text language sql immutable set search_path to '' as $$
    select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create function private.alunni_sigla(p text)
returns text language sql immutable set search_path to '' as $$
    select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create function private.alunni_simili(a text, b text)
returns boolean language plpgsql immutable strict set search_path to '' as $$
declare
    prev integer[]; cur integer[]; la integer := length(a); lb integer := length(b); i integer; j integer;
begin
    -- Una lettera in più, in meno o diversa, oppure due lettere vicine scambiate.
    if a = b or abs(la - lb) > 1 or la < 3 or lb < 3 then return false; end if;
    if la = lb then
        for i in 1..la - 1 loop
            if substr(a, 1, i - 1) || substr(a, i + 1, 1) || substr(a, i, 1) || substr(a, i + 2) = b then
                return true;
            end if;
        end loop;
    end if;
    prev := array(select generate_series(0, lb));
    for i in 1..la loop
        cur := array[i];
        for j in 1..lb loop
            cur := cur || least(prev[j + 1] + 1, cur[j] + 1,
                                prev[j] + case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end);
        end loop;
        prev := cur;
    end loop;
    return prev[lb + 1] = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Tabelle private
-- ---------------------------------------------------------------------------
create table private.alunni_config (
    singleton boolean primary key default true check (singleton),
    ingresso_attivo boolean not null default true,
    durata_sessione interval not null default interval '8 hours',
    aggiornato_il timestamptz not null default now()
);
insert into private.alunni_config default values;

create table private.alunni_pagine (
    page_path text primary key check (page_path ~ '^/' and page_path = private.alunni_percorso(page_path)),
    titolo text not null,
    abilitata boolean not null default false,
    aggiornato_il timestamptz not null default now()
);

create table private.alunni_profili (
    id uuid primary key default gen_random_uuid(),
    creato_il timestamptz not null default now()
);

create table private.alunni_classi (
    id uuid primary key default gen_random_uuid(),
    school_year integer not null check (school_year between 2020 and 2100),
    sigla text not null check (sigla ~ '^[1-5][A-Z]{1,4}$'),
    unique (school_year, sigla),
    unique (id, school_year)
);

create table private.alunni_iscrizioni (
    id uuid primary key default gen_random_uuid(),
    profilo_id uuid not null references private.alunni_profili (id),
    classe_id uuid not null,
    school_year integer not null,
    codice text not null check (codice ~ '^[A-Z0-9]{2,60}$'),
    creata_il timestamptz not null default now(),
    foreign key (classe_id, school_year) references private.alunni_classi (id, school_year),
    unique (profilo_id, school_year),
    unique (classe_id, codice)
);

-- Altre grafie dello stesso alunno nello stesso anno: codice scritto male e/o classe scritta male.
create table private.alunni_varianti (
    id uuid primary key default gen_random_uuid(),
    iscrizione_id uuid not null references private.alunni_iscrizioni (id) on delete cascade,
    classe text not null,
    codice text not null,
    stato text not null default 'unita' check (stato in ('unita', 'separata')),
    origine text not null check (origine in ('automatica', 'docente')),
    motivo text,
    creata_il timestamptz not null default now(),
    unique (iscrizione_id, classe, codice)
);

create table private.alunni_sessioni (
    token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
    profilo_id uuid not null references private.alunni_profili (id),
    creata_il timestamptz not null default now(),
    scade_il timestamptz not null,
    revocata_il timestamptz
);

create table private.alunni_tentativi (
    id bigint generated always as identity primary key,
    avvenuto_il timestamptz not null default now(),
    riuscito boolean not null,
    origine text not null
);

create table private.alunni_registro (
    id bigint generated always as identity primary key,
    avvenuto_il timestamptz not null default now(),
    azione text not null,
    profilo_id uuid,
    progress_id uuid,
    dettagli jsonb not null default '{}'::jsonb,
    sessione_docente text
);

-- Attribuzione a mano (docente) di un lavoro che le regole automatiche non riconoscono.
alter table public.progress add column profilo_id uuid references private.alunni_profili (id);
comment on column public.progress.profilo_id is 'Attribuzione confermata dal docente nell''Area alunni; non cambia il vecchio accesso.';
create index progress_anno_classe_codice
    on public.progress (school_year, private.alunni_sigla(class_code), private.alunni_codice(student_code));

alter table private.alunni_config enable row level security;
alter table private.alunni_pagine enable row level security;
alter table private.alunni_profili enable row level security;
alter table private.alunni_classi enable row level security;
alter table private.alunni_iscrizioni enable row level security;
alter table private.alunni_varianti enable row level security;
alter table private.alunni_sessioni enable row level security;
alter table private.alunni_tentativi enable row level security;
alter table private.alunni_registro enable row level security;
revoke all on private.alunni_config, private.alunni_pagine, private.alunni_profili, private.alunni_classi,
    private.alunni_iscrizioni, private.alunni_varianti, private.alunni_sessioni, private.alunni_tentativi,
    private.alunni_registro from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Funzioni interne
-- ---------------------------------------------------------------------------
create function private.alunni_anno_corrente()
returns integer language sql stable set search_path to '' as $$
    select private.progress_school_year(statement_timestamp());
$$;

-- Tutte le coppie (classe, codice) con cui un'iscrizione può aver salvato.
create function private.alunni_grafie(p_iscrizione uuid)
returns table (classe text, codice text) language sql stable security definer set search_path to '' as $$
    select c.sigla, i.codice from private.alunni_iscrizioni i join private.alunni_classi c on c.id = i.classe_id
     where i.id = p_iscrizione
    union
    select v.classe, v.codice from private.alunni_varianti v where v.iscrizione_id = p_iscrizione and v.stato = 'unita';
$$;

-- Lavori di un alunno: quelli attribuiti a mano e quelli salvati con una delle sue grafie, anno per anno.
create function private.alunni_righe(p_profilo uuid)
returns setof uuid language sql stable security definer set search_path to '' as $$
    select p.id from public.progress p where p.profilo_id = p_profilo
    union
    select p.id
      from private.alunni_iscrizioni i
      cross join lateral private.alunni_grafie(i.id) g
      join public.progress p
        on p.school_year = i.school_year
       and private.alunni_sigla(p.class_code) = g.classe
       and private.alunni_codice(p.student_code) = g.codice
     where i.profilo_id = p_profilo and p.profilo_id is null;
$$;

-- Unificazione automatica di un anno: un profilo per (classe, codice principale), varianti per gli errori.
-- Regole: si uniscono solo grafie della stessa classe che differiscono di una lettera (o due scambiate),
-- oppure lo stesso codice salvato con un'altra classe dello stesso anno di corso; mai se le due grafie
-- hanno salvato la stessa attività (sono due alunni) e mai se la variante è vicina a due codici.
-- Le scelte del docente (varianti separate, iscrizioni esistenti) non vengono toccate.
create function private.alunni_unifica(p_anno integer)
returns integer language plpgsql volatile security definer set search_path to '' as $$
declare
    r record;
    v_classe uuid;
    v_profilo uuid;
    v_iscr uuid;
    v_n integer := 0;
    v_cand uuid[];
begin
    create temporary table if not exists _gruppi (classe text, codice text, righe integer, ultima timestamptz, pagine text[]) on commit drop;
    truncate _gruppi;
    insert into _gruppi
    select private.alunni_sigla(p.class_code), private.alunni_codice(p.student_code), count(*), max(p.updated_at),
           array_agg(distinct private.alunni_percorso(p.page_path))
      from public.progress p
     where p.school_year = p_anno and p.profilo_id is null
       and private.alunni_sigla(p.class_code) ~ '^[1-5][A-Z]{1,4}$'
       and private.alunni_codice(p.student_code) ~ '^[A-Z0-9]{2,60}$'
       and lower(p.student_code) not in ('ospite', 'ping', 'test')
     group by 1, 2;

    -- Dal codice con più lavori al meno usato: le grafie occasionali arrivano dopo quella principale.
    for r in select * from _gruppi g order by g.righe desc, g.ultima desc, g.classe, g.codice loop
        if exists (select 1 from private.alunni_iscrizioni i join private.alunni_classi c on c.id = i.classe_id
                    where i.school_year = p_anno and c.sigla = r.classe and i.codice = r.codice)
           or exists (select 1 from private.alunni_varianti v join private.alunni_iscrizioni i on i.id = v.iscrizione_id
                       where i.school_year = p_anno and v.classe = r.classe and v.codice = r.codice) then
            continue;
        end if;
        -- Variante di un codice già principale nella stessa classe?
        select array_agg(i.id) into v_cand
          from private.alunni_iscrizioni i join private.alunni_classi c on c.id = i.classe_id
          join _gruppi g on g.classe = c.sigla and g.codice = i.codice
         where i.school_year = p_anno and c.sigla = r.classe
           and private.alunni_simili(r.codice, i.codice)
           and g.righe >= r.righe
           and not (g.pagine && r.pagine);
        if coalesce(array_length(v_cand, 1), 0) = 1
           and not exists (select 1 from _gruppi g2 where g2.classe = r.classe and g2.codice <> r.codice
                            and private.alunni_simili(r.codice, g2.codice) and (g2.pagine && r.pagine)) then
            insert into private.alunni_varianti (iscrizione_id, classe, codice, origine, motivo)
            values (v_cand[1], r.classe, r.codice, 'automatica', 'una lettera diversa, attività diverse');
            v_n := v_n + 1;
            continue;
        end if;
        -- Stesso codice già principale in un'altra sezione dello stesso anno di corso (classe scritta male)?
        select array_agg(i.id) into v_cand
          from private.alunni_iscrizioni i join private.alunni_classi c on c.id = i.classe_id
          join _gruppi g on g.classe = c.sigla and g.codice = i.codice
         where i.school_year = p_anno and i.codice = r.codice and c.sigla <> r.classe
           and left(c.sigla, 1) = left(r.classe, 1)
           and g.righe >= r.righe and not (g.pagine && r.pagine);
        if coalesce(array_length(v_cand, 1), 0) = 1 then
            insert into private.alunni_varianti (iscrizione_id, classe, codice, origine, motivo)
            values (v_cand[1], r.classe, r.codice, 'automatica', 'stesso codice con un''altra classe, attività diverse');
            v_n := v_n + 1;
            continue;
        end if;
        -- Altrimenti è un alunno: classe dell'anno e profilo (ripreso dall'anno prima se riconoscibile).
        insert into private.alunni_classi (school_year, sigla) values (p_anno, r.classe)
        on conflict (school_year, sigla) do nothing;
        select c.id into v_classe from private.alunni_classi c where c.school_year = p_anno and c.sigla = r.classe;
        select i.profilo_id into v_profilo
          from private.alunni_iscrizioni i join private.alunni_classi c on c.id = i.classe_id
         where i.school_year = p_anno - 1 and i.codice = r.codice
           and substr(c.sigla, 2) = substr(r.classe, 2)
           and left(c.sigla, 1)::int in (left(r.classe, 1)::int - 1, left(r.classe, 1)::int)
           and not exists (select 1 from private.alunni_iscrizioni j where j.profilo_id = i.profilo_id and j.school_year = p_anno)
         limit 1;
        if v_profilo is null then
            insert into private.alunni_profili default values returning id into v_profilo;
        end if;
        insert into private.alunni_iscrizioni (profilo_id, classe_id, school_year, codice)
        values (v_profilo, v_classe, p_anno, r.codice) returning id into v_iscr;
        v_n := v_n + 1;
    end loop;
    return v_n;
end;
$$;

create function private.alunni_sessione(p_token text)
returns uuid language plpgsql volatile security definer set search_path to '' as $$
declare
    v_profilo uuid;
begin
    if not coalesce((select c.ingresso_attivo from private.alunni_config c where c.singleton), false) then
        raise exception 'area non disponibile' using errcode = '42501', hint = 'non_disponibile';
    end if;
    select s.profilo_id into v_profilo from private.alunni_sessioni s
     where s.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
       and s.revocata_il is null and s.scade_il > now();
    if v_profilo is null then
        raise exception 'sessione scaduta' using errcode = '42501', hint = 'sessione';
    end if;
    return v_profilo;
end;
$$;

create function private.alunni_docente(p_token text)
returns text language plpgsql volatile security definer set search_path to '' as $$
begin
    if private.progress_docente_sessione_ok(p_token) is not true then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    return 'docente:' || left(encode(extensions.digest(p_token, 'sha256'), 'hex'), 8);
end;
$$;

create function private.alunni_registra(p_azione text, p_profilo uuid, p_progress uuid, p_dettagli jsonb, p_docente text)
returns void language sql volatile security definer set search_path to '' as $$
    insert into private.alunni_registro (azione, profilo_id, progress_id, dettagli, sessione_docente)
    values (p_azione, p_profilo, p_progress, coalesce(p_dettagli, '{}'::jsonb), p_docente);
$$;

create function private.alunni_iscrizione_corrente(p_profilo uuid)
returns uuid language sql stable security definer set search_path to '' as $$
    select i.id from private.alunni_iscrizioni i
     where i.profilo_id = p_profilo and i.school_year = private.alunni_anno_corrente();
$$;

revoke all on function private.alunni_percorso(text), private.alunni_codice(text), private.alunni_sigla(text),
    private.alunni_simili(text, text), private.alunni_anno_corrente(), private.alunni_grafie(uuid),
    private.alunni_righe(uuid), private.alunni_unifica(integer), private.alunni_sessione(text),
    private.alunni_docente(text), private.alunni_registra(text, uuid, uuid, jsonb, text),
    private.alunni_iscrizione_corrente(uuid)
    from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Funzioni per l'alunno
-- ---------------------------------------------------------------------------
create function public.alunni_accesso(p_classe text, p_codice text)
returns table (esito text, token text, scade_il timestamptz, classe text, codice text)
language plpgsql volatile security definer set search_path to '' as $$
declare
    v_cfg private.alunni_config;
    v_headers jsonb;
    v_origine text;
    v_anno integer := private.alunni_anno_corrente();
    v_classe text := private.alunni_sigla(p_classe);
    v_codice text := private.alunni_codice(p_codice);
    v_iscr private.alunni_iscrizioni;
    v_token text;
    v_scade timestamptz;
begin
    select * into v_cfg from private.alunni_config c where c.singleton;
    if v_cfg is null or not v_cfg.ingresso_attivo then
        return query select 'non_disponibile'::text, null::text, null::timestamptz, null::text, null::text;
        return;
    end if;
    begin
        v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    exception when others then v_headers := null;
    end;
    v_origine := left(encode(extensions.digest(coalesce(v_headers ->> 'cf-connecting-ip',
                     btrim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), 'sconosciuta'), 'sha256'), 'hex'), 16);
    delete from private.alunni_tentativi t where t.avvenuto_il < now() - interval '1 day';
    if (select count(*) from private.alunni_tentativi t
         where not t.riuscito and t.origine = v_origine and t.avvenuto_il > now() - interval '15 minutes') >= 60 then
        return query select 'troppi_tentativi'::text, null::text, null::timestamptz, null::text, null::text;
        return;
    end if;
    -- Codice principale o una sua variante, nella classe indicata, quest'anno.
    select i.* into v_iscr
      from private.alunni_iscrizioni i join private.alunni_classi c on c.id = i.classe_id
     where i.school_year = v_anno
       and ((c.sigla = v_classe and i.codice = v_codice)
            or exists (select 1 from private.alunni_varianti v where v.iscrizione_id = i.id and v.stato = 'unita'
                        and v.classe = v_classe and v.codice = v_codice))
     limit 1;
    -- Primo ingresso di un alunno che ha già salvato: si crea il suo profilo come fa l'unificazione.
    if v_iscr.id is null and exists (select 1 from public.progress p where p.school_year = v_anno
                                        and private.alunni_sigla(p.class_code) = v_classe
                                        and private.alunni_codice(p.student_code) = v_codice) then
        perform private.alunni_unifica(v_anno);
        select i.* into v_iscr
          from private.alunni_iscrizioni i join private.alunni_classi c on c.id = i.classe_id
         where i.school_year = v_anno
           and ((c.sigla = v_classe and i.codice = v_codice)
                or exists (select 1 from private.alunni_varianti v where v.iscrizione_id = i.id and v.stato = 'unita'
                            and v.classe = v_classe and v.codice = v_codice))
         limit 1;
    end if;
    if v_iscr.id is null then
        insert into private.alunni_tentativi (riuscito, origine) values (false, v_origine);
        return query select 'non_riconosciuto'::text, null::text, null::timestamptz, null::text, null::text;
        return;
    end if;
    insert into private.alunni_tentativi (riuscito, origine) values (true, v_origine);
    delete from private.alunni_sessioni s where s.scade_il < now() - interval '7 days';
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_scade := now() + v_cfg.durata_sessione;
    insert into private.alunni_sessioni (token_hash, profilo_id, scade_il)
    values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_iscr.profilo_id, v_scade);
    -- Classe e codice principali: le attività fuori dall'area li useranno senza chiederli.
    return query select 'ok'::text, v_token, v_scade,
        (select c.sigla from private.alunni_classi c where c.id = v_iscr.classe_id), v_iscr.codice;
end;
$$;

create function public.alunni_esci(p_token text)
returns void language sql volatile security definer set search_path to '' as $$
    update private.alunni_sessioni s set revocata_il = now()
     where s.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and s.revocata_il is null;
$$;

create function public.alunni_profilo(p_token text)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
    v_profilo uuid := private.alunni_sessione(p_token);
    v_anno integer := private.alunni_anno_corrente();
begin
    return (select jsonb_build_object(
                'pseudonimo', i.codice, 'anno_corrente', v_anno, 'classe', c.sigla,
                'anno_corso', left(c.sigla, 1)::int, 'iscritto', true)
              from private.alunni_iscrizioni i join private.alunni_classi c on c.id = i.classe_id
             where i.profilo_id = v_profilo and i.school_year = v_anno);
end;
$$;

create function public.alunni_lavori(p_token text)
returns table (id uuid, page_path text, school_year integer, updated_at timestamptz, classe text,
               meta jsonb, compilati integer, totali integer, modificabile boolean)
language plpgsql volatile security definer set search_path to '' as $$
declare
    v_profilo uuid := private.alunni_sessione(p_token);
    v_anno integer := private.alunni_anno_corrente();
begin
    return query
        select p.id, private.alunni_percorso(p.page_path), p.school_year, p.updated_at, p.class_code,
               case when jsonb_typeof(p.data -> '_meta') = 'object' then p.data -> '_meta' else null end,
               k.compilati, k.totali,
               (p.school_year = v_anno
                and exists (select 1 from private.alunni_pagine g
                             where g.page_path = private.alunni_percorso(p.page_path) and g.abilitata))
          from public.progress p
          cross join lateral private.progress_conta(p.data) k
         where p.id in (select private.alunni_righe(v_profilo))
         order by p.updated_at desc nulls last, p.id
         limit 500;
end;
$$;

-- Lavoro di quest'anno su una pagina (il più recente fra le grafie dell'alunno), oppure un lavoro preciso.
create function public.alunni_lavoro_apri(p_token text, p_page_path text, p_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
    v_profilo uuid := private.alunni_sessione(p_token);
    v_anno integer := private.alunni_anno_corrente();
    v_path text := private.alunni_percorso(coalesce(p_page_path, ''));
    v_abilitata boolean := exists (select 1 from private.alunni_pagine g where g.page_path = v_path and g.abilitata);
    v_riga public.progress;
begin
    if p_id is not null then
        select p.* into v_riga from public.progress p
         where p.id = p_id and p.id in (select private.alunni_righe(v_profilo));
        if v_riga.id is null or private.alunni_percorso(v_riga.page_path) <> v_path then
            return jsonb_build_object('stato', 'non_trovato');
        end if;
        return jsonb_build_object('stato', 'in_corso', 'id', v_riga.id, 'data', v_riga.data, 'versione', v_riga.updated_at,
            'school_year', v_riga.school_year, 'modificabile', v_abilitata and v_riga.school_year = v_anno);
    end if;
    if not v_abilitata then
        return jsonb_build_object('stato', 'pagina_non_abilitata');
    end if;
    if private.alunni_iscrizione_corrente(v_profilo) is null then
        return jsonb_build_object('stato', 'non_iscritto', 'school_year', v_anno, 'modificabile', false);
    end if;
    select p.* into v_riga from public.progress p
     where p.id in (select private.alunni_righe(v_profilo))
       and p.school_year = v_anno and private.alunni_percorso(p.page_path) = v_path
     order by p.updated_at desc nulls last limit 1;
    if v_riga.id is not null then
        return jsonb_build_object('stato', 'in_corso', 'id', v_riga.id, 'data', v_riga.data, 'versione', v_riga.updated_at,
                                  'school_year', v_anno, 'modificabile', true);
    end if;
    return jsonb_build_object('stato', 'nuovo', 'data', null, 'versione', null, 'school_year', v_anno, 'modificabile', true);
end;
$$;

create function public.alunni_lavoro_salva(p_token text, p_page_path text, p_data jsonb, p_versione timestamptz, p_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
    v_profilo uuid := private.alunni_sessione(p_token);
    v_ora timestamptz := statement_timestamp();
    v_anno integer := private.progress_school_year(statement_timestamp());
    v_path text := private.alunni_percorso(coalesce(p_page_path, ''));
    v_iscr private.alunni_iscrizioni;
    v_sigla text;
    v_riga public.progress;
    v_nuovo uuid;
begin
    if p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 1048576 then
        raise exception 'dati non validi' using errcode = '22023';
    end if;
    if not exists (select 1 from private.alunni_pagine g where g.page_path = v_path and g.abilitata) then
        raise exception 'attività non abilitata' using errcode = '42501', hint = 'pagina';
    end if;
    select i.* into v_iscr from private.alunni_iscrizioni i where i.profilo_id = v_profilo and i.school_year = v_anno;
    if v_iscr.id is null then
        raise exception 'nessuna classe per l''anno in corso' using errcode = '42501', hint = 'iscrizione';
    end if;
    select c.sigla into v_sigla from private.alunni_classi c where c.id = v_iscr.classe_id;
    if p_id is not null then
        select p.* into v_riga from public.progress p
         where p.id = p_id and p.school_year = v_anno and private.alunni_percorso(p.page_path) = v_path
           and p.id in (select private.alunni_righe(v_profilo))
         for update;
    else
        select p.* into v_riga from public.progress p
         where p.id in (select private.alunni_righe(v_profilo))
           and p.school_year = v_anno and private.alunni_percorso(p.page_path) = v_path
         order by p.updated_at desc nulls last limit 1
         for update;
    end if;
    if v_riga.id is not null then
        if p_versione is distinct from v_riga.updated_at then
            raise exception 'il lavoro è stato salvato da un''altra scheda' using errcode = '40001', hint = 'conflitto';
        end if;
        -- Si aggiorna la riga dov'è: codice, classe e percorso restano quelli con cui è stata salvata,
        -- così anche il vecchio accesso dalle attività continua a trovarla.
        update public.progress p set data = p_data, updated_at = v_ora where p.id = v_riga.id;
        return jsonb_build_object('versione', v_ora, 'id', v_riga.id);
    end if;
    if p_versione is not null then
        raise exception 'il lavoro non è più disponibile' using errcode = '40001', hint = 'conflitto';
    end if;
    insert into public.progress as p (class_code, student_code, page_path, data, updated_at, school_year)
    values (v_sigla, v_iscr.codice, v_path, p_data, v_ora, v_anno)
    on conflict (school_year, student_code, page_path) do nothing
    returning p.id into v_nuovo;
    if v_nuovo is null then
        raise exception 'il lavoro è stato salvato da un''altra scheda' using errcode = '40001', hint = 'conflitto';
    end if;
    return jsonb_build_object('versione', v_ora, 'id', v_nuovo);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Funzioni per il docente
-- ---------------------------------------------------------------------------
create function public.alunni_docente_stato(p_token text)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
    v_doc text := private.alunni_docente(p_token);
begin
    return jsonb_build_object(
        'anno_corrente', private.alunni_anno_corrente(),
        'ingresso_attivo', (select c.ingresso_attivo from private.alunni_config c where c.singleton),
        'pagine', coalesce((select jsonb_agg(jsonb_build_object('page_path', g.page_path, 'titolo', g.titolo,
                                                                'abilitata', g.abilitata) order by g.titolo)
                              from private.alunni_pagine g), '[]'::jsonb));
end;
$$;

create function public.alunni_docente_ingresso(p_token text, p_attivo boolean)
returns void language plpgsql volatile security definer set search_path to '' as $$
declare
    v_doc text := private.alunni_docente(p_token);
begin
    update private.alunni_config c set ingresso_attivo = coalesce(p_attivo, false), aggiornato_il = now() where c.singleton;
    perform private.alunni_registra(case when p_attivo then 'ingresso_attivato' else 'ingresso_sospeso' end, null, null, '{}'::jsonb, v_doc);
end;
$$;

-- Alunni della classe nell'anno, con le grafie unite e i casi da decidere.
create function public.alunni_docente_classe(p_token text, p_school_year integer, p_sigla text)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
    v_doc text := private.alunni_docente(p_token);
    v_sigla text := private.alunni_sigla(p_sigla);
begin
    perform private.alunni_unifica(p_school_year);
    return jsonb_build_object(
        'alunni', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'iscrizione_id', i.id, 'profilo_id', i.profilo_id, 'codice', i.codice,
                       'lavori', (select count(*) from public.progress p where p.id in (select private.alunni_righe(i.profilo_id))
                                                                         and p.school_year = p_school_year),
                       'varianti', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'classe', v.classe, 'codice', v.codice,
                                                  'stato', v.stato, 'origine', v.origine, 'motivo', v.motivo) order by v.codice)
                                               from private.alunni_varianti v where v.iscrizione_id = i.id), '[]'::jsonb),
                       'anni_precedenti', (select count(*) from private.alunni_iscrizioni j where j.profilo_id = i.profilo_id
                                                                                          and j.school_year < p_school_year))
                   order by i.codice)
              from private.alunni_iscrizioni i join private.alunni_classi c on c.id = i.classe_id
             where c.school_year = p_school_year and c.sigla = v_sigla), '[]'::jsonb),
        -- Codici simili che hanno salvato le stesse attività: probabilmente due alunni, decide il docente.
        'da_decidere', coalesce((
            select jsonb_agg(jsonb_build_object('a', a.codice, 'b', b.codice, 'iscrizione_a', a.id, 'iscrizione_b', b.id))
              from private.alunni_iscrizioni a
              join private.alunni_iscrizioni b on b.classe_id = a.classe_id and a.codice < b.codice
              join private.alunni_classi c on c.id = a.classe_id
             where c.school_year = p_school_year and c.sigla = v_sigla
               and private.alunni_simili(a.codice, b.codice)
               and not exists (select 1 from private.alunni_registro r where r.azione = 'alunni_diversi'
                                and r.dettagli @> jsonb_build_object('a', a.id::text, 'b', b.id::text))), '[]'::jsonb));
end;
$$;

-- «Stesso alunno»: l'iscrizione b diventa una variante di a (con tutte le sue grafie).
create function public.alunni_docente_unisci(p_token text, p_iscrizione_a uuid, p_iscrizione_b uuid)
returns void language plpgsql volatile security definer set search_path to '' as $$
declare
    v_doc text := private.alunni_docente(p_token);
    v_a private.alunni_iscrizioni;
    v_b private.alunni_iscrizioni;
begin
    select * into v_a from private.alunni_iscrizioni where id = p_iscrizione_a for update;
    select * into v_b from private.alunni_iscrizioni where id = p_iscrizione_b for update;
    if v_a.id is null or v_b.id is null or v_a.school_year <> v_b.school_year or v_a.id = v_b.id then
        raise exception 'alunni non validi' using errcode = '22023';
    end if;
    insert into private.alunni_varianti (iscrizione_id, classe, codice, origine, motivo)
    select v_a.id, g.classe, g.codice, 'docente', 'unito dal docente' from private.alunni_grafie(v_b.id) g
    on conflict (iscrizione_id, classe, codice) do update set stato = 'unita';
    update public.progress p set profilo_id = v_a.profilo_id where p.profilo_id = v_b.profilo_id and p.school_year = v_a.school_year;
    delete from private.alunni_varianti where iscrizione_id = v_b.id;
    delete from private.alunni_iscrizioni where id = v_b.id;
    perform private.alunni_registra('stesso_alunno', v_a.profilo_id, null,
        jsonb_build_object('a', v_a.codice, 'b', v_b.codice), v_doc);
end;
$$;

-- «Alunni diversi»: la coppia non viene più proposta.
create function public.alunni_docente_diversi(p_token text, p_iscrizione_a uuid, p_iscrizione_b uuid)
returns void language plpgsql volatile security definer set search_path to '' as $$
declare
    v_doc text := private.alunni_docente(p_token);
    v_x uuid := least(p_iscrizione_a, p_iscrizione_b);
    v_y uuid := greatest(p_iscrizione_a, p_iscrizione_b);
    v_cx text; v_cy text;
begin
    select codice into v_cx from private.alunni_iscrizioni where id = v_x;
    select codice into v_cy from private.alunni_iscrizioni where id = v_y;
    if v_cx > v_cy then
        perform private.alunni_registra('alunni_diversi', null, null, jsonb_build_object('a', v_y::text, 'b', v_x::text), v_doc);
    else
        perform private.alunni_registra('alunni_diversi', null, null, jsonb_build_object('a', v_x::text, 'b', v_y::text), v_doc);
    end if;
end;
$$;

-- Separa una variante unita per errore: le sue righe tornano a un alunno a sé.
create function public.alunni_docente_separa(p_token text, p_variante uuid)
returns void language plpgsql volatile security definer set search_path to '' as $$
declare
    v_doc text := private.alunni_docente(p_token);
    v_v private.alunni_varianti;
    v_anno integer;
    v_profilo uuid;
begin
    select * into v_v from private.alunni_varianti where id = p_variante for update;
    if v_v.id is null then raise exception 'variante non trovata' using errcode = '22023'; end if;
    update private.alunni_varianti set stato = 'separata', origine = 'docente' where id = v_v.id;
    select school_year into v_anno from private.alunni_iscrizioni where id = v_v.iscrizione_id;
    -- La grafia separata non verrà più unita a questo alunno; diventa un alunno a sé.
    insert into private.alunni_classi (school_year, sigla) values (v_anno, v_v.classe) on conflict do nothing;
    insert into private.alunni_profili default values returning id into v_profilo;
    insert into private.alunni_iscrizioni (profilo_id, classe_id, school_year, codice)
    select v_profilo, c.id, v_anno, v_v.codice
      from private.alunni_classi c where c.school_year = v_anno and c.sigla = v_v.classe
    on conflict (classe_id, codice) do nothing;
    perform private.alunni_registra('variante_separata', null, null,
        jsonb_build_object('classe', v_v.classe, 'codice', v_v.codice), v_doc);
end;
$$;

create function public.alunni_docente_registro(p_token text, p_limite integer default 200)
returns table (avvenuto_il timestamptz, azione text, dettagli jsonb)
language plpgsql volatile security definer set search_path to '' as $$
declare
    v_doc text := private.alunni_docente(p_token);
begin
    return query select r.avvenuto_il, r.azione, r.dettagli from private.alunni_registro r
                  order by r.avvenuto_il desc, r.id desc limit greatest(1, least(coalesce(p_limite, 200), 1000));
end;
$$;

revoke all on function public.alunni_accesso(text, text), public.alunni_esci(text), public.alunni_profilo(text),
    public.alunni_lavori(text), public.alunni_lavoro_apri(text, text, uuid),
    public.alunni_lavoro_salva(text, text, jsonb, timestamptz, uuid),
    public.alunni_docente_stato(text), public.alunni_docente_ingresso(text, boolean),
    public.alunni_docente_classe(text, integer, text), public.alunni_docente_unisci(text, uuid, uuid),
    public.alunni_docente_diversi(text, uuid, uuid), public.alunni_docente_separa(text, uuid),
    public.alunni_docente_registro(text, integer)
    from public;
grant execute on function public.alunni_accesso(text, text), public.alunni_esci(text), public.alunni_profilo(text),
    public.alunni_lavori(text), public.alunni_lavoro_apri(text, text, uuid),
    public.alunni_lavoro_salva(text, text, jsonb, timestamptz, uuid),
    public.alunni_docente_stato(text), public.alunni_docente_ingresso(text, boolean),
    public.alunni_docente_classe(text, integer, text), public.alunni_docente_unisci(text, uuid, uuid),
    public.alunni_docente_diversi(text, uuid, uuid), public.alunni_docente_separa(text, uuid),
    public.alunni_docente_registro(text, integer)
    to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Avvio: pagine pilota e unificazione degli anni presenti
-- ---------------------------------------------------------------------------
insert into private.alunni_pagine (page_path, titolo, abilitata) values
    ('/materiali/biennio/tssas_percorso_completo_v2.html', 'L’operatore sociale · percorso a tappe', true),
    ('/materiali/biennio/welfare-4-fasi-COMPLETO.html', 'Il welfare in quattro fasi', true),
    ('/materiali/laboratorio/collage_autobiografico.html', 'Il collage autobiografico', true),
    ('/materiali/terzo/percorsi_autoapprendimento.html', 'I servizi sociosanitari · autoapprendimento', true),
    ('/materiali/terzo/ripasso-terzo-anno.html', 'Ripasso del terzo anno', true);

do $$
declare
    a integer;
begin
    for a in select distinct school_year from public.progress where school_year is not null order by 1 loop
        perform private.alunni_unifica(a);
    end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Nessun salvataggio esistente deve risultare cambiato
-- ---------------------------------------------------------------------------
do $$
declare
    v_prima record;
    v_dopo record;
begin
    select * into v_prima from _area_alunni_prima;
    select count(*) as righe,
           md5(coalesce(string_agg(
               id::text || '|' || class_code || '|' || student_code || '|' || page_path || '|' ||
               data::text || '|' || coalesce(updated_at::text, '') || '|' || coalesce(school_year::text, ''),
               E'\n' order by id), '')) as impronta
      into v_dopo from public.progress;
    if v_prima.righe <> v_dopo.righe or v_prima.impronta <> v_dopo.impronta
       or exists (select 1 from public.progress where profilo_id is not null) then
        raise exception 'La migrazione altererebbe salvataggi preesistenti';
    end if;
end;
$$;

commit;
