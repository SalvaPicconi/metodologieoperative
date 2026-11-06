-- Le aperture delle due versioni sono indipendenti. Nessuna risposta esistente viene riscritta.
set local lock_timeout = '5s';
alter table private.verifica_operatore_edizioni add column password_hash bytea;

create unique index verifica_operatore_elaborati_identita_versione
    on private.verifica_operatore_elaborati (classe, codice, (edizione = 4));
alter table private.verifica_operatore_elaborati
    drop constraint verifica_operatore_elaborati_classe_codice_key;

create or replace function private.verifica_operatore_apri_con_limite(p_password text, p_classe text, p_codice text, p_chiave text, p_edizione_massima integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
    numero_edizione smallint;
    password_hash bytea;
    versione_b boolean := p_edizione_massima = 4;
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
    if versione_b then
        select e.numero, e.password_hash into numero_edizione, password_hash
          from private.verifica_operatore_edizioni e where e.numero = 4;
    else
        select c.edizione, c.password_hash into numero_edizione, password_hash
          from private.verifica_operatore_config c where c.singleton;
    end if;
    if password_hash is null or password_hash <> extensions.digest(p_password, 'sha256') then
        raise exception 'Password della verifica non valida.' using errcode = '28P01';
    end if;
    impronta := extensions.digest(p_chiave, 'sha256');
    if numero_edizione <= p_edizione_massima then
        insert into private.verifica_operatore_elaborati (classe, codice, chiave_hash, edizione)
        values (p_classe, p_codice, impronta, numero_edizione)
        on conflict (classe, codice, (edizione = 4)) do nothing;
    end if;
    select * into elaborato from private.verifica_operatore_elaborati
      where classe = p_classe and codice = p_codice and chiave_hash = impronta
        and (edizione = 4) = versione_b;
    if (not found and numero_edizione > p_edizione_massima) or elaborato.edizione > p_edizione_massima then
        raise exception 'Ricarica la pagina per aprire la versione aggiornata della verifica.' using errcode = '22023';
    end if;
    if not found then
        raise exception 'Questa prova è già stata avviata. Usa il browser con cui l’hai aperta.' using errcode = '42501';
    end if;
    select sezioni into domande from private.verifica_operatore_edizioni where numero = elaborato.edizione;
    if elaborato.edizione between 2 and 3 and not elaborato.seconda_fase then
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

create or replace function private.verifica_operatore_apri_edizione(
    p_password text, p_classe text, p_codice text, p_chiave text, p_interattivo boolean)
returns jsonb
language sql security definer set search_path = ''
as $$
    select private.verifica_operatore_apri_con_limite(
        p_password, p_classe, p_codice, p_chiave, case when p_interattivo then 3 else 1 end);
$$;

create function public.verifica_operatore_apri_b(p_password text, p_classe text, p_codice text, p_chiave text)
returns jsonb
language sql security definer set search_path = ''
as $$
    select private.verifica_operatore_apri_con_limite(p_password, p_classe, p_codice, p_chiave, 4);
$$;
revoke all on function public.verifica_operatore_apri_b(text,text,text,text) from public;
grant execute on function public.verifica_operatore_apri_b(text,text,text,text) to anon, authenticated;

create or replace function public.verifica_operatore_salva(p_chiave text, p_risposte jsonb, p_consegna boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
    elaborato private.verifica_operatore_elaborati;
    domande jsonb;
    aggiornamenti jsonb := p_risposte;
    campi_iniziali text[];
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
    if elaborato.edizione between 2 and 3 and p_consegna and not elaborato.seconda_fase then
        raise exception 'Apri il nuovo dato prima di consegnare.' using errcode = '22023';
    end if;
    if elaborato.seconda_fase then
        select array(select e->>'id' from jsonb_array_elements(domande) as s
            cross join lateral jsonb_array_elements(s->'elementi') as e
            where e->>'iniziale' = 'true') into campi_iniziali;
        aggiornamenti := p_risposte - campi_iniziali;
    end if;
    update private.verifica_operatore_elaborati
       set risposte = elaborato.risposte || aggiornamenti, aggiornato_il = now(),
           consegnato_il = case when p_consegna then now() else null end
     where id = elaborato.id
     returning * into elaborato;
    return jsonb_build_object('consegnato_il', elaborato.consegnato_il);
end;
$$;

create or replace function public.verifica_operatore_apri_seconda_fase(p_chiave text, p_risposte jsonb)
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
    if not found or elaborato.edizione not between 2 and 3 or elaborato.consegnato_il is not null then
        raise exception 'Seconda fase non disponibile.' using errcode = '42501';
    end if;
    select sezioni into domande from private.verifica_operatore_edizioni where numero = elaborato.edizione;
    if not elaborato.seconda_fase then
        if exists (
            select 1 from jsonb_array_elements(domande) as s
            cross join lateral jsonb_array_elements(s->'elementi') as e
            where e->>'iniziale' = 'true' and length(btrim(coalesce(p_risposte->>(e->>'id'), ''))) = 0
        ) then
            raise exception 'Completa la proposta iniziale prima di aprire il nuovo dato.' using errcode = '22023';
        end if;
        if elaborato.edizione = 2 and p_risposte->>'5.3a' = p_risposte->>'5.3b' then
            raise exception 'Scegli due azioni diverse.' using errcode = '22023';
        end if;
        perform public.verifica_operatore_salva(p_chiave, p_risposte, false);
        update private.verifica_operatore_elaborati set seconda_fase = true
         where id = elaborato.id returning * into elaborato;
    end if;
    return jsonb_build_object('sezioni', domande, 'risposte', elaborato.risposte, 'seconda_fase', true);
end;
$$;

create function public.verifica_operatore_anteprima_b_docente(p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
    if private.progress_docente_sessione_ok(p_token) is not true then
        raise exception 'Sessione docente richiesta.' using errcode = '42501';
    end if;
    return (
        select jsonb_build_object('sezioni', e.sezioni, 'edizione', e.numero)
        from private.verifica_operatore_edizioni e where e.numero = 4
    );
end;
$$;

revoke all on function public.verifica_operatore_anteprima_b_docente(text) from public;
grant execute on function public.verifica_operatore_anteprima_b_docente(text) to anon, authenticated;

create function public.verifica_operatore_cartacea_b_docente(p_token text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
    pdf bytea;
begin
    if private.progress_docente_sessione_ok(p_token) is not true then
        raise exception 'Sessione docente richiesta.' using errcode = '42501';
    end if;
    select modello_cartaceo into pdf from private.verifica_operatore_edizioni where numero = 4;
    if pdf is null then
        raise exception 'Il modello cartaceo non è disponibile.' using errcode = 'P0002';
    end if;
    return encode(pdf, 'base64');
end;
$$;

revoke all on function public.verifica_operatore_cartacea_b_docente(text) from public;
grant execute on function public.verifica_operatore_cartacea_b_docente(text) to anon, authenticated;
