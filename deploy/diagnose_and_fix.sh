#!/bin/bash
# OnPar Live — Diagnose and Fix backend not starting.
# Safe-by-design: ONLY touches processes/files under /opt/onpar/.
# Other apps on the same server (espresso-beso, gradeprophet, etc.) are NEVER killed.
#
#   cd /home/onparliveuni2/repo
#   git pull
#   sudo bash deploy/diagnose_and_fix.sh

set +e

PROD="/opt/onpar/backend"
PORT=8005
LOGFILE="$PROD/backend.log"   # the systemd unit redirects stderr here

if [ "$EUID" -ne 0 ]; then
  echo "✗ Run as root: sudo bash deploy/diagnose_and_fix.sh"
  exit 1
fi

bar()     { echo "============================================"; }
section() { echo; bar; echo "  $1"; bar; }

section "OnPar Live — Backend Diagnostic & Fix"
echo "  $(date)"

# ----------------------------- STEP 1 ---------------------------------------
section "STEP 1 — uvicorn processes (ALL apps, just to look)"
ps -eo pid,user,cmd | grep -i uvicorn | grep -v grep || echo "  (none)"

# ----------------------------- STEP 2 ---------------------------------------
section "STEP 2 — Who owns port $PORT?"
ss -tlnp 2>/dev/null | grep ":$PORT" || echo "  ✓ port $PORT is free"

# ----------------------------- STEP 3 ---------------------------------------
section "STEP 3 — Try importing server.py inside the venv"
echo "  (catches Python crash at import time)"
echo
if [ -d "$PROD/venv" ] && [ -f "$PROD/server.py" ]; then
  cd "$PROD"
  # shellcheck disable=SC1091
  source venv/bin/activate
  IMPORT_OUT=$(python -c "import server" 2>&1)
  IMPORT_RC=$?
  deactivate
  if [ "$IMPORT_RC" = "0" ]; then
    echo "  ✓ server.py imports cleanly."
  else
    echo "  ✗ server.py FAILED at import:"
    echo
    echo "$IMPORT_OUT" | tail -30
  fi
else
  echo "  ✗ /opt/onpar/backend missing — run setup_systemd.sh once first."
  exit 1
fi

# ----------------------------- STEP 4 (SAFE) --------------------------------
section "STEP 4 — Kill ONLY OnPar uvicorn orphans (safe)"
# Stop systemd service first so the legitimate process exits cleanly.
systemctl stop onpar-backend 2>/dev/null || true
sleep 1

# Build a list of PIDs whose cmdline references /opt/onpar/.
ONPAR_PIDS=()
for pid in $(pgrep -f "uvicorn.*server:app" 2>/dev/null); do
  if grep -q "/opt/onpar/" "/proc/$pid/cmdline" 2>/dev/null; then
    ONPAR_PIDS+=("$pid")
  fi
done

if [ ${#ONPAR_PIDS[@]} -eq 0 ]; then
  echo "  ✓ No orphan OnPar uvicorn processes."
else
  echo "  Orphan OnPar uvicorn PIDs: ${ONPAR_PIDS[*]}"
  for pid in "${ONPAR_PIDS[@]}"; do
    kill -9 "$pid" 2>/dev/null && echo "    killed $pid"
  done
  sleep 2
fi

# Confirm the OTHER apps are still alive (sanity check)
echo
echo "  Other apps still running (should NOT be empty if they were before):"
ps -eo pid,cmd | grep -i uvicorn | grep -v grep | grep -v "/opt/onpar/" | head -5 || echo "    (none — but that may be normal if you don't run them)"

# ----------------------------- STEP 5 ---------------------------------------
section "STEP 5 — Restart onpar-backend via systemd"
systemctl reset-failed onpar-backend 2>/dev/null || true
# Truncate the log so we capture ONLY this start attempt
: > "$LOGFILE" 2>/dev/null || true
systemctl restart onpar-backend
sleep 5

if systemctl is-active --quiet onpar-backend; then
  echo "  ✓ ACTIVE  (PID: $(systemctl show --property MainPID --value onpar-backend))"
else
  echo "  ✗ NOT active — capturing the REAL Python error from $LOGFILE:"
  echo
  echo "------ last 60 lines of $LOGFILE ------"
  tail -60 "$LOGFILE" 2>/dev/null || echo "(log empty or missing)"
  echo "------ end of log ------"
  echo
  echo "  Send the traceback above to the agent."
  exit 1
fi

# ----------------------------- STEP 6 ---------------------------------------
section "STEP 6 — HTTP smoke test"
sleep 1
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/api/tournaments")
case "$CODE" in
  200) echo "  ✓ /api/tournaments → HTTP 200" ;;
  *)   echo "  ✗ /api/tournaments → HTTP $CODE" ;;
esac

NEW_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1:$PORT/api/matches" \
  -H "Content-Type: application/json" -d '{}')
case "$NEW_CODE" in
  200|400|401|403|422) echo "  ✓ /api/matches reachable → HTTP $NEW_CODE  (new Match code is LIVE)" ;;
  404)                 echo "  ✗ /api/matches → 404 — backend running STALE code" ;;
  *)                   echo "  ⚠ /api/matches → HTTP $NEW_CODE" ;;
esac

section "Done"
echo "  journalctl -u onpar-backend -f      # systemd messages"
echo "  tail -f $LOGFILE                    # live Python stdout/stderr"
echo
