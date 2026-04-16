#!/bin/bash
#================================================================
# OnPar Live - FIRST TIME Deployment
# Server: Same VPS as GradeProphet (user: gradeprophet, Nginx)
# Domain: onparlive.com
# Port: 8002 (GradeProphet uses 8001)
#
# USAGE (run as root on your server):
#   1. git clone <your-repo> /home/gradeprophet/onparlive-repo
#   2. bash /home/gradeprophet/onparlive-repo/deploy.sh
#
# After this, use fix.sh for all future updates.
#================================================================

set -e

# ===================== CONFIGURATION =====================
APP_USER="gradeprophet"
APP_NAME="onparlive"
DOMAIN="onparlive.com"
REPO_DIR="/home/${APP_USER}/onparlive-repo"
PROD_DIR="/home/${APP_USER}/onparlive"
BACKEND_PORT=8002
VENV_DIR="${PROD_DIR}/backend/venv"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========= OnPar Live - First Time Setup =========${NC}"

# ===================== CREATE PRODUCTION DIRS =====================
echo -e "${BLUE}[1/8]${NC} Creating production directories..."
mkdir -p ${PROD_DIR}/backend
mkdir -p ${PROD_DIR}/frontend/build

# ===================== PYTHON VENV + DEPS =====================
echo -e "${BLUE}[2/8]${NC} Setting up Python environment..."
python3 -m venv "$VENV_DIR" 2>/dev/null || python3.11 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
pip install --upgrade pip -q
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ -q
pip install -r "${REPO_DIR}/backend/requirements.txt" -q
deactivate
echo -e "${GREEN}[OK]${NC} Python dependencies installed"

# ===================== BACKEND .ENV =====================
echo -e "${BLUE}[3/8]${NC} Creating backend .env..."
if [ ! -f "${PROD_DIR}/backend/.env" ]; then
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || python3.11 -c "import secrets; print(secrets.token_hex(32))")
    cat > "${PROD_DIR}/backend/.env" << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=onparlive
CORS_ORIGINS=https://onparlive.com,https://www.onparlive.com
JWT_SECRET=${JWT_SECRET}
EMERGENT_LLM_KEY=YOUR_EMERGENT_KEY_HERE
EOF
    echo -e "${YELLOW}[WARN]${NC} Set your EMERGENT_LLM_KEY in: ${PROD_DIR}/backend/.env"
else
    echo -e "${GREEN}[OK]${NC} .env already exists, keeping it"
fi

# ===================== BUILD FRONTEND =====================
echo -e "${BLUE}[4/8]${NC} Building frontend..."
cd "${REPO_DIR}/frontend"
cat > .env << EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
EOF

if ! command -v yarn &> /dev/null; then
    npm install -g yarn
fi
yarn install --frozen-lockfile 2>/dev/null || yarn install
yarn build
echo -e "${GREEN}[OK]${NC} Frontend built"

# ===================== COPY FILES TO PRODUCTION =====================
echo -e "${BLUE}[5/8]${NC} Copying files to production..."
# Backend
cp -f ${REPO_DIR}/backend/server.py ${PROD_DIR}/backend/
cp -f ${REPO_DIR}/backend/requirements.txt ${PROD_DIR}/backend/

# Frontend build
rm -rf ${PROD_DIR}/frontend/build/*
cp -rf ${REPO_DIR}/frontend/build/* ${PROD_DIR}/frontend/build/

# Copy fix.sh for future updates
cp -f ${REPO_DIR}/fix.sh /home/${APP_USER}/fix_onparlive.sh
chmod +x /home/${APP_USER}/fix_onparlive.sh

chown -R ${APP_USER}:${APP_USER} ${PROD_DIR}
chown -R ${APP_USER}:${APP_USER} ${REPO_DIR}
echo -e "${GREEN}[OK]${NC} Files deployed"

# ===================== SYSTEMD SERVICE =====================
echo -e "${BLUE}[6/8]${NC} Creating systemd service..."
cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=OnPar Live Backend
After=network.target mongod.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${PROD_DIR}/backend
Environment=PATH=${VENV_DIR}/bin:/usr/bin:/bin
ExecStart=${VENV_DIR}/bin/uvicorn server:app --host 127.0.0.1 --port ${BACKEND_PORT} --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${APP_NAME}
systemctl restart ${APP_NAME}
sleep 2

if systemctl is-active --quiet ${APP_NAME}; then
    echo -e "${GREEN}[OK]${NC} Backend running on port ${BACKEND_PORT}"
else
    echo -e "${RED}[ERROR]${NC} Backend failed. Check: journalctl -u ${APP_NAME} -n 50"
fi

# ===================== NGINX =====================
echo -e "${BLUE}[7/8]${NC} Configuring Nginx..."
cat > /etc/nginx/conf.d/${APP_NAME}.conf << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN} www.${DOMAIN};

    # SSL - update paths after certbot runs
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    # Max upload for photo feed
    client_max_body_size 15M;

    # API -> FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # Frontend static files
    location / {
        root ${PROD_DIR}/frontend/build;
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        root ${PROD_DIR}/frontend/build;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Test and reload nginx
nginx -t && systemctl reload nginx
echo -e "${GREEN}[OK]${NC} Nginx configured"

# ===================== SSL =====================
echo -e "${BLUE}[8/8]${NC} SSL check..."
if [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
    echo -e "${GREEN}[OK]${NC} SSL certificate exists"
else
    echo -e "${YELLOW}[INFO]${NC} Getting SSL certificate..."
    certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} --redirect 2>/dev/null || {
        echo -e "${YELLOW}[WARN]${NC} Auto-SSL failed. Run manually:"
        echo "  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
    }
fi

# ===================== SEED ADMIN =====================
curl -s -X POST http://127.0.0.1:${BACKEND_PORT}/api/admin/seed 2>/dev/null || true

# ===================== DONE =====================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  OnPar Live deployed!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  Site:     ${BLUE}https://${DOMAIN}${NC}"
echo -e "  Backend:  port ${BACKEND_PORT}"
echo ""
echo -e "  ${YELLOW}Commands:${NC}"
echo -e "    systemctl status ${APP_NAME}"
echo -e "    systemctl restart ${APP_NAME}"
echo -e "    journalctl -u ${APP_NAME} -f"
echo ""
echo -e "  ${YELLOW}Future updates:${NC}"
echo -e "    bash /home/${APP_USER}/fix_onparlive.sh"
echo ""
if grep -q "YOUR_EMERGENT_KEY_HERE" "${PROD_DIR}/backend/.env" 2>/dev/null; then
    echo -e "  ${RED}ACTION REQUIRED:${NC}"
    echo -e "    nano ${PROD_DIR}/backend/.env"
    echo -e "    Set EMERGENT_LLM_KEY, then: systemctl restart ${APP_NAME}"
    echo ""
fi
echo -e "  ${YELLOW}Logins:${NC}"
echo -e "    admin@fairway.com / FairwayAdmin123!"
echo -e "    pzsuave007@gmail.com / MXmedia007"
echo ""
