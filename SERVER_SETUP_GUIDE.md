# MY SERVER SETUP - COPY THIS TO EVERY NEW AGENT

## Server Info
- **OS**: AlmaLinux (CentOS/RHEL based) — uses `dnf` NOT `apt`
- **Python**: 3.9.25 (DO NOT try to install other versions)
- **Node.js**: 18.x (use `--ignore-engines` flag with yarn)
- **MongoDB**: 7.x running locally on default port 27017
- **Web Server**: Apache with cPanel/WHM (NOT nginx, NOT supervisor, NOT systemd)
- **Process Manager**: `nohup` + `crontab` for auto-restart (NOT supervisor, NOT systemd)
- **Hosting**: GoDaddy VPS with cPanel

## CRITICAL RULES
1. **NO `apt` commands** — use `dnf` if needed
2. **NO supervisor** — not installed, don't try to install it
3. **NO systemd services** — use `nohup` to run backend
4. **NO nginx** — Apache handles everything via cPanel
5. **NO pinned Python package versions** — just package names, pip resolves compatible versions for Python 3.9
6. **yarn --ignore-engines** — Node 18 needs this flag
7. **ALL files must be owned by the cPanel user** — Apache runs as that user
8. **chmod 711 on home directory** — Apache needs to traverse it

## Directory Structure Pattern
```
/home/{CPANEL_USER}/              ← Home dir (chmod 711)
├── repo/                         ← Git repo cloned here
│   ├── backend/
│   ├── frontend/
│   ├── install_server.sh
│   ├── fix.sh
│   └── setup-autostart.sh
├── public_html/                  ← cPanel web root (frontend build goes here)
│   ├── index.html
│   ├── static/js/
│   ├── static/css/
│   └── .htaccess                 ← Proxy + SPA routing

/opt/{APP_NAME}/backend/          ← Production backend
├── venv/                         ← Python virtual environment
├── server.py
├── .env
└── backend.log
```

## .htaccess Template (goes in public_html)
```
RewriteEngine On

# Proxy to Backend API
RewriteCond %{REQUEST_URI} ^/api
RewriteRule ^(.*)$ http://127.0.0.1:{PORT}/$1 [P,L]

# Serve static files directly from public_html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# php -- BEGIN cPanel-generated handler, do not edit
# Set the "ea-php81" package as the default "PHP" programming language.
<IfModule mime_module>
  AddHandler application/x-httpd-ea-php81 .php .php8 .phtml
</IfModule>
# php -- END cPanel-generated handler, do not edit
```

## install_server.sh Template
```bash
#!/bin/bash
set -e
APP_NAME="{APP_NAME}"
CPANEL_USER="{CPANEL_USER}"
REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/${APP_NAME}/backend"
PORT={PORT}

mkdir -p "$PROD"

# Python venv
python3 -m venv "$PROD/venv"
source "$PROD/venv/bin/activate"
pip install --upgrade pip -q
pip install -r "$REPO/backend/requirements.txt" -q
deactivate

# Create .env if missing
if [ ! -f "$PROD/.env" ]; then
    cat > "$PROD/.env" << 'ENVEOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME={DB_NAME}
CORS_ORIGINS=https://{DOMAIN}
ENVEOF
    echo "EDIT .env: nano $PROD/.env"
fi

# Copy backend
cp -f "$REPO/backend/server.py" "$PROD/"

# Start backend
pkill -f "uvicorn.*${PORT}" 2>/dev/null || true
sleep 2
cd "$PROD" && source venv/bin/activate
nohup uvicorn server:app --host 0.0.0.0 --port ${PORT} --reload > backend.log 2>&1 &
sleep 5
curl -s http://localhost:${PORT}/api/ && echo " API: OK" || echo " ERROR"
```

## fix.sh Template (deploy updates)
```bash
#!/bin/bash
APP_NAME="{APP_NAME}"
CPANEL_USER="{CPANEL_USER}"
REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/${APP_NAME}/backend"
WEB="/home/${CPANEL_USER}/public_html"
PORT={PORT}
DOMAIN="{DOMAIN}"

cd "$REPO" && git pull origin main

source "$PROD/venv/bin/activate"
pip install -r "$REPO/backend/requirements.txt" --quiet 2>/dev/null
deactivate

cp -f "$REPO/backend/server.py" "$PROD/"

cd "$REPO/frontend"
cat > .env << EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
EOF
yarn install --ignore-engines 2>/dev/null || yarn install --ignore-engines
yarn build

rm -rf "$WEB/static/js/" "$WEB/static/css/"
cp -rf "$REPO/frontend/build/"* "$WEB/"
chown -R ${CPANEL_USER}:${CPANEL_USER} "$WEB"

pkill -f "uvicorn.*${PORT}" 2>/dev/null
sleep 2
cd "$PROD" && source "$PROD/venv/bin/activate"
nohup "$PROD/venv/bin/uvicorn" server:app --host 0.0.0.0 --port ${PORT} --reload > backend.log 2>&1 &
sleep 5
curl -s http://localhost:${PORT}/api/ && echo " API: OK" || echo " ERROR"
```

## setup-autostart.sh Template
```bash
#!/bin/bash
cat > /home/{CPANEL_USER}/restart.sh << 'EOF'
#!/bin/bash
cd /opt/{APP_NAME}/backend
source venv/bin/activate
pkill -f "uvicorn.*{PORT}" 2>/dev/null
sleep 2
nohup uvicorn server:app --host 0.0.0.0 --port {PORT} --reload > backend.log 2>&1 &
EOF
chmod +x /home/{CPANEL_USER}/restart.sh
(crontab -l 2>/dev/null | grep -v "restart.sh"; echo "@reboot /bin/bash /home/{CPANEL_USER}/restart.sh") | crontab -
```

## Permissions Fix (run if 403 Forbidden)
```bash
chmod 711 /home/{CPANEL_USER}
chown -R {CPANEL_USER}:{CPANEL_USER} /home/{CPANEL_USER}/public_html
find /home/{CPANEL_USER}/public_html -type f -exec chmod 644 {} \;
find /home/{CPANEL_USER}/public_html -type d -exec chmod 755 {} \;
```

## requirements.txt Rules
- NO pinned versions (Python 3.9 compatibility)
- Just package names, one per line
- Example:
```
fastapi
uvicorn
motor
pymongo
pydantic
httpx
python-dotenv
python-multipart
bcrypt
PyJWT
pillow
requests
```

## Ports Already In Use
- 8001: GradeProphet
- 8005: OnPar Live
- Next available: 8006, 8007, etc.

## Deployment Steps (in order)
1. Create cPanel account for domain
2. `ln -s /home/{CPANEL_USER} /home/{SHORT_NAME}` (optional shortcut)
3. `git clone <repo> /home/{CPANEL_USER}/repo`
4. `git config --global --add safe.directory /home/{CPANEL_USER}/repo`
5. `bash /home/{CPANEL_USER}/repo/install_server.sh`
6. `bash /home/{CPANEL_USER}/repo/fix.sh`
7. Edit .htaccess in public_html (proxy + SPA routing)
8. Fix permissions if 403 error
9. `bash /home/{CPANEL_USER}/repo/setup-autostart.sh`
10. Edit .env with API keys: `nano /opt/{APP_NAME}/backend/.env`
