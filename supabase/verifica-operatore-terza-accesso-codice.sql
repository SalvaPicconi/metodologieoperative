-- Accesso con il solo codice studente (decisione del docente, 10 novembre 2026).
-- Applicato in produzione il 10/11/2026 con execute_sql.
--
-- Prima: password della verifica + vincolo del browser (la chiave casuale salvata nel
-- localStorage alla prima apertura). Con i Chromebook condivisi o in modalità ospite la
-- chiave si perdeva e lo studente restava fuori, anche solo per vedere la correzione.
-- Ora: classe + codice studente. L'ultima apertura collega l'elaborato al dispositivo
-- che lo apre; quello precedente smette di salvare e riceve un messaggio chiaro.
-- p_password resta nella firma delle funzioni pubbliche (apri_mista, apri_b, ...) ed è
-- ignorata; le impronte delle password restano in tabella per poter richiudere la verifica.

create or replace function private.verifica_operatore_apri_con_limite(p_password text, p_classe text, p_codice text, p_chiave text, p_edizione_massima integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
    numero_edizione smallint;
    versione_b boolean := p_edizione_massima = 4;
    elaborato private.verifica_operatore_elaborati;
    impronta bytea;
    domande jsonb;
begin
    if p_classe is null or p_classe !~ '^3[a-z]{1,2}$'
       or p_codice is null or p_codice !~ '^[a-zà-ü]{2,59}[a-z]$'
       or p_chiave is null or p_chiave !~ '^[a-f0-9]{64}$' then
        raise exception 'Controlla classe e codice studente.' using errcode = '22023';
    end if;
    if versione_b then
        numero_edizione := 4;
    else
        select c.edizione into numero_edizione from private.verifica_operatore_config c where c.singleton;
    end if;
    impronta := extensions.digest(p_chiave, 'sha256');
    if numero_edizione <= p_edizione_massima then
        insert into private.verifica_operatore_elaborati (classe, codice, chiave_hash, edizione)
        values (p_classe, p_codice, impronta, numero_edizione)
        on conflict (classe, codice, (edizione = 4)) do nothing;
    end if;
    -- Nessun vincolo del browser: l'elaborato passa al dispositivo che lo apre.
    update private.verifica_operatore_elaborati set chiave_hash = impronta
     where classe = p_classe and codice = p_codice and (edizione = 4) = versione_b
       and chiave_hash <> impronta;
    select * into elaborato from private.verifica_operatore_elaborati
      where classe = p_classe and codice = p_codice and (edizione = 4) = versione_b;
    if not found or elaborato.edizione > p_edizione_massima then
        raise exception 'Ricarica la pagina per aprire la versione aggiornata della verifica.' using errcode = '22023';
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

-- In public.verifica_operatore_salva il messaggio per la chiave non trovata (errcode 42501)
-- è diventato: 'La verifica è stata aperta su un altro dispositivo: ricarica la pagina per continuare.'
-- (prima: 'Accesso alla prova richiesto.'). Il resto della funzione è invariato.

-- Per richiudere la verifica con una password, si ripristina il controllo
-- su private.verifica_operatore_config.password_hash (edizione 4: verifica_operatore_edizioni.password_hash)
-- come in verifica-operatore-terza-versione-b.sql.
