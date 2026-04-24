#!/bin/bash
# OnPar Live — Force Backend Redeploy
# Use this when fix.sh updates the frontend but the backend keeps running
# the old code (zombie uvicorn / reloader didn't pick up new server.py).
# It kills ALL uvicorn processes, copies the fresh server.py, and restarts.

set -e

REPO="/home/onparliveuni2/repo"
PROD="/opt/onpar/backend"
PORT=8005

echo "============================================"
echo "  OnPar Live — Force Backend Redeploy  $(date)"
echo "============================================"

echo; echo "▸ [1/6] Pull latest code"
cd "$REPO"
git pull --quiet
echo "✓ On commit $(git rev-parse --short HEAD)"

echo; echo "▸ [2/6] Verify repo has the latest endpoints"
if grep -q "unpin_green" "$REPO/backend/server.py"; then
  echo "✓ unpin_green endpoint present in repo"
else
  echo "✗ ERROR: unpin_green NOT in $REPO/backend/server.py"
  echo "  The git pull did not bring the latest changes."
  echo "  Ask the agent to Save to Github again, then retry."
  exit 1
fi

echo; echo "▸ [3/6] Copy server.py to production"
cp -f "$REPO/backend/server.py" "$PROD/server.py"
if grep -q "unpin_green" "$PROD/server.py"; then
  echo "✓ server.py copied with unpin_green"
else
  echo "✗ ERROR: copy failed (permission issue?)"
  ls -la "$PROD/server.py"
  exit 1
fi

echo; echo "▸ [4/6] Kill ALL uvicorn processes (including zombie reloaders)"
for attempt in 1 2 3; do
  pkill -9 -f uvicorn 2>/dev/null || true
  sleep 2
  REMAINING=$(pgrep -f uvicorn | wc -l)
  if [ "$REMAINING" = "0" ]; then
    echo "✓ All uvicorn processes killed (attempt $attempt)"
    break
  fi
  echo "  … $REMAINING uvicorn processes still alive, retrying"
done
# Final check
REMAINING=$(pgrep -f uvicorn | wc -l)
if [ "$REMAINING" != "0" ]; then
  echo "✗ ERROR: $REMAINING uvicorn processes refuse to die"
  ps aux | grep uvicorn | grep -v grep
  echo "  Manually run:  kill -9 <PID>  for each above, then re-run this script."
  exit 1
fi
# Also free the port in case something else is holding it
if command -v fuser >/dev/null 2>&1; then
  fuser -k ${PORT}/tcp 2>/dev/null || true
  sleep 1
fi

echo; echo "▸ [5/6] Start new uvicorn"
cd "$PROD"
# shellcheck disable=SC1091
source "$PROD/venv/bin/activate"
nohup "$PROD/venv/bin/uvicorn" server:app \
  --host 0.0.0.0 --port ${PORT} --reload \
  > "$PROD/backend.log" 2>&1 &
disown
deactivate
sleep 4

NEW_PIDS=$(pgrep -f uvicorn | tr '\n' ' ')
if [ -z "$NEW_PIDS" ]; then
  echo "✗ ERROR: uvicorn failed to start. Last 20 log lines:"
  tail -n 20 "$PROD/backend.log"
  exit 1
fi
echo "✓ uvicorn running (PIDs: $NEW_PIDS)"

echo; echo "▸ [6/6] Verify DELETE endpoint is live"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/api/tournaments")
if [ "$CODE" != "200" ]; then
  echo "✗ Backend not responding (HTTP $CODE). Last 20 log lines:"
  tail -n 20 "$PROD/backend.log"
  exit 1
fi
echo "✓ Backend healthy (HTTP $CODE on /api/tournaments)"

ALLOW=$(curl -s -X OPTIONS "http://127.0.0.1:${PORT}/api/courses/X/holes/1/green-pin" -i 2>/dev/null | grep -i "^allow:" | tr -d '\r')
echo "  $ALLOW"
if echo "$ALLOW" | grep -qi "DELETE"; then
  echo "✓ DELETE endpoint is registered"
else
  echo "✗ DELETE endpoint NOT in running backend. Something is wrong."
  exit 1
fi

echo
echo "============================================"
echo "  DONE — Backend updated. Pin Greens 🗑️ button now works."
echo "============================================"
