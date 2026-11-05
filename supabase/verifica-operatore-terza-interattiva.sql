-- La configurazione corrente serve le nuove aperture. Ogni elaborato conserva la sua edizione.
create table private.verifica_operatore_edizioni (
    numero smallint primary key,
    sezioni jsonb not null check (jsonb_typeof(sezioni) = 'array'),
    modello_cartaceo bytea
);
alter table private.verifica_operatore_edizioni enable row level security;
revoke all on private.verifica_operatore_edizioni from public, anon, authenticated;
insert into private.verifica_operatore_edizioni (numero, sezioni, modello_cartaceo)
select 1, sezioni, modello_cartaceo from private.verifica_operatore_config where singleton;

alter table private.verifica_operatore_config
    add column edizione smallint not null default 1 references private.verifica_operatore_edizioni(numero);
alter table private.verifica_operatore_elaborati
    add column edizione smallint not null default 1 references private.verifica_operatore_edizioni(numero),
    add column seconda_fase boolean not null default false;

create function private.verifica_operatore_apri_edizione(p_password text, p_classe text, p_codice text, p_chiave text, p_interattivo boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
    prova private.verifica_operatore_config;
    elaborato private.verifica_operatore_elaborati;
    impronta bytea;
    domande jsonb;
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
    if p_interattivo or prova.edizione = 1 then
        insert into private.verifica_operatore_elaborati (classe, codice, chiave_hash, edizione)
        values (p_classe, p_codice, impronta, prova.edizione)
        on conflict (classe, codice) do nothing;
    end if;
    select * into elaborato from private.verifica_operatore_elaborati
      where classe = p_classe and codice = p_codice and chiave_hash = impronta;
    if not p_interattivo and ((not found and prova.edizione = 2) or elaborato.edizione = 2) then
        raise exception 'Ricarica la pagina per aprire la verifica interattiva.' using errcode = '22023';
    end if;
    if not found then
        raise exception 'Questa prova è già stata avviata. Usa il browser con cui l’hai aperta.' using errcode = '42501';
    end if;
    select sezioni into domande from private.verifica_operatore_edizioni where numero = elaborato.edizione;
    if elaborato.edizione = 2 and not elaborato.seconda_fase then
        select jsonb_agg(jsonb_set(s.value, '{elementi}', coalesce((
            select jsonb_agg(e.value order by e.pos)
            from jsonb_array_elements(s.value->'elementi') with ordinality as e(value,pos)
            where e.value->>'fase' is distinct from '2'
        ), '[]'::jsonb)) order by s.pos) into domande
        from jsonb_array_elements(domande) with ordinality as s(value,pos);
    end if;
    return jsonb_build_object('sezioni', domande, 'risposte', elaborato.risposte,
        'consegnato_il', elaborato.consegnato_il, 'edizione', elaborato.edizione, 'seconda_fase', elaborato.seconda_fase);
end;
$$;

revoke all on function private.verifica_operatore_apri_edizione(text,text,text,text,boolean)
    from public, anon, authenticated;

create or replace function public.verifica_operatore_apri(p_password text, p_classe text, p_codice text, p_chiave text)
returns jsonb
language sql security definer set search_path = ''
as $$
    select private.verifica_operatore_apri_edizione(p_password, p_classe, p_codice, p_chiave, false);
$$;

create function public.verifica_operatore_apri_interattiva(p_password text, p_classe text, p_codice text, p_chiave text)
returns jsonb
language sql security definer set search_path = ''
as $$
    select private.verifica_operatore_apri_edizione(p_password, p_classe, p_codice, p_chiave, true);
$$;

revoke all on function public.verifica_operatore_apri_interattiva(text,text,text,text) from public;
grant execute on function public.verifica_operatore_apri_interattiva(text,text,text,text) to anon, authenticated;

create or replace function public.verifica_operatore_salva(p_chiave text, p_risposte jsonb, p_consegna boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
    elaborato private.verifica_operatore_elaborati;
    domande jsonb;
    aggiornamenti jsonb := p_risposte;
begin
    if p_chiave is null or p_chiave !~ '^[a-f0-9]{64}$' then
        raise exception 'Accesso alla prova richiesto.' using errcode = '42501';
    end if;
    if p_risposte is null or jsonb_typeof(p_risposte) <> 'object' or octet_length(p_risposte::text) > 250000 then
        raise exception 'Le risposte superano la lunghezza consentita.' using errcode = '22023';
    end if;
    select * into elaborato from private.verifica_operatore_elaborati
      where chiave_hash = extensions.digest(p_chiave, 'sha256') for update;
    if not found then
        raise exception 'Accesso alla prova richiesto.' using errcode = '42501';
    end if;
    if elaborato.consegnato_il is not null then
        return jsonb_build_object('consegnato_il', elaborato.consegnato_il);
    end if;
    select sezioni into domande from private.verifica_operatore_edizioni where numero = elaborato.edizione;
    if exists (
        select 1 from jsonb_each(p_risposte) as r
        where jsonb_typeof(r.value) <> 'string' or char_length(r.value #>> '{}') > 5000
            or not exists (
                select 1 from jsonb_array_elements(domande) as s
                cross join lateral jsonb_array_elements(s->'elementi') as e
                where e->>'id' = r.key
                    and (e->>'fase' is distinct from '2' or elaborato.seconda_fase)
                    and (r.value = '""'::jsonb or not (e ? 'opzioni') or (e->'opzioni') @> jsonb_build_array(r.value))
            )
    ) then
        raise exception 'Una risposta non corrisponde alla verifica.' using errcode = '22023';
    end if;
    if elaborato.edizione = 2 and p_consegna and not elaborato.seconda_fase then
        raise exception 'Apri il nuovo dato prima di consegnare.' using errcode = '22023';
    end if;
    if elaborato.seconda_fase then
        aggiornamenti := p_risposte - array['5.1','5.2','5.3a','5.3b','5.3c'];
    end if;
    update private.verifica_operatore_elaborati
       set risposte = elaborato.risposte || aggiornamenti, aggiornato_il = now(),
           consegnato_il = case when p_consegna then now() else null end
     where id = elaborato.id
     returning * into elaborato;
    return jsonb_build_object('consegnato_il', elaborato.consegnato_il);
end;
$$;

create function public.verifica_operatore_apri_seconda_fase(p_chiave text, p_risposte jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
    elaborato private.verifica_operatore_elaborati;
    domande jsonb;
begin
    if p_chiave is null or p_chiave !~ '^[a-f0-9]{64}$' then
        raise exception 'Accesso alla prova richiesto.' using errcode = '42501';
    end if;
    select * into elaborato from private.verifica_operatore_elaborati
      where chiave_hash = extensions.digest(p_chiave, 'sha256') for update;
    if not found or elaborato.edizione <> 2 or elaborato.consegnato_il is not null then
        raise exception 'Seconda fase non disponibile.' using errcode = '42501';
    end if;
    if not elaborato.seconda_fase then
        if exists (
            select 1 from unnest(array['5.1','5.2','5.3a','5.3b','5.3c']) as k
            where length(btrim(coalesce(p_risposte->>k, ''))) = 0
        ) then
            raise exception 'Completa la proposta iniziale prima di aprire il nuovo dato.' using errcode = '22023';
        end if;
        if p_risposte->>'5.3a' = p_risposte->>'5.3b' then
            raise exception 'Scegli due azioni diverse.' using errcode = '22023';
        end if;
        perform public.verifica_operatore_salva(p_chiave, p_risposte, false);
        update private.verifica_operatore_elaborati set seconda_fase = true
         where id = elaborato.id returning * into elaborato;
    end if;
    select sezioni into domande from private.verifica_operatore_edizioni where numero = 2;
    return jsonb_build_object('sezioni', domande, 'risposte', elaborato.risposte, 'seconda_fase', true);
end;
$$;

create or replace function public.verifica_operatore_docente(p_token text, p_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
    if private.progress_docente_sessione_ok(p_token) is not true then
        raise exception 'Sessione docente richiesta.' using errcode = '42501';
    end if;
    if p_id is null then
        return coalesce((
            select jsonb_agg(jsonb_build_object('id', id, 'classe', classe, 'codice', codice, 'edizione', edizione,
                'consegnato_il', consegnato_il, 'aggiornato_il', aggiornato_il) order by classe, codice)
            from private.verifica_operatore_elaborati
        ), '[]'::jsonb);
    end if;
    return (
        select jsonb_build_object('classe', e.classe, 'codice', e.codice, 'risposte', e.risposte,
            'consegnato_il', e.consegnato_il, 'edizione', e.edizione, 'sezioni', c.sezioni)
        from private.verifica_operatore_elaborati as e
        join private.verifica_operatore_edizioni as c on c.numero = e.edizione
        where e.id = p_id
    );
end;
$$;

revoke all on function public.verifica_operatore_apri_seconda_fase(text,jsonb) from public;
grant execute on function public.verifica_operatore_apri_seconda_fase(text,jsonb) to anon, authenticated;
