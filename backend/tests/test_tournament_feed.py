"""
Tournament Feed API Tests
Tests for the Live Feed feature where participants and admins can upload photos.
Endpoints tested:
- POST /api/tournaments/{tournament_id}/feed - Upload photo with optional caption
- GET /api/tournaments/{tournament_id}/feed - Get feed photos sorted by newest first
- GET /api/feed/photo/{photo_id} - Get actual image binary
"""

import pytest
import requests
import os
import io
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@fairway.com",
        "password": "FairwayAdmin123!"
    })
    if response.status_code != 200:
        pytest.skip("Admin login failed - skipping authenticated tests")
    return response.json().get("token")

@pytest.fixture(scope="module")
def admin_user(admin_token):
    """Get admin user info"""
    response = requests.get(f"{BASE_URL}/api/auth/me", 
        headers={"Authorization": f"Bearer {admin_token}"})
    return response.json()

@pytest.fixture(scope="module")
def active_tournament(admin_token):
    """Get or create an active tournament for testing"""
    # First check for existing active tournaments
    response = requests.get(f"{BASE_URL}/api/tournaments",
        headers={"Authorization": f"Bearer {admin_token}"})
    tournaments = response.json()
    active = [t for t in tournaments if t.get('status') == 'active']
    
    if active:
        return active[0]
    
    # Create a new active tournament
    create_response = requests.post(f"{BASE_URL}/api/tournaments",
        headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
        json={
            "name": "TEST_Feed_Tournament",
            "course_name": "Test Golf Course",
            "start_date": "2026-01-01",
            "end_date": "2026-01-15",
            "scoring_format": "stroke",
            "num_holes": 18,
            "num_rounds": 1,
            "par_per_hole": [4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4],
            "max_players": 50,
            "visibility": "private"
        })
    tournament = create_response.json()
    
    # Set to active
    requests.put(f"{BASE_URL}/api/tournaments/{tournament['tournament_id']}",
        headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
        json={"status": "active"})
    
    return tournament

@pytest.fixture(scope="module")
def test_player():
    """Create a test player for non-admin tests"""
    import uuid
    email = f"test_player_{uuid.uuid4().hex[:8]}@test.com"
    response = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": "TestPass123!",
        "name": "Test Player"
    })
    if response.status_code != 200:
        pytest.skip("Could not create test player")
    return response.json()

@pytest.fixture
def test_image():
    """Create a test JPEG image"""
    img = Image.new('RGB', (100, 100), color='green')
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    buf.seek(0)
    return buf

class TestFeedUpload:
    """Tests for POST /api/tournaments/{tournament_id}/feed"""
    
    def test_admin_can_upload_photo(self, admin_token, active_tournament, test_image):
        """Admin should be able to upload a photo to the feed"""
        tournament_id = active_tournament['tournament_id']
        
        files = {'file': ('test_photo.jpg', test_image, 'image/jpeg')}
        data = {'caption': 'Test caption from admin'}
        
        response = requests.post(
            f"{BASE_URL}/api/tournaments/{tournament_id}/feed",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data=data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert 'photo_id' in result
        assert result['tournament_id'] == tournament_id
        assert result['caption'] == 'Test caption from admin'
        assert 'storage_path' in result
        assert 'created_at' in result
        print(f"✓ Admin uploaded photo: {result['photo_id']}")
    
    def test_admin_can_upload_photo_without_caption(self, admin_token, active_tournament, test_image):
        """Admin should be able to upload a photo without caption"""
        tournament_id = active_tournament['tournament_id']
        
        files = {'file': ('test_photo.jpg', test_image, 'image/jpeg')}
        
        response = requests.post(
            f"{BASE_URL}/api/tournaments/{tournament_id}/feed",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result['caption'] == ''
        print(f"✓ Admin uploaded photo without caption: {result['photo_id']}")
    
    def test_non_participant_cannot_upload(self, test_player, active_tournament, test_image):
        """Non-participant should get 403 when trying to upload"""
        tournament_id = active_tournament['tournament_id']
        token = test_player['token']
        
        files = {'file': ('test_photo.jpg', test_image, 'image/jpeg')}
        
        response = requests.post(
            f"{BASE_URL}/api/tournaments/{tournament_id}/feed",
            headers={"Authorization": f"Bearer {token}"},
            files=files
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Non-participant correctly rejected with 403")
    
    def test_participant_can_upload(self, admin_token, test_player, active_tournament, test_image):
        """Registered participant should be able to upload"""
        tournament_id = active_tournament['tournament_id']
        token = test_player['token']
        
        # First register the player for the tournament
        requests.post(
            f"{BASE_URL}/api/tournaments/{tournament_id}/register",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Now try to upload
        files = {'file': ('test_photo.jpg', test_image, 'image/jpeg')}
        data = {'caption': 'Photo from participant'}
        
        response = requests.post(
            f"{BASE_URL}/api/tournaments/{tournament_id}/feed",
            headers={"Authorization": f"Bearer {token}"},
            files=files,
            data=data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        result = response.json()
        assert result['player_name'] == 'Test Player'
        print(f"✓ Participant uploaded photo: {result['photo_id']}")
    
    def test_upload_to_nonexistent_tournament(self, admin_token, test_image):
        """Upload to non-existent tournament should return 404"""
        files = {'file': ('test_photo.jpg', test_image, 'image/jpeg')}
        
        response = requests.post(
            f"{BASE_URL}/api/tournaments/nonexistent_id/feed",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        
        assert response.status_code == 404
        print("✓ Non-existent tournament correctly returns 404")
    
    def test_unauthenticated_cannot_upload(self, active_tournament, test_image):
        """Unauthenticated user should get 401"""
        tournament_id = active_tournament['tournament_id']
        
        files = {'file': ('test_photo.jpg', test_image, 'image/jpeg')}
        
        response = requests.post(
            f"{BASE_URL}/api/tournaments/{tournament_id}/feed",
            files=files
        )
        
        assert response.status_code == 401
        print("✓ Unauthenticated user correctly rejected with 401")


class TestFeedRetrieval:
    """Tests for GET /api/tournaments/{tournament_id}/feed"""
    
    def test_get_feed_returns_photos_sorted_newest_first(self, admin_token, active_tournament):
        """Feed should return photos sorted by newest first"""
        tournament_id = active_tournament['tournament_id']
        
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{tournament_id}/feed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        photos = response.json()
        assert isinstance(photos, list)
        
        # Check sorting (newest first = descending created_at)
        if len(photos) >= 2:
            for i in range(len(photos) - 1):
                assert photos[i]['created_at'] >= photos[i+1]['created_at'], \
                    "Photos should be sorted newest first"
        
        print(f"✓ Feed returned {len(photos)} photos sorted correctly")
    
    def test_feed_photo_has_required_fields(self, admin_token, active_tournament):
        """Each photo should have required fields"""
        tournament_id = active_tournament['tournament_id']
        
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{tournament_id}/feed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        photos = response.json()
        
        if photos:
            photo = photos[0]
            required_fields = ['photo_id', 'tournament_id', 'user_id', 'player_name', 
                             'caption', 'storage_path', 'created_at']
            for field in required_fields:
                assert field in photo, f"Missing field: {field}"
        
        print("✓ Feed photos have all required fields")
    
    def test_private_tournament_feed_requires_auth(self, active_tournament):
        """Private tournament feed should require authentication"""
        tournament_id = active_tournament['tournament_id']
        
        response = requests.get(f"{BASE_URL}/api/tournaments/{tournament_id}/feed")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Private tournament feed correctly requires auth")
    
    def test_private_tournament_feed_requires_participant(self, test_player, active_tournament):
        """Private tournament feed should require participant status"""
        # Create a new player who is NOT registered
        import uuid
        email = f"outsider_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass123!",
            "name": "Outsider Player"
        })
        
        if reg_response.status_code != 200:
            pytest.skip("Could not create outsider player")
        
        outsider_token = reg_response.json()['token']
        tournament_id = active_tournament['tournament_id']
        
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{tournament_id}/feed",
            headers={"Authorization": f"Bearer {outsider_token}"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Non-participant correctly rejected from private feed")


class TestPhotoServing:
    """Tests for GET /api/feed/photo/{photo_id}"""
    
    def test_get_photo_returns_image_binary(self, admin_token, active_tournament, test_image):
        """Photo endpoint should return actual image binary"""
        tournament_id = active_tournament['tournament_id']
        
        # First upload a photo
        files = {'file': ('test_photo.jpg', test_image, 'image/jpeg')}
        upload_response = requests.post(
            f"{BASE_URL}/api/tournaments/{tournament_id}/feed",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        
        assert upload_response.status_code == 200
        photo_id = upload_response.json()['photo_id']
        
        # Now retrieve the photo
        response = requests.get(f"{BASE_URL}/api/feed/photo/{photo_id}")
        
        assert response.status_code == 200
        assert 'image' in response.headers.get('Content-Type', '')
        assert len(response.content) > 0
        print(f"✓ Photo {photo_id} served correctly ({len(response.content)} bytes)")
    
    def test_get_nonexistent_photo_returns_404(self):
        """Non-existent photo should return 404"""
        response = requests.get(f"{BASE_URL}/api/feed/photo/nonexistent_photo_id")
        
        assert response.status_code == 404
        print("✓ Non-existent photo correctly returns 404")
    
    def test_photo_endpoint_is_public(self, admin_token, active_tournament, test_image):
        """Photo endpoint should be public (no auth required) for img tags"""
        tournament_id = active_tournament['tournament_id']
        
        # Upload a photo
        files = {'file': ('test_photo.jpg', test_image, 'image/jpeg')}
        upload_response = requests.post(
            f"{BASE_URL}/api/tournaments/{tournament_id}/feed",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        
        photo_id = upload_response.json()['photo_id']
        
        # Access without auth
        response = requests.get(f"{BASE_URL}/api/feed/photo/{photo_id}")
        
        assert response.status_code == 200, "Photo endpoint should be public"
        print("✓ Photo endpoint is publicly accessible (for img tags)")


class TestPublicTournamentFeed:
    """Tests for public tournament feed access"""
    
    def test_public_tournament_feed_accessible_without_auth(self, admin_token):
        """Public tournament feed should be accessible without authentication"""
        # Create a public tournament
        create_response = requests.post(
            f"{BASE_URL}/api/tournaments",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json={
                "name": "TEST_Public_Feed_Tournament",
                "course_name": "Public Course",
                "start_date": "2026-01-01",
                "end_date": "2026-01-15",
                "scoring_format": "stroke",
                "num_holes": 18,
                "num_rounds": 1,
                "par_per_hole": [4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5,4],
                "max_players": 50,
                "visibility": "public"
            }
        )
        
        tournament = create_response.json()
        tournament_id = tournament['tournament_id']
        
        # Set to active
        requests.put(
            f"{BASE_URL}/api/tournaments/{tournament_id}",
            headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
            json={"status": "active"}
        )
        
        # Access feed without auth
        response = requests.get(f"{BASE_URL}/api/tournaments/{tournament_id}/feed")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Public tournament feed accessible without auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
