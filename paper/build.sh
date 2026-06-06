#!/usr/bin/env bash
# Reproduce paper PDFs from a clean checkout.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Installing npm dependencies"
npm install

echo "==> Building webapp"
npm run build

echo "==> Capturing figures (Playwright)"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$ROOT/.playwright-browsers}"
if [[ ! -d "$PLAYWRIGHT_BROWSERS_PATH/chromium-"* ]] 2>/dev/null; then
  npx playwright install chromium
fi
npm run figures || echo "Warning: figure capture failed; using existing paper/figures/"

PDFLATEX=""
if command -v pdflatex >/dev/null 2>&1; then
  PDFLATEX=pdflatex
elif command -v tectonic >/dev/null 2>&1; then
  PDFLATEX=tectonic
else
  echo "Error: install pdflatex (TeX Live) or tectonic to build PDFs." >&2
  exit 1
fi

build_tex() {
  local tex="$1"
  if [[ "$PDFLATEX" == "tectonic" ]]; then
    (cd paper && tectonic "$tex" --keep-logs --keep-intermediates)
    (cd paper && tectonic "$tex" --keep-logs --keep-intermediates)
  else
    (cd paper && pdflatex -interaction=nonstopmode "$tex" >/dev/null)
    (cd paper && pdflatex -interaction=nonstopmode "$tex" >/dev/null)
  fi
}

echo "==> Building PRL PDF ($PDFLATEX)"
build_tex levitron_lab_prl.tex

echo "==> Building AJP PDF ($PDFLATEX)"
build_tex levitron_lab_ajp.tex

echo "Done: paper/levitron_lab_prl.pdf paper/levitron_lab_ajp.pdf"
