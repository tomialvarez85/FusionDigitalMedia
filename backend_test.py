#!/usr/bin/env python3
"""
Lux Studio Backend API Testing
Tests all authentication and CRUD endpoints
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class LuxStudioAPITester:
    def __init__(self, base_url: str = "https://studio-portal-16.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test credentials from /app/memory/test_credentials.md
        self.admin_email = "admin@luxstudio.com"
        self.admin_password = "Admin123!"
        
        # Test data
        self.test_event_id = None
        self.test_photo_id = None

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "response_data": response_data
        })

    def test_api_endpoint(self, method: str, endpoint: str, expected_status: int, 
                         data: Optional[Dict] = None, description: str = "") -> tuple[bool, Any]:
        """Test a single API endpoint"""
        url = f"{self.base_url}/api/{endpoint}"
        
        try:
            if method == 'GET':
                response = self.session.get(url)
            elif method == 'POST':
                response = self.session.post(url, json=data)
            elif method == 'PUT':
                response = self.session.put(url, json=data)
            elif method == 'DELETE':
                response = self.session.delete(url)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            response_data = None
            
            try:
                response_data = response.json()
            except:
                response_data = response.text

            details = f"Status: {response.status_code}, Expected: {expected_status}"
            if not success and response_data:
                details += f", Response: {response_data}"

            self.log_test(f"{method} {endpoint} - {description}", success, details, response_data)
            return success, response_data

        except Exception as e:
            self.log_test(f"{method} {endpoint} - {description}", False, f"Exception: {str(e)}")
            return False, None

    def test_auth_flow(self):
        """Test complete authentication flow"""
        print("\n🔐 Testing Authentication Flow...")
        
        # Test login
        login_data = {
            "email": self.admin_email,
            "password": self.admin_password
        }
        
        success, user_data = self.test_api_endpoint(
            'POST', 'auth/login', 200, login_data, 
            "Admin login with correct credentials"
        )
        
        if not success:
            print("❌ Login failed - cannot continue with authenticated tests")
            return False
        
        # Verify user data structure
        if user_data and isinstance(user_data, dict):
            required_fields = ['admin_id', 'email', 'name']
            missing_fields = [field for field in required_fields if field not in user_data]
            if missing_fields:
                self.log_test("Login response structure", False, f"Missing fields: {missing_fields}")
            else:
                self.log_test("Login response structure", True, "All required fields present")
        
        # Test /auth/me endpoint
        self.test_api_endpoint('GET', 'auth/me', 200, description="Get current user")
        
        # Test invalid login
        invalid_login = {
            "email": self.admin_email,
            "password": "wrongpassword"
        }
        self.test_api_endpoint(
            'POST', 'auth/login', 401, invalid_login,
            "Login with invalid password"
        )
        
        return True

    def test_dashboard_stats(self):
        """Test dashboard statistics endpoint"""
        print("\n📊 Testing Dashboard Stats...")
        
        success, stats_data = self.test_api_endpoint(
            'GET', 'dashboard/stats', 200, 
            description="Get dashboard statistics"
        )
        
        if success and stats_data:
            required_fields = ['total_events', 'total_photos']
            missing_fields = [field for field in required_fields if field not in stats_data]
            if missing_fields:
                self.log_test("Stats response structure", False, f"Missing fields: {missing_fields}")
            else:
                self.log_test("Stats response structure", True, "All required fields present")
                print(f"   📈 Total Events: {stats_data.get('total_events', 0)}")
                print(f"   📸 Total Photos: {stats_data.get('total_photos', 0)}")

    def test_event_crud(self):
        """Test event CRUD operations"""
        print("\n📅 Testing Event CRUD Operations...")
        
        # Create event
        event_data = {
            "name": f"Test Event {datetime.now().strftime('%H%M%S')}",
            "date": "2024-12-25",
            "description": "Test event for API testing",
            "photographer_name": "Test Photographer",
            "is_published": True
        }
        
        success, created_event = self.test_api_endpoint(
            'POST', 'events', 201, event_data,
            "Create new event"
        )
        
        if success and created_event:
            self.test_event_id = created_event.get('event_id')
            print(f"   📝 Created event ID: {self.test_event_id}")
            
            # Test get all events
            self.test_api_endpoint('GET', 'events', 200, description="Get all events")
            
            # Test get specific event
            if self.test_event_id:
                self.test_api_endpoint(
                    'GET', f'events/{self.test_event_id}', 200,
                    description="Get specific event"
                )
                
                # Test update event
                update_data = {
                    "name": f"Updated Test Event {datetime.now().strftime('%H%M%S')}",
                    "description": "Updated description"
                }
                self.test_api_endpoint(
                    'PUT', f'events/{self.test_event_id}', 200, update_data,
                    "Update event"
                )
        
        # Test get non-existent event
        self.test_api_endpoint(
            'GET', 'events/nonexistent', 404,
            description="Get non-existent event"
        )

    def test_photo_operations(self):
        """Test photo-related operations"""
        print("\n📸 Testing Photo Operations...")
        
        if not self.test_event_id:
            print("⚠️  Skipping photo tests - no test event available")
            return
        
        # Test get event photos (should be empty initially)
        self.test_api_endpoint(
            'GET', f'events/{self.test_event_id}/photos', 200,
            description="Get event photos (empty)"
        )
        
        # Test cloudinary signature generation (requires event_id parameter)
        signature_data = None
        if self.test_event_id:
            success, signature_data = self.test_api_endpoint(
                'GET', f'cloudinary/signature?event_id={self.test_event_id}', 200,
                description="Get Cloudinary upload signature with event_id"
            )
            
            # Validate signature response structure
            if success and signature_data:
                required_fields = ['signature', 'timestamp', 'cloud_name', 'api_key', 'folder']
                missing_fields = [field for field in required_fields if field not in signature_data]
                if missing_fields:
                    self.log_test("Cloudinary signature structure", False, f"Missing fields: {missing_fields}")
                else:
                    self.log_test("Cloudinary signature structure", True, "All required fields present")
                    print(f"   🔑 Cloud name: {signature_data.get('cloud_name')}")
                    print(f"   📁 Folder path: {signature_data.get('folder')}")
                    
                    # Verify folder path format
                    expected_folder = f"lux-studio/events/{self.test_event_id}"
                    actual_folder = signature_data.get('folder')
                    if actual_folder == expected_folder:
                        self.log_test("Cloudinary folder path format", True, f"Correct folder: {actual_folder}")
                    else:
                        self.log_test("Cloudinary folder path format", False, f"Expected: {expected_folder}, Got: {actual_folder}")
        
        # Test creating a photo
        photo_data = {
            "event_id": self.test_event_id,
            "storage_key": "test-photo-key",
            "original_filename": "test.jpg",
            "width": 800,
            "height": 600,
            "file_size": 1024
        }
        
        success, created_photo = self.test_api_endpoint(
            'POST', 'photos', 201, photo_data,
            "Create photo with storage_key"
        )
        
        if success and created_photo:
            self.test_photo_id = created_photo.get('photo_id')
            print(f"   📸 Created photo ID: {self.test_photo_id}")
            
            # Test photo proxy endpoint
            if self.test_photo_id:
                # Note: This will likely fail since we're using a fake storage_key
                # but we want to test the endpoint structure
                proxy_success, proxy_response = self.test_api_endpoint(
                    'GET', f'photos/{self.test_photo_id}/view', 404,
                    description="Test photo proxy endpoint (expected 404 for fake storage_key)"
                )

    def test_public_endpoints(self):
        """Test public (non-authenticated) endpoints"""
        print("\n🌐 Testing Public Endpoints...")
        
        # Create a new session without auth cookies for public tests
        public_session = requests.Session()
        
        # Test public events
        try:
            response = public_session.get(f"{self.base_url}/api/public/events")
            success = response.status_code == 200
            self.log_test("GET public/events", success, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET public/events", False, f"Exception: {str(e)}")

    def test_cleanup(self):
        """Clean up test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete test photo first if it exists
        if self.test_photo_id:
            success, _ = self.test_api_endpoint(
                'DELETE', f'photos/{self.test_photo_id}', 200,
                description="Delete test photo"
            )
            if success:
                print(f"   🗑️  Deleted test photo: {self.test_photo_id}")
        
        if self.test_event_id:
            success, _ = self.test_api_endpoint(
                'DELETE', f'events/{self.test_event_id}', 200,
                description="Delete test event"
            )
            if success:
                print(f"   🗑️  Deleted test event: {self.test_event_id}")

    def test_logout(self):
        """Test logout functionality"""
        print("\n🚪 Testing Logout...")
        
        self.test_api_endpoint('POST', 'auth/logout', 200, description="Logout")
        
        # Verify that protected endpoints now return 401
        self.test_api_endpoint('GET', 'auth/me', 401, description="Access after logout")

    def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 Starting Lux Studio API Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test authentication first
        auth_success = self.test_auth_flow()
        
        if auth_success:
            # Test authenticated endpoints
            self.test_dashboard_stats()
            self.test_event_crud()
            self.test_photo_operations()
            
            # Clean up before logout
            self.test_cleanup()
            
            # Test logout
            self.test_logout()
        
        # Test public endpoints (no auth required)
        self.test_public_endpoints()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("❌ Some tests failed!")
            print("\nFailed tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
            return 1

def main():
    """Main test runner"""
    tester = LuxStudioAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())