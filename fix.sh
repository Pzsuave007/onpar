#!/bin/bash
echo "============================================"
echo "  OnPar Live - Deploying Update"
echo "============================================"

REPO="/home/onparliveuni2/repo"
PROD="/opt/onpar/backend"
WEB="/home/onparliveuni2/public_html"
PORT=8005

echo "[1/4] Git pull..."
cd "$REPO" && git pull origin main

echo "[2/4] Backend dependencies..."
cd "$PROD"
source "$PROD/venv/bin/activate"
pip install -r "$REPO/backend/requirements.txt" --quiet 2>/dev/null
deactivate

echo "[3/4] Backend files..."
cp -f "$REPO/backend/server.py" "$PROD/"

echo "[4/4] Frontend (pre-built, just copy)..."
rm -rf "$WEB/static/js/" "$WEB/static/css/"
cp -rf "$REPO/frontend/build/"* "$WEB/"
chown -R onparliveuni2:onparliveuni2 "$WEB"

echo "[5/5] Restart backend..."
pkill -f "uvicorn.*${PORT}" 2>/dev/null
sleep 2
cd "$PROD" && source "$PROD/venv/bin/activate"
nohup "$PROD/venv/bin/uvicorn" server:app --host 0.0.0.0 --port ${PORT} --reload > backend.log 2>&1 &
sleep 5
curl -s http://localhost:${PORT}/api/ && echo " API: OK" || echo " ERROR"

echo "============================================"
echo "  DONE! https://onparlive.com"
echo "============================================"
