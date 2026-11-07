#!/usr/bin/env bash
# Builds dist/htdocs (what goes into AeonFree's /htdocs) and dist/solvestuff-htdocs.zip.
#   hosting/build.sh            code only (safe to re-deploy: never touches live data)
#   WITH_DATA=1 hosting/build.sh  also includes storage/ (sheets, PDFs, students, APK) — first deploy only
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
[ -f .env ] && set -a && . ./.env && set +a
: "${ADMIN_PASSWORD:?set ADMIN_PASSWORD in .env}"

out=dist/htdocs
rm -rf dist && mkdir -p "$out/api" "$out/storage"
cp -r public/. "$out/"
# Cache-busting: stamp every CSS/JS URL with this build's version so browsers (and the host's
# cache) fetch the new files after each deploy instead of reusing old ones.
python3 -I - "$out" "$(find public -type f -print0 | sort -z | xargs -0 sha1sum | sha1sum | cut -c1-10)" <<'PY'
import sys, re, pathlib
out, v = pathlib.Path(sys.argv[1]), sys.argv[2]
idx = out / "index.html"
idx.write_text(re.sub(r'((?:href|src)="(?:css|js)/[\w.-]+\.(?:css|js))"', rf'\1?v={v}"', idx.read_text()))
for js in (out / "js").glob("*.js"):
    js.write_text(re.sub(r"""(from\s+['"]\./[\w.-]+\.js)(['"])""", rf"\1?v={v}\2", js.read_text()))
PY
cp hosting/.htaccess "$out/"
cp hosting/api/index.php "$out/api/"
cp hosting/storage/.htaccess "$out/storage/"
cp data/curriculum.seed.json Matematica_Sequencia_de_Ensino.md "$out/storage/"
python3 -I - "$out/api/config.php" "$ADMIN_PASSWORD" <<'PY'
import sys, json
path, pw = sys.argv[1], sys.argv[2]
esc = pw.replace("\\", "\\\\").replace("'", "\\'")
open(path, "w").write(f"<?php\nreturn ['admin_password' => '{esc}'];\n")
PY

if [ "${WITH_DATA:-}" = 1 ]; then
  for f in curriculum.json sheets.json students.json app.json; do
    [ -f "storage/$f" ] && cp "storage/$f" "$out/storage/"
  done
  [ -d storage/uploads ] && cp -r storage/uploads "$out/storage/"
  [ -d storage/app ] && cp -r storage/app "$out/storage/"
  echo "Included storage/ data (first deploy)."
fi

python3 -I - "$out" dist/solvestuff-htdocs.zip <<'PY'
import sys, os, zipfile
src, dst = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
    for d, _, files in os.walk(src):
        for f in files:
            p = os.path.join(d, f)
            z.write(p, os.path.relpath(p, src))
PY
echo "Built $out and dist/solvestuff-htdocs.zip ($(du -h dist/solvestuff-htdocs.zip | cut -f1))"
