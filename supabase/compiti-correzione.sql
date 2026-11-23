-- Metodologie Operative · correzione dei compiti con lo stesso flusso delle verifiche (verifiche-correzione.sql).
-- Richiesta del titolare del 23/11/2026: un commento per ogni risposta, senza punti né voto, «Salva» riservato e
-- «Mostra all'alunno», lettura in «I miei lavori». Le risposte restano in public.progress; qui si aggiungono
-- soltanto le pagine all'elenco, con il tipo che distingue i compiti dalle verifiche.
-- Funzioni e permessi restano quelli di verifiche-correzione.sql: la pagina docente sceglie per chiave.
begin;

set local lock_timeout = '5s';

alter table private.verifiche_elenco
    add column tipo text not null default 'verifica' check (tipo in ('verifica', 'compito'));

insert into private.verifiche_elenco (page_path, chiave, titolo, tipo) values
    ('/materiali/terzo/ripasso-terzo-anno.html', 'compito-ripasso-terzo', 'Ripasso di Metodologie Operative', 'compito'),
    ('/materiali/quarto/disabilita_dalle_leggi_al_progetto.html', 'compito-disabilita-quarto', 'Le disabilità: parole, modelli e leggi', 'compito'),
    ('/materiali/biennio/tssas_percorso_completo_v2.html', 'compito-operatore-percorso', 'L''operatore sociale · percorso a tappe', 'compito'),
    ('/materiali/biennio/welfare-4-fasi-COMPLETO.html', 'compito-welfare-4-fasi', 'Il welfare: dalle basi all''azione', 'compito'),
    ('/attivita-materiali-biennio-welfare-4-fasi-completo-01', 'compito-welfare-4-fasi', 'Il welfare: dalle basi all''azione', 'compito'),
    ('/materiali/biennio/bisogni-relazione-aiuto.html', 'compito-bisogni-aiuto', 'Bisogni umani e relazione d’aiuto', 'compito'),
    ('/materiali/quinto/caso-professionale.html', 'compito-caso-professionale', 'Il caso professionale', 'compito'),
    ('/materiali/terzo/equipe_multiprofessionale.html', 'compito-equipe-terzo', 'L''équipe multiprofessionale e le figure professionali', 'compito'),
    ('/materiali/terzo/percorsi_autoapprendimento.html', 'compito-servizi-autoapprendimento', 'I servizi sociosanitari · autoapprendimento', 'compito'),
    ('/materiali/terzo/esercitazioni_servizi.html', 'compito-servizi-casi-guidati', 'Dai bisogni ai servizi · casi guidati', 'compito'),
    ('/materiali/laboratorio/collage_autobiografico.html', 'compito-collage-autobiografico', 'Il collage autobiografico · autoapprendimento', 'compito'),
    ('/materiali/peer_tutoring/incontro3_percorso_interattivo.html', 'compito-operatore-tra-pari', 'L''operatore sociale tra pari', 'compito');

commit;
