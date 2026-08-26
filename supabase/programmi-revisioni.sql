-- Schema di riferimento dell'area riservata Programmi SSAS.
-- Applicato al progetto Supabase gia usato dal sito.
-- L'hash della password e conservato soltanto nel database remoto e non in Git.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.programmi_revision_config (
    singleton boolean primary key default true check (singleton),
    password_hash text not null,
    updated_at timestamptz not null default now()
);
revoke all on table private.programmi_revision_config from public, anon, authenticated;

create or replace function public.verifica_programmi_password(p_password text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(
        (
            select extensions.crypt(p_password, config.password_hash) = config.password_hash
            from private.programmi_revision_config as config
            where config.singleton
        ),
        false
    );
$$;

revoke all on function public.verifica_programmi_password(text) from public, anon, authenticated;
grant execute on function public.verifica_programmi_password(text) to service_role;

create table if not exists public.programmi_revisioni (
    id uuid primary key default gen_random_uuid(),
    module_key text not null unique,
    anno text not null,
    numero text not null default '',
    titolo_modulo text not null,
    originale jsonb not null default '{}'::jsonb,
    modifiche jsonb not null default '{}'::jsonb,
    nota_generale text not null default '',
    stato text not null default 'bozza'
        check (stato in ('bozza', 'approvata', 'applicata', 'archiviata')),
    source_version text,
    updated_by text not null default 'accesso-password',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (jsonb_typeof(originale) = 'object'),
    check (jsonb_typeof(modifiche) = 'object'),
    check (nota_generale <> '' or modifiche <> '{}'::jsonb)
);

comment on table public.programmi_revisioni is
    'Annotazioni e modifiche in bozza: non sostituiscono i file sorgente pubblicati.';

create index if not exists programmi_revisioni_stato_idx
    on public.programmi_revisioni (stato, updated_at desc);

alter table public.programmi_revisioni enable row level security;
revoke all on table public.programmi_revisioni from anon, authenticated;
grant select, insert, update, delete on table public.programmi_revisioni to service_role;

create table if not exists public.programmi_revision_sessions (
    token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);

comment on table public.programmi_revision_sessions is
    'Sessioni temporanee dell area riservata Programmi SSAS; contiene solo hash dei token.';

alter table public.programmi_revision_sessions enable row level security;
revoke all on table public.programmi_revision_sessions from anon, authenticated;
grant select, insert, update, delete on table public.programmi_revision_sessions to service_role;

create policy "nessun accesso client alle sessioni programmi"
    on public.programmi_revision_sessions
    for all
    to anon, authenticated
    using (false)
    with check (false);
