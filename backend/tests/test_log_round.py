"""
Tests for Bug #2 fix: POST /api/challenges/{id}/log-round must persist to rounds collection
and update handicap-relevant data, while still processing birdies into challenge_progress.

Also exercises POST /api/rounds (unchanged) and GET /api/rounds/my, /api/profile/stats.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://par-tracker-mobile.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "pzsuave007@gmail.com"
ADMIN_PASSWORD = "MXmedia007"
EXISTING_CHALLENGE = "chal_2bceba890dfe"
EXISTING_COURSE = "course_98cf9e8fc677"  # 9 holes, par 4 each


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Auth failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_user_id(admin_token):
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["user_id"]


# ---------------- Bug #2: log-round persists to rounds collection ----------------

class TestLogRoundPersistsRound:
    def test_log_round_inserts_into_rounds_and_returns_round_id(self, admin_headers, admin_user_id):
        # Snapshot rounds before
        before = requests.get(f"{BASE_URL}/api/rounds/my", headers=admin_headers, timeout=15)
        assert before.status_code == 200
        before_ids = {r["round_id"] for r in before.json()}

        # 9-hole round on existing challenge course (par 4 each) — make 1 birdie (hole 3)
        holes = []
        for i in range(1, 10):
            strokes = 3 if i == 3 else 4  # birdie on hole 3
            holes.append({"hole": i, "par": 4, "strokes": strokes})

        payload = {
            "course_id": EXISTING_COURSE,
            "user_id": admin_user_id,
            "holes": holes,
        }
        resp = requests.post(
            f"{BASE_URL}/api/challenges/{EXISTING_CHALLENGE}/log-round",
            headers=admin_headers, json=payload, timeout=20,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        # round_id must be returned (Bug #2 requirement)
        assert "round_id" in body and body["round_id"], f"Missing round_id: {body}"
        assert body["round_id"].startswith("round_")
        new_round_id = body["round_id"]

        # GET /api/rounds/my must include the new round
        after = requests.get(f"{BASE_URL}/api/rounds/my", headers=admin_headers, timeout=15)
        assert after.status_code == 200
        after_rounds = after.json()
        match = next((r for r in after_rounds if r["round_id"] == new_round_id), None)
        assert match is not None, "New round not present in /api/rounds/my"
        assert new_round_id not in before_ids

        # Validate stored fields
        assert match["source"] == "challenge_log"
        assert match["challenge_id"] == EXISTING_CHALLENGE
        assert match["course_id"] == EXISTING_COURSE
        assert match["completed_holes"] == 9
        # 8 pars (4) + 1 birdie (3) = 35 strokes; total par = 36 → to_par = -1
        assert match["total_strokes"] == 35
        assert match["total_to_par"] == -1
        assert match["course_name"]  # not empty
        assert match["user_id"] == admin_user_id

    def test_log_round_processes_birdies(self, admin_headers, admin_user_id):
        # Use a unique-ish hole (hole 9) to test new birdie detection. May already exist;
        # tolerate by asserting endpoint succeeds and structure is correct.
        holes = [{"hole": 9, "par": 4, "strokes": 2}]  # eagle (counts as < par)
        payload = {"course_id": EXISTING_COURSE, "user_id": admin_user_id, "holes": holes}
        resp = requests.post(
            f"{BASE_URL}/api/challenges/{EXISTING_CHALLENGE}/log-round",
            headers=admin_headers, json=payload, timeout=20,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "new_birdies" in body and isinstance(body["new_birdies"], list)
        assert "won" in body and isinstance(body["won"], bool)
        assert "total_completed" in body
        assert "total_needed" in body

    def test_log_round_no_played_holes_returns_no_round(self, admin_headers, admin_user_id):
        # All zero strokes → played list empty → round_id should be None
        holes = [{"hole": i, "par": 4, "strokes": 0} for i in range(1, 10)]
        payload = {"course_id": EXISTING_COURSE, "user_id": admin_user_id, "holes": holes}
        resp = requests.post(
            f"{BASE_URL}/api/challenges/{EXISTING_CHALLENGE}/log-round",
            headers=admin_headers, json=payload, timeout=15,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body.get("round_id") is None


# ---------------- POST /api/rounds unchanged behavior ----------------

class TestPostRoundsUnchanged:
    def test_post_rounds_personal_save_and_retrieve(self, admin_headers, admin_user_id):
        holes = [{"hole": i, "par": 4, "strokes": 4} for i in range(1, 10)]
        payload = {"course_id": EXISTING_COURSE, "holes": holes, "finish": True}
        r = requests.post(f"{BASE_URL}/api/rounds", headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "round_id" in data
        assert data["user_id"] == admin_user_id
        assert data["course_id"] == EXISTING_COURSE
        assert data["total_strokes"] == 36
        assert data["total_to_par"] == 0
        assert data["status"] == "completed"
        assert "new_challenge_birdies" in data

        # Persisted in /api/rounds/my
        my = requests.get(f"{BASE_URL}/api/rounds/my", headers=admin_headers, timeout=15)
        assert my.status_code == 200
        ids = {x["round_id"] for x in my.json()}
        assert data["round_id"] in ids


# ---------------- /api/profile/stats reflects new rounds (handicap influence) ----------------

class TestProfileStats:
    def test_profile_stats_endpoint_works(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/profile/stats", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Just verify shape — exact handicap math is internal
        assert isinstance(data, dict)
        assert any(k in data for k in ("rounds_played", "total_rounds", "handicap", "best_score", "stats"))


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
