#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import time

class Nazca360APITester:
    def __init__(self, base_url="https://nazca360-vr.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session_token = None
        self.admin_token = None
        self.user_id = None
        self.admin_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_result(self, test_name, success, response_data=None, error_msg=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            self.failed_tests.append({
                "test": test_name,
                "error": error_msg,
                "response": response_data
            })
            print(f"❌ {test_name} - FAILED: {error_msg}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            if success:
                self.log_result(name, True, response_data)
                return True, response_data
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                self.log_result(name, False, response_data, error_msg)
                return False, response_data

        except Exception as e:
            error_msg = f"Request failed: {str(e)}"
            self.log_result(name, False, {}, error_msg)
            return False, {}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n" + "="*50)
        print("TESTING BASIC ENDPOINTS")
        print("="*50)
        
        self.run_test("API Root", "GET", "", 200)
        self.run_test("Health Check", "GET", "health", 200)

    def test_video_endpoints(self):
        """Test video-related endpoints"""
        print("\n" + "="*50)
        print("TESTING VIDEO ENDPOINTS")
        print("="*50)
        
        # Test public video access (no auth)
        self.run_test("Get All Videos (Public)", "GET", "videos", 200)
        self.run_test("Get Nasca Videos", "GET", "videos?category=nasca", 200)
        self.run_test("Get Palpa Videos", "GET", "videos?category=palpa", 200)
        self.run_test("Get Museum Videos", "GET", "videos?category=museum", 200)
        
        # Test with authentication (should show premium content)
        if self.session_token:
            headers = {'Authorization': f'Bearer {self.session_token}'}
            self.run_test("Get All Videos (Authenticated)", "GET", "videos", 200, headers=headers)

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n" + "="*50)
        print("TESTING AUTH ENDPOINTS")
        print("="*50)
        
        # Test auth login redirect
        success, response = self.run_test("Auth Login Redirect", "GET", "auth/login", 307)
        
        # Test auth/me without token (should fail)
        self.run_test("Get Current User (No Auth)", "GET", "auth/me", 401)
        
        # Test with valid token (if available)
        if self.session_token:
            headers = {'Authorization': f'Bearer {self.session_token}'}
            self.run_test("Get Current User (With Auth)", "GET", "auth/me", 200, headers=headers)

    def test_subscription_endpoints(self):
        """Test subscription endpoints"""
        print("\n" + "="*50)
        print("TESTING SUBSCRIPTION ENDPOINTS")
        print("="*50)
        
        if not self.session_token:
            print("⚠️  Skipping subscription tests - no auth token")
            return
            
        headers = {'Authorization': f'Bearer {self.session_token}'}
        
        # Test get my subscription
        self.run_test("Get My Subscription", "GET", "subscriptions/me", 200, headers=headers)
        
        # Test create checkout (should work but we won't complete payment)
        checkout_data = {
            "plan_type": "premium",
            "origin_url": "https://nazca360-vr.preview.emergentagent.com"
        }
        self.run_test("Create Subscription Checkout", "POST", "subscriptions/checkout", 200, 
                     data=checkout_data, headers=headers)

    def test_reservation_endpoints(self):
        """Test reservation endpoints"""
        print("\n" + "="*50)
        print("TESTING RESERVATION ENDPOINTS")
        print("="*50)
        
        # Test get available slots (public endpoint)
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        self.run_test("Get Available Slots", "GET", f"reservations/available?date={tomorrow}", 200)
        
        if not self.session_token:
            print("⚠️  Skipping authenticated reservation tests - no auth token")
            return
            
        headers = {'Authorization': f'Bearer {self.session_token}'}
        
        # Test get my reservations
        self.run_test("Get My Reservations", "GET", "reservations/me", 200, headers=headers)
        
        # Test create reservation
        reservation_data = {
            "reservation_date": tomorrow,
            "time_slot": "10:00-11:00"
        }
        success, response = self.run_test("Create Reservation", "POST", "reservations", 201, 
                                        data=reservation_data, headers=headers)
        
        # If reservation was created, test cancellation
        if success and 'id' in response:
            reservation_id = response['id']
            self.run_test("Cancel Reservation", "PUT", f"reservations/{reservation_id}?status=cancelled", 200, 
                         headers=headers)

    def test_admin_endpoints(self):
        """Test admin endpoints"""
        print("\n" + "="*50)
        print("TESTING ADMIN ENDPOINTS")
        print("="*50)
        
        if not self.admin_token:
            print("⚠️  Skipping admin tests - no admin token")
            return
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Test admin endpoints
        self.run_test("Get All Users (Admin)", "GET", "admin/users", 200, headers=headers)
        self.run_test("Get All Subscriptions (Admin)", "GET", "admin/subscriptions", 200, headers=headers)
        self.run_test("Get All Reservations (Admin)", "GET", "admin/reservations", 200, headers=headers)
        self.run_test("Get Admin Metrics", "GET", "admin/metrics", 200, headers=headers)

    def create_test_user_and_session(self):
        """Create test user and session in MongoDB"""
        print("\n" + "="*50)
        print("CREATING TEST USER AND SESSION")
        print("="*50)
        
        try:
            import subprocess
            
            # Create regular user
            timestamp = int(time.time())
            user_id = f"test-user-{timestamp}"
            session_token = f"test_session_{timestamp}"
            
            mongo_script = f"""
            use('test_database');
            var userId = '{user_id}';
            var sessionToken = '{session_token}';
            db.users.insertOne({{
              id: userId,
              email: 'test.user.{timestamp}@example.com',
              name: 'Test User',
              picture: 'https://via.placeholder.com/150',
              role: 'user',
              subscription_plan: 'basic',
              created_at: new Date().toISOString()
            }});
            db.user_sessions.insertOne({{
              user_id: userId,
              session_token: sessionToken,
              expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
              created_at: new Date().toISOString()
            }});
            print('User created: ' + userId);
            print('Session token: ' + sessionToken);
            """
            
            result = subprocess.run(['mongosh', '--eval', mongo_script], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                self.user_id = user_id
                self.session_token = session_token
                print(f"✅ Test user created: {user_id}")
                print(f"✅ Session token: {session_token}")
                
                # Create admin user
                admin_id = f"admin-user-{timestamp}"
                admin_token = f"admin_session_{timestamp}"
                
                admin_script = f"""
                use('test_database');
                var adminId = '{admin_id}';
                var adminToken = '{admin_token}';
                db.users.insertOne({{
                  id: adminId,
                  email: 'admin.user.{timestamp}@example.com',
                  name: 'Admin User',
                  picture: 'https://via.placeholder.com/150',
                  role: 'admin',
                  subscription_plan: 'premium',
                  created_at: new Date().toISOString()
                }});
                db.user_sessions.insertOne({{
                  user_id: adminId,
                  session_token: adminToken,
                  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
                  created_at: new Date().toISOString()
                }});
                print('Admin created: ' + adminId);
                print('Admin token: ' + adminToken);
                """
                
                admin_result = subprocess.run(['mongosh', '--eval', admin_script], 
                                            capture_output=True, text=True, timeout=30)
                
                if admin_result.returncode == 0:
                    self.admin_id = admin_id
                    self.admin_token = admin_token
                    print(f"✅ Admin user created: {admin_id}")
                    print(f"✅ Admin token: {admin_token}")
                else:
                    print(f"⚠️  Failed to create admin user: {admin_result.stderr}")
                    
            else:
                print(f"❌ Failed to create test user: {result.stderr}")
                
        except Exception as e:
            print(f"❌ Error creating test user: {str(e)}")

    def cleanup_test_data(self):
        """Clean up test data from MongoDB"""
        print("\n" + "="*50)
        print("CLEANING UP TEST DATA")
        print("="*50)
        
        try:
            import subprocess
            
            cleanup_script = f"""
            use('test_database');
            db.users.deleteMany({{id: /^test-user-/}});
            db.users.deleteMany({{id: /^admin-user-/}});
            db.user_sessions.deleteMany({{session_token: /^test_session_/}});
            db.user_sessions.deleteMany({{session_token: /^admin_session_/}});
            db.reservations.deleteMany({{user_id: /^test-user-/}});
            db.reservations.deleteMany({{user_id: /^admin-user-/}});
            print('Test data cleaned up');
            """
            
            result = subprocess.run(['mongosh', '--eval', cleanup_script], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print("✅ Test data cleaned up successfully")
            else:
                print(f"⚠️  Cleanup warning: {result.stderr}")
                
        except Exception as e:
            print(f"⚠️  Cleanup error: {str(e)}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Nazca360 API Testing")
        print("="*60)
        
        # Create test users first
        self.create_test_user_and_session()
        
        # Run all test suites
        self.test_health_endpoints()
        self.test_video_endpoints()
        self.test_auth_endpoints()
        self.test_subscription_endpoints()
        self.test_reservation_endpoints()
        self.test_admin_endpoints()
        
        # Print final results
        print("\n" + "="*60)
        print("FINAL TEST RESULTS")
        print("="*60)
        print(f"📊 Tests run: {self.tests_run}")
        print(f"✅ Tests passed: {self.tests_passed}")
        print(f"❌ Tests failed: {len(self.failed_tests)}")
        
        if self.failed_tests:
            print("\n🔍 FAILED TESTS DETAILS:")
            for i, failure in enumerate(self.failed_tests, 1):
                print(f"\n{i}. {failure['test']}")
                print(f"   Error: {failure['error']}")
                if failure['response']:
                    print(f"   Response: {json.dumps(failure['response'], indent=2)[:200]}...")
        
        # Cleanup
        self.cleanup_test_data()
        
        # Return success/failure
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        return len(self.failed_tests) == 0

def main():
    tester = Nazca360APITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())