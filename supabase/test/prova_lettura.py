"""Prova della presentazione «lettura» su una pagina di attività, in Chrome, Firefox e Safari (WebKit).

Richiede il server di anteprima locale (node supabase/test/server-locale.mjs, porta 8421) e Playwright.
Uso: python3 supabase/test/prova_lettura.py materiali/laboratorio/fascicolo_disabilita_4sa.html
Scrive l'esito in supabase/test/ESITO-PROVA-LETTURA.md. Nessun dato reale: codice di prova inventato.
"""
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8421'
PAGINA = sys.argv[1] if len(sys.argv) > 1 else 'materiali/laboratorio/fascicolo_disabilita_4sa.html'
FORMATI = {'telefono': (375, 812), 'computer': (1280, 800), 'LIM': (1920, 1080)}
esiti = []


def prova(motore, formato, nome, ok, nota=''):
    esiti.append((motore, formato, nome, bool(ok), str(nota)))
    print(('✔' if ok else '✘'), motore, formato, '·', nome, ('— ' + str(nota)) if nota else '')


def prepara(page):
    page.goto(f'{BASE}/__api-locale')
    page.evaluate("""() => { sessionStorage.clear(); localStorage.setItem('mo:class', '4sa');
                              localStorage.setItem('mo:code', 'provalettura'); }""")
    page.goto(f'{BASE}/{PAGINA}')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(600)


def misure(page):
    return page.evaluate("""() => {
        const vis = el => el.offsetParent !== null && el.getClientRects().length;
        let piccoli = 0, tot = 0, minimo = 99;
        document.querySelectorAll('.tab-content.active :is(p, li, td, label, span, h3, h4)').forEach(el => {
            if (!vis(el) || !el.textContent.trim() || el.closest('#mo-barra')) return;
            const fs = parseFloat(getComputedStyle(el).fontSize); tot++;
            if (fs < 14) piccoli++; minimo = Math.min(minimo, fs);
        });
        let comandiPiccoli = 0;
        document.querySelectorAll('.tab-btn, #mo-salva, #mo-esci, .profile-card, .tab-content.active textarea, .tab-content.active input').forEach(el => {
            if (!vis(el)) return; const r = el.getBoundingClientRect(); if (r.height < 40) comandiPiccoli++;
        });
        return { largo: document.documentElement.scrollWidth, vista: innerWidth, piccoli, tot, minimo, comandiPiccoli };
    }""")


def una_prova(motore, formato, page):
    larghezza, altezza = FORMATI[formato]
    page.set_viewport_size({'width': larghezza, 'height': altezza})
    prepara(page)
    errori = []
    page.on('pageerror', lambda e: errori.append(str(e)[:120]))
    schede = page.evaluate("() => [...document.querySelectorAll('.tab-btn')].map(b => (b.getAttribute('onclick') || '').match(/showTab\\('([^']+)'\\)/)?.[1]).filter(Boolean)")
    for scheda in schede:
        page.evaluate(f"showTab('{scheda}')")
        page.wait_for_timeout(150)
        m = misure(page)
        prova(motore, formato, f'scheda {scheda}: niente scorrimento di lato', m['largo'] <= m['vista'] + 1, f"{m['largo']}/{m['vista']}")
        prova(motore, formato, f'scheda {scheda}: testo leggibile (sotto 14 px)', m['tot'] and m['piccoli'] / m['tot'] <= 0.05,
              f"{m['piccoli']}/{m['tot']} piccoli, minimo {m['minimo']:.1f}px")
        if formato == 'telefono':
            prova(motore, formato, f'scheda {scheda}: comandi grandi da toccare', m['comandiPiccoli'] == 0, f"{m['comandiPiccoli']} sotto 40 px")
    # Le schede restano raggiungibili scorrendo
    page.evaluate("showTab('l1')")
    page.evaluate("window.scrollTo(0, 2500)")
    page.wait_for_timeout(200)
    top = page.evaluate("document.querySelector('.tabs').getBoundingClientRect().top")
    prova(motore, formato, 'barra delle schede sempre in vista scorrendo', -2 <= top <= 140, f'top {top:.0f}')
    # Tabelle: sul telefono ogni cella ha il suo titolo
    if formato == 'telefono':
        senza = page.evaluate("() => [...document.querySelectorAll('table tbody td:not(.label)')].filter(td => !td.dataset.etichetta).length")
        prova(motore, formato, 'tabelle: ogni cella ha il titolo della colonna', senza == 0, f'{senza} senza titolo')
    # Salvataggio: scrivo, salvo, ricarico
    campo = '[data-id="1.1-pci-car"]'
    testo = f'Prova {motore} {formato} {int(time.time())}'
    page.evaluate("showTab('l1')")
    page.fill(campo, testo)
    page.click('#mo-salva')
    page.wait_for_timeout(1500)
    avviso = page.evaluate("document.querySelector('#mo-barra .mo-stato').textContent")
    page.reload()
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(800)
    prova(motore, formato, 'salvataggio e ripristino dopo ricarica', page.input_value(campo) == testo and avviso.startswith('Salvato'), avviso)
    # Scelta del profilo (fase Progettare) ancora funzionante
    page.evaluate("showTab('l4')")
    carta = page.locator('.profile-card').first
    if carta.count():
        carta.scroll_into_view_if_needed()
        carta.click()
        page.wait_for_timeout(200)
        sel = page.evaluate("document.querySelector('.profile-card').className")
        prova(motore, formato, 'scelta del profilo nella fase Progettare', 'selected' in sel or 'active' in sel, sel)
    # Tastiera: il fuoco si vede
    page.evaluate("showTab('cover')")
    page.evaluate("window.scrollTo(0,0)")
    page.mouse.click(5, 5)
    raggiunto = ''
    for _ in range(20):
        page.keyboard.press('Tab')
        raggiunto = page.evaluate("document.activeElement.tagName")
        if raggiunto in ('INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'A'):
            break
    if raggiunto in ('INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'A'):
        page.wait_for_timeout(500)  # i pulsanti delle schede hanno una transizione animata
        contorno = page.evaluate("() => { const s = getComputedStyle(document.activeElement); return document.activeElement.tagName + ' ' + s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.boxShadow.slice(0, 22); }")
        prova(motore, formato, 'tastiera: elemento attivo evidenziato', ('solid' in contorno and ' 0px' not in contorno) or 'rgba' in contorno, contorno)
    else:
        # Safari e la modalità telefono non spostano il fuoco con Tab: si verifica lo stile sul primo campo.
        page.focus('#st-nome')
        contorno = page.evaluate("() => { const s = getComputedStyle(document.activeElement); return document.activeElement.tagName + ' ' + s.boxShadow.slice(0, 22) + ' ' + s.borderColor; }")
        prova(motore, formato, 'campo attivo evidenziato (Tab non usato da questo motore)', 'rgba' in contorno, contorno)
    # Stampa: comandi nascosti
    page.emulate_media(media='print')
    nascosti = page.evaluate("() => ['#mo-barra', '.btn-print-fixed', '.tabs'].every(s => { const el = document.querySelector(s); return !el || getComputedStyle(el).display === 'none'; })")
    prova(motore, formato, 'stampa: pulsanti e schede non stampati', nascosti)
    page.emulate_media(media='screen')
    prova(motore, formato, 'nessun errore JavaScript', not errori, '; '.join(errori[:2]))


with sync_playwright() as p:
    for nome, tipo in [('Chrome', p.chromium), ('Firefox', p.firefox), ('Safari', p.webkit)]:
        browser = tipo.launch()
        for formato in FORMATI:
            contesto = browser.new_context(is_mobile=(formato == 'telefono' and nome != 'Firefox'),
                                           has_touch=(formato == 'telefono'))
            page = contesto.new_page()
            try:
                una_prova(nome, formato, page)
            except Exception as e:
                prova(nome, formato, 'prova completata senza interruzioni', False, str(e)[:160])
            contesto.close()
        browser.close()

falliti = [e for e in esiti if not e[3]]
righe = '\n'.join(f'| {m} | {f} | {n} | {"superata" if ok else "**NON superata**"} | {nota.replace("|", "/")} |' for m, f, n, ok, nota in esiti)
Path(__file__).with_name('ESITO-PROVA-LETTURA.md').write_text(
    f'# Prova della presentazione «lettura»\n\nPagina: `{PAGINA}` · anteprima locale, codice di prova inventato.\n'
    f'Motori: Chrome (Chromium), Firefox, Safari (WebKit) · formati: telefono 375×812, computer 1280×800, LIM 1920×1080.\n'
    f'Esito: {len(esiti) - len(falliti)} superate su {len(esiti)}.\n\n| Motore | Formato | Prova | Esito | Nota |\n| --- | --- | --- | --- | --- |\n{righe}\n')
print(f'\n{len(esiti) - len(falliti)}/{len(esiti)} prove superate')
