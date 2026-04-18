#!/bin/bash
echo "=== Setting up OpenAI API Key ==="
echo "Enter your OpenAI API key (starts with sk-):"
read -p "> " KEY

# Remove old keys, add new one
sed -i '/EMERGENT_LLM_KEY/d' /opt/onpar/backend/.env
sed -i '/OPENAI_API_KEY/d' /opt/onpar/backend/.env
echo "OPENAI_API_KEY=$KEY" >> /opt/onpar/backend/.env

# Set upload directory
sed -i '/UPLOAD_DIR/d' /opt/onpar/backend/.env
echo "UPLOAD_DIR=/home/onparliveuni2/public_html/uploads" >> /opt/onpar/backend/.env

# Create upload directory
mkdir -p /home/onparliveuni2/public_html/uploads/feed
chown -R onparliveuni2:onparliveuni2 /home/onparliveuni2/public_html/uploads

# Install openai SDK
cd /opt/onpar/backend && source venv/bin/activate
pip install openai -q
deactivate

# Restart backend
pkill -f "uvicorn.*8005" 2>/dev/null
sleep 2
cd /opt/onpar/backend && source venv/bin/activate
nohup uvicorn server:app --host 0.0.0.0 --port 8005 --reload > backend.log 2>&1 &
sleep 3

echo ""
echo "=== Testing ==="
TOKEN=$(curl -s -X POST http://localhost:8005/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@fairway.com","password":"FairwayAdmin123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null)
TID=$(curl -s http://localhost:8005/api/tournaments -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); t=[x for x in d if x['status']=='active']; print(t[0]['tournament_id'] if t else 'none')" 2>/dev/null)

python3 -c "from PIL import Image; img=Image.new('RGB',(100,100),'green'); img.save('/tmp/t.jpg','JPEG')" 2>/dev/null
RESULT=$(curl -s -X POST http://localhost:8005/api/tournaments/$TID/feed -H "Authorization: Bearer $TOKEN" -F "file=@/tmp/t.jpg" -F "caption=test" 2>/dev/null)
echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Photos: OK!' if 'photo_id' in d else f'Photos: FAILED - {d}')" 2>/dev/null

echo ""
echo "DONE! No more Emergent keys needed."
echo "Photos saved to: /home/onparliveuni2/public_html/uploads/"
echo "Scanner uses: Your OpenAI API key"
