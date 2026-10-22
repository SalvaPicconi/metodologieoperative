import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ORIGINS = new Set(["https://metodologieoperativessas.it", "https://www.metodologieoperativessas.it", "https://salvapicconi.github.io", "http://localhost:8420", "http://127.0.0.1:8420", "http://127.0.0.1:8437"]);

function response(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, private",
    "Access-Control-Allow-Origin": ORIGINS.has(req.headers.get("origin") ?? "") ? req.headers.get("origin")! : "https://salvapicconi.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-programmi-session",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }});
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return response(req, null);
  if (req.method !== "POST") return response(req, { error: "Metodo non consentito." }, 405);
  const token = req.headers.get("x-programmi-session") ?? "";
  if (token.length < 32 || token.length > 128) return response(req, { error: "Accedi con la password dei Programmi." }, 401);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const { data: session, error } = await admin.from("programmi_revision_sessions")
    .select("author_name,expires_at").eq("token_hash", hash).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error || !session) return response(req, { error: "Sessione scaduta. Accedi di nuovo." }, 401);
  if (session.author_name !== "Pierluigi") return response(req, { error: "Questa sezione richiede l'accesso Carola." }, 403);
  const { data, error: readError } = await admin.rpc("leggi_programmazione_carola");
  if (readError || !data) return response(req, { error: "Programmazione temporaneamente non disponibile." }, 503);
  return response(req, { documento: data });
});
