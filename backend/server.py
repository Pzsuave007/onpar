from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import uuid
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta
from openai import OpenAI
from PIL import Image, ImageOps
import io
import base64 as b64_module

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', uuid.uuid4().hex)

# --- Local File Storage ---
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/home/onparliveuni2/public_html/uploads")
UPLOAD_URL_PREFIX = "/uploads"

def save_local_file(subpath: str, data: bytes) -> str:
    full_path = os.path.join(UPLOAD_DIR, subpath)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(data)
    return f"{UPLOAD_URL_PREFIX}/{subpath}"

def read_local_file(subpath: str):
    full_path = os.path.join(UPLOAD_DIR, subpath)
    if not os.path.exists(full_path):
        return None
    with open(full_path, "rb") as f:
        return f.read()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# --- Pydantic Models ---
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class TournamentCreate(BaseModel):
    name: str
    course_name: str
    start_date: str
    end_date: str
    scoring_format: str
    num_holes: int = 18
    num_rounds: int = 1
    par_per_hole: List[int]
    max_players: int = 100
    description: str = ""
    visibility: str = "private"

class TournamentUpdate(BaseModel):
    name: Optional[str] = None
    course_name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    scoring_format: Optional[str] = None
    status: Optional[str] = None
    num_rounds: Optional[int] = None
    max_players: Optional[int] = None
    description: Optional[str] = None
    visibility: Optional[str] = None

class HoleScore(BaseModel):
    hole: int
    strokes: int
    par: int

class ScorecardSubmit(BaseModel):
    tournament_id: str
    round_number: int = 1
    holes: List[HoleScore]

class KeeperScoreSubmit(BaseModel):
    tournament_id: str
    user_id: str
    round_number: int = 1
    holes: List[HoleScore]

class ChallengeCreate(BaseModel):
    name: str
    course_ids: List[str]
    visibility: str = "private"

class ChallengeRoundLog(BaseModel):
    course_id: str
    holes: List[HoleScore]

# --- Auth Helpers ---
def create_jwt(user_id: str) -> str:
    return jwt.encode(
        {"user_id": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7)},
        JWT_SECRET, algorithm="HS256"
    )

async def get_current_user(request: Request) -> dict:
    # Check cookie first
    session_token = request.cookies.get("session_token")
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = session["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
                if user:
                    return user

    # Check Authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
            if user:
                return user
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            pass
        # Try as session token
        session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if session:
            expires_at = session["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
                if user:
                    return user

    raise HTTPException(status_code=401, detail="Not authenticated")

async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def get_optional_user(request: Request):
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

def user_response(user: dict) -> dict:
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "player"),
        "handicap": user.get("handicap"),
        "picture": user.get("picture"),
    }

# --- Auth Endpoints ---
@api_router.post("/auth/register")
async def register(req: RegisterRequest):
    existing = await db.users.find_one({"email": req.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    password_hash = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    user_doc = {
        "user_id": user_id, "email": req.email, "name": req.name,
        "password_hash": password_hash, "role": "player",
        "handicap": None, "picture": None, "auth_type": "email",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_jwt(user_id)
    return {"token": token, "user": user_response(user_doc)}

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not bcrypt.checkpw(req.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_jwt(user["user_id"])
    return {"token": token, "user": user_response(user)}

@api_router.get("/auth/session")
async def exchange_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = resp.json()

    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data["name"], "picture": data.get("picture")}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": data["email"], "name": data["name"],
            "role": "player", "handicap": None, "picture": data.get("picture"),
            "auth_type": "google", "created_at": datetime.now(timezone.utc).isoformat()
        })

    session_token = data.get("session_token", f"sess_{uuid.uuid4().hex}")
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user_response(user)

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user_response(user)

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    return {"message": "Logged out"}

# --- Admin Seed ---
@api_router.post("/admin/seed")
async def seed_admin():
    existing = await db.users.find_one({"role": "admin"}, {"_id": 0})
    if existing:
        return {"message": "Admin already exists", "email": existing["email"]}
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    pw = bcrypt.hashpw("FairwayAdmin123!".encode(), bcrypt.gensalt()).decode()
    await db.users.insert_one({
        "user_id": user_id, "email": "admin@fairway.com", "name": "Tournament Admin",
        "password_hash": pw, "role": "admin", "handicap": None, "picture": None,
        "auth_type": "email", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Admin created", "email": "admin@fairway.com"}

# --- Tournament Endpoints ---
@api_router.get("/tournaments")
async def list_tournaments(request: Request):
    user = await get_optional_user(request)
    all_tournaments = await db.tournaments.find({}, {"_id": 0}).sort("start_date", -1).to_list(100)
    reg_counts = {}
    async for doc in db.registrations.aggregate([
        {"$group": {"_id": "$tournament_id", "count": {"$sum": 1}}}
    ]):
        reg_counts[doc["_id"]] = doc["count"]
    # Filter: show public + ones user is registered in or created
    visible = []
    user_reg_tids = set()
    if user:
        regs = await db.registrations.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
        user_reg_tids = {r["tournament_id"] for r in regs}
    for t in all_tournaments:
        t["participant_count"] = reg_counts.get(t["tournament_id"], 0)
        is_public = t.get("visibility", "private") == "public"
        is_mine = user and (t["tournament_id"] in user_reg_tids or t.get("created_by") == user.get("user_id"))
        is_admin = user and user.get("role") == "admin"
        if is_public or is_mine or is_admin:
            visible.append(t)
    return visible

@api_router.get("/tournaments/{tournament_id}")
async def get_tournament(tournament_id: str):
    t = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    t["participant_count"] = await db.registrations.count_documents({"tournament_id": tournament_id})
    return t

@api_router.post("/tournaments")
async def create_tournament(data: TournamentCreate, request: Request):
    admin = await get_admin_user(request)
    tid = f"tourn_{uuid.uuid4().hex[:12]}"
    invite_code = uuid.uuid4().hex[:6].upper()
    doc = {
        "tournament_id": tid, **data.model_dump(),
        "total_par": sum(data.par_per_hole), "status": "upcoming",
        "invite_code": invite_code,
        "created_by": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tournaments.insert_one(doc)
    return await db.tournaments.find_one({"tournament_id": tid}, {"_id": 0})

@api_router.put("/tournaments/{tournament_id}")
async def update_tournament(tournament_id: str, data: TournamentUpdate, request: Request):
    await get_admin_user(request)
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.tournaments.update_one({"tournament_id": tournament_id}, {"$set": updates})
    t = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return t

@api_router.delete("/tournaments/{tournament_id}")
async def delete_tournament(tournament_id: str, request: Request):
    await get_admin_user(request)
    result = await db.tournaments.delete_one({"tournament_id": tournament_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tournament not found")
    await db.scorecards.delete_many({"tournament_id": tournament_id})
    await db.registrations.delete_many({"tournament_id": tournament_id})
    return {"message": "Tournament deleted"}

@api_router.get("/tournaments/invite/{invite_code}")
async def get_tournament_by_invite(invite_code: str):
    t = await db.tournaments.find_one({"invite_code": invite_code.upper()}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    return t

# --- Registration Endpoints ---
@api_router.post("/tournaments/{tournament_id}/register")
async def register_for_tournament(tournament_id: str, request: Request):
    user = await get_current_user(request)
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament["status"] not in ["upcoming", "active"]:
        raise HTTPException(status_code=400, detail="Registration closed")
    existing = await db.registrations.find_one(
        {"tournament_id": tournament_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already registered")
    count = await db.registrations.count_documents({"tournament_id": tournament_id})
    if count >= tournament.get("max_players", 100):
        raise HTTPException(status_code=400, detail="Tournament is full")
    reg_id = f"reg_{uuid.uuid4().hex[:12]}"
    await db.registrations.insert_one({
        "registration_id": reg_id, "tournament_id": tournament_id,
        "user_id": user["user_id"], "player_name": user["name"],
        "registered_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Registered successfully", "registration_id": reg_id}

@api_router.delete("/tournaments/{tournament_id}/unregister")
async def unregister_from_tournament(tournament_id: str, request: Request):
    user = await get_current_user(request)
    has_scores = await db.scorecards.find_one(
        {"tournament_id": tournament_id, "user_id": user["user_id"]}
    )
    if has_scores:
        raise HTTPException(status_code=400, detail="Cannot unregister after submitting scores")
    result = await db.registrations.delete_one(
        {"tournament_id": tournament_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not registered")
    return {"message": "Unregistered successfully"}

@api_router.get("/tournaments/{tournament_id}/participants")
async def get_participants(tournament_id: str):
    return await db.registrations.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(1000)

@api_router.get("/registrations/my")
async def get_my_registrations(request: Request):
    user = await get_current_user(request)
    regs = await db.registrations.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    return [r["tournament_id"] for r in regs]

# --- Scorecard Endpoints ---
def calc_stableford(strokes: int, par: int) -> int:
    diff = strokes - par
    if diff >= 2: return 0
    if diff == 1: return 1
    if diff == 0: return 2
    if diff == -1: return 3
    if diff == -2: return 4
    return 5

# --- Live Scorer / Keeper Endpoints ---
@api_router.post("/tournaments/{tournament_id}/add-player")
async def add_player_to_tournament(tournament_id: str, request: Request):
    await get_admin_user(request)
    body = await request.json()
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Player name required")
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    user_id = f"guest_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id, "email": f"{user_id}@guest.fairway",
        "name": name, "role": "player", "handicap": None, "picture": None,
        "auth_type": "guest", "created_at": datetime.now(timezone.utc).isoformat()
    })
    reg_id = f"reg_{uuid.uuid4().hex[:12]}"
    await db.registrations.insert_one({
        "registration_id": reg_id, "tournament_id": tournament_id,
        "user_id": user_id, "player_name": name,
        "registered_at": datetime.now(timezone.utc).isoformat()
    })
    return {"user_id": user_id, "name": name, "registration_id": reg_id}

@api_router.put("/tournaments/{tournament_id}/player/{user_id}")
async def rename_player(tournament_id: str, user_id: str, request: Request):
    await get_admin_user(request)
    body = await request.json()
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    await db.users.update_one({"user_id": user_id}, {"$set": {"name": name}})
    await db.registrations.update_one(
        {"tournament_id": tournament_id, "user_id": user_id},
        {"$set": {"player_name": name}}
    )
    await db.scorecards.update_many(
        {"tournament_id": tournament_id, "user_id": user_id},
        {"$set": {"player_name": name}}
    )
    return {"message": "Player renamed", "name": name}

@api_router.delete("/tournaments/{tournament_id}/player/{user_id}")
async def remove_player(tournament_id: str, user_id: str, request: Request):
    await get_admin_user(request)
    await db.registrations.delete_one({"tournament_id": tournament_id, "user_id": user_id})
    await db.scorecards.delete_many({"tournament_id": tournament_id, "user_id": user_id})
    return {"message": "Player removed"}

@api_router.post("/scorecards/keeper")
async def keeper_submit_scorecard(data: KeeperScoreSubmit, request: Request):
    await get_admin_user(request)
    tournament = await db.tournaments.find_one({"tournament_id": data.tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    reg = await db.registrations.find_one(
        {"tournament_id": data.tournament_id, "user_id": data.user_id}
    )
    if not reg:
        raise HTTPException(status_code=403, detail="Player not registered for this tournament")
    max_rounds = tournament.get("num_rounds", 1)
    if data.round_number < 1 or data.round_number > max_rounds:
        raise HTTPException(status_code=400, detail="Invalid round number")
    player = await db.users.find_one({"user_id": data.user_id}, {"_id": 0})
    player_name = player["name"] if player else reg.get("player_name", "Unknown")

    existing = await db.scorecards.find_one({
        "tournament_id": data.tournament_id, "user_id": data.user_id,
        "round_number": data.round_number
    }, {"_id": 0})

    holes_data = [h.model_dump() for h in data.holes]
    played = [h for h in holes_data if h["strokes"] > 0]
    total_strokes = sum(h["strokes"] for h in played)
    total_par = sum(h["par"] for h in played)
    total_to_par = total_strokes - total_par
    stableford_points = sum(calc_stableford(h["strokes"], h["par"]) for h in played)
    completed = len(played)
    status = "submitted" if completed == len(holes_data) else "in_progress"

    if existing:
        await db.scorecards.update_one(
            {"scorecard_id": existing["scorecard_id"]},
            {"$set": {
                "holes": holes_data, "total_strokes": total_strokes,
                "total_to_par": total_to_par, "stableford_points": stableford_points,
                "status": status, "completed_holes": completed,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return await db.scorecards.find_one({"scorecard_id": existing["scorecard_id"]}, {"_id": 0})

    sc_id = f"sc_{uuid.uuid4().hex[:12]}"
    doc = {
        "scorecard_id": sc_id, "tournament_id": data.tournament_id,
        "user_id": data.user_id, "player_name": player_name,
        "round_number": data.round_number, "holes": holes_data,
        "total_strokes": total_strokes, "total_to_par": total_to_par,
        "stableford_points": stableford_points, "status": status,
        "completed_holes": completed,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.scorecards.insert_one(doc)
    return await db.scorecards.find_one({"scorecard_id": sc_id}, {"_id": 0})

@api_router.get("/tournaments/{tournament_id}/roster")
async def get_tournament_roster(tournament_id: str):
    regs = await db.registrations.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(1000)
    user_ids = [r["user_id"] for r in regs]
    users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(1000)
    user_map = {u["user_id"]: u for u in users}
    roster = []
    for r in regs:
        u = user_map.get(r["user_id"], {})
        roster.append({
            "user_id": r["user_id"], "player_name": r["player_name"],
            "auth_type": u.get("auth_type", "unknown"),
            "registered_at": r["registered_at"]
        })
    return roster

@api_router.post("/scorecards")
async def submit_scorecard(data: ScorecardSubmit, request: Request):
    user = await get_current_user(request)
    tournament = await db.tournaments.find_one({"tournament_id": data.tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    # Check registration
    reg = await db.registrations.find_one(
        {"tournament_id": data.tournament_id, "user_id": user["user_id"]}
    )
    if not reg:
        raise HTTPException(status_code=403, detail="Register for this tournament first")
    # Validate round number
    max_rounds = tournament.get("num_rounds", 1)
    if data.round_number < 1 or data.round_number > max_rounds:
        raise HTTPException(status_code=400, detail=f"Invalid round. Tournament has {max_rounds} round(s)")

    existing = await db.scorecards.find_one({
        "tournament_id": data.tournament_id, "user_id": user["user_id"],
        "round_number": data.round_number
    }, {"_id": 0})

    holes_data = [h.model_dump() for h in data.holes]
    played = [h for h in holes_data if h["strokes"] > 0]
    total_strokes = sum(h["strokes"] for h in played)
    total_par = sum(h["par"] for h in played)
    total_to_par = total_strokes - total_par
    stableford_points = sum(calc_stableford(h["strokes"], h["par"]) for h in played)
    completed = len(played)
    status = "submitted" if completed == len(holes_data) else "in_progress"

    if existing:
        await db.scorecards.update_one(
            {"scorecard_id": existing["scorecard_id"]},
            {"$set": {
                "holes": holes_data, "total_strokes": total_strokes,
                "total_to_par": total_to_par, "stableford_points": stableford_points,
                "status": status, "completed_holes": completed,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return await db.scorecards.find_one({"scorecard_id": existing["scorecard_id"]}, {"_id": 0})

    sc_id = f"sc_{uuid.uuid4().hex[:12]}"
    doc = {
        "scorecard_id": sc_id, "tournament_id": data.tournament_id,
        "user_id": user["user_id"], "player_name": user["name"],
        "round_number": data.round_number, "holes": holes_data,
        "total_strokes": total_strokes, "total_to_par": total_to_par,
        "stableford_points": stableford_points, "status": status,
        "completed_holes": completed,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.scorecards.insert_one(doc)
    return await db.scorecards.find_one({"scorecard_id": sc_id}, {"_id": 0})

@api_router.get("/scorecards/my")
async def get_my_scorecards(request: Request):
    user = await get_current_user(request)
    return await db.scorecards.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)

@api_router.get("/scorecards/tournament/{tournament_id}/all")
async def get_all_tournament_scorecards(tournament_id: str, request: Request):
    await get_admin_user(request)
    return await db.scorecards.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(1000)

@api_router.get("/scorecards/tournament/{tournament_id}/my")
async def get_my_tournament_scorecards(tournament_id: str, request: Request):
    user = await get_current_user(request)
    scorecards = await db.scorecards.find(
        {"tournament_id": tournament_id, "user_id": user["user_id"]},
        {"_id": 0}
    ).sort("round_number", 1).to_list(20)
    return scorecards

# --- Leaderboard (Public for public tournaments, auth-required for private) ---
@api_router.get("/leaderboard/{tournament_id}")
async def get_leaderboard(tournament_id: str, request: Request):
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    # Access control for private tournaments
    if tournament.get("visibility", "private") == "private":
        user = await get_optional_user(request)
        if not user:
            raise HTTPException(status_code=403, detail="This tournament is private")
        is_admin = user.get("role") == "admin"
        is_registered = await db.registrations.find_one(
            {"tournament_id": tournament_id, "user_id": user["user_id"]}
        )
        if not is_admin and not is_registered:
            raise HTTPException(status_code=403, detail="This tournament is private")

    scorecards = await db.scorecards.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(1000)
    # Fetch player pictures
    user_ids = list(set(sc["user_id"] for sc in scorecards))
    users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(1000)
    user_map = {u["user_id"]: u for u in users}

    players = {}
    for sc in scorecards:
        uid = sc["user_id"]
        if uid not in players:
            u = user_map.get(uid, {})
            players[uid] = {
                "user_id": uid, "player_name": sc["player_name"],
                "picture": u.get("picture"),
                "rounds": [], "total_strokes": 0, "total_to_par": 0,
                "stableford_points": 0, "thru": "0"
            }
        played = [h for h in sc["holes"] if h["strokes"] > 0]
        round_strokes = sum(h["strokes"] for h in played)
        round_par = sum(h["par"] for h in played)
        players[uid]["rounds"].append({
            "round_number": sc["round_number"],
            "strokes": round_strokes, "to_par": round_strokes - round_par,
            "stableford": sc.get("stableford_points", 0),
            "thru": len(played), "total_holes": len(sc["holes"]),
            "status": sc["status"],
            "holes": sc["holes"]
        })
        players[uid]["total_strokes"] += round_strokes
        players[uid]["total_to_par"] += (round_strokes - round_par)
        players[uid]["stableford_points"] += sc.get("stableford_points", 0)

    for uid, data in players.items():
        latest = max(data["rounds"], key=lambda r: r["round_number"])
        data["thru"] = "F" if latest["thru"] == latest["total_holes"] else str(latest["thru"])

    leaderboard = list(players.values())
    if tournament.get("scoring_format") == "stableford":
        leaderboard.sort(key=lambda x: x["stableford_points"], reverse=True)
    else:
        leaderboard.sort(key=lambda x: x["total_to_par"])

    # Handle ties
    for i, entry in enumerate(leaderboard):
        if i == 0:
            entry["position"] = 1
            entry["tied"] = False
        else:
            prev = leaderboard[i - 1]
            is_stroke = tournament.get("scoring_format") != "stableford"
            same = (entry["total_to_par"] == prev["total_to_par"]) if is_stroke else (entry["stableford_points"] == prev["stableford_points"])
            if same:
                entry["position"] = prev["position"]
                entry["tied"] = True
                prev["tied"] = True
            else:
                entry["position"] = i + 1
                entry["tied"] = False

    return {"tournament": tournament, "leaderboard": leaderboard}

# --- Player Management ---
@api_router.get("/players")
async def list_players(request: Request):
    await get_admin_user(request)
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)

@api_router.put("/players/{user_id}/role")
async def update_role(user_id: str, request: Request):
    await get_admin_user(request)
    body = await request.json()
    role = body.get("role")
    if role not in ["admin", "player"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    result = await db.users.update_one({"user_id": user_id}, {"$set": {"role": role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"Role updated to {role}"}

@api_router.put("/profile")
async def update_profile(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    updates = {}
    if "name" in body:
        updates["name"] = body["name"]
    if "handicap" in body:
        updates["handicap"] = body["handicap"]
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    result = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return result

@api_router.post("/profile/avatar")
async def upload_avatar(request: Request, file: UploadFile = File(...)):
    user = await get_current_user(request)
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
        img.thumbnail((300, 300), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format='WEBP', quality=75)
        data = buf.getvalue()
    except Exception:
        pass
    subpath = f"avatars/{user['user_id']}.webp"
    try:
        url_path = save_local_file(subpath, data)
    except Exception as e:
        logger.error(f"Avatar save failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save avatar")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"picture": url_path}})
    return {"picture": url_path}

@api_router.get("/profile/stats")
async def get_my_stats(request: Request):
    user = await get_current_user(request)
    uid = user["user_id"]
    # Get all rounds and scorecards
    rounds = await db.rounds.find({"user_id": uid, "status": "completed"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    scorecards = await db.scorecards.find({"user_id": uid, "status": "submitted"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    # Combine all scores for handicap
    all_scores = []
    for r in rounds:
        if r.get("total_to_par") is not None:
            all_scores.append({"to_par": r["total_to_par"], "strokes": r.get("total_strokes", 0),
                               "course": r.get("course_name", ""), "date": r.get("created_at", "")})
    for sc in scorecards:
        all_scores.append({"to_par": sc["total_to_par"], "strokes": sc["total_strokes"],
                           "course": "", "date": sc.get("created_at", "")})
    # Calculate handicap: best 8 of last 20 differentials
    handicap = None
    if len(all_scores) >= 3:
        recent = sorted(all_scores, key=lambda x: x["date"], reverse=True)[:20]
        differentials = sorted([s["to_par"] for s in recent])
        n = min(8, len(differentials))
        best_n = differentials[:n]
        handicap = round(sum(best_n) / n * 0.96, 1)
    # Count birdies and eagles
    total_birdies = 0
    total_eagles = 0
    for r in rounds:
        for h in r.get("holes", []):
            if h.get("strokes", 0) > 0:
                diff = h["strokes"] - h.get("par", 0)
                if diff == -1: total_birdies += 1
                elif diff <= -2: total_eagles += 1
    for sc in scorecards:
        for h in sc.get("holes", []):
            if h.get("strokes", 0) > 0:
                diff = h["strokes"] - h.get("par", 0)
                if diff == -1: total_birdies += 1
                elif diff <= -2: total_eagles += 1
    # Challenges
    challenges = await db.challenges.find(
        {"participants.user_id": uid}, {"_id": 0, "challenge_id": 1, "name": 1, "status": 1, "total_holes": 1}
    ).to_list(50)
    for ch in challenges:
        count = await db.challenge_progress.count_documents({"challenge_id": ch["challenge_id"], "user_id": uid})
        ch["completed_holes"] = count
    return {
        "total_rounds": len(rounds) + len(scorecards),
        "avg_to_par": round(sum(s["to_par"] for s in all_scores) / len(all_scores), 1) if all_scores else 0,
        "best_to_par": min((s["to_par"] for s in all_scores), default=0),
        "handicap": handicap,
        "total_birdies": total_birdies,
        "total_eagles": total_eagles,
        "recent_rounds": [{"to_par": s["to_par"], "strokes": s["strokes"], "course": s["course"], "date": s["date"]} for s in all_scores[:10]],
        "challenges": challenges
    }

# --- Player Profile (Public) ---
@api_router.get("/players/{user_id}/profile")
async def get_player_profile(user_id: str):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Player not found")
    scorecards = await db.scorecards.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    submitted = [s for s in scorecards if s["status"] == "submitted"]
    tournament_ids = list(set(s["tournament_id"] for s in scorecards))
    tournaments = await db.tournaments.find(
        {"tournament_id": {"$in": tournament_ids}}, {"_id": 0}
    ).to_list(100)
    t_map = {t["tournament_id"]: t for t in tournaments}
    stats = {
        "total_rounds": len(submitted),
        "tournaments_played": len(tournament_ids),
        "avg_to_par": round(sum(s["total_to_par"] for s in submitted) / len(submitted), 1) if submitted else 0,
        "best_to_par": min((s["total_to_par"] for s in submitted), default=0),
        "avg_strokes": round(sum(s["total_strokes"] for s in submitted) / len(submitted), 1) if submitted else 0,
        "best_strokes": min((s["total_strokes"] for s in submitted), default=0),
    }
    history = []
    for sc in scorecards[:20]:
        t = t_map.get(sc["tournament_id"], {})
        history.append({
            "scorecard_id": sc["scorecard_id"], "tournament_name": t.get("name", "Unknown"),
            "course_name": t.get("course_name", ""), "scoring_format": t.get("scoring_format", "stroke"),
            "round_number": sc["round_number"], "total_strokes": sc["total_strokes"],
            "total_to_par": sc["total_to_par"], "stableford_points": sc.get("stableford_points", 0),
            "status": sc["status"], "date": sc.get("created_at", "")
        })
    return {"player": user_response(user), "stats": stats, "history": history}

# --- Golf Course Endpoints ---
SCORECARD_SCAN_PROMPT = """You are reading a golf scorecard photo. The image may be ROTATED (90, 180, or 270 degrees) - first determine the correct orientation by finding the HOLE row/column which goes 1,2,3...9,OUT,10,11...18,IN,TOT.

CRITICAL RULES:
1. Find the PAR row - it contains ONLY values of 3, 4, or 5 for each hole
2. The OUT total (front 9 par) should be 34-37 typically
3. The IN total (back 9 par) should be 34-37 typically  
4. TOTAL par for 18 holes is typically 70-72
5. VERIFY your par values add up to the printed OUT and IN totals on the card
6. Read the Blue (longest), White (middle), and Red/Gold (shortest) tee yardages
7. Blue yardages > White yardages > Red yardages for the SAME hole
8. VERIFY yardage totals match the printed totals on the card

Extract ONLY 3 tees: Blue, White, Red (if card says Gold/Red or just Red, use "Red").

Return ONLY valid JSON (no markdown, no code blocks):
{
  "course_name": "Name from the scorecard",
  "num_holes": 18,
  "tees": [
    {
      "name": "Blue", "color": "blue", "total_yardage": 6293,
      "holes": [{"hole": 1, "par": 4, "yardage": 406}, {"hole": 2, "par": 3, "yardage": 163}]
    },
    {
      "name": "White", "color": "white", "total_yardage": 5987,
      "holes": [{"hole": 1, "par": 4, "yardage": 379}, {"hole": 2, "par": 3, "yardage": 145}]
    },
    {
      "name": "Red", "color": "red", "total_yardage": 5105,
      "holes": [{"hole": 1, "par": 4, "yardage": 342}, {"hole": 2, "par": 3, "yardage": 126}]
    }
  ]
}

DOUBLE-CHECK: Sum your par values for front 9 and back 9. They MUST match the OUT and IN totals printed on the card. If they don't, re-read the par values.
Return ONLY the JSON."""

@api_router.post("/courses/scan")
async def scan_scorecard(request: Request):
    await get_admin_user(request)
    body = await request.json()
    image_base64 = body.get("image_base64", "")
    if not image_base64:
        raise HTTPException(status_code=400, detail="Image required")
    # Strip data URL prefix if present
    if "base64," in image_base64:
        image_base64 = image_base64.split("base64,")[1]
    # Pre-process: auto-rotate image based on EXIF and ensure landscape
    try:
        img_bytes = b64_module.b64decode(image_base64)
        img = Image.open(io.BytesIO(img_bytes))
        img = ImageOps.exif_transpose(img)  # Fix EXIF rotation
        # If portrait (taller than wide), rotate to landscape
        if img.height > img.width:
            img = img.rotate(90, expand=True)
        # Resize if too large (keep quality but reduce tokens)
        max_dim = 2048
        if max(img.width, img.height) > max_dim:
            img.thumbnail((max_dim, max_dim), Image.LANCZOS)
        # Convert back to base64
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=90)
        image_base64 = b64_module.b64encode(buf.getvalue()).decode()
        logger.info(f"Image preprocessed: {img.width}x{img.height}")
    except Exception as e:
        logger.warning(f"Image preprocessing failed: {e}, using original")
    try:
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        if not openai_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        client = OpenAI(api_key=openai_key)
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert at reading golf scorecards. You are extremely careful and precise with numbers. You always verify totals add up correctly before returning results. The scorecard image may be rotated - determine orientation first."},
                {"role": "user", "content": [
                    {"type": "text", "text": SCORECARD_SCAN_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
                ]}
            ],
            max_tokens=4096
        )
        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            text = text.rsplit("```", 1)[0]
        parsed = json.loads(text)
        # Server-side validation
        for tee in parsed.get("tees", []):
            holes = tee.get("holes", [])
            if holes:
                tee["total_par"] = sum(h.get("par", 0) for h in holes)
                tee["total_yardage"] = sum(h.get("yardage", 0) for h in holes)
        return parsed
    except json.JSONDecodeError:
        logger.error(f"AI returned non-JSON: {response[:200] if response else 'empty'}")
        raise HTTPException(status_code=422, detail="Could not parse scorecard. Try a clearer photo.")
    except Exception as e:
        logger.error(f"Scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")

@api_router.post("/courses")
async def save_course(request: Request):
    user = await get_admin_user(request)
    body = await request.json()
    course_id = f"course_{uuid.uuid4().hex[:12]}"
    tees = body.get("tees", [])
    # Backward compat: if old format with flat "holes", convert to single tee
    if not tees and body.get("holes"):
        tees = [{
            "name": "Default", "color": "white",
            "holes": body["holes"],
            "total_yardage": sum(h.get("yardage", 0) for h in body["holes"])
        }]
    # Compute total_par per tee
    for tee in tees:
        tee["total_par"] = sum(h.get("par", 0) for h in tee.get("holes", []))
    num_holes = len(tees[0]["holes"]) if tees and tees[0].get("holes") else body.get("num_holes", 18)
    doc = {
        "course_id": course_id,
        "course_name": body.get("course_name", "Unknown Course"),
        "num_holes": num_holes,
        "tees": tees,
        "total_par": tees[0]["total_par"] if tees else 0,
        # Keep flat "holes" from first tee for backward compat
        "holes": tees[0]["holes"] if tees else [],
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.golf_courses.insert_one(doc)
    return await db.golf_courses.find_one({"course_id": course_id}, {"_id": 0})

@api_router.get("/courses")
async def list_courses():
    return await db.golf_courses.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)

@api_router.get("/courses/{course_id}")
async def get_course(course_id: str):
    c = await db.golf_courses.find_one({"course_id": course_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    return c

@api_router.delete("/courses/{course_id}")
async def delete_course(course_id: str, request: Request):
    await get_admin_user(request)
    result = await db.golf_courses.delete_one({"course_id": course_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"message": "Course deleted"}

# --- AI Course Search ---
COURSE_SEARCH_PROMPT = """Search for the golf scorecard for this course. I need the EXACT data for each hole.

Return ONLY a JSON object in this format (no markdown, no explanation):
{
  "course_name": "Full Official Course Name",
  "location": "City, State",
  "num_holes": 18,
  "tees": [
    {
      "name": "Blue",
      "color": "#1E40AF",
      "holes": [{"hole": 1, "par": 4, "yards": 385}, ...for all holes],
      "total_par": 72,
      "total_yardage": 6500
    },
    {
      "name": "White",
      "color": "#FFFFFF",
      "holes": [{"hole": 1, "par": 4, "yards": 360}, ...for all holes],
      "total_par": 72,
      "total_yardage": 6100
    },
    {
      "name": "Red",
      "color": "#DC2626",
      "holes": [{"hole": 1, "par": 4, "yards": 310}, ...for all holes],
      "total_par": 72,
      "total_yardage": 5200
    }
  ]
}

Include ALL available tees (Blue/Championship, White/Men's, Red/Women's, Gold/Senior, etc).
If yardage is not found for a tee, omit that tee.
Every tee MUST have data for ALL holes.
Double check that total_par and total_yardage match the sum of individual holes.
"""

@api_router.post("/courses/search")
async def ai_search_course(request: Request):
    await get_admin_user(request)
    body = await request.json()
    query = body.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Course name required")
    
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    if not openai_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    try:
        client = OpenAI(api_key=openai_key)
        response = client.chat.completions.create(
            model="gpt-4o-search-preview",
            web_search_options={"search_context_size": "high"},
            messages=[
                {"role": "system", "content": "You are a golf course data expert. You search the web for accurate scorecard data. Always return valid JSON only."},
                {"role": "user", "content": f"Find the scorecard for: {query}\n\n{COURSE_SEARCH_PROMPT}"}
            ]
        )
        text = response.choices[0].message.content.strip()
        # Extract JSON
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        data = json.loads(text)
        return {"status": "found", "data": data}
    except json.JSONDecodeError:
        logger.error(f"AI search returned non-JSON: {text[:200]}")
        return {"status": "error", "message": "Could not parse course data. Try a more specific name."}
    except Exception as e:
        logger.error(f"AI course search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@api_router.put("/courses/{course_id}")
async def update_course(course_id: str, request: Request):
    await get_admin_user(request)
    body = await request.json()
    existing = await db.golf_courses.find_one({"course_id": course_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Course not found")
    tees = body.get("tees", existing.get("tees", []))
    for tee in tees:
        tee["total_par"] = sum(h.get("par", 0) for h in tee.get("holes", []))
    updates = {
        "course_name": body.get("course_name", existing["course_name"]),
        "tees": tees,
        "total_par": tees[0]["total_par"] if tees else existing.get("total_par", 0),
        "holes": tees[0]["holes"] if tees else existing.get("holes", []),
        "num_holes": len(tees[0]["holes"]) if tees and tees[0].get("holes") else existing.get("num_holes", 18),
    }
    await db.golf_courses.update_one({"course_id": course_id}, {"$set": updates})
    return await db.golf_courses.find_one({"course_id": course_id}, {"_id": 0})

# --- Play Round (Personal Rounds + Auto-Challenge Update) ---
@api_router.post("/rounds")
async def save_round(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    course_id = body.get("course_id")
    holes = body.get("holes", [])
    round_id = body.get("round_id")

    course = await db.golf_courses.find_one({"course_id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    played = [h for h in holes if h.get("strokes", 0) > 0]
    total_strokes = sum(h["strokes"] for h in played)
    total_par = sum(h["par"] for h in played)
    total_to_par = total_strokes - total_par
    completed = len(played)
    status = "completed" if completed == len(holes) else "in_progress"

    if round_id:
        await db.rounds.update_one({"round_id": round_id}, {"$set": {
            "holes": holes, "total_strokes": total_strokes,
            "total_to_par": total_to_par, "status": status,
            "completed_holes": completed,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }})
    else:
        round_id = f"round_{uuid.uuid4().hex[:12]}"
        await db.rounds.insert_one({
            "round_id": round_id, "user_id": user["user_id"],
            "player_name": user["name"], "course_id": course_id,
            "course_name": course["course_name"],
            "holes": holes, "total_strokes": total_strokes,
            "total_to_par": total_to_par, "status": status,
            "completed_holes": completed,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })

    # Auto-update active challenges
    new_birdies = []
    if played:
        active_challenges = await db.challenges.find(
            {"status": "active", "participants.user_id": user["user_id"],
             "courses_info.course_id": course_id}, {"_id": 0}
        ).to_list(50)
        for ch in active_challenges:
            for h in played:
                if h["strokes"] < h["par"]:
                    existing = await db.challenge_progress.find_one({
                        "challenge_id": ch["challenge_id"], "user_id": user["user_id"],
                        "course_id": course_id, "hole_number": h["hole"]
                    })
                    if not existing:
                        await db.challenge_progress.insert_one({
                            "progress_id": f"prog_{uuid.uuid4().hex[:12]}",
                            "challenge_id": ch["challenge_id"], "user_id": user["user_id"],
                            "course_id": course_id, "hole_number": h["hole"],
                            "par": h["par"], "strokes": h["strokes"],
                            "completed_at": datetime.now(timezone.utc).isoformat()
                        })
                        new_birdies.append({"challenge": ch["name"], "hole": h["hole"]})
            # Check winner
            total_done = await db.challenge_progress.count_documents(
                {"challenge_id": ch["challenge_id"], "user_id": user["user_id"]}
            )
            if total_done >= ch["total_holes"] and not ch.get("winner_id"):
                await db.challenges.update_one(
                    {"challenge_id": ch["challenge_id"]},
                    {"$set": {"winner_id": user["user_id"], "winner_name": user["name"], "status": "completed"}}
                )

    result = await db.rounds.find_one({"round_id": round_id}, {"_id": 0})
    result["new_challenge_birdies"] = new_birdies
    return result

@api_router.get("/rounds/my")
async def get_my_rounds(request: Request):
    user = await get_current_user(request)
    return await db.rounds.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)

@api_router.get("/rounds/course/{course_id}")
async def get_my_course_rounds(course_id: str, request: Request):
    user = await get_current_user(request)
    return await db.rounds.find(
        {"user_id": user["user_id"], "course_id": course_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)

# --- Birdie Challenge Endpoints ---
@api_router.post("/challenges")
async def create_challenge(data: ChallengeCreate, request: Request):
    user = await get_current_user(request)
    if not data.course_ids:
        raise HTTPException(status_code=400, detail="Select at least one course")
    courses = await db.golf_courses.find(
        {"course_id": {"$in": data.course_ids}}, {"_id": 0}
    ).to_list(20)
    if len(courses) != len(data.course_ids):
        raise HTTPException(status_code=404, detail="One or more courses not found")
    total_holes = sum(len(c.get("holes", [])) for c in courses)
    cid = f"chal_{uuid.uuid4().hex[:12]}"
    invite_code = uuid.uuid4().hex[:6].upper()
    doc = {
        "challenge_id": cid, "name": data.name, "type": "birdie_challenge",
        "course_ids": data.course_ids,
        "courses_info": [{"course_id": c["course_id"], "course_name": c["course_name"],
                          "num_holes": len(c.get("holes", [])), "holes": c.get("holes", [])} for c in courses],
        "total_holes": total_holes, "status": "active",
        "visibility": data.visibility, "invite_code": invite_code,
        "participants": [{"user_id": user["user_id"], "player_name": user["name"], "joined_at": datetime.now(timezone.utc).isoformat()}],
        "winner_id": None, "winner_name": None,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.challenges.insert_one(doc)
    return await db.challenges.find_one({"challenge_id": cid}, {"_id": 0})

@api_router.get("/challenges")
async def list_challenges(request: Request):
    user = await get_optional_user(request)
    all_challenges = await db.challenges.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    # Add progress counts
    for ch in all_challenges:
        for p in ch.get("participants", []):
            count = await db.challenge_progress.count_documents(
                {"challenge_id": ch["challenge_id"], "user_id": p["user_id"]}
            )
            p["completed_holes"] = count
    # Filter by visibility
    visible = []
    for ch in all_challenges:
        is_public = ch.get("visibility", "private") == "public"
        is_participant = user and any(p["user_id"] == user["user_id"] for p in ch.get("participants", []))
        is_creator = user and ch.get("created_by") == user.get("user_id")
        is_admin = user and user.get("role") == "admin"
        if is_public or is_participant or is_creator or is_admin:
            visible.append(ch)
    return visible

@api_router.get("/challenges/{challenge_id}")
async def get_challenge(challenge_id: str):
    ch = await db.challenges.find_one({"challenge_id": challenge_id}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    progress = await db.challenge_progress.find(
        {"challenge_id": challenge_id}, {"_id": 0}
    ).to_list(5000)
    # Group progress by user
    progress_map = {}
    for p in progress:
        uid = p["user_id"]
        if uid not in progress_map:
            progress_map[uid] = []
        progress_map[uid].append({
            "course_id": p["course_id"], "hole_number": p["hole_number"],
            "strokes": p["strokes"], "completed_at": p["completed_at"]
        })
    for p in ch.get("participants", []):
        p["completed_holes"] = len(progress_map.get(p["user_id"], []))
        p["birdied_holes"] = progress_map.get(p["user_id"], [])
    return ch

@api_router.get("/challenges/invite/{invite_code}")
async def get_challenge_by_invite(invite_code: str):
    ch = await db.challenges.find_one({"invite_code": invite_code.upper()}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    return ch

@api_router.post("/challenges/{challenge_id}/join")
async def join_challenge(challenge_id: str, request: Request):
    user = await get_current_user(request)
    ch = await db.challenges.find_one({"challenge_id": challenge_id}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if ch["status"] != "active":
        raise HTTPException(status_code=400, detail="Challenge is not active")
    if any(p["user_id"] == user["user_id"] for p in ch.get("participants", [])):
        raise HTTPException(status_code=400, detail="Already joined")
    await db.challenges.update_one(
        {"challenge_id": challenge_id},
        {"$push": {"participants": {
            "user_id": user["user_id"], "player_name": user["name"],
            "joined_at": datetime.now(timezone.utc).isoformat()
        }}}
    )
    return {"message": "Joined challenge"}

@api_router.post("/challenges/{challenge_id}/remove-player")
async def remove_player_from_challenge(challenge_id: str, request: Request):
    user = await get_current_user(request)
    body = await request.json()
    target_uid = body.get("user_id", "")
    ch = await db.challenges.find_one({"challenge_id": challenge_id}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    # Only creator or admin can remove
    if ch.get("created_by") != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the organizer can remove players")
    await db.challenges.update_one(
        {"challenge_id": challenge_id},
        {"$pull": {"participants": {"user_id": target_uid}}}
    )
    await db.challenge_progress.delete_many({"challenge_id": challenge_id, "user_id": target_uid})
    return {"message": "Player removed"}

@api_router.delete("/challenges/{challenge_id}/birdie")
async def remove_birdie(challenge_id: str, request: Request):
    user = await get_current_user(request)
    body = await request.json()
    target_uid = body.get("user_id", "")
    course_id = body.get("course_id", "")
    hole_number = body.get("hole_number", 0)
    ch = await db.challenges.find_one({"challenge_id": challenge_id}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if ch.get("created_by") != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the organizer can remove birdies")
    result = await db.challenge_progress.delete_one({
        "challenge_id": challenge_id, "user_id": target_uid,
        "course_id": course_id, "hole_number": hole_number
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Birdie not found")
    return {"message": "Birdie removed"}

@api_router.post("/challenges/{challenge_id}/add-player")
async def add_player_to_challenge(challenge_id: str, request: Request):
    await get_admin_user(request)
    body = await request.json()
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    ch = await db.challenges.find_one({"challenge_id": challenge_id}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    user_id = f"guest_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id, "email": f"{user_id}@guest.fairway",
        "name": name, "role": "player", "handicap": None, "picture": None,
        "auth_type": "guest", "created_at": datetime.now(timezone.utc).isoformat()
    })
    await db.challenges.update_one(
        {"challenge_id": challenge_id},
        {"$push": {"participants": {
            "user_id": user_id, "player_name": name,
            "joined_at": datetime.now(timezone.utc).isoformat()
        }}}
    )
    return {"user_id": user_id, "name": name}

@api_router.post("/challenges/{challenge_id}/log-round")
async def log_challenge_round(challenge_id: str, request: Request):
    user = await get_current_user(request)
    body = await request.json()
    course_id = body.get("course_id")
    user_id = body.get("user_id", user["user_id"])
    holes = body.get("holes", [])
    # Admin can log for others
    is_admin = user.get("role") == "admin"
    if user_id != user["user_id"] and not is_admin:
        raise HTTPException(status_code=403, detail="Only admin can log for others")
    ch = await db.challenges.find_one({"challenge_id": challenge_id}, {"_id": 0})
    if not ch or ch["status"] != "active":
        raise HTTPException(status_code=400, detail="Challenge not active")
    if not any(p["user_id"] == user_id for p in ch.get("participants", [])):
        raise HTTPException(status_code=403, detail="Player not in challenge")
    # Find course info
    course_info = next((c for c in ch.get("courses_info", []) if c["course_id"] == course_id), None)
    if not course_info:
        raise HTTPException(status_code=404, detail="Course not in this challenge")
    # Process holes - detect birdies
    new_birdies = []
    for h in holes:
        if h.get("strokes", 0) <= 0:
            continue
        par = h.get("par", 4)
        if h["strokes"] < par:  # Birdie or better!
            existing = await db.challenge_progress.find_one({
                "challenge_id": challenge_id, "user_id": user_id,
                "course_id": course_id, "hole_number": h["hole"]
            })
            if not existing:
                await db.challenge_progress.insert_one({
                    "progress_id": f"prog_{uuid.uuid4().hex[:12]}",
                    "challenge_id": challenge_id, "user_id": user_id,
                    "course_id": course_id, "hole_number": h["hole"],
                    "par": par, "strokes": h["strokes"],
                    "completed_at": datetime.now(timezone.utc).isoformat()
                })
                new_birdies.append(h["hole"])
    # Check if player won
    total_completed = await db.challenge_progress.count_documents(
        {"challenge_id": challenge_id, "user_id": user_id}
    )
    won = total_completed >= ch["total_holes"]
    if won and not ch.get("winner_id"):
        player_name = next((p["player_name"] for p in ch["participants"] if p["user_id"] == user_id), "Unknown")
        await db.challenges.update_one(
            {"challenge_id": challenge_id},
            {"$set": {"winner_id": user_id, "winner_name": player_name, "status": "completed"}}
        )
    return {
        "new_birdies": new_birdies, "total_birdies_this_round": len(new_birdies),
        "total_completed": total_completed, "total_needed": ch["total_holes"],
        "won": won
    }

# --- Virtual Tour Endpoints ---
@api_router.post("/tours")
async def create_tour(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    tour_id = f"tour_{uuid.uuid4().hex[:12]}"
    invite_code = uuid.uuid4().hex[:6].upper()
    doc = {
        "tour_id": tour_id, "name": body.get("name", ""),
        "num_rounds": body.get("num_rounds", 5),
        "scoring_format": body.get("scoring_format", "stroke"),
        "status": "active", "invite_code": invite_code,
        "visibility": body.get("visibility", "private"),
        "participants": [{"user_id": user["user_id"], "player_name": user["name"],
                          "joined_at": datetime.now(timezone.utc).isoformat()}],
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tours.insert_one(doc)
    return await db.tours.find_one({"tour_id": tour_id}, {"_id": 0})

@api_router.get("/tours")
async def list_tours(request: Request):
    user = await get_optional_user(request)
    all_tours = await db.tours.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for t in all_tours:
        for p in t.get("participants", []):
            p["rounds_played"] = await db.tour_rounds.count_documents(
                {"tour_id": t["tour_id"], "user_id": p["user_id"]})
    # Filter by visibility
    visible = []
    for t in all_tours:
        is_public = t.get("visibility", "private") == "public"
        is_participant = user and any(p["user_id"] == user["user_id"] for p in t.get("participants", []))
        is_creator = user and t.get("created_by") == user.get("user_id")
        is_admin = user and user.get("role") == "admin"
        if is_public or is_participant or is_creator or is_admin:
            visible.append(t)
    return visible

@api_router.get("/tours/invite/{invite_code}")
async def get_tour_by_invite(invite_code: str):
    tour = await db.tours.find_one({"invite_code": invite_code.upper()}, {"_id": 0})
    if not tour:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    return tour

@api_router.get("/tours/{tour_id}")
async def get_tour(tour_id: str):
    tour = await db.tours.find_one({"tour_id": tour_id}, {"_id": 0})
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")
    rounds = await db.tour_rounds.find({"tour_id": tour_id}, {"_id": 0}).to_list(1000)
    for p in tour.get("participants", []):
        p_rounds = sorted([r for r in rounds if r["user_id"] == p["user_id"]], key=lambda x: x["round_number"])
        p["rounds"] = p_rounds
        p["total_to_par"] = sum(r.get("total_to_par", 0) for r in p_rounds)
        p["total_stableford"] = sum(r.get("stableford_points", 0) for r in p_rounds)
        p["rounds_played"] = len(p_rounds)
    if tour.get("scoring_format") == "stableford":
        tour["participants"].sort(key=lambda x: x.get("total_stableford", 0), reverse=True)
    else:
        tour["participants"].sort(key=lambda x: x.get("total_to_par", 0))
    return tour

@api_router.post("/tours/{tour_id}/join")
async def join_tour(tour_id: str, request: Request):
    user = await get_current_user(request)
    tour = await db.tours.find_one({"tour_id": tour_id}, {"_id": 0})
    if not tour or tour["status"] != "active":
        raise HTTPException(status_code=400, detail="Tour not active")
    if any(p["user_id"] == user["user_id"] for p in tour.get("participants", [])):
        raise HTTPException(status_code=400, detail="Already joined")
    await db.tours.update_one(
        {"tour_id": tour_id},
        {"$push": {"participants": {"user_id": user["user_id"], "player_name": user["name"],
                                     "joined_at": datetime.now(timezone.utc).isoformat()}}}
    )
    return {"message": "Joined tour"}

@api_router.post("/tours/{tour_id}/submit-round")
async def submit_tour_round(tour_id: str, request: Request):
    user = await get_current_user(request)
    body = await request.json()
    round_id = body.get("round_id")
    tour = await db.tours.find_one({"tour_id": tour_id}, {"_id": 0})
    if not tour or tour["status"] != "active":
        raise HTTPException(status_code=400, detail="Tour not active")
    if not any(p["user_id"] == user["user_id"] for p in tour.get("participants", [])):
        raise HTTPException(status_code=403, detail="Not in this tour")
    existing_count = await db.tour_rounds.count_documents({"tour_id": tour_id, "user_id": user["user_id"]})
    if existing_count >= tour.get("num_rounds", 5):
        raise HTTPException(status_code=400, detail="All rounds completed for this tour")
    already = await db.tour_rounds.find_one({"tour_id": tour_id, "round_id": round_id})
    if already:
        raise HTTPException(status_code=400, detail="Round already submitted")
    round_data = await db.rounds.find_one({"round_id": round_id, "user_id": user["user_id"]}, {"_id": 0})
    if not round_data:
        raise HTTPException(status_code=404, detail="Round not found")
    played = [h for h in round_data.get("holes", []) if h.get("strokes", 0) > 0]
    stableford = sum(calc_stableford(h["strokes"], h["par"]) for h in played)
    await db.tour_rounds.insert_one({
        "tour_round_id": f"tr_{uuid.uuid4().hex[:12]}", "tour_id": tour_id,
        "round_id": round_id, "user_id": user["user_id"],
        "player_name": round_data.get("player_name", ""), "round_number": existing_count + 1,
        "course_name": round_data.get("course_name", ""),
        "total_strokes": round_data.get("total_strokes", 0),
        "total_to_par": round_data.get("total_to_par", 0),
        "stableford_points": stableford,
        "played_at": round_data.get("created_at", "")
    })
    return {"message": "Round submitted", "round_number": existing_count + 1}

# --- Tournament Feed (Photo Feed) ---
MAX_PHOTO_SIZE = 10 * 1024 * 1024  # 10MB

@api_router.post("/tournaments/{tournament_id}/feed")
async def upload_feed_photo(tournament_id: str, request: Request, file: UploadFile = File(...), caption: str = Form("")):
    user = await get_current_user(request)
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    # Check: participant or admin
    is_admin = user.get("role") == "admin"
    is_registered = await db.registrations.find_one(
        {"tournament_id": tournament_id, "user_id": user["user_id"]}
    )
    if not is_admin and not is_registered:
        raise HTTPException(status_code=403, detail="Only participants and admins can post photos")
    # Read and validate file
    data = await file.read()
    if len(data) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=400, detail="Photo too large (max 10MB)")
    content_type = file.content_type or "image/jpeg"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only images allowed")
    # Compress/resize for mobile
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
        max_dim = 1200
        if max(img.width, img.height) > max_dim:
            img.thumbnail((max_dim, max_dim), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format='WEBP', quality=70)
        data = buf.getvalue()
        content_type = "image/webp"
    except Exception:
        pass  # Use original if processing fails
    # Save to local storage
    ext = "webp" if content_type == "image/webp" else "jpg"
    subpath = f"feed/{tournament_id}/{uuid.uuid4().hex}.{ext}"
    try:
        url_path = save_local_file(subpath, data)
    except Exception as e:
        logger.error(f"File save failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save photo")
    # Save to DB
    photo_id = f"photo_{uuid.uuid4().hex[:12]}"
    doc = {
        "photo_id": photo_id,
        "tournament_id": tournament_id,
        "user_id": user["user_id"],
        "player_name": user["name"],
        "picture": user.get("picture"),
        "caption": caption.strip()[:280] if caption else "",
        "storage_path": subpath,
        "url_path": url_path,
        "content_type": content_type,
        "size": len(data),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tournament_feed.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/tournaments/{tournament_id}/feed")
async def get_feed(tournament_id: str, request: Request):
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    # Access control: same as leaderboard
    if tournament.get("visibility", "private") == "private":
        user = await get_optional_user(request)
        if not user:
            raise HTTPException(status_code=403, detail="This tournament is private")
        is_admin = user.get("role") == "admin"
        is_registered = await db.registrations.find_one(
            {"tournament_id": tournament_id, "user_id": user["user_id"]}
        )
        if not is_admin and not is_registered:
            raise HTTPException(status_code=403, detail="This tournament is private")
    photos = await db.tournament_feed.find(
        {"tournament_id": tournament_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return photos

@api_router.get("/feed/photo/{photo_id}")
async def serve_feed_photo(photo_id: str):
    record = await db.tournament_feed.find_one({"photo_id": photo_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Photo not found")
    try:
        data = read_local_file(record["storage_path"])
        if not data:
            raise HTTPException(status_code=404, detail="Photo file not found")
        return Response(content=data, media_type=record.get("content_type", "image/jpeg"))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Photo read failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load photo")

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.tournaments.create_index("tournament_id", unique=True)
    await db.scorecards.create_index("scorecard_id", unique=True)
    await db.scorecards.create_index([("tournament_id", 1), ("user_id", 1)])
    await db.registrations.create_index([("tournament_id", 1), ("user_id", 1)], unique=True)
    await db.registrations.create_index("registration_id", unique=True)
    await db.golf_courses.create_index("course_id", unique=True)
    await db.challenges.create_index("challenge_id", unique=True)
    await db.challenges.create_index("invite_code", sparse=True)
    await db.tournaments.create_index("invite_code", sparse=True)
    await db.tours.create_index("invite_code", unique=True)
    await db.challenge_progress.create_index([("challenge_id", 1), ("user_id", 1), ("course_id", 1), ("hole_number", 1)], unique=True)
    await db.tournament_feed.create_index([("tournament_id", 1), ("created_at", -1)])
    await db.tournament_feed.create_index("photo_id", unique=True)
    logger.info("Database indexes created")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    logger.info(f"Upload directory: {UPLOAD_DIR}")

@app.on_event("shutdown")
async def shutdown():
    client.close()
