-- Il catalogo Carola resta fuori da Git e dai file serviti da GitHub Pages.
create table if not exists private.programmi_cataloghi (
    catalogo text primary key check (catalogo = 'carola'),
    documento jsonb not null check (jsonb_typeof(documento) = 'object'),
    sorgenti jsonb not null check (jsonb_typeof(sorgenti) = 'array'),
    piano_integrazione jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);
alter table private.programmi_cataloghi enable row level security;
revoke all on private.programmi_cataloghi from public, anon, authenticated;

create or replace function public.leggi_programmazione_carola()
returns jsonb
language sql stable security definer set search_path = ''
as $$
    select documento from private.programmi_cataloghi where catalogo = 'carola';
$$;
revoke all on function public.leggi_programmazione_carola() from public, anon, authenticated;
grant execute on function public.leggi_programmazione_carola() to service_role;
