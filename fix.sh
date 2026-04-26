#!/bin/bash
# OnPar Live — Deploy Update (systemd edition, all-in-one).
#
# Daily flow on the cPanel server:
#     cd /home/onparliveuni2/repo && git pull && bash fix.sh
#
# What this script does, in order:
#   [1/6] Git pull
#   [2/6] Install backend deps if requirements.txt changed
#   [3/6] Copy backend/server.py + frontend/build to their prod paths
#   [4/6] Kill any ORPHAN /opt/onpar/ uvicorn (does NOT touch other apps)
#   [5/6] Reset systemd failure counter + restart onpar-backend, dump
#         the real Python traceback from backend.log if it fails to start
#   [6/6] Smoke test + verify new code is live (anti-stale guard)
#
# Notes:
#   - First-time only:  sudo bash deploy/setup_systemd.sh
#   - Other apps on this server (espresso-beso, gradeprophet, etc.) are
#     NEVER touched. The kill step filters explicitly by /opt/onpar/.
#   - If something fails, the script exits non-zero and prints exactly
#     where it broke. Send the output to the agent.

set -e

REPO="/home/onparliveuni2/repo"
PROD="/opt/onpar/backend"
WEB="/home/onparliveuni2/public_html"
LOGFILE="$PROD/backend.log"
PORT=8005

bar()     { echo "============================================"; }
section() { echo; echo "▸ $1"; }

bar
echo "  OnPar Live — Deploy Update  $(date)"
bar

# Prerequisite: systemd service must be installed.
if ! systemctl list-unit-files | grep -q "^onpar-backend.service"; then
  echo
  echo "✗ onpar-backend systemd service NOT installed yet."
  echo "  First-time setup — run this ONCE (as root):"
  echo "      cd $REPO && git pull && sudo bash deploy/setup_systemd.sh"
  echo "  Then come back and run fix.sh again."
  exit 1
fi

# ----------------------------------------------------------------- [1/6] ---
section "[1/6] Git pull"
cd "$REPO"
git pull --quiet
echo "✓ On commit $(git rev-parse --short HEAD)"

# ----------------------------------------------------------------- [2/6] ---
section "[2/6] Install backend deps (if requirements changed)"
# shellcheck disable=SC1091
source "$PROD/venv/bin/activate"
pip install -q -r "$REPO/backend/requirements.txt" 2>/dev/null || true
deactivate
echo "✓ Deps up to date"

# ----------------------------------------------------------------- [3/6] ---
section "[3/6] Copy backend + frontend"
cp -f "$REPO/backend/server.py" "$PROD/server.py"

# Frontend guard: only deploy if build/ has BOTH index.html and at least 1 JS bundle.
# This prevents a half-baked push from blanking the site.
NEW_JS_COUNT=$(ls "$REPO/frontend/build/static/js/"*.js 2>/dev/null | wc -l)
if [ -f "$REPO/frontend/build/index.html" ] && [ "$NEW_JS_COUNT" -gt 0 ]; then
  rm -rf "$WEB/static"
  cp -rf "$REPO/frontend/build/"* "$WEB/"
  BUNDLE=$(grep -oE 'main\.[a-f0-9]+\.js' "$WEB/index.html" | head -1)
  echo "✓ Files deployed (frontend: $BUNDLE)"
else
  echo "⚠ frontend/build incomplete — keeping existing frontend"
  BUNDLE="(unchanged)"
fi

# ----------------------------------------------------------------- [4/6] ---
section "[4/6] Kill any orphan OnPar uvicorn (safe — only /opt/onpar/)"
# Other apps (espresso-beso, gradeprophet, etc.) are NEVER touched: we filter
# by reading /proc/<pid>/cmdline and only killing PIDs whose command line
# references /opt/onpar/.
ORPHANS=()
for pid in $(pgrep -f "uvicorn.*server:app" 2>/dev/null || true); do
  if grep -q "/opt/onpar/" "/proc/$pid/cmdline" 2>/dev/null; then
    ORPHANS+=("$pid")
  fi
done
if [ ${#ORPHANS[@]} -eq 0 ]; then
  echo "✓ No OnPar orphans"
else
  echo "  killing OnPar orphans: ${ORPHANS[*]}"
  for pid in "${ORPHANS[@]}"; do kill -9 "$pid" 2>/dev/null || true; done
  sleep 1
  echo "✓ Cleared"
fi

# ----------------------------------------------------------------- [5/6] ---
section "[5/6] Restart backend via systemd"
# Reset systemd's failure rate-limit counter so a previously broken state
# doesn't block a fresh start. No-op if the service is healthy.
systemctl reset-failed onpar-backend 2>/dev/null || true
# Truncate the Python log so any traceback we dump on failure is only from THIS attempt.
: > "$LOGFILE" 2>/dev/null || true
systemctl restart onpar-backend
sleep 4
if ! systemctl is-active --quiet onpar-backend; then
  echo "✗ onpar-backend failed to restart."
  echo
  echo "------ Python error (from $LOGFILE) ------"
  tail -50 "$LOGFILE" 2>/dev/null || echo "(log empty)"
  echo "------ end ------"
  echo
  echo "  Send the lines above to the agent so they can fix the root cause."
  exit 1
fi
echo "✓ Backend restarted (PID: $(systemctl show --property MainPID --value onpar-backend))"

# ----------------------------------------------------------------- [6/6] ---
section "[6/6] Smoke test + verify new code is live"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/api/tournaments")
if [ "$CODE" != "200" ]; then
  echo "✗ /api/tournaments → HTTP $CODE. Last 30 log lines:"
  tail -30 "$LOGFILE" 2>/dev/null
  exit 1
fi
echo "✓ /api/tournaments → HTTP $CODE"

# Probe recent endpoints — if they 404 we're serving stale code somehow.
FAIL=0
for PATH_CHECK in "/api/profile/clubs" "/api/notifications" "/api/matches/active"; do
  PROBE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}${PATH_CHECK}")
  if [ "$PROBE" = "404" ]; then
    echo "  ✗ $PATH_CHECK → 404 — stale code!"
    FAIL=1
  else
    echo "  ✓ $PATH_CHECK → HTTP $PROBE"
  fi
done
if [ "$FAIL" = "1" ]; then
  echo "✗ Deploy FAILED — backend started but is serving stale code."
  exit 1
fi

echo
bar
echo "  DONE — https://onparlive.com is live"
echo "  Frontend: $BUNDLE"
echo "  Backend commit: $(git rev-parse --short HEAD)"
bar
echo
echo "  Useful commands:"
echo "    systemctl status onpar-backend       # service status"
echo "    journalctl -u onpar-backend -f       # systemd messages live"
echo "    tail -f $LOGFILE   # live Python stdout/stderr"
