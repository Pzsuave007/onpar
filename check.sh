#!/bin/bash
echo "=== JS file in repo ==="
ls /home/onparliveuni2/repo/frontend/build/static/js/main.*.js | grep -v map | grep -v LICENSE

echo ""
echo "=== JS file in public_html ==="
ls /home/onparliveuni2/public_html/static/js/main.*.js 2>/dev/null | grep -v map | grep -v LICENSE

echo ""
echo "=== Do they match? ==="
REPO_JS=$(ls /home/onparliveuni2/repo/frontend/build/static/js/main.*.js 2>/dev/null | grep -v map | grep -v LICENSE | xargs basename)
WEB_JS=$(ls /home/onparliveuni2/public_html/static/js/main.*.js 2>/dev/null | grep -v map | grep -v LICENSE | xargs basename)
echo "Repo: $REPO_JS"
echo "Web:  $WEB_JS"
if [ "$REPO_JS" = "$WEB_JS" ]; then echo "MATCH"; else echo "MISMATCH - run: bash fix.sh"; fi
