(() => {
    'use strict';

    const STORAGE_KEY = 'mo:ripasso-terzo-anno:v3';
    const SUPABASE_URL = 'https://ruplzgcnheddmqqdephp.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cGx6Z2NuaGVkZG1xcWRlcGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTYyMjksImV4cCI6MjA3NTY5MjIyOX0.tOLIkgi5yTt61_0rMlXUqxnbil4DLD7kBaqZBVAv1CI';
    const DOCENTE_SESSION_KEY = 'mo:docente-session';
    const DOCENTE_SESSION_DURATION = 1000 * 60 * 60 * 6;
    const DOCENTE_HASH = 'ed5672a676cf4556ed88868d438204e25c5ce272664a4083b92b5c783294e9e4';

    const missions = [
        {
            id: 0,
            section: 'Persona e intervento',
            title: 'Persona, bisogni e relazione d’aiuto',
            subtitle: 'Il modello bio-psico-sociale e il ruolo professionale nella relazione con la persona.',
            minutes: 30,
            chips: ['modello bio-psico-sociale', 'relazione d’aiuto', 'servizi'],
            intro: '<p>Nei servizi non si incontra “un problema”, ma una <strong>persona inserita in un contesto</strong>. Per comprendere una situazione occorre considerare insieme condizioni di salute, vissuti, relazioni, ambiente e risorse disponibili.</p>',
            theory: [
                ['Il bisogno non è un’etichetta', '<p>Un bisogno segnala una distanza tra la situazione presente e una condizione di benessere possibile. Può essere <strong>espresso direttamente</strong>, osservato da altri oppure non ancora riconosciuto. Non definisce tutta la persona e deve essere letto insieme a capacità, desideri e risorse.</p>'],
                ['Le tre dimensioni', '<p>La dimensione <strong>biologica</strong> riguarda corpo, salute e autonomia; quella <strong>psicologica</strong> emozioni, pensieri e motivazione; quella <strong>sociale</strong> relazioni, casa, scuola, lavoro, reddito e territorio. Le dimensioni <span class="hl">si influenzano continuamente</span>.</p>'],
                ['La relazione d’aiuto', '<p>Aiutare professionalmente significa ascoltare, comprendere la domanda, concordare obiettivi realistici e sostenere l’autonomia. <strong>Non significa decidere al posto della persona</strong>. L’operatore distingue ciò che osserva dalle proprie interpretazioni e rispetta ruolo, riservatezza e limiti professionali.</p>'],
                ['Dal bisogno ai servizi', '<p>Un bisogno non conduce automaticamente a una prestazione. Prima di orientare occorre verificare domanda della persona, urgenza, requisiti di accesso, risorse già presenti, ostacoli concreti e disponibilità effettiva del servizio.</p><p class="example-line"><strong>Esempio:</strong> per una persona anziana che non esce più di casa non basta indicare un centro diurno; bisogna capire perché non esce, se lo desidera, come potrebbe raggiungerlo e quali sostegni sono già presenti.</p>']
            ],
            questions: [
                { q: 'Una persona anziana ha dolore al ginocchio, ha paura di cadere e ha smesso di vedere gli amici. Quale lettura applica correttamente il modello bio-psico-sociale?', options: ['Il dolore è la causa unica; basta un intervento sanitario', 'Dolore, paura e isolamento sono dimensioni distinte ma collegate e vanno considerate insieme', 'Il problema principale è sociale perché riguarda gli amici', 'Finché non c’è una diagnosi non è possibile formulare domande'], answer: 1, why: 'Il caso contiene aspetti biologici, psicologici e sociali che possono rafforzarsi a vicenda.' },
                { q: 'Quale frase descrive un bisogno senza trasformarlo in un’etichetta?', options: ['È una persona non collaborante', 'Rifiuta sempre qualsiasi aiuto', 'Nelle ultime due settimane ha rifiutato tre proposte e riferisce di temere di perdere autonomia', 'Non capisce ciò che è meglio per lei'], answer: 2, why: 'La frase distingue fatti osservabili e parole della persona da giudizi generali.' },
                { q: 'Durante un colloquio la persona chiede all’operatore di scegliere al suo posto. Qual è la risposta professionale più corretta?', options: ['Scegliere rapidamente per ridurre l’ansia', 'Presentare possibilità e conseguenze, verificare la comprensione e sostenere una scelta consapevole', 'Rifiutare di fornire qualsiasi informazione', 'Chiedere alla famiglia di decidere'], answer: 1, why: 'L’operatore informa e sostiene, ma mantiene la persona protagonista delle decisioni.' },
                { q: 'Quando un bisogno può essere definito “espresso”?', options: ['Quando è previsto da una norma', 'Quando la persona lo comunica o formula una richiesta', 'Quando l’operatore lo ritiene urgente', 'Quando esiste già un servizio disponibile'], answer: 1, why: 'Il bisogno espresso emerge dalla comunicazione o dalla domanda della persona.' },
                { q: 'Prima di indirizzare una persona a un servizio, quale controllo è indispensabile?', options: ['Verificare soltanto la distanza dall’abitazione', 'Verificare pertinenza, requisiti, modalità di accesso e disponibilità attuale', 'Scegliere il servizio più conosciuto', 'Assicurare alla persona che sarà accolta'], answer: 1, why: 'L’orientamento deve basarsi su informazioni operative verificate, senza promettere l’accesso.' },
                { q: 'Quale comportamento sostiene l’autonomia?', options: ['Svolgere il compito al posto della persona', 'Offrire il sostegno necessario e ridurlo quando aumentano le capacità', 'Mantenere sempre lo stesso livello di aiuto', 'Valutare solo il risultato finale'], answer: 1, why: 'Il sostegno è proporzionato e viene ridotto quando la persona può agire con maggiore autonomia.' }
            ],
            openQuestions: ['Definisci con parole tue il modello bio-psico-sociale.', 'Costruisci un esempio in cui un cambiamento in una dimensione produca conseguenze nelle altre due.', 'Spiega la differenza tra sostenere una persona e sostituirsi a lei.'],
            teacher: 'Confronta le definizioni e verifica che compaiano sia le tre dimensioni sia la loro reciproca influenza.'
        },
        {
            id: 1,
            section: 'Progettazione',
            title: 'Il progetto individualizzato',
            subtitle: 'Dall’analisi della situazione alla verifica degli interventi.',
            minutes: 30,
            chips: ['analisi', 'obiettivi', 'verifica'],
            intro: '<p>Il progetto individualizzato collega ciò che sappiamo della situazione con un cambiamento possibile. Non è un elenco di attività e non procede in modo rigido: <strong>osservazione, interpretazione e verifica si richiamano continuamente</strong>.</p>',
            theory: [
                ['Analizzare la situazione', '<p>Si raccolgono fatti, parole della persona, informazioni sul contesto, risorse, difficoltà e vincoli. Raccolta e lettura non sono compartimenti separati: <span class="hl">una prima interpretazione fa nascere nuove domande</span>, e le nuove informazioni possono modificare l’interpretazione iniziale.</p>'],
                ['Formulare l’obiettivo', '<p>Un obiettivo indica il <strong>cambiamento atteso</strong>, non l’attività da svolgere. Deve essere realistico, comprensibile, coerente con la volontà della persona e verificabile.</p><p class="example-line"><strong>Esempio:</strong> “entro otto settimane partecipare a due attività di gruppo alla settimana” è un obiettivo; “iscrizione al centro” è un’azione.</p>'],
                ['Definire gli interventi', '<p>Per ogni azione vanno chiariti responsabilità, tempi, risorse, modalità operative e raccordi con la rete. Due persone con lo stesso bisogno possono richiedere interventi diversi perché cambiano contesto, capacità e preferenze.</p>'],
                ['Verificare e valutare', '<p>La <strong>verifica in itinere</strong> controlla durante il percorso se le azioni producono segnali utili. La <strong>valutazione</strong> considera risultati, processo, ostacoli e modifiche necessarie. Se i dati non confermano l’ipotesi iniziale, il progetto si corregge.</p>']
            ],
            questions: [
                { q: 'Durante l’analisi emergono nuove informazioni che contraddicono l’ipotesi iniziale. Che cosa deve fare l’équipe?', options: ['Ignorarle per non rallentare', 'Conservarle soltanto per la valutazione finale', 'Rivedere l’interpretazione e, se necessario, obiettivi e interventi', 'Cambiare immediatamente servizio'], answer: 2, why: 'La progettazione è circolare: nuove informazioni possono richiedere una revisione.' },
                { q: 'Quale formulazione descrive un obiettivo e non un’attività?', options: ['Iscrivere Marco al laboratorio', 'Telefonare al centro diurno', 'Entro sei settimane Marco partecipa con continuità a un’attività scelta da lui', 'Compilare la scheda di accesso'], answer: 2, why: 'L’obiettivo indica il cambiamento atteso; le altre formulazioni descrivono azioni.' },
                { q: 'Quale elemento rende verificabile un obiettivo?', options: ['Una formulazione generale', 'Un indicatore osservabile e un tempo di riferimento', 'Il nome del servizio', 'Il numero dei professionisti'], answer: 1, why: 'Indicatore e tempo permettono di confrontare il risultato con ciò che era atteso.' },
                { q: 'Un intervento non viene svolto perché manca il trasporto. Come va considerata questa informazione?', options: ['Come una colpa della persona', 'Come un vincolo concreto da affrontare nella revisione', 'Come prova che l’obiettivo era sbagliato', 'Come dato non pertinente'], answer: 1, why: 'Gli ostacoli di contesto incidono sull’attuazione e devono entrare nella verifica.' },
                { q: 'Qual è la differenza principale tra verifica in itinere e valutazione?', options: ['La verifica riguarda i documenti; la valutazione la persona', 'La verifica accompagna l’attuazione; la valutazione interpreta risultati e processo', 'Non esiste una differenza', 'La valutazione precede sempre l’intervento'], answer: 1, why: 'La verifica consente correzioni durante il percorso; la valutazione legge ciò che è avvenuto.' },
                { q: 'Due persone hanno difficoltà simili ma desideri e reti diverse. Il progetto dovrebbe:', options: ['Prevedere le stesse attività', 'Essere personalizzato rispetto a obiettivi, risorse e contesto', 'Dipendere solo dal servizio disponibile', 'Essere deciso dal professionista più esperto'], answer: 1, why: 'Individualizzare significa costruire un percorso coerente con quella persona e quella situazione.' }
            ],
            openQuestions: ['Spiega la differenza tra obiettivo e intervento e scrivi un esempio di entrambi.', 'Formula un obiettivo verificabile per una persona che vuole riprendere a uscire dopo un periodo di isolamento.', 'Descrivi un caso in cui la verifica in itinere potrebbe portare a modificare il progetto.'],
            teacher: 'Nel confronto, separa sempre il cambiamento atteso dalle azioni scelte per raggiungerlo.'
        },
        {
            id: 2,
            section: 'Lavoro professionale',
            title: 'Reti, équipe e documentazione',
            subtitle: 'Risorse formali e informali, ruoli professionali e scrittura dei fatti osservati.',
            minutes: 35,
            chips: ['lavoro di rete', 'équipe', 'documentazione'],
            intro: '<p>Le situazioni complesse richiedono più risorse coordinate. Lavorare in rete significa <strong>collegare persone, servizi e responsabilità</strong>; lavorare in équipe significa integrare punti di vista professionali diversi senza confondere i ruoli.</p>',
            theory: [
                ['Rete informale e rete formale', '<p>La <strong>rete informale</strong> nasce dai legami: familiari, amici, vicini e persone significative. La <strong>rete formale</strong> comprende servizi e professionisti con mandato e responsabilità definite. Le due reti possono collaborare, ma una non sostituisce automaticamente l’altra.</p>'],
                ['Che cosa significa coordinare', '<p>Per ogni componente della rete occorre chiarire contributo possibile, limiti, modalità di comunicazione e responsabilità. Una buona mappa mostra anche i collegamenti assenti o fragili.</p>'],
                ['Il lavoro d’équipe', '<p>Ogni professionista porta dati e valutazioni pertinenti al proprio ruolo. L’équipe confronta ipotesi, definisce priorità, distribuisce compiti e stabilisce tempi di verifica. Il dissenso motivato è utile quando resta centrato sui dati e sugli obiettivi.</p>'],
                ['Documentare senza giudicare', '<p>Un resoconto professionale descrive <span class="hl">comportamenti osservabili, contesto, data e interventi effettuati</span>. “Durante l’attività ha lasciato il tavolo dopo dieci minuti” è un dato; “è svogliato” è un giudizio.</p>']
            ],
            questions: [
                { q: 'Una vicina porta la spesa e avvisa il figlio quando nota difficoltà. In quale rete si colloca?', options: ['Rete formale, perché l’aiuto è regolare', 'Rete informale, perché agisce sulla base di un legame di prossimità', 'Équipe professionale', 'Servizio domiciliare'], answer: 1, why: 'La regolarità dell’aiuto non trasforma un legame personale in un mandato professionale.' },
                { q: 'Quale elemento deve comparire in una mappa di rete utile?', options: ['Solo l’elenco dei nomi', 'Ruolo, contributo possibile, limiti e collegamenti tra le risorse', 'Soltanto i servizi pubblici', 'La valutazione morale di ogni componente'], answer: 1, why: 'La mappa serve a capire chi può fare che cosa e come le risorse comunicano.' },
                { q: 'Quale informazione è pertinente in una riunione d’équipe?', options: ['Un dettaglio privato non collegato al progetto', 'Un comportamento osservato che incide sull’obiettivo concordato', 'Un’opinione personale sulla famiglia', 'Tutto ciò che l’operatore conosce'], answer: 1, why: 'Si condividono le informazioni necessarie al progetto, nel rispetto della riservatezza.' },
                { q: 'Due professionisti interpretano diversamente un comportamento. Qual è il passaggio corretto?', options: ['Scegliere l’interpretazione del più anziano', 'Confrontare fatti, contesto, mandato e ipotesi prima di decidere', 'Evitare di verbalizzare il dissenso', 'Sospendere ogni intervento'], answer: 1, why: 'Il confronto deve partire dai dati e rendere esplicite le diverse ipotesi.' },
                { q: 'Quale frase è adatta a un resoconto professionale?', options: ['La ragazza è aggressiva', 'La ragazza non rispetta mai nessuno', 'Alle 10:15 ha alzato la voce, spinto la sedia e lasciato l’aula dopo il richiamo', 'La ragazza ha un brutto carattere'], answer: 2, why: 'La frase indica tempo e comportamenti osservabili senza attribuire un tratto stabile.' },
                { q: 'Se la famiglia non riesce più a garantire da sola l’assistenza, il lavoro di rete dovrebbe:', options: ['Attribuirle maggiori responsabilità', 'Integrare sostegni formali e informali chiarendo compiti e limiti', 'Escluderla dal progetto', 'Attivare il primo servizio disponibile'], answer: 1, why: 'La rete integra le risorse senza scaricare il compito su una sola parte.' }
            ],
            openQuestions: ['Definisci rete formale e rete informale e fornisci un esempio per ciascuna.', 'Trasforma la frase “non collabora ed è pigro” in una descrizione professionale basata su fatti osservabili.', 'Spiega che cosa dovrebbe decidere un’équipe al termine di una riunione su un caso.'],
            teacher: 'Proietta alcune risposte e chiedi alla classe di individuare dati, interpretazioni e giudizi.'
        },
        {
            id: 3,
            section: 'Laboratorio',
            title: 'Autobiografia, memoria e narrazione',
            subtitle: 'Usare il racconto di sé rispettando libertà, riservatezza e significati personali.',
            minutes: 25,
            chips: ['autobiografia', 'memoria', 'ascolto'],
            intro: '<p>Il lavoro autobiografico collega eventi, persone significative, passaggi di crescita e risorse. Non cerca una cronologia perfetta: aiuta a riconoscere il significato che la persona attribuisce alla propria esperienza.</p>',
            theory: [
                ['Memoria e selezione', '<p>Ricordare non significa riprodurre il passato in modo identico. La memoria seleziona e riorganizza gli eventi a partire dal presente. Per questo due persone possono attribuire significati diversi allo stesso episodio.</p>'],
                ['Libertà e protezione', '<p>Nessuno deve essere obbligato a raccontare esperienze intime. L’attività deve offrire possibilità di scelta, regole di ascolto, assenza di giudizio e alternative su episodi scolastici o inventati.</p>'],
                ['Dalla storia alle risorse', '<p>Una mappa autobiografica può far emergere capacità sviluppate, persone di sostegno, momenti di cambiamento e strategie utilizzate. Questi elementi possono diventare risorse per un progetto futuro.</p>'],
                ['Trasfigurare l’esperienza', '<p>Scrittura, immagini, oggetti o personaggi simbolici permettono di raccontare un’esperienza senza esporla in modo diretto. La trasformazione creativa costruisce una distanza che può renderla comunicabile.</p>']
            ],
            questions: [
                { q: 'Qual è l’obiettivo principale di una mappa autobiografica?', options: ['Ricostruire tutte le date senza errori', 'Individuare collegamenti, significati, risorse e passaggi di cambiamento', 'Valutare se i ricordi sono veri', 'Confrontare la storia con quella dei compagni'], answer: 1, why: 'Il valore formativo sta nei significati e nei collegamenti.' },
                { q: 'Uno studente non vuole condividere un episodio personale. Quale scelta è corretta?', options: ['Insistere perché l’attività richiede sincerità', 'Consentire un’alternativa e rispettare la scelta', 'Chiedere ai compagni di convincerlo', 'Escluderlo dall’attività'], answer: 1, why: 'La condivisione autobiografica deve essere volontaria e protetta.' },
                { q: 'Due persone ricordano diversamente lo stesso evento. Che cosa indica?', options: ['Una delle due mente', 'La memoria seleziona e attribuisce significati a partire dal presente', 'L’autobiografia non è utile', 'Ogni ricordo deve essere verificato'], answer: 1, why: 'Il ricordo è una ricostruzione personale, non una registrazione meccanica.' },
                { q: 'Quale prodotto permette una maggiore distanza protettiva?', options: ['Il racconto orale obbligatorio', 'Un racconto simbolico con un personaggio inventato', 'La lettura pubblica del diario', 'La valutazione dei ricordi'], answer: 1, why: 'La mediazione simbolica consente di lavorare sui significati senza esposizione diretta.' },
                { q: 'In che modo un episodio passato può essere utile alla progettazione?', options: ['Se permette di individuare capacità, sostegni e strategie già utilizzate', 'Solo se è positivo', 'Solo se è documentato da un adulto', 'Se viene raccontato in ordine cronologico'], answer: 0, why: 'Le risorse emerse dalla storia possono orientare obiettivi e sostegni futuri.' }
            ],
            openQuestions: ['Spiega perché la memoria autobiografica non coincide con una registrazione esatta del passato.', 'Indica tre regole necessarie per svolgere un’attività autobiografica in classe.', 'Fai un esempio di trasformazione simbolica di un’esperienza che protegga la riservatezza.'],
            teacher: 'Nel riepilogo mostra soltanto risposte prive di riferimenti personali riconoscibili.'
        },
        {
            id: 4,
            section: 'Infanzia e apprendimento',
            title: 'Seconda infanzia, gioco e peer tutoring',
            subtitle: 'Sviluppo, apprendimento attraverso il gioco e aiuto tra pari.',
            minutes: 30,
            chips: ['3-6 anni', 'gioco', 'peer tutoring'],
            intro: '<p>Nella seconda infanzia il bambino amplia linguaggio, movimento, autonomia e capacità di stare con gli altri. Il gioco permette di provare ruoli, regole, soluzioni e relazioni.</p>',
            theory: [
                ['Sviluppo integrato', '<p>Le aree motoria, cognitiva, linguistica, emotiva e sociale procedono in relazione. Costruire una torre richiede coordinazione, pianificazione, linguaggio e collaborazione.</p>'],
                ['Il ruolo del gioco', '<p>Nel gioco simbolico il bambino rappresenta situazioni e ruoli; nel gioco di regole impara ad attendere e negoziare; nel gioco costruttivo pianifica, prova e corregge.</p>'],
                ['Scaffolding', '<p>Il termine inglese <strong>scaffolding</strong> significa “impalcatura”: è un aiuto temporaneo e calibrato. L’adulto offre un indizio o mostra un passaggio, poi <span class="hl">riduce il sostegno quando aumenta l’autonomia</span>.</p>'],
                ['Peer tutoring', '<p>Nel <strong>peer tutoring</strong>, cioè l’aiuto strutturato tra pari, il tutor non consegna la soluzione. Formula domande, offre indizi, osserva il procedimento e chiede al compagno di spiegare.</p>']
            ],
            questions: [
                { q: 'Un bambino non sa rendere stabile la base di una costruzione. Quale intervento è scaffolding?', options: ['Costruire al posto suo', 'Suggerire di osservare la larghezza dei pezzi e lasciarlo riprovare', 'Togliere il materiale difficile', 'Mostrare il prodotto finito da copiare'], answer: 1, why: 'L’indizio sostiene il ragionamento senza sostituirsi all’azione.' },
                { q: 'Quando il sostegno dell’adulto dovrebbe diminuire?', options: ['Quando finisce il tempo', 'Quando il bambino procede con maggiore autonomia', 'Dopo il primo errore', 'Solo al termine dell’anno'], answer: 1, why: 'Lo scaffolding è temporaneo e si adatta alle competenze che emergono.' },
                { q: 'Quale attività coinvolge più aree di sviluppo?', options: ['Ripetere una parola senza contesto', 'Organizzare un negozio simbolico con ruoli e oggetti', 'Guardare l’adulto svolgere un compito', 'Copiare un disegno'], answer: 1, why: 'Il gioco simbolico integra linguaggio, regole sociali, rappresentazione e coordinazione.' },
                { q: 'Nel peer tutoring il tutor fornisce subito tutte le risposte. Qual è il problema?', options: ['Il compito finisce troppo presto', 'Il compagno ottiene il prodotto ma non costruisce il procedimento', 'Il tutor usa troppe parole', 'L’attività non può essere valutata'], answer: 1, why: 'L’obiettivo è rendere l’altro capace di procedere.' },
                { q: 'Quale domanda del tutor favorisce maggiormente l’apprendimento?', options: ['Vuoi che lo faccia io?', 'Qual è la risposta?', 'Da quale informazione potresti partire e perché?', 'Hai capito sì o no?'], answer: 2, why: 'La domanda fa esplicitare il procedimento senza fornire la soluzione.' },
                { q: 'A che cosa serve il confronto finale?', options: ['A stabilire chi è stato più veloce', 'A ricostruire strategie, difficoltà e apprendimenti di entrambi', 'A correggere solo il compagno', 'A sostituire la valutazione'], answer: 1, why: 'La rielaborazione rende consapevoli i processi utilizzati.' }
            ],
            openQuestions: ['Definisci lo scaffolding e descrivi un esempio concreto.', 'Progetta un’attività di gioco per bambini di 3-6 anni indicando obiettivo, materiali e ruolo dell’adulto.', 'Spiega che cosa deve fare un tutor per aiutare senza sostituirsi al compagno.'],
            teacher: 'Nelle risposte cerca la riduzione graduale dell’aiuto e la distinzione tra prodotto concluso e apprendimento.'
        },
        {
            id: 5,
            section: 'Dipendenze e servizi',
            title: 'Dipendenze, SerD e colloquio motivazionale',
            subtitle: 'Comprendere l’ambivalenza e costruire un percorso multiprofessionale.',
            minutes: 35,
            chips: ['dipendenze', 'SerD', 'colloquio motivazionale'],
            intro: '<p>La dipendenza non coincide con una semplice abitudine. Comporta perdita di controllo, priorità crescente attribuita alla sostanza o al comportamento e prosecuzione nonostante conseguenze negative.</p>',
            theory: [
                ['Il Servizio per le Dipendenze', '<p>Il <strong>SerD</strong> è il Servizio per le Dipendenze. Accoglie, valuta e costruisce percorsi personalizzati attraverso competenze sanitarie, psicologiche, educative e sociali.</p>'],
                ['Le fasi del cambiamento', '<p>La persona può non riconoscere il problema, iniziare a valutarlo, prepararsi, agire o cercare di mantenere il cambiamento. Una ricaduta non cancella il percorso: va analizzata per comprendere rischi e sostegni necessari.</p>'],
                ['Ambivalenza', '<p>L’ambivalenza è la presenza contemporanea di ragioni per cambiare e ragioni per non cambiare. Pressioni e giudizi possono aumentare la resistenza; domande e ascolto aiutano a esprimere entrambe le parti.</p>'],
                ['Le abilità OARS', '<p><strong>OARS</strong> è un acronimo inglese: <strong>Open questions</strong> (domande aperte), <strong>Affirmations</strong> (riconoscimenti), <strong>Reflective listening</strong> (ascolto riflessivo) e <strong>Summaries</strong> (sintesi). Sono strumenti per comprendere e far emergere il punto di vista della persona.</p>']
            ],
            questions: [
                { q: 'Quale elemento distingue più chiaramente una dipendenza da un’abitudine?', options: ['La frequenza quotidiana', 'La perdita di controllo e la prosecuzione nonostante conseguenze negative', 'La disapprovazione degli altri', 'La presenza di una sostanza illegale'], answer: 1, why: 'La dipendenza riguarda controllo, priorità e conseguenze.' },
                { q: 'Una persona riconosce alcuni danni ma teme di perdere l’unico modo con cui si calma. Questa posizione esprime:', options: ['Assenza di consapevolezza', 'Ambivalenza rispetto al cambiamento', 'Decisione consolidata', 'Mancanza permanente di motivazione'], answer: 1, why: 'Sono presenti ragioni per cambiare e ragioni per mantenere il comportamento.' },
                { q: 'Quale domanda è realmente aperta?', options: ['Hai smesso?', 'Non pensi che dovresti cambiare?', 'Che cosa ti preoccupa e che cosa temi di perdere cambiando?', 'Sei d’accordo con il medico?'], answer: 2, why: 'La domanda invita a esplorare entrambe le parti dell’ambivalenza.' },
                { q: 'Quale frase è ascolto riflessivo?', options: ['Devi capire che così non può continuare', 'Se ho capito, una parte di te vuole cambiare e un’altra teme di non farcela', 'Perché non segui le indicazioni?', 'Ti spiego io il problema'], answer: 1, why: 'La frase restituisce il significato ascoltato e permette di correggerlo.' },
                { q: 'Qual è una caratteristica del SerD?', options: ['Un trattamento uguale per tutti', 'Un percorso multiprofessionale costruito sulla situazione della persona', 'Il ricovero obbligatorio', 'L’esclusione della rete sociale'], answer: 1, why: 'Il servizio integra valutazioni e interventi in un progetto personalizzato.' },
                { q: 'Dopo una ricaduta, quale risposta è più coerente?', options: ['Considerare fallito tutto', 'Analizzare l’accaduto e rivedere rischi, risorse e sostegni', 'Interrompere il servizio', 'Aumentare automaticamente il controllo'], answer: 1, why: 'La ricaduta può fornire informazioni utili per modificare il percorso.' }
            ],
            openQuestions: ['Definisci l’ambivalenza e costruisci un esempio collegato a un cambiamento.', 'Scrivi una domanda aperta e una frase di ascolto riflessivo per una persona incerta sul cambiamento.', 'Spiega perché il SerD richiede un lavoro multiprofessionale.'],
            teacher: 'Evidenzia la differenza tra convincere la persona e aiutarla a formulare motivazioni proprie.'
        },
        {
            id: 6,
            section: 'Strumenti digitali',
            title: 'Intelligenza artificiale: funzionamento e verifica',
            subtitle: 'Comprendere che cosa produce un sistema generativo e come controllarne i risultati.',
            minutes: 30,
            chips: ['intelligenza artificiale', 'fonti', 'responsabilità'],
            intro: '<p>Un sistema di intelligenza artificiale generativa produce testi o immagini calcolando quali elementi sono probabili in base ai dati e al modello utilizzato. Un risultato può essere ben scritto e tuttavia contenere errori, omissioni o informazioni inventate.</p>',
            theory: [
                ['Dati e modello', '<p>Il sistema apprende regolarità da grandi quantità di dati e usa un modello per generare un risultato. Non possiede esperienza personale né comprende il mondo come una persona.</p>'],
                ['Errore plausibile e distorsione', '<p>Un’informazione inventata ma credibile viene spesso chiamata <strong>allucinazione</strong>. Un <strong>bias</strong> è una distorsione sistematica che può derivare dai dati o dalle scelte di progettazione.</p>'],
                ['Verificare una risposta', '<p>Ogni affermazione importante va confrontata con fonti esterne attendibili. Si controllano autore, data, documento originale e coerenza tra più fonti. Chiedere allo stesso sistema “sei sicuro?” non è una verifica indipendente.</p>'],
                ['Uso scolastico responsabile', '<p>L’intelligenza artificiale può aiutare a formulare esempi o revisionare un testo. Lo studente deve comprendere il contenuto, dichiarare l’uso quando richiesto, proteggere dati personali e rielaborare il risultato.</p>']
            ],
            questions: [
                { q: 'Perché un testo generato può sembrare autorevole ma contenere errori?', options: ['Produce sequenze probabili e non verifica automaticamente ogni affermazione', 'Usa sempre fonti vecchie', 'Non può produrre frasi complete', 'Gli errori compaiono solo nei testi lunghi'], answer: 0, why: 'La fluidità linguistica non garantisce che le informazioni corrispondano a fonti reali.' },
                { q: 'Quale controllo è indipendente dal sistema?', options: ['Chiedergli di confermare', 'Confrontare l’affermazione con un documento originale e una fonte attendibile', 'Rigenerare la risposta', 'Valutare lo stile'], answer: 1, why: 'La verifica deve utilizzare una fonte esterna e identificabile.' },
                { q: 'Che cosa indica il termine bias?', options: ['Un errore di battitura', 'Una distorsione sistematica collegata a dati o scelte del sistema', 'Una citazione corretta', 'La velocità di generazione'], answer: 1, why: 'Il bias può produrre risultati sbilanciati in modo ricorrente.' },
                { q: 'Quale informazione non dovrebbe essere inserita in un sistema pubblico?', options: ['Una definizione del manuale', 'Un caso con dati personali riconoscibili', 'Una domanda generale', 'Un testo inventato'], answer: 1, why: 'I dati personali o sensibili non vanno trasmessi senza protezione adeguata.' },
                { q: 'Quale uso mostra una reale rielaborazione?', options: ['Copiare il primo testo', 'Confrontarlo con fonti, correggerlo e motivare le modifiche', 'Cambiare alcune parole', 'Nascondere l’uso del sistema'], answer: 1, why: 'Rielaborare significa comprendere, verificare e assumersi la responsabilità del prodotto.' }
            ],
            openQuestions: ['Spiega la differenza tra una risposta plausibile e una risposta verificata.', 'Descrivi i passaggi con cui controlleresti un’affermazione prodotta dall’intelligenza artificiale.', 'L’affermazione “se il testo è scritto bene, l’informazione è affidabile” è scorretta: spiega perché e riscrivila.'],
            teacher: 'Chiedi di indicare fonti e modifiche effettuate, non dichiarazioni generiche sul corretto uso.'
        },
        {
            id: 7,
            section: 'Casi',
            title: 'Analisi di un caso',
            subtitle: 'Distinguere dati e ipotesi, individuare bisogni e risorse, formulare un progetto.',
            minutes: 35,
            chips: ['analisi', 'progettazione', 'motivazione delle scelte'],
            intro: '<p>Per analizzare un caso occorre distinguere i dati disponibili dalle ipotesi, riconoscere bisogni e risorse, indicare ciò che manca e motivare ogni proposta.</p>',
            theory: [
                ['Dati e ipotesi', '<p>I dati sono ciò che viene osservato o riferito nel caso. Le ipotesi sono spiegazioni possibili e devono essere presentate come tali. Una stessa informazione può sostenere più ipotesi.</p>'],
                ['Bisogni, risorse e informazioni mancanti', '<p>L’analisi considera le dimensioni bio-psico-sociali, ma cerca anche capacità, desideri e sostegni presenti. Prima di proporre un intervento si indicano i dati ancora da raccogliere.</p>'],
                ['Rete e progetto', '<p>Ogni risorsa proposta deve avere una funzione precisa. L’obiettivo descrive il cambiamento atteso; le azioni indicano chi fa che cosa; gli indicatori permettono di verificare il percorso.</p>']
            ],
            teacher: 'Confronta dati selezionati, ipotesi e informazioni mancanti prima di discutere gli interventi.'
        }
    ];

    const cases = [
        { tag: 'Seconda infanzia', title: 'La torre che non parte', text: 'In una sezione 3-6 anni, una bambina osserva gli altri costruire ma non tocca i materiali. Quando l’adulto le propone di iniziare insieme, dice “non sono capace”. La famiglia riferisce che a casa costruisce spesso con scatole e cuscini.' },
        { tag: 'SerD', title: 'Sono qui, ma non prometto niente', text: 'Una persona arriva al Servizio per le Dipendenze dopo pressioni familiari. Riconosce che l’uso ha creato problemi sul lavoro, ma dice di non voler essere etichettata. Accetta un primo colloquio purché nessuno decida al suo posto.' },
        { tag: 'Domiciliarità', title: 'Dopo la caduta', text: 'Una persona anziana è tornata a casa dopo una caduta. Cammina con prudenza, ha smesso di frequentare il circolo e il figlio passa solo nel fine settimana. Vuole restare nella propria abitazione e rifiuta l’idea di essere un peso.' },
        { tag: 'Peer tutoring', title: 'Il tutor troppo veloce', text: 'Durante un’attività con una classe più giovane, il tutor dà subito tutte le risposte. Il gruppo completa il compito in fretta, ma quando deve spiegare il procedimento non sa farlo.' }
    ];

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const route = missions.map(mission => mission.id);
    let state = loadState();
    let teacherMode = false;
    let teacherClass = '';
    let timerSeconds = 0;
    let timerHandle = null;
    let toastHandle = null;

    function defaultState() { return { current: 0, answers: {}, openAnswers: {}, completed: {}, caseIndex: 0, case: {} }; }
    function loadState() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            return stored && typeof stored === 'object' ? { ...defaultState(), ...stored } : defaultState();
        } catch { return defaultState(); }
    }
    function saveState({ remote = true } = {}) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        if (remote) document.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function openQuestionLabels() {
        const labels = {};
        missions.forEach(mission => { if (mission.openQuestions) labels[mission.id] = [...mission.openQuestions]; });
        return labels;
    }
    function buildProgressMeta(source = state) {
        const completed = route.filter(id => source.completed?.[id]).length;
        let answered = 0, correct = 0;
        Object.entries(source.answers || {}).forEach(([key, value]) => {
            const [missionId, questionIndex] = key.split('-').map(Number);
            const question = missions[missionId]?.questions?.[questionIndex];
            if (!question) return;
            answered += 1;
            if (Number(value) === question.answer) correct += 1;
        });
        return { campiCompilati: completed, totale: route.length, percentuale: Math.round(completed / route.length * 100), missioniComplete: completed, missioniTotali: route.length, risposte: answered, risposteCorrette: correct, accuratezza: answered ? Math.round(correct / answered * 100) : 0, percorso: 'Ripasso del terzo anno', missioneCorrente: Number(source.current) + 1 };
    }
    function snapshotProgress() {
        return { _activity: 'ripasso-terzo-anno', _version: 2, current: state.current, answers: { ...state.answers }, openAnswers: JSON.parse(JSON.stringify(state.openAnswers || {})), openQuestionLabels: openQuestionLabels(), completed: { ...state.completed }, caseIndex: state.caseIndex, case: { ...state.case }, _meta: buildProgressMeta(state) };
    }
    function restoreProgress(saved) {
        if (!saved || typeof saved !== 'object') return;
        if (saved._activity === 'ripasso-terzo-anno' && Number(saved._version) !== 2) {
            state = defaultState();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            renderMission();
            return;
        }
        state = { ...defaultState(), current: missions[Number(saved.current)] ? Number(saved.current) : 0, answers: saved.answers && typeof saved.answers === 'object' ? saved.answers : {}, openAnswers: saved.openAnswers && typeof saved.openAnswers === 'object' ? saved.openAnswers : {}, completed: saved.completed && typeof saved.completed === 'object' ? saved.completed : {}, caseIndex: Number.isInteger(Number(saved.caseIndex)) ? Number(saved.caseIndex) : 0, case: saved.case && typeof saved.case === 'object' ? saved.case : {} };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderMission();
    }
    window.MORipassoProgress = { snapshot: snapshotProgress, restore: restoreProgress };

    function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
    function showToast(message) {
        const toast = $('#toast');
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastHandle);
        toastHandle = setTimeout(() => toast.classList.remove('show'), 2200);
    }
    function renderNavigation() {
        let currentSection = '';
        $('#missionNav').innerHTML = missions.map(mission => {
            const section = mission.section !== currentSection ? `<div class="nav-section">${mission.section}</div>` : '';
            currentSection = mission.section;
            const done = Boolean(state.completed[mission.id]);
            return `${section}<button type="button" class="mission-link${mission.id === state.current ? ' active' : ''}${done ? ' done' : ''}" data-mission="${mission.id}"><span class="nav-number">${done ? '✓' : String(mission.id + 1).padStart(2, '0')}</span><span class="nav-title">${mission.title}</span></button>`;
        }).join('');
        $$('.mission-link').forEach(button => button.addEventListener('click', () => goToMission(Number(button.dataset.mission))));
        updateProgress();
    }
    function updateProgress() {
        const done = route.filter(id => state.completed[id]).length;
        const percentage = Math.round(done / route.length * 100);
        $('#progressPercent').textContent = `${percentage}%`;
        $('#progressLabel').textContent = `${done} di ${route.length} argomenti`;
        $('#progressBar').style.width = `${percentage}%`;
    }
    function missionHeader(mission) {
        return `<header class="mission-head"><div class="mission-index">${String(mission.id + 1).padStart(2, '0')}</div><div><p class="kicker">${mission.section}</p><h1>${mission.title}</h1><p>${mission.subtitle}</p><div class="mission-meta"><span class="meta-chip time">${mission.minutes} minuti</span>${mission.chips.map(chip => `<span class="meta-chip">${chip}</span>`).join('')}</div></div></header>`;
    }
    function renderContent(mission) {
        return `<section class="lesson-content"><div class="lesson-intro">${mission.intro}</div><div class="theory-cards">${mission.theory.map(item => `<article class="theory-card"><h2>${item[0]}</h2>${item[1]}</article>`).join('')}</div></section>`;
    }
    function renderQuestion(mission, question, index) {
        const key = `${mission.id}-${index}`;
        const selected = state.answers[key];
        const answered = selected !== undefined;
        const correct = selected === question.answer;
        const options = question.options.map((option, optionIndex) => {
            const classes = ['option-button'];
            if (selected === optionIndex) classes.push('selected');
            if (teacherMode && optionIndex === question.answer) classes.push('answer');
            return `<button type="button" class="${classes.join(' ')}" data-question="${index}" data-option="${optionIndex}"><span>${String.fromCharCode(65 + optionIndex)}</span>${option}</button>`;
        }).join('');
        const feedback = answered ? `<p class="feedback ${correct ? 'ok' : 'no'}"><strong>${correct ? 'Risposta corretta.' : 'Risposta da rivedere.'}</strong> ${question.why}</p>` : '';
        return `<article class="question-card${answered ? (correct ? ' correct' : ' incorrect') : ''}"><p class="question-text">${index + 1}. ${question.q}</p><div class="options">${options}</div>${feedback}</article>`;
    }
    function renderOpenQuestions(mission) {
        const saved = Array.isArray(state.openAnswers[mission.id]) ? state.openAnswers[mission.id] : [];
        return `<section class="open-questions"><div class="section-heading"><h2>Domande aperte</h2><p>Rispondi con definizioni complete, esempi pertinenti e motivazioni.</p></div><div class="open-question-list">${mission.openQuestions.map((question, index) => `<div class="open-question"><label for="open-${mission.id}-${index}"><strong>${index + 1}. ${question}</strong></label><textarea id="open-${mission.id}-${index}" class="open-answer" data-open-index="${index}" placeholder="Scrivi una risposta completa…">${escapeHtml(saved[index] || '')}</textarea></div>`).join('')}</div></section>`;
    }
    function renderStandardMission(mission) {
        const answerCount = mission.questions.filter((_, index) => state.answers[`${mission.id}-${index}`] !== undefined).length;
        return `<article class="mission" data-mission-id="${mission.id}">${missionHeader(mission)}${renderContent(mission)}<section class="quiz-section"><div class="section-heading"><div><h2>Domande a scelta multipla</h2><p>Leggi tutte le alternative prima di rispondere.</p></div><span class="activity-score">${answerCount}/${mission.questions.length}</span></div><div class="question-list">${mission.questions.map((question, index) => renderQuestion(mission, question, index)).join('')}</div></section>${renderOpenQuestions(mission)}<div class="teacher-note"><strong>Indicazione per il docente</strong><br>${mission.teacher}</div></article>`;
    }
    function renderMission() {
        const mission = missions[state.current] || missions[0];
        state.current = mission.id;
        resetTimer(mission.minutes);
        $('#missionMount').innerHTML = mission.id === missions.length - 1 ? renderCaseMission(mission) : renderStandardMission(mission);
        bindMissionEvents(mission);
        updateFooterButtons();
        renderNavigation();
    }
    function bindMissionEvents(mission) {
        $$('.option-button').forEach(button => button.addEventListener('click', () => {
            state.answers[`${mission.id}-${button.dataset.question}`] = Number(button.dataset.option);
            updateMissionCompletion(mission);
            saveState();
            renderMission();
        }));
        $$('.open-answer').forEach(textarea => textarea.addEventListener('input', () => {
            if (!Array.isArray(state.openAnswers[mission.id])) state.openAnswers[mission.id] = [];
            state.openAnswers[mission.id][Number(textarea.dataset.openIndex)] = textarea.value;
            updateMissionCompletion(mission);
            saveState();
            updateProgress();
        }));
        $('#newCaseButton')?.addEventListener('click', generateNewCase);
        $('#checkCaseButton')?.addEventListener('click', checkCaseWork);
        $$('.case-input').forEach(input => input.addEventListener('input', saveCaseForm));
    }
    function updateMissionCompletion(mission) {
        if (!mission.questions) return;
        const quizComplete = mission.questions.every((_, index) => state.answers[`${mission.id}-${index}`] !== undefined);
        const open = Array.isArray(state.openAnswers[mission.id]) ? state.openAnswers[mission.id] : [];
        const openComplete = mission.openQuestions.every((_, index) => String(open[index] || '').trim().length >= 20);
        const complete = quizComplete && openComplete;
        if (complete && !state.completed[mission.id]) showToast('Argomento completato. Le risposte sono state salvate.');
        state.completed[mission.id] = complete;
    }

    function renderCaseMission(mission) {
        const currentCase = cases[state.caseIndex % cases.length];
        const c = state.case || {};
        const needs = ['biologico', 'psicologico', 'sociale', 'informazioni mancanti'];
        const roles = ['area sanitaria', 'area psicologica', 'area sociale', 'area educativa/assistenziale', 'rete informale'];
        return `<article class="mission" data-mission-id="${mission.id}">${missionHeader(mission)}${renderContent(mission)}<section class="case-work"><article class="case-card"><span class="case-tag">${currentCase.tag}</span><h2>${currentCase.title}</h2><p>${currentCase.text}</p><button class="primary-button" id="newCaseButton" type="button">Cambia caso ↻</button></article><div class="case-form">
            <div class="case-field"><label for="caseFacts"><strong>1. Quali sono i dati presenti nel testo?</strong></label><textarea class="case-input" id="caseFacts" placeholder="Riporta fatti e parole del caso, senza interpretazioni.">${escapeHtml(c.facts || '')}</textarea></div>
            <div class="case-field"><strong>2. Quali dimensioni devono essere considerate?</strong><div class="check-grid">${needs.map(option => `<label><input class="case-input" type="checkbox" name="needs" value="${option}" ${(c.needs || []).includes(option) ? 'checked' : ''}> ${option}</label>`).join('')}</div></div>
            <div class="case-field"><label for="caseNeeds"><strong>3. Indica bisogni, risorse e almeno un’ipotesi.</strong></label><textarea class="case-input" id="caseNeeds" placeholder="Distingui ciò che sai da ciò che stai ipotizzando.">${escapeHtml(c.needsResources || '')}</textarea></div>
            <div class="case-field"><label for="caseMissing"><strong>4. Quali informazioni mancano prima di decidere?</strong></label><textarea class="case-input" id="caseMissing" placeholder="Scrivi domande precise da rivolgere alla persona o alla rete.">${escapeHtml(c.missing || '')}</textarea></div>
            <div class="case-field"><strong>5. Quali componenti della rete potrebbero essere coinvolte?</strong><div class="check-grid">${roles.map(option => `<label><input class="case-input" type="checkbox" name="roles" value="${option}" ${(c.roles || []).includes(option) ? 'checked' : ''}> ${option}</label>`).join('')}</div></div>
            <div class="case-field"><label for="caseNetwork"><strong>6. Motiva la funzione delle risorse scelte.</strong></label><textarea class="case-input" id="caseNetwork" placeholder="Per ogni risorsa indica il contributo possibile e i limiti.">${escapeHtml(c.network || '')}</textarea></div>
            <div class="case-field"><label for="caseObjective"><strong>7. Formula un obiettivo verificabile e il primo intervento.</strong></label><textarea class="case-input" id="caseObjective" placeholder="Cambiamento atteso, indicatore, tempo, azione e responsabilità.">${escapeHtml(c.objective || '')}</textarea></div>
            <div class="case-field"><label for="caseEvaluation"><strong>8. Come verificheresti il percorso?</strong></label><textarea class="case-input" id="caseEvaluation" placeholder="Indica che cosa osservare, quando e con chi.">${escapeHtml(c.evaluation || '')}</textarea></div>
            <button class="primary-button" id="checkCaseButton" type="button">Controlla se l’analisi è completa</button>${c.result ? `<div class="case-result">${c.result}</div>` : ''}</div></section><div class="teacher-note"><strong>Indicazione per il docente</strong><br>${mission.teacher}</div></article>`;
    }
    function saveCaseForm() {
        state.case = { ...state.case, needs: $$('input[name="needs"]:checked').map(input => input.value), roles: $$('input[name="roles"]:checked').map(input => input.value), facts: $('#caseFacts')?.value || '', needsResources: $('#caseNeeds')?.value || '', missing: $('#caseMissing')?.value || '', network: $('#caseNetwork')?.value || '', objective: $('#caseObjective')?.value || '', evaluation: $('#caseEvaluation')?.value || '', result: '' };
        saveState();
    }
    function checkCaseWork() {
        saveCaseForm();
        const checks = [[state.case.facts.trim().length >= 35, 'dati del caso'], [state.case.needs.length >= 2, 'almeno due dimensioni'], [state.case.needsResources.trim().length >= 45, 'bisogni, risorse e ipotesi'], [state.case.missing.trim().length >= 30, 'informazioni mancanti'], [state.case.roles.length >= 2, 'almeno due componenti della rete'], [state.case.network.trim().length >= 35, 'motivazione della rete'], [state.case.objective.trim().length >= 50, 'obiettivo e primo intervento'], [state.case.evaluation.trim().length >= 30, 'modalità di verifica']];
        const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
        state.case.result = missing.length ? `Completa ancora: ${missing.join('; ')}.` : 'L’analisi contiene dati, ipotesi, informazioni mancanti, rete, obiettivo e verifica. Controlla che ogni proposta sia motivata.';
        state.completed[missions.length - 1] = missing.length === 0;
        saveState();
        renderMission();
    }
    function generateNewCase() { state.caseIndex = (state.caseIndex + 1) % cases.length; state.case = {}; state.completed[missions.length - 1] = false; saveState(); renderMission(); }
    function goToMission(id) { if (!missions[id]) return; state.current = id; saveState(); $('#classResultsPanel').hidden = true; renderMission(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    function updateFooterButtons() {
        const position = route.indexOf(state.current);
        $('#prevMission').disabled = position <= 0;
        $('#nextMission').disabled = position >= route.length - 1;
        $('#nextMission').textContent = position === route.length - 1 ? 'Fine del ripasso' : (position === route.length - 2 ? 'Vai al caso →' : 'Argomento successivo →');
        $('#prevMission').onclick = () => position > 0 && goToMission(route[position - 1]);
        $('#nextMission').onclick = () => position < route.length - 1 && goToMission(route[position + 1]);
    }
    function resetTimer(minutes) { clearInterval(timerHandle); timerHandle = null; timerSeconds = minutes * 60; drawTimer(); $('#timerToggle').textContent = 'Avvia'; }
    function drawTimer() { const minutes = Math.floor(Math.max(0, timerSeconds) / 60); const seconds = Math.max(0, timerSeconds) % 60; $('#timerDisplay').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }
    function toggleTimer() {
        if (timerHandle) { clearInterval(timerHandle); timerHandle = null; $('#timerToggle').textContent = 'Riprendi'; return; }
        $('#timerToggle').textContent = 'Pausa';
        timerHandle = setInterval(() => { timerSeconds -= 1; drawTimer(); if (timerSeconds <= 0) { clearInterval(timerHandle); timerHandle = null; $('#timerToggle').textContent = 'Finito'; showToast('Tempo concluso. Completa la risposta in corso.'); } }, 1000);
    }

    function docenteSessionValid() { try { const data = JSON.parse(localStorage.getItem(DOCENTE_SESSION_KEY) || 'null'); return Boolean(data?.expiresAt && Date.now() < data.expiresAt); } catch { return false; } }
    async function sha256(text) { const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join(''); }
    async function verificaDocente() {
        if (docenteSessionValid()) return true;
        const password = prompt('Modalità docente / LIM.\n\nInserisci la password dell\'Area Docente:');
        if (password === null || !window.crypto?.subtle) return false;
        if ((await sha256(password.trim().toLowerCase())) !== DOCENTE_HASH) { alert('Password non corretta'); return false; }
        localStorage.setItem(DOCENTE_SESSION_KEY, JSON.stringify({ issuedAt: Date.now(), expiresAt: Date.now() + DOCENTE_SESSION_DURATION }));
        return true;
    }
    function pagePathNormalized() { let path = location.pathname.split('?')[0].split('#')[0]; if (path.startsWith('/metodologieoperative/')) path = path.slice('/metodologieoperative'.length); return path; }
    async function fetchClassRows(classCode) {
        const query = new URLSearchParams({ select: 'student_code,data,updated_at', class_code: `eq.${classCode}`, page_path: `eq.${pagePathNormalized()}`, order: 'updated_at.desc', limit: '200' });
        const response = await fetch(`${SUPABASE_URL}/rest/v1/progress?${query}`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const records = await response.json();
        return records.map(record => { let data = record.data; if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = {}; } } return { ...record, data: data && typeof data === 'object' ? data : {} }; });
    }
    function classOverview(rows) {
        let completed = 0, total = 0, answered = 0, correct = 0;
        rows.forEach(({ data }) => { const meta = data._meta || {}; completed += Number(meta.missioniComplete || 0); total += Number(meta.missioniTotali || 0); Object.entries(data.answers || {}).forEach(([key, value]) => { const [missionId, questionIndex] = key.split('-').map(Number); const question = missions[missionId]?.questions?.[questionIndex]; if (!question) return; answered += 1; if (Number(value) === question.answer) correct += 1; }); });
        return { progress: total ? Math.round(completed / total * 100) : 0, accuracy: answered ? Math.round(correct / answered * 100) : 0 };
    }
    function renderTextResponses(title, values) { if (!values.length) return `<h3>${escapeHtml(title)}</h3><p class="class-results-meta">Nessuna risposta salvata.</p>`; return `<h3>${escapeHtml(title)} <span class="class-results-meta">${values.length} risposte</span></h3><ul class="class-note-list">${values.slice(0, 16).map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`; }
    function renderClassQuestions(rows, mission) {
        if (!mission.questions) return '';
        return mission.questions.map((question, index) => { let answered = 0, correct = 0; rows.forEach(({ data }) => { const value = data.answers?.[`${mission.id}-${index}`]; if (value === undefined) return; answered += 1; if (Number(value) === question.answer) correct += 1; }); const percentage = answered ? Math.round(correct / answered * 100) : 0; return `<article class="class-question-result"><p><strong>${index + 1}. ${escapeHtml(question.q)}</strong><br><span class="class-results-meta">${answered}/${rows.length} risposte · ${percentage}% corrette</span></p><div class="class-result-bar"><span style="width:${percentage}%"></span></div></article>`; }).join('');
    }
    function renderClassOpenAnswers(rows, mission) {
        if (mission.id === missions.length - 1) {
            return [['Dati individuati', 'facts'], ['Bisogni, risorse e ipotesi', 'needsResources'], ['Informazioni mancanti', 'missing'], ['Motivazione della rete', 'network'], ['Obiettivo e intervento', 'objective'], ['Verifica', 'evaluation']].map(([label, key]) => renderTextResponses(label, rows.map(({ data }) => String(data.case?.[key] || '').trim()).filter(Boolean))).join('');
        }
        return mission.openQuestions.map((question, index) => renderTextResponses(question, rows.map(({ data }) => String(data.openAnswers?.[mission.id]?.[index] || '').trim()).filter(Boolean))).join('');
    }
    async function showClassResults() {
        if (!(await verificaDocente())) return;
        const input = prompt('Quale classe vuoi riepilogare? (es. 4sb)', teacherClass || localStorage.getItem('mo:lim-class') || '4sb'); if (input === null) return; teacherClass = input.trim().toLowerCase(); if (!teacherClass) return; localStorage.setItem('mo:lim-class', teacherClass);
        const panel = $('#classResultsPanel'); panel.hidden = false; panel.innerHTML = '<p>Caricamento dei risultati…</p>';
        try {
            const rows = await fetchClassRows(teacherClass); const mission = missions[state.current]; const overview = classOverview(rows);
            panel.innerHTML = `<div class="class-results-head"><div><p class="kicker">${escapeHtml(teacherClass.toUpperCase())}</p><h2>${escapeHtml(mission.title)}</h2></div><button class="class-results-close" type="button" data-close-class-results>Chiudi</button></div><div class="class-summary-grid"><div class="class-summary-card"><strong>${rows.length}</strong><span>studenti</span></div><div class="class-summary-card"><strong>${overview.progress}%</strong><span>avanzamento</span></div><div class="class-summary-card"><strong>${overview.accuracy}%</strong><span>risposte corrette</span></div></div>${rows.length ? renderClassQuestions(rows, mission) + renderClassOpenAnswers(rows, mission) : '<p>Nessun dato salvato per questa classe.</p>'}`;
            panel.querySelector('[data-close-class-results]')?.addEventListener('click', () => panel.hidden = true);
        } catch (error) { panel.innerHTML = `<p>Non è stato possibile leggere i dati: ${escapeHtml(error.message)}.</p>`; }
    }
    async function toggleTeacherMode() {
        const next = !teacherMode;
        if (next && !(await verificaDocente())) return;
        teacherMode = next; document.body.classList.toggle('teacher-mode', teacherMode); $('#teacherToggle').setAttribute('aria-pressed', String(teacherMode)); $('#classResultsButton').hidden = !teacherMode;
        if (teacherMode) { localStorage.setItem('mo:ripasso-teacher', '1'); teacherClass = (localStorage.getItem('mo:lim-class') || '').trim().toLowerCase(); } else { localStorage.removeItem('mo:ripasso-teacher'); $('#classResultsPanel').hidden = true; }
        renderMission();
    }

    $('#teacherToggle').addEventListener('click', toggleTeacherMode);
    $('#classResultsButton').addEventListener('click', showClassResults);
    $('#contrastToggle').addEventListener('click', () => { const active = document.body.classList.toggle('high-contrast'); $('#contrastToggle').setAttribute('aria-pressed', String(active)); });
    $('#printButton').addEventListener('click', () => window.print());
    $('#timerToggle').addEventListener('click', toggleTimer);
    $('#timerReset').addEventListener('click', () => resetTimer(missions[state.current].minutes));
    $('#resetButton').addEventListener('click', () => { if (!confirm('Vuoi cancellare tutte le risposte di questo ripasso?')) return; localStorage.removeItem(STORAGE_KEY); state = defaultState(); saveState(); renderMission(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    if (localStorage.getItem('mo:ripasso-teacher') === '1' && docenteSessionValid()) { teacherMode = true; teacherClass = (localStorage.getItem('mo:lim-class') || '').trim().toLowerCase(); document.body.classList.add('teacher-mode'); $('#teacherToggle').setAttribute('aria-pressed', 'true'); $('#classResultsButton').hidden = false; }
    renderNavigation();
    renderMission();
})();
