#!/bin/bash
# OnPar Live — ONE-TIME setup for the systemd service.
# Run this ONCE on the cPanel server (as root).
# After this runs, the regular fix.sh becomes a 3-line deploy script.
#
# What it does:
#   1. Stops any nohup'd uvicorn currently running (the messy old way)
#   2. Installs /etc/systemd/system/onpar-backend.service
#   3. Reloads systemd, enables the service on boot, starts it
#   4. Verifies the backend responds on :8005
#
# Usage on the cPanel server:
#   cd /home/onparliveuni2/repo
#   git pull
#   sudo bash deploy/setup_systemd.sh

set -e

if [ "$EUID" -ne 0 ]; then
  echo "✗ This script must be run as root (use sudo)."
  exit 1
fi

REPO="/home/onparliveuni2/repo"
PROD="/opt/onpar/backend"
PORT=8005
UNIT_FILE="/etc/systemd/system/onpar-backend.service"
SOURCE_UNIT="$REPO/deploy/onpar-backend.service"

echo "============================================"
echo "  OnPar Live — systemd setup (one-time)"
echo "============================================"

echo; echo "▸ [1/5] Kill any nohup'd uvicorn currently running"
# We're about to hand ownership of uvicorn to systemd; kill whatever is there now.
pkill -9 -f uvicorn 2>/dev/null || true
sleep 2
if command -v fuser >/dev/null 2>&1; then
  fuser -k ${PORT}/tcp 2>/dev/null || true
  sleep 1
fi
REMAINING=$(pgrep -f uvicorn | wc -l)
if [ "$REMAINING" != "0" ]; then
  echo "✗ Could not kill all uvicorn processes. Please kill them manually:"
  ps -ef | grep uvicorn | grep -v grep
  exit 1
fi
echo "✓ No stale uvicorn processes"

echo; echo "▸ [2/5] Install systemd unit file"
if [ ! -f "$SOURCE_UNIT" ]; then
  echo "✗ Source unit file not found at $SOURCE_UNIT"
  echo "  Make sure you ran 'git pull' in $REPO first."
  exit 1
fi
cp -f "$SOURCE_UNIT" "$UNIT_FILE"
chmod 644 "$UNIT_FILE"
echo "✓ Installed $UNIT_FILE"

echo; echo "▸ [3/5] Reload systemd, enable on boot, start service"
systemctl daemon-reload
systemctl enable onpar-backend
systemctl start onpar-backend
sleep 3
echo "✓ Service enabled and started"

echo; echo "▸ [4/5] Status check"
if systemctl is-active --quiet onpar-backend; then
  echo "✓ onpar-backend is active"
  systemctl status onpar-backend --no-pager -l | head -12
else
  echo "✗ onpar-backend is NOT active. Logs:"
  journalctl -u onpar-backend --no-pager -n 30
  exit 1
fi

echo; echo "▸ [5/5] Smoke test"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/api/tournaments")
if [ "$CODE" != "200" ]; then
  echo "✗ Backend not responding (HTTP $CODE). Recent logs:"
  journalctl -u onpar-backend --no-pager -n 30
  exit 1
fi
echo "✓ Backend healthy (HTTP $CODE)"

echo
echo "============================================"
echo "  ✓ systemd setup DONE"
echo "============================================"
echo
echo "From now on, deploys are just:"
echo "    cd $REPO && git pull && bash fix.sh"
echo
echo "Other useful commands:"
echo "    systemctl status onpar-backend      # check if alive"
echo "    systemctl restart onpar-backend     # manual restart"
echo "    systemctl stop onpar-backend        # stop it"
echo "    journalctl -u onpar-backend -f      # live logs"
echo "    journalctl -u onpar-backend -n 100  # last 100 log lines"
echo
