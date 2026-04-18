#!/bin/bash
# Replace YOUR_KEY with your actual Emergent LLM Key
# Find it at: Emergent Dashboard -> Profile -> Universal Key
read -p "Paste your Emergent LLM Key here: " KEY
sed -i "s|EMERGENT_LLM_KEY=.*|EMERGENT_LLM_KEY=$KEY|" /opt/onpar/backend/.env
echo "Key saved!"
pkill -f "uvicorn.*8005" 2>/dev/null
sleep 2
cd /opt/onpar/backend && source venv/bin/activate
nohup uvicorn server:app --host 0.0.0.0 --port 8005 --reload > backend.log 2>&1 &
sleep 3
echo "Backend restarted. Testing photo upload..."
TOKEN=$(curl -s -X POST http://localhost:8005/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@fairway.com","password":"FairwayAdmin123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
TID=$(curl -s http://localhost:8005/api/tournaments -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); t=[x for x in d if x['status']=='active']; print(t[0]['tournament_id'] if t else 'none')")
python3 -c "from PIL import Image; img=Image.new('RGB',(100,100),'green'); img.save('/tmp/t.jpg','JPEG')" 2>/dev/null
RESULT=$(curl -s -X POST http://localhost:8005/api/tournaments/$TID/feed -H "Authorization: Bearer $TOKEN" -F "file=@/tmp/t.jpg" -F "caption=test")
echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Photos: OK!' if 'photo_id' in d else f'FAILED: {d}')" 2>/dev/null
