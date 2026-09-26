-- Protezione delle risposte degli studenti (tabelle progress, stroop_tests, stroop_reflections).
-- Applicato al progetto Supabase del sito il 26 settembre 2026 (migrazioni
-- «progress_accesso_protetto» e «progress_chiusura_accesso_diretto»).
--
-- Come funziona
-- - Gli studenti non leggono più la tabella: salvano e caricano solo la propria riga
--   (codice studente + pagina) con public.progress_salva e public.progress_carica.
-- - Il docente legge tutto solo con una sessione: public.progress_docente_accesso verifica la
--   password nel database e restituisce un token valido 6 ore; le funzioni progress_docente_*
--   e stroop_docente_* rispondono solo con un token valido. Nel database resta solo l'hash del token.
-- - Dopo 10 password sbagliate in 15 minuti l'accesso si blocca per 15 minuti.
-- - La password si cambia dall'area docente (pulsante «Cambia password»): la nuova è salvata
--   con bcrypt e chiude le altre sessioni aperte.
-- - L'impronta della password sta solo nel database remoto (private.progress_docente_config),
--   non in Git e non nelle pagine.
-- - Gli studenti inseriscono i risultati del test di Stroop ma non possono rileggerli.
--
-- Limite noto: chi conosce classe e codice di uno studente (cognome + iniziale) può aprire le sue
-- pagine con quel codice, come prima. Per evitarlo servirebbe un PIN personale per ogni studente.

-- Tabelle private (non raggiungibili dal sito)
--   private.progress_docente_config (singleton, password_hash, aggiornato_il)
--   private.progress_docente_sessioni (token_hash, creata_il, scade_il, ultimo_uso)
--   private.progress_docente_tentativi (id, avvenuto_il, riuscito)

-- Funzioni pubbliche (execute ad anon e authenticated)
--   progress_carica(p_student_code, p_page_path) → jsonb
--   progress_salva(p_class_code, p_student_code, p_page_path, p_data) → void
--   progress_docente_accesso(p_password) → (token, scade_il)
--   progress_docente_esci(p_token)
--   progress_docente_elenco(p_token, p_limite) → id, class_code, student_code, page_path, updated_at, meta
--   progress_docente_dettaglio(p_token, p_id) → jsonb
--   progress_docente_classe(p_token, p_class_code, p_page_path) → student_code, data, updated_at
--   progress_docente_cambia_password(p_token, p_attuale, p_nuova) → boolean
--   stroop_docente_test(p_token, p_limite), stroop_docente_dettaglio(p_token, p_id)

-- Chiusura dell'accesso diretto alle tabelle
drop policy if exists "read all temp" on public.progress;
drop policy if exists "write all temp" on public.progress;
drop policy if exists "update all temp" on public.progress;
drop policy if exists "allow_anon_select" on public.stroop_tests;
drop policy if exists "allow_anon_select" on public.stroop_reflections;
-- restano solo gli inserimenti anonimi dei risultati Stroop («allow_anon_insert»)

-- Il codice completo delle funzioni si legge nel database:
--   select pg_get_functiondef('public.progress_salva(text,text,text,jsonb)'::regprocedure);
