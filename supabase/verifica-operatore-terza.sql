create table private.verifica_operatore_config (
    singleton boolean primary key default true check (singleton),
    password_hash bytea not null,
    sezioni jsonb not null check (jsonb_typeof(sezioni) = 'array')
);

create table private.verifica_operatore_elaborati (
    id uuid primary key default gen_random_uuid(),
    classe text not null,
    codice text not null,
    chiave_hash bytea not null unique,
    risposte jsonb not null default '{}',
    aggiornato_il timestamptz not null default now(),
    consegnato_il timestamptz,
    unique (classe, codice)
);

alter table private.verifica_operatore_config enable row level security;
alter table private.verifica_operatore_elaborati enable row level security;
revoke all on private.verifica_operatore_config, private.verifica_operatore_elaborati from public, anon, authenticated;

create function public.verifica_operatore_apri(p_password text, p_classe text, p_codice text, p_chiave text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
    prova private.verifica_operatore_config;
    elaborato private.verifica_operatore_elaborati;
    impronta bytea;
begin
    if p_password is null or length(p_password) > 128
       or p_classe is null or p_classe !~ '^3[a-z]{1,2}$'
       or p_codice is null or p_codice !~ '^[a-zà-ü]{2,59}[a-z]$'
       or p_chiave is null or p_chiave !~ '^[a-f0-9]{64}$' then
        raise exception 'Controlla classe, codice e password.' using errcode = '22023';
    end if;
    select * into prova from private.verifica_operatore_config where singleton;
    if not found or prova.password_hash <> extensions.digest(p_password, 'sha256') then
        raise exception 'Password della verifica non valida.' using errcode = '28P01';
    end if;
    impronta := extensions.digest(p_chiave, 'sha256');
    insert into private.verifica_operatore_elaborati (classe, codice, chiave_hash)
    values (p_classe, p_codice, impronta)
    on conflict (classe, codice) do nothing;
    select * into elaborato from private.verifica_operatore_elaborati
      where classe = p_classe and codice = p_codice and chiave_hash = impronta;
    if not found then
        raise exception 'Questa prova è già stata avviata. Usa il browser con cui l’hai aperta.' using errcode = '42501';
    end if;
    return jsonb_build_object('sezioni', prova.sezioni, 'risposte', elaborato.risposte, 'consegnato_il', elaborato.consegnato_il);
end;
$$;

create function public.verifica_operatore_salva(p_chiave text, p_risposte jsonb, p_consegna boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
    elaborato private.verifica_operatore_elaborati;
begin
    if p_chiave is null or p_chiave !~ '^[a-f0-9]{64}$' then
        raise exception 'Accesso alla prova richiesto.' using errcode = '42501';
    end if;
    if p_risposte is null or jsonb_typeof(p_risposte) <> 'object' or octet_length(p_risposte::text) > 250000 then
        raise exception 'Le risposte superano la lunghezza consentita.' using errcode = '22023';
    end if;
    if exists (
        select 1 from jsonb_each(p_risposte) as r
        where jsonb_typeof(r.value) <> 'string' or char_length(r.value #>> '{}') > 5000
            or not exists (
                select 1 from private.verifica_operatore_config as c
                cross join lateral jsonb_array_elements(c.sezioni) as s
                cross join lateral jsonb_array_elements(s->'elementi') as e
                where e->>'id' = r.key
            )
    ) then
        raise exception 'Una risposta non corrisponde alla verifica.' using errcode = '22023';
    end if;
    select * into elaborato from private.verifica_operatore_elaborati
      where chiave_hash = extensions.digest(p_chiave, 'sha256') for update;
    if not found then
        raise exception 'Accesso alla prova richiesto.' using errcode = '42501';
    end if;
    if elaborato.consegnato_il is null then
        update private.verifica_operatore_elaborati
           set risposte = p_risposte, aggiornato_il = now(),
               consegnato_il = case when p_consegna then now() else null end
         where id = elaborato.id
         returning * into elaborato;
    end if;
    return jsonb_build_object('consegnato_il', elaborato.consegnato_il);
end;
$$;

create function public.verifica_operatore_docente(p_token text, p_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
    if private.progress_docente_sessione_ok(p_token) is not true then
        raise exception 'Sessione docente richiesta.' using errcode = '42501';
    end if;
    if p_id is null then
        return coalesce((
            select jsonb_agg(jsonb_build_object('id', id, 'classe', classe, 'codice', codice,
                'consegnato_il', consegnato_il, 'aggiornato_il', aggiornato_il) order by classe, codice)
            from private.verifica_operatore_elaborati
        ), '[]'::jsonb);
    end if;
    return (
        select jsonb_build_object('classe', e.classe, 'codice', e.codice, 'risposte', e.risposte,
             'consegnato_il', e.consegnato_il, 'sezioni', c.sezioni)
        from private.verifica_operatore_elaborati as e
        cross join private.verifica_operatore_config as c
        where e.id = p_id
    );
end;
$$;

revoke all on function public.verifica_operatore_apri(text,text,text,text),
    public.verifica_operatore_salva(text,jsonb,boolean), public.verifica_operatore_docente(text,uuid)
    from public;
grant execute on function public.verifica_operatore_apri(text,text,text,text),
    public.verifica_operatore_salva(text,jsonb,boolean), public.verifica_operatore_docente(text,uuid)
    to anon, authenticated;
