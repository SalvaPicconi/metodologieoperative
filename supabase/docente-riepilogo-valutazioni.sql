-- Elenco lavori per l'Area docente con le sole informazioni necessarie al riepilogo dei voti.
-- I dettagli continuano a usare le funzioni delle singole attività.
begin;

create or replace function public.docente_riepilogo_valutazioni(
    p_token text, p_limite integer default 1000
)
returns jsonb
language plpgsql security definer set search_path to ''
as $$
begin
    perform private.alunni_docente(p_token);

    return (
        with elaborati as (
            select 'lavori' as fonte, to_jsonb(r) as riga, r.school_year, r.class_code,
                   r.student_code, p.profilo_id, r.updated_at, r.id,
                   c.pubblicata as valutazione,
                   case
                       when c.pubblicata is not null
                         and c.pubblicata->>'nota' like 'Attività da completare.%'
                         and nullif(btrim(c.pubblicata->>'voto'), '') is null then 'in_corso'
                       when c.pubblicata is not null then 'pubblicata'
                       when c.progress_id is not null then 'bozza'
                       when e.page_path is not null then 'da_correggere'
                       else 'senza_valutazione'
                   end as stato
              from public.progress_docente_elenco_con_anno(p_token, p_limite) r
              join public.progress p on p.id = r.id
              left join private.verifiche_correzioni c on c.progress_id = r.id
              left join private.verifiche_elenco e on e.page_path = private.alunni_percorso(r.page_path)
            union all
            select 'operatore',
                   jsonb_build_object('id', e.id, 'class_code', e.classe, 'student_code', e.codice,
                       'updated_at', e.aggiornato_il, 'edizione', e.edizione,
                       'consegnato_il', e.consegnato_il,
                       'school_year', private.progress_school_year(coalesce(e.consegnato_il, e.aggiornato_il))),
                   private.progress_school_year(coalesce(e.consegnato_il, e.aggiornato_il)),
                   e.classe, e.codice, null::uuid, e.aggiornato_il, e.id,
                   case when e.consegnato_il is not null then c.pubblicata->'valutazione' end,
                   case
                       when e.consegnato_il is null then 'in_corso'
                       when c.pubblicata is not null then 'pubblicata'
                       when c.elaborato_id is not null then 'bozza'
                       else 'da_correggere'
                   end
              from private.verifica_operatore_elaborati e
              left join private.verifica_operatore_restituzioni c on c.elaborato_id = e.id
        ), iscrizioni as materialized (
            select i.id, i.profilo_id, i.school_year, cl.sigla as classe, i.codice
              from private.alunni_iscrizioni i
              join private.alunni_classi cl on cl.id = i.classe_id
             where i.school_year in (select school_year from elaborati)
        ), codici as (
            select i.school_year, g.classe as classe_salvata, g.codice as codice_salvato,
                   max(i.classe) as classe, max(i.codice) as codice
              from iscrizioni i
              cross join lateral private.alunni_grafie(i.id) g
             group by i.school_year, g.classe, g.codice
            having count(*) = 1
        ), riepilogo as (
            select l.fonte, l.updated_at, l.id,
                   l.riga || jsonb_build_object(
                       'classe_confermata', coalesce(i.classe, g.classe),
                       'codice_confermato', coalesce(i.codice, g.codice),
                       'valutazione', jsonb_build_object(
                           'stato', l.stato,
                           'voto', nullif(btrim(l.valutazione->>'voto'), ''),
                           'competenza', nullif(btrim(l.valutazione->'competenza'->>'codice'), ''),
                           'livello', nullif(btrim(l.valutazione->'competenza'->>'livello'), '')
                       )
                   ) as riga
              from elaborati l
              left join iscrizioni i on i.profilo_id = l.profilo_id and i.school_year = l.school_year
              left join codici g on l.profilo_id is null and g.school_year = l.school_year
                and g.classe_salvata = private.alunni_sigla(l.class_code)
                and g.codice_salvato = private.alunni_codice(l.student_code)
        )
        select jsonb_build_object(
            'lavori', coalesce(jsonb_agg(riga order by updated_at desc nulls last, id)
                filter (where fonte = 'lavori'), '[]'::jsonb),
            'operatore', coalesce(jsonb_agg(riga order by updated_at desc nulls last, id)
                filter (where fonte = 'operatore'), '[]'::jsonb)
        ) from riepilogo
    );
end;
$$;

revoke all on function public.docente_riepilogo_valutazioni(text, integer) from public, anon, authenticated;
grant execute on function public.docente_riepilogo_valutazioni(text, integer) to anon, authenticated;

commit;
