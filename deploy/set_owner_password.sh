#!/bin/bash
# OnPar Live — One-time: set a local password on a Google-OAuth-only user.
# Lets the owner sign in with email+password without changing any auth code.
#
# Usage (run once on cPanel):
#   sudo bash deploy/set_owner_password.sh
#
# Idempotent: re-running just rewrites the same hash.

set -e

PROD="/opt/onpar/backend"
EMAIL="pzsuave007@gmail.com"
PASSWORD="MXmedia007"

if [ "$EUID" -ne 0 ]; then
  echo "✗ Run as root: sudo bash deploy/set_owner_password.sh"
  exit 1
fi

if [ ! -d "$PROD/venv" ]; then
  echo "✗ $PROD/venv missing"
  exit 1
fi

cd "$PROD"
# shellcheck disable=SC1091
source venv/bin/activate

python - <<PY
import os, asyncio, bcrypt
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("$PROD/.env")
EMAIL = "$EMAIL"
PASSWORD = "$PASSWORD"

async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    u = await db.users.find_one({"email": EMAIL}, {"_id": 0, "user_id": 1, "name": 1, "password_hash": 1})
    if not u:
        print(f"✗ User '{EMAIL}' not found in MongoDB. Sign in with Google once first.")
        return 1

    pw_hash = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()
    res = await db.users.update_one(
        {"email": EMAIL},
        {"\$set": {"password_hash": pw_hash}}
    )
    had_before = "yes" if u.get("password_hash") else "no"
    print(f"✓ User: {u['name']} ({u['user_id']})")
    print(f"  had a password before: {had_before}")
    print(f"  password updated:      {res.modified_count == 1}")
    print()
    print(f"  → You can now sign in at https://onparlive.com with:")
    print(f"      email:    {EMAIL}")
    print(f"      password: {PASSWORD}")
    print()
    print("  Google OAuth still works. Both methods are valid.")
    return 0

import sys
sys.exit(asyncio.run(main()) or 0)
PY

deactivate
