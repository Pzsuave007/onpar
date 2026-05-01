"""
Backend tests for OnPar Live 1v1 Quick Match feature.
Covers:
- POST /api/matches/1v1 (create, self-reject, duplicate-reject)
- GET /api/matches/1v1/active
- POST /api/matches/1v1/{id}/respond (accept/decline)
- GET /api/matches/1v1/{id} (scorecards, completion)
- Mirror: POST /api/rounds with match tournament_id creates scorecard
"""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://golf-scoring-app-2.preview.emergentagent.com').rstrip('/')
COURSE_ID = "course_992f69846733"
TEE_NAME = "Default"

ADMIN_EMAIL = "admin@fairway.com"
ADMIN_PASS = "FairwayAdmin123!"
BUDDY_EMAIL = "buddy@test.com"
BUDDY_PASS = "BuddyTest123!"


@pytest.fixture(scope="module")
def mongo():
    # Use local MongoDB (same DB the backend uses) to pre-clean stale 1v1 matches
    client = MongoClient("mongodb://localhost:27017")
    db = client["test_database"]
    db.tournaments.delete_many({"is_1v1": True})
    db.scorecards.delete_many({"tournament_id": {"$regex": "^t1v1_"}})
    yield db
    # post-cleanup
    db.tournaments.delete_many({"is_1v1": True})
    db.scorecards.delete_many({"tournament_id": {"$regex": "^t1v1_"}})


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="module")
def buddy_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": BUDDY_EMAIL, "password": BUDDY_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"], r.json()["user"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# --- Creation & validation ---

def test_create_1v1_match(mongo, admin_token, buddy_token):
    admin_tok, admin = admin_token
    _, buddy = buddy_token
    r = requests.post(f"{BASE_URL}/api/matches/1v1",
                      headers=_hdr(admin_tok),
                      json={"opponent_id": buddy["user_id"], "course_id": COURSE_ID,
                            "tee_name": TEE_NAME, "num_holes": 9})
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert data.get("is_1v1") is True
    assert data.get("status") == "pending"
    assert "tournament_id" in data
    pytest.match_id = data["tournament_id"]


def test_create_1v1_reject_self(admin_token):
    admin_tok, admin = admin_token
    r = requests.post(f"{BASE_URL}/api/matches/1v1",
                      headers=_hdr(admin_tok),
                      json={"opponent_id": admin["user_id"], "course_id": COURSE_ID,
                            "tee_name": TEE_NAME, "num_holes": 9})
    assert r.status_code == 400, r.text


def test_create_1v1_reject_duplicate(admin_token, buddy_token):
    admin_tok, _ = admin_token
    _, buddy = buddy_token
    r = requests.post(f"{BASE_URL}/api/matches/1v1",
                      headers=_hdr(admin_tok),
                      json={"opponent_id": buddy["user_id"], "course_id": COURSE_ID,
                            "tee_name": TEE_NAME, "num_holes": 9})
    assert r.status_code == 409, r.text


# --- Active list ---

def test_list_active_1v1(admin_token, buddy_token):
    admin_tok, _ = admin_token
    buddy_tok, _ = buddy_token
    r = requests.get(f"{BASE_URL}/api/matches/1v1/active", headers=_hdr(admin_tok))
    assert r.status_code == 200, r.text
    items = r.json() if isinstance(r.json(), list) else r.json().get("matches", [])
    assert any(m.get("tournament_id") == pytest.match_id for m in items)

    r2 = requests.get(f"{BASE_URL}/api/matches/1v1/active", headers=_hdr(buddy_tok))
    assert r2.status_code == 200
    items2 = r2.json() if isinstance(r2.json(), list) else r2.json().get("matches", [])
    assert any(m.get("tournament_id") == pytest.match_id for m in items2)


# --- Get detail ---

def test_get_1v1_detail(admin_token):
    admin_tok, _ = admin_token
    r = requests.get(f"{BASE_URL}/api/matches/1v1/{pytest.match_id}",
                     headers=_hdr(admin_tok))
    assert r.status_code == 200, r.text
    d = r.json()
    assert "p1_card" in d and "p2_card" in d
    assert d.get("course_id") == COURSE_ID


# --- Respond: decline path (create a 2nd match then decline) ---

def test_decline_flow(mongo, admin_token, buddy_token):
    # accept main challenge first -> current (active) so a new one can be created later? No, spec says
    # only one pending/active. We'll accept main first.
    admin_tok, _ = admin_token
    buddy_tok, _ = buddy_token
    r = requests.post(f"{BASE_URL}/api/matches/1v1/{pytest.match_id}/respond",
                      headers=_hdr(buddy_tok), json={"action": "accept"})
    assert r.status_code == 200, r.text
    d = r.json()
    # After accept, status should be active
    # fetch detail
    r2 = requests.get(f"{BASE_URL}/api/matches/1v1/{pytest.match_id}", headers=_hdr(admin_tok))
    assert r2.status_code == 200
    assert r2.json().get("status") == "active"


# --- Rounds → scorecard mirror ---

def _submit_round(tok, course_id, match_id, strokes_list, pars_list, finish=True):
    holes = [{"hole": i + 1, "strokes": s, "par": p}
             for i, (s, p) in enumerate(zip(strokes_list, pars_list))]
    body = {
        "course_id": course_id,
        "tee_name": TEE_NAME,
        "holes": holes,
        "tournament_id": match_id,
        "finish": finish,
    }
    return requests.post(f"{BASE_URL}/api/rounds", headers=_hdr(tok), json=body)


def test_mirror_creates_scorecards_and_completes(mongo, admin_token, buddy_token):
    admin_tok, admin = admin_token
    buddy_tok, buddy = buddy_token
    # fetch match to get pars
    r = requests.get(f"{BASE_URL}/api/matches/1v1/{pytest.match_id}",
                     headers=_hdr(admin_tok))
    assert r.status_code == 200
    match = r.json()
    num_holes = match.get("num_holes", 9)
    pars = match.get("par_per_hole") or [4] * num_holes
    pars = pars[:num_holes]
    if len(pars) < num_holes:
        pars += [4] * (num_holes - len(pars))

    # Admin shoots 1 over per hole; buddy shoots level par -> buddy wins
    admin_strokes = [p + 1 for p in pars]
    buddy_strokes = list(pars)

    r1 = _submit_round(admin_tok, COURSE_ID, pytest.match_id, admin_strokes, pars, finish=True)
    assert r1.status_code in (200, 201), r1.text
    r2 = _submit_round(buddy_tok, COURSE_ID, pytest.match_id, buddy_strokes, pars, finish=True)
    assert r2.status_code in (200, 201), r2.text

    # Verify scorecards collection
    sc_admin = mongo.scorecards.find_one({"tournament_id": pytest.match_id, "user_id": admin["user_id"]})
    sc_buddy = mongo.scorecards.find_one({"tournament_id": pytest.match_id, "user_id": buddy["user_id"]})
    assert sc_admin is not None, "admin scorecard not mirrored"
    assert sc_buddy is not None, "buddy scorecard not mirrored"
    assert sc_admin.get("status") == "submitted"
    assert sc_buddy.get("status") == "submitted"
    assert sc_admin.get("total_strokes") == sum(admin_strokes)
    assert sc_buddy.get("total_strokes") == sum(buddy_strokes)

    # Now match detail must be completed and winner = buddy
    rd = requests.get(f"{BASE_URL}/api/matches/1v1/{pytest.match_id}",
                      headers=_hdr(admin_tok))
    assert rd.status_code == 200
    det = rd.json()
    assert det.get("status") == "completed", f"expected completed, got {det.get('status')}"
    assert det.get("result"), "missing result"
    assert det["result"].get("winner_id") == buddy["user_id"]


# --- Decline a brand-new challenge ---

def test_create_and_decline(mongo, admin_token, buddy_token):
    admin_tok, _ = admin_token
    buddy_tok, buddy = buddy_token
    # previous is completed, so we can create a new one
    r = requests.post(f"{BASE_URL}/api/matches/1v1",
                      headers=_hdr(admin_tok),
                      json={"opponent_id": buddy["user_id"], "course_id": COURSE_ID,
                            "tee_name": TEE_NAME, "num_holes": 9})
    assert r.status_code in (200, 201), r.text
    mid = r.json()["tournament_id"]
    rd = requests.post(f"{BASE_URL}/api/matches/1v1/{mid}/respond",
                       headers=_hdr(buddy_tok), json={"action": "decline"})
    assert rd.status_code == 200, rd.text
    # Verify status
    g = requests.get(f"{BASE_URL}/api/matches/1v1/{mid}", headers=_hdr(admin_tok))
    assert g.status_code == 200
    assert g.json().get("status") == "declined"
