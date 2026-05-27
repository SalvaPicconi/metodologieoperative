-- Migration: ensure_api_grants
-- Verificato il 2026-05-27 in preparazione al cambio Supabase (ottobre 2026):
-- le nuove tabelle nello schema "public" non saranno più esposte automaticamente
-- all'API REST/GraphQL senza un GRANT esplicito.
--
-- STATO ATTUALE (progetto ruplzgcnheddmqqdephp):
--   - Tabelle esistenti (progress, stroop_tests, stroop_reflections): grant completi già presenti.
--   - Default privileges per postgres e supabase_admin: già impostati correttamente.
--   Il progetto è già conforme; questa migration lo documenta e lo rende idempotente.

-- Grant espliciti sulle tabelle esistenti (idempotenti)
GRANT ALL ON TABLE public.progress           TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.stroop_tests       TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.stroop_reflections TO anon, authenticated, service_role;

-- Default privileges: qualsiasi nuova tabella creata dal ruolo postgres
-- eredita automaticamente i grant senza intervento manuale.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES    TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Stessa cosa per supabase_admin (usato da alcune operazioni interne)
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON TABLES    TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Assicura che i ruoli API abbiano USAGE sullo schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated;
