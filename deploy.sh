#!/bin/bash
#================================================================
# OnPar Live - Deployment Script
# Server: AlmaLinux 9 + cPanel/WHM + Apache
# Domain: onparlive.com
#
# USAGE:
#   1. SSH into your server as root
#   2. Clone repo: git clone <repo-url> /opt/onparlive
#   3. Run: bash /opt/onparlive/deploy.sh
#
# This script:
#   - Installs Python 3.11, Node.js 20, dependencies
#   - Builds the React frontend
#   - Creates systemd service for the backend
#   - Configures Apache reverse proxy via cPanel includes
#   - Copies frontend build to cPanel document root
#   - Sets up .htaccess for SPA routing
#================================================================

set -e

# ===================== CONFIGURATION =====================
# CHANGE THESE if needed:
APP_NAME="onparlive"
DOMAIN="onparlive.com"
CPANEL_USER="onparliv"                          # <-- Your cPanel username
DOC_ROOT="/home/${CPANEL_USER}/public_html"      # <-- cPanel document root for domain
APP_DIR="/opt/onparlive"                         # <-- Where the repo is cloned
BACKEND_PORT=8001
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
VENV_DIR="$BACKEND_DIR/venv"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() { echo -e "\n${BLUE}[STEP]${NC} $1"; }
print_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_err() { echo -e "${RED}[ERROR]${NC} $1"; }

# ===================== PRE-CHECKS =====================
print_step "Checking prerequisites..."

if [ "$EUID" -ne 0 ]; then
    print_err "Please run as root: sudo bash deploy.sh"
    exit 1
fi

# Verify cPanel user exists
if ! id "$CPANEL_USER" &>/dev/null; then
    print_err "cPanel user '$CPANEL_USER' not found."
    print_err "Edit CPANEL_USER at the top of this script."
    print_err "Find your user with: ls /home/"
    exit 1
fi

# Verify document root
if [ ! -d "$DOC_ROOT" ]; then
    print_err "Document root not found: $DOC_ROOT"
    print_err "Create the domain in cPanel first, then edit DOC_ROOT in this script."
    exit 1
fi

print_ok "cPanel user: $CPANEL_USER"
print_ok "Document root: $DOC_ROOT"

# ===================== SYSTEM DEPENDENCIES =====================
print_step "Installing system dependencies..."

# Enable required repos
dnf install -y epel-release 2>/dev/null || true
dnf install -y python3.11 python3.11-pip python3.11-devel gcc git curl

# Install Node.js 20 if not present
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 18 ]]; then
    print_step "Installing Node.js 20..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
    npm install -g yarn
    print_ok "Node.js $(node -v) installed"
else
    print_ok "Node.js $(node -v) found"
    if ! command -v yarn &> /dev/null; then
        npm install -g yarn
    fi
fi

# Check MongoDB
if ! command -v mongod &> /dev/null && ! systemctl is-active --quiet mongod; then
    print_warn "MongoDB not detected. If it's on another server, ignore this."
    print_warn "If you need to install it, run: bash install_mongodb.sh"
else
    print_ok "MongoDB found"
fi

# ===================== BACKEND SETUP =====================
print_step "Setting up backend..."

# Create Python virtual environment
python3.11 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

# Install Python dependencies
pip install --upgrade pip
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
pip install -r "$BACKEND_DIR/requirements.txt"

print_ok "Backend dependencies installed"

# Create production .env if not exists
if [ ! -f "$BACKEND_DIR/.env" ]; then
    print_step "Creating backend .env..."
    JWT_SECRET=$(python3.11 -c "import secrets; print(secrets.token_hex(32))")
    cat > "$BACKEND_DIR/.env" << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=onparlive
CORS_ORIGINS=https://onparlive.com,https://www.onparlive.com
JWT_SECRET=${JWT_SECRET}
EMERGENT_LLM_KEY=YOUR_EMERGENT_KEY_HERE
EOF
    print_warn "IMPORTANT: Edit $BACKEND_DIR/.env and set your EMERGENT_LLM_KEY"
else
    print_ok "Backend .env already exists"
    # Ensure CORS and DB are correct
    sed -i "s|CORS_ORIGINS=.*|CORS_ORIGINS=https://onparlive.com,https://www.onparlive.com|" "$BACKEND_DIR/.env"
    sed -i "s|DB_NAME=.*|DB_NAME=onparlive|" "$BACKEND_DIR/.env"
fi

deactivate

# ===================== FRONTEND BUILD =====================
print_step "Building frontend..."

cd "$FRONTEND_DIR"

# Create production .env for React
cat > .env << EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
EOF

# Install and build
yarn install --frozen-lockfile 2>/dev/null || yarn install
yarn build

print_ok "Frontend built"

# ===================== COPY FRONTEND TO CPANEL DOC ROOT =====================
print_step "Deploying frontend to cPanel document root..."

# Backup existing content
if [ -d "$DOC_ROOT" ] && [ "$(ls -A $DOC_ROOT 2>/dev/null)" ]; then
    BACKUP_DIR="/home/${CPANEL_USER}/public_html_backup_$(date +%Y%m%d_%H%M%S)"
    print_warn "Backing up existing content to $BACKUP_DIR"
    cp -r "$DOC_ROOT" "$BACKUP_DIR"
fi

# Copy build files
rm -rf "${DOC_ROOT:?}"/*
cp -r "$FRONTEND_DIR/build/"* "$DOC_ROOT/"

# Create .htaccess for SPA routing + API proxy
cat > "$DOC_ROOT/.htaccess" << 'HTACCESS'
# OnPar Live - Apache Configuration

# Enable rewrite engine
RewriteEngine On

# Proxy API requests to FastAPI backend
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^api/(.*)$ http://127.0.0.1:8001/api/$1 [P,L]

# SPA: Route all non-file requests to index.html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType font/woff2 "access plus 1 year"
</IfModule>

# Increase upload size for photo feed
<IfModule mod_php.c>
    php_value upload_max_filesize 15M
    php_value post_max_size 15M
</IfModule>
HTACCESS

# Set ownership to cPanel user
chown -R ${CPANEL_USER}:${CPANEL_USER} "$DOC_ROOT"

print_ok "Frontend deployed to $DOC_ROOT"

# ===================== ENABLE APACHE PROXY MODULES =====================
print_step "Enabling Apache proxy modules..."

# cPanel uses EasyApache - check if proxy modules are loaded
if ! httpd -M 2>/dev/null | grep -q proxy_module; then
    print_warn "Apache proxy modules may not be enabled."
    print_warn "Go to WHM -> EasyApache 4 -> Currently Installed Packages"
    print_warn "Enable: mod_proxy, mod_proxy_http"
    print_warn "Or run: /scripts/rebuildhttpdconf && systemctl restart httpd"
fi

# Add proxy config via Apache includes (cPanel-safe way)
APACHE_INCLUDE_DIR="/etc/apache2/conf.d/userdata/ssl/2_4/${CPANEL_USER}/${DOMAIN}"
mkdir -p "$APACHE_INCLUDE_DIR"

cat > "$APACHE_INCLUDE_DIR/proxy.conf" << EOF
# OnPar Live API Proxy
ProxyPreserveHost On
ProxyPass /api/ http://127.0.0.1:${BACKEND_PORT}/api/
ProxyPassReverse /api/ http://127.0.0.1:${BACKEND_PORT}/api/

# Increase timeouts for photo uploads
ProxyTimeout 120
RequestHeader set X-Forwarded-Proto "https"

# Increase body size for photo uploads
LimitRequestBody 15728640
EOF

# Also for non-SSL
APACHE_INCLUDE_DIR_HTTP="/etc/apache2/conf.d/userdata/std/2_4/${CPANEL_USER}/${DOMAIN}"
mkdir -p "$APACHE_INCLUDE_DIR_HTTP"
cp "$APACHE_INCLUDE_DIR/proxy.conf" "$APACHE_INCLUDE_DIR_HTTP/proxy.conf"

# Rebuild Apache config (cPanel way)
/scripts/rebuildhttpdconf 2>/dev/null || true
systemctl restart httpd 2>/dev/null || apachectl restart 2>/dev/null || true

print_ok "Apache proxy configured"

# ===================== SYSTEMD SERVICE =====================
print_step "Creating backend service..."

cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=OnPar Live Backend
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=${CPANEL_USER}
Group=${CPANEL_USER}
WorkingDirectory=${BACKEND_DIR}
Environment=PATH=${VENV_DIR}/bin:/usr/bin:/bin
ExecStart=${VENV_DIR}/bin/uvicorn server:app --host 127.0.0.1 --port ${BACKEND_PORT} --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chown -R ${CPANEL_USER}:${CPANEL_USER} "$APP_DIR"

systemctl daemon-reload
systemctl enable ${APP_NAME}
systemctl restart ${APP_NAME}

sleep 2

# Check if backend started
if systemctl is-active --quiet ${APP_NAME}; then
    print_ok "Backend service running"
else
    print_err "Backend failed to start. Check: journalctl -u ${APP_NAME} -n 50"
fi

# ===================== SEED ADMIN =====================
print_step "Seeding admin account..."
sleep 2
curl -s -X POST http://127.0.0.1:${BACKEND_PORT}/api/admin/seed 2>/dev/null | python3.11 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',''))" 2>/dev/null || print_warn "Admin seed skipped"

# ===================== FIREWALL =====================
print_step "Configuring firewall..."
# Ensure backend port is NOT exposed externally (only accessible via Apache proxy)
firewall-cmd --remove-port=${BACKEND_PORT}/tcp 2>/dev/null || true
# Ensure HTTP/HTTPS are open
firewall-cmd --permanent --add-service=http 2>/dev/null || true
firewall-cmd --permanent --add-service=https 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true
print_ok "Firewall configured"

# ===================== SSL CHECK =====================
print_step "Checking SSL..."
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    print_ok "SSL certificate found"
elif command -v /usr/local/cpanel/bin/autossl &>/dev/null; then
    print_ok "cPanel AutoSSL is available - SSL should auto-provision"
    print_warn "If SSL isn't working, go to: cPanel -> SSL/TLS Status -> Run AutoSSL"
else
    print_warn "No SSL found. Set it up via: cPanel -> SSL/TLS Status"
fi

# ===================== DONE =====================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  OnPar Live - Deployment Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  Website:  ${BLUE}https://${DOMAIN}${NC}"
echo ""
echo -e "  ${YELLOW}Service commands:${NC}"
echo -e "    systemctl status ${APP_NAME}       # Check backend"
echo -e "    systemctl restart ${APP_NAME}      # Restart backend"
echo -e "    journalctl -u ${APP_NAME} -f       # View logs"
echo ""

if grep -q "YOUR_EMERGENT_KEY_HERE" "$BACKEND_DIR/.env" 2>/dev/null; then
    echo -e "  ${RED}ACTION REQUIRED:${NC}"
    echo -e "  1. Edit: nano ${BACKEND_DIR}/.env"
    echo -e "  2. Set your EMERGENT_LLM_KEY (for AI scorecard scanner)"
    echo -e "  3. Restart: systemctl restart ${APP_NAME}"
    echo ""
fi

echo -e "  ${YELLOW}Admin credentials:${NC}"
echo -e "    admin@fairway.com / FairwayAdmin123!"
echo -e "    pzsuave007@gmail.com / MXmedia007"
echo ""
