#!/bin/bash
# Seed admin + promote your account
curl -s -X POST http://localhost:8005/api/admin/seed
echo ""

# Promote pzsuave007@gmail.com to admin
python3 << 'EOF'
from pymongo import MongoClient
client = MongoClient("mongodb://localhost:27017")
db = client["onparlive"]
result = db.users.update_one(
    {"email": "pzsuave007@gmail.com"},
    {"$set": {"role": "admin"}}
)
if result.matched_count > 0:
    print("pzsuave007@gmail.com is now ADMIN!")
else:
    print("Account not found. Login first at https://onparlive.com, then run this again.")
client.close()
EOF
