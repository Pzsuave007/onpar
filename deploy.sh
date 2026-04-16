#!/bin/bash
#================================================================
# OnPar Live - Deployment Script
# Domain: onparlive.com
# Stack: React + FastAPI + MongoDB + Nginx + SSL
#
# USAGE:
#   1. Push code to GitHub
#   2. SSH into your server
#   3. Clone the repo: git clone <your-repo-url> /var/www/onparlive
#   4. Run: bash /var/www/onparlive/deploy.sh
#
# REQUIREMENTS:
#   - Ubuntu 20.04+ server
#   - MongoDB already installed and running
#   - Domain onparlive.com pointing to server IP
#   - Root or sudo access
#================================================================

set -e

# ===================== CONFIGURATION =====================
APP_NAME="onparlive"
DOMAIN="onparlive.com"
APP_DIR="/var/www/onparlive"
BACKEND_PORT=8001
FRONTEND_BUILD_DIR="$APP_DIR/frontend/build"
BACKEND_DIR="$APP_DIR/backend"
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

if ! command -v mongod &> /dev/null && ! systemctl is-active --quiet mongod; then
    print_warn "MongoDB not found. Installing..."
    apt-get update
    apt-get install -y gnupg curl
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt-get update
    apt-get install -y mongodb-org
    systemctl enable mongod
    systemctl start mongod
    print_ok "MongoDB installed and started"
else
    print_ok "MongoDB found"
fi

# ===================== SYSTEM DEPENDENCIES =====================
print_step "Installing system dependencies..."
apt-get update -qq
apt-get install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx curl git

# Install Node.js 20 if not present
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 18 ]]; then
    print_step "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    npm install -g yarn
    print_ok "Node.js $(node -v) installed"
else
    print_ok "Node.js $(node -v) found"
    if ! command -v yarn &> /dev/null; then
        npm install -g yarn
    fi
fi

# ===================== BACKEND SETUP =====================
print_step "Setting up backend..."

# Create Python virtual environment
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

# Install Python dependencies
pip install --upgrade pip
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
pip install -r "$BACKEND_DIR/requirements.txt"

print_ok "Backend dependencies installed"

# Create production .env if not exists
if [ ! -f "$BACKEND_DIR/.env" ]; then
    print_step "Creating backend .env file..."
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    cat > "$BACKEND_DIR/.env" << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=onparlive
CORS_ORIGINS=https://onparlive.com,https://www.onparlive.com
JWT_SECRET=$JWT_SECRET
EMERGENT_LLM_KEY=YOUR_EMERGENT_KEY_HERE
EOF
    print_warn "IMPORTANT: Edit $BACKEND_DIR/.env and set your EMERGENT_LLM_KEY"
    print_warn "Get it from: Emergent Dashboard -> Profile -> Universal Key"
else
    print_ok "Backend .env already exists"
    # Update CORS_ORIGINS if needed
    if ! grep -q "onparlive.com" "$BACKEND_DIR/.env"; then
        sed -i "s|CORS_ORIGINS=.*|CORS_ORIGINS=https://onparlive.com,https://www.onparlive.com|" "$BACKEND_DIR/.env"
        print_ok "Updated CORS_ORIGINS"
    fi
    # Update DB_NAME
    sed -i "s|DB_NAME=.*|DB_NAME=onparlive|" "$BACKEND_DIR/.env"
fi

deactivate

# ===================== FRONTEND SETUP =====================
print_step "Building frontend..."

cd "$APP_DIR/frontend"

# Create production .env
cat > .env << EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
EOF

# Install dependencies and build
yarn install --frozen-lockfile 2>/dev/null || yarn install
yarn build

print_ok "Frontend built successfully"

# ===================== SYSTEMD SERVICE =====================
print_step "Creating systemd service..."

cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=OnPar Live Backend
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${BACKEND_DIR}
Environment=PATH=${VENV_DIR}/bin:/usr/bin:/bin
ExecStart=${VENV_DIR}/bin/uvicorn server:app --host 0.0.0.0 --port ${BACKEND_PORT} --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chown -R www-data:www-data "$APP_DIR"

systemctl daemon-reload
systemctl enable ${APP_NAME}
systemctl restart ${APP_NAME}

print_ok "Backend service created and started"

# ===================== NGINX CONFIGURATION =====================
print_step "Configuring Nginx..."

cat > /etc/nginx/sites-available/${APP_NAME} << 'NGINX_CONF'
server {
    listen 80;
    server_name onparlive.com www.onparlive.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name onparlive.com www.onparlive.com;

    # SSL will be configured by certbot
    # ssl_certificate /etc/letsencrypt/live/onparlive.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/onparlive.com/privkey.pem;

    # Frontend (React build)
    root /var/www/onparlive/frontend/build;
    index index.html;

    # Max upload size for photo feed
    client_max_body_size 15M;

    # API proxy to FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # SPA: serve index.html for all frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_CONF

# Enable site
ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null

# Test nginx config
nginx -t

systemctl reload nginx

print_ok "Nginx configured"

# ===================== SSL CERTIFICATE =====================
print_step "Setting up SSL with Let's Encrypt..."

# Check if certificate already exists
if [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
    print_ok "SSL certificate already exists"
    # Uncomment SSL lines in nginx config
    sed -i 's|# ssl_certificate|ssl_certificate|g' /etc/nginx/sites-available/${APP_NAME}
    sed -i 's|# ssl_certificate_key|ssl_certificate_key|g' /etc/nginx/sites-available/${APP_NAME}
    systemctl reload nginx
else
    certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} --redirect || {
        print_warn "SSL setup failed. You can run manually later:"
        print_warn "  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
    }
fi

# ===================== SEED ADMIN =====================
print_step "Seeding admin account..."
sleep 2
curl -s -X POST http://localhost:${BACKEND_PORT}/api/admin/seed | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',''))" 2>/dev/null || print_warn "Admin seed skipped (may already exist)"

# ===================== FINAL STATUS =====================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  OnPar Live - Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Website:  ${BLUE}https://${DOMAIN}${NC}"
echo -e "  Backend:  ${BLUE}http://localhost:${BACKEND_PORT}/api${NC}"
echo ""
echo -e "  ${YELLOW}Service commands:${NC}"
echo -e "    sudo systemctl status ${APP_NAME}    # Check status"
echo -e "    sudo systemctl restart ${APP_NAME}   # Restart backend"
echo -e "    sudo journalctl -u ${APP_NAME} -f    # View logs"
echo ""

# Check if EMERGENT_LLM_KEY needs to be set
if grep -q "YOUR_EMERGENT_KEY_HERE" "$BACKEND_DIR/.env" 2>/dev/null; then
    echo -e "  ${RED}ACTION REQUIRED:${NC}"
    echo -e "  Edit ${BACKEND_DIR}/.env and set your EMERGENT_LLM_KEY"
    echo -e "  Then restart: sudo systemctl restart ${APP_NAME}"
    echo ""
fi

echo -e "  ${YELLOW}Admin credentials:${NC}"
echo -e "    Email:    admin@fairway.com"
echo -e "    Password: FairwayAdmin123!"
echo ""
echo -e "  ${YELLOW}Your personal admin:${NC}"
echo -e "    Email:    pzsuave007@gmail.com"
echo -e "    Password: MXmedia007"
echo ""
