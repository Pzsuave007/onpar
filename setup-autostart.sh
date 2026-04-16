#!/bin/bash
echo "Setting up auto-restart for OnPar Live..."

# Create restart script
cat > /home/onparliveuni2/restart.sh << 'EOF'
#!/bin/bash
cd /opt/onpar/backend
source venv/bin/activate
pkill -f "uvicorn.*8005" 2>/dev/null
sleep 2
nohup uvicorn server:app --host 0.0.0.0 --port 8005 --reload > backend.log 2>&1 &
EOF
chmod +x /home/onparliveuni2/restart.sh

# Add to crontab
(crontab -l 2>/dev/null | grep -v "restart.sh"; echo "@reboot /bin/bash /home/onparliveuni2/restart.sh") | crontab -
echo "Auto-restart configured. Verify: crontab -l"
