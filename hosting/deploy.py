#!/usr/bin/env python3
"""Deploys solvestuff to AeonFree over FTP: code AND data, in one go.

Code (dist/htdocs, built by hosting/build.sh): uploaded when it changed since the last deploy.

Data (storage/: curriculum, sheets, students, app release, PDFs, APK) is synced both ways
using a snapshot of what each file looked like at the last deploy (.deploy-state/):
  - changed only locally  (you / another Claude edited it)  -> uploaded
  - changed only live     (edited through the site's admin) -> downloaded into storage/
  - changed on both sides -> stops, nothing overwritten. Re-run with
        FORCE=local make deploy   (local wins)   or   FORCE=live make deploy   (live wins)
Every overwritten file is backed up to backups/<timestamp>/ first.

Credentials come from .env: FTP_USER, FTP_PASS (FTP_HOST defaults to ftpupload.net).
"""
import ftplib, hashlib, io, json, os, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist" / "htdocs"
STORAGE = ROOT / "storage"
STATE = ROOT / ".deploy-state"
REMOTE = os.environ.get("FTP_ROOT", "/htdocs").rstrip("/")
DATA_FILES = ["curriculum.json", "sheets.json", "students.json", "app.json"]
BLOB_DIRS = ["uploads", "app"]  # PDFs and the APK: never edited in place, only added


def load_env():
    env = dict(os.environ)
    f = ROOT / ".env"
    if f.exists():
        for line in f.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env.setdefault(k.strip(), v.strip())
    return env


def sha(b):
    return hashlib.sha256(b).hexdigest() if b is not None else None


class Remote:
    def __init__(self, host, user, pw, port=21):
        self.ftp = ftplib.FTP(timeout=60)
        self.ftp.connect(host, port)
        self.ftp.login(user, pw)
        self.made = set()

    def get(self, path):
        buf = io.BytesIO()
        try:
            self.ftp.retrbinary(f"RETR {REMOTE}/{path}", buf.write)
        except ftplib.error_perm:
            return None
        return buf.getvalue()

    def put(self, path, data):
        parts = path.split("/")[:-1]
        for i in range(1, len(parts) + 1):
            d = f"{REMOTE}/" + "/".join(parts[:i])
            if d not in self.made:
                try:
                    self.ftp.mkd(d)
                except ftplib.error_perm:
                    pass
                self.made.add(d)
        tmp = f"{REMOTE}/{path}.uploading"
        self.ftp.storbinary(f"STOR {tmp}", io.BytesIO(data))
        self.ftp.rename(tmp, f"{REMOTE}/{path}")  # atomic swap: the site never sees half a file

    def ls(self, d):
        try:
            return {Path(n).name for n in self.ftp.nlst(f"{REMOTE}/{d}")} - {".", ".."}
        except ftplib.error_perm:
            return set()


def main():
    env = load_env()
    user, pw = env.get("FTP_USER"), env.get("FTP_PASS")
    if not user or not pw:
        sys.exit("Set FTP_USER and FTP_PASS in .env")
    if not DIST.is_dir():
        sys.exit("Run hosting/build.sh first")
    force = env.get("FORCE", "").lower()
    if force not in ("", "local", "live"):
        sys.exit("FORCE must be 'local' or 'live'")

    STATE.mkdir(exist_ok=True)
    manifest_file = STATE / "code.json"
    manifest = json.loads(manifest_file.read_text()) if manifest_file.exists() else {}
    snap_dir = STATE / "data"
    snap_dir.mkdir(exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup = ROOT / "backups" / stamp

    def back_up(name, data):
        if data is None:
            return
        p = backup / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    r = Remote(env.get("FTP_HOST", "ftpupload.net"), user, pw, int(env.get("FTP_PORT", 21)))

    # ---------- data first: decide everything before writing anything ----------
    plan, conflicts = [], []
    for name in DATA_FILES:
        lp, sp = STORAGE / name, snap_dir / name
        local = lp.read_bytes() if lp.exists() else None
        live = r.get(f"storage/{name}")
        snap = sp.read_bytes() if sp.exists() else None
        L, R, S = sha(local), sha(live), sha(snap)
        if L == R:
            action = "same"
        elif snap is None and live is None:
            action = "push"
        elif snap is None and local is None:
            action = "pull"
        elif R == S:
            action = "push"
        elif L == S:
            action = "pull"
        else:
            action = "conflict"
        if action == "conflict" and force:
            action = "push" if force == "local" else "pull"
        if action == "conflict":
            conflicts.append(name)
        plan.append((name, action, local, live))

    if conflicts:
        print("✗ Changed both locally AND on the live site since the last deploy:")
        for c in conflicts:
            print(f"    storage/{c}")
        print("  Nothing was uploaded. Pick which copy wins and re-run:")
        print("    FORCE=local make deploy   # keep your local version, overwrite the site")
        print("    FORCE=live make deploy    # keep the site's version, overwrite local")
        sys.exit(1)

    # PDFs / APK: copy whatever one side has and the other doesn't. app.json decides which APK is current.
    app_action = next(a for n, a, _, _ in plan if n == "app.json")
    for d in BLOB_DIRS:
        ld = STORAGE / d
        local_names = {p.name for p in ld.iterdir() if p.is_file()} if ld.is_dir() else set()
        live_names = r.ls(f"storage/{d}")
        for n in sorted(local_names - live_names):
            r.put(f"storage/{d}/{n}", (ld / n).read_bytes())
            print(f"  ↑ storage/{d}/{n}")
        for n in sorted(live_names - local_names):
            data = r.get(f"storage/{d}/{n}")
            if data is not None:
                ld.mkdir(parents=True, exist_ok=True)
                (ld / n).write_bytes(data)
                print(f"  ↓ storage/{d}/{n}")
    apk = "app/solvestuff.apk"
    if app_action == "push" and (STORAGE / apk).exists():
        r.put(f"storage/{apk}", (STORAGE / apk).read_bytes())
        print(f"  ↑ storage/{apk}")
    elif app_action == "pull":
        data = r.get(f"storage/{apk}")
        if data is not None:
            back_up(f"local/{apk}", (STORAGE / apk).read_bytes() if (STORAGE / apk).exists() else None)
            (STORAGE / apk).parent.mkdir(parents=True, exist_ok=True)
            (STORAGE / apk).write_bytes(data)
            print(f"  ↓ storage/{apk}")

    for name, action, local, live in plan:
        if action == "push":
            back_up(f"live/{name}", live)
            r.put(f"storage/{name}", local)
            print(f"  ↑ storage/{name}  (local changes → site)")
        elif action == "pull":
            back_up(f"local/{name}", local)
            STORAGE.mkdir(exist_ok=True)
            (STORAGE / name).write_bytes(live)
            print(f"  ↓ storage/{name}  (site changes → local)")
        final = (STORAGE / name).read_bytes() if (STORAGE / name).exists() else None
        if final is not None:
            (snap_dir / name).write_bytes(final)

    # ---------- code ----------
    new_manifest, changed = {}, 0
    for p in sorted(DIST.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(DIST).as_posix()
        data = p.read_bytes()
        h = sha(data)
        new_manifest[rel] = h
        if manifest.get(rel) != h:
            r.put(rel, data)
            changed += 1
            print(f"  ↑ {rel}")
        manifest_file.write_text(json.dumps({**manifest, **new_manifest}, indent=1))
    manifest_file.write_text(json.dumps(new_manifest, indent=1))
    r.ftp.quit()

    print(f"✓ Deployed ({changed} code file(s) updated). Data in sync. https://solvestuff.zya.me")
    if backup.exists():
        print(f"  Overwritten versions backed up in {backup.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
