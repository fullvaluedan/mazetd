#!/usr/bin/env bash
# Serve Mazecore TD over HTTP (ES modules can't be opened as file://).
# Prefers python3 (usually pre-installed); falls back to npx serve.
set -e
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  echo "Serving on http://localhost:8000  (Ctrl+C to stop)"
  python3 -m http.server 8000
elif command -v python >/dev/null 2>&1; then
  echo "Serving on http://localhost:8000  (Ctrl+C to stop)"
  python -m http.server 8000
elif command -v npx >/dev/null 2>&1; then
  echo "Serving with npx serve  (Ctrl+C to stop)"
  npx --yes serve -l 8000 .
else
  echo "Need python3 or npx to serve. Install one, then re-run."
  exit 1
fi
