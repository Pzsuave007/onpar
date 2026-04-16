#!/bin/bash
set -e
echo "============================================"
echo "  OnPar Live - Server Installation"
echo "============================================"

APP_DIR="/opt/onpar"
BACKEND_DIR="$APP_DIR/backend"
REPO="/home/onparliveuni2"

# Create production directory
mkdir -p "$BACKEND_DIR"

# Verify Python
echo "[1/6] Checking Python..."
python3 --version || { echo "Install Python3 first"; exit 1; }

# Verify pip
echo "[2/6] Checking pip..."
pip3 --version || python3 -m ensurepip --upgrade

# Create .env if missing
echo "[3/6] Setting up .env..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
    cat > "$BACKEND_DIR/.env" << 'ENVEOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=onparlive
CORS_ORIGINS=https://onparlive.com,https://www.onparlive.com
JWT_SECRET=CHANGE_THIS_TO_A_RANDOM_STRING
EMERGENT_LLM_KEY=YOUR_EMERGENT_KEY_HERE
ENVEOF
    echo "  *** EDIT .env with real keys: nano $BACKEND_DIR/.env ***"
fi

# Create venv and install deps
echo "[4/6] Installing Python dependencies..."
cd "$BACKEND_DIR"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ -q
pip install -r "$REPO/backend/requirements.txt" -q
deactivate

# Copy backend files
echo "[5/6] Copying backend files..."
cp -f "$REPO/backend/server.py" "$BACKEND_DIR/"
cp -f "$REPO/backend/requirements.txt" "$BACKEND_DIR/"

# Stop existing backend if running
pkill -f "uvicorn.*8005" 2>/dev/null || true
sleep 2

# Start backend
echo "[6/6] Starting backend..."
cd "$BACKEND_DIR"
source venv/bin/activate
nohup uvicorn server:app --host 0.0.0.0 --port 8005 --reload > backend.log 2>&1 &
sleep 5

curl -s http://localhost:8005/api/admin/seed 2>/dev/null || true
curl -s http://localhost:8005/api/ && echo " API: OK" || echo " ERROR: check $BACKEND_DIR/backend.log"

echo ""
echo "============================================"
echo "  Backend installed!"
echo "  Now run: bash fix.sh"
echo "  Then: bash setup-autostart.sh"
echo "============================================"
echo ""
if grep -q "YOUR_EMERGENT_KEY_HERE" "$BACKEND_DIR/.env" 2>/dev/null; then
    echo "  *** IMPORTANT: Edit $BACKEND_DIR/.env ***"
    echo "  nano $BACKEND_DIR/.env"
    echo ""
fi
