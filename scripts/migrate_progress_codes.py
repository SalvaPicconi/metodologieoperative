#!/usr/bin/env python3
import json
import math
import sys
import ssl
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

API_ROOT = "https://ruplzgcnheddmqqdephp.supabase.co/rest/v1"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cGx6Z2NuaGVkZG1xcWRlcGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTYyMjksImV4cCI6MjA3NTY5MjIyOX0.tOLIkgi5yTt61_0rMlXUqxnbil4DLD7kBaqZBVAv1CI"

BASE_HEADERS = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
}

SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE

def normalize_class(value):
    if value is None:
        return ""
    v = str(value)
    v = "".join(v.split())
    return v.lower()


def normalize_code(value):
    if value is None:
        return ""
    v = str(value)
    v = "".join(v.split())
    # remove non alphanumeric
    v = "".join(ch for ch in v if ch.isalnum())
    return v.lower()


def deep_clone(obj):
    if obj is None:
        return None
    return json.loads(json.dumps(obj))


def is_meaningful_string(val):
    return isinstance(val, str) and val.strip() != ""


def merge_data(primary, secondary):
    if secondary is None:
        return deep_clone(primary) if primary is not None else None
    if primary is None:
        return deep_clone(secondary)

    if isinstance(primary, list) and isinstance(secondary, list):
        filled_primary = sum(1 for v in primary if is_meaningful_string(v))
        filled_secondary = sum(1 for v in secondary if is_meaningful_string(v))
        return deep_clone(secondary if filled_secondary > filled_primary else primary)

    if not isinstance(primary, dict) or not isinstance(secondary, dict):
        if is_meaningful_string(secondary):
            if not is_meaningful_string(primary) or len(secondary.strip()) > len(str(primary).strip()):
                return deep_clone(secondary)
        return deep_clone(primary)

    result = deep_clone(primary)
    for key, value in secondary.items():
        if key not in result or result[key] in (None, "", {}, []):
            result[key] = deep_clone(value)
            continue

        current = result[key]
        if isinstance(value, str) and isinstance(current, str):
            if len(value.strip()) > len(current.strip()):
                result[key] = value
            continue

        if isinstance(value, list) and isinstance(current, list):
            filled_current = sum(1 for v in current if is_meaningful_string(v))
            filled_value = sum(1 for v in value if is_meaningful_string(v))
            if filled_value > filled_current:
                result[key] = deep_clone(value)
            continue

        if isinstance(value, dict) and isinstance(current, dict):
            result[key] = merge_data(current, value)
            continue

    return result


def supabase_request(path, method="GET", params=None, headers=None, body=None):
    url = f"{API_ROOT}{path}"
    if params:
        query = urllib.parse.urlencode(params, doseq=True)
        url = f"{url}?{query}"

    final_headers = BASE_HEADERS.copy()
    if headers:
        final_headers.update(headers)

    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        final_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, method=method, headers=final_headers)
    try:
        with urllib.request.urlopen(req, context=SSL_CONTEXT) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read()
            if "application/json" in content_type:
                return json.loads(raw.decode("utf-8"))
            if raw:
                return raw.decode("utf-8")
            return None
    except urllib.error.HTTPError as err:
        details = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {err.code} when {method} {url}: {details}") from err


def fetch_all_progress():
    page_size = 500
    rows = []
    offset = 0

    while True:
        chunk = supabase_request(
            "/progress",
            params={
                "select": "id,student_code,class_code,page_path,updated_at",
                "order": "updated_at.desc",
                "limit": str(page_size),
                "offset": str(offset),
            },
        )
        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size

    return rows


def stringify_json(obj):
    if obj is None:
        return ""
    return json.dumps(obj, sort_keys=True, ensure_ascii=False)


def fetch_row_data(row_id):
    result = supabase_request(
        "/progress",
        params={
            "select": "data",
            "id": f"eq.{row_id}",
        },
    )
    if isinstance(result, list) and result:
        return result[0].get("data")
    return None


def update_row(row_id, payload):
    supabase_request(
        "/progress",
        method="PATCH",
        params={"id": f"eq.{row_id}"},
        headers={"Prefer": "return=representation"},
        body=payload,
    )


def delete_rows(ids):
    if not ids:
        return
    chunk_size = 50
    for idx in range(0, len(ids), chunk_size):
        chunk = ids[idx: idx + chunk_size]
        params = [( "id", f"eq.{row_id}" ) for row_id in chunk]
        supabase_request("/progress", method="DELETE", params=params)


def main():
    print("⏳ Caricamento progressi da Supabase...")
    rows = fetch_all_progress()
    print(f"📦 Trovate {len(rows)} righe nella tabella progress")

    rows_by_id = {row["id"]: row for row in rows}
    data_cache = {}
    sorted_rows = sorted(
        rows,
        key=lambda r: datetime.fromisoformat(r["updated_at"].replace("Z", "+00:00")) if r.get("updated_at") else datetime.fromtimestamp(0),
        reverse=True,
    )

    keepers = {}
    updates = {}
    duplicates_to_delete = []

    for row in sorted_rows:
        new_code = normalize_code(row.get("student_code"))
        new_class = normalize_class(row.get("class_code"))
        page_path = row.get("page_path") or ""

        if not new_code:
            print(f"⚠️ Riga {row['id']} senza student_code valido, salto")
            continue

        key = f"{page_path}|{new_code}"
        needs_code_update = row.get("student_code") != new_code
        needs_class_update = row.get("class_code") != new_class

        if key not in keepers:
            keepers[key] = row["id"]
            payload = {}
            if needs_code_update:
                payload["student_code"] = new_code
            if needs_class_update:
                payload["class_code"] = new_class
            if payload:
                updates[row["id"]] = payload
            continue

        keeper_id = keepers[key]
        if keeper_id not in data_cache:
            data_cache[keeper_id] = fetch_row_data(keeper_id)
        if row["id"] not in data_cache:
            data_cache[row["id"]] = fetch_row_data(row["id"])

        merged_data = merge_data(data_cache.get(keeper_id), data_cache.get(row["id"]))

        if stringify_json(merged_data) != stringify_json(data_cache.get(keeper_id)):
            payload = updates.get(keeper_id, {})
            payload["data"] = merged_data
            updates[keeper_id] = payload
            data_cache[keeper_id] = merged_data

        duplicates_to_delete.append(row["id"])

    print(f"🛠️ Aggiornamenti da applicare: {len(updates)}")
    print(f"🗑️ Duplicati da eliminare: {len(duplicates_to_delete)}")

    failed_updates = []
    for row_id, payload in updates.items():
        try:
            update_row(row_id, payload)
            print(f"✅ Aggiornato {row_id}")
        except Exception as exc:
            failed_updates.append((row_id, str(exc)))
            print(f"❌ Errore aggiornando {row_id}: {exc}")

    failed_deletes = False
    if duplicates_to_delete:
        try:
            delete_rows(duplicates_to_delete)
            print(f"🧹 Eliminati {len(duplicates_to_delete)} duplicati")
        except Exception as exc:
            failed_deletes = True
            print(f"❌ Errore eliminando duplicati: {exc}")

    print("🎉 Migrazione completata.")
    if failed_updates:
        print("⚠️ Aggiornamenti non riusciti:", len(failed_updates))
        for row_id, error in failed_updates:
            print(f"   - {row_id}: {error}")
    if failed_deletes:
        print("⚠️ Alcuni duplicati non sono stati eliminati.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("❌ Errore durante la migrazione:", exc, file=sys.stderr)
        sys.exit(1)
