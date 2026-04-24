#!/bin/bash
# OnPar Live — Deploy Update (robust)
# Pulls code, copies pre-built frontend, updates backend, and guarantees the
# new uvicorn process is actually the one serving on :8005 (no stale zombies).

set -e

REPO="/home/onparliveuni2/repo"
PROD="/opt/onpar/backend"
WEB="/home/onparliveuni2/public_html"
PORT=8005

echo "============================================"
echo "  OnPar Live — Deploy Update  $(date)"
echo "============================================"

echo; echo "▸ [1/7] Git pull"
cd "$REPO"
git pull --quiet
echo "✓ On commit $(git rev-parse --short HEAD)"

echo; echo "▸ [2/7] Install backend deps"
# shellcheck disable=SC1091
source "$PROD/venv/bin/activate"
pip install -q -r "$REPO/backend/requirements.txt" 2>/dev/null || true
deactivate
echo "✓ Deps up to date"

echo; echo "▸ [3/7] Copy backend + frontend"
cp -f "$REPO/backend/server.py" "$PROD/server.py"
NEW_JS_COUNT=$(ls "$REPO/frontend/build/static/js/"*.js 2>/dev/null | wc -l)
if [ -f "$REPO/frontend/build/index.html" ] && [ "$NEW_JS_COUNT" -gt 0 ]; then
  rm -rf "$WEB/static"
  cp -rf "$REPO/frontend/build/"* "$WEB/"
  BUNDLE=$(grep -oE 'main\.[a-f0-9]+\.js' "$WEB/index.html" | head -1)
  echo "✓ Files deployed (frontend: $BUNDLE)"
else
  echo "⚠ frontend/build incomplete (index.html=$(test -f "$REPO/frontend/build/index.html" && echo yes || echo no), js files=$NEW_JS_COUNT) — keeping existing frontend"
fi

echo; echo "▸ [4/7] Kill ALL uvicorn processes (including --reload parents, workers, orphans)"
# Three passes: uvicorn by name, then anything bound to our port.
for attempt in 1 2 3 4; do
  pkill -9 -f "uvicorn.*server:app" 2>/dev/null || true
  pkill -9 -f "uvicorn" 2>/dev/null || true
  sleep 2
  # Also kill whatever is holding our port (in case it's not named uvicorn)
  if command -v fuser >/dev/null 2>&1; then
    fuser -k ${PORT}/tcp 2>/dev/null || true
    sleep 1
  elif command -v lsof >/dev/null 2>&1; then
    PID_ON_PORT=$(lsof -ti:${PORT} 2>/dev/null || true)
    if [ -n "$PID_ON_PORT" ]; then
      kill -9 $PID_ON_PORT 2>/dev/null || true
      sleep 1
    fi
  fi
  REMAINING=$(pgrep -f uvicorn | wc -l)
  PORT_FREE=1
  if command -v lsof >/dev/null 2>&1 && lsof -i:${PORT} >/dev/null 2>&1; then
    PORT_FREE=0
  fi
  if [ "$REMAINING" = "0" ] && [ "$PORT_FREE" = "1" ]; then
    echo "✓ All uvicorn processes gone and port $PORT is free (attempt $attempt)"
    break
  fi
  echo "  … attempt $attempt: $REMAINING uvicorn processes, port free=$PORT_FREE — retrying"
done

# Final check
REMAINING=$(pgrep -f uvicorn | wc -l)
if [ "$REMAINING" != "0" ]; then
  echo "✗ ERROR: $REMAINING uvicorn processes refuse to die:"
  ps -ef | grep uvicorn | grep -v grep
  echo "  Manually run:  kill -9 <PID>  for each, then re-run this script."
  exit 1
fi

echo; echo "▸ [5/7] Start new uvicorn (NO --reload so no zombie parents)"
cd "$PROD"
# shellcheck disable=SC1091
source "$PROD/venv/bin/activate"
# Note: --reload removed. Reload spawns a parent+child pair that confuses
# pkill and can resurrect workers running old cached code. For production
# we restart manually via this script anyway.
nohup "$PROD/venv/bin/uvicorn" server:app \
  --host 0.0.0.0 --port ${PORT} \
  > "$PROD/backend.log" 2>&1 &
disown
deactivate
sleep 4

NEW_PIDS=$(pgrep -f uvicorn | tr '\n' ' ')
if [ -z "$NEW_PIDS" ]; then
  echo "✗ ERROR: uvicorn failed to start. Last 30 log lines:"
  tail -n 30 "$PROD/backend.log"
  exit 1
fi
echo "✓ uvicorn running (PIDs: $NEW_PIDS)"

echo; echo "▸ [6/7] Smoke test"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/api/tournaments")
if [ "$CODE" != "200" ]; then
  echo "✗ Backend NOT responding (HTTP $CODE). Last 30 log lines:"
  tail -n 30 "$PROD/backend.log"
  exit 1
fi
echo "✓ Backend healthy (HTTP $CODE)"

echo; echo "▸ [7/7] Verify latest endpoints are live (not stale code)"
# Probe unauthenticated — if endpoint exists we get 401, if missing we get 404.
# We check a couple of recent additions so future deploys don't silently serve old code.
FAIL=0
for PATH_CHECK in "/api/profile/clubs" "/api/notifications"; do
  PROBE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}${PATH_CHECK}")
  if [ "$PROBE" = "404" ]; then
    echo "  ✗ $PATH_CHECK returned 404 — running backend is missing this endpoint (stale code!)"
    FAIL=1
  else
    echo "  ✓ $PATH_CHECK → HTTP $PROBE (endpoint registered)"
  fi
done
if [ "$FAIL" = "1" ]; then
  echo "✗ Deploy FAILED — backend started but is serving stale code."
  echo "  Try running the script again, or check: ps -ef | grep uvicorn"
  exit 1
fi

echo
echo "============================================"
echo "  DONE — https://onparlive.com is live"
echo "  Frontend: $BUNDLE"
echo "  Backend commit: $(cd "$REPO" && git rev-parse --short HEAD)"
echo "============================================"
