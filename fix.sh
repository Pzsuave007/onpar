#!/bin/bash
# OnPar Live — Deploy Update (systemd edition)
# Clean 3-step deploy: copy files, let systemd handle the backend restart.
#
# Prerequisite: deploy/setup_systemd.sh has been run ONCE (installs the
# onpar-backend.service file). If you haven't done that yet, this script
# will tell you.

set -e

REPO="/home/onparliveuni2/repo"
PROD="/opt/onpar/backend"
WEB="/home/onparliveuni2/public_html"
PORT=8005

echo "============================================"
echo "  OnPar Live — Deploy Update  $(date)"
echo "============================================"

# Prerequisite: systemd service must be installed.
if ! systemctl list-unit-files | grep -q "^onpar-backend.service"; then
  echo
  echo "✗ onpar-backend systemd service NOT installed yet."
  echo "  First-time setup — run this ONCE (as root):"
  echo "      cd $REPO && git pull && sudo bash deploy/setup_systemd.sh"
  echo "  Then come back and run fix.sh again."
  exit 1
fi

echo; echo "▸ [1/5] Git pull"
cd "$REPO"
git pull --quiet
echo "✓ On commit $(git rev-parse --short HEAD)"

echo; echo "▸ [2/5] Install backend deps (if requirements changed)"
# shellcheck disable=SC1091
source "$PROD/venv/bin/activate"
pip install -q -r "$REPO/backend/requirements.txt" 2>/dev/null || true
deactivate
echo "✓ Deps up to date"

echo; echo "▸ [3/5] Copy backend + frontend"
cp -f "$REPO/backend/server.py" "$PROD/server.py"
NEW_JS_COUNT=$(ls "$REPO/frontend/build/static/js/"*.js 2>/dev/null | wc -l)
if [ -f "$REPO/frontend/build/index.html" ] && [ "$NEW_JS_COUNT" -gt 0 ]; then
  rm -rf "$WEB/static"
  cp -rf "$REPO/frontend/build/"* "$WEB/"
  BUNDLE=$(grep -oE 'main\.[a-f0-9]+\.js' "$WEB/index.html" | head -1)
  echo "✓ Files deployed (frontend: $BUNDLE)"
else
  echo "⚠ frontend/build incomplete — keeping existing frontend"
fi

echo; echo "▸ [4/5] Restart backend via systemd (clean, no zombies)"
# Clear systemd's failure rate-limit counter so a previously broken state
# doesn't block a fresh start. Safe no-op if the service is healthy.
systemctl reset-failed onpar-backend 2>/dev/null || true
# Truncate the Python log so any traceback we dump on failure is only from THIS attempt.
: > /opt/onpar/backend/backend.log 2>/dev/null || true
systemctl restart onpar-backend
sleep 4
if ! systemctl is-active --quiet onpar-backend; then
  echo "✗ onpar-backend failed to restart."
  echo
  echo "------ Python error (from /opt/onpar/backend/backend.log) ------"
  tail -40 /opt/onpar/backend/backend.log 2>/dev/null || echo "(log empty)"
  echo "------ end ------"
  echo
  echo "  Send the lines above to the agent."
  exit 1
fi
echo "✓ Backend restarted (PID: $(systemctl show --property MainPID --value onpar-backend))"

echo; echo "▸ [5/5] Smoke test + verify new code is live"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/api/tournaments")
if [ "$CODE" != "200" ]; then
  echo "✗ Backend not responding (HTTP $CODE). Last 30 log lines:"
  journalctl -u onpar-backend --no-pager -n 30
  exit 1
fi
echo "✓ Backend healthy (HTTP $CODE)"

# Probe recent endpoints — if they 404 we're serving stale code somehow.
FAIL=0
for PATH_CHECK in "/api/profile/clubs" "/api/notifications"; do
  PROBE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}${PATH_CHECK}")
  if [ "$PROBE" = "404" ]; then
    echo "  ✗ $PATH_CHECK returned 404 — stale code!"
    FAIL=1
  else
    echo "  ✓ $PATH_CHECK → HTTP $PROBE"
  fi
done
if [ "$FAIL" = "1" ]; then
  echo "✗ Deploy FAILED — backend started but serves stale code."
  exit 1
fi

echo
echo "============================================"
echo "  DONE — https://onparlive.com is live"
echo "  Frontend: $BUNDLE"
echo "  Backend commit: $(git rev-parse --short HEAD)"
echo "============================================"
echo
echo "  Useful commands:"
echo "    journalctl -u onpar-backend -f      # live logs"
echo "    systemctl status onpar-backend      # check status"
