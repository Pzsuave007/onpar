#!/bin/bash
# Build frontend for production - RUN THIS IN EMERGENT DEV ENVIRONMENT ONLY
# Then push to GitHub. Server only copies the pre-built files.
cd /app/frontend
cat > .env << EOF
REACT_APP_BACKEND_URL=https://onparlive.com
EOF
yarn install --ignore-engines 2>/dev/null || yarn install --ignore-engines
yarn build
echo "Frontend built! Now push to GitHub (Save to Github button)"
