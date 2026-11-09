set local lock_timeout = '5s';

create table private.verifica_operatore_restituzioni (
    elaborato_id uuid primary key references private.verifica_operatore_elaborati(id) on delete cascade,
    bozza jsonb not null,
    pubblicata jsonb,
    revisione integer not null default 1
);
alter table private.verifica_operatore_restituzioni enable row level security;
revoke all on private.verifica_operatore_restituzioni from public, anon, authenticated;

create function public.verifica_operatore_restituzione_salva(
    p_token text, p_id uuid, p_bozza jsonb, p_mostra boolean, p_revisione integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
    ed smallint;
    massimi integer[];
    bonus integer;
    voto integer;
    punti numeric;
    totale numeric := 0;
    compilate integer := 0;
    i integer;
    riga jsonb;
    righe jsonb := '[]'::jsonb;
    visibile jsonb;
    esito private.verifica_operatore_restituzioni;
begin
    if private.progress_docente_sessione_ok(p_token) is not true then
        raise exception 'Sessione docente richiesta.' using errcode = '42501';
    end if;
    select edizione into ed from private.verifica_operatore_elaborati
    where id = p_id and consegnato_il is not null and edizione in (3,4);
    if not found then
        raise exception 'Serve un elaborato consegnato di questa verifica.' using errcode = '22023';
    end if;
    if jsonb_typeof(p_bozza) is distinct from 'object'
       or jsonb_typeof(p_bozza->'sezioni') is distinct from 'array'
       or p_revisione is null or p_revisione < 0 or p_mostra is null then
        raise exception 'Rileggi i dati della valutazione.' using errcode = '22023';
    end if;
    if jsonb_array_length(p_bozza->'sezioni') <> 5
       or p_bozza->>'bonus' is null or p_bozza->>'bonus' not in ('0','1')
       or (ed = 4 and p_bozza->>'bonus' <> '0')
       or coalesce(p_bozza->>'voto','0') !~ '^(10|[0-9])$' then
        raise exception 'Controlla i punteggi, il bonus e il voto.' using errcode = '22023';
    end if;
    massimi := case when ed = 3 then array[7,4,8,8,12] else array[8,4,8,8,12] end;
    bonus := (p_bozza->>'bonus')::integer;
    voto := (p_bozza->>'voto')::integer;
    for i in 1..5 loop
        riga := p_bozza->'sezioni'->(i-1);
        if jsonb_typeof(riga) is distinct from 'object'
           or jsonb_typeof(riga->'commento') is distinct from 'string'
           or char_length(riga->>'commento') > 600
           or jsonb_typeof(riga->'punti') is null
           or jsonb_typeof(riga->'punti') not in ('null','number') then
            raise exception 'Controlla il punteggio e il commento di ciascuna sezione.' using errcode = '22023';
        end if;
        punti := (riga->>'punti')::numeric;
        if punti is not null then
            if punti < 0 or punti > massimi[i] or mod(punti, 0.5) <> 0 then
                raise exception 'Usa punteggi interi o mezzi punti entro il massimo della sezione.' using errcode = '22023';
            end if;
            totale := totale + punti;
            compilate := compilate + 1;
        end if;
        righe := righe || jsonb_build_array(jsonb_build_object('punti',punti,'commento',btrim(riga->>'commento')));
    end loop;
    p_bozza := jsonb_build_object('sezioni',righe,'bonus',bonus,'voto',voto);
    if p_mostra then
        if compilate <> 5 then
            raise exception 'Completa i cinque punteggi prima di mostrare la correzione.' using errcode = '22023';
        end if;
        voto := coalesce(voto, least(10,round((totale + bonus) * 10 / case when ed = 3 then 39 else 40 end)::integer));
        select jsonb_build_object(
            'valutazione', jsonb_set(p_bozza,'{voto}',to_jsonb(voto),true),
            'commenti', coalesce(jsonb_object_agg(quesito,testo),'{}'::jsonb)
        ) into visibile
        from private.verifica_operatore_commenti where elaborato_id = p_id;
    end if;
    insert into private.verifica_operatore_restituzioni as r(elaborato_id,bozza,pubblicata)
    select p_id,p_bozza,visibile
    where p_revisione=0 or exists (select 1 from private.verifica_operatore_restituzioni where elaborato_id=p_id)
    on conflict (elaborato_id) do update
       set bozza=excluded.bozza, pubblicata=coalesce(excluded.pubblicata,r.pubblicata), revisione=r.revisione+1
       where r.revisione=p_revisione
    returning * into esito;
    if not found then
        raise exception 'La valutazione è stata aggiornata in un’altra scheda. Riapri l’elaborato.' using errcode = '40001';
    end if;
    return jsonb_build_object('bozza',esito.bozza,'visibile',esito.pubblicata is not null,'revisione',esito.revisione);
end;
$$;

create function public.verifica_operatore_restituzione_leggi(p_chiave text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
    select r.pubblicata || jsonb_build_object('chiave_scelte', d.chiave_scelte)
    from private.verifica_operatore_restituzioni r
    join private.verifica_operatore_elaborati e on e.id = r.elaborato_id
    join private.verifica_operatore_edizioni d on d.numero = e.edizione
    where p_chiave ~ '^[a-f0-9]{64}$'
      and e.chiave_hash = extensions.digest(p_chiave,'sha256')
      and e.consegnato_il is not null and r.pubblicata is not null;
$$;

revoke all on function public.verifica_operatore_restituzione_salva(text,uuid,jsonb,boolean,integer) from public;
revoke all on function public.verifica_operatore_restituzione_leggi(text) from public;
grant execute on function public.verifica_operatore_restituzione_salva(text,uuid,jsonb,boolean,integer) to anon, authenticated;
grant execute on function public.verifica_operatore_restituzione_leggi(text) to anon, authenticated;

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
            'consegnato_il', e.consegnato_il, 'edizione', e.edizione, 'sezioni', c.sezioni,
            'chiave_scelte', c.chiave_scelte, 'commenti', coalesce((
                select jsonb_object_agg(f.quesito, f.testo)
                from private.verifica_operatore_commenti f where f.elaborato_id = e.id
            ), '{}'::jsonb), 'restituzione', (
                select jsonb_build_object('bozza', r.bozza, 'visibile', r.pubblicata is not null, 'revisione', r.revisione)
                from private.verifica_operatore_restituzioni r where r.elaborato_id=e.id
            ))
        from private.verifica_operatore_elaborati as e
        join private.verifica_operatore_edizioni as c on c.numero = e.edizione
        where e.id = p_id
    );
end;
$$;
