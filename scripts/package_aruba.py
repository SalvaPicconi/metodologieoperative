#!/usr/bin/env python3
"""Esporta il sito statico alla radice del dominio Aruba, senza modificare le fonti.

Uso: python3 scripts/package_aruba.py --output /percorso/nuova-cartella
L'output deve essere assente: un'esportazione non sovrascrive una precedente.
"""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urlsplit
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://metodologieoperativessas.it"
OLD = "https://salvapicconi.github.io/metodologieoperative"
EXCLUDED = {".github", "scripts", "supabase", "programmi-src", "PWA-Metodologie-Operative"}


class Fields(HTMLParser):
    def __init__(self):
        super().__init__()
        self.fields = []

    def handle_starttag(self, tag, attrs):
        # Non cambiare chiavi di salvataggio, identita e campi delle attivita.
        self.fields.append((tag, tuple((key, value) for key, value in attrs
                           if key in {"id", "name", "data-key", "data-field", "data-save"}
                           or key.startswith("data-progress"))))


def transform(name, raw):
    if name.endswith(".html"):
        text = raw.decode("utf-8")
        text = text.replace(OLD, DOMAIN)
        # Anche l'indirizzo visibile dei collegamenti al sito.
        text = text.replace(OLD.removeprefix("https://"), DOMAIN.removeprefix("https://"))
        # Le configurazioni pathPrefixes, prive dello slash finale, restano intatte.
        if name in {"index.html", "offline.html"}:
            text = text.replace("/metodologieoperative/", "/")
        before, after = Fields(), Fields()
        before.feed(raw.decode("utf-8"))
        after.feed(text)
        assert before.fields == after.fields, f"Campi cambiati: {name}"
        return text.encode("utf-8")
    if name in {"manifest.json", "service-worker.js"}:
        text = raw.decode("utf-8").replace("/metodologieoperative/", "/")
        if name == "service-worker.js":
            text = text.replace("metop-lab-v24", "metop-aruba-v1")
        return text.encode("utf-8")
    return raw


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    dest = args.output.resolve()
    if dest.exists():
        parser.error("La cartella di output esiste gia: usare una nuova destinazione.")
    if dest == ROOT or ROOT in dest.parents:
        parser.error("L'esportazione deve essere fuori dal repository.")
    files = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    dest.mkdir(parents=True)
    site = dest / "site"
    changed, hashes = [], {}
    for name in filter(None, files):
        path = Path(name)
        if path.parts[0] in EXCLUDED or path.name.startswith("."):
            continue
        if len(path.parts) == 1 and path.suffix.lower() in {".md", ".txt"}:
            continue
        raw = (ROOT / path).read_bytes()
        output = transform(name, raw)
        target = site / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(output)
        hashes[name] = hashlib.sha256(output).hexdigest()
        if output != raw:
            changed.append(name)

    # Compatibilita dei link prefissati, HTTPS e un solo dominio per i salvataggi locali.
    htaccess = '''# Metodologie Operative SSAS - esportazione Aruba
DirectoryIndex index.html
RewriteEngine On
RewriteCond %{HTTPS} !=on [OR]
RewriteCond %{HTTP_HOST} !^metodologieoperativessas\\.it$ [NC]
RewriteRule ^ https://metodologieoperativessas.it%{REQUEST_URI} [R=302,L]
RewriteRule ^metodologieoperative(?:/(.*))?$ /$1 [R=302,L]
<IfModule mod_headers.c>
  <FilesMatch "^(service-worker\\.js|manifest\\.json)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
'''
    (site / ".htaccess").write_text(htaccess)
    hashes[".htaccess"] = hashlib.sha256(htaccess.encode()).hexdigest()
    # Tutti i file indispensabili all'installazione della PWA devono essere presenti.
    sw = (site / "service-worker.js").read_text()
    cache_list = sw.split("const STATIC_CACHE_URLS = [", 1)[1].split("];", 1)[0]
    for url in re.findall(r"'([^']+)'", cache_list):
        local = unquote(urlsplit(url).path).lstrip("/") or "index.html"
        assert (site / local).is_file(), f"Risorsa PWA assente: {url}"
    manifest = json.loads((site / "manifest.json").read_text())
    assert manifest["start_url"] == manifest["scope"] == "/"
    for icon in manifest["icons"]:
        assert (site / icon["src"].lstrip("/")).is_file()
    # Nessuna trasformazione dei dataset o del protocollo di salvataggio.
    for name in ["programmi.json", "materiali-curricolo.json", "materiali.json",
                 "assets/progress.js", "assets/progress-global.js",
                 "assets/progress-dashboard.js", "assets/docente-accesso.js"]:
        assert (site / name).read_bytes() == (ROOT / name).read_bytes(), name
    release = {
        "domain": DOMAIN,
        "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT).decode().strip(),
        "transformed_files": changed,
        "sha256": hashes,
        "checks": ["identificatori HTML conservati", "dataset identici", "progress identico",
                   "PWA cache presente", "icone presenti", "prefissi Supabase conservati"],
        "pending": ["attivazione Aruba", "upload ed estrazione", "HTTPS e redirect Apache",
                    "CORS Supabase", "collaudo online senza scritture studenti",
                    "rientro con i codici esistenti; bozze browser sul vecchio indirizzo"],
    }
    (dest / "release.json").write_text(json.dumps(release, ensure_ascii=False, indent=2) + "\n")
    archive = dest / "metodologieoperativessas-aruba.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zipped:
        for path in sorted(site.rglob("*")):
            if path.is_file():
                zipped.write(path, path.relative_to(site))
    print(json.dumps({"archive": str(archive), "files": len(hashes),
                      "transformed": len(changed), "bytes": archive.stat().st_size,
                      "checks": release["checks"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
