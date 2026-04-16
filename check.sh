#!/bin/bash
echo "=== Backend status ==="
curl -s http://localhost:8005/api/tournaments && echo "" || echo "Backend NOT running"

echo ""
echo "=== Files in public_html ==="
ls -la /home/onparliveuni2/public_html/ | head -10

echo ""
echo "=== JS files ==="
ls /home/onparliveuni2/public_html/static/js/ 2>/dev/null || echo "No JS files!"

echo ""
echo "=== index.html content (first 20 lines) ==="
head -20 /home/onparliveuni2/public_html/index.html 2>/dev/null || echo "No index.html!"

echo ""
echo "=== .htaccess ==="
cat /home/onparliveuni2/public_html/.htaccess 2>/dev/null || echo "No .htaccess!"

echo ""
echo "=== Permissions ==="
ls -la /home/onparliveuni2/public_html/static/js/ 2>/dev/null | head -5
