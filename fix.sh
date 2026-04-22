#!/bin/bash
# OnPar Live - Deploy Update (hardened)
# Pulls latest code from git, updates backend + frontend, and guarantees a clean restart.
# Must be run from the cPanel shell (as the owner of the deploy folders).

set -u
set -o pipefail

REPO="/home/onparliveuni2/repo"
PROD="/opt/onpar/backend"
WEB="/home/onparliveuni2/public_html"
PORT=8005

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()    { echo -e "${GREEN}✓${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
step()  { echo; echo -e "${YELLOW}▸${NC} $1"; }

echo "============================================"
echo "  OnPar Live — Deploy Update"
echo "  $(date)"
echo "============================================"

#------------------------------------------------------------------
step "[1/6] Git pull"
cd "$REPO" || { fail "Repo dir missing: $REPO"; exit 1; }
git fetch --all --quiet
git reset --hard origin/main --quiet
COMMIT=$(git rev-parse --short HEAD)
ok "Synced to commit $COMMIT"

#------------------------------------------------------------------
step "[2/6] Backend dependencies"
cd "$PROD" || { fail "Prod dir missing: $PROD"; exit 1; }
# shellcheck disable=SC1091
source "$PROD/venv/bin/activate"
pip install -r "$REPO/backend/requirements.txt" --quiet 2>/dev/null
deactivate
ok "Deps up to date"

#------------------------------------------------------------------
step "[3/6] Copy backend files"
cp -f "$REPO/backend/server.py" "$PROD/server.py"
# Verify copy worked by hashing
SRC_HASH=$(sha256sum "$REPO/backend/server.py" | cut -d' ' -f1)
DST_HASH=$(sha256sum "$PROD/server.py" | cut -d' ' -f1)
if [ "$SRC_HASH" != "$DST_HASH" ]; then
  fail "server.py copy mismatch — aborting"; exit 1
fi
ok "server.py synced ($(wc -l < "$PROD/server.py") lines)"

#------------------------------------------------------------------
step "[4/6] Copy pre-built frontend"
if [ ! -d "$REPO/frontend/build" ] || [ -z "$(ls -A "$REPO/frontend/build" 2>/dev/null)" ]; then
  fail "frontend/build is missing or empty — run bash build_prod.sh in Emergent first"; exit 1
fi
rm -rf "$WEB/static/js" "$WEB/static/css" "$WEB/static/media"
cp -rf "$REPO/frontend/build/"* "$WEB/"
chown -R onparliveuni2:onparliveuni2 "$WEB" 2>/dev/null || true
FE_HASH=$(grep -oE 'main\.[a-f0-9]+\.js' "$WEB/index.html" | head -1)
ok "Frontend deployed (bundle: $FE_HASH)"

#------------------------------------------------------------------
step "[5/6] Kill old backend"
# Try graceful then forceful. Match any process related to our server.
PIDS=$(pgrep -f "uvicorn.*server:app" 2>/dev/null || true)
PIDS="$PIDS $(pgrep -f "uvicorn.*--port ${PORT}" 2>/dev/null || true)"
PIDS="$PIDS $(lsof -ti:${PORT} 2>/dev/null || fuser ${PORT}/tcp 2>/dev/null || true)"
PIDS=$(echo "$PIDS" | tr ' ' '\n' | sort -u | grep -E '^[0-9]+$' || true)

if [ -n "$PIDS" ]; then
  echo "$PIDS" | while read -r pid; do
    [ -n "$pid" ] && kill -TERM "$pid" 2>/dev/null && echo "  TERM → $pid"
  done
  sleep 3
  # Anyone still alive?
  STILL=$(echo "$PIDS" | while read -r pid; do [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && echo "$pid"; done)
  if [ -n "$STILL" ]; then
    echo "$STILL" | while read -r pid; do
      [ -n "$pid" ] && kill -KILL "$pid" 2>/dev/null && echo "  KILL → $pid"
    done
    sleep 2
  fi
else
  warn "No running backend process found (fresh start)"
fi

# Final verification: port must be free
if lsof -ti:${PORT} >/dev/null 2>&1 || fuser ${PORT}/tcp >/dev/null 2>&1; then
  fail "Port ${PORT} still occupied after kill — manual intervention needed"
  lsof -ti:${PORT} 2>/dev/null | xargs -r ps -fp
  exit 1
fi
ok "Port ${PORT} is free"

#------------------------------------------------------------------
step "[6/6] Start backend"
cd "$PROD"
# shellcheck disable=SC1091
source "$PROD/venv/bin/activate"
# No --reload in production (it fights with process management)
nohup "$PROD/venv/bin/uvicorn" server:app \
  --host 0.0.0.0 --port ${PORT} \
  > "$PROD/backend.log" 2>&1 &
NEW_PID=$!
disown
deactivate
sleep 4

# Verify: process alive AND port bound
if ! kill -0 "$NEW_PID" 2>/dev/null; then
  fail "Backend process died immediately — check $PROD/backend.log"
  tail -n 30 "$PROD/backend.log"
  exit 1
fi

# Smoke test: hit an endpoint
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/api/tournaments" 2>/dev/null || echo "000")
if [ "$HEALTH" != "200" ]; then
  fail "Backend not responding on /api/tournaments (HTTP $HEALTH)"
  tail -n 20 "$PROD/backend.log"
  exit 1
fi
ok "Backend live (PID $NEW_PID, HTTP $HEALTH on :$PORT)"

# Check that the NEW code is actually running by probing an endpoint that only exists in the new build.
# /api/users/search returns 401 (auth required) when it exists, 404 when it doesn't.
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/api/users/search?q=x" 2>/dev/null || echo "000")
if [ "$CODE" = "404" ]; then
  warn "New endpoint /api/users/search not found in running backend. The process might be cached by a parent supervisor."
  warn "If this persists, check for passenger/systemd: \`systemctl list-units | grep onpar\` or \`grep PassengerAppRoot ~/.htaccess\`"
elif [ "$CODE" = "401" ] || [ "$CODE" = "403" ]; then
  ok "New endpoints detected (auth-gated)"
else
  warn "Unexpected status on /api/users/search: $CODE"
fi

echo
echo "============================================"
echo -e "  ${GREEN}DONE!${NC} Deployed commit $COMMIT"
echo "  Site: https://onparlive.com"
echo "  Backend log: $PROD/backend.log"
echo "============================================"
