from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import uuid
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', uuid.uuid4().hex)

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
async def list_tournaments():
    tournaments = await db.tournaments.find({}, {"_id": 0}).sort("start_date", -1).to_list(100)
    reg_counts = {}
    async for doc in db.registrations.aggregate([
        {"$group": {"_id": "$tournament_id", "count": {"$sum": 1}}}
    ]):
        reg_counts[doc["_id"]] = doc["count"]
    for t in tournaments:
        t["participant_count"] = reg_counts.get(t["tournament_id"], 0)
    return tournaments

@api_router.get("/tournaments/{tournament_id}")
async def get_tournament(tournament_id: str):
    t = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    t["participant_count"] = await db.registrations.count_documents({"tournament_id": tournament_id})
    return t

@api_router.post("/tournaments")
async def create_tournament(data: TournamentCreate, request: Request):
    await get_admin_user(request)
    tid = f"tourn_{uuid.uuid4().hex[:12]}"
    doc = {
        "tournament_id": tid, **data.model_dump(),
        "total_par": sum(data.par_per_hole), "status": "upcoming",
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
        raise HTTPException(status_code=400, detail=f"Invalid round number")
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

# --- Leaderboard (Public) ---
@api_router.get("/leaderboard/{tournament_id}")
async def get_leaderboard(tournament_id: str):
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    scorecards = await db.scorecards.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(1000)
    players = {}
    for sc in scorecards:
        uid = sc["user_id"]
        if uid not in players:
            players[uid] = {
                "user_id": uid, "player_name": sc["player_name"],
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
            "status": sc["status"]
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
    logger.info("Database indexes created")

@app.on_event("shutdown")
async def shutdown():
    client.close()
