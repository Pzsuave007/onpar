#!/bin/bash
#================================================================
# OnPar Live - FIRST TIME Deployment
# Server: Debian 12 + Python 3.9 + Nginx + Supervisor + MongoDB 7
# Domain: onparlive.com | User: onparliveuni2 | Port: 8005
#
# USAGE (as root):
#   ln -s /home/onparliveuni2 /home/onpar
#   git clone <repo> /home/onpar/repo
#   bash /home/onpar/repo/deploy.sh
#================================================================

set -e

APP_USER="onparliveuni2"
APP_NAME="onparlive"
DOMAIN="onparlive.com"
HOME_DIR="/home/${APP_USER}"
REPO_DIR="${HOME_DIR}/repo"
BACKEND_PORT=8005
VENV_DIR="${HOME_DIR}/venv"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========= OnPar Live - First Time Setup =========${NC}"

# ===================== CREATE DIRS =====================
echo -e "${BLUE}[1/7]${NC} Creating directories..."
mkdir -p ${HOME_DIR}/backend
mkdir -p ${HOME_DIR}/frontend/build

# ===================== PYTHON VENV =====================
echo -e "${BLUE}[2/7]${NC} Setting up Python venv..."
echo -e "${GREEN}[OK]${NC} Using: python3 ($(python3 --version))"
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
pip install --upgrade pip -q
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ -q
pip install -r "${REPO_DIR}/backend/requirements.txt" -q
deactivate
echo -e "${GREEN}[OK]${NC} Python dependencies installed"

# ===================== BACKEND .ENV =====================
echo -e "${BLUE}[3/7]${NC} Backend .env..."
if [ ! -f "${HOME_DIR}/backend/.env" ]; then
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    cat > "${HOME_DIR}/backend/.env" << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=onparlive
CORS_ORIGINS=https://onparlive.com,https://www.onparlive.com
JWT_SECRET=${JWT_SECRET}
EMERGENT_LLM_KEY=YOUR_EMERGENT_KEY_HERE
EOF
    echo -e "${YELLOW}[!]${NC} Set your EMERGENT_LLM_KEY in: ${HOME_DIR}/backend/.env"
else
    echo -e "${GREEN}[OK]${NC} .env already exists"
fi

# ===================== BUILD FRONTEND =====================
echo -e "${BLUE}[4/7]${NC} Building frontend..."
cd "${REPO_DIR}/frontend"
cat > .env << EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
EOF
yarn install --frozen-lockfile 2>/dev/null || yarn install
yarn build
echo -e "${GREEN}[OK]${NC} Frontend built"

# ===================== COPY TO PRODUCTION =====================
echo -e "${BLUE}[5/7]${NC} Copying files..."
cp -f ${REPO_DIR}/backend/server.py ${HOME_DIR}/backend/
cp -f ${REPO_DIR}/backend/requirements.txt ${HOME_DIR}/backend/
rm -rf ${HOME_DIR}/frontend/build/*
cp -rf ${REPO_DIR}/frontend/build/* ${HOME_DIR}/frontend/build/
cp -f ${REPO_DIR}/fix.sh ${HOME_DIR}/fix.sh
chmod +x ${HOME_DIR}/fix.sh
chown -R ${APP_USER}:${APP_USER} ${HOME_DIR}
echo -e "${GREEN}[OK]${NC} Files deployed"

# ===================== SUPERVISOR =====================
echo -e "${BLUE}[6/7]${NC} Configuring Supervisor..."
cat > /etc/supervisor/conf.d/${APP_NAME}.conf << EOF
[program:${APP_NAME}]
command=${VENV_DIR}/bin/uvicorn server:app --host 0.0.0.0 --port ${BACKEND_PORT}
directory=${HOME_DIR}/backend
user=${APP_USER}
autostart=true
autorestart=true
environment=PATH="${VENV_DIR}/bin:%(ENV_PATH)s"
stdout_logfile=/var/log/supervisor/${APP_NAME}.out.log
stderr_logfile=/var/log/supervisor/${APP_NAME}.err.log
EOF

supervisorctl reread
supervisorctl update
supervisorctl restart ${APP_NAME}
sleep 2

if supervisorctl status ${APP_NAME} | grep -q RUNNING; then
    echo -e "${GREEN}[OK]${NC} Backend running on port ${BACKEND_PORT}"
else
    echo -e "${RED}[ERROR]${NC} Backend failed. Check: tail /var/log/supervisor/${APP_NAME}.err.log"
fi

# ===================== NGINX =====================
echo -e "${BLUE}[7/7]${NC} Configuring Nginx..."
cat > /etc/nginx/sites-available/${APP_NAME} << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    client_max_body_size 15M;

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

    location / {
        root ${HOME_DIR}/frontend/build;
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        root ${HOME_DIR}/frontend/build;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
echo -e "${GREEN}[OK]${NC} Nginx configured"

if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
    echo -e "${YELLOW}[!]${NC} Getting SSL..."
    certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} 2>/dev/null || {
        echo -e "${YELLOW}[!]${NC} Run manually: sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
    }
fi

curl -s -X POST http://127.0.0.1:${BACKEND_PORT}/api/admin/seed 2>/dev/null || true

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  OnPar Live deployed!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  Site: ${BLUE}https://${DOMAIN}${NC}"
echo ""
echo -e "  ${YELLOW}Commands:${NC}"
echo -e "    supervisorctl status ${APP_NAME}"
echo -e "    supervisorctl restart ${APP_NAME}"
echo -e "    tail -f /var/log/supervisor/${APP_NAME}.err.log"
echo ""
echo -e "  ${YELLOW}Updates:${NC}  bash /home/onpar/fix.sh"
echo ""
if grep -q "YOUR_EMERGENT_KEY_HERE" "${HOME_DIR}/backend/.env" 2>/dev/null; then
    echo -e "  ${RED}SET YOUR KEY:${NC} nano /home/onpar/backend/.env"
    echo -e "  Then: supervisorctl restart ${APP_NAME}"
    echo ""
fi
