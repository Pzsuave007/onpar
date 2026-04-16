#!/bin/bash
#================================================================
# OnPar Live - Update Script
# Run this after pulling new code from GitHub
#
# USAGE: sudo bash update.sh
#================================================================

set -e

APP_NAME="onparlive"
APP_DIR="/var/www/onparlive"
BACKEND_DIR="$APP_DIR/backend"
VENV_DIR="$BACKEND_DIR/venv"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[1/4]${NC} Pulling latest code..."
cd "$APP_DIR"
git pull

echo -e "${BLUE}[2/4]${NC} Updating backend dependencies..."
source "$VENV_DIR/bin/activate"
pip install -r "$BACKEND_DIR/requirements.txt" -q
deactivate

echo -e "${BLUE}[3/4]${NC} Rebuilding frontend..."
cd "$APP_DIR/frontend"
yarn install --frozen-lockfile 2>/dev/null || yarn install
yarn build

echo -e "${BLUE}[4/4]${NC} Restarting services..."
chown -R www-data:www-data "$APP_DIR"
systemctl restart ${APP_NAME}
systemctl reload nginx

echo ""
echo -e "${GREEN}Update complete!${NC} https://onparlive.com"
echo ""
