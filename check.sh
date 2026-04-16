#!/bin/bash
# Fix ALL permissions in the chain
chmod 711 /home/onparliveuni2
chmod 750 /home/onparliveuni2/public_html
chown -R onparliveuni2:onparliveuni2 /home/onparliveuni2/public_html
find /home/onparliveuni2/public_html -type f -exec chmod 644 {} \;
find /home/onparliveuni2/public_html -type d -exec chmod 755 {} \;

# Verify
echo "=== Home dir ==="
ls -la /home/ | grep onparliveuni2
echo "=== public_html ==="
ls -la /home/onparliveuni2/ | grep public_html
echo "=== Files ==="
ls -la /home/onparliveuni2/public_html/ | head -10
echo ""
echo "Reload https://onparlive.com now"
