(function(root){
  'use strict';
  const levels=['Da sviluppare','Parziale','Adeguato','Buono','Efficace'];
  const years={
    '1':{label:'Primo anno',period:'Biennio',expectation:'Compito semplice, traccia e strumenti forniti, supervisione prevista. Osserva correttezza, cura e partecipazione.'},
    '2':{label:'Secondo anno',period:'Biennio',expectation:'Traccia e supervisione previste; il prodotto comprende più parti. Osserva completezza, coerenza e partecipazione.'},
    '3':{label:'Terzo anno',period:'Terzo Anno',expectation:'Obiettivo dichiarato, scelta del metodo e ruolo assegnato. Osserva la coerenza del risultato e gli adattamenti richiesti dalla consegna.'},
    '4':{label:'Quarto anno',period:'Quarto Anno',expectation:'Vincoli e destinatari dichiarati. Osserva le scelte motivate, l’adattamento al contesto e il controllo del proprio lavoro.'},
    '5':{label:'Quinto anno',period:'Quinto Anno',expectation:'Compito con vincoli di tempo e risorse. Osserva decisioni motivate, verifica del risultato e integrazione dei contributi, quando prevista.'}
  };
  function criterion(title,description,steps){return {title,description,levels:steps};}
  const rubrics={
    digitale:{title:'Artefatti digitali',examples:'Infografiche, presentazioni, video, podcast e mappe.',competencies:['C3','C10'],criteria:[
      criterion('Correttezza dei contenuti','Le informazioni sono corrette e pertinenti alla consegna.',[
        'Errori rilevanti impediscono di comprendere il contenuto.','Le informazioni sono pertinenti solo in parte o presentano più inesattezze.','I concetti principali sono corretti e pertinenti.','I contenuti sono corretti, pertinenti e rielaborati.','I contenuti sono precisi e ben collegati; le fonti richieste sono riconoscibili.']),
      criterion('Completezza e sintesi','Sono presenti i concetti essenziali, senza dettagli superflui.',[
        'Mancano molti contenuti essenziali.','Sono presenti solo alcuni contenuti essenziali o molte ripetizioni.','I contenuti principali sono presenti, con qualche omissione o ripetizione.','I contenuti essenziali sono completi e sintetici.','La selezione restituisce tutti i concetti fondamentali con sintesi ed equilibrio.']),
      criterion('Chiarezza del messaggio','Il messaggio principale si comprende facilmente.',[
        'Il messaggio principale non si distingue.','Il messaggio si comprende solo con molte spiegazioni aggiuntive.','Il messaggio si comprende con una normale lettura o fruizione.','Il messaggio emerge rapidamente ed è chiaro.','Il messaggio è immediato e adeguato ai destinatari indicati.']),
      criterion('Organizzazione e leggibilità','Ordine, testi e sequenze rendono il prodotto facile da seguire.',[
        'L’ordine e la leggibilità ostacolano la comprensione.','Alcune parti sono difficili da leggere, ascoltare o seguire.','L’ordine è comprensibile e il prodotto è generalmente fruibile.','La gerarchia e le sequenze guidano bene la fruizione.','Tutte le parti sono facili da seguire e trovare, secondo il formato scelto.']),
      criterion('Uso degli elementi espressivi','Immagini, colori o suoni, quando previsti, sostengono i contenuti.',[
        'Gli elementi espressivi confondono il contenuto o mancano quelli richiesti.','Gli elementi espressivi sono solo in parte pertinenti.','Gli elementi scelti sono generalmente pertinenti.','Gli elementi espressivi sono coerenti e facilitano la comprensione.','Gli elementi espressivi chiariscono i concetti e valorizzano il messaggio senza sovraccaricarlo.'])
    ]},
    manuale:{title:'Artefatti manuali',examples:'Collage, cartelloni, modelli e materiali per l’animazione.',competencies:['C8'],criteria:[
      criterion('Coerenza con la consegna','Il prodotto risponde allo scopo e ai destinatari indicati.',[
        'Il prodotto non risponde allo scopo indicato.','Il prodotto risponde solo a una parte della consegna.','Il prodotto risponde agli elementi essenziali della consegna.','Il prodotto è coerente con scopo e destinatari.','Ogni scelta del prodotto è funzionale allo scopo e ai destinatari.']),
      criterion('Uso di materiali e strumenti','Materiali e strumenti sono usati in modo appropriato e sicuro.',[
        'L’uso osservato richiede interventi frequenti per rispettare le indicazioni.','L’uso è parzialmente appropriato e richiede richiami alle procedure.','L’uso rispetta le indicazioni essenziali e le procedure di sicurezza.','Materiali e strumenti sono scelti e usati con cura, secondo la consegna.','L’uso è accurato, funzionale e attento anche a sprechi e riordino.']),
      criterion('Cura e funzionalità','Le parti richieste sono complete e il prodotto può essere utilizzato.',[
        'Il prodotto è molto incompleto o non utilizzabile.','Il prodotto è incompleto o presenta problemi che ne limitano l’uso.','Il prodotto è utilizzabile e le parti principali sono complete.','Il prodotto è completo, curato e funzionale.','La cura dei dettagli migliora concretamente l’uso del prodotto.']),
      criterion('Organizzazione del lavoro','Le fasi, i tempi e gli accordi della consegna sono rispettati.',[
        'Le fasi essenziali restano da svolgere nonostante i supporti previsti.','Le fasi procedono in modo discontinuo e alcuni accordi non sono rispettati.','Le fasi principali e gli accordi essenziali sono rispettati.','Fasi e tempi sono gestiti in modo ordinato con i supporti previsti.','Il lavoro è organizzato e controllato, adattando le fasi quando la consegna lo richiede.']),
      criterion('Spiegazione e revisione','Si spiegano le scelte e si individua un possibile miglioramento.',[
        'Le scelte non sono ancora spiegate e manca la revisione.','Le scelte sono descritte in parte; il miglioramento resta generico.','Le scelte principali sono spiegate e viene indicato un miglioramento.','Le scelte sono motivate e il miglioramento è concreto e pertinente.','La revisione verifica il prodotto e propone o realizza un miglioramento motivato.'])
    ]},
    ruolo:{title:'Giochi di ruolo',examples:'Simulazioni, colloqui e situazioni della relazione d’aiuto.',competencies:['C2','C3'],criteria:[
      criterion('Comprensione della situazione e del ruolo','Azioni e interventi rispettano la situazione e il ruolo assegnato.',[
        'Gli interventi non sono collegati alla situazione o al ruolo.','Il ruolo è seguito solo in alcuni passaggi.','Le azioni principali sono coerenti con situazione e ruolo.','Il ruolo è mantenuto con interventi pertinenti alla situazione.','Il ruolo è mantenuto con coerenza, collegando gli interventi ai bisogni emersi.']),
      criterion('Ascolto e risposta','Si ascolta l’interlocutore e si risponde a ciò che comunica.',[
        'Le risposte non tengono conto di quanto detto dall’interlocutore.','L’ascolto è discontinuo e alcune risposte non sono pertinenti.','Le risposte riprendono gli elementi principali del messaggio.','Le risposte sono pertinenti e chiedono chiarimenti quando necessario.','Ascolto, domande e risposte fanno progredire lo scambio senza sovrapporsi.']),
      criterion('Comunicazione adeguata','Parole, tono e modi sono chiari e rispettosi del contesto.',[
        'La comunicazione ostacola lo scambio o richiede frequenti richiami.','La comunicazione è solo in parte chiara o adeguata alla situazione.','La comunicazione è comprensibile e rispettosa.','Parole, tono e modi sono adeguati alla situazione e all’interlocutore.','La comunicazione chiarisce i passaggi difficili e facilita la relazione.']),
      criterion('Collaborazione nella simulazione','Si rispettano turni e accordi, contribuendo alla scena.',[
        'Turni e accordi non sono ancora rispettati.','Il contributo è discontinuo o richiede richiami agli accordi.','Turni e accordi principali sono rispettati e il contributo è pertinente.','Il contributo si collega a quello degli altri e sostiene la simulazione.','I contributi vengono integrati e lo scambio prosegue anche nei passaggi difficili previsti.']),
      criterion('Riflessione sull’esperienza','Si riconosce che cosa ha funzionato e che cosa si può migliorare.',[
        'Manca un riscontro su ciò che è accaduto.','La riflessione descrive l’esperienza senza individuare elementi precisi.','Vengono riconosciuti un punto di forza e un aspetto da migliorare.','La riflessione usa esempi della scena e propone una risposta alternativa.','La riflessione collega azioni ed effetti e motiva una risposta più adeguata.'])
    ]},
    gruppo:{title:'Giochi di gruppo',examples:'Giochi cooperativi, attività ludiche e compiti condivisi.',competencies:['C2','C8'],criteria:[
      criterion('Comprensione di obiettivo e regole','Le azioni rispettano lo scopo e le regole condivise.',[
        'Le azioni non seguono ancora obiettivo e regole.','Obiettivo e regole sono seguiti solo in parte.','Le regole essenziali e lo scopo sono rispettati.','Le azioni sono coerenti con obiettivo e regole durante l’attività.','Le regole vengono applicate con coerenza anche nei passaggi meno immediati.']),
      criterion('Contributo all’attività','Si svolge la propria parte e si contribuisce al compito comune.',[
        'La parte concordata non è ancora svolta, anche con i supporti previsti.','La parte concordata è svolta solo in alcuni passaggi.','La parte essenziale del compito concordato è svolta.','Il contributo è continuativo e utile al compito comune.','Il contributo sostiene il compito comune ed è adattato alle necessità emerse.']),
      criterion('Ascolto e cooperazione','Le proposte sono ascoltate e le decisioni vengono condivise.',[
        'Le azioni non tengono conto delle proposte degli altri.','Il confronto è discontinuo e alcune decisioni restano separate.','Le proposte principali sono ascoltate e gli accordi rispettati.','Il confronto collega le proposte e favorisce decisioni condivise.','Le differenze vengono affrontate con proposte concrete che aiutano il gruppo a proseguire.']),
      criterion('Rispetto e partecipazione di tutti','Si rispettano turni e persone, lasciando spazio ai contributi.',[
        'I comportamenti osservati richiedono interventi per garantire rispetto e turni.','I turni sono rispettati in parte e lo spazio per gli altri è discontinuo.','Persone e turni sono rispettati e ciascuno ha spazio per intervenire.','I comportamenti favoriscono la partecipazione degli altri.','Si riconoscono ostacoli alla partecipazione e si propongono adattamenti alle regole concordate.']),
      criterion('Riflessione sul lavoro comune','Si riconoscono risultati, difficoltà e un miglioramento possibile.',[
        'Manca un riscontro sull’attività svolta.','Il riscontro è generico e si limita a dire se il gioco è piaciuto.','Sono riconosciuti un risultato e una difficoltà del lavoro comune.','La riflessione collega risultati e comportamenti e propone un miglioramento.','Il miglioramento è motivato con esempi e traducibile in un accordo per la prossima attività.'])
    ]}
  };
  const api={levels,years,rubrics};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.MORubrics=api;
})(typeof globalThis!=='undefined'?globalThis:this);
