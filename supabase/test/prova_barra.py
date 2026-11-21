"""Prova della barra del lavoro comune (assets/progress-global.js + assets/barra-lavoro.css).

1. Tutte le pagine con salvataggio, in Chrome (computer) e Safari (telefono): una sola barra visibile con
   «Salva» ed «Esci», nessun «Cambia studente» visibile, niente scorrimento di lato, niente sovrapposizioni
   con altri comandi fissi, nessun errore JavaScript.
2. Scenari su pagine campione in Chrome, Firefox e Safari, telefono e computer:
   salvataggio automatico, «Esci» che salva prima di uscire, salvataggio quando si lascia la pagina,
   area «I miei lavori», ospite, modalità docente senza salvataggio automatico, rete assente con nuovo tentativo.

Richiede il server di anteprima locale (node supabase/test/server-locale.mjs, porta 8421). Solo dati inventati.
Uso: python3 supabase/test/prova_barra.py   → scrive supabase/test/ESITO-PROVA-BARRA.md
"""
import subprocess
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8421'
RADICE = Path(__file__).resolve().parents[2]
esiti = []


# Difetti presenti già nella versione online prima di questa modifica (verificati sul commit precedente):
# si segnalano a parte, non dipendono dalla barra.
GIA_PRESENTI = {
    ('welfare-activity.html', 'niente scorrimento di lato'),
    ('welfare-activity.html', 'nessun errore JavaScript'),
    ('materiali/biennio/gruppi_lavoro_sociale_autoapprendimento.html', 'niente scorrimento di lato'),
}
noti = []


def prova(gruppo, nome, ok, nota=''):
    if not ok and any(pag in gruppo and nome == n for pag, n in GIA_PRESENTI):
        noti.append((gruppo, nome, str(nota)))
        print('•', gruppo, '·', nome, '— già presente prima:', nota)
        return
    esiti.append((gruppo, nome, bool(ok), str(nota)))
    print(('✔' if ok else '✘'), gruppo, '·', nome, ('— ' + str(nota)) if nota else '')


def pagine_con_salvataggio():
    elenco = subprocess.run(['git', 'ls-files', '*.html'], capture_output=True, text=True, cwd=RADICE).stdout.split('\n')
    out = []
    for f in filter(None, elenco):
        testo = (RADICE / f).read_text(encoding='utf-8', errors='ignore')
        if 'progress-global' in testo and f not in ('index.html', 'materiali/laboratorio/laboratorio_autobiografico.html'):
            out.append(f)
    return out


def identita(page, classe='4sa', codice='provabarra'):
    page.goto(f'{BASE}/__api-locale')
    page.evaluate(f"""() => {{ sessionStorage.clear(); localStorage.setItem('mo:class', '{classe}');
                              localStorage.setItem('mo:code', '{codice}'); }}""")


def apri(page, pagina, attesa=1200):
    page.goto(f'{BASE}/{pagina.replace(" ", "%20")}')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(attesa)


CENSIMENTO_JS = """() => {
    const vis = el => { if (!el) return false; const c = getComputedStyle(el), r = el.getBoundingClientRect();
                        return c.display !== 'none' && c.visibility !== 'hidden' && parseFloat(c.opacity) > 0.05 && r.width > 0 && r.height > 0; };
    const barre = [...document.querySelectorAll('#mo-barra')];
    const barra = barre[0];
    const cambia = [...document.querySelectorAll('button, a')].filter(b => vis(b) && /cambia studente/i.test(b.textContent)).length;
    const altriSalva = [...document.querySelectorAll('button, a, input[type=button], input[type=submit]')].filter(b => vis(b) && !b.closest('#mo-barra')
        && /^[^a-zà-ü]*salva(?![a-zà-ü])/i.test((b.textContent || b.value || '').trim())).map(b => (b.textContent || b.value).trim().slice(0, 30));
    const br = barra ? barra.getBoundingClientRect() : null;
    const sovrapposti = [];
    if (br) document.querySelectorAll('body *').forEach(el => {
        if (barra.contains(el) || el.contains(barra) || !vis(el)) return;
        const c = getComputedStyle(el); if (c.position !== 'fixed' && c.position !== 'sticky') return;
        const r = el.getBoundingClientRect();
        // Schermate a tutto schermo (password delle verifiche): coprono la barra, ed è giusto così.
        if (r.width >= innerWidth * .95 && r.height >= innerHeight * .95) return;
        if (r.right > br.left + 2 && r.left < br.right - 2 && r.bottom > br.top + 2 && r.top < br.bottom - 2)
            sovrapposti.push((el.id || el.className || el.tagName).toString().slice(0, 40));
    });
    return { barre: barre.length, visibile: vis(barra), esci: vis(document.querySelector('#mo-esci')),
             salva: vis(document.querySelector('#mo-salva')), cambia, altriSalva, sovrapposti,
             largo: document.documentElement.scrollWidth, vista: innerWidth,
             chi: barra ? barra.querySelector('.mo-chi').textContent : '', stato: barra ? barra.querySelector('.mo-stato').textContent : '' };
}"""


def censimento(p):
    pagine = pagine_con_salvataggio()
    for nome, tipo, formato, opz in [('Chrome', p.chromium, 'computer', {'viewport': {'width': 1280, 'height': 800}}),
                                     ('Safari', p.webkit, 'telefono', {'viewport': {'width': 375, 'height': 812}, 'is_mobile': True, 'has_touch': True})]:
        browser = tipo.launch()
        contesto = browser.new_context(**opz)
        page = contesto.new_page()
        errori = []
        page.on('pageerror', lambda e: errori.append(str(e)[:100]))
        identita(page)
        for f in pagine:
            errori.clear()
            gruppo = f'{nome} {formato} · {f}'
            try:
                apri(page, f, 1000)
                m = page.evaluate(CENSIMENTO_JS)
                prova(gruppo, 'una sola barra, visibile, con Salva ed Esci',
                      m['barre'] == 1 and m['visibile'] and m['esci'] and m['salva'], f"barre {m['barre']} · {m['chi']} · {m['stato']}")
                prova(gruppo, 'nessun «Cambia studente» visibile', m['cambia'] == 0, m['cambia'])
                prova(gruppo, 'nessun altro pulsante «Salva» fuori dalla barra', not m['altriSalva'], ', '.join(m['altriSalva']))
                prova(gruppo, 'niente scorrimento di lato', m['largo'] <= m['vista'] + 1, f"{m['largo']}/{m['vista']}")
                prova(gruppo, 'la barra non copre altri comandi fissi', not m['sovrapposti'], ', '.join(m['sovrapposti']))
                prova(gruppo, 'nessun errore JavaScript', not errori, '; '.join(errori[:2]))
            except Exception as e:
                prova(gruppo, 'pagina aperta senza interruzioni', False, str(e)[:140])
        contesto.close()
        browser.close()


CAMPIONI = [
    # (pagina, come raggiungere il campo, selettore del campo)
    ('lab_infanzia.html', None, '[name="infanzia_obiettivo"], #infanzia_obiettivo'),
    ('materiali/terzo/inc_esercitazione_media.html', None, None),
    ('materiali/laboratorio/fascicolo_disabilita_4sa.html', "showTab('l1')", '[data-id="1.1-pci-car"]'),
]

TROVA_CAMPO_JS = """() => {
    const c = [...document.querySelectorAll('textarea, input[type=text]')].find(e => !e.disabled && !e.readOnly
        && e.offsetParent && !e.closest('#mo-barra') && (e.name || e.id || e.dataset.id));
    if (!c) return null;
    if (c.name) return `[name="${c.name}"]`;
    if (c.id) return `#${CSS.escape(c.id)}`;
    return `[data-id="${c.dataset.id}"]`;
}"""


def prepara_campo(page, pagina, azione, selettore):
    apri(page, pagina)
    if azione:
        page.evaluate(azione)
        page.wait_for_timeout(200)
    if not selettore:
        selettore = page.evaluate(TROVA_CAMPO_JS)
    return selettore


def stato(page):
    return page.evaluate("document.querySelector('#mo-barra .mo-stato')?.textContent || ''")


def scrivi(page, selettore, testo):
    campo = page.locator(selettore).first
    campo.scroll_into_view_if_needed()
    campo.fill(testo)


def scenari(p):
    for nome, tipo in [('Chrome', p.chromium), ('Firefox', p.firefox), ('Safari', p.webkit)]:
        browser = tipo.launch()
        for formato, opz in [('computer', {'viewport': {'width': 1280, 'height': 800}}),
                             ('telefono', {'viewport': {'width': 375, 'height': 812}, 'has_touch': True,
                                           **({} if nome == 'Firefox' else {'is_mobile': True})})]:
            contesto = browser.new_context(**opz)
            page = contesto.new_page()
            page.on('dialog', lambda d: d.accept())
            richieste = []
            page.on('request', lambda r: richieste.append(r.url) if 'progress_salva' in r.url or 'alunni_lavoro_salva' in r.url else None)
            g = f'{nome} {formato}'
            try:
                for pagina, azione, sel in CAMPIONI:
                    codice = f"barra{nome[:2].lower()}{formato[:3]}"
                    identita(page, '4sa', codice)
                    sel = prepara_campo(page, pagina, azione, sel)
                    if not sel:
                        prova(g, f'{pagina}: campo trovato', False)
                        continue
                    # A. salvataggio automatico
                    testo = f'auto {nome} {formato} {int(time.time() * 1000)}'
                    scrivi(page, sel, testo)
                    page.wait_for_timeout(500)
                    durante = stato(page)
                    page.wait_for_timeout(6000)
                    dopo = stato(page)
                    apri(page, pagina)
                    if azione: page.evaluate(azione)
                    prova(g, f'{pagina}: si salva da solo e torna dopo la ricarica',
                          page.locator(sel).first.input_value() == testo and dopo.startswith('Salvato'), f'{durante} → {dopo}')
                    # B. lasciare la pagina subito dopo aver scritto (prima del salvataggio automatico)
                    testo = f'uscita {nome} {formato} {int(time.time() * 1000)}'
                    scrivi(page, sel, testo)
                    page.wait_for_timeout(300)
                    page.goto(f'{BASE}/glossario.html')
                    page.wait_for_timeout(1500)
                    apri(page, pagina)
                    if azione: page.evaluate(azione)
                    prova(g, f'{pagina}: salvato anche lasciando subito la pagina', page.locator(sel).first.input_value() == testo)
                    # C. «Esci» subito dopo aver scritto: prima salva, poi libera il dispositivo
                    testo = f'esci {nome} {formato} {int(time.time() * 1000)}'
                    scrivi(page, sel, testo)
                    page.wait_for_timeout(200)
                    page.click('#mo-esci')
                    page.wait_for_timeout(2500)
                    uscito = page.evaluate("!localStorage.getItem('mo:class') && !localStorage.getItem('mo:code')")
                    identita(page, '4sa', codice)
                    apri(page, pagina)
                    if azione: page.evaluate(azione)
                    prova(g, f'{pagina}: «Esci» salva e poi libera il dispositivo',
                          uscito and page.locator(sel).first.input_value() == testo, f'uscito={uscito}')

                # D. Area «I miei lavori» (pagina pilota, alunno inventato 3sb/provaa)
                pagina = 'materiali/terzo/percorsi_autoapprendimento.html'
                page.goto(f'{BASE}/__api-locale')
                page.evaluate("() => { sessionStorage.clear(); localStorage.clear(); localStorage.setItem('mo:api-locale', location.origin); }")
                page.goto(f'{BASE}/area_alunni.html')
                page.wait_for_timeout(800)
                esito = page.evaluate("async () => await window.MOAreaAlunni.accedi('3sb', 'provaa')")
                sel = prepara_campo(page, pagina, None, None)
                chi = page.evaluate("document.querySelector('#mo-barra .mo-chi')?.textContent || ''")
                testo = f'area {nome} {formato} {int(time.time() * 1000)}'
                scrivi(page, sel, testo)
                page.wait_for_timeout(6500)
                dopo = stato(page)
                apri(page, pagina)
                prova(g, 'area «I miei lavori»: si salva da solo', esito == 'ok' and page.locator(sel).first.input_value() == testo
                      and dopo.startswith('Salvato') and chi.startswith('I miei lavori'), f'{esito} · {chi} · {dopo}')
                testo = f'area-esci {nome} {formato} {int(time.time() * 1000)}'
                scrivi(page, sel, testo)
                page.click('#mo-esci')
                page.wait_for_timeout(3000)
                prova(g, 'area: «Esci» salva e torna all’ingresso di «I miei lavori»', 'area_alunni.html' in page.url, page.url)
                page.evaluate("async () => await window.MOAreaAlunni.accedi('3sb', 'provaa')")
                apri(page, pagina)
                prova(g, 'area: dopo «Esci» il lavoro c’è', page.locator(sel).first.input_value() == testo)
                page.evaluate("async () => await window.MOAreaAlunni.esci()")

                # E. Modalità docente: niente salvataggio automatico
                identita(page, '4sa', 'barradocente')
                sel = prepara_campo(page, 'lab_infanzia.html', None, CAMPIONI[0][2])
                page.evaluate("document.body.dataset.moSuper = 'true'")
                prima = len(richieste)
                scrivi(page, sel, 'il docente legge')
                page.wait_for_timeout(5500)
                prova(g, 'modalità docente: nessun salvataggio automatico', len(richieste) == prima, stato(page))

                # F. Ospite: niente «Salva»
                page.goto(f'{BASE}/__api-locale')
                page.evaluate("() => { sessionStorage.clear(); localStorage.removeItem('mo:class'); localStorage.removeItem('mo:code'); }")
                page.goto(f'{BASE}/lab_infanzia.html')
                page.wait_for_timeout(1000)
                ospite = page.locator('#guest')
                if ospite.count():
                    ospite.click()
                    page.wait_for_timeout(800)
                    m = page.evaluate(CENSIMENTO_JS)
                    prova(g, 'ospite: barra con Esci, senza Salva', m['esci'] and not m['salva'], m['stato'])
                else:
                    prova(g, 'ospite: pulsante «Entra come ospite» presente', False)

                # G. Rete assente: avviso e nuovo tentativo automatico (solo computer, per i tempi)
                if formato == 'computer':
                    identita(page, '4sa', f'barrarete{nome[:2].lower()}')
                    sel = prepara_campo(page, 'lab_infanzia.html', None, CAMPIONI[0][2])
                    page.route('**/rpc/progress_salva', lambda r: r.abort())
                    testo = f'rete {nome} {int(time.time() * 1000)}'
                    scrivi(page, sel, testo)
                    page.wait_for_timeout(6000)
                    senza = stato(page)
                    page.unroute('**/rpc/progress_salva')
                    page.wait_for_timeout(23000)
                    con = stato(page)
                    apri(page, 'lab_infanzia.html')
                    prova(g, 'rete assente: lo dice e salva da solo quando torna',
                          'Non salvato' in senza and con.startswith('Salvato') and page.locator(sel).first.input_value() == testo, f'{senza} → {con}')
            except Exception as e:
                prova(g, 'scenari completati senza interruzioni', False, str(e)[:200])
            contesto.close()
        browser.close()


import sys
with sync_playwright() as p:
    censimento(p)
    if '--solo-pagine' not in sys.argv:
        scenari(p)

falliti = [e for e in esiti if not e[2]]
righe = '\n'.join(f'| {g} | {n} | {"superata" if ok else "**NON superata**"} | {nota.replace("|", "/")} |' for g, n, ok, nota in esiti)
Path(__file__).with_name('ESITO-PROVA-BARRA-PAGINE.md' if '--solo-pagine' in sys.argv else 'ESITO-PROVA-BARRA.md').write_text(
    f'# Prova della barra del lavoro\n\nAnteprima locale, alunni e codici inventati.\n'
    f'Esito: {len(esiti) - len(falliti)} superate su {len(esiti)}.\n\n'
    + (('Difetti già presenti prima di questa modifica (non dipendono dalla barra): '
        + '; '.join(f'{g} · {n} ({nota})' for g, n, nota in noti) + '.\n\n') if noti else '')
    + f''
    f'| Dove | Prova | Esito | Nota |\n| --- | --- | --- | --- |\n{righe}\n')
print(f'\n{len(esiti) - len(falliti)}/{len(esiti)} prove superate')
