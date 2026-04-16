#!/bin/bash
apt install -y supervisor
systemctl enable supervisor
systemctl start supervisor
bash /home/onpar/repo/deploy.sh
