#!/bin/bash
#================================================================
# OnPar Live - Update Script (fix.sh)
# Same pattern as GradeProphet's fix.sh
#
# USAGE: bash /home/gradeprophet/fix_onparlive.sh
#================================================================

set -e

APP_USER="onparliveuni2"
APP_NAME="onparlive"
DOMAIN="onparlive.com"
REPO_DIR="/home/${APP_USER}/onparlive-repo"
PROD_DIR="/home/${APP_USER}/onparlive"
VENV_DIR="${PROD_DIR}/backend/venv"
BACKEND_PORT=8005

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "========= UPDATING OnPar Live ========="

# Pull latest code
echo -e "${BLUE}[1/5]${NC} Pulling latest code..."
cd "$REPO_DIR"
git pull origin main

# Backend deps
echo -e "${BLUE}[2/5]${NC} Updating backend..."
source "$VENV_DIR/bin/activate"
pip install -r "${REPO_DIR}/backend/requirements.txt" -q
deactivate

# Copy backend files
cp -f ${REPO_DIR}/backend/server.py ${PROD_DIR}/backend/

# Build frontend
echo -e "${BLUE}[3/5]${NC} Building frontend..."
cd "${REPO_DIR}/frontend"
cat > .env << EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
EOF
yarn install --frozen-lockfile 2>/dev/null || yarn install
yarn build

# Copy frontend build
echo -e "${BLUE}[4/5]${NC} Deploying frontend..."
rm -rf ${PROD_DIR}/frontend/build/*
cp -rf ${REPO_DIR}/frontend/build/* ${PROD_DIR}/frontend/build/

# Fix permissions
chown -R ${APP_USER}:${APP_USER} ${PROD_DIR}

# Restart backend
echo -e "${BLUE}[5/5]${NC} Restarting backend..."
sudo systemctl restart ${APP_NAME}

echo ""
echo -e "${GREEN}========= DONE =========${NC}"
echo "https://${DOMAIN}"
echo ""
