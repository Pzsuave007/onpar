import requests
import sys
import json
from datetime import datetime

class FairwayAPITester:
    def __init__(self, base_url="https://golfer-leaderboard-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.player_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tournament_id = None
        self.scorecard_id = None

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
        ("List Tournaments", tester.test_list_tournaments),
        ("Update Tournament Status", tester.test_update_tournament_status),
        
        # Scorecard and leaderboard
        ("Submit Scorecard", tester.test_submit_scorecard),
        ("Get Public Leaderboard", tester.test_get_leaderboard),
        ("Get My Scorecards", tester.test_get_my_scorecards),
        
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