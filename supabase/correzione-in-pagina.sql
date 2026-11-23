-- Correzione mostrata dentro la pagina dell'attività (23 novembre 2026).
--
-- L'alunno che lavora con classe e codice vede, sotto ogni risposta, la correzione già resa visibile
-- dal docente; le risposte corrette si bloccano, le altre restano scrivibili. La funzione legge solo
-- la riga di quel codice su quella pagina nell'anno scolastico in corso, come progress_carica,
-- e solo se la correzione è visibile.

create or replace function public.progress_correzione(p_student_code text, p_page_path text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
    select c.pubblicata
    from public.progress p
    join private.verifiche_correzioni c on c.progress_id = p.id
    where p.school_year = private.progress_school_year(statement_timestamp())
      and p.student_code = p_student_code
      and p.page_path = p_page_path
      and c.pubblicata is not null;
$$;

revoke all on function public.progress_correzione(text, text) from public;
grant execute on function public.progress_correzione(text, text) to anon, authenticated, service_role;
