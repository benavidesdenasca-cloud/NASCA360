"""
Backend API tests for KMZ Layer functionality
Tests: GET /api/kmz/layers, GET /api/kmz/layers/{id}, GET /api/kmz/layers/{id}/geojson
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "benavidesdenasca@gmail.com"
TEST_PASSWORD = "Benavides02@"

# Known KMZ layer ID from the database
KNOWN_KMZ_LAYER_ID = "188aac99-e615-4f7c-a342-600cd55e0011"


class TestKMZLayersAPI:
    """Test KMZ Layers API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self):
        """Get authentication token for admin user"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_get_kmz_layers_list(self):
        """Test GET /api/kmz/layers - should return list of active KMZ layers"""
        response = self.session.get(f"{BASE_URL}/api/kmz/layers")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 1, "Should have at least 1 KMZ layer"
        
        # Verify layer structure
        layer = data[0]
        assert "id" in layer, "Layer should have 'id' field"
        assert "name" in layer, "Layer should have 'name' field"
        assert "feature_count" in layer, "Layer should have 'feature_count' field"
        assert "is_active" in layer, "Layer should have 'is_active' field"
        assert "bounds" in layer, "Layer should have 'bounds' field"
        
        # Verify known layer exists
        layer_ids = [l["id"] for l in data]
        assert KNOWN_KMZ_LAYER_ID in layer_ids, f"Known layer {KNOWN_KMZ_LAYER_ID} should be in the list"
        
        print(f"✓ GET /api/kmz/layers returned {len(data)} layers")
    
    def test_get_kmz_layer_by_id(self):
        """Test GET /api/kmz/layers/{id} - should return single layer with features"""
        response = self.session.get(f"{BASE_URL}/api/kmz/layers/{KNOWN_KMZ_LAYER_ID}")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert data["id"] == KNOWN_KMZ_LAYER_ID, "Layer ID should match"
        assert data["name"] == "nazca_kmz", "Layer name should be 'nazca_kmz'"
        assert "features" in data, "Layer should have 'features' field"
        assert isinstance(data["features"], list), "Features should be a list"
        assert len(data["features"]) > 0, "Layer should have features"
        
        # Verify feature structure
        feature = data["features"][0]
        assert "type" in feature, "Feature should have 'type' field"
        assert feature["type"] == "Feature", "Feature type should be 'Feature'"
        assert "geometry" in feature, "Feature should have 'geometry' field"
        assert "coordinates" in feature["geometry"], "Geometry should have 'coordinates'"
        
        print(f"✓ GET /api/kmz/layers/{KNOWN_KMZ_LAYER_ID} returned layer with {len(data['features'])} features")
    
    def test_get_kmz_layer_geojson(self):
        """Test GET /api/kmz/layers/{id}/geojson - should return GeoJSON FeatureCollection"""
        response = self.session.get(f"{BASE_URL}/api/kmz/layers/{KNOWN_KMZ_LAYER_ID}/geojson")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert data["type"] == "FeatureCollection", "Response should be a FeatureCollection"
        assert "features" in data, "Should have 'features' field"
        assert isinstance(data["features"], list), "Features should be a list"
        assert len(data["features"]) > 0, "Should have features"
        
        # Verify GeoJSON structure
        feature = data["features"][0]
        assert feature["type"] == "Feature", "Feature type should be 'Feature'"
        assert "geometry" in feature, "Feature should have geometry"
        assert feature["geometry"]["type"] in ["LineString", "Polygon"], "Geometry type should be LineString or Polygon"
        
        print(f"✓ GET /api/kmz/layers/{KNOWN_KMZ_LAYER_ID}/geojson returned FeatureCollection with {len(data['features'])} features")
    
    def test_get_nonexistent_layer(self):
        """Test GET /api/kmz/layers/{id} with invalid ID - should return 404"""
        response = self.session.get(f"{BASE_URL}/api/kmz/layers/nonexistent-id-12345")
        
        # Status code assertion
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✓ GET /api/kmz/layers/nonexistent-id returns 404")
    
    def test_kmz_layer_bounds(self):
        """Test that KMZ layer has valid bounds"""
        response = self.session.get(f"{BASE_URL}/api/kmz/layers")
        assert response.status_code == 200
        
        data = response.json()
        layer = next((l for l in data if l["id"] == KNOWN_KMZ_LAYER_ID), None)
        assert layer is not None, "Known layer should exist"
        
        bounds = layer["bounds"]
        assert "north" in bounds, "Bounds should have 'north'"
        assert "south" in bounds, "Bounds should have 'south'"
        assert "east" in bounds, "Bounds should have 'east'"
        assert "west" in bounds, "Bounds should have 'west'"
        
        # Verify bounds are in Nazca area (Peru)
        assert -16 < bounds["south"] < -14, f"South bound should be in Nazca area, got {bounds['south']}"
        assert -16 < bounds["north"] < -14, f"North bound should be in Nazca area, got {bounds['north']}"
        assert -76 < bounds["west"] < -74, f"West bound should be in Nazca area, got {bounds['west']}"
        assert -76 < bounds["east"] < -74, f"East bound should be in Nazca area, got {bounds['east']}"
        
        print(f"✓ KMZ layer bounds are valid: N={bounds['north']:.2f}, S={bounds['south']:.2f}, E={bounds['east']:.2f}, W={bounds['west']:.2f}")
    
    def test_kmz_layer_feature_count(self):
        """Test that feature_count matches actual features"""
        # Get layer metadata
        list_response = self.session.get(f"{BASE_URL}/api/kmz/layers")
        assert list_response.status_code == 200
        
        layer_meta = next((l for l in list_response.json() if l["id"] == KNOWN_KMZ_LAYER_ID), None)
        assert layer_meta is not None
        
        # Get full layer with features
        detail_response = self.session.get(f"{BASE_URL}/api/kmz/layers/{KNOWN_KMZ_LAYER_ID}")
        assert detail_response.status_code == 200
        
        layer_detail = detail_response.json()
        
        # Verify feature count matches
        assert layer_meta["feature_count"] == len(layer_detail["features"]), \
            f"Feature count mismatch: metadata says {layer_meta['feature_count']}, actual is {len(layer_detail['features'])}"
        
        print(f"✓ Feature count matches: {layer_meta['feature_count']} features")


class TestKMZLayersAuthenticated:
    """Test KMZ Layers API endpoints that require authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.authenticated = True
        else:
            self.authenticated = False
    
    def test_get_all_kmz_layers_admin(self):
        """Test GET /api/kmz/layers/all - admin only endpoint"""
        if not self.authenticated:
            pytest.skip("Authentication failed")
        
        response = self.session.get(f"{BASE_URL}/api/kmz/layers/all")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ GET /api/kmz/layers/all returned {len(data)} layers (including inactive)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
