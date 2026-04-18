#!/bin/bash
echo "=== 1. Check EMERGENT_LLM_KEY ==="
grep EMERGENT_LLM_KEY /opt/onpar/backend/.env

echo ""
echo "=== 2. Test score save ==="
TOKEN=$(curl -s -X POST http://localhost:8005/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@fairway.com","password":"FairwayAdmin123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
TID=$(curl -s http://localhost:8005/api/tournaments -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); t=[x for x in d if x['status']=='active']; print(t[0]['tournament_id'] if t else 'none')")
echo "Tournament: $TID"
PLAYER=$(curl -s http://localhost:8005/api/tournaments/$TID/roster -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['user_id'] if d else 'none')")
echo "Player: $PLAYER"
curl -s -X POST http://localhost:8005/api/scorecards/keeper -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"tournament_id\":\"$TID\",\"user_id\":\"$PLAYER\",\"round_number\":1,\"holes\":[{\"hole\":1,\"strokes\":4,\"par\":4}]}"
echo ""

echo ""
echo "=== 3. Test photo upload ==="
python3 -c "from PIL import Image; img=Image.new('RGB',(100,100),'green'); img.save('/tmp/t.jpg','JPEG')" 2>/dev/null
curl -s -X POST http://localhost:8005/api/tournaments/$TID/feed -H "Authorization: Bearer $TOKEN" -F "file=@/tmp/t.jpg" -F "caption=test"
echo ""

echo ""
echo "=== 4. Backend logs (last 10) ==="
tail -10 /opt/onpar/backend/backend.log 2>/dev/null || echo "No log found"
