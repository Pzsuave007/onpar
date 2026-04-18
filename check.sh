#!/bin/bash
echo "=== 1. Check .env ==="
grep OPENAI_API_KEY /opt/onpar/backend/.env | cut -c1-30
grep UPLOAD_DIR /opt/onpar/backend/.env

echo ""
echo "=== 2. Upload dir ==="
ls -la /home/onparliveuni2/public_html/uploads/ 2>/dev/null || echo "uploads dir not found!"
ls -la /home/onparliveuni2/public_html/uploads/feed/ 2>/dev/null || echo "feed dir not found!"

echo ""
echo "=== 3. Test photo upload ==="
TOKEN=$(curl -s -X POST http://localhost:8005/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@fairway.com","password":"FairwayAdmin123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null)
TID=$(curl -s http://localhost:8005/api/tournaments -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); t=[x for x in d if x['status']=='active']; print(t[0]['tournament_id'] if t else 'none')" 2>/dev/null)
echo "Tournament: $TID"
python3 -c "from PIL import Image; img=Image.new('RGB',(100,100),'green'); img.save('/tmp/t.jpg','JPEG')" 2>/dev/null
curl -s -X POST http://localhost:8005/api/tournaments/$TID/feed -H "Authorization: Bearer $TOKEN" -F "file=@/tmp/t.jpg" -F "caption=test"

echo ""
echo ""
echo "=== 4. Backend log (last 15) ==="
tail -15 /opt/onpar/backend/backend.log 2>/dev/null
