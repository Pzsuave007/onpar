"""Tests for Match Play (bracket) and Random Scorer (cross-scoring) tournament formats."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://onparlive.com").rstrip("/")
ADMIN_EMAIL = "admin@fairway.com"
ADMIN_PASSWORD = "FairwayAdmin123!"

PAR18 = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4]


# ---------- helpers / fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        # Try seeding first
        requests.post(f"{BASE_URL}/api/admin/seed", timeout=30)
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


def _create_tournament(headers, team_format, name_suffix):
    payload = {
        "name": f"TEST_{name_suffix}",
        "course_name": "Test Course",
        "start_date": "2026-02-01",
        "end_date": "2026-02-02",
        "scoring_format": "stroke",
        "num_holes": 18,
        "num_rounds": 1,
        "par_per_hole": PAR18,
        "max_players": 50,
        "description": "auto test",
        "visibility": "public",
        "team_format": team_format,
    }
    r = requests.post(f"{BASE_URL}/api/tournaments", headers=headers, json=payload, timeout=30)
    assert r.status_code == 200, f"Create tournament failed {r.status_code} {r.text}"
    return r.json()


def _add_player(headers, tid, name):
    r = requests.post(f"{BASE_URL}/api/tournaments/{tid}/add-player",
                      headers=headers, json={"name": name}, timeout=30)
    assert r.status_code == 200, f"add-player failed {r.status_code} {r.text}"
    return r.json()["user_id"]


def _delete_tournament(headers, tid):
    requests.delete(f"{BASE_URL}/api/tournaments/{tid}", headers=headers, timeout=30)


# ============================================================
#   MATCH PLAY
# ============================================================
class TestMatchPlay:
    def test_create_match_play(self, admin_headers):
        t = _create_tournament(admin_headers, "match_play", "MP_create")
        try:
            assert t["team_format"] == "match_play"
            assert "tournament_id" in t
        finally:
            _delete_tournament(admin_headers, t["tournament_id"])

    def test_generate_bracket_rejects_under_2(self, admin_headers):
        t = _create_tournament(admin_headers, "match_play", "MP_under2")
        tid = t["tournament_id"]
        try:
            # 0 players
            r = requests.post(f"{BASE_URL}/api/tournaments/{tid}/bracket/generate",
                              headers=admin_headers, timeout=30)
            assert r.status_code == 400
            # 1 player still rejected
            _add_player(admin_headers, tid, "TEST_only_one")
            r = requests.post(f"{BASE_URL}/api/tournaments/{tid}/bracket/generate",
                              headers=admin_headers, timeout=30)
            assert r.status_code == 400
        finally:
            _delete_tournament(admin_headers, tid)

    def test_full_bracket_5_players_with_bye_and_advance(self, admin_headers):
        t = _create_tournament(admin_headers, "match_play", "MP_full5")
        tid = t["tournament_id"]
        try:
            uids = [_add_player(admin_headers, tid, f"TEST_MP_{i}") for i in range(5)]

            r = requests.post(f"{BASE_URL}/api/tournaments/{tid}/bracket/generate",
                              headers=admin_headers, timeout=30)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["matches_created"] == 3  # 2 real + 1 bye
            assert body["bye_user_id"] in uids

            # Fetch bracket
            r = requests.get(f"{BASE_URL}/api/tournaments/{tid}/bracket", timeout=30)
            assert r.status_code == 200
            br = r.json()
            assert br["champion_id"] is None
            round1 = br["rounds"][0]
            assert round1["bracket_round"] == 1
            assert len(round1["matches"]) == 3
            # Enrichment present (player1 has name; bye player2 is None)
            real_matches = [m for m in round1["matches"] if not m.get("is_bye")]
            assert len(real_matches) == 2
            for m in real_matches:
                assert m["player1"] is not None and m["player1"]["name"]
                assert m["player2"] is not None and m["player2"]["name"]
                assert "avatar_url" in m["player1"]

            # Submit scores: player1 wins each real match decisively
            for m in real_matches:
                p1_holes = [3] * 18  # lower
                p2_holes = [5] * 18
                payload = {"player1_holes": p1_holes, "player2_holes": p2_holes, "pars": PAR18}
                r = requests.post(
                    f"{BASE_URL}/api/tournaments/{tid}/matches/{m['match_id']}/score",
                    headers=admin_headers, json=payload, timeout=30)
                assert r.status_code == 200, r.text
                res = r.json()
                assert res["status"] == "completed"
                assert res["winner_id"] == m["player1_id"]
                assert res["player1_points"] == 18.0
                assert res["player2_points"] == 0.0

            # Round 2 should have been auto-created (3 winners → 1 match + 1 bye)
            r = requests.get(f"{BASE_URL}/api/tournaments/{tid}/bracket", timeout=30)
            br = r.json()
            assert len(br["rounds"]) >= 2
            r2 = br["rounds"][1]
            assert len(r2["matches"]) == 2  # 1 real + 1 bye
            real_r2 = [m for m in r2["matches"] if not m.get("is_bye")]
            assert len(real_r2) == 1

            # Complete round 2 final-ish (here R2 has a real + bye → next round Final between bye-winner and r2-winner)
            m = real_r2[0]
            payload = {"player1_holes": [3] * 18, "player2_holes": [5] * 18, "pars": PAR18}
            r = requests.post(
                f"{BASE_URL}/api/tournaments/{tid}/matches/{m['match_id']}/score",
                headers=admin_headers, json=payload, timeout=30)
            assert r.status_code == 200

            # Continue advancing until champion
            for _ in range(5):
                br = requests.get(f"{BASE_URL}/api/tournaments/{tid}/bracket", timeout=30).json()
                if br.get("champion_id"):
                    break
                last = br["rounds"][-1]
                pending = [m for m in last["matches"] if m["status"] != "completed"]
                if not pending:
                    break
                for m in pending:
                    payload = {"player1_holes": [3] * 18, "player2_holes": [5] * 18, "pars": PAR18}
                    requests.post(
                        f"{BASE_URL}/api/tournaments/{tid}/matches/{m['match_id']}/score",
                        headers=admin_headers, json=payload, timeout=30)
            br = requests.get(f"{BASE_URL}/api/tournaments/{tid}/bracket", timeout=30).json()
            assert br["champion_id"] is not None, f"Champion not set: {br}"
            assert br["champion_id"] in uids
        finally:
            _delete_tournament(admin_headers, tid)

    def test_per_hole_points_tie_and_partial(self, admin_headers):
        t = _create_tournament(admin_headers, "match_play", "MP_tie")
        tid = t["tournament_id"]
        try:
            _add_player(admin_headers, tid, "TEST_A")
            _add_player(admin_headers, tid, "TEST_B")
            requests.post(f"{BASE_URL}/api/tournaments/{tid}/bracket/generate",
                          headers=admin_headers, timeout=30)
            br = requests.get(f"{BASE_URL}/api/tournaments/{tid}/bracket", timeout=30).json()
            m = br["rounds"][0]["matches"][0]
            # 6 ties + 6 p1 wins + 6 p2 wins → 9 vs 9
            p1 = [4]*6 + [3]*6 + [5]*6
            p2 = [4]*6 + [5]*6 + [3]*6
            r = requests.post(
                f"{BASE_URL}/api/tournaments/{tid}/matches/{m['match_id']}/score",
                headers=admin_headers,
                json={"player1_holes": p1, "player2_holes": p2, "pars": PAR18}, timeout=30)
            assert r.status_code == 200
            res = r.json()
            assert res["player1_points"] == 9.0
            assert res["player2_points"] == 9.0
            assert res["status"] == "completed"
            # tie on points → lower total strokes wins; both totals equal → player1 wins
            assert res["winner_id"] == m["player1_id"]
        finally:
            _delete_tournament(admin_headers, tid)


# ============================================================
#   RANDOM SCORER
# ============================================================
class TestRandomScorer:
    def test_create_random_scorer(self, admin_headers):
        t = _create_tournament(admin_headers, "random_scorer", "RS_create")
        try:
            assert t["team_format"] == "random_scorer"
        finally:
            _delete_tournament(admin_headers, t["tournament_id"])

    def test_shuffle_under_2_rejected(self, admin_headers):
        t = _create_tournament(admin_headers, "random_scorer", "RS_under2")
        tid = t["tournament_id"]
        try:
            r = requests.post(f"{BASE_URL}/api/tournaments/{tid}/scorer-assignments/shuffle",
                              headers=admin_headers, timeout=30)
            assert r.status_code == 400
            _add_player(admin_headers, tid, "TEST_alone")
            r = requests.post(f"{BASE_URL}/api/tournaments/{tid}/scorer-assignments/shuffle",
                              headers=admin_headers, timeout=30)
            assert r.status_code == 400
        finally:
            _delete_tournament(admin_headers, tid)

    def test_shuffle_4_players_derangement(self, admin_headers):
        t = _create_tournament(admin_headers, "random_scorer", "RS_four")
        tid = t["tournament_id"]
        try:
            uids = [_add_player(admin_headers, tid, f"TEST_RS_{i}") for i in range(4)]
            r = requests.post(f"{BASE_URL}/api/tournaments/{tid}/scorer-assignments/shuffle",
                              headers=admin_headers, timeout=30)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["count"] == 4
            assigns = body["assignments"]
            scorers = [a["scorer_user_id"] for a in assigns]
            targets = [a["target_user_id"] for a in assigns]
            # derangement properties
            for a in assigns:
                assert a["scorer_user_id"] != a["target_user_id"], "Self-scoring!"
            assert sorted(scorers) == sorted(uids)
            assert sorted(targets) == sorted(uids)
            # Verify single cycle starting from one scorer
            chain = {a["scorer_user_id"]: a["target_user_id"] for a in assigns}
            visited = []
            cur = uids[0]
            for _ in range(len(uids)):
                visited.append(cur)
                cur = chain[cur]
            assert cur == uids[0], "Not a single cycle"
            assert len(set(visited)) == len(uids)

            # GET enriched
            r = requests.get(f"{BASE_URL}/api/tournaments/{tid}/scorer-assignments",
                             headers=admin_headers, timeout=30)
            assert r.status_code == 200
            data = r.json()
            assert len(data["assignments"]) == 4
            for ent in data["assignments"]:
                assert ent["scorer"]["name"]
                assert ent["target"]["name"]
                assert "avatar_url" in ent["scorer"]
        finally:
            _delete_tournament(admin_headers, tid)

    def test_keeper_enforces_assignment(self, admin_headers):
        """Non-admin keeper restricted to assigned target."""
        # Create a real (registered) player using register endpoint
        # Register a fresh user via /auth/register
        import uuid as _u
        email = f"test_{_u.uuid4().hex[:8]}@test.com"
        password = "TestUser123!"
        r = requests.post(f"{BASE_URL}/api/auth/register",
                         json={"email": email, "password": password, "name": "TEST_RealUser"},
                         timeout=30)
        assert r.status_code == 200
        user_token = r.json()["token"]
        user_id = r.json()["user"]["user_id"]
        user_headers = {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}

        t = _create_tournament(admin_headers, "random_scorer", "RS_enforce")
        tid = t["tournament_id"]
        try:
            # Real user registers
            r = requests.post(f"{BASE_URL}/api/tournaments/{tid}/register",
                              headers=user_headers, timeout=30)
            assert r.status_code == 200, r.text
            # Add 2 guest players
            g1 = _add_player(admin_headers, tid, "TEST_Guest1")
            g2 = _add_player(admin_headers, tid, "TEST_Guest2")
            # Shuffle
            r = requests.post(f"{BASE_URL}/api/tournaments/{tid}/scorer-assignments/shuffle",
                              headers=admin_headers, timeout=30)
            assert r.status_code == 200
            assigns = r.json()["assignments"]
            # Find target for our real user
            my_pair = next((a for a in assigns if a["scorer_user_id"] == user_id), None)
            assert my_pair is not None
            my_target = my_pair["target_user_id"]
            not_my_target = next((uid for uid in (user_id, g1, g2) if uid != my_target and uid != user_id), None)

            holes_payload = [{"hole": i + 1, "strokes": 4, "par": PAR18[i]} for i in range(18)]

            # Submit for assigned target → success
            r = requests.post(f"{BASE_URL}/api/scorecards/keeper", headers=user_headers,
                              json={"tournament_id": tid, "user_id": my_target,
                                    "round_number": 1, "holes": holes_payload}, timeout=30)
            assert r.status_code == 200, f"Should allow assigned scoring: {r.status_code} {r.text}"

            # Submit for someone else → 403
            r = requests.post(f"{BASE_URL}/api/scorecards/keeper", headers=user_headers,
                              json={"tournament_id": tid, "user_id": not_my_target,
                                    "round_number": 1, "holes": holes_payload}, timeout=30)
            assert r.status_code == 403, f"Should reject non-assigned: {r.status_code} {r.text}"

            # Admin can submit for anyone
            r = requests.post(f"{BASE_URL}/api/scorecards/keeper", headers=admin_headers,
                              json={"tournament_id": tid, "user_id": g1,
                                    "round_number": 1, "holes": holes_payload}, timeout=30)
            assert r.status_code == 200, r.text
        finally:
            _delete_tournament(admin_headers, tid)


# ============================================================
#   REGRESSION: individual / best_ball still work
# ============================================================
class TestRegressions:
    def test_individual_create(self, admin_headers):
        t = _create_tournament(admin_headers, "individual", "REG_indiv")
        try:
            assert t["team_format"] == "individual"
        finally:
            _delete_tournament(admin_headers, t["tournament_id"])

    def test_best_ball_create(self, admin_headers):
        t = _create_tournament(admin_headers, "best_ball", "REG_bb")
        try:
            assert t["team_format"] == "best_ball"
        finally:
            _delete_tournament(admin_headers, t["tournament_id"])
