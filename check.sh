#!/bin/bash
KEY=$(cat /home/onparliveuni2/public_html/keys.txt | tr -d '[:space:]')
sed -i '/EMERGENT_LLM_KEY/d' /opt/onpar/backend/.env
sed -i '/OPENAI_API_KEY/d' /opt/onpar/backend/.env
echo "OPENAI_API_KEY=$KEY" >> /opt/onpar/backend/.env
sed -i '/UPLOAD_DIR/d' /opt/onpar/backend/.env
echo "UPLOAD_DIR=/home/onparliveuni2/public_html/uploads" >> /opt/onpar/backend/.env
mkdir -p /home/onparliveuni2/public_html/uploads/feed
chown -R onparliveuni2:onparliveuni2 /home/onparliveuni2/public_html/uploads
cd /opt/onpar/backend && source venv/bin/activate
pip install openai -q
deactivate
pkill -f "uvicorn.*8005" 2>/dev/null
sleep 2
cd /opt/onpar/backend && source venv/bin/activate
nohup uvicorn server:app --host 0.0.0.0 --port 8005 --reload > backend.log 2>&1 &
sleep 3
echo "Key set: $(grep OPENAI_API_KEY /opt/onpar/backend/.env | cut -c1-25)..."
echo "Done! Now delete the keys file:"
echo "  rm /home/onparliveuni2/public_html/keys.txt"
