import requests
import sys
import json
from datetime import datetime

class FairwayAPITester:
    def __init__(self, base_url="https://par-tracker-preview.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.player_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tournament_id = None
        self.multi_round_tournament_id = None
        self.scorecard_id = None
        self.player_user_id = None
        self.guest_user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, auth_token=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if auth_token:
            test_headers['Authorization'] = f'Bearer {auth_token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_seed(self):
        """Test admin seed endpoint"""
        success, response = self.run_test(
            "Admin Seed",
            "POST",
            "admin/seed",
            200
        )
        return success

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@fairway.com", "password": "FairwayAdmin123!"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    def test_player_register(self):
        """Test player registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        success, response = self.run_test(
            "Player Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": f"player{timestamp}@test.com",
                "password": "TestPlayer123!",
                "name": f"Test Player {timestamp}"
            }
        )
        if success and 'token' in response:
            self.player_token = response['token']
            print(f"   Player token obtained: {self.player_token[:20]}...")
            return True
        return False

    def test_auth_me(self, token, user_type):
        """Test /auth/me endpoint"""
        success, response = self.run_test(
            f"Get Current User ({user_type})",
            "GET",
            "auth/me",
            200,
            auth_token=token
        )
        if success:
            print(f"   User: {response.get('name')} ({response.get('role')})")
            if user_type == "player" and 'user_id' in response:
                self.player_user_id = response['user_id']
                print(f"   Player User ID: {self.player_user_id}")
        return success

    def test_logout(self, token, user_type):
        """Test logout endpoint"""
        success, response = self.run_test(
            f"Logout ({user_type})",
            "POST",
            "auth/logout",
            200,
            auth_token=token
        )
        return success

    def test_create_stroke_tournament(self):
        """Test creating stroke play tournament"""
        tournament_data = {
            "name": "Test Stroke Play Championship",
            "course_name": "Test Golf Course",
            "start_date": "2025-02-01",
            "end_date": "2025-02-03",
            "scoring_format": "stroke",
            "num_holes": 18,
            "par_per_hole": [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4],
            "max_players": 100,
            "description": "Test tournament for stroke play"
        }
        
        success, response = self.run_test(
            "Create Stroke Play Tournament",
            "POST",
            "tournaments",
            200,
            data=tournament_data,
            auth_token=self.admin_token
        )
        if success and 'tournament_id' in response:
            self.tournament_id = response['tournament_id']
            print(f"   Tournament ID: {self.tournament_id}")
        return success

    def test_create_multi_round_tournament(self):
        """Test creating multi-round tournament with num_rounds=4"""
        tournament_data = {
            "name": "Test Multi-Round Championship",
            "course_name": "Test Golf Course",
            "start_date": "2025-02-10",
            "end_date": "2025-02-13",
            "scoring_format": "stroke",
            "num_holes": 18,
            "num_rounds": 4,
            "par_per_hole": [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4],
            "max_players": 100,
            "description": "Test 4-round tournament"
        }
        
        success, response = self.run_test(
            "Create Multi-Round Tournament (4 rounds)",
            "POST",
            "tournaments",
            200,
            data=tournament_data,
            auth_token=self.admin_token
        )
        if success and 'tournament_id' in response:
            self.multi_round_tournament_id = response['tournament_id']
            print(f"   Multi-round Tournament ID: {self.multi_round_tournament_id}")
            print(f"   Number of rounds: {response.get('num_rounds', 1)}")
        return success

    def test_create_stableford_tournament(self):
        """Test creating stableford tournament"""
        tournament_data = {
            "name": "Test Stableford Championship",
            "course_name": "Test Golf Course",
            "start_date": "2025-02-05",
            "end_date": "2025-02-07",
            "scoring_format": "stableford",
            "num_holes": 18,
            "par_per_hole": [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4],
            "max_players": 100,
            "description": "Test tournament for stableford"
        }
        
        success, response = self.run_test(
            "Create Stableford Tournament",
            "POST",
            "tournaments",
            200,
            data=tournament_data,
            auth_token=self.admin_token
        )
        return success

    def test_list_tournaments(self):
        """Test listing tournaments"""
        success, response = self.run_test(
            "List All Tournaments",
            "GET",
            "tournaments",
            200
        )
        if success:
            print(f"   Found {len(response)} tournaments")
        return success

    def test_update_tournament_status(self):
        """Test updating tournament status to active"""
        if not self.tournament_id:
            print("❌ No tournament ID available for status update")
            return False
            
        success, response = self.run_test(
            "Update Tournament Status to Active",
            "PUT",
            f"tournaments/{self.tournament_id}",
            200,
            data={"status": "active"},
            auth_token=self.admin_token
        )
        return success

    def test_submit_scorecard(self):
        """Test submitting a scorecard"""
        if not self.tournament_id:
            print("❌ No tournament ID available for scorecard submission")
            return False
            
        scorecard_data = {
            "tournament_id": self.tournament_id,
            "round_number": 1,
            "holes": [
                {"hole": 1, "strokes": 4, "par": 4},
                {"hole": 2, "strokes": 3, "par": 3},
                {"hole": 3, "strokes": 6, "par": 5},
                {"hole": 4, "strokes": 5, "par": 4},
                {"hole": 5, "strokes": 4, "par": 4},
                {"hole": 6, "strokes": 2, "par": 3},
                {"hole": 7, "strokes": 4, "par": 4},
                {"hole": 8, "strokes": 5, "par": 5},
                {"hole": 9, "strokes": 4, "par": 4},
                {"hole": 10, "strokes": 4, "par": 4},
                {"hole": 11, "strokes": 3, "par": 3},
                {"hole": 12, "strokes": 5, "par": 5},
                {"hole": 13, "strokes": 4, "par": 4},
                {"hole": 14, "strokes": 4, "par": 4},
                {"hole": 15, "strokes": 3, "par": 3},
                {"hole": 16, "strokes": 4, "par": 4},
                {"hole": 17, "strokes": 5, "par": 5},
                {"hole": 18, "strokes": 4, "par": 4}
            ]
        }
        
        success, response = self.run_test(
            "Submit Scorecard",
            "POST",
            "scorecards",
            200,
            data=scorecard_data,
            auth_token=self.player_token
        )
        if success and 'scorecard_id' in response:
            self.scorecard_id = response['scorecard_id']
            print(f"   Scorecard ID: {self.scorecard_id}")
            print(f"   Total strokes: {response.get('total_strokes')}")
            print(f"   To par: {response.get('total_to_par')}")
        return success

    def test_get_leaderboard(self):
        """Test getting public leaderboard"""
        if not self.tournament_id:
            print("❌ No tournament ID available for leaderboard")
            return False
            
        success, response = self.run_test(
            "Get Public Leaderboard",
            "GET",
            f"leaderboard/{self.tournament_id}",
            200
        )
        if success:
            leaderboard = response.get('leaderboard', [])
            print(f"   Leaderboard entries: {len(leaderboard)}")
            if leaderboard:
                for i, entry in enumerate(leaderboard[:3]):
                    print(f"   {i+1}. {entry.get('player_name')} - {entry.get('total_to_par')} to par")
        return success

    def test_get_my_scorecards(self):
        """Test getting player's scorecards"""
        success, response = self.run_test(
            "Get My Scorecards",
            "GET",
            "scorecards/my",
            200,
            auth_token=self.player_token
        )
        if success:
            print(f"   Found {len(response)} scorecards")
        return success

    # NEW FEATURE TESTS - Tournament Registration
    def test_tournament_registration(self):
        """Test player registration for tournament"""
        if not self.tournament_id:
            print("❌ No tournament ID available for registration")
            return False
            
        success, response = self.run_test(
            "Register for Tournament",
            "POST",
            f"tournaments/{self.tournament_id}/register",
            200,
            auth_token=self.player_token
        )
        if success:
            print(f"   Registration ID: {response.get('registration_id')}")
        return success

    def test_get_my_registrations(self):
        """Test getting player's registered tournaments"""
        success, response = self.run_test(
            "Get My Registrations",
            "GET",
            "registrations/my",
            200,
            auth_token=self.player_token
        )
        if success:
            print(f"   Registered for {len(response)} tournaments")
            print(f"   Tournament IDs: {response}")
        return success

    def test_get_tournament_participants(self):
        """Test getting tournament participants"""
        if not self.tournament_id:
            print("❌ No tournament ID available for participants")
            return False
            
        success, response = self.run_test(
            "Get Tournament Participants",
            "GET",
            f"tournaments/{self.tournament_id}/participants",
            200
        )
        if success:
            print(f"   Found {len(response)} participants")
        return success

    def test_scorecard_without_registration(self):
        """Test submitting scorecard without registration (should fail)"""
        if not self.multi_round_tournament_id:
            print("❌ No multi-round tournament ID available")
            return False
            
        scorecard_data = {
            "tournament_id": self.multi_round_tournament_id,
            "round_number": 1,
            "holes": [
                {"hole": 1, "strokes": 4, "par": 4},
                {"hole": 2, "strokes": 3, "par": 3}
            ]
        }
        
        success, response = self.run_test(
            "Submit Scorecard Without Registration (should fail)",
            "POST",
            "scorecards",
            403,  # Should return 403 Forbidden
            data=scorecard_data,
            auth_token=self.player_token
        )
        return success

    # NEW FEATURE TESTS - Multi-Round Support
    def test_multi_round_registration_and_scoring(self):
        """Test registration and multi-round scoring"""
        if not self.multi_round_tournament_id:
            print("❌ No multi-round tournament ID available")
            return False

        # First register for the multi-round tournament
        success, response = self.run_test(
            "Register for Multi-Round Tournament",
            "POST",
            f"tournaments/{self.multi_round_tournament_id}/register",
            200,
            auth_token=self.player_token
        )
        if not success:
            return False

        # Activate the tournament
        success, response = self.run_test(
            "Activate Multi-Round Tournament",
            "PUT",
            f"tournaments/{self.multi_round_tournament_id}",
            200,
            data={"status": "active"},
            auth_token=self.admin_token
        )
        if not success:
            return False

        return True

    def test_submit_round_1_scorecard(self):
        """Test submitting round 1 scorecard"""
        if not self.multi_round_tournament_id:
            print("❌ No multi-round tournament ID available")
            return False
            
        scorecard_data = {
            "tournament_id": self.multi_round_tournament_id,
            "round_number": 1,
            "holes": [
                {"hole": 1, "strokes": 4, "par": 4},
                {"hole": 2, "strokes": 3, "par": 3},
                {"hole": 3, "strokes": 6, "par": 5},
                {"hole": 4, "strokes": 5, "par": 4},
                {"hole": 5, "strokes": 4, "par": 4},
                {"hole": 6, "strokes": 2, "par": 3},
                {"hole": 7, "strokes": 4, "par": 4},
                {"hole": 8, "strokes": 5, "par": 5},
                {"hole": 9, "strokes": 4, "par": 4},
                {"hole": 10, "strokes": 4, "par": 4},
                {"hole": 11, "strokes": 3, "par": 3},
                {"hole": 12, "strokes": 5, "par": 5},
                {"hole": 13, "strokes": 4, "par": 4},
                {"hole": 14, "strokes": 4, "par": 4},
                {"hole": 15, "strokes": 3, "par": 3},
                {"hole": 16, "strokes": 4, "par": 4},
                {"hole": 17, "strokes": 5, "par": 5},
                {"hole": 18, "strokes": 4, "par": 4}
            ]
        }
        
        success, response = self.run_test(
            "Submit Round 1 Scorecard",
            "POST",
            "scorecards",
            200,
            data=scorecard_data,
            auth_token=self.player_token
        )
        if success:
            print(f"   Round 1 - Total strokes: {response.get('total_strokes')}")
            print(f"   Round 1 - To par: {response.get('total_to_par')}")
        return success

    def test_submit_round_2_scorecard(self):
        """Test submitting round 2 scorecard"""
        if not self.multi_round_tournament_id:
            print("❌ No multi-round tournament ID available")
            return False
            
        scorecard_data = {
            "tournament_id": self.multi_round_tournament_id,
            "round_number": 2,
            "holes": [
                {"hole": 1, "strokes": 3, "par": 4},
                {"hole": 2, "strokes": 3, "par": 3},
                {"hole": 3, "strokes": 5, "par": 5},
                {"hole": 4, "strokes": 4, "par": 4},
                {"hole": 5, "strokes": 5, "par": 4},
                {"hole": 6, "strokes": 3, "par": 3},
                {"hole": 7, "strokes": 4, "par": 4},
                {"hole": 8, "strokes": 4, "par": 5},
                {"hole": 9, "strokes": 4, "par": 4},
                {"hole": 10, "strokes": 4, "par": 4},
                {"hole": 11, "strokes": 2, "par": 3},
                {"hole": 12, "strokes": 5, "par": 5},
                {"hole": 13, "strokes": 4, "par": 4},
                {"hole": 14, "strokes": 4, "par": 4},
                {"hole": 15, "strokes": 3, "par": 3},
                {"hole": 16, "strokes": 4, "par": 4},
                {"hole": 17, "strokes": 5, "par": 5},
                {"hole": 18, "strokes": 4, "par": 4}
            ]
        }
        
        success, response = self.run_test(
            "Submit Round 2 Scorecard",
            "POST",
            "scorecards",
            200,
            data=scorecard_data,
            auth_token=self.player_token
        )
        if success:
            print(f"   Round 2 - Total strokes: {response.get('total_strokes')}")
            print(f"   Round 2 - To par: {response.get('total_to_par')}")
        return success

    def test_invalid_round_number(self):
        """Test submitting scorecard with invalid round number"""
        if not self.multi_round_tournament_id:
            print("❌ No multi-round tournament ID available")
            return False
            
        scorecard_data = {
            "tournament_id": self.multi_round_tournament_id,
            "round_number": 5,  # Invalid - tournament only has 4 rounds
            "holes": [{"hole": 1, "strokes": 4, "par": 4}]
        }
        
        success, response = self.run_test(
            "Submit Scorecard with Invalid Round Number (should fail)",
            "POST",
            "scorecards",
            400,  # Should return 400 Bad Request
            data=scorecard_data,
            auth_token=self.player_token
        )
        return success

    def test_get_tournament_scorecards(self):
        """Test getting all round scorecards for a tournament"""
        if not self.multi_round_tournament_id:
            print("❌ No multi-round tournament ID available")
            return False
            
        success, response = self.run_test(
            "Get Tournament Scorecards",
            "GET",
            f"scorecards/tournament/{self.multi_round_tournament_id}/my",
            200,
            auth_token=self.player_token
        )
        if success:
            print(f"   Found {len(response)} round scorecards")
            for sc in response:
                print(f"   Round {sc.get('round_number')}: {sc.get('total_strokes')} strokes, {sc.get('total_to_par')} to par")
        return success

    def test_multi_round_leaderboard(self):
        """Test leaderboard aggregation across multiple rounds"""
        if not self.multi_round_tournament_id:
            print("❌ No multi-round tournament ID available")
            return False
            
        success, response = self.run_test(
            "Get Multi-Round Leaderboard",
            "GET",
            f"leaderboard/{self.multi_round_tournament_id}",
            200
        )
        if success:
            leaderboard = response.get('leaderboard', [])
            print(f"   Leaderboard entries: {len(leaderboard)}")
            if leaderboard:
                for i, entry in enumerate(leaderboard[:3]):
                    rounds_info = entry.get('rounds', [])
                    print(f"   {i+1}. {entry.get('player_name')} - {entry.get('total_to_par')} to par ({len(rounds_info)} rounds)")
        return success

    # NEW FEATURE TESTS - Player Profiles
    def test_player_profile(self):
        """Test getting player profile with stats and history"""
        if not self.player_user_id:
            print("❌ No player user ID available")
            return False
            
        success, response = self.run_test(
            "Get Player Profile",
            "GET",
            f"players/{self.player_user_id}/profile",
            200
        )
        if success:
            player = response.get('player', {})
            stats = response.get('stats', {})
            history = response.get('history', [])
            print(f"   Player: {player.get('name')} ({player.get('role')})")
            print(f"   Total rounds: {stats.get('total_rounds')}")
            print(f"   Tournaments played: {stats.get('tournaments_played')}")
            print(f"   Avg to par: {stats.get('avg_to_par')}")
            print(f"   History entries: {len(history)}")
        return success

    def test_tournaments_with_participant_count(self):
        """Test that tournaments return participant_count"""
        success, response = self.run_test(
            "List Tournaments with Participant Count",
            "GET",
            "tournaments",
            200
        )
        if success:
            print(f"   Found {len(response)} tournaments")
            for t in response:
                participant_count = t.get('participant_count', 0)
                print(f"   {t.get('name')}: {participant_count} participants")
        return success

    def test_tournament_unregistration(self):
        """Test player unregistration from tournament"""
        if not self.tournament_id:
            print("❌ No tournament ID available for unregistration")
            return False
            
        success, response = self.run_test(
            "Unregister from Tournament",
            "DELETE",
            f"tournaments/{self.tournament_id}/unregister",
            200,
            auth_token=self.player_token
        )
        return success

    # NEW FEATURE TESTS - Live Scorer / Keeper
    def test_add_guest_player(self):
        """Test admin adding guest player to tournament"""
        if not self.tournament_id:
            print("❌ No tournament ID available for adding guest player")
            return False
            
        success, response = self.run_test(
            "Add Guest Player to Tournament",
            "POST",
            f"tournaments/{self.tournament_id}/add-player",
            200,
            data={"name": "Test Guest Player"},
            auth_token=self.admin_token
        )
        if success:
            self.guest_user_id = response.get('user_id')
            print(f"   Guest User ID: {self.guest_user_id}")
            print(f"   Guest Name: {response.get('name')}")
            print(f"   Registration ID: {response.get('registration_id')}")
        return success

    def test_add_guest_player_no_auth(self):
        """Test adding guest player without admin auth (should fail)"""
        if not self.tournament_id:
            print("❌ No tournament ID available")
            return False
            
        success, response = self.run_test(
            "Add Guest Player Without Admin Auth (should fail)",
            "POST",
            f"tournaments/{self.tournament_id}/add-player",
            401,  # Should return 401 Unauthorized
            data={"name": "Unauthorized Guest"},
            auth_token=self.player_token
        )
        return success

    def test_add_guest_player_empty_name(self):
        """Test adding guest player with empty name (should fail)"""
        if not self.tournament_id:
            print("❌ No tournament ID available")
            return False
            
        success, response = self.run_test(
            "Add Guest Player with Empty Name (should fail)",
            "POST",
            f"tournaments/{self.tournament_id}/add-player",
            400,  # Should return 400 Bad Request
            data={"name": ""},
            auth_token=self.admin_token
        )
        return success

    def test_get_tournament_roster(self):
        """Test getting tournament roster including guest players"""
        if not self.tournament_id:
            print("❌ No tournament ID available for roster")
            return False
            
        success, response = self.run_test(
            "Get Tournament Roster",
            "GET",
            f"tournaments/{self.tournament_id}/roster",
            200
        )
        if success:
            print(f"   Found {len(response)} players in roster")
            for player in response:
                auth_type = player.get('auth_type', 'unknown')
                print(f"   - {player.get('player_name')} ({auth_type})")
        return success

    def test_keeper_submit_scorecard(self):
        """Test admin submitting scorecard via keeper endpoint"""
        if not self.tournament_id or not hasattr(self, 'guest_user_id'):
            print("❌ No tournament ID or guest user ID available")
            return False
            
        scorecard_data = {
            "tournament_id": self.tournament_id,
            "user_id": self.guest_user_id,
            "round_number": 1,
            "holes": [
                {"hole": 1, "strokes": 4, "par": 4},
                {"hole": 2, "strokes": 3, "par": 3},
                {"hole": 3, "strokes": 6, "par": 5},
                {"hole": 4, "strokes": 5, "par": 4},
                {"hole": 5, "strokes": 4, "par": 4},
                {"hole": 6, "strokes": 2, "par": 3},
                {"hole": 7, "strokes": 4, "par": 4},
                {"hole": 8, "strokes": 5, "par": 5},
                {"hole": 9, "strokes": 4, "par": 4},
                {"hole": 10, "strokes": 4, "par": 4},
                {"hole": 11, "strokes": 3, "par": 3},
                {"hole": 12, "strokes": 5, "par": 5},
                {"hole": 13, "strokes": 4, "par": 4},
                {"hole": 14, "strokes": 4, "par": 4},
                {"hole": 15, "strokes": 3, "par": 3},
                {"hole": 16, "strokes": 4, "par": 4},
                {"hole": 17, "strokes": 5, "par": 5},
                {"hole": 18, "strokes": 4, "par": 4}
            ]
        }
        
        success, response = self.run_test(
            "Submit Scorecard via Keeper Endpoint",
            "POST",
            "scorecards/keeper",
            200,
            data=scorecard_data,
            auth_token=self.admin_token
        )
        if success:
            print(f"   Scorecard ID: {response.get('scorecard_id')}")
            print(f"   Player: {response.get('player_name')}")
            print(f"   Total strokes: {response.get('total_strokes')}")
            print(f"   To par: {response.get('total_to_par')}")
        return success

    def test_keeper_submit_non_admin(self):
        """Test keeper endpoint with non-admin user (should fail)"""
        if not self.tournament_id or not hasattr(self, 'guest_user_id'):
            print("❌ No tournament ID or guest user ID available")
            return False
            
        scorecard_data = {
            "tournament_id": self.tournament_id,
            "user_id": self.guest_user_id,
            "round_number": 1,
            "holes": [{"hole": 1, "strokes": 4, "par": 4}]
        }
        
        success, response = self.run_test(
            "Submit Scorecard via Keeper (Non-Admin, should fail)",
            "POST",
            "scorecards/keeper",
            403,  # Should return 403 Forbidden
            data=scorecard_data,
            auth_token=self.player_token
        )
        return success

    def test_get_all_tournament_scorecards(self):
        """Test admin getting all tournament scorecards"""
        if not self.tournament_id:
            print("❌ No tournament ID available")
            return False
            
        success, response = self.run_test(
            "Get All Tournament Scorecards (Admin)",
            "GET",
            f"scorecards/tournament/{self.tournament_id}/all",
            200,
            auth_token=self.admin_token
        )
        if success:
            print(f"   Found {len(response)} scorecards")
            for sc in response:
                print(f"   - {sc.get('player_name')}: Round {sc.get('round_number')}, {sc.get('total_strokes')} strokes")
        return success

    def test_get_all_tournament_scorecards_non_admin(self):
        """Test non-admin getting all tournament scorecards (should fail)"""
        if not self.tournament_id:
            print("❌ No tournament ID available")
            return False
            
        success, response = self.run_test(
            "Get All Tournament Scorecards (Non-Admin, should fail)",
            "GET",
            f"scorecards/tournament/{self.tournament_id}/all",
            403,  # Should return 403 Forbidden
            auth_token=self.player_token
        )
        return success

def main():
    print("🏌️ Starting Fairway Golf API Tests")
    print("=" * 50)
    
    tester = FairwayAPITester()
    
    # Test sequence
    tests = [
        # Admin setup and auth
        ("Admin Seed", tester.test_admin_seed),
        ("Admin Login", tester.test_admin_login),
        ("Admin Auth Check", lambda: tester.test_auth_me(tester.admin_token, "admin")),
        
        # Player auth
        ("Player Registration", tester.test_player_register),
        ("Player Auth Check", lambda: tester.test_auth_me(tester.player_token, "player")),
        
        # Tournament management
        ("Create Stroke Tournament", tester.test_create_stroke_tournament),
        ("Create Stableford Tournament", tester.test_create_stableford_tournament),
        ("Create Multi-Round Tournament", tester.test_create_multi_round_tournament),
        ("List Tournaments", tester.test_list_tournaments),
        ("Update Tournament Status", tester.test_update_tournament_status),
        
        # NEW FEATURE: Tournament Registration
        ("Tournament Registration", tester.test_tournament_registration),
        ("Get My Registrations", tester.test_get_my_registrations),
        ("Get Tournament Participants", tester.test_get_tournament_participants),
        ("Scorecard Without Registration", tester.test_scorecard_without_registration),
        
        # Scorecard and leaderboard (single round)
        ("Submit Scorecard", tester.test_submit_scorecard),
        ("Get Public Leaderboard", tester.test_get_leaderboard),
        ("Get My Scorecards", tester.test_get_my_scorecards),
        
        # NEW FEATURE: Multi-Round Support
        ("Multi-Round Registration and Setup", tester.test_multi_round_registration_and_scoring),
        ("Submit Round 1 Scorecard", tester.test_submit_round_1_scorecard),
        ("Submit Round 2 Scorecard", tester.test_submit_round_2_scorecard),
        ("Invalid Round Number", tester.test_invalid_round_number),
        ("Get Tournament Scorecards", tester.test_get_tournament_scorecards),
        ("Multi-Round Leaderboard", tester.test_multi_round_leaderboard),
        
        # NEW FEATURE: Player Profiles
        ("Player Profile", tester.test_player_profile),
        ("Tournaments with Participant Count", tester.test_tournaments_with_participant_count),
        
        # NEW FEATURE: Live Scorer / Keeper
        ("Add Guest Player", tester.test_add_guest_player),
        ("Add Guest Player No Auth", tester.test_add_guest_player_no_auth),
        ("Add Guest Player Empty Name", tester.test_add_guest_player_empty_name),
        ("Get Tournament Roster", tester.test_get_tournament_roster),
        ("Keeper Submit Scorecard", tester.test_keeper_submit_scorecard),
        ("Keeper Submit Non-Admin", tester.test_keeper_submit_non_admin),
        ("Get All Tournament Scorecards Admin", tester.test_get_all_tournament_scorecards),
        ("Get All Tournament Scorecards Non-Admin", tester.test_get_all_tournament_scorecards_non_admin),
        
        # Registration management
        ("Tournament Unregistration", tester.test_tournament_unregistration),
        
        # Logout tests
        ("Admin Logout", lambda: tester.test_logout(tester.admin_token, "admin")),
        ("Player Logout", lambda: tester.test_logout(tester.player_token, "player")),
    ]
    
    # Run all tests
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())