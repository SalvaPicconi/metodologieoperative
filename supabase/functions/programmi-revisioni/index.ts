import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const SESSION_HOURS = 6;
const ALLOWED_ORIGINS = new Set([
  "https://salvapicconi.github.io",
  "http://localhost:8420",
  "http://127.0.0.1:8420",
]);
const VALID_STATES = new Set(["bozza", "approvata", "applicata", "archiviata"]);

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://salvapicconi.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-programmi-session",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8" },
  });
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifySession(request: Request) {
  const token = request.headers.get("x-programmi-session") ?? "";
  if (token.length < 32 || token.length > 128) return false;
  const tokenHash = await sha256(token);
  const { data, error } = await admin
    .from("programmi_revision_sessions")
    .select("token_hash,expires_at")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) return false;

  void admin
    .from("programmi_revision_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("token_hash", tokenHash);
  return true;
}

function cleanString(value: unknown, maxLength: number, required = false) {
  if (typeof value !== "string") {
    if (required) throw new Error("Campo obbligatorio non valido.");
    return "";
  }
  const cleaned = value.trim();
  if (required && !cleaned) throw new Error("Campo obbligatorio mancante.");
  if (cleaned.length > maxLength) throw new Error("Uno dei testi supera la lunghezza consentita.");
  return cleaned;
}

function cleanObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const serialized = JSON.stringify(value);
  if (serialized.length > 200_000) throw new Error("La bozza è troppo grande.");
  return value as Record<string, unknown>;
}

async function login(request: Request, payload: Record<string, unknown>) {
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!password || password.length > 200) return json(request, { error: "Password non corretta." }, 401);

  const { data: valid, error } = await admin.rpc("verifica_programmi_password", {
    p_password: password,
  });
  if (error || valid !== true) return json(request, { error: "Password non corretta." }, 401);

  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  await admin.from("programmi_revision_sessions").delete().lt("expires_at", new Date().toISOString());
  const { error: insertError } = await admin.from("programmi_revision_sessions").insert({
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (insertError) return json(request, { error: "Accesso temporaneamente non disponibile." }, 503);
  return json(request, { ok: true, token, expires_at: expiresAt });
}

async function listRevisions(request: Request) {
  const { data, error } = await admin
    .from("programmi_revisioni")
    .select("id,module_key,anno,numero,titolo_modulo,originale,modifiche,nota_generale,stato,source_version,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) return json(request, { error: "Impossibile caricare le annotazioni." }, 500);
  return json(request, { revisions: data ?? [] });
}

async function upsertRevision(request: Request, payload: Record<string, unknown>) {
  try {
    const record = cleanObject(payload.revision);
    const moduleKey = cleanString(record.module_key, 160, true);
    if (!/^[a-z0-9-]+$/.test(moduleKey)) throw new Error("Chiave UDA non valida.");
    const modifiche = cleanObject(record.modifiche);
    const notaGenerale = cleanString(record.nota_generale, 20_000);
    if (!notaGenerale && Object.keys(modifiche).length === 0) {
      throw new Error("Scrivi un’annotazione oppure modifica almeno un campo.");
    }

    const databaseRecord = {
      module_key: moduleKey,
      anno: cleanString(record.anno, 80, true),
      numero: cleanString(record.numero, 40),
      titolo_modulo: cleanString(record.titolo_modulo, 500, true),
      originale: cleanObject(record.originale),
      modifiche,
      nota_generale: notaGenerale,
      stato: VALID_STATES.has(String(record.stato)) ? String(record.stato) : "bozza",
      author_id: null,
      updated_by: "accesso-password",
      source_version: cleanString(record.source_version, 160) || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("programmi_revisioni")
      .upsert(databaseRecord, { onConflict: "module_key" })
      .select("id,module_key,anno,numero,titolo_modulo,originale,modifiche,nota_generale,stato,source_version,created_at,updated_at")
      .single();
    if (error) throw error;
    return json(request, { revision: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bozza non valida.";
    return json(request, { error: message }, 400);
  }
}

async function updateStatus(request: Request, payload: Record<string, unknown>) {
  const id = cleanString(payload.id, 50, true);
  const state = cleanString(payload.state, 20, true);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !VALID_STATES.has(state)) {
    return json(request, { error: "Aggiornamento non valido." }, 400);
  }
  const { data, error } = await admin
    .from("programmi_revisioni")
    .update({ stato: state, updated_by: "accesso-password", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,module_key,anno,numero,titolo_modulo,originale,modifiche,nota_generale,stato,source_version,created_at,updated_at")
    .single();
  if (error) return json(request, { error: "Impossibile aggiornare lo stato." }, 500);
  return json(request, { revision: data });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Metodo non consentito." }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json(request, { error: "Richiesta non valida." }, 400);
  }

  const action = typeof payload.action === "string" ? payload.action : "";
  if (action === "login") return await login(request, payload);

  if (!(await verifySession(request))) return json(request, { error: "Sessione scaduta. Accedi di nuovo." }, 401);
  if (action === "session") return json(request, { ok: true });
  if (action === "list") return await listRevisions(request);
  if (action === "upsert") return await upsertRevision(request, payload);
  if (action === "status") return await updateStatus(request, payload);
  if (action === "logout") {
    const token = request.headers.get("x-programmi-session") ?? "";
    if (token) await admin.from("programmi_revision_sessions").delete().eq("token_hash", await sha256(token));
    return json(request, { ok: true });
  }
  return json(request, { error: "Azione non riconosciuta." }, 400);
});
