#!/bin/bash
echo "=== .htaccess content ==="
cat /home/onparliveuni2/public_html/.htaccess

echo ""
echo "=== .htaccess permissions ==="
ls -la /home/onparliveuni2/public_html/.htaccess

echo ""
echo "=== Apache proxy modules ==="
httpd -M 2>/dev/null | grep -i proxy

echo ""
echo "=== public_html permissions ==="
ls -la /home/onparliveuni2/public_html/ | head -10

echo ""
echo "=== Apache error log (last 10 lines) ==="
tail -10 /var/log/apache2/error.log 2>/dev/null || tail -10 /var/log/httpd/error_log 2>/dev/null || tail -10 /usr/local/apache/logs/error_log 2>/dev/null || echo "Log not found"
