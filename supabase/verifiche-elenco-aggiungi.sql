-- Agganciare una pagina nuova alla correzione nella pagina (regola del titolare, 23/11/2026).
-- La stessa pagina va anche in assets/verifiche-correzione.json («verifiche») con la stessa chiave,
-- e la pagina include assets/correzione-in-pagina.js prima di assets/progress.js.
-- Si lancia su Supabase con execute_sql (senza drop/delete: non chiede conferme).
-- tipo: 'compito' (commenti, senza voto) oppure 'verifica' (anche punti per sezione e voto: le sezioni
-- stanno nel JSON).
insert into private.verifiche_elenco (page_path, chiave, titolo, tipo) values
    ('/materiali/<anno>/<slug>-esercizi.html', 'compito-<slug>', '<Titolo leggibile>', 'compito')
on conflict (page_path) do nothing;
