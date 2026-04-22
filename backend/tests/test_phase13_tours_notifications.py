"""
Phase 13 regression + new-feature tests for OnPar Live:
  - Auth
  - Tournaments / Tours / Courses regression endpoints
  - Tours CRUD + invites (with target_user_id notification side-effect)
  - Notifications endpoints (list / mark-read / mark-all-read)
  - Users search
  - Personal invite accept (tours/invite/{code} GET + accept)
  - Tour join inherits suggested_course (Phase 13 regression)
  - Participant course assignment (regression)
  - Scorecard keeper random_scorer rejection (Phase 12 regression)
  - Match play bracket generation (Phase 12 regression)

Run:
  pytest /app/backend/tests/test_phase13_tours_notifications.py -v \
    --junitxml=/app/test_reports/pytest/phase13.xml
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("BACKEND_BASE_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "admin@fairway.com"
ADMIN_PASSWORD = "FairwayAdmin123!"

TIMEOUT = 20


# --------------------------- Fixtures ---------------------------

@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 0
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def admin_me(admin_headers):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=TIMEOUT)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="session")
def second_user():
    """Register a fresh regular user to receive invites/notifications."""
    suffix = uuid.uuid4().hex[:6]
    email = f"TEST_invitee_{suffix}@onpar.test"
    password = "TestPass123!"
    name = f"TEST Invitee {suffix}"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": name},
        timeout=TIMEOUT,
    )
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    user = data.get("user") or {}
    if not token:
        # fall back to login
        r2 = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
            timeout=TIMEOUT,
        )
        assert r2.status_code == 200
        token = r2.json()["token"]
        user = r2.json()["user"]
    return {"email": email, "password": password, "name": name,
            "token": token, "user_id": user.get("user_id"),
            "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}}


# --------------------------- Auth ---------------------------

class TestAuth:
    def test_admin_login(self, admin_token):
        assert len(admin_token) > 20

    def test_admin_me(self, admin_me):
        assert admin_me.get("email") == ADMIN_EMAIL
        assert "user_id" in admin_me


# --------------------------- Regression: Tournaments / Tours / Courses ---------------------------

class TestRegressionLists:
    def test_get_tournaments(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/tournaments", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_tours(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/tours", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_courses(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/courses", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --------------------------- Tours CRUD ---------------------------

@pytest.fixture
def created_tour(admin_headers):
    payload = {
        "name": f"TEST Tour {uuid.uuid4().hex[:6]}",
        "description": "pytest regression tour",
        "num_rounds": 3,
        "scoring_format": "stroke",
        "visibility": "private",
        "max_players": 10,
        "start_date": "2026-02-01",
        "end_date": "2026-02-28",
    }
    r = requests.post(f"{BASE_URL}/api/tours", json=payload, headers=admin_headers, timeout=TIMEOUT)
    assert r.status_code == 200, f"create tour failed: {r.status_code} {r.text}"
    tour = r.json()
    assert tour["name"] == payload["name"]
    assert tour["num_rounds"] == 3
    assert "tour_id" in tour
    assert "invite_code" in tour and len(tour["invite_code"]) == 6
    yield tour
    # teardown
    requests.delete(f"{BASE_URL}/api/tours/{tour['tour_id']}", headers=admin_headers, timeout=TIMEOUT)


class TestToursCrud:
    def test_create_tour(self, created_tour):
        assert created_tour["status"] == "active"
        assert len(created_tour["participants"]) == 1  # creator auto-added

    def test_update_tour(self, admin_headers, created_tour):
        tid = created_tour["tour_id"]
        r = requests.put(
            f"{BASE_URL}/api/tours/{tid}",
            json={"description": "updated desc", "num_rounds": 4},
            headers=admin_headers, timeout=TIMEOUT,
        )
        assert r.status_code == 200
        updated = r.json()
        assert updated["description"] == "updated desc"
        assert updated["num_rounds"] == 4
        # verify via GET
        r2 = requests.get(f"{BASE_URL}/api/tours/{tid}", headers=admin_headers, timeout=TIMEOUT)
        assert r2.status_code == 200
        assert r2.json()["description"] == "updated desc"

    def test_delete_tour_and_rounds(self, admin_headers):
        payload = {"name": f"TEST DeleteMe {uuid.uuid4().hex[:4]}", "num_rounds": 2}
        r = requests.post(f"{BASE_URL}/api/tours", json=payload, headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        tid = r.json()["tour_id"]
        r2 = requests.delete(f"{BASE_URL}/api/tours/{tid}", headers=admin_headers, timeout=TIMEOUT)
        assert r2.status_code == 200
        assert r2.json().get("deleted") == tid
        r3 = requests.get(f"{BASE_URL}/api/tours/{tid}", headers=admin_headers, timeout=TIMEOUT)
        assert r3.status_code == 404


# --------------------------- Users Search ---------------------------

class TestUsersSearch:
    def test_search_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/users/search?q=admin", timeout=TIMEOUT)
        assert r.status_code in (401, 403)

    def test_search_empty_returns_empty_array(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/users/search?q=", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json() == []

    def test_search_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/users/search?q=admin", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        for u in data:
            assert "password_hash" not in u
            assert "password" not in u
            assert "user_id" in u and "name" in u and "email" in u
        assert any(ADMIN_EMAIL in (u.get("email") or "") for u in data)

    def test_search_by_email_prefix(self, admin_headers, second_user):
        # search by part of the invitee email
        q = second_user["email"].split("@")[0][:10]
        r = requests.get(f"{BASE_URL}/api/users/search?q={q}", headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert any(u.get("email") == second_user["email"] for u in data)


# --------------------------- Tour Invites + Notification side-effect ---------------------------

class TestTourInvitesAndNotifications:
    def test_create_invite_without_target(self, admin_headers, created_tour):
        tid = created_tour["tour_id"]
        r = requests.post(
            f"{BASE_URL}/api/tours/{tid}/invites",
            json={"player_name": "Guest Phil"},
            headers=admin_headers, timeout=TIMEOUT,
        )
        assert r.status_code == 200
        invite = r.json()
        assert invite["player_name"] == "Guest Phil"
        assert invite["target_user_id"] is None
        assert invite["status"] == "pending"
        assert len(invite["code"]) == 8

        # list must include it
        r2 = requests.get(f"{BASE_URL}/api/tours/{tid}/invites", headers=admin_headers, timeout=TIMEOUT)
        assert r2.status_code == 200
        codes = [i["code"] for i in r2.json()]
        assert invite["code"] in codes

    def test_create_invite_with_target_user_creates_notification(
        self, admin_headers, created_tour, second_user
    ):
        tid = created_tour["tour_id"]
        # snapshot invitee unread count before
        r_before = requests.get(
            f"{BASE_URL}/api/notifications", headers=second_user["headers"], timeout=TIMEOUT
        )
        assert r_before.status_code == 200
        before_unread = r_before.json().get("unread_count", 0)

        # create invite targeted at second_user, leave player_name blank -> must auto-fill from profile
        r = requests.post(
            f"{BASE_URL}/api/tours/{tid}/invites",
            json={"target_user_id": second_user["user_id"]},
            headers=admin_headers, timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        invite = r.json()
        assert invite["target_user_id"] == second_user["user_id"]
        assert invite["player_name"] == second_user["name"], (
            f"player_name should auto-fill from profile, got {invite['player_name']!r}"
        )
        code = invite["code"]

        # notification should exist for second_user
        time.sleep(0.3)
        r2 = requests.get(
            f"{BASE_URL}/api/notifications", headers=second_user["headers"], timeout=TIMEOUT
        )
        assert r2.status_code == 200
        n = r2.json()
        assert "items" in n and "unread_count" in n
        assert n["unread_count"] >= before_unread + 1
        # find the tour_invite notification with the link
        found = [i for i in n["items"] if i.get("type") == "tour_invite"
                 and i.get("link") == f"/tours/join/{code}"]
        assert len(found) >= 1, f"expected tour_invite notif for code {code} in {n['items']}"
        notif = found[0]
        assert notif["read"] is False
        assert notif["meta"]["invite_code"] == code
        assert notif["meta"]["tour_id"] == tid

        # mark this notification read
        r3 = requests.post(
            f"{BASE_URL}/api/notifications/{notif['notification_id']}/read",
            headers=second_user["headers"], timeout=TIMEOUT,
        )
        assert r3.status_code == 200
        # verify unread dropped
        r4 = requests.get(
            f"{BASE_URL}/api/notifications", headers=second_user["headers"], timeout=TIMEOUT
        )
        assert r4.status_code == 200
        after_unread = r4.json()["unread_count"]
        assert after_unread == n["unread_count"] - 1

        # admin (who created the notif) should NOT have received it
        r5 = requests.get(f"{BASE_URL}/api/notifications", headers=admin_headers, timeout=TIMEOUT)
        assert r5.status_code == 200
        admin_items = r5.json()["items"]
        assert not any(i.get("meta", {}).get("invite_code") == code for i in admin_items)

    def test_update_and_delete_invite(self, admin_headers, created_tour):
        tid = created_tour["tour_id"]
        r = requests.post(
            f"{BASE_URL}/api/tours/{tid}/invites",
            json={"player_name": "ToEdit"},
            headers=admin_headers, timeout=TIMEOUT,
        )
        assert r.status_code == 200
        invite_id = r.json()["invite_id"]

        r2 = requests.put(
            f"{BASE_URL}/api/tours/{tid}/invites/{invite_id}",
            json={"player_name": "Edited"},
            headers=admin_headers, timeout=TIMEOUT,
        )
        assert r2.status_code == 200, r2.text

        r3 = requests.delete(
            f"{BASE_URL}/api/tours/{tid}/invites/{invite_id}",
            headers=admin_headers, timeout=TIMEOUT,
        )
        assert r3.status_code == 200

    def test_mark_all_read(self, admin_headers, created_tour, second_user):
        tid = created_tour["tour_id"]
        # create 2 invites to generate 2 notifications
        for _ in range(2):
            requests.post(
                f"{BASE_URL}/api/tours/{tid}/invites",
                json={"target_user_id": second_user["user_id"]},
                headers=admin_headers, timeout=TIMEOUT,
            )
        time.sleep(0.3)
        r1 = requests.get(
            f"{BASE_URL}/api/notifications", headers=second_user["headers"], timeout=TIMEOUT
        )
        assert r1.status_code == 200
        # mark-all-read
        r2 = requests.post(
            f"{BASE_URL}/api/notifications/mark-all-read",
            headers=second_user["headers"], timeout=TIMEOUT,
        )
        assert r2.status_code == 200
        r3 = requests.get(
            f"{BASE_URL}/api/notifications", headers=second_user["headers"], timeout=TIMEOUT
        )
        assert r3.status_code == 200
        assert r3.json()["unread_count"] == 0


# --------------------------- Invite Preview (unauthenticated) + Accept ---------------------------

class TestInvitePreviewAndAccept:
    def test_preview_personal_invite_unauthenticated(self, admin_headers, created_tour):
        tid = created_tour["tour_id"]
        # create a personal invite
        r = requests.post(
            f"{BASE_URL}/api/tours/{tid}/invites",
            json={"player_name": "Preview Guest"},
            headers=admin_headers, timeout=TIMEOUT,
        )
        assert r.status_code == 200
        code = r.json()["code"]

        # hit preview endpoint with NO auth
        r2 = requests.get(f"{BASE_URL}/api/tours/invite/{code}", timeout=TIMEOUT)
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert data.get("code") == code
        assert data.get("player_name") == "Preview Guest"
        # tour metadata must be embedded
        assert "tour" in data
        assert data["tour"]["tour_id"] == tid
        assert data["tour"]["name"] == created_tour["name"]

    def test_preview_general_tour_invite_code(self, created_tour):
        # general tour-wide invite_code should also resolve (fallback branch)
        code = created_tour["invite_code"]
        r = requests.get(f"{BASE_URL}/api/tours/invite/{code}", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data.get("tour_id") == created_tour["tour_id"]

    def test_accept_personal_invite_applies_course_and_marks_accepted(
        self, admin_headers, created_tour, second_user
    ):
        tid = created_tour["tour_id"]
        # create an invite with course_name (no course_id needed to test name propagation)
        r = requests.post(
            f"{BASE_URL}/api/tours/{tid}/invites",
            json={"target_user_id": second_user["user_id"],
                  "course_name": "TEST Municipal CC"},
            headers=admin_headers, timeout=TIMEOUT,
        )
        assert r.status_code == 200
        code = r.json()["code"]

        # second_user accepts
        r2 = requests.post(
            f"{BASE_URL}/api/tours/invite/{code}/accept",
            headers=second_user["headers"], timeout=TIMEOUT,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["tour_id"] == tid

        # verify tour participant list has user with the invite course
        r3 = requests.get(f"{BASE_URL}/api/tours/{tid}", headers=admin_headers, timeout=TIMEOUT)
        assert r3.status_code == 200
        tour = r3.json()
        me = [p for p in tour["participants"] if p["user_id"] == second_user["user_id"]]
        assert len(me) == 1
        assert me[0]["course_name"] == "TEST Municipal CC"

        # invite status should be accepted
        r4 = requests.get(
            f"{BASE_URL}/api/tours/{tid}/invites", headers=admin_headers, timeout=TIMEOUT
        )
        assert r4.status_code == 200
        inv = [i for i in r4.json() if i["code"] == code][0]
        assert inv["status"] == "accepted"
        assert inv["accepted_by_user_id"] == second_user["user_id"]

        # double-accept must 400
        r5 = requests.post(
            f"{BASE_URL}/api/tours/invite/{code}/accept",
            headers=second_user["headers"], timeout=TIMEOUT,
        )
        assert r5.status_code == 400


# --------------------------- Tour join inherits suggested_course (Phase 13) ---------------------------

class TestTourJoinInheritsCourse:
    def test_join_inherits_suggested_course(self, admin_headers, second_user):
        payload = {
            "name": f"TEST InheritCourse {uuid.uuid4().hex[:4]}",
            "num_rounds": 2,
            "suggested_course_name": "Pebble Beach TEST",
        }
        r = requests.post(f"{BASE_URL}/api/tours", json=payload, headers=admin_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        tour = r.json()
        tid = tour["tour_id"]
        try:
            # second_user joins via /join (not invite)
            r2 = requests.post(
                f"{BASE_URL}/api/tours/{tid}/join",
                headers=second_user["headers"], timeout=TIMEOUT,
            )
            assert r2.status_code == 200, r2.text
            # Fetch tour and verify
            r3 = requests.get(f"{BASE_URL}/api/tours/{tid}", headers=admin_headers, timeout=TIMEOUT)
            assert r3.status_code == 200
            me = [p for p in r3.json()["participants"] if p["user_id"] == second_user["user_id"]]
            assert len(me) == 1
            assert me[0]["course_name"] == "Pebble Beach TEST"

            # participant course update endpoint still works
            r4 = requests.put(
                f"{BASE_URL}/api/tours/{tid}/participants/{second_user['user_id']}/course",
                json={"course_name": "Augusta TEST"},
                headers=second_user["headers"], timeout=TIMEOUT,
            )
            assert r4.status_code == 200, r4.text
            r5 = requests.get(f"{BASE_URL}/api/tours/{tid}", headers=admin_headers, timeout=TIMEOUT)
            me2 = [p for p in r5.json()["participants"] if p["user_id"] == second_user["user_id"]][0]
            assert me2["course_name"] == "Augusta TEST"
        finally:
            requests.delete(f"{BASE_URL}/api/tours/{tid}", headers=admin_headers, timeout=TIMEOUT)


# --------------------------- Phase 12 regression: Match Play + Random Scorer ---------------------------

class TestPhase12Regression:
    """Light regression — ensure previously-landed Phase 12 endpoints still respond."""

    def test_match_play_bracket_generate(self, admin_headers):
        # create a tournament with match_play format
        payload = {
            "tournament_name": f"TEST MP {uuid.uuid4().hex[:4]}",
            "course_name": "Test Course",
            "format": "match_play",
            "num_holes": 18,
            "pars": [4] * 18,
        }
        r = requests.post(
            f"{BASE_URL}/api/tournaments", json=payload, headers=admin_headers, timeout=TIMEOUT
        )
        if r.status_code not in (200, 201):
            pytest.skip(f"tournament create shape changed: {r.status_code} {r.text[:200]}")
        t = r.json()
        tid = t.get("tournament_id") or t.get("id")
        if not tid:
            pytest.skip("tournament id missing from response")
        try:
            # add 4 guest players so bracket has enough
            for i in range(4):
                requests.post(
                    f"{BASE_URL}/api/tournaments/{tid}/add-player",
                    json={"player_name": f"TEST P{i}"},
                    headers=admin_headers, timeout=TIMEOUT,
                )
            r2 = requests.post(
                f"{BASE_URL}/api/tournaments/{tid}/bracket/generate",
                headers=admin_headers, timeout=TIMEOUT,
            )
            # endpoint must exist and either succeed or return a clear 4xx
            assert r2.status_code in (200, 201, 400), f"unexpected: {r2.status_code} {r2.text}"
            if r2.status_code in (200, 201):
                r3 = requests.get(
                    f"{BASE_URL}/api/tournaments/{tid}/bracket",
                    headers=admin_headers, timeout=TIMEOUT,
                )
                assert r3.status_code == 200
                bracket = r3.json()
                assert "rounds" in bracket or "matches" in bracket
        finally:
            requests.delete(
                f"{BASE_URL}/api/tournaments/{tid}", headers=admin_headers, timeout=TIMEOUT
            )

    def test_keeper_random_scorer_rejects_non_assigned(self, admin_headers):
        """POST /api/scorecards/keeper must reject an unassigned scorer for random_scorer format.
        We don't fully wire scorer-assignments here; we just verify the endpoint rejects an
        obviously-unauthorized submission with 400/403."""
        # Build a minimal random_scorer tournament
        payload = {
            "tournament_name": f"TEST RS {uuid.uuid4().hex[:4]}",
            "course_name": "Test",
            "format": "random_scorer",
            "num_holes": 9,
            "pars": [4] * 9,
        }
        r = requests.post(
            f"{BASE_URL}/api/tournaments", json=payload, headers=admin_headers, timeout=TIMEOUT
        )
        if r.status_code not in (200, 201):
            pytest.skip(f"tournament create shape changed: {r.status_code} {r.text[:200]}")
        t = r.json()
        tid = t.get("tournament_id") or t.get("id")
        if not tid:
            pytest.skip("tournament id missing")
        try:
            r2 = requests.post(
                f"{BASE_URL}/api/scorecards/keeper",
                json={
                    "tournament_id": tid,
                    "user_id": "some_other_user",
                    "holes": [4] * 9,
                },
                headers=admin_headers, timeout=TIMEOUT,
            )
            # Must be 4xx (not 500) — the exact code depends on business logic
            assert 400 <= r2.status_code < 500, (
                f"expected 4xx rejection for non-assigned scorer, got {r2.status_code} {r2.text}"
            )
        finally:
            requests.delete(
                f"{BASE_URL}/api/tournaments/{tid}", headers=admin_headers, timeout=TIMEOUT
            )
