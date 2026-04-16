#!/bin/bash
# Install supervisor using pip (works on any Linux)
pip3 install supervisor
mkdir -p /etc/supervisor/conf.d

# Create supervisord config if missing
if [ ! -f /etc/supervisord.conf ]; then
    echo_supervisord_conf > /etc/supervisord.conf
    echo "[include]" >> /etc/supervisord.conf
    echo "files = /etc/supervisor/conf.d/*.conf" >> /etc/supervisord.conf
fi

# Start supervisord if not running
supervisord -c /etc/supervisord.conf 2>/dev/null || true

# Now run deploy
bash /home/onpar/repo/deploy.sh
