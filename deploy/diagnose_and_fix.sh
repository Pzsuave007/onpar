#!/bin/bash
# OnPar Live — Diagnose and Fix backend not starting.
# Run this on the cPanel server when `bash fix.sh` complains that
# `onpar-backend failed to restart`.
#
#   cd /home/onparliveuni2/repo
#   git pull
#   sudo bash deploy/diagnose_and_fix.sh
#
# This script will:
#   1. Show what processes are holding the backend port (8005)
#   2. Show the REAL Python error (import-time crash) if any
#   3. Kill any orphan uvicorn process not owned by systemd
#   4. Restart the systemd service
#   5. Verify the backend is responding on port 8005

set +e   # don't abort on first non-zero — we want the full diagnostic

PROD="/opt/onpar/backend"
PORT=8005

if [ "$EUID" -ne 0 ]; then
  echo "✗ Please run as root (sudo bash deploy/diagnose_and_fix.sh)"
  exit 1
fi

bar() { echo "============================================"; }
section() { echo; bar; echo "  $1"; bar; }

section "OnPar Live — Backend Diagnostic & Fix"
echo "  $(date)"

# ---------------------------------------------------------------- DIAGNOSE ---
section "STEP 1 — Check for orphan uvicorn processes (not via systemd)"
ALL_UVICORN=$(ps -eo pid,user,cmd | grep -i uvicorn | grep -v grep)
if [ -z "$ALL_UVICORN" ]; then
  echo "  ✓ No uvicorn processes running."
else
  echo "$ALL_UVICORN"
fi

section "STEP 2 — Who owns port $PORT?"
PORT_INFO=$(ss -tlnp 2>/dev/null | grep ":$PORT" || true)
if [ -z "$PORT_INFO" ]; then
  echo "  ✓ Port $PORT is free."
else
  echo "$PORT_INFO"
fi

section "STEP 3 — Try importing server.py inside the venv"
echo "  (this prints the EXACT Python error if there is one)"
echo
if [ -d "$PROD/venv" ] && [ -f "$PROD/server.py" ]; then
  cd "$PROD"
  # shellcheck disable=SC1091
  source venv/bin/activate
  IMPORT_OUT=$(python -c "import server" 2>&1)
  IMPORT_RC=$?
  deactivate
  if [ "$IMPORT_RC" = "0" ]; then
    echo "  ✓ server.py imports cleanly. (No Python crash on startup.)"
  else
    echo "  ✗ server.py FAILED to import:"
    echo
    echo "$IMPORT_OUT" | tail -30
    echo
    echo "  → Send this output to the agent so they can fix it."
  fi
else
  echo "  ✗ /opt/onpar/backend missing — run setup_systemd.sh once first."
  exit 1
fi

# -------------------------------------------------------------- KILL ORPHANS ---
section "STEP 4 — Kill any orphan uvicorn (releases port $PORT)"
# This kills uvicorn processes whose parent is NOT the systemd service.
# `systemctl stop` first to drain the legitimate one cleanly.
systemctl stop onpar-backend 2>/dev/null || true
sleep 1
# Anything still alive after `stop` is an orphan — kill it hard.
ORPHANS=$(pgrep -f "uvicorn.*server:app" 2>/dev/null || true)
if [ -n "$ORPHANS" ]; then
  echo "  Orphans found, killing: $ORPHANS"
  echo "$ORPHANS" | xargs -r kill -9 2>/dev/null || true
  sleep 2
  STILL=$(pgrep -f "uvicorn.*server:app" 2>/dev/null || true)
  if [ -n "$STILL" ]; then
    echo "  ✗ Some uvicorn processes still alive after SIGKILL: $STILL"
  else
    echo "  ✓ Orphans cleared."
  fi
else
  echo "  ✓ No orphans."
fi

# -------------------------------------------------------------- RESTART ---
section "STEP 5 — Restart onpar-backend via systemd"
# Reset the failure counter so systemd tries again even if it's hit the rate limit.
systemctl reset-failed onpar-backend 2>/dev/null || true
systemctl restart onpar-backend
sleep 4

if systemctl is-active --quiet onpar-backend; then
  echo "  ✓ onpar-backend is ACTIVE (PID: $(systemctl show --property MainPID --value onpar-backend))"
else
  echo "  ✗ onpar-backend STILL not active. Last 40 log lines:"
  echo
  journalctl -u onpar-backend --no-pager -n 40
  exit 1
fi

# -------------------------------------------------------------- HEALTH CHECK ---
section "STEP 6 — HTTP smoke test"
sleep 1
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/api/tournaments")
if [ "$CODE" = "200" ]; then
  echo "  ✓ /api/tournaments → HTTP $CODE"
else
  echo "  ✗ /api/tournaments → HTTP $CODE  (backend up but not responding)"
fi

# Probe a brand-new endpoint to confirm new code is live (not stale)
NEW_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1:$PORT/api/matches" \
  -H "Content-Type: application/json" -d '{}' 2>/dev/null)
# 401/403 = endpoint exists (auth required). 404 = stale code, this endpoint not deployed.
case "$NEW_CODE" in
  200|400|401|403|422) echo "  ✓ /api/matches reachable (HTTP $NEW_CODE) — new Match code is LIVE" ;;
  404)                 echo "  ✗ /api/matches → 404. Backend is running STALE code. Re-copy server.py." ;;
  *)                   echo "  ⚠ /api/matches → HTTP $NEW_CODE (unexpected, but not 404)" ;;
esac

section "Done"
echo "  systemctl status onpar-backend  # check status"
echo "  journalctl -u onpar-backend -f  # follow live logs"
echo
