"""
Test suite for verifying KMZ functionality removal and existing features still work.
Tests:
1. Backend health check
2. Admin login
3. POI CRUD operations
4. KMZ endpoints return 404 (removed)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "benavidesdenasca@gmail.com"
ADMIN_PASSWORD = "Benavides02@"


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ Health check passed: {data}")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['email']}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "invalid@example.com",
                "password": "wrongpassword"
            }
        )
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected with 401")


class TestKMZRemoval:
    """Tests to verify KMZ endpoints are removed (return 404)"""
    
    def test_kmz_layers_endpoint_removed(self):
        """Test GET /api/kmz/layers returns 404"""
        response = requests.get(f"{BASE_URL}/api/kmz/layers")
        assert response.status_code == 404
        print("✓ GET /api/kmz/layers correctly returns 404 (removed)")
    
    def test_kmz_layer_by_id_removed(self):
        """Test GET /api/kmz/layers/{id} returns 404"""
        response = requests.get(f"{BASE_URL}/api/kmz/layers/some-id")
        assert response.status_code == 404
        print("✓ GET /api/kmz/layers/{id} correctly returns 404 (removed)")
    
    def test_kmz_geojson_endpoint_removed(self):
        """Test GET /api/kmz/layers/{id}/geojson returns 404"""
        response = requests.get(f"{BASE_URL}/api/kmz/layers/some-id/geojson")
        assert response.status_code == 404
        print("✓ GET /api/kmz/layers/{id}/geojson correctly returns 404 (removed)")
    
    def test_kmz_upload_endpoint_removed(self):
        """Test POST /api/kmz/upload returns 404"""
        # Get admin token first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        token = login_response.json().get("access_token", "")
        
        response = requests.post(
            f"{BASE_URL}/api/kmz/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.kmz", b"test content", "application/vnd.google-earth.kmz")}
        )
        assert response.status_code == 404
        print("✓ POST /api/kmz/upload correctly returns 404 (removed)")


class TestPOIEndpoints:
    """Tests for POI (Points of Interest) endpoints - should still work"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_pois(self, auth_token):
        """Test GET /api/pois returns list of POIs"""
        response = requests.get(
            f"{BASE_URL}/api/pois",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/pois returned {len(data)} POIs")
        return data
    
    def test_poi_structure(self, auth_token):
        """Test POI data structure is correct"""
        response = requests.get(
            f"{BASE_URL}/api/pois",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            poi = data[0]
            # Check required fields
            assert "id" in poi
            assert "name" in poi
            assert "description" in poi
            assert "longitude" in poi
            assert "latitude" in poi
            assert "category" in poi
            print(f"✓ POI structure is correct: {poi['name']}")
        else:
            print("⚠ No POIs found to verify structure")


class TestOtherEndpoints:
    """Tests for other endpoints that should still work"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_auth_me_endpoint(self, auth_token):
        """Test GET /api/auth/me returns current user"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert data["email"] == ADMIN_EMAIL
        print(f"✓ GET /api/auth/me returned user: {data['email']}")
    
    def test_videos_endpoint(self, auth_token):
        """Test GET /api/videos returns list of videos"""
        response = requests.get(
            f"{BASE_URL}/api/videos",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/videos returned {len(data)} videos")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
