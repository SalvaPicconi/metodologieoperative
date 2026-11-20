-- Metodologie Operative · correzione comune delle verifiche online (sommative di biennio, terza, quarta e
-- verifica sull'intelligenza artificiale), sul modello della verifica «L'operatore sociale».
-- Richiesta del titolare del 20/11/2026. Le risposte restano dove sono (public.progress): qui si aggiunge solo
-- la correzione del docente, riservata finché non preme «Mostra all'alunno».
-- Sezioni, massimi e regola del voto stanno in assets/verifiche-correzione.json (le legge la pagina docente);
-- la correzione pubblicata contiene una copia di ciò che l'alunno deve vedere.
begin;

set local lock_timeout = '5s';

create table private.verifiche_elenco (
    page_path text primary key check (page_path ~ '^/'),
    chiave text not null check (chiave ~ '^[a-z0-9-]{3,40}$'),
    titolo text not null
);
insert into private.verifiche_elenco (page_path, chiave, titolo) values
    ('/materiali/biennio/verifica_sommativa_q1.html', 'sommativa-biennio', 'Verifica sommativa · biennio'),
    ('/materiali/terzo/verifica_sommativa_q1.html', 'sommativa-terzo', 'Verifica sommativa · terzo anno'),
    ('/materiali/quarto/verifica_sommativa_q1.html', 'sommativa-quarto', 'Verifica sommativa · quarto anno'),
    ('/materiali/ai/verifica_ia_modificata.html', 'verifica-ia', 'Verifica sull’intelligenza artificiale'),
    ('/attivita-materiali-ai-verifica-ia-modificata-01', 'verifica-ia', 'Verifica sull’intelligenza artificiale');

create table private.verifiche_correzioni (
    progress_id uuid primary key references public.progress (id),
    bozza jsonb not null check (jsonb_typeof(bozza) = 'object'),
    pubblicata jsonb check (pubblicata is null or jsonb_typeof(pubblicata) = 'object'),
    revisione integer not null default 0,
    aggiornata_il timestamptz not null default now(),
    pubblicata_il timestamptz
);
alter table private.verifiche_elenco enable row level security;
alter table private.verifiche_correzioni enable row level security;
revoke all on private.verifiche_elenco, private.verifiche_correzioni from public, anon, authenticated;

-- Elaborati di una verifica (tutti gli anni), con lo stato della correzione.
create function public.verifiche_docente_elaborati(p_token text, p_chiave text)
returns table (id uuid, class_code text, student_code text, school_year integer, updated_at timestamptz, stato text)
language plpgsql volatile security definer set search_path to '' as $$
declare
    v_doc text := private.alunni_docente(p_token);
begin
    return query
        select p.id, p.class_code, p.student_code, p.school_year, p.updated_at,
               case when c.pubblicata is not null then 'visibile'
                    when c.progress_id is not null then 'bozza' else 'da_correggere' end
          from public.progress p
          join private.verifiche_elenco e on e.page_path = private.alunni_percorso(p.page_path)
          left join private.verifiche_correzioni c on c.progress_id = p.id
         where e.chiave = p_chiave
         order by p.school_year desc, private.alunni_sigla(p.class_code), private.alunni_codice(p.student_code);
end;
$$;

create function public.verifiche_docente_apri(p_token text, p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
    v_doc text := private.alunni_docente(p_token);
begin
    return (select jsonb_build_object(
                'id', p.id, 'chiave', e.chiave, 'class_code', p.class_code, 'student_code', p.student_code,
                'school_year', p.school_year, 'updated_at', p.updated_at, 'data', p.data,
                'bozza', c.bozza, 'pubblicata', c.pubblicata, 'revisione', coalesce(c.revisione, 0))
              from public.progress p
              join private.verifiche_elenco e on e.page_path = private.alunni_percorso(p.page_path)
              left join private.verifiche_correzioni c on c.progress_id = p.id
             where p.id = p_id);
end;
$$;

-- Salva la correzione. «Mostra all'alunno» (p_mostra) la rende visibile; altrimenti resta riservata.
-- p_revisione deve essere quella letta: se un'altra scheda ha salvato nel frattempo, non si sovrascrive.
create function public.verifiche_docente_salva(p_token text, p_id uuid, p_bozza jsonb, p_mostra boolean, p_revisione integer)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
    v_doc text := private.alunni_docente(p_token);
    v_rev integer;
begin
    if p_bozza is null or jsonb_typeof(p_bozza) <> 'object' or pg_column_size(p_bozza) > 262144 then
        raise exception 'correzione non valida' using errcode = '22023';
    end if;
    if not exists (select 1 from public.progress p join private.verifiche_elenco e
                     on e.page_path = private.alunni_percorso(p.page_path) where p.id = p_id) then
        raise exception 'elaborato non trovato' using errcode = '22023';
    end if;
    select c.revisione into v_rev from private.verifiche_correzioni c where c.progress_id = p_id for update;
    if coalesce(v_rev, 0) <> coalesce(p_revisione, -1) then
        raise exception 'la correzione è stata salvata da un''altra scheda: ricarica' using errcode = '40001', hint = 'conflitto';
    end if;
    insert into private.verifiche_correzioni as c (progress_id, bozza, pubblicata, revisione, pubblicata_il)
    values (p_id, p_bozza, case when p_mostra then p_bozza end, 1, case when p_mostra then now() end)
    on conflict (progress_id) do update
       set bozza = excluded.bozza,
           pubblicata = case when p_mostra then excluded.bozza else c.pubblicata end,
           pubblicata_il = case when p_mostra then now() else c.pubblicata_il end,
           revisione = c.revisione + 1,
           aggiornata_il = now();
    return (select jsonb_build_object('revisione', c.revisione, 'visibile', c.pubblicata is not null)
              from private.verifiche_correzioni c where c.progress_id = p_id);
end;
$$;

-- Riporta una correzione già mostrata a riservata (la bozza resta).
create function public.verifiche_docente_ritira(p_token text, p_id uuid)
returns void language plpgsql volatile security definer set search_path to '' as $$
declare
    v_doc text := private.alunni_docente(p_token);
begin
    update private.verifiche_correzioni c set pubblicata = null, pubblicata_il = null, revisione = c.revisione + 1
     where c.progress_id = p_id;
end;
$$;

-- Per l'alunno, dall'area «I miei lavori»: solo correzioni mostrate, solo dei propri lavori.
create function public.alunni_correzioni(p_token text)
returns table (id uuid, pubblicata_il timestamptz)
language plpgsql volatile security definer set search_path to '' as $$
declare
    v_profilo uuid := private.alunni_sessione(p_token);
begin
    return query select c.progress_id, c.pubblicata_il from private.verifiche_correzioni c
                  where c.pubblicata is not null and c.progress_id in (select private.alunni_righe(v_profilo));
end;
$$;

create function public.alunni_correzione(p_token text, p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
    v_profilo uuid := private.alunni_sessione(p_token);
begin
    return (select c.pubblicata from private.verifiche_correzioni c
             where c.progress_id = p_id and c.pubblicata is not null
               and c.progress_id in (select private.alunni_righe(v_profilo)));
end;
$$;

revoke all on function public.verifiche_docente_elaborati(text, text), public.verifiche_docente_apri(text, uuid),
    public.verifiche_docente_salva(text, uuid, jsonb, boolean, integer), public.verifiche_docente_ritira(text, uuid),
    public.alunni_correzioni(text), public.alunni_correzione(text, uuid) from public;
grant execute on function public.verifiche_docente_elaborati(text, text), public.verifiche_docente_apri(text, uuid),
    public.verifiche_docente_salva(text, uuid, jsonb, boolean, integer), public.verifiche_docente_ritira(text, uuid),
    public.alunni_correzioni(text), public.alunni_correzione(text, uuid) to anon, authenticated, service_role;

commit;
