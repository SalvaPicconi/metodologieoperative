(() => {
    'use strict';

    const STORAGE_KEY = 'mo:ripasso-terzo-anno:v2';
    const SUPABASE_URL = 'https://ruplzgcnheddmqqdephp.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cGx6Z2NuaGVkZG1xcWRlcGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTYyMjksImV4cCI6MjA3NTY5MjIyOX0.tOLIkgi5yTt61_0rMlXUqxnbil4DLD7kBaqZBVAv1CI';
    const DOCENTE_SESSION_KEY = 'mo:docente-session';
    const DOCENTE_SESSION_DURATION = 1000 * 60 * 60 * 6;
    const DOCENTE_HASH = 'ed5672a676cf4556ed88868d438204e25c5ce272664a4083b92b5c783294e9e4';
    const ROUTES = {
        complete: { label: 'Percorso completo', missions: [0,1,2,3,4,5,6,7,8,9,10] },
        quick: { label: 'Ripasso selettivo · 90 minuti', missions: [0,1,2,3,4,8,10] },
        case: { label: 'Esercitazione su caso', missions: [10] }
    };

    const missions = [
        {
            id: 0,
            section: 'Avvio',
            title: 'Ripasso di partenza',
            subtitle: 'Prima ricostruiamo le idee fondamentali, poi controlliamo quali collegamenti sono già attivi.',
            minutes: 15,
            chips: ['teoria essenziale', 'diagnosi formativa', 'nessun voto'],
            intro: `
                <p>Leggi questi richiami come se gli argomenti fossero nuovi. Non devi imparare tutto a memoria: cerca le idee che ritornano in tutto il percorso.</p>`,
            theory: [
                ['La persona viene prima del problema', '<p>Una situazione si comprende mettendo insieme corpo e salute, vissuti ed emozioni, relazioni e contesto. La persona ha bisogni, ma anche diritti, capacità, desideri e risorse.</p>'],
                ['Dal bisogno al progetto', '<p>Prima si raccolgono fatti e informazioni; poi si leggono bisogni, risorse e vincoli. Solo dopo si definiscono obiettivi osservabili, azioni, responsabilità, tempi e modalità di verifica.</p>'],
                ['Rete ed équipe', '<p>La rete comprende legami informali e servizi formali. Nell’équipe professionisti diversi condividono informazioni pertinenti, mantengono ruoli distinti e costruiscono un piano comune.</p>'],
                ['Aiutare senza sostituirsi', '<p>Lo scaffolding è un sostegno temporaneo che diminuisce con l’autonomia. Anche nella relazione d’aiuto e nel colloquio motivazionale si accompagna la persona senza decidere al suo posto.</p>'],
                ['Metodi e servizi hanno uno scopo', '<p>L’autobiografia aiuta a rileggere esperienze e risorse; il SerD integra interventi sanitari, psicologici, educativi e sociali; ogni metodo va scelto in base alla persona e all’obiettivo.</p>']
            ],
            questions: [
                { q: 'Nel modello bio-psico-sociale, un bisogno va letto:', options: ['solo come problema della persona', 'nelle relazioni tra corpo, vissuto e contesto', 'solo attraverso la diagnosi sanitaria'], answer: 1, why: 'Le tre dimensioni si influenzano: isolarne una rende l’analisi incompleta.' },
                { q: 'Qual è la prima fase di un progetto individualizzato?', options: ['scegliere subito un’attività', 'analizzare problema e situazione', 'valutare il risultato finale'], answer: 1, why: 'Prima di decidere cosa fare bisogna capire situazione, bisogni, risorse e vincoli.' },
                { q: 'Una rete informale comprende soprattutto:', options: ['servizi pubblici e professionisti', 'familiari, amici e vicinato', 'solo associazioni convenzionate'], answer: 1, why: 'La rete informale nasce dai legami; la rete formale da ruoli e mandati organizzati.' },
                { q: 'In équipe, ogni professionista dovrebbe:', options: ['fare tutto in autonomia', 'portare il proprio punto di vista e integrarlo con gli altri', 'limitarsi a ricevere ordini'], answer: 1, why: 'L’integrazione dei punti di vista costruisce una lettura e un intervento più completi.' },
                { q: 'Nel laboratorio autobiografico la condivisione personale:', options: ['deve essere sempre obbligatoria', 'va scelta e protetta da regole di ascolto', 'non ha alcun valore formativo'], answer: 1, why: 'Scrittura e condivisione richiedono libertà, rispetto e assenza di giudizio.' },
                { q: 'Lo scaffolding è:', options: ['un aiuto temporaneo che si riduce con l’autonomia', 'un gioco di costruzione libero', 'una forma di verifica finale'], answer: 0, why: 'Il sostegno è calibrato e gradualmente ritirato quando il bambino sa procedere da sé.' },
                { q: 'Il SerD lavora sulle dipendenze attraverso:', options: ['una sola figura professionale', 'un percorso multiprofessionale personalizzato', 'solo il ricovero residenziale'], answer: 1, why: 'Valutazioni e interventi clinici, psicologici, educativi e sociali vengono integrati.' },
                { q: 'Davanti a una persona ambivalente sul cambiamento è più utile:', options: ['convincerla con una lezione', 'far emergere ragioni e dubbi con domande e ascolto', 'minacciare conseguenze'], answer: 1, why: 'Il colloquio motivazionale lavora sull’ambivalenza senza sostituirsi alla persona.' }
            ],
            prompt: 'Quale argomento senti più lontano? Scrivilo in una riga: a fine percorso torna qui e verifica se è cambiato.',
            teacher: 'Usa il checkpoint come sondaggio. Prima raccogli le risposte, poi chiedi a chi ha scelto un’opzione di motivarla senza rivelare subito la soluzione.'
        },
        {
            id: 1,
            section: 'Strumenti',
            title: 'Intelligenza artificiale: capire, usare, verificare',
            subtitle: 'Dal lessico di base all’uso responsabile nei compiti e nei servizi.',
            minutes: 18,
            chips: ['IA', 'fonti', 'etica digitale'],
            intro: '<p>Il percorso svolto non si è fermato a “che cosa sa fare l’IA”. Ha collegato funzionamento, dati, rischi, prodotti e controllo umano.</p>',
            concepts: [
                ['Dati', 'Un sistema apprende regolarità da esempi: qualità e rappresentatività dei dati contano.'],
                ['Modelli', 'Machine learning, deep learning e reti neurali non “pensano” come una persona: producono risultati da strutture apprese.'],
                ['Controllo', 'Un output utile va confrontato con fonti attendibili, corretto e adattato al destinatario.']
            ],
            coverage: [
                ['Fondamenti', 'Che cos’è l’IA; IA debole e IA forte; storia ed evoluzione.'],
                ['Come funziona', 'Data science e tipologie di dati; machine learning; deep learning e reti neurali; hardware.'],
                ['Uso didattico', 'IA nell’educazione, apprendimento guidato, mappe, podcast e sintesi.'],
                ['Responsabilità', 'Etica, rischi, benefici, glossario, domande frequenti e verifica delle fonti.']
            ],
            theory: [
                ['IA debole e IA forte', '<p>L’IA debole è progettata per compiti specifici. L’IA forte resta un’ipotesi teorica: non va confusa con i sistemi generativi attuali.</p>'],
                ['Dal dato al risultato', '<p>I dati vengono organizzati e usati per addestrare modelli. Il machine learning individua regolarità; il deep learning usa reti neurali con molti livelli. Hardware e capacità di calcolo rendono possibile l’elaborazione.</p>'],
                ['IA nell’educazione', '<p>Può sostenere spiegazioni, mappe, esercizi e revisioni. Non sostituisce la comprensione: lo studente deve dichiarare l’uso, controllare le informazioni e rielaborare il prodotto.</p>'],
                ['Rischi e benefici', '<p>Benefici: accessibilità, personalizzazione, velocità. Rischi: errori plausibili, bias, dipendenza, privacy, appiattimento del pensiero. Il criterio decisivo è il controllo umano documentato.</p>']
            ],
            questions: [
                { q: 'Un testo generato dall’IA sembra convincente. Qual è il passaggio successivo?', options: ['consegnarlo', 'verificarne ogni informazione su fonti attendibili', 'chiedere all’IA se è sicura'], answer: 1, why: 'La plausibilità non garantisce correttezza. Serve un controllo esterno al sistema.' },
                { q: 'Quale pratica dimostra un uso responsabile?', options: ['nascondere l’uso dell’IA', 'dichiarare come è stata usata e come si è controllato il risultato', 'copiare la prima risposta'], answer: 1, why: 'Trasparenza e verifica rendono visibile il lavoro cognitivo dello studente.' },
                { q: 'Machine learning e deep learning sono:', options: ['metodi con cui i sistemi apprendono regolarità dai dati', 'motori di ricerca', 'tipi di memoria umana'], answer: 0, why: 'Il deep learning è una famiglia del machine learning basata su reti neurali a più livelli.' }
            ],
            prompt: 'Scrivi una regola personale per usare l’IA senza delegarle il tuo pensiero.',
            teacher: 'Chiedi agli studenti di portare un esempio di output plausibile ma non verificato. Il punto non è “smascherare” l’IA, ma rendere visibile il metodo di controllo.'
        },
        {
            id: 2,
            section: 'Strumenti',
            title: 'Persona, bisogni, relazione d’aiuto e servizi',
            subtitle: 'Leggere la situazione senza ridurre la persona al problema.',
            minutes: 20,
            chips: ['modello bio-psico-sociale', 'welfare', 'servizi'],
            intro: '<p>La relazione d’aiuto parte da una persona con diritti, capacità e legami. L’analisi distingue i bisogni, ma poi ricompone il quadro.</p>',
            concepts: [
                ['Biologico', 'Salute, corpo, autonomia, sonno, alimentazione, dolore, condizioni materiali che incidono sul benessere.'],
                ['Psicologico', 'Emozioni, pensieri, motivazione, paure, autostima, strategie con cui si affrontano le difficoltà.'],
                ['Sociale', 'Famiglia, relazioni, scuola, lavoro, casa, risorse economiche, territorio e accesso ai servizi.']
            ],
            theory: [
                ['Relazione d’aiuto', '<p>Non significa fare al posto della persona. Significa ascoltare, osservare, sostenere capacità e autodeterminazione, definire insieme obiettivi realistici e accompagnare verso maggiore autonomia.</p>'],
                ['Dal bisogno al servizio', '<p>Un bisogno non indica automaticamente un servizio. Prima si verificano urgenza, desideri della persona, risorse già presenti, criteri di accesso, rete e possibili ostacoli.</p>'],
                ['Il welfare come sistema', '<p>Servizi pubblici, privato sociale, comunità e reti informali concorrono alla risposta. L’operatore orienta e collega, senza promettere prestazioni non verificate.</p>']
            ],
            questions: [
                { q: 'Una persona anziana salta i pasti dopo la morte del coniuge. Quale lettura è più completa?', options: ['è solo un problema alimentare', 'si intrecciano alimentazione, lutto e isolamento', 'basta consegnare pasti'], answer: 1, why: 'Il bisogno biologico è connesso alla dimensione psicologica e sociale.' },
                { q: '“Aiutare” in modo professionale significa soprattutto:', options: ['decidere rapidamente al posto dell’utente', 'costruire con la persona un percorso sostenibile', 'offrire sempre lo stesso servizio'], answer: 1, why: 'La risposta è personalizzata e mantiene la persona protagonista.' },
                { q: 'Prima di indicare un servizio occorre:', options: ['verificare bisogno, accesso, risorse e volontà della persona', 'scegliere il più vicino', 'usare quello già noto all’operatore'], answer: 0, why: 'Orientare richiede dati reali e compatibilità con la situazione.' }
            ],
            prompt: 'Pensa a un bisogno semplice. Scrivi una domanda biologica, una psicologica e una sociale che useresti per comprenderlo.',
            teacher: 'Fai notare le sovrapposizioni: la stessa informazione può aprire più dimensioni. Valuta la qualità delle domande, non la quantità delle etichette.'
        },
        {
            id: 3,
            section: 'Strumenti',
            title: 'Dall’analisi al progetto individualizzato',
            subtitle: 'Sei fasi per trasformare un bisogno in un intervento verificabile.',
            minutes: 20,
            chips: ['progettazione', 'obiettivi', 'verifica'],
            intro: '<p>Un progetto non è un elenco di attività. Collega analisi, obiettivi, azioni, responsabilità, tempi e criteri con cui capire se il percorso sta funzionando.</p>',
            coverage: [
                ['1 · Analisi del problema', 'Che cosa accade? Quali bisogni, rischi e capacità emergono?'],
                ['2 · Analisi del contesto', 'Quali risorse, vincoli, persone, servizi e condizioni incidono?'],
                ['3 · Obiettivi', 'Quale cambiamento concreto e osservabile vogliamo ottenere?'],
                ['4 · Interventi', 'Chi fa che cosa, con quali strumenti, tempi e responsabilità?'],
                ['5 · Verifica in itinere', 'Durante il percorso, gli interventi stanno producendo segnali utili?'],
                ['6 · Valutazione', 'Che cosa è cambiato? Che cosa va mantenuto, corretto o riprogettato?']
            ],
            theory: [
                ['La formula dell’obiettivo', '<p><strong>Migliorare, mantenere o ridurre</strong> + aspetto osservabile + misura o indicatore + tempo + interventi essenziali. “Stare meglio” non basta; “partecipare a due attività di gruppo alla settimana per otto settimane” è verificabile.</p>'],
                ['Verifica e valutazione', '<p>La verifica accompagna l’attuazione e permette correzioni. La valutazione legge il risultato e il processo: non coincide con il voto e non si limita a “fatto/non fatto”.</p>']
            ],
            questions: [
                { q: 'Quale sequenza è corretta?', options: ['obiettivi → analisi → interventi → valutazione', 'analisi problema → contesto → obiettivi → interventi → verifica → valutazione', 'interventi → obiettivi → contesto → verifica'], answer: 1, why: 'Si parte dalla comprensione e si arriva alla lettura dei risultati.' },
                { q: 'Quale obiettivo è formulato meglio?', options: ['migliorare la socializzazione', 'entro otto settimane partecipare a due attività di gruppo alla settimana con il supporto iniziale dell’educatore', 'iscrivere la persona a un centro'], answer: 1, why: 'Descrive cambiamento, tempo, frequenza e sostegno.' },
                { q: 'Se un intervento non produce i segnali attesi durante il percorso:', options: ['si aspetta la fine', 'si verifica il perché e si adatta il piano', 'si considera colpa dell’utente'], answer: 1, why: 'La progettazione è dinamica: la verifica serve proprio a correggere.' }
            ],
            prompt: 'Scrivi un obiettivo verificabile per una persona che vuole tornare a uscire di casa dopo un periodo di isolamento.',
            teacher: 'Proietta tre obiettivi scritti dagli studenti e togli i nomi. Chiedi: “Che cosa osserveremmo per dire che è successo davvero?”'
        },
        {
            id: 4,
            section: 'Persone e servizi',
            title: 'Reti, servizi e accesso',
            subtitle: 'Collegare risorse formali e informali senza confonderne i ruoli.',
            minutes: 16,
            chips: ['rete formale', 'rete informale', 'orientamento'],
            intro: '<p>Nessun intervento significativo dipende da una sola persona. Il lavoro di rete rende visibili risorse, vuoti, passaggi e responsabilità.</p>',
            concepts: [
                ['Rete formale', 'Comune, servizi sanitari, scuola, enti e organizzazioni che operano con mandato e ruoli definiti.'],
                ['Rete informale', 'Familiari, amici, vicinato e legami di prossimità: risorse reali, ma non sostituti automatici dei servizi.'],
                ['Accesso', 'Informazioni corrette, requisiti, procedure, tempi, consenso e ostacoli concreti alla fruizione.']
            ],
            theory: [
                ['Mappare la rete', '<p>Per ogni risorsa si annotano ruolo, contributo possibile, limiti, modalità di contatto e relazione con la persona. Una mappa utile mostra anche ciò che manca.</p>'],
                ['Orientare senza promettere', '<p>Dire “esiste questo servizio” non basta. Occorre verificare che sia attivo, pertinente, accessibile e comprensibile per quella persona.</p>']
            ],
            questions: [
                { q: 'Un vicino porta la spesa due volte a settimana. È:', options: ['rete formale', 'rete informale', 'servizio semiresidenziale'], answer: 1, why: 'È una risorsa di prossimità basata su un legame, non su un mandato professionale.' },
                { q: 'Qual è il compito più corretto dell’operatore?', options: ['sostituire la rete debole', 'collegare risorse e chiarire responsabilità e limiti', 'trasferire tutto alla famiglia'], answer: 1, why: 'Il lavoro di rete integra, non scarica né confonde i ruoli.' },
                { q: 'Un’informazione su un servizio è utile quando:', options: ['è generica ma rassicurante', 'è verificata e comprende modalità di accesso', 'proviene da un post molto condiviso'], answer: 1, why: 'L’orientamento professionale richiede informazioni attuali e operative.' }
            ],
            prompt: 'Disegna a parole una piccola rete: una persona al centro, due risorse formali, due informali e un collegamento ancora mancante.',
            teacher: 'Chiedi alla classe di distinguere “presenza nella rete” da “responsabilità dell’intervento”. Una persona vicina può essere preziosa senza diventare un operatore.'
        },
        {
            id: 5,
            section: 'Persone e servizi',
            title: 'Équipe multiprofessionale e documentazione',
            subtitle: 'Punti di vista diversi, un piano condiviso e consegne leggibili.',
            minutes: 20,
            chips: ['ruoli', 'riunione d’équipe', 'resoconto'],
            intro: '<p>L’équipe non è una somma di professionisti. È un metodo di lavoro: ciascuno osserva dal proprio ruolo, condivide informazioni pertinenti e costruisce decisioni integrate.</p>',
            coverage: [
                ['Area sanitaria', 'Medico e infermiere: valutazione e assistenza sanitaria secondo competenze e responsabilità proprie.'],
                ['Area psicologica', 'Psicologo e psicoterapeuta: valutazione e intervento psicologico con percorsi formativi distinti.'],
                ['Area sociale', 'Assistente sociale: lettura sociale, accesso ai diritti, rete e progetto di aiuto.'],
                ['Area educativa e assistenziale', 'Educatore, animatore sociale e OSS: obiettivi educativi, partecipazione, autonomia e assistenza secondo il proprio profilo.']
            ],
            theory: [
                ['Portare un caso in équipe', '<p>Si selezionano fatti osservati, bisogni, risorse, rischi, dubbi e informazioni mancanti. Si separano dati, interpretazioni e proposte.</p>'],
                ['Documentare', '<p>Resoconti, schede e consegne devono essere chiari, pertinenti, datati e rispettosi della riservatezza. Non si scrivono giudizi sulla persona: si descrivono comportamenti e situazioni osservabili.</p>'],
                ['Decidere insieme', '<p>L’équipe definisce priorità e obiettivi, distribuisce responsabilità e stabilisce quando verificare. Il dissenso motivato è una risorsa, se resta sul problema.</p>']
            ],
            questions: [
                { q: 'Quale frase è adatta a un resoconto professionale?', options: ['è pigro e non collabora', 'durante l’attività è rimasto seduto e ha rifiutato due proposte', 'non gli interessa nulla'], answer: 1, why: 'Descrive fatti osservabili senza trasformarli in un’etichetta.' },
                { q: 'In una riunione d’équipe, l’operatore dovrebbe:', options: ['riferire tutto ciò che sa', 'condividere le informazioni pertinenti al progetto e al proprio ruolo', 'evitare dubbi e informazioni mancanti'], answer: 1, why: 'Pertinenza, riservatezza e chiarezza guidano la condivisione.' },
                { q: 'Se due professionisti leggono diversamente una situazione:', options: ['uno deve imporsi', 'si confrontano dati, mandato e obiettivi', 'si annulla il progetto'], answer: 1, why: 'Il confronto professionale serve a integrare prospettive e rendere espliciti i criteri.' }
            ],
            prompt: 'Scrivi tre righe di resoconto su una persona che abbandona un’attività dopo dieci minuti, evitando giudizi ed etichette.',
            teacher: 'Trasforma insieme alla classe frasi giudicanti in descrizioni osservabili. Poi chiedi quale informazione manca per interpretare il comportamento.'
        },
        {
            id: 6,
            section: 'Laboratori',
            title: 'Autobiografia, memoria e trasfigurazione creativa',
            subtitle: 'Raccontarsi per dare forma all’esperienza, senza forzare l’intimità.',
            minutes: 18,
            chips: ['scrittura di sé', 'mappa della crescita', 'arteterapia'],
            intro: '<p>Il laboratorio ha attraversato teoria, mappa mentale della crescita, scrittura di sé, condivisione, trascrizione digitale e trasformazione creativa.</p>',
            coverage: [
                ['Ricostruire', 'Eventi, persone, svolte, ostacoli e risorse vengono collegati in una mappa della crescita.'],
                ['Scrivere', 'La narrazione in prima persona seleziona ricordi e attribuisce significati.'],
                ['Condividere', 'La lettura al gruppo è proposta, mai imposizione; ascolto e riservatezza proteggono chi narra.'],
                ['Trasfigurare', 'Un testo può diventare immagine, collage, audio o altra forma espressiva senza perdere il nucleo della storia.']
            ],
            theory: [
                ['Perché funziona', '<p>Narrare aiuta a collegare passato, presente e futuro, riconoscere risorse e rileggere i cambiamenti. Nel lavoro sociale allena ascolto e attenzione alla storia completa della persona.</p>'],
                ['Il confine etico', '<p>Non si chiede di raccontare ciò che una persona non vuole condividere. Il conduttore offre alternative, chiarisce l’uso dei materiali e interrompe dinamiche di giudizio.</p>'],
                ['Dalla storia al progetto', '<p>La mappa autobiografica non è solo memoria: può far emergere capacità, figure significative e desideri utili all’orientamento e alla progettazione.</p>']
            ],
            questions: [
                { q: 'Quale regola tutela meglio il laboratorio autobiografico?', options: ['tutti devono leggere il testo', 'ciascuno sceglie che cosa condividere', 'il docente interpreta pubblicamente ogni storia'], answer: 1, why: 'La libertà di scelta rende possibile un clima sicuro e autentico.' },
                { q: 'La mappa della crescita serve soprattutto a:', options: ['fare una cronologia perfetta', 'collegare tappe, persone, risorse e cambiamenti', 'eliminare i ricordi negativi'], answer: 1, why: 'Il valore sta nei collegamenti e nei significati, non nella completezza documentaria.' },
                { q: 'Trasfigurare creativamente un testo significa:', options: ['falsificare la storia', 'darle una nuova forma espressiva rispettandone il senso', 'renderla pubblica'], answer: 1, why: 'La forma cambia, ma il nucleo scelto dall’autore resta riconoscibile e protetto.' }
            ],
            prompt: 'Scegli un passaggio di crescita e descrivilo con tre elementi: “prima”, “svolta”, “che cosa porto con me”. Puoi restare sul piano scolastico.',
            teacher: 'Offri sempre un’alternativa non personale: la storia di un oggetto, di un apprendimento o di un personaggio immaginario.'
        },
        {
            id: 7,
            section: 'Laboratori',
            title: 'Seconda infanzia, gioco e peer tutoring',
            subtitle: 'Accompagnare lo sviluppo e imparare insegnando a un altro gruppo.',
            minutes: 22,
            chips: ['3-6 anni', 'scaffolding', 'peer tutoring'],
            intro: '<p>Il lavoro sulla seconda infanzia ha unito teoria dello sviluppo, progettazione di attività, osservazione e sperimentazione sul campo. Il peer tutoring ha aggiunto preparazione, conduzione e resoconto.</p>',
            theory: [
                ['Zona di sviluppo prossimale e scaffolding', '<p>Il bambino può svolgere alcuni compiti con un aiuto calibrato. L’adulto osserva, offre un sostegno temporaneo e lo riduce quando cresce l’autonomia.</p>'],
                ['Il gioco come diritto e metodo', '<p>Nel gioco il bambino esplora, prova regole, comunica e costruisce significati. L’attività educativa prepara ambiente e materiali senza occupare tutto lo spazio dell’iniziativa.</p>'],
                ['Dewey e Montessori', '<p>Si apprende facendo: esperienza, ambiente organizzato, materiali e autonomia sostengono un apprendimento attivo.</p>'],
                ['Goldschmied e gioco euristico', '<p>Materiali semplici e non strutturati favoriscono esplorazione, combinazione, concentrazione e scoperta.</p>'],
                ['Malaguzzi e Reggio Emilia Approach', '<p>Il bambino è competente e dispone di molti linguaggi. L’adulto ascolta, documenta e costruisce contesti in cui idee e relazioni possano svilupparsi.</p>'],
                ['Peer tutoring', '<p>Prima si prepara il compito; durante si osserva e si sostiene senza sostituire; dopo si documenta che cosa ha funzionato e che cosa va cambiato.</p>']
            ],
            questions: [
                { q: 'Un bambino non riesce ad avviare un incastro. Qual è uno scaffolding adeguato?', options: ['completarlo al suo posto', 'mostrare un indizio e poi ritirare l’aiuto', 'dirgli di riprovare senza osservare'], answer: 1, why: 'L’aiuto apre la possibilità d’azione ma lascia al bambino il controllo del compito.' },
                { q: 'Nel gioco euristico l’adulto dovrebbe soprattutto:', options: ['spiegare l’unico uso corretto', 'predisporre materiali sicuri e osservare l’esplorazione', 'assegnare un punteggio'], answer: 1, why: 'Materiali aperti e osservazione sostengono inventiva e scoperta.' },
                { q: 'Un tutor efficace con un compagno più giovane:', options: ['dà subito la risposta', 'pone domande, offre indizi e controlla la comprensione', 'fa il compito per guadagnare tempo'], answer: 1, why: 'Il tutor sostiene l’autonomia e verifica che l’altro stia realmente apprendendo.' }
            ],
            prompt: 'Progetta in quattro righe un’attività 3-6 anni: obiettivo, materiali, azione del bambino, ruolo dell’adulto.',
            teacher: 'Fai distinguere “attività bella” da “attività leggibile”: che cosa osserveremmo per capire se l’obiettivo è stato raggiunto?'
        },
        {
            id: 8,
            section: 'Servizi in azione',
            title: 'Dipendenze, SerD e colloquio motivazionale',
            subtitle: 'Dalla comprensione del fenomeno al percorso nel servizio.',
            minutes: 25,
            chips: ['tolleranza', 'SerD', 'fasi del cambiamento'],
            intro: '<p>Il modulo ha collegato teoria delle dipendenze, casi, figure professionali, protocollo del SerD e simulazione di colloqui. Il punto centrale: leggere la persona oltre lo stigma e adattare l’intervento alla fase del cambiamento.</p>',
            concepts: [
                ['Tolleranza', 'Per ottenere lo stesso effetto può diventare necessaria una quantità maggiore.'],
                ['Astinenza', 'Quando l’uso si interrompe possono comparire sintomi fisici o psicologici.'],
                ['Craving', 'Desiderio intenso che può essere riattivato da stati emotivi, persone, luoghi o situazioni.']
            ],
            theory: [
                ['Sostanze e comportamenti', '<p>Le dipendenze possono riguardare sostanze o comportamenti. Non si riducono a un “vizio”: coinvolgono salute, motivazione, relazioni, condizioni di vita e richiedono risposte integrate.</p>'],
                ['Il percorso nel SerD', '<p>Accoglienza e intake; valutazioni clinica, motivazionale, educativa e sociale; riunione d’équipe; programma personalizzato; attuazione e monitoraggio; reinserimento; follow-up. Il percorso concreto varia in base alla persona.</p>'],
                ['Ambulatoriale, semiresidenziale, residenziale', '<p>Non esiste una soluzione unica. Intensità, ambiente e sostegni cambiano secondo bisogni, rischi, motivazione e risorse.</p>'],
                ['Fasi del cambiamento', '<p>Precontemplazione, contemplazione, preparazione/determinazione, azione, mantenimento. Una ricaduta non cancella il percorso: viene analizzata per riprogettare.</p>'],
                ['OARS', '<p>Domande aperte, affermazioni che riconoscono risorse, ascolto riflessivo e sintesi aiutano la persona a esplorare ambivalenza e motivazioni.</p>']
            ],
            questions: [
                { q: 'Una persona dice: “Non ho un problema, sono qui solo perché insiste la famiglia”. In quale fase è più probabile?', options: ['precontemplazione', 'azione', 'mantenimento'], answer: 0, why: 'Il problema non è ancora riconosciuto; forzare può aumentare la resistenza.' },
                { q: 'Quale risposta è coerente con il colloquio motivazionale?', options: ['devi smettere subito', 'che cosa ti piace e che cosa ti preoccupa del tuo uso?', 'se non cambi, non possiamo aiutarti'], answer: 1, why: 'La domanda aperta esplora l’ambivalenza senza imporre una conclusione.' },
                { q: 'Nel SerD, la riunione d’équipe serve a:', options: ['sommare diagnosi separate', 'integrare valutazioni e concordare obiettivi e responsabilità', 'scegliere sempre la comunità'], answer: 1, why: 'Il progetto nasce dall’integrazione e resta personalizzato.' },
                { q: 'Una ricaduta durante il percorso:', options: ['dimostra che il progetto è inutile', 'va nascosta', 'richiede analisi, rimotivazione e possibile revisione del piano'], answer: 2, why: 'È un’informazione sul percorso, non un giudizio definitivo sulla persona.' }
            ],
            prompt: 'Scrivi una domanda aperta e una frase riflessiva da usare con una persona ambivalente sul cambiamento.',
            teacher: 'Fai leggere la stessa frase con tono giudicante e con tono esplorativo. Il contenuto non basta: postura e ascolto cambiano la relazione.'
        },
        {
            id: 9,
            section: 'Servizi in azione',
            title: 'FSL, tirocinio, job shadowing e incontri esperti',
            subtitle: 'Trasformare l’esperienza sul campo in apprendimento documentato.',
            minutes: 16,
            chips: ['sicurezza', 'diario di bordo', 'osservazione'],
            intro: '<p>Il lavoro sul campo ha riguardato preparazione, obblighi, sicurezza, documenti, esperienza nella scuola dell’infanzia, osservazione di un servizio e incontro sulla pet therapy.</p>',
            coverage: [
                ['Prima', 'Conoscere luogo, compiti, tempi, regole, rischi, referente e obiettivi formativi.'],
                ['Durante', 'Osservare, chiedere quando necessario, rispettare ruoli e riservatezza, annotare fatti pertinenti.'],
                ['Dopo', 'Riordinare appunti, collegare esperienza e teoria, verificare documenti, produrre un resoconto.'],
                ['Job shadowing', 'Seguire un professionista o un servizio per comprendere flussi, decisioni e collaborazione.'],
                ['Incontro specialistico', 'La pet therapy è stata affrontata in un incontro: il richiamo serve a riconoscere obiettivi, figure, setting e criteri di osservazione, senza sostituire una formazione specifica.']
            ],
            theory: [
                ['Educare lo sguardo', '<p>Osservare non significa “guardare tutto”. Si parte da una domanda, si distinguono fatti e interpretazioni e si annotano elementi utili all’obiettivo.</p>'],
                ['Il diario di bordo', '<p>Data, attività, osservazioni, dubbi, collegamenti teorici e prossimo passo. Evita dati personali non necessari e giudizi sulle persone incontrate.</p>'],
                ['Dall’esperienza alla competenza', '<p>Un’attività diventa apprendimento quando viene descritta, interpretata, confrontata con criteri e trasformata in una scelta futura più consapevole.</p>']
            ],
            questions: [
                { q: 'Quale annotazione è più utile nel diario di bordo?', options: ['giornata tranquilla', 'durante il gioco libero tre bambini hanno usato i materiali in modi diversi; l’educatrice ha atteso prima di intervenire', 'i bambini erano bravi'], answer: 1, why: 'È descrittiva e permette di collegare osservazione, materiali e ruolo adulto.' },
                { q: 'Prima di iniziare un’attività in FSL è essenziale:', options: ['improvvisare per essere spontanei', 'chiarire compito, sicurezza, referente e limiti del ruolo', 'evitare domande'], answer: 1, why: 'Il setting protegge studenti, utenti e qualità dell’esperienza.' },
                { q: 'Dopo un incontro con un esperto, una buona rielaborazione:', options: ['riassume solo la biografia dell’esperto', 'collega obiettivi, metodo, ruoli e domande rimaste aperte', 'riporta ogni frase ascoltata'], answer: 1, why: 'La rielaborazione seleziona ciò che costruisce competenza.' }
            ],
            prompt: 'Scrivi una voce di diario di bordo in quattro parti: fatto osservato, interpretazione possibile, collegamento teorico, domanda ancora aperta.',
            teacher: 'Proponi un’osservazione ambigua e fai costruire due interpretazioni alternative. Serve a mostrare perché il dato non coincide con la spiegazione.'
        },
        {
            id: 10,
            section: 'Sfida finale',
            title: 'Laboratorio dei casi',
            subtitle: 'Una situazione nuova per collegare bisogni, rete, équipe, obiettivo e metodo.',
            minutes: 25,
            chips: ['compito autentico', 'caso variabile', 'lavoro di gruppo'],
            intro: '<p>Prima di affrontare la situazione, riprendi il metodo. Cambiando caso cambiano i dati, ma la struttura professionale dell’analisi resta la stessa.</p>',
            theory: [
                ['1. Parti dai fatti', '<p>Separa ciò che il caso dice davvero dalle interpretazioni. Evidenzia comportamenti osservabili, parole della persona, condizioni del contesto e informazioni ancora mancanti.</p>'],
                ['2. Leggi bisogni e risorse', '<p>Considera insieme dimensione biologica, psicologica e sociale. Non cercare soltanto problemi: individua capacità, desideri, legami e sostegni già presenti.</p>'],
                ['3. Costruisci una rete pertinente', '<p>Scegli figure e servizi in base al bisogno e chiarisci il contributo di ciascuno. La rete informale sostiene, ma non sostituisce automaticamente le responsabilità professionali.</p>'],
                ['4. Progetta e verifica', '<p>Formula un cambiamento concreto, indica il primo passo, chi se ne occupa, il tempo e un segnale osservabile. Se manca un dato importante, scrivi come recuperarlo prima di decidere.</p>']
            ],
            teacher: 'Distribuisci casi diversi ai gruppi. Dopo 15 minuti, scambiali: il secondo gruppo non riscrive tutto, ma individua un punto forte, un dato mancante e una scelta da rivedere.'
        }
    ];

    const cases = [
        {
            tag: 'Seconda infanzia',
            title: 'La torre che non parte',
            text: 'In una sezione 3-6 anni, una bambina osserva gli altri costruire ma non tocca i materiali. Quando l’adulto le propone di iniziare insieme, dice “non sono capace”. La famiglia riferisce che a casa costruisce spesso con scatole e cuscini.',
            hint: 'Distingui capacità già presenti, emozione, contesto e tipo di sostegno. Evita di fare al posto della bambina.'
        },
        {
            tag: 'SerD',
            title: 'Sono qui, ma non prometto niente',
            text: 'Una persona arriva al servizio dopo pressioni familiari. Riconosce che l’uso ha creato problemi sul lavoro, ma dice di non voler “essere etichettata”. Accetta un primo colloquio purché nessuno decida al suo posto.',
            hint: 'Lavora su accoglienza, fase del cambiamento, domande aperte, riservatezza e integrazione delle valutazioni.'
        },
        {
            tag: 'Domiciliarità',
            title: 'Dopo la caduta',
            text: 'Una persona anziana è tornata a casa dopo una caduta. Cammina con prudenza, ha smesso di frequentare il circolo e il figlio passa solo nel fine settimana. Vuole restare nella propria abitazione e rifiuta l’idea di “essere un peso”.',
            hint: 'Collega autonomia, sicurezza, umore, rete e desiderio espresso dalla persona.'
        },
        {
            tag: 'Peer tutoring',
            title: 'Il tutor troppo veloce',
            text: 'Durante un’attività con una classe più giovane, il tutor dà subito tutte le risposte. Il gruppo completa il compito in fretta, ma quando deve spiegare il procedimento non sa farlo.',
            hint: 'Distingui prodotto finito e apprendimento. Progetta domande, indizi, osservazione e debriefing.'
        },
        {
            tag: 'Incontro specialistico',
            title: 'Un’attività con l’animale',
            text: 'Un servizio propone un intervento assistito con animali. L’équipe deve chiarire destinatari, obiettivi, ruoli, condizioni di sicurezza e che cosa osservare per capire se l’attività è adatta e utile.',
            hint: 'Non progettare una “pet therapy” generica: parti da obiettivi, figure competenti, setting e indicatori.'
        }
    ];

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    let state = loadState();
    let teacherMode = false;
    let teacherClass = '';
    let timerSeconds = 600;
    let timerHandle = null;
    let toastHandle = null;

    function defaultState() {
        return { route: 'complete', current: 0, answers: {}, notes: {}, completed: {}, caseIndex: 0, case: {} };
    }

    function loadState() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            return stored && typeof stored === 'object' ? { ...defaultState(), ...stored } : defaultState();
        } catch {
            return defaultState();
        }
    }

    function saveState({ remote = true } = {}) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        updateResume();
        if (remote) document.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function routeMissions() {
        return ROUTES[state.route]?.missions || ROUTES.complete.missions;
    }

    function showToast(message) {
        const toast = $('#toast');
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastHandle);
        toastHandle = setTimeout(() => toast.classList.remove('show'), 2200);
    }

    function updateResume() {
        const hasWork = Object.keys(state.answers).length || Object.keys(state.notes).length || Object.keys(state.completed).length;
        $('#resumeButton').hidden = !hasWork;
    }

    function applyRouteUI(route) {
        state.route = route;
        $$('.route-card').forEach(card => {
            const active = card.dataset.route === route;
            card.classList.toggle('selected', active);
            card.setAttribute('aria-pressed', String(active));
        });
        $('#startButton').innerHTML = route === 'case' ? 'Apri teoria e caso <span aria-hidden="true">→</span>' : 'Inizia dal ripasso essenziale <span aria-hidden="true">→</span>';
    }

    function selectRoute(route) {
        applyRouteUI(route);
        saveState();
    }

    function buildProgressMeta(source = state) {
        const route = ROUTES[source.route]?.missions || ROUTES.complete.missions;
        const completed = route.filter(id => source.completed?.[id]).length;
        let answered = 0;
        let correct = 0;
        Object.entries(source.answers || {}).forEach(([key, value]) => {
            const [missionId, questionIndex] = key.split('-').map(Number);
            const question = missions[missionId]?.questions?.[questionIndex];
            if (!question) return;
            answered += 1;
            if (Number(value) === question.answer) correct += 1;
        });
        return {
            campiCompilati: completed,
            totale: route.length,
            percentuale: route.length ? Math.round(completed / route.length * 100) : 0,
            missioniComplete: completed,
            missioniTotali: route.length,
            risposte: answered,
            risposteCorrette: correct,
            accuratezza: answered ? Math.round(correct / answered * 100) : 0,
            percorso: ROUTES[source.route]?.label || ROUTES.complete.label,
            missioneCorrente: Number(source.current) + 1
        };
    }

    function snapshotProgress() {
        return {
            _activity: 'ripasso-terzo-anno',
            _version: 1,
            route: state.route,
            current: state.current,
            answers: { ...state.answers },
            notes: { ...state.notes },
            completed: { ...state.completed },
            caseIndex: state.caseIndex,
            case: { ...state.case },
            _meta: buildProgressMeta(state)
        };
    }

    function restoreProgress(saved) {
        if (!saved || typeof saved !== 'object') return;
        const next = {
            ...defaultState(),
            route: ROUTES[saved.route] ? saved.route : 'complete',
            current: Number.isInteger(Number(saved.current)) && missions[Number(saved.current)] ? Number(saved.current) : 0,
            answers: saved.answers && typeof saved.answers === 'object' ? saved.answers : {},
            notes: saved.notes && typeof saved.notes === 'object' ? saved.notes : {},
            completed: saved.completed && typeof saved.completed === 'object' ? saved.completed : {},
            caseIndex: Number.isInteger(Number(saved.caseIndex)) ? Number(saved.caseIndex) : 0,
            case: saved.case && typeof saved.case === 'object' ? saved.case : {}
        };
        state = next;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        applyRouteUI(state.route);
        updateResume();
        if (!$('#course').hidden) {
            $('#routeChip').textContent = ROUTES[state.route].label;
            renderMission();
        }
    }

    window.MORipassoProgress = {
        snapshot: snapshotProgress,
        restore: restoreProgress
    };

    function openCourse(resume = false) {
        const route = routeMissions();
        if (!resume || !route.includes(state.current)) state.current = route[0];
        $('#launch').hidden = true;
        $('#course').hidden = false;
        $('#routeChip').textContent = ROUTES[state.route].label;
        renderNavigation();
        renderMission();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderNavigation() {
        const currentSection = { value: '' };
        $('#missionNav').innerHTML = missions.map(mission => {
            const visible = routeMissions().includes(mission.id);
            const section = mission.section !== currentSection.value
                ? `<div class="nav-section">${mission.section}</div>`
                : '';
            currentSection.value = mission.section;
            const done = !!state.completed[mission.id];
            return `${section}<button type="button" class="mission-link${mission.id === state.current ? ' active' : ''}${done ? ' done' : ''}${visible ? '' : ' skipped'}" data-mission="${mission.id}">
                <span class="nav-number">${done ? '✓' : String(mission.id + 1).padStart(2, '0')}</span>
                <span class="nav-title">${mission.title}</span>
                <span class="nav-status">${visible ? '' : '—'}</span>
            </button>`;
        }).join('');
        $$('.mission-link').forEach(button => button.addEventListener('click', () => goToMission(Number(button.dataset.mission))));
        updateProgress();
    }

    function updateProgress() {
        const route = routeMissions();
        const done = route.filter(id => state.completed[id]).length;
        const percentage = route.length ? Math.round(done / route.length * 100) : 0;
        $('#progressPercent').textContent = `${percentage}%`;
        $('#progressLabel').textContent = `${done} di ${route.length} missioni`;
        $('#progressBar').style.width = `${percentage}%`;
    }

    function renderMission() {
        const mission = missions[state.current];
        resetTimer(mission.minutes);
        $('#missionMount').innerHTML = mission.id === 10 ? renderCaseMission(mission) : renderStandardMission(mission);
        bindMissionEvents(mission);
        updateFooterButtons();
        renderNavigation();
        if (mission.id === 0) updateDiagnostic();
    }

    function renderStandardMission(mission) {
        const answerCount = mission.questions.filter((_, i) => state.answers[`${mission.id}-${i}`] !== undefined).length;
        const questionHtml = mission.questions.map((question, index) => renderQuestion(mission, question, index)).join('');
        const savedNote = state.notes[mission.id] || '';
        const diagnostic = mission.id === 0 ? `<div class="diagnostic-summary" id="diagnosticSummary">
            <div class="diagnostic-meter"><strong id="diagnosticScore">0/8</strong><span>risposte corrette</span></div>
            <p id="diagnosticMessage">Completa le domande dopo il ripasso: otterrai una prima mappa dei collegamenti già attivi.</p>
        </div>` : '';

        return `<article class="mission" data-mission-id="${mission.id}">
            ${missionHeader(mission)}
            <div class="mission-grid">
                ${renderEssentialTheory(mission)}
                <aside class="panel full-span remember-panel">
                    <p class="step-label">2 · Fissa l'idea centrale</p>
                    <h2>Da ricordare</h2>
                    <p>${mission.subtitle}</p>
                    <div class="teacher-note"><strong>Regia docente</strong><br>${mission.teacher}</div>
                </aside>
                <section class="panel full-span activity-block">
                    <div class="activity-head">
                        <div><p class="step-label">3 · Controlla se hai capito</p><h2>Domande guidate</h2><p>Ricevi subito la spiegazione della risposta. Puoi cambiare scelta.</p></div>
                        <span class="activity-score" id="activityScore">${answerCount}/${mission.questions.length} risposte</span>
                    </div>
                    ${diagnostic}
                    <div class="question-list">${questionHtml}</div>
                    <div class="task-box">
                        <p class="task-step">4 · Applica</p>
                        <label for="missionNote">Usa il concetto in una situazione</label>
                        <p>${mission.prompt}</p>
                        <textarea id="missionNote" placeholder="Scrivi qui: il testo viene salvato con il tuo codice personale.">${savedNote}</textarea>
                    </div>
                </section>
            </div>
        </article>`;
    }

    function renderEssentialTheory(mission) {
        const theory = mission.theory?.length
            ? `<div class="theory-cards">${mission.theory.map(item => `<article class="theory-card"><h3>${item[0]}</h3>${item[1]}</article>`).join('')}</div>`
            : '';
        const concepts = mission.concepts?.length
            ? `<h3 class="theory-subtitle">Parole e collegamenti fondamentali</h3><div class="concept-strip">${mission.concepts.map(item => `<div class="concept"><strong>${item[0]}</strong><span>${item[1]}</span></div>`).join('')}</div>`
            : '';
        const coverage = mission.coverage?.length
            ? `<h3 class="theory-subtitle">Mappa del contenuto</h3><div class="coverage-list">${mission.coverage.map(item => `<div class="coverage-item"><strong>${item[0]}</strong><span>${item[1]}</span></div>`).join('')}</div>`
            : '';
        return `<section class="panel full-span essential-theory">
            <p class="step-label">1 · Prima ripassiamo</p>
            <h2>Teoria essenziale</h2>
            <p class="theory-instruction">Leggi con calma: la spiegazione riparte dalle basi e contiene ciò che serve per affrontare le attività.</p>
            ${mission.intro || ''}${theory}${concepts}${coverage}
        </section>`;
    }

    function missionHeader(mission) {
        return `<header class="mission-head">
            <div class="mission-index">${String(mission.id + 1).padStart(2, '0')}</div>
            <div>
                <p class="kicker">${mission.section}</p>
                <h1>${mission.title}</h1>
                <p>${mission.subtitle}</p>
                <div class="mission-meta"><span class="meta-chip time">${mission.minutes} minuti</span>${mission.chips.map(chip => `<span class="meta-chip">${chip}</span>`).join('')}</div>
            </div>
        </header>`;
    }

    function renderQuestion(mission, question, index) {
        const key = `${mission.id}-${index}`;
        const selected = state.answers[key];
        const answered = selected !== undefined;
        const correct = selected === question.answer;
        const cardClass = answered ? (correct ? ' correct' : ' incorrect') : '';
        const options = question.options.map((option, optionIndex) => {
            const selectedClass = selected === optionIndex ? ' selected' : '';
            const answerClass = teacherMode && optionIndex === question.answer ? ' answer' : '';
            return `<button type="button" class="option-button${selectedClass}${answerClass}" data-question="${index}" data-option="${optionIndex}">${option}</button>`;
        }).join('');
        const feedback = answered ? `<p class="feedback ${correct ? 'ok' : 'no'}"><strong>${correct ? 'Corretto.' : 'Da rivedere.'}</strong> ${question.why}</p>` : '';
        return `<div class="question-card${cardClass}" data-question-card="${index}"><p class="question-text">${index + 1}. ${question.q}</p><div class="options">${options}</div>${feedback}</div>`;
    }

    function bindMissionEvents(mission) {
        $$('.option-button').forEach(button => button.addEventListener('click', () => {
            const key = `${mission.id}-${button.dataset.question}`;
            state.answers[key] = Number(button.dataset.option);
            updateMissionCompletion(mission);
            saveState();
            renderMission();
        }));
        const note = $('#missionNote');
        if (note) note.addEventListener('input', () => {
            state.notes[mission.id] = note.value;
            saveState();
        });
        const newCase = $('#newCaseButton');
        if (newCase) newCase.addEventListener('click', generateNewCase);
        const caseCheck = $('#checkCaseButton');
        if (caseCheck) caseCheck.addEventListener('click', checkCaseWork);
        $$('.case-input').forEach(input => input.addEventListener('input', saveCaseForm));
    }

    function updateMissionCompletion(mission) {
        const complete = mission.questions.every((_, index) => state.answers[`${mission.id}-${index}`] !== undefined);
        if (complete && !state.completed[mission.id]) showToast('Missione completata. Il progresso è stato salvato.');
        state.completed[mission.id] = complete;
    }

    function updateDiagnostic() {
        const mission = missions[0];
        const answered = mission.questions.filter((_, index) => state.answers[`0-${index}`] !== undefined).length;
        const correct = mission.questions.filter((question, index) => state.answers[`0-${index}`] === question.answer).length;
        $('#diagnosticScore').textContent = `${correct}/8`;
        const message = $('#diagnosticMessage');
        if (answered < 8) message.textContent = `Hai risposto a ${answered} domande su 8. Completa il controllo per leggere la tua mappa.`;
        else if (correct >= 7) message.textContent = 'Base molto solida: usa il percorso per consolidare collegamenti e linguaggio professionale.';
        else if (correct >= 5) message.textContent = 'Buona base: alcuni passaggi sono attivi, altri hanno bisogno di essere rimessi in sequenza.';
        else message.textContent = 'È il momento giusto per il ripasso: procedi per nuclei e prova a spiegare ogni scelta con parole tue.';
    }

    function renderCaseMission(mission) {
        const currentCase = cases[state.caseIndex % cases.length];
        const caseState = state.case || {};
        const checkedNeeds = caseState.needs || [];
        const checkedRoles = caseState.roles || [];
        const result = caseState.result || '';
        const needOptions = ['biologico', 'psicologico', 'sociale', 'informazioni mancanti'];
        const roleOptions = ['area sanitaria', 'area psicologica', 'area sociale', 'area educativa/assistenziale', 'rete informale'];
        return `<article class="mission" data-mission-id="10">
            ${missionHeader(mission)}
            <div class="mission-grid case-theory">
                ${renderEssentialTheory(mission)}
            </div>
            <div class="case-activity-heading">
                <p class="step-label">2 · Applica il metodo</p>
                <h2>Analizza il caso</h2>
                <p>Leggi la situazione, completa la griglia e poi confronta le scelte con il gruppo.</p>
            </div>
            <div class="case-lab">
                <section class="case-card">
                    <span class="case-tag">${currentCase.tag}</span>
                    <h2>${currentCase.title}</h2>
                    <p>${currentCase.text}</p>
                    <p><strong>Pista:</strong> ${currentCase.hint}</p>
                    <button class="primary-button" id="newCaseButton" type="button">Genera un altro caso ↻</button>
                </section>
                <section class="panel case-form">
                    <div>
                        <h2>1. Leggi i bisogni</h2>
                        <div class="check-grid">${needOptions.map(option => `<label><input class="case-input" type="checkbox" name="needs" value="${option}" ${checkedNeeds.includes(option) ? 'checked' : ''}> ${option}</label>`).join('')}</div>
                    </div>
                    <div>
                        <h2>2. Costruisci la rete</h2>
                        <div class="check-grid">${roleOptions.map(option => `<label><input class="case-input" type="checkbox" name="roles" value="${option}" ${checkedRoles.includes(option) ? 'checked' : ''}> ${option}</label>`).join('')}</div>
                    </div>
                    <div>
                        <label for="caseObjective"><strong>3. Scrivi un obiettivo verificabile</strong></label>
                        <textarea class="case-input" id="caseObjective" placeholder="Cambiamento atteso + indicatore + tempo + sostegno">${caseState.objective || ''}</textarea>
                    </div>
                    <div>
                        <label for="caseAction"><strong>4. Indica il primo passo operativo e un dato ancora mancante</strong></label>
                        <textarea class="case-input" id="caseAction" placeholder="Primo passo… Dato da verificare…">${caseState.action || ''}</textarea>
                    </div>
                    <button class="primary-button" id="checkCaseButton" type="button">Controlla la struttura</button>
                    ${result ? `<div class="case-result">${result}</div>` : ''}
                    <div class="teacher-note"><strong>Regia docente</strong><br>${mission.teacher}</div>
                </section>
            </div>
        </article>`;
    }

    function saveCaseForm() {
        state.case = {
            ...state.case,
            needs: $$('input[name="needs"]:checked').map(input => input.value),
            roles: $$('input[name="roles"]:checked').map(input => input.value),
            objective: $('#caseObjective')?.value || '',
            action: $('#caseAction')?.value || '',
            result: ''
        };
        saveState();
    }

    function checkCaseWork() {
        saveCaseForm();
        const needsOk = state.case.needs.length >= 2;
        const rolesOk = state.case.roles.length >= 2;
        const objectiveOk = state.case.objective.trim().length >= 35;
        const actionOk = state.case.action.trim().length >= 25;
        const missing = [
            !needsOk && 'almeno due dimensioni o informazioni mancanti',
            !rolesOk && 'almeno due componenti della rete',
            !objectiveOk && 'un obiettivo più completo e verificabile',
            !actionOk && 'primo passo e dato da verificare'
        ].filter(Boolean);
        state.case.result = missing.length
            ? `La struttura è avviata. Completa: ${missing.join('; ')}.`
            : 'La struttura regge: hai letto più dimensioni, attivato una rete, formulato un obiettivo e indicato ciò che va ancora verificato. Ora motiva le scelte al gruppo.';
        state.completed[10] = missing.length === 0;
        saveState();
        renderMission();
        if (!missing.length) showToast('Sfida completata. Ora confronta le scelte con il gruppo.');
    }

    function generateNewCase() {
        state.caseIndex = (state.caseIndex + 1) % cases.length;
        state.case = {};
        state.completed[10] = false;
        saveState();
        renderMission();
    }

    function goToMission(id) {
        if (!missions[id]) return;
        state.current = id;
        saveState();
        $('#classResultsPanel').hidden = true;
        renderMission();
        $('.course-sidebar').classList.remove('open');
        $('#mobileIndex').setAttribute('aria-expanded', 'false');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function updateFooterButtons() {
        const route = routeMissions();
        let position = route.indexOf(state.current);
        if (position === -1) position = 0;
        $('#prevMission').disabled = position <= 0;
        $('#nextMission').disabled = position >= route.length - 1;
        $('#nextMission').textContent = position >= route.length - 2 ? 'Vai alla sfida finale →' : 'Missione successiva →';
        if (state.current === 10) $('#nextMission').textContent = 'Percorso completato';
        $('#prevMission').onclick = () => position > 0 && goToMission(route[position - 1]);
        $('#nextMission').onclick = () => position < route.length - 1 && goToMission(route[position + 1]);
    }

    function resetTimer(minutes) {
        clearInterval(timerHandle);
        timerHandle = null;
        timerSeconds = minutes * 60;
        drawTimer();
        $('#timerToggle').textContent = 'Avvia';
    }

    function drawTimer() {
        const minutes = Math.floor(Math.max(0, timerSeconds) / 60);
        const seconds = Math.max(0, timerSeconds) % 60;
        $('#timerDisplay').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function toggleTimer() {
        if (timerHandle) {
            clearInterval(timerHandle);
            timerHandle = null;
            $('#timerToggle').textContent = 'Riprendi';
            return;
        }
        $('#timerToggle').textContent = 'Pausa';
        timerHandle = setInterval(() => {
            timerSeconds -= 1;
            drawTimer();
            if (timerSeconds <= 0) {
                clearInterval(timerHandle);
                timerHandle = null;
                $('#timerToggle').textContent = 'Finito';
                showToast('Tempo concluso: chiudi il passaggio e confronta le scelte.');
            }
        }, 1000);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function docenteSessionValid() {
        try {
            const data = JSON.parse(localStorage.getItem(DOCENTE_SESSION_KEY) || 'null');
            return Boolean(data?.expiresAt && Date.now() < data.expiresAt);
        } catch {
            return false;
        }
    }

    async function sha256(text) {
        const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    }

    async function verificaDocente() {
        if (docenteSessionValid()) return true;
        const password = prompt('Modalità docente / LIM.\n\nInserisci la password dell\'Area Docente:');
        if (password === null) return false;
        if (!window.crypto?.subtle) {
            alert('Questo browser non permette la verifica della password.');
            return false;
        }
        const valid = (await sha256(password.trim().toLowerCase())) === DOCENTE_HASH;
        if (!valid) {
            alert('Password non corretta');
            return false;
        }
        try {
            localStorage.setItem(DOCENTE_SESSION_KEY, JSON.stringify({
                issuedAt: Date.now(),
                expiresAt: Date.now() + DOCENTE_SESSION_DURATION
            }));
        } catch { }
        return true;
    }

    function pagePathNormalized() {
        let pagePath = location.pathname.split('?')[0].split('#')[0];
        const prefix = '/metodologieoperative';
        if (pagePath.startsWith(`${prefix}/`)) pagePath = pagePath.slice(prefix.length);
        return pagePath;
    }

    async function fetchClassRows(classCode) {
        const query = new URLSearchParams({
            select: 'student_code,data,updated_at',
            class_code: `eq.${classCode}`,
            page_path: `eq.${pagePathNormalized()}`,
            order: 'updated_at.desc',
            limit: '200'
        });
        const response = await fetch(`${SUPABASE_URL}/rest/v1/progress?${query}`, {
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const records = await response.json();
        return records.map(record => {
            let data = record.data;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch { data = {}; }
            }
            return { ...record, data: data && typeof data === 'object' ? data : {} };
        });
    }

    function classOverview(rows) {
        let completed = 0;
        let total = 0;
        let answered = 0;
        let correct = 0;
        rows.forEach(({ data }) => {
            const meta = data._meta || buildProgressMeta(data);
            completed += Number(meta.missioniComplete || 0);
            total += Number(meta.missioniTotali || 0);
            Object.entries(data.answers || {}).forEach(([key, value]) => {
                const [missionId, questionIndex] = key.split('-').map(Number);
                const question = missions[missionId]?.questions?.[questionIndex];
                if (!question) return;
                answered += 1;
                if (Number(value) === question.answer) correct += 1;
            });
        });
        return {
            progress: total ? Math.round(completed / total * 100) : 0,
            accuracy: answered ? Math.round(correct / answered * 100) : 0,
            completedAverage: rows.length ? (completed / rows.length).toFixed(1) : '0',
            answered
        };
    }

    function renderQuestionResults(rows, mission) {
        if (!mission.questions?.length) return '';
        return mission.questions.map((question, questionIndex) => {
            const distribution = new Array(question.options.length).fill(0);
            let answered = 0;
            let correct = 0;
            rows.forEach(({ data }) => {
                const value = data.answers?.[`${mission.id}-${questionIndex}`];
                if (value === undefined || value === null) return;
                const optionIndex = Number(value);
                answered += 1;
                if (distribution[optionIndex] !== undefined) distribution[optionIndex] += 1;
                if (optionIndex === question.answer) correct += 1;
            });
            const percentage = answered ? Math.round(correct / answered * 100) : 0;
            return `<article class="class-question-result">
                <p><strong>${questionIndex + 1}. ${escapeHtml(question.q)}</strong><br><span class="class-results-meta">${answered}/${rows.length} risposte · ${percentage}% corrette</span></p>
                <div class="class-result-bar" aria-label="${percentage}% risposte corrette"><span style="width:${percentage}%"></span></div>
                <div class="class-result-options">${question.options.map((option, optionIndex) => `<span class="${optionIndex === question.answer ? 'correct' : ''}">${escapeHtml(option)}: <strong>${distribution[optionIndex]}</strong></span>`).join('')}</div>
            </article>`;
        }).join('');
    }

    function renderMissionNotes(rows, mission) {
        if (mission.id === 10) {
            const objectives = rows.map(({ data }) => String(data.case?.objective || '').trim()).filter(Boolean);
            const actions = rows.map(({ data }) => String(data.case?.action || '').trim()).filter(Boolean);
            const choiceCounts = { needs: {}, roles: {} };
            rows.forEach(({ data }) => {
                ['needs', 'roles'].forEach(group => {
                    const values = Array.isArray(data.case?.[group]) ? data.case[group] : [];
                    values.forEach(value => choiceCounts[group][value] = (choiceCounts[group][value] || 0) + 1);
                });
            });
            const chips = Object.entries({ ...choiceCounts.needs, ...choiceCounts.roles })
                .sort((a, b) => b[1] - a[1])
                .map(([label, count]) => `<span>${escapeHtml(label)}: <strong>${count}</strong></span>`).join('');
            return `<h3>Scelte nel caso professionale</h3>
                <div class="class-result-options">${chips || '<span>Nessuna scelta salvata</span>'}</div>
                ${renderTextResponses('Obiettivi proposti', objectives)}
                ${renderTextResponses('Primi passi e dati mancanti', actions)}`;
        }
        const notes = rows.map(({ data }) => String(data.notes?.[mission.id] || '').trim()).filter(Boolean);
        return renderTextResponses('Risposte aperte', notes);
    }

    function renderTextResponses(title, values) {
        if (!values.length) return `<h3>${escapeHtml(title)}</h3><p class="class-results-meta">Nessuna risposta salvata.</p>`;
        const shown = values.slice(0, 12);
        return `<h3>${escapeHtml(title)} <span class="class-results-meta">${values.length} contributi</span></h3>
            <ul class="class-note-list">${shown.map(value => `<li>${escapeHtml(value.length > 360 ? `${value.slice(0, 360)}…` : value)}</li>`).join('')}</ul>
            ${values.length > shown.length ? `<p class="class-results-meta">Altri ${values.length - shown.length} contributi sono disponibili nell’Area Docente.</p>` : ''}`;
    }

    async function showClassResults() {
        if (!(await verificaDocente())) return;
        if (!teacherClass) {
            const input = prompt('Quale classe vuoi riepilogare? (es. 4sb)', localStorage.getItem('mo:lim-class') || '');
            if (input === null) return;
            teacherClass = input.trim().toLowerCase();
            if (!teacherClass) return;
            localStorage.setItem('mo:lim-class', teacherClass);
        }
        const panel = $('#classResultsPanel');
        panel.hidden = false;
        panel.innerHTML = `<div class="class-results-head"><div><p class="kicker">Riepilogo classe</p><h2>${escapeHtml(teacherClass.toUpperCase())}</h2></div><button class="class-results-close" type="button" data-close-class-results>Chiudi</button></div><p>Caricamento dei risultati…</p>`;
        let rows;
        try {
            rows = await fetchClassRows(teacherClass);
        } catch (error) {
            panel.innerHTML = `<div class="class-results-head"><div><p class="kicker">Riepilogo classe</p><h2>Connessione non disponibile</h2></div><button class="class-results-close" type="button" data-close-class-results>Chiudi</button></div><p>Non riesco a leggere i dati da Supabase: ${escapeHtml(error.message)}.</p>`;
            return;
        }
        const mission = missions[state.current];
        const overview = classOverview(rows);
        panel.innerHTML = `<div class="class-results-head">
                <div><p class="kicker">Riepilogo classe ${escapeHtml(teacherClass.toUpperCase())}</p><h2>Missione ${mission.id + 1} · ${escapeHtml(mission.title)}</h2><p class="class-results-meta">Dati anonimi da proiettare · aggiornati adesso</p></div>
                <button class="class-results-close" type="button" data-close-class-results>Chiudi</button>
            </div>
            <div class="class-summary-grid">
                <div class="class-summary-card"><strong>${rows.length}</strong><span>studenti con dati</span></div>
                <div class="class-summary-card"><strong>${overview.progress}%</strong><span>avanzamento medio</span></div>
                <div class="class-summary-card"><strong>${overview.accuracy}%</strong><span>accuratezza complessiva</span></div>
                <div class="class-summary-card"><strong>${overview.completedAverage}</strong><span>missioni complete in media</span></div>
            </div>
            ${rows.length ? renderQuestionResults(rows, mission) + renderMissionNotes(rows, mission) : '<p>Nessuno studente di questa classe ha ancora salvato il lavoro su questa pagina.</p>'}
            <p class="class-results-meta">Le risposte sono mostrate senza codici personali. Il dettaglio del singolo studente resta disponibile nell’Area Docente.</p>`;
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function toggleTeacherMode() {
        const next = !teacherMode;
        if (next && !(await verificaDocente())) return;
        teacherMode = next;
        document.body.classList.toggle('teacher-mode', teacherMode);
        $('#teacherToggle').setAttribute('aria-pressed', String(teacherMode));
        $('#classResultsButton').hidden = !teacherMode;
        if (teacherMode) {
            localStorage.setItem('mo:ripasso-teacher', '1');
            teacherClass = (localStorage.getItem('mo:lim-class') || '').trim().toLowerCase();
            if (!teacherClass) {
                const input = prompt('Classe da mostrare alla LIM (es. 4sb). Puoi lasciarla vuota e sceglierla dopo.', '');
                if (input !== null) teacherClass = input.trim().toLowerCase();
                if (teacherClass) localStorage.setItem('mo:lim-class', teacherClass);
            }
        } else {
            localStorage.removeItem('mo:ripasso-teacher');
            $('#classResultsPanel').hidden = true;
        }
        renderMission();
        if (teacherMode && teacherClass) showClassResults();
    }

    $$('.route-card').forEach(card => card.addEventListener('click', () => selectRoute(card.dataset.route)));
    $('#startButton').addEventListener('click', () => openCourse(false));
    $('#resumeButton').addEventListener('click', () => openCourse(true));
    $('#teacherToggle').addEventListener('click', toggleTeacherMode);
    $('#classResultsButton').addEventListener('click', showClassResults);
    $('#classResultsPanel').addEventListener('click', event => {
        if (event.target.closest('[data-close-class-results]')) $('#classResultsPanel').hidden = true;
    });
    $('#contrastToggle').addEventListener('click', () => {
        const active = document.body.classList.toggle('high-contrast');
        $('#contrastToggle').setAttribute('aria-pressed', String(active));
    });
    $('#printButton').addEventListener('click', () => window.print());
    $('#mobileIndex').addEventListener('click', () => {
        const open = $('.course-sidebar').classList.toggle('open');
        $('#mobileIndex').setAttribute('aria-expanded', String(open));
    });
    $('#sidebarClose').addEventListener('click', () => {
        $('.course-sidebar').classList.remove('open');
        $('#mobileIndex').setAttribute('aria-expanded', 'false');
    });
    $('#timerToggle').addEventListener('click', toggleTimer);
    $('#timerReset').addEventListener('click', () => resetTimer(missions[state.current].minutes));
    $('#resetButton').addEventListener('click', () => {
        if (!confirm('Vuoi cancellare le risposte e ricominciare il percorso?')) return;
        localStorage.removeItem(STORAGE_KEY);
        state = defaultState();
        teacherMode = false;
        document.body.classList.remove('teacher-mode');
        localStorage.removeItem('mo:ripasso-teacher');
        $('#teacherToggle').setAttribute('aria-pressed', 'false');
        $('#classResultsButton').hidden = true;
        $('#classResultsPanel').hidden = true;
        $('#course').hidden = true;
        $('#launch').hidden = false;
        selectRoute('complete');
        updateResume();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    selectRoute(state.route);
    updateResume();
    if (localStorage.getItem('mo:ripasso-teacher') === '1' && docenteSessionValid()) {
        teacherMode = true;
        teacherClass = (localStorage.getItem('mo:lim-class') || '').trim().toLowerCase();
        document.body.classList.add('teacher-mode');
        $('#teacherToggle').setAttribute('aria-pressed', 'true');
        $('#classResultsButton').hidden = false;
    } else {
        localStorage.removeItem('mo:ripasso-teacher');
    }
})();
