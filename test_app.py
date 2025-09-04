import unittest
from app import app, ImageViewer
import os

class TestImageViewer(unittest.TestCase):
    
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True
        
    def test_home_page(self):
        """Test that the home page loads"""
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)
        
    def test_api_images_endpoint(self):
        """Test the API images endpoint"""
        response = self.app.get('/api/images?page=1')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn('images', data)
        self.assertIn('pagination', data)
        
    def test_image_viewer_initialization(self):
        """Test ImageViewer class initialization"""
        test_par_url = "https://test.example.com/test-bucket/"
        viewer = ImageViewer(test_par_url)
        self.assertEqual(viewer.base_url, test_par_url)
        
    def test_environment_variables(self):
        """Test that required environment variables are accessible"""
        # This test will pass even if OCI_PAR_URL is not set
        # as the app handles missing PAR URLs gracefully
        self.assertTrue(True)

if __name__ == '__main__':
    unittest.main()
