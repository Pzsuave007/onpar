#!/bin/bash
# Fix permissions for OnPar Live
chown -R onparliveuni2:onparliveuni2 /home/onparliveuni2/public_html/
chmod 750 /home/onparliveuni2/public_html
chmod 644 /home/onparliveuni2/public_html/.htaccess
chmod 644 /home/onparliveuni2/public_html/index.html
chmod 644 /home/onparliveuni2/public_html/asset-manifest.json
chmod -R 755 /home/onparliveuni2/public_html/static
echo "Permissions fixed. Reload https://onparlive.com"
