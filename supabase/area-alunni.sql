-- Metodologie Operative · Area «I miei lavori» (accesso personale degli alunni)
-- Migrazione additiva preparata il 20/11/2026. NON APPLICATA al progetto remoto:
-- serve l'autorizzazione esplicita del titolare per questa revisione concreta.
-- Collaudo locale: supabase/test/area-alunni.test.mjs (PGlite, dati inventati).
--
-- Che cosa aggiunge
-- - Profili alunno, classi per anno scolastico, iscrizioni, codici personali (solo impronta),
--   sessioni (solo impronta del token), tentativi, collegamenti storici e registro minimo.
-- - Due colonne in public.progress: profilo_id (proprietario confermato) e protetto
--   (riga chiusa alle funzioni storiche). Le viste docente esistenti leggono la stessa
--   tabella e mostrano quindi ogni lavoro una volta sola.
-- - Funzioni per l'alunno (alunni_*) e per il docente (alunni_docente_*), tutte
--   SECURITY DEFINER con search_path vuoto e riferimenti espliciti allo schema.
-- - progress_carica e progress_salva restano con firma e risposte invariate, ma non
--   leggono né scrivono più una posizione passata al profilo protetto.
--
-- Che cosa NON fa
-- - Non modifica né sposta i salvataggi esistenti: le colonne nuove partono a NULL/false
--   e il controllo finale annulla tutto se un valore preesistente risultasse cambiato.
-- - Non attiva l'ingresso: alunni_config.ingresso_attivo parte a false e nessuna pagina
--   è abilitata. L'attivazione è un passaggio separato (vedi AREA_ALUNNI.md).
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.progress in share row exclusive mode;

-- Copia di sicurezza dei salvataggi prima della migrazione, nello schema privato, esclusa dall'API
-- (stessa modalità della migrazione progress_anno_scolastico del 20/11/2026).
create table private.progress_backup_pre_area_alunni_20261120 as
select id, class_code, student_code, page_path, data, updated_at, school_year from public.progress;
alter table private.progress_backup_pre_area_alunni_20261120 enable row level security;
revoke all on table private.progress_backup_pre_area_alunni_20261120 from public, anon, authenticated, service_role;

-- Fotografia dei salvataggi prima della migrazione (solo impronta, nessuna copia dei dati).
create temporary table _area_alunni_prima on commit drop as
select count(*) as righe,
       md5(coalesce(string_agg(
           id::text || '|' || class_code || '|' || student_code || '|' || page_path || '|' ||
           data::text || '|' || coalesce(updated_at::text, '') || '|' || coalesce(school_year::text, ''),
           E'\n' order by id), '')) as impronta
from public.progress;

-- ---------------------------------------------------------------------------
-- 1. Configurazione e pagine abilitate
-- ---------------------------------------------------------------------------
create table private.alunni_config (
    singleton boolean primary key default true check (singleton),
    ingresso_attivo boolean not null default false,
    durata_sessione interval not null default interval '8 hours'
        check (durata_sessione between interval '15 minutes' and interval '24 hours'),
    aggiornato_il timestamptz not null default now()
);
insert into private.alunni_config default values;

create function private.alunni_percorso(p_path text)
returns text
language sql
immutable
strict
set search_path to ''
as $$
    -- Stessa normalizzazione di assets/progress.js: senza dominio, query, frammento,
    -- prefisso storico /metodologieoperative e barra finale.
    select case when q = '' then '/' else q end
    from (select regexp_replace(
                 regexp_replace(
                     regexp_replace(split_part(split_part(p_path, '?', 1), '#', 1), '^https?://[^/]+', ''),
                     '^/metodologieoperative(/|$)', '/'),
                 '(.)/$', '\1') as q) s;
$$;

create table private.alunni_pagine (
    page_path text primary key
        check (page_path ~ '^/' and page_path = private.alunni_percorso(page_path)),
    titolo text not null check (length(btrim(titolo)) between 1 and 160),
    abilitata boolean not null default false,
    aggiornato_il timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Profili, classi per anno, iscrizioni
-- ---------------------------------------------------------------------------
create table private.alunni_profili (
    id uuid primary key default gen_random_uuid(),
    pseudonimo text not null check (length(btrim(pseudonimo)) between 1 and 60),
    creato_il timestamptz not null default now(),
    archiviato_il timestamptz
);

create table private.alunni_classi (
    id uuid primary key default gen_random_uuid(),
    school_year integer not null check (school_year between 2020 and 2100),
    anno_corso smallint not null check (anno_corso between 1 and 5),
    sezione text not null check (sezione ~ '^[A-Z]{1,4}$'),
    creata_il timestamptz not null default now(),
    unique (school_year, anno_corso, sezione),
    unique (id, school_year)
);

create table private.alunni_iscrizioni (
    id uuid primary key default gen_random_uuid(),
    profilo_id uuid not null references private.alunni_profili (id),
    classe_id uuid not null,
    school_year integer not null,
    codice_storico text not null check (codice_storico ~ '^[A-Z0-9][A-Z0-9-]{1,59}$'),
    dal timestamptz not null default now(),
    al timestamptz,
    foreign key (classe_id, school_year) references private.alunni_classi (id, school_year)
);
-- Un alunno ha al massimo una iscrizione attiva per anno; un codice storico identifica
-- al massimo un alunno attivo per anno (è la stessa chiave usata da progress_salva).
create unique index alunni_iscrizioni_attiva_per_anno
    on private.alunni_iscrizioni (profilo_id, school_year) where al is null;
create unique index alunni_iscrizioni_codice_per_anno
    on private.alunni_iscrizioni (school_year, codice_storico) where al is null;

-- ---------------------------------------------------------------------------
-- 3. Codici personali, sessioni, tentativi
-- ---------------------------------------------------------------------------
create table private.alunni_credenziali (
    id uuid primary key default gen_random_uuid(),
    profilo_id uuid not null references private.alunni_profili (id),
    impronta text not null unique check (impronta ~ '^[0-9a-f]{64}$'),
    emessa_il timestamptz not null default now(),
    revocata_il timestamptz,
    motivo_revoca text,
    ultimo_uso timestamptz
);
create unique index alunni_credenziali_attiva
    on private.alunni_credenziali (profilo_id) where revocata_il is null;

create table private.alunni_sessioni (
    token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
    profilo_id uuid not null references private.alunni_profili (id),
    credenziale_id uuid not null references private.alunni_credenziali (id),
    creata_il timestamptz not null default now(),
    scade_il timestamptz not null,
    ultimo_uso timestamptz not null default now(),
    revocata_il timestamptz
);
create index alunni_sessioni_profilo on private.alunni_sessioni (profilo_id);

create table private.alunni_tentativi (
    id bigint generated always as identity primary key,
    avvenuto_il timestamptz not null default now(),
    riuscito boolean not null,
    origine text not null
);
create index alunni_tentativi_recenti on private.alunni_tentativi (avvenuto_il, origine);

-- ---------------------------------------------------------------------------
-- 4. Proprietà dei lavori nella tabella esistente
-- ---------------------------------------------------------------------------
alter table public.progress
    add column profilo_id uuid references private.alunni_profili (id),
    add column iscrizione_id uuid references private.alunni_iscrizioni (id),
    add column protetto boolean not null default false;
alter table public.progress
    add constraint progress_proprietario_protetto check (profilo_id is null or protetto);
comment on column public.progress.profilo_id is
    'Proprietario confermato (Area alunni). Una riga ha al massimo un proprietario.';
comment on column public.progress.protetto is
    'true: la riga non è raggiungibile da progress_carica/progress_salva. Senza proprietario resta visibile solo al docente (in verifica).';
-- Un solo lavoro per alunno, anno e attività, anche fra percorsi equivalenti.
create unique index progress_profilo_anno_pagina
    on public.progress (profilo_id, school_year, private.alunni_percorso(page_path))
    where profilo_id is not null;
create index progress_anno_codice_maiuscolo
    on public.progress (school_year, upper(btrim(student_code)));

-- ---------------------------------------------------------------------------
-- 5. Collegamenti storici e registro minimo
-- ---------------------------------------------------------------------------
create table private.alunni_collegamenti (
    id uuid primary key default gen_random_uuid(),
    progress_id uuid not null references public.progress (id),
    profilo_id uuid not null references private.alunni_profili (id),
    stato text not null check (stato in ('confermato', 'annullato')),
    contesto_anno integer,
    contesto_classe text,
    codice_sorgente text,
    percorso_sorgente text,
    motivo text check (length(motivo) <= 200),
    aggiornato_al_collegamento timestamptz,
    confermato_il timestamptz not null default now(),
    confermato_da text not null,
    annullato_il timestamptz,
    annullato_da text,
    motivo_annullamento text check (length(motivo_annullamento) <= 200)
);
create unique index alunni_collegamenti_attivo
    on private.alunni_collegamenti (progress_id) where stato = 'confermato';

create table private.alunni_registro (
    id bigint generated always as identity primary key,
    avvenuto_il timestamptz not null default now(),
    azione text not null,
    profilo_id uuid,
    progress_id uuid,
    dettagli jsonb not null default '{}'::jsonb,
    sessione_docente text
);

alter table private.alunni_config enable row level security;
alter table private.alunni_pagine enable row level security;
alter table private.alunni_profili enable row level security;
alter table private.alunni_classi enable row level security;
alter table private.alunni_iscrizioni enable row level security;
alter table private.alunni_credenziali enable row level security;
alter table private.alunni_sessioni enable row level security;
alter table private.alunni_tentativi enable row level security;
alter table private.alunni_collegamenti enable row level security;
alter table private.alunni_registro enable row level security;
revoke all on private.alunni_config, private.alunni_pagine, private.alunni_profili,
    private.alunni_classi, private.alunni_iscrizioni, private.alunni_credenziali,
    private.alunni_sessioni, private.alunni_tentativi, private.alunni_collegamenti,
    private.alunni_registro from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Funzioni interne (nessun EXECUTE ai ruoli dell'API)
-- ---------------------------------------------------------------------------
create function private.alunni_codice_norm(p_codice text)
returns text
language sql
immutable
set search_path to ''
as $$
    -- Alfabeto di Crockford: O si legge 0, I e L si leggono 1; trattini e spazi si ignorano.
    select translate(upper(regexp_replace(coalesce(p_codice, ''), '[^A-Za-z0-9]', '', 'g')), 'OIL', '011');
$$;

create function private.alunni_impronta(p_codice_norm text)
returns text
language sql
immutable
strict
set search_path to ''
as $$
    select encode(extensions.digest('mo-alunni:' || p_codice_norm, 'sha256'), 'hex');
$$;

create function private.alunni_nuovo_codice()
returns text
language plpgsql
volatile
set search_path to ''
as $$
declare
    alfabeto constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    b bytea := extensions.gen_random_bytes(16);
    v text := '';
begin
    -- 16 simboli da 32 valori: 80 bit casuali, senza distorsione (256 è multiplo di 32).
    for i in 0..15 loop
        v := v || substr(alfabeto, (get_byte(b, i) % 32) + 1, 1);
        if i in (3, 7, 11) then v := v || '-'; end if;
    end loop;
    return v;
end;
$$;

create function private.alunni_anno_corrente()
returns integer
language sql
stable
set search_path to ''
as $$
    select private.progress_school_year(statement_timestamp());
$$;

create function private.alunni_blocca(p_anno integer, p_codice text)
returns void
language sql
volatile
set search_path to ''
as $$
    -- Serializza progress_salva, il salvataggio protetto e l'attivazione sullo stesso codice.
    select pg_advisory_xact_lock(hashtextextended('mo-alunni:' || p_anno || ':' || upper(btrim(coalesce(p_codice, ''))), 0));
$$;

create function private.alunni_chiave_chiusa(p_anno integer, p_codice text, p_path text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
    -- Una posizione storica (anno, codice, pagina) è chiusa se:
    -- a) una riga equivalente è già protetta, oppure
    -- b) il codice appartiene a un alunno con accesso personale attivo quell'anno
    --    e la pagina è abilitata all'area protetta.
    select exists (
               select 1 from public.progress p
                where p.school_year = p_anno
                  and upper(btrim(p.student_code)) = upper(btrim(p_codice))
                  and private.alunni_percorso(p.page_path) = private.alunni_percorso(p_path)
                  and p.protetto)
        or exists (
               select 1
                 from private.alunni_iscrizioni i
                 join private.alunni_pagine g on g.page_path = private.alunni_percorso(p_path) and g.abilitata
                where i.school_year = p_anno
                  and i.al is null
                  and i.codice_storico = upper(btrim(p_codice)));
$$;

create function private.alunni_metti_in_verifica(p_anno integer, p_codice text)
returns integer
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    n integer;
begin
    -- Righe storiche dell'anno con questo codice su pagine abilitate: si chiudono al vecchio
    -- accesso e restano visibili al solo docente finché non conferma il proprietario.
    update public.progress p
       set protetto = true
     where p.school_year = p_anno
       and upper(btrim(p.student_code)) = upper(btrim(p_codice))
       and p.profilo_id is null
       and not p.protetto
       and exists (select 1 from private.alunni_pagine g
                    where g.page_path = private.alunni_percorso(p.page_path) and g.abilitata);
    get diagnostics n = row_count;
    return n;
end;
$$;

create function private.alunni_sessione(p_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_profilo uuid;
begin
    if not coalesce((select c.ingresso_attivo from private.alunni_config c where c.singleton), false) then
        raise exception 'area non disponibile' using errcode = '42501', hint = 'non_disponibile';
    end if;
    if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
        raise exception 'sessione scaduta' using errcode = '42501', hint = 'sessione';
    end if;
    update private.alunni_sessioni s
       set ultimo_uso = now()
      from private.alunni_credenziali c, private.alunni_profili a
     where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
       and s.revocata_il is null
       and s.scade_il > now()
       and c.id = s.credenziale_id and c.revocata_il is null
       and a.id = s.profilo_id and a.archiviato_il is null
    returning s.profilo_id into v_profilo;
    if v_profilo is null then
        raise exception 'sessione scaduta' using errcode = '42501', hint = 'sessione';
    end if;
    return v_profilo;
end;
$$;

create function private.alunni_docente(p_token text)
returns text
language plpgsql
volatile
security definer
set search_path to ''
as $$
begin
    if private.progress_docente_sessione_ok(p_token) is not true then
        raise exception 'sessione docente scaduta' using errcode = '42501';
    end if;
    -- Riferimento minimo per il registro: la password è unica, quindi si annota la sessione.
    return 'docente:' || left(encode(extensions.digest(p_token, 'sha256'), 'hex'), 8);
end;
$$;

create function private.alunni_registra(p_azione text, p_profilo uuid, p_progress uuid, p_dettagli jsonb, p_docente text)
returns void
language sql
volatile
security definer
set search_path to ''
as $$
    insert into private.alunni_registro (azione, profilo_id, progress_id, dettagli, sessione_docente)
    values (p_azione, p_profilo, p_progress, coalesce(p_dettagli, '{}'::jsonb), p_docente);
$$;

create function private.alunni_classe_da_sigla(p_anno integer, p_sigla text, p_crea boolean)
returns uuid
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_sigla text := upper(regexp_replace(coalesce(p_sigla, ''), '\s', '', 'g'));
    v_id uuid;
begin
    if v_sigla !~ '^[1-5][A-Z]{1,4}$' then
        raise exception 'sigla di classe non valida (esempio 3SB)' using errcode = '22023';
    end if;
    select c.id into v_id from private.alunni_classi c
     where c.school_year = p_anno and c.anno_corso = substr(v_sigla, 1, 1)::smallint
       and c.sezione = substr(v_sigla, 2);
    if v_id is null and p_crea then
        insert into private.alunni_classi (school_year, anno_corso, sezione)
        values (p_anno, substr(v_sigla, 1, 1)::smallint, substr(v_sigla, 2))
        returning id into v_id;
    end if;
    return v_id;
end;
$$;

create function private.alunni_distanza(a text, b text)
returns integer
language plpgsql
immutable
strict
set search_path to ''
as $$
declare
    prev integer[];
    cur integer[];
    i integer;
    j integer;
    la integer := length(a);
    lb integer := length(b);
begin
    -- Distanza di modifica (Levenshtein) per suggerire codici con una lettera sbagliata.
    if la = 0 then return lb; end if;
    if lb = 0 then return la; end if;
    if abs(la - lb) > 2 then return 3; end if;
    prev := array(select generate_series(0, lb));
    for i in 1..la loop
        cur := array[i];
        for j in 1..lb loop
            cur := cur || least(prev[j + 1] + 1, cur[j] + 1,
                                prev[j] + case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end);
        end loop;
        prev := cur;
    end loop;
    return prev[lb + 1];
end;
$$;

revoke all on function private.alunni_percorso(text), private.alunni_codice_norm(text),
    private.alunni_impronta(text), private.alunni_nuovo_codice(), private.alunni_anno_corrente(),
    private.alunni_blocca(integer, text), private.alunni_chiave_chiusa(integer, text, text),
    private.alunni_metti_in_verifica(integer, text), private.alunni_sessione(text),
    private.alunni_docente(text), private.alunni_registra(text, uuid, uuid, jsonb, text),
    private.alunni_classe_da_sigla(integer, text, boolean), private.alunni_distanza(text, text)
    from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Funzioni storiche: stesse firme e stesse risposte, con il confine protetto
-- ---------------------------------------------------------------------------
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
      and p.page_path = p_page_path
      and not p.protetto
      and not private.alunni_chiave_chiusa(p.school_year, p_student_code, p_page_path);
$$;

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
    v_anno integer := private.progress_school_year(statement_timestamp());
    v_id uuid;
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
    perform private.alunni_blocca(v_anno, p_student_code);
    if private.alunni_chiave_chiusa(v_anno, p_student_code, p_page_path) then
        raise exception 'lavoro protetto: entra da I miei lavori' using errcode = '42501';
    end if;
    insert into public.progress as p (class_code, student_code, page_path, data, updated_at, school_year)
    values (p_class_code, p_student_code, p_page_path, p_data, saved_at, v_anno)
    on conflict (school_year, student_code, page_path)
    do update set class_code = excluded.class_code,
                  data = excluded.data,
                  updated_at = excluded.updated_at
            where not p.protetto
    returning p.id into v_id;
    if v_id is null then
        raise exception 'lavoro protetto: entra da I miei lavori' using errcode = '42501';
    end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Funzioni per l'alunno
-- ---------------------------------------------------------------------------
create function public.alunni_accesso(p_codice text)
returns table (esito text, token text, scade_il timestamptz)
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_cfg private.alunni_config;
    v_headers jsonb;
    v_origine text;
    v_norm text := private.alunni_codice_norm(p_codice);
    v_cred private.alunni_credenziali;
    v_token text;
    v_scade timestamptz;
begin
    -- Non si sollevano errori per codice errato: il tentativo fallito deve restare registrato.
    select * into v_cfg from private.alunni_config c where c.singleton;
    if v_cfg is null or not v_cfg.ingresso_attivo then
        return query select 'non_disponibile'::text, null::text, null::timestamptz;
        return;
    end if;
    begin
        v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    exception when others then
        v_headers := null;
    end;
    v_origine := left(encode(extensions.digest(coalesce(
                     v_headers ->> 'cf-connecting-ip',
                     btrim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)),
                     'sconosciuta'), 'sha256'), 'hex'), 16);
    delete from private.alunni_tentativi t where t.avvenuto_il < now() - interval '1 day';
    -- Una classe intera esce dallo stesso indirizzo di rete: il limite tollera gli errori di
    -- battitura di un gruppo e blocca i tentativi in serie. 80 bit restano comunque fuori portata.
    if (select count(*) from private.alunni_tentativi t
         where not t.riuscito and t.origine = v_origine and t.avvenuto_il > now() - interval '15 minutes') >= 40
       or (select count(*) from private.alunni_tentativi t
         where not t.riuscito and t.avvenuto_il > now() - interval '15 minutes') >= 400 then
        return query select 'troppi_tentativi'::text, null::text, null::timestamptz;
        return;
    end if;
    if length(v_norm) = 16 then
        select c.* into v_cred
          from private.alunni_credenziali c
          join private.alunni_profili a on a.id = c.profilo_id and a.archiviato_il is null
         where c.impronta = private.alunni_impronta(v_norm) and c.revocata_il is null;
    end if;
    if v_cred.id is null then
        insert into private.alunni_tentativi (riuscito, origine) values (false, v_origine);
        return query select 'non_riconosciuto'::text, null::text, null::timestamptz;
        return;
    end if;
    insert into private.alunni_tentativi (riuscito, origine) values (true, v_origine);
    delete from private.alunni_sessioni s where s.scade_il < now() - interval '7 days';
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_scade := now() + v_cfg.durata_sessione;
    insert into private.alunni_sessioni (token_hash, profilo_id, credenziale_id, scade_il)
    values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_cred.profilo_id, v_cred.id, v_scade);
    update private.alunni_credenziali c set ultimo_uso = now() where c.id = v_cred.id;
    return query select 'ok'::text, v_token, v_scade;
end;
$$;

create function public.alunni_esci(p_token text)
returns void
language sql
volatile
security definer
set search_path to ''
as $$
    update private.alunni_sessioni s
       set revocata_il = now()
     where s.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
       and s.revocata_il is null;
$$;

create function public.alunni_profilo(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_profilo uuid := private.alunni_sessione(p_token);
    v_anno integer := private.alunni_anno_corrente();
    v_out jsonb;
begin
    select jsonb_build_object(
               'pseudonimo', a.pseudonimo,
               'anno_corrente', v_anno,
               'classe', case when c.id is null then null else c.anno_corso || c.sezione end,
               'anno_corso', c.anno_corso,
               'iscritto', c.id is not null)
      into v_out
      from private.alunni_profili a
      left join private.alunni_iscrizioni i on i.profilo_id = a.id and i.school_year = v_anno and i.al is null
      left join private.alunni_classi c on c.id = i.classe_id
     where a.id = v_profilo;
    return v_out;
end;
$$;

create function public.alunni_lavori(p_token text)
returns table (
    id uuid, page_path text, school_year integer, updated_at timestamptz, classe text,
    meta jsonb, compilati integer, totali integer, modificabile boolean
)
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_profilo uuid := private.alunni_sessione(p_token);
    v_anno integer := private.alunni_anno_corrente();
    v_iscritto boolean;
begin
    select exists (select 1 from private.alunni_iscrizioni i
                    where i.profilo_id = v_profilo and i.school_year = v_anno and i.al is null)
      into v_iscritto;
    -- Titolo, data e stato prima del contenuto: il payload non esce da qui.
    return query
        select p.id, private.alunni_percorso(p.page_path), p.school_year, p.updated_at, p.class_code,
               case when jsonb_typeof(p.data -> '_meta') = 'object' then p.data -> '_meta' else null end,
               k.compilati, k.totali,
               (p.school_year = v_anno and v_iscritto
                and exists (select 1 from private.alunni_pagine g
                             where g.page_path = private.alunni_percorso(p.page_path) and g.abilitata))
          from public.progress p
          cross join lateral private.progress_conta(p.data) k
         where p.profilo_id = v_profilo
         order by p.updated_at desc nulls last, p.id
         limit 500;
end;
$$;

create function public.alunni_lavoro_apri(p_token text, p_page_path text, p_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_profilo uuid := private.alunni_sessione(p_token);
    v_anno integer := private.alunni_anno_corrente();
    v_path text := private.alunni_percorso(coalesce(p_page_path, ''));
    v_iscr private.alunni_iscrizioni;
    v_riga public.progress;
    v_abilitata boolean;
begin
    select coalesce(g.abilitata, false) into v_abilitata from private.alunni_pagine g where g.page_path = v_path;
    v_abilitata := coalesce(v_abilitata, false);

    -- Riapertura di un lavoro preciso dall'archivio (anche di un anno precedente).
    if p_id is not null then
        select p.* into v_riga from public.progress p where p.id = p_id and p.profilo_id = v_profilo;
        if v_riga.id is null or private.alunni_percorso(v_riga.page_path) <> v_path then
            return jsonb_build_object('stato', 'non_trovato');
        end if;
        return jsonb_build_object(
            'stato', 'in_corso', 'data', v_riga.data, 'versione', v_riga.updated_at,
            'school_year', v_riga.school_year,
            'modificabile', v_abilitata and v_riga.school_year = v_anno and exists (
                select 1 from private.alunni_iscrizioni i
                 where i.profilo_id = v_profilo and i.school_year = v_anno and i.al is null));
    end if;

    if not v_abilitata then
        return jsonb_build_object('stato', 'pagina_non_abilitata');
    end if;
    select i.* into v_iscr from private.alunni_iscrizioni i
     where i.profilo_id = v_profilo and i.school_year = v_anno and i.al is null;

    select p.* into v_riga from public.progress p
     where p.profilo_id = v_profilo and p.school_year = v_anno
       and private.alunni_percorso(p.page_path) = v_path;
    if v_riga.id is not null then
        return jsonb_build_object('stato', 'in_corso', 'data', v_riga.data, 'versione', v_riga.updated_at,
                                  'school_year', v_riga.school_year, 'modificabile', v_iscr.id is not null);
    end if;
    if v_iscr.id is null then
        return jsonb_build_object('stato', 'non_iscritto', 'school_year', v_anno, 'modificabile', false);
    end if;
    if exists (select 1 from public.progress p
                where p.school_year = v_anno
                  and upper(btrim(p.student_code)) = v_iscr.codice_storico
                  and private.alunni_percorso(p.page_path) = v_path) then
        return jsonb_build_object('stato', 'in_verifica', 'school_year', v_anno, 'modificabile', false);
    end if;
    return jsonb_build_object('stato', 'nuovo', 'data', null, 'versione', null,
                              'school_year', v_anno, 'modificabile', true);
end;
$$;

create function public.alunni_lavoro_salva(p_token text, p_page_path text, p_data jsonb, p_versione timestamptz)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_profilo uuid := private.alunni_sessione(p_token);
    v_ora timestamptz := statement_timestamp();
    v_anno integer := private.progress_school_year(statement_timestamp());
    v_path text := private.alunni_percorso(coalesce(p_page_path, ''));
    v_iscr private.alunni_iscrizioni;
    v_sigla text;
    v_riga public.progress;
begin
    if p_data is null or jsonb_typeof(p_data) <> 'object' then
        raise exception 'dati non validi' using errcode = '22023';
    end if;
    if pg_column_size(p_data) > 1048576 then
        raise exception 'lavoro troppo grande' using errcode = '22023';
    end if;
    if not exists (select 1 from private.alunni_pagine g where g.page_path = v_path and g.abilitata) then
        raise exception 'attività non abilitata' using errcode = '42501', hint = 'pagina';
    end if;
    select i.* into v_iscr from private.alunni_iscrizioni i
     where i.profilo_id = v_profilo and i.school_year = v_anno and i.al is null;
    if v_iscr.id is null then
        -- Anche a cavallo del 1° settembre: senza iscrizione nel nuovo anno non si scrive.
        raise exception 'nessuna iscrizione per l''anno in corso' using errcode = '42501', hint = 'iscrizione';
    end if;
    select c.anno_corso || c.sezione into v_sigla from private.alunni_classi c where c.id = v_iscr.classe_id;

    perform private.alunni_blocca(v_anno, v_iscr.codice_storico);
    select p.* into v_riga from public.progress p
     where p.profilo_id = v_profilo and p.school_year = v_anno
       and private.alunni_percorso(p.page_path) = v_path
     for update;
    if v_riga.id is not null then
        if p_versione is distinct from v_riga.updated_at then
            raise exception 'il lavoro è stato salvato da un''altra scheda' using errcode = '40001', hint = 'conflitto';
        end if;
        update public.progress p
           set data = p_data, updated_at = v_ora, class_code = v_sigla, iscrizione_id = v_iscr.id
         where p.id = v_riga.id;
        return jsonb_build_object('versione', v_ora);
    end if;
    if exists (select 1 from public.progress p
                where p.school_year = v_anno
                  and upper(btrim(p.student_code)) = v_iscr.codice_storico
                  and private.alunni_percorso(p.page_path) = v_path) then
        raise exception 'lavoro in verifica dal docente' using errcode = '42501', hint = 'in_verifica';
    end if;
    if p_versione is not null then
        raise exception 'il lavoro non è più disponibile' using errcode = '40001', hint = 'conflitto';
    end if;
    insert into public.progress (class_code, student_code, page_path, data, updated_at, school_year,
                                 profilo_id, iscrizione_id, protetto)
    values (v_sigla, v_iscr.codice_storico, v_path, p_data, v_ora, v_anno, v_profilo, v_iscr.id, true);
    return jsonb_build_object('versione', v_ora);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Funzioni per il docente (sessione docente verificata a ogni chiamata)
-- ---------------------------------------------------------------------------
create function public.alunni_docente_stato(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
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
returns void
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_doc text := private.alunni_docente(p_token);
begin
    update private.alunni_config c set ingresso_attivo = coalesce(p_attivo, false), aggiornato_il = now()
     where c.singleton;
    perform private.alunni_registra(case when p_attivo then 'ingresso_attivato' else 'ingresso_sospeso' end,
                                    null, null, '{}'::jsonb, v_doc);
end;
$$;

create function public.alunni_docente_pagina(p_token text, p_page_path text, p_titolo text, p_abilitata boolean)
returns integer
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_doc text := private.alunni_docente(p_token);
    v_path text := private.alunni_percorso(coalesce(p_page_path, ''));
    v_anno integer := private.alunni_anno_corrente();
    v_codice text;
    n integer := 0;
begin
    if v_path !~ '^/[A-Za-z0-9_./%-]+$' or length(v_path) > 300 then
        raise exception 'percorso non valido' using errcode = '22023';
    end if;
    insert into private.alunni_pagine (page_path, titolo, abilitata)
    values (v_path, left(btrim(coalesce(p_titolo, v_path)), 160), coalesce(p_abilitata, false))
    on conflict (page_path) do update
       set titolo = excluded.titolo, abilitata = excluded.abilitata, aggiornato_il = now();
    if p_abilitata then
        for v_codice in select i.codice_storico from private.alunni_iscrizioni i
                         where i.school_year = v_anno and i.al is null loop
            perform private.alunni_blocca(v_anno, v_codice);
            n := n + private.alunni_metti_in_verifica(v_anno, v_codice);
        end loop;
    end if;
    perform private.alunni_registra('pagina', null, null,
        jsonb_build_object('page_path', v_path, 'abilitata', coalesce(p_abilitata, false), 'in_verifica', n), v_doc);
    return n;
end;
$$;

create function public.alunni_docente_classe(p_token text, p_school_year integer, p_sigla text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_doc text := private.alunni_docente(p_token);
    v_classe uuid := private.alunni_classe_da_sigla(p_school_year, p_sigla, false);
begin
    return jsonb_build_object(
        'classe_id', v_classe,
        'alunni', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'profilo_id', a.id,
                       'iscrizione_id', i.id,
                       'pseudonimo', a.pseudonimo,
                       'codice_storico', i.codice_storico,
                       'codice_attivo', c.id is not null,
                       'codice_emesso_il', c.emessa_il,
                       'ultimo_accesso', (c.ultimo_uso at time zone 'Europe/Rome')::date,
                       'lavori', (select count(*) from public.progress p where p.profilo_id = a.id))
                   order by a.pseudonimo)
              from private.alunni_iscrizioni i
              join private.alunni_profili a on a.id = i.profilo_id
              left join private.alunni_credenziali c on c.profilo_id = a.id and c.revocata_il is null
             where i.classe_id = v_classe and i.al is null), '[]'::jsonb),
        -- Alunni dell'anno precedente, per portare un profilo nella classe nuova.
        'anno_precedente', coalesce((
            select jsonb_agg(jsonb_build_object('profilo_id', a.id, 'pseudonimo', a.pseudonimo,
                                                'classe', k.anno_corso || k.sezione,
                                                'codice_storico', i.codice_storico)
                             order by k.anno_corso, k.sezione, a.pseudonimo)
              from private.alunni_iscrizioni i
              join private.alunni_classi k on k.id = i.classe_id
              join private.alunni_profili a on a.id = i.profilo_id and a.archiviato_il is null
             where i.school_year = p_school_year - 1 and i.al is null
               and not exists (select 1 from private.alunni_iscrizioni j
                                where j.profilo_id = a.id and j.school_year = p_school_year and j.al is null)),
            '[]'::jsonb));
end;
$$;

create function public.alunni_docente_importa(
    p_token text, p_school_year integer, p_sigla text, p_elenco jsonb, p_conferma boolean
)
returns table (riga integer, pseudonimo text, codice_storico text, esito text)
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_doc text := private.alunni_docente(p_token);
    v_classe uuid;
    v_voce jsonb;
    v_n integer := 0;
    v_nome text;
    v_codice text;
    v_profilo uuid;
    v_esistente private.alunni_iscrizioni;
    v_altro private.alunni_iscrizioni;
    v_esito text;
    v_visti text[] := '{}';
begin
    if p_elenco is null or jsonb_typeof(p_elenco) <> 'array' or jsonb_array_length(p_elenco) > 60 then
        raise exception 'elenco non valido (al massimo 60 alunni)' using errcode = '22023';
    end if;
    v_classe := private.alunni_classe_da_sigla(p_school_year, p_sigla, coalesce(p_conferma, false));
    for v_voce in select e from jsonb_array_elements(p_elenco) e loop
        v_n := v_n + 1;
        v_nome := left(btrim(coalesce(v_voce ->> 'pseudonimo', '')), 60);
        v_codice := upper(regexp_replace(coalesce(v_voce ->> 'codice_storico', ''), '\s', '', 'g'));
        v_profilo := nullif(v_voce ->> 'profilo_id', '')::uuid;
        v_esito := null;
        if v_profilo is not null then
            select a.pseudonimo into v_nome from private.alunni_profili a
             where a.id = v_profilo and a.archiviato_il is null;
            if v_nome is null then v_esito := 'profilo non trovato'; end if;
        elsif v_nome = '' then
            v_esito := 'manca il nome da mostrare';
        end if;
        if v_esito is null and v_codice !~ '^[A-Z0-9][A-Z0-9-]{1,59}$' then
            v_esito := 'codice delle attività non valido';
        end if;
        if v_esito is null and v_codice = any (v_visti) then
            v_esito := 'codice ripetuto nella lista';
        end if;
        v_visti := v_visti || v_codice;
        if v_esito is null then
            select i.* into v_altro from private.alunni_iscrizioni i
             where i.school_year = p_school_year and i.codice_storico = v_codice and i.al is null
               and (v_profilo is null or i.profilo_id <> v_profilo);
            if v_altro.id is not null and v_profilo is null and v_altro.classe_id = v_classe
               and exists (select 1 from private.alunni_profili a
                            where a.id = v_altro.profilo_id and lower(btrim(a.pseudonimo)) = lower(v_nome)) then
                v_esito := 'già in questa classe';
            elsif v_altro.id is not null and v_altro.classe_id = v_classe then
                v_esito := 'codice già usato da un altro alunno di questa classe: sceglierne uno diverso';
            elsif v_altro.id is not null then
                v_esito := 'codice già usato da un altro alunno in questo anno: sceglierne uno diverso';
            end if;
        end if;
        if v_esito is null and v_profilo is not null then
            select i.* into v_esistente from private.alunni_iscrizioni i
             where i.profilo_id = v_profilo and i.school_year = p_school_year and i.al is null;
            if v_esistente.id is not null and v_esistente.classe_id = v_classe then
                v_esito := 'già in questa classe';
            end if;
        end if;
        if v_esito is null then
            v_esito := case when v_esistente.id is not null then 'cambio di classe'
                            when v_profilo is not null then 'portato dall''anno precedente'
                            else 'nuovo' end;
            if coalesce(p_conferma, false) then
                perform private.alunni_blocca(p_school_year, v_codice);
                if v_profilo is null then
                    insert into private.alunni_profili (pseudonimo) values (v_nome) returning id into v_profilo;
                    perform private.alunni_registra('profilo_creato', v_profilo, null, '{}'::jsonb, v_doc);
                end if;
                if v_esistente.id is not null then
                    update private.alunni_iscrizioni i set al = now() where i.id = v_esistente.id;
                end if;
                insert into private.alunni_iscrizioni (profilo_id, classe_id, school_year, codice_storico)
                values (v_profilo, v_classe, p_school_year, v_codice);
                perform private.alunni_registra('iscrizione', v_profilo, null,
                    jsonb_build_object('anno', p_school_year, 'classe', upper(p_sigla), 'esito', v_esito), v_doc);
                if p_school_year = private.alunni_anno_corrente() then
                    perform private.alunni_metti_in_verifica(p_school_year, v_codice);
                end if;
            end if;
        end if;
        riga := v_n; pseudonimo := v_nome; codice_storico := v_codice; esito := v_esito;
        return next;
        v_esistente := null; v_altro := null;
    end loop;
end;
$$;

create function public.alunni_docente_codice(p_token text, p_profilo_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_doc text := private.alunni_docente(p_token);
    v_codice text;
    v_sostituito boolean;
begin
    if not exists (select 1 from private.alunni_profili a where a.id = p_profilo_id and a.archiviato_il is null) then
        raise exception 'alunno non trovato' using errcode = '22023';
    end if;
    update private.alunni_credenziali c set revocata_il = now(), motivo_revoca = 'sostituito'
     where c.profilo_id = p_profilo_id and c.revocata_il is null;
    v_sostituito := found;
    update private.alunni_sessioni s set revocata_il = now()
     where s.profilo_id = p_profilo_id and s.revocata_il is null;
    v_codice := private.alunni_nuovo_codice();
    insert into private.alunni_credenziali (profilo_id, impronta)
    values (p_profilo_id, private.alunni_impronta(private.alunni_codice_norm(v_codice)));
    perform private.alunni_registra(case when v_sostituito then 'codice_sostituito' else 'codice_emesso' end,
                                    p_profilo_id, null, '{}'::jsonb, v_doc);
    -- Il codice in chiaro esce solo qui, una volta: nel database resta l'impronta.
    return v_codice;
end;
$$;

create function public.alunni_docente_revoca(p_token text, p_profilo_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_doc text := private.alunni_docente(p_token);
begin
    update private.alunni_credenziali c set revocata_il = now(), motivo_revoca = 'revocato'
     where c.profilo_id = p_profilo_id and c.revocata_il is null;
    update private.alunni_sessioni s set revocata_il = now()
     where s.profilo_id = p_profilo_id and s.revocata_il is null;
    perform private.alunni_registra('codice_revocato', p_profilo_id, null, '{}'::jsonb, v_doc);
end;
$$;

create function public.alunni_docente_candidati(p_token text, p_school_year integer, p_sigla text)
returns table (
    progress_id uuid, page_path text, school_year integer, updated_at timestamptz, class_code text,
    student_code text, protetto boolean, profilo_id uuid, pseudonimo text, esito text, motivo text
)
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_doc text := private.alunni_docente(p_token);
    v_classe uuid := private.alunni_classe_da_sigla(p_school_year, p_sigla, false);
    v_sigla text := upper(regexp_replace(coalesce(p_sigla, ''), '\s', '', 'g'));
begin
    -- Righe senza proprietario da attribuire agli alunni di questa classe. Nessuna attribuzione
    -- automatica: «certo» significa solo che l'evidenza disponibile non mostra alternative.
    return query
    with roster as (
        select i.profilo_id, a.pseudonimo, i.codice_storico
          from private.alunni_iscrizioni i
          join private.alunni_profili a on a.id = i.profilo_id
         where i.classe_id = v_classe and i.al is null
    ), righe as (
        select p.* from public.progress p
         where p.school_year = p_school_year and p.profilo_id is null
           and (upper(btrim(p.class_code)) = v_sigla
                or upper(btrim(p.student_code)) in (select r.codice_storico from roster r))
    ), classi_per_codice as (
        select upper(btrim(p.student_code)) as codice, count(distinct upper(btrim(p.class_code))) as n
          from public.progress p where p.school_year = p_school_year group by 1
    ), abbinati as (
        select g.id as rid, r.profilo_id as pid, r.pseudonimo as nome,
               case when upper(btrim(g.student_code)) = r.codice_storico then 0
                    else private.alunni_distanza(upper(regexp_replace(g.student_code, '[^A-Za-z0-9]', '', 'g')),
                                                 regexp_replace(r.codice_storico, '[^A-Z0-9]', '', 'g')) end as d
          from righe g cross join roster r
    ), migliori as (
        select x.rid, x.pid, x.nome, x.d,
               count(*) over (partition by x.rid, x.d) as pari,
               row_number() over (partition by x.rid order by x.d, x.nome) as ord
          from abbinati x where x.d <= 1
    )
    select g.id, g.page_path, g.school_year, g.updated_at, g.class_code, g.student_code, g.protetto,
           m.pid, m.nome,
           case
               when m.pid is null then 'nessuno'
               when m.pari > 1 then 'conflitto'
               when m.d = 0 and upper(btrim(g.class_code)) = v_sigla and coalesce(k.n, 1) = 1 then 'certo'
               when m.d = 0 then 'da_verificare'
               else 'simile'
           end,
           case
               when m.pid is null then 'nessun codice uguale o simile nella lista della classe'
               when m.pari > 1 then 'più alunni plausibili'
               when m.d = 0 and upper(btrim(g.class_code)) <> v_sigla then 'salvato con un''altra classe: ' || g.class_code
               when m.d = 0 and coalesce(k.n, 1) > 1 then 'lo stesso codice compare in più classi in questo anno'
               when m.d = 0 then 'stesso codice, stessa classe'
               else 'codice simile: una lettera diversa'
           end
      from righe g
      left join migliori m on m.rid = g.id and m.ord = 1
      left join classi_per_codice k on k.codice = upper(btrim(g.student_code))
     order by case
                  when m.pid is null then 5
                  when m.pari > 1 then 4
                  when m.d = 0 and upper(btrim(g.class_code)) = v_sigla and coalesce(k.n, 1) = 1 then 1
                  when m.d = 0 then 2
                  else 3
              end, m.nome nulls last, g.page_path;
end;
$$;

create function public.alunni_docente_collega(p_token text, p_progress_id uuid, p_profilo_id uuid, p_motivo text)
returns uuid
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_doc text := private.alunni_docente(p_token);
    v_riga public.progress;
    v_id uuid;
begin
    select p.* into v_riga from public.progress p where p.id = p_progress_id for update;
    if v_riga.id is null then
        raise exception 'lavoro non trovato' using errcode = '22023';
    end if;
    if v_riga.profilo_id is not null then
        raise exception 'il lavoro ha già un proprietario: annulla prima il collegamento' using errcode = '23505';
    end if;
    if not exists (select 1 from private.alunni_profili a where a.id = p_profilo_id and a.archiviato_il is null) then
        raise exception 'alunno non trovato' using errcode = '22023';
    end if;
    if exists (select 1 from public.progress p
                where p.profilo_id = p_profilo_id and p.school_year = v_riga.school_year
                  and private.alunni_percorso(p.page_path) = private.alunni_percorso(v_riga.page_path)) then
        raise exception 'l''alunno ha già un lavoro su questa attività in quell''anno' using errcode = '23505';
    end if;
    perform private.alunni_blocca(v_riga.school_year, v_riga.student_code);
    update public.progress p set profilo_id = p_profilo_id, protetto = true where p.id = v_riga.id;
    insert into private.alunni_collegamenti (progress_id, profilo_id, stato, contesto_anno, contesto_classe,
                                             codice_sorgente, percorso_sorgente, motivo,
                                             aggiornato_al_collegamento, confermato_da)
    values (v_riga.id, p_profilo_id, 'confermato', v_riga.school_year, v_riga.class_code,
            v_riga.student_code, v_riga.page_path, left(p_motivo, 200), v_riga.updated_at, v_doc)
    returning id into v_id;
    perform private.alunni_registra('collegamento_confermato', p_profilo_id, v_riga.id,
                                    jsonb_build_object('collegamento', v_id), v_doc);
    return v_id;
end;
$$;

create function public.alunni_docente_collegamenti(p_token text, p_school_year integer, p_sigla text)
returns table (
    progress_id uuid, page_path text, school_year integer, updated_at timestamptz,
    codice_sorgente text, pseudonimo text, confermato_il timestamptz
)
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_doc text := private.alunni_docente(p_token);
    v_classe uuid := private.alunni_classe_da_sigla(p_school_year, p_sigla, false);
begin
    -- Collegamenti attivi degli alunni di questa classe, di qualunque anno: si possono annullare.
    return query
        select c.progress_id, p.page_path, p.school_year, p.updated_at, c.codice_sorgente, a.pseudonimo, c.confermato_il
          from private.alunni_collegamenti c
          join public.progress p on p.id = c.progress_id
          join private.alunni_profili a on a.id = c.profilo_id
         where c.stato = 'confermato'
           and c.profilo_id in (select i.profilo_id from private.alunni_iscrizioni i
                                 where i.classe_id = v_classe and i.al is null)
         order by a.pseudonimo, p.school_year desc, p.page_path;
end;
$$;

create function public.alunni_docente_annulla(p_token text, p_progress_id uuid, p_motivo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_doc text := private.alunni_docente(p_token);
    v_col private.alunni_collegamenti;
    v_riga public.progress;
begin
    select c.* into v_col from private.alunni_collegamenti c
     where c.progress_id = p_progress_id and c.stato = 'confermato' for update;
    if v_col.id is null then
        raise exception 'nessun collegamento attivo per questo lavoro' using errcode = '22023';
    end if;
    select p.* into v_riga from public.progress p where p.id = p_progress_id for update;
    -- L'alunno perde subito l'accesso; la riga resta protetta e visibile al docente.
    update public.progress p set profilo_id = null where p.id = p_progress_id;
    update private.alunni_collegamenti c
       set stato = 'annullato', annullato_il = now(), annullato_da = v_doc,
           motivo_annullamento = left(p_motivo, 200)
     where c.id = v_col.id;
    perform private.alunni_registra('collegamento_annullato', v_col.profilo_id, p_progress_id,
                                    jsonb_build_object('collegamento', v_col.id), v_doc);
    return jsonb_build_object(
        'modificato_dopo_il_collegamento', v_riga.updated_at is distinct from v_col.aggiornato_al_collegamento);
end;
$$;

create function public.alunni_docente_sblocca(p_token text, p_progress_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_doc text := private.alunni_docente(p_token);
    v_riga public.progress;
begin
    select p.* into v_riga from public.progress p where p.id = p_progress_id for update;
    if v_riga.id is null or v_riga.profilo_id is not null then
        raise exception 'si sblocca solo un lavoro senza proprietario' using errcode = '22023';
    end if;
    perform private.alunni_blocca(v_riga.school_year, v_riga.student_code);
    if exists (select 1 from private.alunni_iscrizioni i
                where i.school_year = v_riga.school_year and i.al is null
                  and i.codice_storico = upper(btrim(v_riga.student_code))) then
        raise exception 'il codice appartiene a un alunno con accesso personale: collega il lavoro invece di sbloccarlo'
            using errcode = '22023';
    end if;
    update public.progress p set protetto = false where p.id = v_riga.id;
    perform private.alunni_registra('lavoro_sbloccato', null, v_riga.id, '{}'::jsonb, v_doc);
end;
$$;

create function public.alunni_docente_registro(p_token text, p_limite integer default 200)
returns table (avvenuto_il timestamptz, azione text, pseudonimo text, page_path text, dettagli jsonb)
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
    v_doc text := private.alunni_docente(p_token);
begin
    return query
        select r.avvenuto_il, r.azione, a.pseudonimo, p.page_path, r.dettagli
          from private.alunni_registro r
          left join private.alunni_profili a on a.id = r.profilo_id
          left join public.progress p on p.id = r.progress_id
         order by r.avvenuto_il desc, r.id desc
         limit greatest(1, least(coalesce(p_limite, 200), 1000));
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Permessi: solo EXECUTE sulle funzioni pubbliche, nessun accesso alle tabelle
-- ---------------------------------------------------------------------------
revoke all on function public.alunni_accesso(text), public.alunni_esci(text), public.alunni_profilo(text),
    public.alunni_lavori(text), public.alunni_lavoro_apri(text, text, uuid),
    public.alunni_lavoro_salva(text, text, jsonb, timestamptz),
    public.alunni_docente_stato(text), public.alunni_docente_ingresso(text, boolean),
    public.alunni_docente_pagina(text, text, text, boolean),
    public.alunni_docente_classe(text, integer, text),
    public.alunni_docente_importa(text, integer, text, jsonb, boolean),
    public.alunni_docente_codice(text, uuid), public.alunni_docente_revoca(text, uuid),
    public.alunni_docente_candidati(text, integer, text),
    public.alunni_docente_collega(text, uuid, uuid, text),
    public.alunni_docente_collegamenti(text, integer, text),
    public.alunni_docente_annulla(text, uuid, text), public.alunni_docente_sblocca(text, uuid),
    public.alunni_docente_registro(text, integer)
    from public;
grant execute on function public.alunni_accesso(text), public.alunni_esci(text), public.alunni_profilo(text),
    public.alunni_lavori(text), public.alunni_lavoro_apri(text, text, uuid),
    public.alunni_lavoro_salva(text, text, jsonb, timestamptz),
    public.alunni_docente_stato(text), public.alunni_docente_ingresso(text, boolean),
    public.alunni_docente_pagina(text, text, text, boolean),
    public.alunni_docente_classe(text, integer, text),
    public.alunni_docente_importa(text, integer, text, jsonb, boolean),
    public.alunni_docente_codice(text, uuid), public.alunni_docente_revoca(text, uuid),
    public.alunni_docente_candidati(text, integer, text),
    public.alunni_docente_collega(text, uuid, uuid, text),
    public.alunni_docente_collegamenti(text, integer, text),
    public.alunni_docente_annulla(text, uuid, text), public.alunni_docente_sblocca(text, uuid),
    public.alunni_docente_registro(text, integer)
    to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. Nessun salvataggio esistente deve risultare cambiato
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
      into v_dopo
      from public.progress;
    if v_prima.righe <> v_dopo.righe or v_prima.impronta <> v_dopo.impronta
       or exists (select 1 from public.progress where profilo_id is not null or protetto) then
        raise exception 'La migrazione altererebbe salvataggi preesistenti';
    end if;
end;
$$;

commit;
