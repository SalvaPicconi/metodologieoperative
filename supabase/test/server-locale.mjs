// Anteprima locale dell'Area alunni: serve il sito e risponde a /rest/v1/rpc/<funzione> come PostgREST,
// con la migrazione vera applicata a un database PGlite in memoria e soli dati inventati.
// Nessun collegamento al progetto Supabase remoto.
//
// Uso:  cd supabase/test && npm install && node server-locale.mjs   (porta 8421, oppure PORT=...)
// Poi aprire http://localhost:8421/__api-locale : imposta nel browser la chiave mo:api-locale, che le
// pagine onorano SOLO su localhost, e porta alla home.
import { createServer } from 'node:http';
import { readFileSync, statSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname, sep } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const qui = dirname(fileURLToPath(import.meta.url));
const radice = normalize(join(qui, '..', '..'));
const PORT = Number(process.env.PORT || 8421);

const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(readFileSync(join(qui, 'baseline.sql'), 'utf8'));

// ---- Dati inventati, inseriti prima della migrazione: è lei a unificarli, come farà sui dati veri ----
const PAG = {
    percorsi: '/materiali/terzo/percorsi_autoapprendimento.html',
    ripasso: '/materiali/terzo/ripasso-terzo-anno.html',
    tssas: '/materiali/biennio/tssas_percorso_completo_v2.html'
};
const tssasHtml = readFileSync(join(radice, PAG.tssas.slice(1)), 'utf8');
const campoTssas = (tssasHtml.match(/<textarea[^>]*\bid="([^"]+)"/) || [])[1] || 'campo';
await db.query(`insert into public.progress (class_code, student_code, page_path, data, updated_at, school_year) values
  ('2sb','provaa','/metodologieoperative${PAG.tssas}', $1::jsonb, '2026-03-02 09:00+01', 2025),
  ('3sb','provaa','${PAG.ripasso}', '{"_meta":{"percentuale":35}}', '2026-11-10 09:00+01', 2026),
  ('3sb','provaa','/materiali/terzo/equipe_multiprofessionale.html', '{"x":"lavoro"}', '2026-11-09 09:00+01', 2026),
  ('3SB','proaa','/materiali/terzo/esercitazioni_servizi.html', '{"x":"codice scritto male"}', '2026-11-08 09:00+01', 2026),
  ('3sb','provab','${PAG.ripasso}', '{"x":"altro alunno"}', '2026-11-11 09:00+01', 2026),
  ('3sb','provac','${PAG.ripasso}', '{"x":"codice quasi uguale, stessa attività"}', '2026-11-12 09:00+01', 2026)`,
    [JSON.stringify({ [campoTssas]: 'Risposta inventata scritta in seconda.', _meta: { percentuale: 100 } })]);
await db.exec(readFileSync(join(qui, '..', 'area-alunni.sql'), 'utf8'));
await db.exec(readFileSync(join(qui, '..', 'verifiche-correzione.sql'), 'utf8'));
await db.exec(`insert into public.progress (class_code, student_code, page_path, data, school_year) values
  ('3sb','provaa','/materiali/terzo/verifica_sommativa_q1.html','{"vt_44":"Risposta inventata alla prima domanda.","vt_45":"Seconda risposta inventata."}',2026)`);

// ---- PostgREST minimo ---------------------------------------------------------------------------
const firme = new Map();
async function firma(nome) {
    if (firme.has(nome)) return firme.get(nome);
    const r = await db.query(`select pg_get_function_identity_arguments(p.oid) a, p.proretset s, p.prorettype::regtype::text t
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [nome]);
    if (r.rows.length !== 1) return null;
    const args = r.rows[0].a ? r.rows[0].a.split(', ').map(s => {
        const [n, ...t] = s.split(' ');
        return { n, t: t.join(' ').replace(/ DEFAULT .*/, '') };
    }) : [];
    const f = { args, setof: r.rows[0].s, void: r.rows[0].t === 'void' };
    firme.set(nome, f);
    return f;
}

let coda = Promise.resolve();
const inSerie = fn => (coda = coda.then(fn, fn));

async function rpc(nome, corpo, ip) {
    const f = await firma(nome);
    if (!f) return [404, { code: 'PGRST202', message: `funzione ${nome} non trovata` }];
    const ignoti = Object.keys(corpo).filter(k => !f.args.some(a => a.n === k));
    if (ignoti.length) return [404, { code: 'PGRST202', message: `argomenti non previsti: ${ignoti.join(', ')}` }];
    const usati = f.args.filter(a => Object.hasOwn(corpo, a.n));
    const valori = usati.map(a => {
        const v = corpo[a.n];
        return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
    });
    const chiamata = `public.${nome}(${usati.map((a, i) => `${a.n} => $${i + 1}::${a.t}`).join(', ')})`;
    return inSerie(async () => {
        await db.exec(`set request.headers = '${JSON.stringify({ 'x-forwarded-for': ip }).replace(/'/g, "''")}'`);
        await db.exec('set role anon');
        try {
            if (f.setof) return [200, (await db.query(`select * from ${chiamata}`, valori)).rows];
            const r = await db.query(`select ${chiamata} as v`, valori);
            return f.void ? [204, null] : [200, r.rows[0].v];
        } catch (e) {
            const stato = e.code === '42501' ? 403 : e.code === '28P01' ? 401 : 400;
            return [stato, { code: e.code, message: e.message, hint: e.hint || null, details: null }];
        } finally {
            await db.exec('reset role');
        }
    });
}

const TIPI = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.mp4': 'video/mp4' };

createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'apikey, authorization, content-type, prefer');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    if (url.pathname === '/__api-locale') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(
            `<!doctype html><meta charset="utf-8"><title>Anteprima locale</title><script>localStorage.setItem('mo:api-locale', location.origin);location.replace('/index.html');</script>`);
        return;
    }
    const m = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
    if (m && req.method === 'POST') {
        let testo = '';
        for await (const pezzo of req) testo += pezzo;
        let corpo = {};
        try { corpo = testo ? JSON.parse(testo) : {}; } catch { res.writeHead(400).end(); return; }
        const [stato, dati] = await rpc(m[1], corpo, req.socket.remoteAddress || '127.0.0.1');
        res.writeHead(stato, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(dati === null ? '' : JSON.stringify(dati));
        return;
    }
    let percorso = decodeURIComponent(url.pathname);
    if (percorso.endsWith('/')) percorso += 'index.html';
    const file = normalize(join(radice, percorso));
    if (!file.startsWith(radice + sep) || /[\\/](\.git|node_modules|supabase|scripts|\.claude)([\\/]|$)/.test(file.slice(radice.length))) {
        res.writeHead(404).end(); return;
    }
    try {
        if (!statSync(file).isFile()) throw new Error();
        res.writeHead(200, { 'Content-Type': TIPI[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        createReadStream(file).pipe(res);
    } catch { res.writeHead(404).end('Non trovato'); }
}).listen(PORT, () => {
    console.log(`Anteprima locale su http://localhost:${PORT}/__api-locale (password docente di collaudo: password-di-collaudo)`);
    console.log('Alunni inventati: classe 3sb, codici provaa (anche come «proaa»), provab, provac.');
});
