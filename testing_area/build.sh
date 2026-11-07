#!/usr/bin/env bash
# Compila as fichas: ./build.sh            (todas)
#                    ./build.sh caminho.tex (só estas)
# O PDF fica ao lado do .tex; os ficheiros auxiliares vão para .build/.
set -euo pipefail
cd "$(dirname "$0")"
export TEXINPUTS="$PWD:"
files=("$@")
[ ${#files[@]} -eq 0 ] && mapfile -t files < <(find basico secundario -name '*.tex' | sort)
fail=0
for f in "${files[@]}"; do
  dir=$(dirname "$f"); name=$(basename "$f" .tex)
  if latexmk -pdf -interaction=nonstopmode -halt-on-error -outdir=".build/$dir" "$f" >/dev/null 2>&1; then
    cp ".build/$dir/$name.pdf" "$dir/$name.pdf"
    echo "ok    $f ($(pdfinfo "$dir/$name.pdf" | awk '/^Pages/{print $2}') pág.)"
  else
    echo "ERRO  $f  (ver .build/$dir/$name.log)"; fail=1
  fi
done
exit $fail
