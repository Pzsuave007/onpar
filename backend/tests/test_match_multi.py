"""
Backend tests for OnPar Live multi-player Match (2-8 players).
Covers stroke / match_play / best_ball formats, accept/decline flows,
and rounds → scorecards mirror.
"""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://golf-scoring-app-2.preview.emergentagent.com').rstrip('/')
COURSE_ID = "course_992f69846733"
TEE_NAME = "Default"

USERS = {
    "admin": ("admin@fairway.com", "FairwayAdmin123!"),
    "buddy": ("buddy@test.com", "BuddyTest123!"),
    "b2": ("b2@test.com", "BuddyTest123!"),
    "b3": ("b3@test.com", "BuddyTest123!"),
}


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient("mongodb://localhost:27017")
    db = client["test_database"]
    db.tournaments.delete_many({"is_match": True})
    db.scorecards.delete_many({"tournament_id": {"$regex": "^tm_"}})
    yield db
    db.tournaments.delete_many({"is_match": True})
    db.scorecards.delete_many({"tournament_id": {"$regex": "^tm_"}})


@pytest.fixture(scope="module")
def auth():
    out = {}
    for k, (e, p) in USERS.items():
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": e, "password": p})
        assert r.status_code == 200, f"login {k} failed: {r.text}"
        d = r.json()
        out[k] = {"token": d["token"], "user": d["user"]}
    return out


# ---------- Creation validations ----------

def test_create_stroke_3_players_pending(mongo, auth):
    r = requests.post(f"{BASE_URL}/api/matches",
                      headers=_hdr(auth["admin"]["token"]),
                      json={
                          "opponent_ids": [auth["buddy"]["user"]["user_id"], auth["b2"]["user"]["user_id"]],
                          "course_id": COURSE_ID, "tee_name": TEE_NAME, "num_holes": 9,
                          "format": "stroke",
                      })
    assert r.status_code in (200, 201), r.text
    d = r.json()
    assert d["is_match"] is True
    assert d["status"] == "pending"
    assert d["format"] == "stroke"
    assert len(d["players"]) == 3
    creator = next(p for p in d["players"] if p["user_id"] == auth["admin"]["user"]["user_id"])
    assert creator["status"] == "accepted"
    invitees = [p for p in d["players"] if p["user_id"] != auth["admin"]["user"]["user_id"]]
    assert all(p["status"] == "pending" for p in invitees)
    pytest.match_stroke = d["tournament_id"]


def test_reject_self_invite(auth):
    r = requests.post(f"{BASE_URL}/api/matches",
                      headers=_hdr(auth["admin"]["token"]),
                      json={"opponent_ids": [auth["admin"]["user"]["user_id"]],
                            "course_id": COURSE_ID, "tee_name": TEE_NAME,
                            "num_holes": 9, "format": "stroke"})
    assert r.status_code == 400


def test_reject_match_play_with_3(auth):
    r = requests.post(f"{BASE_URL}/api/matches",
                      headers=_hdr(auth["admin"]["token"]),
                      json={"opponent_ids": [auth["buddy"]["user"]["user_id"], auth["b2"]["user"]["user_id"]],
                            "course_id": COURSE_ID, "tee_name": TEE_NAME,
                            "num_holes": 9, "format": "match_play"})
    assert r.status_code == 400


def test_reject_best_ball_no_teams(auth):
    r = requests.post(f"{BASE_URL}/api/matches",
                      headers=_hdr(auth["admin"]["token"]),
                      json={"opponent_ids": [auth["buddy"]["user"]["user_id"],
                                             auth["b2"]["user"]["user_id"],
                                             auth["b3"]["user"]["user_id"]],
                            "course_id": COURSE_ID, "tee_name": TEE_NAME,
                            "num_holes": 9, "format": "best_ball"})
    assert r.status_code == 400


def test_reject_best_ball_bad_teams(auth):
    a, b, c, d = (auth["admin"]["user"]["user_id"], auth["buddy"]["user"]["user_id"],
                  auth["b2"]["user"]["user_id"], auth["b3"]["user"]["user_id"])
    r = requests.post(f"{BASE_URL}/api/matches",
                      headers=_hdr(auth["admin"]["token"]),
                      json={"opponent_ids": [b, c, d],
                            "course_id": COURSE_ID, "tee_name": TEE_NAME, "num_holes": 9,
                            "format": "best_ball",
                            "teams": [{"user_ids": [a, b, c]}, {"user_ids": [d]}]})
    assert r.status_code == 400


def test_reject_too_many_players(auth):
    # 8 distinct fake invitees → creator + 8 = 9 → must 400 on size check
    r = requests.post(f"{BASE_URL}/api/matches",
                      headers=_hdr(auth["admin"]["token"]),
                      json={"opponent_ids": [f"fake_{i}" for i in range(8)],
                            "course_id": COURSE_ID, "tee_name": TEE_NAME,
                            "num_holes": 9, "format": "stroke"})
    assert r.status_code == 400, r.text


# ---------- Active list ----------

def test_active_list_visible_to_all_invited(auth):
    for k in ("admin", "buddy", "b2"):
        r = requests.get(f"{BASE_URL}/api/matches/active", headers=_hdr(auth[k]["token"]))
        assert r.status_code == 200, r.text
        items = r.json()
        assert any(m["tournament_id"] == pytest.match_stroke for m in items), f"{k} missing match"


# ---------- Detail + slim card ----------

def test_get_match_detail_slim(auth):
    r = requests.get(f"{BASE_URL}/api/matches/{pytest.match_stroke}",
                     headers=_hdr(auth["admin"]["token"]))
    assert r.status_code == 200
    d = r.json()
    assert "players" in d and len(d["players"]) == 3
    for p in d["players"]:
        assert "card" in p  # slim or None
        if p["card"]:
            assert set(p["card"].keys()) <= {"user_id", "player_name", "total_strokes",
                                             "total_to_par", "completed_holes", "status"}


# ---------- Accept transitions to active ----------

def test_buddy_accepts_match_goes_active(mongo, auth):
    r = requests.post(f"{BASE_URL}/api/matches/{pytest.match_stroke}/respond",
                      headers=_hdr(auth["buddy"]["token"]), json={"action": "accept"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["your_status"] == "accepted"
    assert d["status"] == "active"


# ---------- Stroke result: 3 players, lowest wins ----------

def _submit(tok, course_id, mid, strokes, pars, finish=True):
    holes = [{"hole": i + 1, "strokes": s, "par": p}
             for i, (s, p) in enumerate(zip(strokes, pars))]
    return requests.post(f"{BASE_URL}/api/rounds", headers=_hdr(tok),
                         json={"course_id": course_id, "tee_name": TEE_NAME,
                               "holes": holes, "tournament_id": mid, "finish": finish})


def test_stroke_result_lowest_wins(mongo, auth):
    # Need 3 accepted: admin (creator), buddy already accepted; b2 must accept now
    r = requests.post(f"{BASE_URL}/api/matches/{pytest.match_stroke}/respond",
                      headers=_hdr(auth["b2"]["token"]), json={"action": "accept"})
    assert r.status_code == 200

    pars = [4] * 9
    # b2 wins (lowest)
    r1 = _submit(auth["admin"]["token"], COURSE_ID, pytest.match_stroke, [5] * 9, pars)
    assert r1.status_code in (200, 201), r1.text
    r2 = _submit(auth["buddy"]["token"], COURSE_ID, pytest.match_stroke, [4] * 9, pars)
    assert r2.status_code in (200, 201), r2.text
    r3 = _submit(auth["b2"]["token"], COURSE_ID, pytest.match_stroke, [3] * 9, pars)
    assert r3.status_code in (200, 201), r3.text

    # Verify scorecards mirrored
    for u, total in [("admin", 45), ("buddy", 36), ("b2", 27)]:
        sc = mongo.scorecards.find_one({"tournament_id": pytest.match_stroke,
                                         "user_id": auth[u]["user"]["user_id"]})
        assert sc and sc.get("status") == "submitted"
        assert sc.get("total_strokes") == total

    # GET should compute result
    r = requests.get(f"{BASE_URL}/api/matches/{pytest.match_stroke}",
                     headers=_hdr(auth["admin"]["token"]))
    assert r.status_code == 200
    det = r.json()
    assert det["status"] == "completed"
    assert det["result"]["format"] == "stroke"
    assert det["result"]["winner_id"] == auth["b2"]["user"]["user_id"]


# ---------- Match Play result ----------

def test_match_play_result(mongo, auth):
    r = requests.post(f"{BASE_URL}/api/matches",
                      headers=_hdr(auth["admin"]["token"]),
                      json={"opponent_ids": [auth["buddy"]["user"]["user_id"]],
                            "course_id": COURSE_ID, "tee_name": TEE_NAME,
                            "num_holes": 9, "format": "match_play"})
    assert r.status_code in (200, 201), r.text
    mid = r.json()["tournament_id"]
    # buddy accept
    rr = requests.post(f"{BASE_URL}/api/matches/{mid}/respond",
                       headers=_hdr(auth["buddy"]["token"]), json={"action": "accept"})
    assert rr.status_code == 200
    pars = [4] * 9
    # admin wins 6 holes, ties 1, loses 2 -> 6.5 vs 2.5
    admin_strokes = [3, 3, 3, 3, 3, 3, 4, 5, 5]   # admin lower on 6, tie on 1, higher on 2
    buddy_strokes = [4, 4, 4, 4, 4, 4, 4, 4, 4]
    _submit(auth["admin"]["token"], COURSE_ID, mid, admin_strokes, pars)
    _submit(auth["buddy"]["token"], COURSE_ID, mid, buddy_strokes, pars)
    g = requests.get(f"{BASE_URL}/api/matches/{mid}", headers=_hdr(auth["admin"]["token"]))
    assert g.status_code == 200
    det = g.json()
    assert det["status"] == "completed"
    res = det["result"]
    assert res["format"] == "match_play"
    assert res["winner_id"] == auth["admin"]["user"]["user_id"]
    assert "–" in res["score"]


# ---------- Best Ball result ----------

def test_best_ball_result(mongo, auth):
    a = auth["admin"]["user"]["user_id"]
    b = auth["buddy"]["user"]["user_id"]
    c = auth["b2"]["user"]["user_id"]
    d = auth["b3"]["user"]["user_id"]
    r = requests.post(f"{BASE_URL}/api/matches",
                      headers=_hdr(auth["admin"]["token"]),
                      json={"opponent_ids": [b, c, d],
                            "course_id": COURSE_ID, "tee_name": TEE_NAME,
                            "num_holes": 9, "format": "best_ball",
                            "teams": [
                                {"name": "Team A", "user_ids": [a, b]},
                                {"name": "Team B", "user_ids": [c, d]},
                            ]})
    assert r.status_code in (200, 201), r.text
    mid = r.json()["tournament_id"]
    for k in ("buddy", "b2", "b3"):
        rr = requests.post(f"{BASE_URL}/api/matches/{mid}/respond",
                           headers=_hdr(auth[k]["token"]), json={"action": "accept"})
        assert rr.status_code == 200, rr.text

    pars = [4] * 9
    # Team A best-ball: min(admin, buddy) per hole. Team B: min(b2, b3).
    # Make Team A win on most holes.
    _submit(auth["admin"]["token"], COURSE_ID, mid, [3] * 9, pars)   # team A best = 3 every hole
    _submit(auth["buddy"]["token"], COURSE_ID, mid, [5] * 9, pars)
    _submit(auth["b2"]["token"], COURSE_ID, mid, [4] * 9, pars)      # team B best = 4 every hole
    _submit(auth["b3"]["token"], COURSE_ID, mid, [5] * 9, pars)

    g = requests.get(f"{BASE_URL}/api/matches/{mid}", headers=_hdr(auth["admin"]["token"]))
    assert g.status_code == 200, g.text
    det = g.json()
    assert det["status"] == "completed", det
    res = det["result"]
    assert res["format"] == "best_ball"
    assert res["winner_team"] == 1
    assert res["winner_name"] == "Team A"


# ---------- Decline-all → cancelled ----------

def test_decline_all_cancels(mongo, auth):
    r = requests.post(f"{BASE_URL}/api/matches",
                      headers=_hdr(auth["admin"]["token"]),
                      json={"opponent_ids": [auth["buddy"]["user"]["user_id"]],
                            "course_id": COURSE_ID, "tee_name": TEE_NAME,
                            "num_holes": 9, "format": "stroke"})
    assert r.status_code in (200, 201), r.text
    mid = r.json()["tournament_id"]
    rr = requests.post(f"{BASE_URL}/api/matches/{mid}/respond",
                       headers=_hdr(auth["buddy"]["token"]), json={"action": "decline"})
    assert rr.status_code == 200, rr.text
    assert rr.json()["status"] == "cancelled"
    g = requests.get(f"{BASE_URL}/api/matches/{mid}", headers=_hdr(auth["admin"]["token"]))
    assert g.status_code == 200
    assert g.json()["status"] == "cancelled"


# ---------- Old 1v1 endpoints still work (backward compat) ----------

def test_legacy_1v1_endpoints_alive(auth):
    r = requests.get(f"{BASE_URL}/api/matches/1v1/active", headers=_hdr(auth["admin"]["token"]))
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), (list, dict))
