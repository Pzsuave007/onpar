#!/bin/bash
echo "============================================"
echo "  OnPar Live - Deploying Update"
echo "============================================"

REPO="/home/onparliveuni2"
PROD="/opt/onpar/backend"
WEB="/home/onparliveuni2/public_html"

echo "[1/5] Git pull..."
cd "$REPO" && git pull origin main

echo "[2/5] Backend dependencies..."
cd "$PROD"
source "$PROD/venv/bin/activate"
pip install -r "$REPO/backend/requirements.txt" --quiet 2>/dev/null
deactivate

echo "[3/5] Backend files..."
cp -f "$REPO/backend/server.py" "$PROD/"

echo "[4/5] Frontend..."
cd "$REPO/frontend"
cat > .env << EOF
REACT_APP_BACKEND_URL=https://onparlive.com
EOF
yarn install --ignore-engines 2>/dev/null || yarn install --ignore-engines
yarn build
rm -rf "$WEB/static/js/" "$WEB/static/css/"
cp -rf "$REPO/frontend/build/"* "$WEB/"

echo "[5/5] Restart backend..."
pkill -f "uvicorn.*8005" 2>/dev/null
sleep 2
cd "$PROD" && source "$PROD/venv/bin/activate"
nohup "$PROD/venv/bin/uvicorn" server:app --host 0.0.0.0 --port 8005 --reload > backend.log 2>&1 &
sleep 5
curl -s http://localhost:8005/api/ && echo " API: OK" || echo " ERROR: check $PROD/backend.log"

echo "============================================"
echo "  DONE! https://onparlive.com"
echo "============================================"
