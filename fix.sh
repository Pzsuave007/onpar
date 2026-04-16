#!/bin/bash
#================================================================
# OnPar Live - Update Script
# USAGE: bash /home/onpar/fix.sh
#================================================================

set -e

APP_USER="onparliveuni2"
APP_NAME="onparlive"
DOMAIN="onparlive.com"
HOME_DIR="/home/${APP_USER}"
REPO_DIR="${HOME_DIR}/repo"
VENV_DIR="${HOME_DIR}/venv"

echo "========= UPDATING OnPar Live ========="

cd "$REPO_DIR" && git pull origin main

source "$VENV_DIR/bin/activate"
pip install -r "${REPO_DIR}/backend/requirements.txt" -q
deactivate

cp -f ${REPO_DIR}/backend/server.py ${HOME_DIR}/backend/

cd "${REPO_DIR}/frontend"
cat > .env << EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
EOF
yarn install --ignore-engines 2>/dev/null || yarn install --ignore-engines
yarn build

rm -rf ${HOME_DIR}/frontend/build/*
cp -rf ${REPO_DIR}/frontend/build/* ${HOME_DIR}/frontend/build/
chown -R ${APP_USER}:${APP_USER} ${HOME_DIR}

sudo supervisorctl restart ${APP_NAME}

echo "========= DONE ========= https://${DOMAIN}"
