#!/usr/bin/env python3
"""Genera guida, regia e mazzo 3SA dalla stessa storia e dalle regole comuni."""
import argparse
import html
import json
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'materiali/giochi/cluedo-servizi'
e = html.escape

def ul(items): return '<ul>'+''.join('<li>'+e(x)+'</li>' for x in items)+'</ul>'
def ordered(items): return '<ol class="checklist">'+''.join('<li>'+e(x)+'</li>' for x in items)+'</ol>'
def details(title, body): return '<details><summary>'+e(title)+'</summary>'+body+'</details>'
def active_story(): return json.loads((BASE/'storia-attiva.json').read_text())['storia']
def load(story):
    rules = json.loads((BASE/'regole.json').read_text())
    data = json.loads(story.read_text())
    validate(rules,data)
    return rules,data

def validate(r,s):
    assert s['protagonista'].strip()
    assert len(s['personaggi'])==3 and len(s['alterazioni'])==3
    assert len(s['indizi'])==4 and len(s['rete'])==8 and len(s['frammenti'])==4
    assert len(s['depistaggi'])==3 and len(s['tracce'])==2
    for key in ['personaggi','alterazioni','indizi','frammenti','rete','tracce','consegne']:
        assert len({x['id'] for x in s[key]})==len(s[key]), f'ID duplicati: {key}'
    assert {x['id'] for x in s['alterazioni']}=={x['id'] for x in s['soluzione']['correzioni']}=={x['id'] for x in s['consegne']}
    segni=[set(p['segni']) for p in s['personaggi']]
    assert all(len(x)==2 for x in segni) and len(set.union(*segni))==3
    for pair in segni:
        assert sum(pair<=other for other in segni)==1
        assert all(sum(sign in other for other in segni)==2 for sign in pair)
    known={x['id'] for key in ['indizi','frammenti','rete'] for x in s[key]}
    assert all(set(c['prove'])<=known for c in s['soluzione']['correzioni'])
    for index,total in enumerate([60,120]):
        assert sum(p['minuti'][index] for p in r['fasi'])==total
        for rounds in [3,4]: assert sum(r['tempiGiro'][f'{total}-{rounds}'])*rounds<=r['fasi'][1]['minuti'][index]

def shell(title, body, r, teacher=False):
    config=json.dumps({'fasi':r['fasi'],'tempiGiro':r['tempiGiro']},ensure_ascii=False).replace('<','\\u003c')
    return f'''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#096b69"><title>{e(title)} · Servizi in giallo</title><meta name="description" content="Gioco investigativo 3SA: regole semplici, due squadre, un impostore e carte per 60 o 120 minuti."><link rel="stylesheet" href="gioco.css?v=2"><link rel="icon" href="../../../icons/icon-192x192.png"></head><body><a class="skip" href="#contenuto">Vai al contenuto</a><header><nav><a href="../../../laboratorio.html#giochi">← Giochi in laboratorio</a><span>3SA · 60 / 120 minuti</span></nav><p class="kicker">{'Preparazione docente · contiene la soluzione' if teacher else 'Guida del conduttore · da mostrare alla classe'}</p><h1>{e(title)}</h1></header><main id="contenuto">{body}</main><footer>Metodologie Operative · Personaggi inventati · Edizione 2, settembre 2026</footer><script id="game-config" type="application/json">{config}</script><script src="gioco.js?v=2" defer></script></body></html>'''

def console():
    return '''<section class="panel live" aria-labelledby="phase-title"><div class="settings"><label>Presenti<input id="presenti" type="number" min="2" max="24" value="12"></label><label>Durata<select id="durata"><option value="60">60 minuti</option><option value="120">120 minuti</option></select></label></div><p id="assetto" class="small" aria-live="polite"></p><div class="live-head"><div><p id="phase-number" class="kicker">Fase 1 di 4</p><h2 id="phase-title">Ascoltate la storia e prendete i ruoli</h2></div><output id="timer" class="clock" aria-label="Tempo residuo">10:00</output></div><p id="phase-copy"></p><div id="round-plan" hidden><ol id="rounds" class="phase-list"></ol><p id="round-note" class="small"></p></div><div class="actions"><button id="timer-toggle">Avvia</button><button id="reset" class="secondary">Ricomincia fase</button></div><p id="timer-status" role="status" class="small"></p><div class="actions phase-nav"><button id="prev" class="secondary" disabled>← Precedente</button><button id="next" class="secondary">Successiva →</button></div><noscript><p>Il timer richiede JavaScript. Puoi seguire le quattro fasi e i tempi del promemoria stampato.</p></noscript></section>'''

def make_web(r,s):
    rules='<ol class="rules">'+''.join('<li><strong>'+e(x['titolo'])+'</strong><p>'+e(x['testo'])+'</p></li>' for x in r['regole'])+'</ol>'
    tasks='<p>In squadra distribuite a sorte i compiti e scambiateli dopo ogni giro. Se siete più di quattro condividete i compiti; tutti fanno comunque domande.</p>'+''.join('<p><strong>'+e(t['nome'])+'.</strong> '+e(t['testo'])+'</p>' for t in r['compiti'])
    opening='<section class="panel"><h2>La vostra missione</h2><p class="lead">Scoprite chi ha alterato il fascicolo, dimostratelo con due tracce e correggete le tre informazioni sbagliate.</p>'+details('Copione da leggere alla classe', '<blockquote>'+e(r['copione'])+'</blockquote><h3>La storia</h3><p class="story">'+e(s['storia'])+'</p>')+'</section>'
    flow='<ol class="phase-list">'+''.join(f'<li><strong>{e(p["titolo"])}</strong> · {p["minuti"][0]} / {p["minuti"][1]} min<p>{e(p["consegna"])}</p></li>' for p in r['fasi'])+'</ol>'
    criteria=ul([x['id']+' · '+x['testo'] for x in s['consegne']])
    student=opening+console()+details('Come si vince e che cosa consegnare', '<p>'+e(r['vittoria'])+'</p>'+criteria)+details('Le sei regole',rules)+details('Ruoli e assenze',tasks+'<p>'+e(r['presenze'])+'</p>')+details('Materiali: chi riceve che cosa',ul(r['materiali'])+'<p>Il docente prepara e distribuisce le carte. Gli investigatori consultano solo i materiali della propria squadra e le due tracce condivise.</p>')+details('Le quattro fasi, anche senza timer',flow+'<p>'+e(r['istruzioniTempi'])+'</p>')
    (BASE/'guida-studente-3sa.html').write_text(shell(s['titolo'],student,r),encoding='utf-8')
    prep='<p class="note warning">Questa pagina e il mazzo completo contengono le risposte. Per la classe apri la guida del conduttore.</p><div class="actions"><a class="button" href="guida-studente-3sa.html">Apri la partita per la classe</a><a class="button secondary" href="../../../output/pdf/cluedo-servizi-3sa.pdf" target="_blank" rel="noopener">Stampa il mazzo completo</a></div><section class="panel" style="margin-top:1rem"><h2>Prepara i materiali</h2>'+ordered(r['preparazione'])+'</section>'
    trace_options='<option value="">Seleziona dopo l’estrazione</option>'+''.join(f'<option value="{e(p["id"])}">{e(p["nome"])}</option>' for p in s['personaggi'])
    traces='<label>Chi ha pescato l’impostore?<select id="tracce-personaggio">'+trace_options+'</select></label>'
    for p in s['personaggi']:
        traces+=f'<div data-tracce="{e(p["id"])}" hidden><p>Scegli dal foglio stampato la coppia <strong>{e(" + ".join(p["segni"]))}</strong>. Mostra soltanto i riquadri ritagliati, senza la dicitura della coppia.</p>'
        for t,sign in zip(s['tracce'],p['segni']):traces+='<div class="trace"><strong>'+e(t['id']+' · '+t['titolo'])+'</strong><p>'+e(t['testo'].replace('{segno}',sign))+'</p></div>'
        traces+='</div>'
    solutions='<p>'+e(s['soluzione']['identita'])+'</p>'
    for c in s['soluzione']['correzioni']:solutions+='<h3>'+e(c['id'])+'</h3><p>'+e(c['criterio'])+'</p><p class="small">Riscontri: '+e(', '.join(c['prove']))+'</p><blockquote>'+e(c['esempio'])+'</blockquote>'
    solutions+='<p>'+e(s['soluzione']['pistaIrrilevante'])+'</p><h3>Verifica finale</h3><p>'+e(r['vittoria'])+'</p>'+ul(s['soluzione']['domandeFinali'])
    source='<p>Contenuti ripresi dai programmi svolti del biennio e dai laboratori verificati nell’ecosistema. Le fonti seguenti sostengono i riferimenti disciplinari; il fascicolo è una simulazione.</p>'+ul(s['contenuti'])+ul(s['laboratori'])+'<p>'+ ' · '.join('<a href="'+e(f['url'],quote=True)+'" target="_blank" rel="noopener">'+e(f['titolo'])+'</a>' for f in s['fonti'])+'</p>'
    teacher=prep+details('Materiali e distribuzione',ul(r['materiali']))+details('Tracce da scegliere in segreto',traces)+details('Soluzione e condizioni di vittoria',solutions)+details('Contenuti, laboratori e fonti',source)+details('Aggiungere un’altra storia','<p>Le regole e i tempi restano gli stessi. Cambiano fascicolo, personaggi, indizi e correzioni. Usa il modello e la checklist; ogni nuova storia deve avere tutte le informazioni necessarie e una soluzione controllabile.</p><a href="nuove-storie.html">Apri il modello per nuove storie</a>')+details('Timer di riserva per il docente',console())
    (BASE/'docente-3sa.html').write_text(shell(s['titolo']+' · docente',teacher,r,True),encoding='utf-8')

INK=colors.HexColor('#132b36'); TEAL=colors.HexColor('#096b69'); LINE=colors.HexColor('#b9cbd3')
class Kit:
    def __init__(self,path,title):
        for name,file in [('Game','Arial.ttf'),('GameBold','Arial Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,'/System/Library/Fonts/Supplemental/'+file))
        self.c=canvas.Canvas(str(path),pagesize=A4,pageCompression=1);self.w,self.h=A4;self.n=0;self.title=title;self.y=0
        self.c.setTitle('Servizi in giallo - '+title+' - mazzo completo 3SA');self.c.setAuthor('Metodologie Operative')
    def page(self,title,tag='3SA · SERVIZI IN GIALLO'):
        if self.n:self.c.showPage()
        self.n+=1;self.c.setFillColor(TEAL);self.c.rect(0,self.h-10,self.w,10,fill=1,stroke=0)
        self.text(tag,36,self.h-28,self.w-72,9,True)
        self.y=self.text(title,36,self.h-50,self.w-72,21,True)-18
        self.c.setStrokeColor(LINE);self.c.line(36,28,self.w-36,28)
        self.text(self.title+' · '+str(self.n),36,22,self.w-72,8)
    def text(self,text,x,y,w,size=11,bold=False):
        clean=str(text).replace('\u2013','-').replace('\u2014','-').replace('\u2011','-')
        p=Paragraph(e(clean).replace('\n','<br/>'),ParagraphStyle('x',fontName='GameBold' if bold else 'Game',fontSize=size,leading=size*1.28,textColor=INK))
        _,h=p.wrap(w,2000);p.drawOn(self.c,x,y-h);return y-h
    def para(self,text,size=11,bold=False,gap=9):
        self.y=self.text(text,36,self.y,self.w-72,size,bold)-gap
        if self.y<38:raise ValueError(f'Overflow pagina {self.n}: {text[:50]}')
    def card(self,x,top,w,h,title,body,size=11):
        self.c.setStrokeColor(LINE);self.c.setFillColor(colors.white);self.c.rect(x,top-h,w,h,stroke=1,fill=1)
        self.c.setFillColor(TEAL);self.c.rect(x,top-4,w,4,fill=1,stroke=0)
        y=self.text(title,x+12,top-14,w-24,13,True)-8
        y=self.text(body,x+12,y,w-24,size)
        if y<top-h+10:raise ValueError(f'Card overflow {self.n}: {title}')
    def grid(self,cards,columns=2,rows=2,size=11):
        gap=12;w=(self.w-72-gap*(columns-1))/columns;h=(self.y-44-gap*(rows-1))/rows
        for i,(title,body) in enumerate(cards):self.card(36+(i%columns)*(w+gap),self.y-(i//columns)*(h+gap),w,h,title,body,size)
    def save(self):self.c.save()

def make_pdf(r,s):
    out=ROOT/'output/pdf/cluedo-servizi-3sa.pdf';out.parent.mkdir(parents=True,exist_ok=True);k=Kit(out,s['titolo'])
    k.page('Preparazione · prima di entrare in classe','SOLO DOCENTE · STAMPA SOLO FRONTE')
    k.para('Il mazzo comprende entrambe le copie per le squadre. Ritaglia dove ci sono riquadri. Le carte segrete vanno piegate in modo identico.',11)
    for i,step in enumerate(r['preparazione'][:4],1):k.para(str(i)+'. '+step)
    k.para('Coppie dei contrassegni',12,True)
    for p in s['personaggi']:k.para(p['nome']+': '+' + '.join(p['segni']))
    k.para('La traccia T1 da sola lascia due sospetti. T1 e T2 insieme identificano un solo personaggio. Usa soltanto la coppia del personaggio che ha pescato l’impostore.',10)
    k.page('Distribuzione e conduzione','SOLO DOCENTE')
    for i,step in enumerate(r['preparazione'][4:],5):k.para(str(i)+'. '+step)
    k.para('Assenze',12,True);k.para(r['presenze'],10)
    k.para('Tempi: 60 / 120 minuti',12,True)
    for phase in r['fasi']:k.para(f'{phase["titolo"]}: {phase["minuti"][0]} / {phase["minuti"][1]} minuti.',10)
    k.para('Si può interrompere dopo l’indagine: conserva le carte di ciascuna squadra in una busta. Alla ripresa usa la fase di ricostruzione e poi il finale.',10)
    k.page('Le sei regole','PROMEMORIA DEL CONDUTTORE · SI PUÒ MOSTRARE')
    for i,rule in enumerate(r['regole'],1):k.para(f'{i}. {rule["titolo"]}',11,True,4);k.para(rule['testo'],10.5,False,9)
    k.page('Spiega e conduci la partita','PROMEMORIA DEL CONDUTTORE · SI PUÒ MOSTRARE')
    k.para(r['copione']);k.para('Il caso',12,True);k.para(s['storia'])
    k.para('Quanto dura un giro?',12,True)
    for mode in [60,120]:
        for rounds in [3,4]:
            a,b,c=r['tempiGiro'][f'{mode}-{rounds}'];k.para(f'{mode} minuti, {rounds} giri: {a} min alla squadra A, {b} min alla B, {c} min per pescata e confronto. Alterna chi inizia.',10)
    k.para('T1 dopo il primo giro. T2 dopo l’ultimo. Con una sola squadra, il tempo del turno avversario serve per preparare domande e rileggere gli indizi.',10)
    k.page('Compiti delle squadre','RITAGLIA · UNA CARTA A OGNI SQUADRA')
    body='Tutti fanno domande e partecipano alla soluzione. Distribuite a sorte i compiti; se siete più di quattro condivideteli.\n\n'+'\n\n'.join(t['nome']+': '+t['testo'] for t in r['compiti'])+'\n\nIn coppia: uno annota e l’altro controlla; entrambi compongono la rete. Scambiate i compiti a ogni giro. In trio il controllo del turno è condiviso.'
    k.grid([('SQUADRA A',body),('SQUADRA B',body)],1,2,10.5)
    for p in s['personaggi']:
        k.page(p['nome'],'CARTA PERSONAGGIO · DA NON MOSTRARE')
        k.para('Leggi soltanto questa presentazione quando comincia il gioco:',10,True);k.para(p['presentazione'],12)
        k.para('I tuoi contrassegni: '+' + '.join(p['segni']),13,True)
        k.para('Se ti chiedono quali segni usi, dichiarali entrambi. Su questo rispondi sempre correttamente, anche se hai pescato l’impostore.',10)
        for answer in p['risposte']:k.para('Se chiedono di '+answer['tema'].lower(),11,True,4);k.para(answer['testo'],11)
        k.para('Come rispondere',12,True);k.para(r['regole'][2]['testo'],10)
        k.para('Se hai pescato la carta LEALE, tutte le risposte sono vere. Se hai pescato IMPOSTORE, applica soltanto le eccezioni della carta segreta.',10)
        k.para('Mentre le squadre ricostruiscono il fascicolo, prepara due frasi vere: che cosa sai della persona e quale errore va corretto. Le leggerai dopo la rivelazione, anche se sei l’impostore. Non aggiungere suggerimenti durante il lavoro delle squadre.',10)
    k.page('Carte segrete','DOCENTE: RITAGLIA E PIEGA IN MODO IDENTICO')
    secret='Inserisci la pagina alterata nel fascicolo, in privato. Non rivelare il ruolo. Puoi dire una sola frase falsa per turno di squadra, se la domanda riguarda quel tema. Le altre risposte restano vere. I contrassegni non si cambiano.\n\n'+'\n'.join(d['tema']+': «'+d['frase']+'»' for d in s['depistaggi'])+'\n\nSegna la bugia usata: giro 1 A □ B □ · giro 2 A □ B □ · giro 3 A □ B □ · giro 4 A □ B □. Puoi non mentire.'
    loyal='Rispondi secondo la carta-personaggio. Non inventare e non mostrare il foglio. Dichiara correttamente i contrassegni. Alle domande sull’impostore usa la risposta comune: «Dovete dimostrarlo con le tracce». Mantieni segreto questo ruolo fino alla rivelazione.'
    k.grid([('IMPOSTORE',secret),('LEALE',loyal),('LEALE',loyal)],1,3,10.5)
    k.page('Il foglio da sostituire','SOLO ALL’IMPOSTORE · PRIMA DELL’APERTURA')
    k.para('Inserisci questo foglio nella busta del fascicolo prima della lettura del caso, senza farti vedere. Le squadre riceveranno una copia delle stesse righe nel dossier.',11)
    for a in s['alterazioni']:k.para(a['id']+' · '+a['titolo'],13,True);k.para(a['testo'],12)
    k.page('Scegli soltanto una coppia','SOLO DOCENTE · TAGLIA VIA I NOMI DELLE COPPIE')
    w=(k.w-84)/2;rowh=(k.y-55)/3
    for i,p in enumerate(s['personaggi']):
        top=k.y-i*rowh;k.text('COPPIA: '+p['nome'],36,top,k.w-72,9,True)
        for j,(t,sign) in enumerate(zip(s['tracce'],p['segni'])):k.card(36+j*(w+12),top-18,w,rowh-27,t['id']+' · '+sign,t['testo'].replace('{segno}',sign),10)
    for team in ['A','B']:
        k.page('Dossier · squadra '+team,'DA CONSEGNARE SUBITO · PAGINA ALTERATA')
        k.para(s['storia'],11)
        for a in s['alterazioni']:k.para(a['id']+' · '+a['titolo'],12,True,4);k.para(a['testo'],11)
        k.para('Compito',12,True);k.para('Le tre righe sono state alterate. Correggile con gli indizi e le testimonianze. La correzione deve spiegare che cosa cambia per la persona. Conserva i codici delle prove utili. Non è ancora il momento di consegnare la risposta.')
        k.page('Quattro carte-indizio · squadra '+team,'MESCOLA · UNA PESCATA PER GIRO; DUE NELL’ULTIMO SE I GIRI SONO TRE')
        k.grid([(x['id']+' · '+x['titolo'],x['testo']) for x in s['indizi']],2,2,11)
        k.page('La storia a frammenti · squadra '+team,'CONSEGNA SUBITO · RITAGLIA E ORDINA SUL TAVOLO')
        k.para('Ordinate IERI, OGGI e DOMANI. Scegliete le parole che mostrano un bisogno, una risorsa e un desiderio. Componete un piccolo collage di parole; potete aggiungere un simbolo disegnato da voi. Si interpreta soltanto il personaggio inventato.',10)
        k.grid([(x['id']+' · '+x['titolo'],x['testo']) for x in s['frammenti']],2,2,11)
        k.page('Carte per la rete · squadra '+team,'CONSEGNA SUBITO · RITAGLIA E COLLEGA SULLA MAPPA')
        k.grid([(x['id']+' · '+x['titolo'],x['testo']) for x in s['rete']],2,4,10)
        k.page('La rete di '+s['protagonista']+' · squadra '+team,'LAVORATE SU QUESTO FOGLIO · CONSERVATELO FINO ALLA RIVELAZIONE')
        k.para('Mettete la persona al centro. Collegate almeno una risorsa informale, un servizio pubblico e una risorsa associativa. Scrivete sulle linee il contributo concreto. Indicate che cosa è già disponibile e che cosa va verificato. Potete tenere le carte attorno al foglio e riportare qui i codici.',11)
        k.c.setStrokeColor(LINE);k.c.roundRect(36,135,k.w-72,k.y-150,12,stroke=1,fill=0)
        k.text(s['protagonista'].upper()+' · bisogni, capacità, preferenze',140,(k.y+135)/2,315,12,True)
        k.text('Due bisogni: ____________________   Una capacità: ____________________',36,115,k.w-72,10)
        k.text('Un desiderio della persona: _________________________________________',36,84,k.w-72,10)
        k.page('La nostra soluzione · squadra '+team,'CONSEGNARE COPERTA PRIMA DI ASCOLTARE L’ALTRA SQUADRA')
        sections=[('Il personaggio impostore è…',''),('Lo dimostrano T1 e T2 perché…','')]+[(x['id']+' · '+x['titolo'],x['testo']) for x in s['consegne']]
        for index,(title,hint) in enumerate(sections):
            k.para(title,12,True,4)
            if hint:k.para(hint,9,False,4)
            for _ in range([1,2,4,4,4][index]):k.c.setStrokeColor(LINE);k.c.line(36,k.y-14,k.w-36,k.y-14);k.y-=22
            k.y-=10
        k.para('Abbiamo controllato: identità □ · due tracce □ · tre correzioni □ · mappa □',9)
    k.page('Soluzione e controllo finale','SOLO DOCENTE · DOPO ENTRAMBE LE CONSEGNE')
    k.para(s['soluzione']['identita'],10)
    for c in s['soluzione']['correzioni']:
        k.para(c['id']+' · Condizione da verificare',11,True,4);k.para(c['criterio'],10);k.para('Prove: '+', '.join(c['prove']),9)
    k.para(r['vittoria'],10);k.para(s['soluzione']['pistaIrrilevante'],9)
    k.page('Confronto e riferimenti','SOLO DOCENTE · CHIUSURA DELLA PARTITA')
    for q in s['soluzione']['domandeFinali']:k.para(q,11,True)
    k.para('Nella versione da 120 minuti',12,True);k.para('Ogni squadra legge alla persona una restituzione di tre frasi: ciò che abbiamo ascoltato, le risorse che riconosciamo, ciò che proponiamo di verificare con te. Poi formula tre regole di fiducia per il gruppo AMA. Sono approfondimenti: non aggiungono condizioni di vittoria.',11)
    k.para('Contenuti e laboratori',12,True)
    for x in s['contenuti']+s['laboratori']:k.para('• '+x,9.5,False,5)
    k.para('Riferimenti controllati il '+s['verificaFonti'],10,True)
    for f in s['fonti']:k.para(f['titolo']+'\n'+f['url'],8)
    k.save();return out,k.n

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--storia',default=active_story());parser.add_argument('--check',action='store_true');args=parser.parse_args()
    if not args.storia.replace('-','').isalnum():raise SystemExit('Identificativo storia non valido')
    r,s=load(BASE/'storie'/f'{args.storia}.json')
    if args.check: print('Regole, tempi, prove e tre identità verificati.');return
    out,pages=make_pdf(r,s);make_web(r,s)
    (BASE/'storia-attiva.json').write_text(json.dumps({'storia':args.storia},ensure_ascii=False)+'\n')
    print(f'Guide generate. PDF: {out} ({pages} pagine).')
if __name__=='__main__':main()
