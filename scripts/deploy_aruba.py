#!/usr/bin/env python3
"""Pubblica l'esportazione Aruba con FTPS verificato, senza cancellare file remoti."""
import argparse
from ftplib import FTP_TLS, error_perm
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path, PurePosixPath
import ssl

# Nome presente nel certificato del server indicato dall'alias ftp del dominio.
HOST = "ftplnx02.aruba.it"
USER = "4711317@aruba.it"
WEBROOT = "/www.metodologieoperativessas.it"
STATE = ".aruba-deploy.json"
BASELINE = Path(__file__).with_name("aruba-baseline.json")


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def read_remote(ftp, name):
    data = BytesIO()
    ftp.retrbinary("RETR " + name, data.write)
    return data.getvalue()


def deploy(ftp, release_dir):
    release = json.loads((release_dir / "release.json").read_text())
    hashes = release["sha256"]
    # Prima di qualsiasi scrittura, controlla percorsi e contenuti esportati.
    for name, expected in hashes.items():
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts or "\r" in name or "\n" in name:
            raise ValueError("Percorso non valido nell'esportazione")
        if name == STATE or digest((release_dir / "site" / name).read_bytes()) != expected:
            raise ValueError("Esportazione non integra: " + name)
    ftp.cwd(WEBROOT)
    try:
        previous = json.loads(read_remote(ftp, STATE))
    except error_perm as exc:
        if not str(exc).startswith("550"):
            raise
        previous = json.loads(BASELINE.read_text())
    # Evita di pubblicare sopra una home diversa dall'ultima versione nota.
    remote_home = digest(read_remote(ftp, "index.html"))
    if remote_home not in {previous["sha256"]["index.html"], hashes["index.html"]}:
        raise RuntimeError("Home remota modificata: verificare prima di pubblicare")
    changed = [name for name, value in hashes.items()
               if previous["sha256"].get(name) != value]
    # Gli asset precedono le pagine che li usano; index.html viene caricato per ultimo.
    changed.sort(key=lambda name: (name == "index.html", name.endswith(".html"), name))
    for name in changed:
        path = PurePosixPath(name)
        parent = PurePosixPath()
        for part in path.parts[:-1]:
            parent /= part
            try:
                ftp.mkd(str(parent))
            except error_perm as exc:
                if not str(exc).startswith("550"):
                    raise
        raw = (release_dir / "site" / name).read_bytes()
        ftp.storbinary("STOR " + name, BytesIO(raw))
        if digest(read_remote(ftp, name)) != hashes[name]:
            raise RuntimeError("Verifica del caricamento fallita: " + name)
        print("Verificato:", name, flush=True)
    # Nessun DELE/RMD: conserva file preesistenti e materiali archiviati.
    state = json.dumps({"source_commit": release["source_commit"], "sha256": hashes},
                       ensure_ascii=False, sort_keys=True).encode()
    ftp.storbinary("STOR " + STATE, BytesIO(state))
    if read_remote(ftp, STATE) != state:
        raise RuntimeError("Verifica dello stato di pubblicazione fallita")
    print(f"Pubblicazione conclusa: {len(changed)} file modificati, nessuna cancellazione.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", type=Path, required=True)
    args = parser.parse_args()
    password = os.environ.get("ARUBA_FTP_PASSWORD")
    if not password:
        parser.error("Manca il repository secret ARUBA_FTP_PASSWORD")
    with FTP_TLS(context=ssl.create_default_context(), timeout=60) as ftp:
        ftp.connect(HOST, 21)
        ftp.login(USER, password)
        ftp.prot_p()
        deploy(ftp, args.release)


if __name__ == "__main__":
    main()
