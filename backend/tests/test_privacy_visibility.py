"""
Test suite for Privacy/Visibility System
Tests: tournaments, challenges, tours visibility filtering, invite codes, leaderboard access control
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@fairway.com"
ADMIN_PASSWORD = "FairwayAdmin123!"

class TestAuthSetup:
    """Setup and verify authentication works"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        # First seed admin if needed
        requests.post(f"{BASE_URL}/api/admin/seed")
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_admin_login(self, admin_token):
        """Verify admin can login"""
        assert admin_token is not None
        assert len(admin_token) > 0
        print(f"Admin login successful, token length: {len(admin_token)}")


class TestTournamentVisibility:
    """Test tournament visibility and filtering"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        requests.post(f"{BASE_URL}/api/admin/seed")
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_create_private_tournament_default(self, admin_headers):
        """POST /api/tournaments creates tournament with visibility='private' by default and generates invite_code"""
        unique_name = f"TEST_Private_Tournament_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/tournaments", json={
            "name": unique_name,
            "course_name": "Test Course",
            "start_date": "2026-02-01",
            "end_date": "2026-02-03",
            "scoring_format": "stroke",
            "num_holes": 18,
            "par_per_hole": [4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4],
            "max_players": 50
            # Note: NOT passing visibility - should default to private
        }, headers=admin_headers)
        
        assert response.status_code == 200, f"Create tournament failed: {response.text}"
        data = response.json()
        
        # Verify visibility defaults to private
        assert data.get("visibility") == "private", f"Expected visibility='private', got {data.get('visibility')}"
        
        # Verify invite_code is generated
        assert "invite_code" in data, "invite_code not found in response"
        assert len(data["invite_code"]) == 6, f"invite_code should be 6 chars, got {len(data['invite_code'])}"
        assert data["invite_code"].isupper(), "invite_code should be uppercase"
        
        print(f"Created private tournament: {data['tournament_id']}, invite_code: {data['invite_code']}")
        return data
    
    def test_create_public_tournament(self, admin_headers):
        """POST /api/tournaments with visibility='public' creates a public tournament"""
        unique_name = f"TEST_Public_Tournament_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/tournaments", json={
            "name": unique_name,
            "course_name": "Public Course",
            "start_date": "2026-02-01",
            "end_date": "2026-02-03",
            "scoring_format": "stroke",
            "num_holes": 18,
            "par_per_hole": [4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4],
            "max_players": 100,
            "visibility": "public"
        }, headers=admin_headers)
        
        assert response.status_code == 200, f"Create public tournament failed: {response.text}"
        data = response.json()
        
        assert data.get("visibility") == "public", f"Expected visibility='public', got {data.get('visibility')}"
        assert "invite_code" in data, "invite_code should still be generated for public tournaments"
        
        print(f"Created public tournament: {data['tournament_id']}")
        return data
    
    def test_list_tournaments_unauthenticated_only_public(self, admin_headers):
        """GET /api/tournaments returns only public tournaments for unauthenticated users"""
        # First create one public and one private tournament
        public_name = f"TEST_Public_List_{uuid.uuid4().hex[:6]}"
        private_name = f"TEST_Private_List_{uuid.uuid4().hex[:6]}"
        
        # Create public
        pub_resp = requests.post(f"{BASE_URL}/api/tournaments", json={
            "name": public_name,
            "course_name": "Public Course",
            "start_date": "2026-03-01",
            "end_date": "2026-03-03",
            "scoring_format": "stroke",
            "num_holes": 18,
            "par_per_hole": [4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4],
            "visibility": "public"
        }, headers=admin_headers)
        assert pub_resp.status_code == 200
        public_id = pub_resp.json()["tournament_id"]
        
        # Create private
        priv_resp = requests.post(f"{BASE_URL}/api/tournaments", json={
            "name": private_name,
            "course_name": "Private Course",
            "start_date": "2026-03-01",
            "end_date": "2026-03-03",
            "scoring_format": "stroke",
            "num_holes": 18,
            "par_per_hole": [4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4],
            "visibility": "private"
        }, headers=admin_headers)
        assert priv_resp.status_code == 200
        private_id = priv_resp.json()["tournament_id"]
        
        # Now fetch without auth
        response = requests.get(f"{BASE_URL}/api/tournaments")
        assert response.status_code == 200
        tournaments = response.json()
        
        tournament_ids = [t["tournament_id"] for t in tournaments]
        tournament_names = [t["name"] for t in tournaments]
        
        # Public should be visible
        assert public_id in tournament_ids, f"Public tournament {public_id} should be visible to unauthenticated users"
        
        # Private should NOT be visible
        assert private_id not in tournament_ids, f"Private tournament {private_id} should NOT be visible to unauthenticated users"
        
        print(f"Unauthenticated user sees {len(tournaments)} tournaments, public visible, private hidden")
    
    def test_list_tournaments_admin_sees_all(self, admin_headers):
        """GET /api/tournaments returns all tournaments for admin users"""
        response = requests.get(f"{BASE_URL}/api/tournaments", headers=admin_headers)
        assert response.status_code == 200
        tournaments = response.json()
        
        # Admin should see both public and private
        has_public = any(t.get("visibility") == "public" for t in tournaments)
        has_private = any(t.get("visibility", "private") == "private" for t in tournaments)
        
        print(f"Admin sees {len(tournaments)} tournaments (public: {has_public}, private: {has_private})")
        # Admin should see private tournaments
        assert has_private or len(tournaments) == 0, "Admin should see private tournaments"
    
    def test_get_tournament_by_invite_code(self, admin_headers):
        """GET /api/tournaments/invite/{invite_code} resolves tournament by invite code"""
        # Create a private tournament
        unique_name = f"TEST_Invite_Tournament_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/tournaments", json={
            "name": unique_name,
            "course_name": "Invite Course",
            "start_date": "2026-04-01",
            "end_date": "2026-04-03",
            "scoring_format": "stroke",
            "num_holes": 18,
            "par_per_hole": [4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4],
            "visibility": "private"
        }, headers=admin_headers)
        assert create_resp.status_code == 200
        tournament = create_resp.json()
        invite_code = tournament["invite_code"]
        
        # Fetch by invite code (no auth needed)
        response = requests.get(f"{BASE_URL}/api/tournaments/invite/{invite_code}")
        assert response.status_code == 200, f"Get by invite code failed: {response.text}"
        
        data = response.json()
        assert data["tournament_id"] == tournament["tournament_id"]
        assert data["name"] == unique_name
        
        print(f"Successfully resolved tournament by invite code: {invite_code}")
    
    def test_invalid_invite_code_returns_404(self):
        """GET /api/tournaments/invite/{invalid} returns 404"""
        response = requests.get(f"{BASE_URL}/api/tournaments/invite/INVALID")
        assert response.status_code == 404, f"Expected 404 for invalid invite code, got {response.status_code}"
        print("Invalid invite code correctly returns 404")


class TestLeaderboardAccessControl:
    """Test leaderboard access control for private tournaments"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        requests.post(f"{BASE_URL}/api/admin/seed")
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_leaderboard_public_tournament_no_auth(self, admin_headers):
        """GET /api/leaderboard/{id} works for public tournaments without auth"""
        # Create public tournament
        unique_name = f"TEST_Public_LB_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/tournaments", json={
            "name": unique_name,
            "course_name": "Public LB Course",
            "start_date": "2026-05-01",
            "end_date": "2026-05-03",
            "scoring_format": "stroke",
            "num_holes": 18,
            "par_per_hole": [4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4],
            "visibility": "public"
        }, headers=admin_headers)
        assert create_resp.status_code == 200
        tournament_id = create_resp.json()["tournament_id"]
        
        # Access leaderboard without auth
        response = requests.get(f"{BASE_URL}/api/leaderboard/{tournament_id}")
        assert response.status_code == 200, f"Public leaderboard should be accessible without auth: {response.text}"
        
        data = response.json()
        assert "tournament" in data
        assert "leaderboard" in data
        
        print(f"Public tournament leaderboard accessible without auth")
    
    def test_leaderboard_private_tournament_403_no_auth(self, admin_headers):
        """GET /api/leaderboard/{id} returns 403 for private tournaments when user is not authenticated"""
        # Create private tournament
        unique_name = f"TEST_Private_LB_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/tournaments", json={
            "name": unique_name,
            "course_name": "Private LB Course",
            "start_date": "2026-05-01",
            "end_date": "2026-05-03",
            "scoring_format": "stroke",
            "num_holes": 18,
            "par_per_hole": [4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4],
            "visibility": "private"
        }, headers=admin_headers)
        assert create_resp.status_code == 200
        tournament_id = create_resp.json()["tournament_id"]
        
        # Access leaderboard without auth - should get 403
        response = requests.get(f"{BASE_URL}/api/leaderboard/{tournament_id}")
        assert response.status_code == 403, f"Private leaderboard should return 403 without auth, got {response.status_code}"
        
        print(f"Private tournament leaderboard correctly returns 403 for unauthenticated users")
    
    def test_leaderboard_private_tournament_403_non_participant(self, admin_headers):
        """GET /api/leaderboard/{id} returns 403 for private tournaments when user is not a participant"""
        # Create private tournament
        unique_name = f"TEST_Private_LB_NonPart_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/tournaments", json={
            "name": unique_name,
            "course_name": "Private LB Course",
            "start_date": "2026-05-01",
            "end_date": "2026-05-03",
            "scoring_format": "stroke",
            "num_holes": 18,
            "par_per_hole": [4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4],
            "visibility": "private"
        }, headers=admin_headers)
        assert create_resp.status_code == 200
        tournament_id = create_resp.json()["tournament_id"]
        
        # Create a new user who is NOT registered for this tournament
        test_email = f"test_nonpart_{uuid.uuid4().hex[:6]}@test.com"
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "TestPass123!",
            "name": "Non Participant"
        })
        assert reg_resp.status_code == 200
        user_token = reg_resp.json()["token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        
        # Access leaderboard as non-participant - should get 403
        response = requests.get(f"{BASE_URL}/api/leaderboard/{tournament_id}", headers=user_headers)
        assert response.status_code == 403, f"Private leaderboard should return 403 for non-participants, got {response.status_code}"
        
        print(f"Private tournament leaderboard correctly returns 403 for non-participants")
    
    def test_leaderboard_private_tournament_admin_access(self, admin_headers):
        """GET /api/leaderboard/{id} works for admin on private tournaments"""
        # Create private tournament
        unique_name = f"TEST_Private_LB_Admin_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/tournaments", json={
            "name": unique_name,
            "course_name": "Private LB Course",
            "start_date": "2026-05-01",
            "end_date": "2026-05-03",
            "scoring_format": "stroke",
            "num_holes": 18,
            "par_per_hole": [4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4],
            "visibility": "private"
        }, headers=admin_headers)
        assert create_resp.status_code == 200
        tournament_id = create_resp.json()["tournament_id"]
        
        # Admin should be able to access
        response = requests.get(f"{BASE_URL}/api/leaderboard/{tournament_id}", headers=admin_headers)
        assert response.status_code == 200, f"Admin should access private leaderboard: {response.text}"
        
        print(f"Admin can access private tournament leaderboard")


class TestChallengeVisibility:
    """Test challenge visibility and filtering"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        requests.post(f"{BASE_URL}/api/admin/seed")
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    @pytest.fixture(scope="class")
    def test_course(self, admin_headers):
        """Create a test course for challenges"""
        course_name = f"TEST_Challenge_Course_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/courses", json={
            "course_name": course_name,
            "num_holes": 9,
            "holes": [{"hole": i, "par": 4, "yardage": 350} for i in range(1, 10)]
        }, headers=admin_headers)
        if response.status_code == 200:
            return response.json()
        # If course creation fails, try to get existing courses
        courses_resp = requests.get(f"{BASE_URL}/api/courses")
        if courses_resp.status_code == 200 and len(courses_resp.json()) > 0:
            return courses_resp.json()[0]
        pytest.skip("No courses available for challenge tests")
    
    def test_create_challenge_with_visibility_and_invite_code(self, admin_headers, test_course):
        """POST /api/challenges creates challenge with visibility and invite_code"""
        unique_name = f"TEST_Challenge_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/challenges", json={
            "name": unique_name,
            "course_ids": [test_course["course_id"]],
            "visibility": "private"
        }, headers=admin_headers)
        
        assert response.status_code == 200, f"Create challenge failed: {response.text}"
        data = response.json()
        
        assert data.get("visibility") == "private"
        assert "invite_code" in data
        assert len(data["invite_code"]) == 6
        
        print(f"Created challenge with visibility and invite_code: {data['invite_code']}")
    
    def test_list_challenges_unauthenticated_empty(self):
        """GET /api/challenges returns empty for unauthenticated users (all default private)"""
        response = requests.get(f"{BASE_URL}/api/challenges")
        assert response.status_code == 200
        challenges = response.json()
        
        # All challenges should be filtered out for unauthenticated users if they're private
        # Only public challenges should be visible
        for ch in challenges:
            assert ch.get("visibility") == "public", f"Unauthenticated user should only see public challenges"
        
        print(f"Unauthenticated user sees {len(challenges)} challenges (only public)")
    
    def test_list_challenges_logged_in_sees_own(self, admin_headers, test_course):
        """GET /api/challenges returns public + user's challenges for logged-in users"""
        # Create a private challenge as admin
        unique_name = f"TEST_My_Challenge_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/challenges", json={
            "name": unique_name,
            "course_ids": [test_course["course_id"]],
            "visibility": "private"
        }, headers=admin_headers)
        assert create_resp.status_code == 200
        challenge_id = create_resp.json()["challenge_id"]
        
        # Admin should see their own challenge
        response = requests.get(f"{BASE_URL}/api/challenges", headers=admin_headers)
        assert response.status_code == 200
        challenges = response.json()
        
        challenge_ids = [ch["challenge_id"] for ch in challenges]
        assert challenge_id in challenge_ids, "User should see their own private challenge"
        
        print(f"Logged-in user sees their own challenges")
    
    def test_get_challenge_by_invite_code(self, admin_headers, test_course):
        """GET /api/challenges/invite/{invite_code} resolves challenge by invite code"""
        unique_name = f"TEST_Invite_Challenge_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/challenges", json={
            "name": unique_name,
            "course_ids": [test_course["course_id"]],
            "visibility": "private"
        }, headers=admin_headers)
        assert create_resp.status_code == 200
        challenge = create_resp.json()
        invite_code = challenge["invite_code"]
        
        # Fetch by invite code
        response = requests.get(f"{BASE_URL}/api/challenges/invite/{invite_code}")
        assert response.status_code == 200, f"Get challenge by invite code failed: {response.text}"
        
        data = response.json()
        assert data["challenge_id"] == challenge["challenge_id"]
        
        print(f"Successfully resolved challenge by invite code: {invite_code}")


class TestTourVisibility:
    """Test tour visibility and filtering"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        requests.post(f"{BASE_URL}/api/admin/seed")
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_create_tour_with_visibility_and_invite_code(self, admin_headers):
        """POST /api/tours creates tour with visibility field and invite_code"""
        unique_name = f"TEST_Tour_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/tours", json={
            "name": unique_name,
            "num_rounds": 5,
            "scoring_format": "stroke",
            "visibility": "private"
        }, headers=admin_headers)
        
        assert response.status_code == 200, f"Create tour failed: {response.text}"
        data = response.json()
        
        assert data.get("visibility") == "private"
        assert "invite_code" in data
        assert len(data["invite_code"]) == 6
        
        print(f"Created tour with visibility and invite_code: {data['invite_code']}")
    
    def test_create_public_tour(self, admin_headers):
        """POST /api/tours with visibility='public' creates public tour"""
        unique_name = f"TEST_Public_Tour_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/tours", json={
            "name": unique_name,
            "num_rounds": 5,
            "scoring_format": "stroke",
            "visibility": "public"
        }, headers=admin_headers)
        
        assert response.status_code == 200, f"Create public tour failed: {response.text}"
        data = response.json()
        
        assert data.get("visibility") == "public"
        print(f"Created public tour: {data['tour_id']}")
    
    def test_list_tours_visibility_filtering(self, admin_headers):
        """GET /api/tours returns only public/user's tours"""
        # Create private tour
        private_name = f"TEST_Private_Tour_{uuid.uuid4().hex[:6]}"
        priv_resp = requests.post(f"{BASE_URL}/api/tours", json={
            "name": private_name,
            "num_rounds": 5,
            "scoring_format": "stroke",
            "visibility": "private"
        }, headers=admin_headers)
        assert priv_resp.status_code == 200
        private_tour_id = priv_resp.json()["tour_id"]
        
        # Create public tour
        public_name = f"TEST_Public_Tour_{uuid.uuid4().hex[:6]}"
        pub_resp = requests.post(f"{BASE_URL}/api/tours", json={
            "name": public_name,
            "num_rounds": 5,
            "scoring_format": "stroke",
            "visibility": "public"
        }, headers=admin_headers)
        assert pub_resp.status_code == 200
        public_tour_id = pub_resp.json()["tour_id"]
        
        # Unauthenticated user should only see public
        unauth_resp = requests.get(f"{BASE_URL}/api/tours")
        assert unauth_resp.status_code == 200
        unauth_tours = unauth_resp.json()
        unauth_tour_ids = [t["tour_id"] for t in unauth_tours]
        
        assert public_tour_id in unauth_tour_ids, "Public tour should be visible to unauthenticated users"
        assert private_tour_id not in unauth_tour_ids, "Private tour should NOT be visible to unauthenticated users"
        
        # Admin should see both
        auth_resp = requests.get(f"{BASE_URL}/api/tours", headers=admin_headers)
        assert auth_resp.status_code == 200
        auth_tours = auth_resp.json()
        auth_tour_ids = [t["tour_id"] for t in auth_tours]
        
        assert public_tour_id in auth_tour_ids
        assert private_tour_id in auth_tour_ids
        
        print(f"Tour visibility filtering works correctly")
    
    def test_get_tour_by_invite_code(self, admin_headers):
        """GET /api/tours/invite/{invite_code} resolves tour by invite code"""
        unique_name = f"TEST_Invite_Tour_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/tours", json={
            "name": unique_name,
            "num_rounds": 5,
            "scoring_format": "stroke",
            "visibility": "private"
        }, headers=admin_headers)
        assert create_resp.status_code == 200
        tour = create_resp.json()
        invite_code = tour["invite_code"]
        
        # Fetch by invite code
        response = requests.get(f"{BASE_URL}/api/tours/invite/{invite_code}")
        assert response.status_code == 200, f"Get tour by invite code failed: {response.text}"
        
        data = response.json()
        assert data["tour_id"] == tour["tour_id"]
        
        print(f"Successfully resolved tour by invite code: {invite_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
