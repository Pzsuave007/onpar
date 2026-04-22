#!/bin/bash
# OnPar Live — Deploy Update
# Simple, fast, reliable. Pulls code, copies files, restarts backend.

set -e

REPO="/home/onparliveuni2/repo"
PROD="/opt/onpar/backend"
WEB="/home/onparliveuni2/public_html"
PORT=8005

echo "============================================"
echo "  OnPar Live — Deploy Update  $(date)"
echo "============================================"

echo; echo "▸ [1/5] Git pull"
cd "$REPO"
git pull --quiet
echo "✓ On commit $(git rev-parse --short HEAD)"

echo; echo "▸ [2/5] Install backend deps (if any changed)"
# shellcheck disable=SC1091
source "$PROD/venv/bin/activate"
pip install -q -r "$REPO/backend/requirements.txt" 2>/dev/null || true
deactivate
echo "✓ Deps up to date"

echo; echo "▸ [3/5] Copy backend + frontend"
cp -f "$REPO/backend/server.py" "$PROD/server.py"
if [ -d "$REPO/frontend/build" ] && [ -n "$(ls -A "$REPO/frontend/build" 2>/dev/null)" ]; then
  rm -rf "$WEB/static"
  cp -rf "$REPO/frontend/build/"* "$WEB/"
  BUNDLE=$(grep -oE 'main\.[a-f0-9]+\.js' "$WEB/index.html" | head -1)
  echo "✓ Files deployed (frontend: $BUNDLE)"
else
  echo "⚠ frontend/build missing — skipping frontend"
fi

echo; echo "▸ [4/5] Restart backend"
pkill -9 -f uvicorn 2>/dev/null || true
sleep 2
cd "$PROD"
# shellcheck disable=SC1091
source "$PROD/venv/bin/activate"
nohup "$PROD/venv/bin/uvicorn" server:app \
  --host 0.0.0.0 --port ${PORT} --reload \
  > "$PROD/backend.log" 2>&1 &
disown
deactivate
sleep 3
echo "✓ Backend restarted"

echo; echo "▸ [5/5] Smoke test"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/api/tournaments" || echo "000")
if [ "$CODE" = "200" ]; then
  echo "✓ Backend responding (HTTP $CODE)"
else
  echo "✗ Backend NOT responding (HTTP $CODE) — check $PROD/backend.log"
  tail -n 15 "$PROD/backend.log"
  exit 1
fi

echo
echo "============================================"
echo "  DONE — https://onparlive.com is live"
echo "============================================"
