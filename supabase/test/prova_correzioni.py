"""Collaudo Chromium della correzione in pagina. Solo elaborati e risposte API fittizi.

Uso: python3 supabase/test/prova_correzioni.py [radice del sito o del pacchetto Aruba]
"""
import json
import mimetypes
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit

from playwright.sync_api import sync_playwright


ORIGINE = 'https://metodologie.test'
PAGINA = '/materiali/terzo/percorsi_autoapprendimento.html'
ID = '11111111-1111-4111-8111-111111111111'
SCELTE = {'0': 0, '1': 0, '2': 2, '9': 1}
DATI = {
    '_learningPathState': {
        'quizAnswers': SCELTE, 'currentModule': 0,
        'matchingState': {'1': {'selected': None, 'pairs': ['1', '2']}},
        'moduleCompletion': [True, False, True, False, False],
        'reflections': {'1': 'Risposta nella copia di stato'},
    },
    'q1': 'on', 'q2': 'on', 'q3': 'on', 'q4': None, 'q10': 'on',
    'reflection-1': 'Risposta salvata dell’alunno di prova.',
}
BOZZA = {'tipo': 'compito', 'verifica': 'compito-servizi-autoapprendimento',
         'nota': 'Nota di prova', 'commenti': [
             {'campo': 'reflection-1', 'etichetta': 'Riflessione', 'commento': 'Riscontro di prova'},
             {'campo': 'blocco.quiz', 'etichetta': 'Quiz di autovalutazione', 'commento': '3 su 4 corrette'},
         ]}
ELABORATO = {'id': ID, 'class_code': '3SB', 'student_code': 'collaudofittizio',
             'school_year': 2026, 'chiave': 'compito-servizi-autoapprendimento',
             'data': DATI, 'bozza': BOZZA, 'pubblicata': BOZZA, 'revisione': 2}


def sito(context, root, api=None):
    def route(r):
        url = urlsplit(r.request.url)
        if r.request.method == 'OPTIONS':
            return r.fulfill(status=204, headers={
                'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            })
        if '/rest/v1/' in url.path and api:
            value = api(url.path.rsplit('/', 1)[-1], r.request)
            if value is not NotImplemented:
                return r.fulfill(json=value, headers={'Access-Control-Allow-Origin': '*'})
        if f'{url.scheme}://{url.netloc}' != ORIGINE:
            return r.fulfill(status=404, body='')
        file = root / unquote(url.path.lstrip('/'))
        if file.is_file() and file.is_relative_to(root):
            mime = 'text/javascript' if file.suffix == '.js' else mimetypes.guess_type(file)[0]
            return r.fulfill(body=file.read_bytes(), content_type=mime or 'application/octet-stream')
        return r.fulfill(status=404, body='')

    context.route('**/*', route)


def ambiente(browser, root, elaborato, attesa_ms=150, api=None, sessione=True):
    context = browser.new_context(service_workers='block')
    sito(context, root, api)
    context.add_init_script(f'''(() => {{
        window.__scritture = [];
        sessionStorage.setItem('mo:fixtures', '1');
        localStorage.setItem('mo:supabase-ping', String(Date.now()));
        localStorage.setItem('learning-path-state', JSON.stringify({{
            currentModule: 4, quizAnswers: {{0: 2, 1: 2}},
            reflections: {{1: 'Risposta di un altro utente di prova'}}
        }}));
        window.MODocente = {{
            attivo: () => {str(sessione).lower()},
            token: () => {str(sessione).lower()} ? 'docente-fittizio' : null,
            messaggioErrore: errore => errore.message,
            async chiama(nome, args) {{
                if (nome === 'verifiche_docente_apri') {{
                    await new Promise(r => setTimeout(r, {attesa_ms}));
                    return {json.dumps(elaborato, ensure_ascii=False)};
                }}
                if (nome === 'verifiche_docente_elaborati') return [{{
                    id: '{ID}', class_code: '3SB', student_code: 'collaudofittizio',
                    school_year: 2026, updated_at: '2026-11-25T12:00:00Z', stato: 'visibile'
                }}];
                if (nome === 'progress_docente_elenco_con_anno') return [{{
                    id: '{ID}', class_code: '3SB', student_code: 'collaudofittizio',
                    school_year: 2026, updated_at: '2026-11-25T12:00:00Z', page_path: '{PAGINA}',
                    meta: {{ compilati: 4, totali: 14 }}
                }}];
                if (nome === 'stroop_docente_test' || nome.startsWith('docente_abbinament')) return [];
                window.__scritture.push({{nome, args}});
                return {{revisione: 3, visibile: true}};
            }}
        }};
    }})();''')
    return context


def apri(page, path=PAGINA, id_elaborato=ID):
    return page.goto(f'{ORIGINE}{path}?docente=1&doc_class=3sb&doc_student=collaudofittizio&correzione={id_elaborato}',
                     wait_until='domcontentloaded')


def leggi(page):
    return page.evaluate('''() => ({
        scelte: [1, 2, 3, 4, 10].map(i => {
            const inputs = Array.from(document.getElementsByName('q' + i));
            const indice = inputs.findIndex(input => input.checked);
            const opzione = inputs[indice]?.closest('.option');
            return [indice, opzione?.classList.contains('correct') || false,
                opzione?.classList.contains('incorrect') || false];
        }),
        riflessione: document.querySelector('#reflection-1').value,
        quiz: document.querySelector('.mo-corr-box[data-campo="blocco.quiz"]')?.closest('.module')?.id || null,
        archivioLocale: JSON.parse(localStorage.getItem('learning-path-state')),
        scritture: window.__scritture,
    })''')


def verifica_servizi(browser, root):
    with ambiente(browser, root, ELABORATO, attesa_ms=220) as context:
        page = context.new_page()
        page.clock.set_fixed_time(datetime(2026, 11, 27, 10, tzinfo=timezone.utc))
        page.goto(f'{ORIGINE}/area_docente.html')
        page.locator('[data-select-class]').click()
        page.locator('details[data-activity] > summary').click()
        page.get_by_role('link', name='Apri la correzione', exact=True).click()
        page.wait_for_selector('.question .option.incorrect', state='attached')
        res = leggi(page)
        assert res['scelte'] == [[0, True, False], [0, False, True],
                                 [2, True, False], [-1, False, False], [1, True, False]], res['scelte']
        assert res['quiz'] == 'module-0'
        assert res['riflessione'] == DATI['reflection-1']
        assert res['archivioLocale']['quizAnswers'] == {'0': 2, '1': 2}
        assert not res['scritture']
        assert page.locator('#matching-1 .matched').count() == 4
        page.locator('input[name=q2]').first.evaluate('el => el.closest(".option").onclick()')
        assert leggi(page)['scelte'][1] == [0, False, True]
        page.locator('textarea[aria-label="Commento finale per l’alunno"]').fill('Nota aggiornata')
        page.wait_for_function('window.__scritture.length === 1')
        [salvataggio] = page.evaluate('window.__scritture')
        assert salvataggio['nome'] == 'verifiche_docente_salva'
        assert salvataggio['args']['p_id'] == ID and salvataggio['args']['p_revisione'] == 2
        assert salvataggio['args']['p_bozza']['commenti'][0]['commento'] == 'Riscontro di prova'
        assert 'data' not in salvataggio['args']


def verifica_alunno(browser, root, personale):
    richieste = []
    def api(nome, request):
        richieste.append(nome)
        if nome == 'alunni_lavoro_apri':
            return {'id': ID, 'versione': DATI['q1'], 'stato': 'in_corso',
                    'school_year': 2026, 'modificabile': True, 'data': DATI}
        if nome in ('progress_carica', 'progress_correzione', 'alunni_correzione'):
            return DATI if nome == 'progress_carica' else BOZZA
        raise AssertionError(f'Richiesta inattesa durante l’apertura: {nome}')

    with browser.new_context(service_workers='block') as context:
        sito(context, root, api)
        context.add_init_script('''localStorage.setItem('mo:supabase-ping', String(Date.now()));
            localStorage.setItem('mo:class', '3sb');
            localStorage.setItem('mo:code', 'collaudofittizio');''')
        if personale:
            context.add_init_script('''sessionStorage.setItem('mo:alunno-sessione', JSON.stringify({
                token: 'a'.repeat(64), scade: new Date(Date.now() + 60000).toISOString()
            }));''')
        page = context.new_page()
        page.goto(f'{ORIGINE}{PAGINA}')
        page.locator('.mo-corr-pannello h2').wait_for()
        assert page.locator('input[name=q1]').first.is_disabled()
        assert page.locator('input[name=q4]').first.is_enabled()
        assert page.locator('#reflection-1').evaluate('el => el.readOnly')
        assert page.locator('#project-needs').evaluate('el => !el.readOnly')
        assert page.locator('input[name=q2]').first.evaluate('el => el.checked')
        assert ('alunni_correzione' if personale else 'progress_correzione') in richieste


def verifica_archivi(browser, root):
    media = '/materiali/terzo/inc_esercitazione_media.html'
    elaborato = {**ELABORATO, 'chiave': 'compito-inc-esercitazione-media',
                 'data': {'q1': '0', 'q2': 'on', 'q3': '0'}, 'bozza': None}
    with ambiente(browser, root, elaborato) as context:
        page = context.new_page()
        apri(page, media)
        page.wait_for_selector('.mo-corr-esito[data-esito="errata"]', state='attached')
        assert page.locator('input[name=q1]').first.evaluate('n => n.checked')
        assert page.locator('[data-esito="corretta"].mo-corr-esito').count() == 1
        assert page.locator('input[name=q2]:checked').count() == 0
        assert page.locator('[data-esito="indeterminata"].mo-corr-esito').count() == 1
        assert page.locator('[data-esito="errata"].mo-corr-esito').count() == 1

    with ambiente(browser, root, None, sessione=False) as context:
        page = context.new_page()
        apri(page)
        page.locator('.mo-corr-pannello h2').wait_for()
        page.evaluate('window.MOCorrezioneDati')
        assert page.locator('input[type=radio]:checked').count() == 0
        assert not page.locator('#reflection-1').input_value()


def verifica_widget(browser, root):
    operatore = '/materiali/biennio/tssas_percorso_completo_v2.html'
    dati = {'act_vf1': '{"0":{"f":1,"d":true},"1":{"f":1,"d":true}}',
            'a5-dialogo': '{"k":3,"f":[0,2,1]}'}
    correzione = {**BOZZA, 'commenti': [
        {'campo': 'act.vf1', 'etichetta': 'Vero o falso', 'commento': '1 su 2 corrette'},
        {'campo': 'blocco.dialogo-matteo', 'etichetta': 'Dialogo', 'commento': '2 su 3 corrette'}
    ]}
    elaborato = {**ELABORATO, 'chiave': 'compito-operatore-percorso', 'data': dati, 'bozza': correzione}
    with ambiente(browser, root, elaborato) as context:
        page = context.new_page()
        apri(page, operatore)
        page.wait_for_selector('[data-act-id=vf1] .why.no', state='attached')
        assert 'Prima risposta errata' in page.locator('[data-act-id=vf1] .why.no').first.text_content()
        assert 'Prima risposta corretta' in page.locator('[data-act-id=vf1] .why.ok').first.text_content()
        assert page.locator('[data-act=vf1] + [data-campo="act.vf1"]').count() == 1
        assert 'Prima risposta errata' in page.locator('#a5-box').text_content()

    quarto = '/materiali/quarto/riconfigurare-la-disabilita/autoapprendimento.html'
    dati = {'verifica-passaggio-cogito': '["dubbio","certezza",null]', 'verifica-media': '1',
            'verifica-scopo-dubbio': 'indubitabile', 'risposta-aperta-nota': 'Testo conservato.'}
    elaborato = {**ELABORATO, 'chiave': 'compito-riconfigurare-disabilita', 'data': dati, 'bozza': None}
    with ambiente(browser, root, elaborato) as context:
        page = context.new_page()
        apri(page, quarto)
        page.wait_for_selector('#passaggio-cogito [data-esito][data-stato]', state='attached')
        assert '1 su 2 posizioni compilate corrette' in page.locator('#passaggio-cogito [data-esito]').text_content()
        assert page.locator('#media [data-esito]').get_attribute('data-stato') == 'riprova'
        assert page.locator('#scopo-dubbio [data-esito]').get_attribute('data-stato') == 'corretto'
        assert page.locator('#passaggio-cogito button[data-posizione]').first.is_disabled()


def censimento(browser, root):
    configurazione = json.loads((root / 'assets/verifiche-correzione.json').read_text())
    for verifica in configurazione['verifiche']:
        test = {**ELABORATO, 'chiave': verifica['chiave'], 'data': {'_meta': {}}, 'bozza': None}
        with ambiente(browser, root, test, attesa_ms=20) as context:
            page = context.new_page()
            page.on('dialog', lambda d: d.dismiss())
            apri(page, '/' + verifica['pagina'])
            page.locator('.mo-corr-pannello h2').wait_for(timeout=10000)
            assert '2026/27' in page.locator('.mo-corr-pannello h2').text_content(), verifica['pagina']
            assert page.evaluate('window.MOCorrezioneDati') == test['data'], verifica['pagina']
            assert not page.evaluate('window.__scritture'), verifica['pagina']
    return len(configurazione['verifiche'])


if __name__ == '__main__':
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]
    with sync_playwright() as p:
        browser = p.chromium.launch()
        verifica_servizi(browser, root)
        verifica_alunno(browser, root, personale=False)
        verifica_alunno(browser, root, personale=True)
        verifica_archivi(browser, root)
        verifica_widget(browser, root)
        n = censimento(browser, root)
        print(f'Collaudo superato. {n} pagine, accesso docente e due accessi alunno, scelte e commenti verificati.')
        browser.close()
