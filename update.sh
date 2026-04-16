#!/bin/bash
#================================================================
# OnPar Live - Update Script (AlmaLinux + cPanel + Apache)
# Run after pulling new code from GitHub
#
# USAGE: sudo bash update.sh
#================================================================

set -e

APP_NAME="onparlive"
DOMAIN="onparlive.com"
CPANEL_USER="onparliv"
DOC_ROOT="/home/${CPANEL_USER}/public_html"
APP_DIR="/opt/onparlive"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
VENV_DIR="$BACKEND_DIR/venv"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[1/5]${NC} Pulling latest code..."
cd "$APP_DIR"
git pull

echo -e "${BLUE}[2/5]${NC} Updating backend dependencies..."
source "$VENV_DIR/bin/activate"
pip install -r "$BACKEND_DIR/requirements.txt" -q
deactivate

echo -e "${BLUE}[3/5]${NC} Rebuilding frontend..."
cd "$FRONTEND_DIR"
cat > .env << EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
EOF
yarn install --frozen-lockfile 2>/dev/null || yarn install
yarn build

echo -e "${BLUE}[4/5]${NC} Deploying frontend..."
rm -rf "${DOC_ROOT:?}"/*
cp -r "$FRONTEND_DIR/build/"* "$DOC_ROOT/"

# Recreate .htaccess
cat > "$DOC_ROOT/.htaccess" << 'HTACCESS'
RewriteEngine On
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^api/(.*)$ http://127.0.0.1:8001/api/$1 [P,L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType font/woff2 "access plus 1 year"
</IfModule>
HTACCESS

chown -R ${CPANEL_USER}:${CPANEL_USER} "$DOC_ROOT"
chown -R ${CPANEL_USER}:${CPANEL_USER} "$APP_DIR"

echo -e "${BLUE}[5/5]${NC} Restarting backend..."
systemctl restart ${APP_NAME}

echo ""
echo -e "${GREEN}Update complete!${NC} https://${DOMAIN}"
echo ""
