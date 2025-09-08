from flask import Flask, render_template, jsonify, request, send_file
from flask import session, redirect, url_for, flash
import requests
import json
import os
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv
import io
from PIL import Image
import base64
import oci
from oci.object_storage import ObjectStorageClient
from oci.auth.signers import get_resource_principals_signer
import re

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here')
VIEWER_PASSWORD = os.getenv('VIEWER_PASSWORD', '')

# Configuration
IMAGES_PER_PAGE = 20
OCI_PAR_URL = os.getenv('OCI_PAR_URL', '')
OCI_CONFIG_FILE = os.getenv('OCI_CONFIG_FILE', '~/.oci/config')
OCI_PROFILE = os.getenv('OCI_PROFILE', 'DEFAULT')
OCI_NAMESPACE = os.getenv('OCI_NAMESPACE', '')
OCI_BUCKET_NAME = os.getenv('OCI_BUCKET_NAME', '')

# Image file extensions to consider
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'}

def is_authenticated() -> bool:
    return session.get('authenticated') is True

def login_required(view_func):
    from functools import wraps
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if is_authenticated():
            return view_func(*args, **kwargs)
        # Decide JSON vs HTML based on Accept header or path
        wants_json = request.path.startswith('/api') or 'application/json' in (request.headers.get('Accept') or '')
        if wants_json:
            return jsonify({'error': 'Unauthorized'}), 401
        next_url = request.url
        return redirect(url_for('login', next=next_url))
    return wrapper

# Auth routes
@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        password = request.form.get('password', '')
        if not VIEWER_PASSWORD:
            error = 'Server is not configured. Contact admin.'
        elif password == VIEWER_PASSWORD:
            session['authenticated'] = True
            next_url = request.args.get('next')
            return redirect(next_url or url_for('index'))
        else:
            error = 'Invalid password'
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

class ImageViewer:
    def __init__(self, par_url=None, config_file=None, profile=None, namespace=None, bucket_name=None):
        self.par_url = par_url
        self.config_file = config_file or OCI_CONFIG_FILE
        self.profile = profile or OCI_PROFILE
        self.namespace = namespace or OCI_NAMESPACE
        self.bucket_name = bucket_name or OCI_BUCKET_NAME
        self._cached_images = {}
        self._image_list = None
        self._oci_client = None
        
        # Extract bucket info from PAR URL if provided
        if par_url:
            self._extract_bucket_info_from_par(par_url)
    
    def _extract_bucket_info_from_par(self, par_url):
        """Extract bucket information from PAR URL"""
        try:
            parsed = urlparse(par_url)
            # PAR URL format: https://objectstorage.region.oraclecloud.com/p/.../n/namespace/b/bucket/o/...
            path_parts = parsed.path.split('/')
            
            # Find namespace and bucket in the path
            for i, part in enumerate(path_parts):
                if part == 'n' and i + 1 < len(path_parts):
                    self.namespace = path_parts[i + 1]
                elif part == 'b' and i + 1 < len(path_parts):
                    self.bucket_name = path_parts[i + 1]
                    break
            
            print(f"Extracted namespace: {self.namespace}, bucket: {self.bucket_name}")
        except Exception as e:
            print(f"Error extracting bucket info from PAR: {e}")
    
    def _get_oci_client(self):
        """Get OCI Object Storage client"""
        if self._oci_client is None:
            try:
                # Try to use config file first
                config = oci.config.from_file(self.config_file, self.profile)
                self._oci_client = ObjectStorageClient(config)
                print("Using OCI config file authentication")
            except Exception as e:
                print(f"Error loading OCI config: {e}")
                try:
                    # Try resource principal authentication (for running in OCI)
                    signer = get_resource_principals_signer()
                    self._oci_client = ObjectStorageClient(config={}, signer=signer)
                    print("Using resource principal authentication")
                except Exception as e2:
                    print(f"Error with resource principal auth: {e2}")
                    # Fallback to no authentication (will only work with PAR URLs)
                    self._oci_client = None
        return self._oci_client
    
    def get_image_list(self, force_refresh=False):
        """Get list of images from the bucket"""
        if self._image_list is not None and not force_refresh:
            return self._image_list
        
        try:
            # Try to get list from OCI SDK first
            if self._get_oci_client() and self.namespace and self.bucket_name:
                return self._get_images_from_oci_sdk()
            else:
                # Fallback to PAR URL method
                return self._get_images_from_par_url()
        except Exception as e:
            print(f"Error getting image list: {e}")
            # Final fallback: generate a sample list
            self._image_list = [f"image_{i:03d}.jpg" for i in range(1, 501)]
            return self._image_list
    
    def _get_images_from_oci_sdk(self):
        """Get image list using OCI SDK"""
        try:
            client = self._get_oci_client()
            if not client:
                return self._get_images_from_par_url()
            
            # List objects in the bucket
            list_objects_response = client.list_objects(
                namespace_name=self.namespace,
                bucket_name=self.bucket_name,
                limit=1000  # Adjust as needed
            )
            
            # Filter for image files
            image_files = []
            for obj in list_objects_response.data.objects:
                if self._is_image_file(obj.name):
                    image_files.append(obj.name)
            
            # Sort files (you can customize this sorting)
            image_files.sort()
            
            self._image_list = image_files
            print(f"Found {len(image_files)} images using OCI SDK")
            return self._image_list
            
        except Exception as e:
            print(f"Error using OCI SDK: {e}")
            return self._get_images_from_par_url()
    
    def _get_images_from_par_url(self):
        """Get image list using PAR URL (limited functionality)"""
        if not self.par_url:
            print("No PAR URL provided")
            return []
        
        try:
            # This is a simplified approach - PAR URLs don't support listing
            # We'll try to access a manifest file if it exists
            base_url = self._extract_base_url(self.par_url)
            
            # Try to get a manifest file
            manifest_url = f"{base_url}/manifest.json"
            response = requests.get(manifest_url, timeout=10)
            
            if response.status_code == 200:
                manifest = response.json()
                self._image_list = manifest.get('images', [])
                print(f"Found {len(self._image_list)} images from manifest")
                return self._image_list
            else:
                # If no manifest, we'll need to rely on OCI SDK or manual configuration
                print("No manifest file found, using fallback method")
                return self._get_fallback_image_list()
                
        except Exception as e:
            print(f"Error getting images from PAR URL: {e}")
            return self._get_fallback_image_list()
    
    def _get_fallback_image_list(self):
        """Fallback method when we can't get the actual list"""
        # This is where you would implement your own logic
        # For example, you could:
        # 1. Read from a local file
        # 2. Use environment variables
        # 3. Make educated guesses based on common patterns
        
        # Check if there's a local image list file
        try:
            with open('image_list.txt', 'r') as f:
                self._image_list = [line.strip() for line in f if line.strip()]
                print(f"Loaded {len(self._image_list)} images from local file")
                return self._image_list
        except FileNotFoundError:
            pass
        
        # Check environment variable
        env_image_list = os.getenv('IMAGE_LIST')
        if env_image_list:
            self._image_list = env_image_list.split(',')
            print(f"Loaded {len(self._image_list)} images from environment")
            return self._image_list
        
        # Generate a sample list (for testing)
        self._image_list = [f"image_{i:03d}.jpg" for i in range(1, 501)]
        print(f"Using fallback list with {len(self._image_list)} images")
        return self._image_list
    
    def _is_image_file(self, filename):
        """Check if a file is an image based on extension"""
        if not filename:
            return False
        
        # Get file extension
        ext = os.path.splitext(filename.lower())[1]
        return ext in IMAGE_EXTENSIONS
    
    def _extract_base_url(self, par_url):
        """Extract the base URL from the PAR URL"""
        parsed = urlparse(par_url)
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    
    def get_image_url(self, image_name):
        """Get the full URL for an image"""
        if self.par_url:
            # Use PAR URL if available
            base_url = self._extract_base_url(self.par_url)
            return f"{base_url}/{image_name}"
        else:
            # Construct URL using OCI SDK format
            return f"https://objectstorage.{os.getenv('OCI_REGION', 'us-ashburn-1')}.oraclecloud.com/n/{self.namespace}/b/{self.bucket_name}/o/{image_name}"
    
    def get_image_thumbnail(self, image_name, width=300, height=300):
        """Get a thumbnail version of the image"""
        try:
            image_url = self.get_image_url(image_name)
            response = requests.get(image_url, timeout=10)
            
            if response.status_code == 200:
                # Create thumbnail using Pillow
                img = Image.open(io.BytesIO(response.content))
                img.thumbnail((width, height), Image.Resampling.LANCZOS)
                
                # Convert to base64 for inline display
                buffer = io.BytesIO()
                img.save(buffer, format='JPEG', quality=85)
                img_base64 = base64.b64encode(buffer.getvalue()).decode()
                
                return f"data:image/jpeg;base64,{img_base64}"
            else:
                return None
        except Exception as e:
            print(f"Error creating thumbnail for {image_name}: {e}")
            return None
    
    def get_paginated_images(self, page=1, per_page=IMAGES_PER_PAGE):
        """Get paginated list of images with thumbnails"""
        print(f"get_paginated_images called with page={page}, per_page={per_page}")
        
        all_images = self.get_image_list()
        total_images = len(all_images)
        
        print(f"Total images found: {total_images}")
        
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        
        page_images = all_images[start_idx:end_idx]
        
        print(f"Page {page} images: {start_idx} to {end_idx} (showing {len(page_images)} images)")
        
        # Create image data with thumbnails
        image_data = []
        for img_name in page_images:
            thumbnail = self.get_image_thumbnail(img_name)
            image_data.append({
                'name': img_name,
                'url': self.get_image_url(img_name),
                'thumbnail': thumbnail
            })
        
        result = {
            'images': image_data,
            'pagination': {
                'current_page': page,
                'per_page': per_page,
                'total_images': total_images,
                'total_pages': (total_images + per_page - 1) // per_page,
                'has_prev': page > 1,
                'has_next': end_idx < total_images
            }
        }
        
        print(f"Returning pagination result: {result['pagination']}")
        return result

# Initialize the image viewer
image_viewer = ImageViewer(
    par_url=OCI_PAR_URL,
    config_file=OCI_CONFIG_FILE,
    profile=OCI_PROFILE,
    namespace=OCI_NAMESPACE,
    bucket_name=OCI_BUCKET_NAME
)

print(f"Image viewer initialized with:")
print(f"  PAR URL: {OCI_PAR_URL}")
print(f"  Config file: {OCI_CONFIG_FILE}")
print(f"  Profile: {OCI_PROFILE}")
print(f"  Namespace: {OCI_NAMESPACE}")
print(f"  Bucket: {OCI_BUCKET_NAME}")

@app.route('/')
@login_required
def index():
    """Main page with image gallery"""
    page = request.args.get('page', 1, type=int)
    result = image_viewer.get_paginated_images(page=page)
    return render_template('index.html', **result)

@app.route('/api/images')
@login_required
def api_images():
    """API endpoint for getting paginated images"""
    page = request.args.get('page', 1, type=int)
    print(f"API called for page: {page}")
    result = image_viewer.get_paginated_images(page=page)
    print(f"API result: {len(result['images'])} images, pagination: {result['pagination']}")
    return jsonify(result)

@app.route('/api/image/<image_name>')
@login_required
def api_image(image_name):
    """API endpoint for getting a specific image"""
    try:
        image_url = image_viewer.get_image_url(image_name)
        response = requests.get(image_url, timeout=30)
        
        if response.status_code == 200:
            return send_file(
                io.BytesIO(response.content),
                mimetype='image/jpeg',
                as_attachment=False
            )
        else:
            return jsonify({'error': 'Image not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/image-info/<image_name>')
@login_required
def api_image_info(image_name):
    """API endpoint for getting image information"""
    try:
        image_url = image_viewer.get_image_url(image_name)
        response = requests.head(image_url, timeout=10)
        
        if response.status_code == 200:
            return jsonify({
                'name': image_name,
                'url': image_url,
                'size': response.headers.get('content-length', 0),
                'content_type': response.headers.get('content-type', 'image/jpeg')
            })
        else:
            return jsonify({'error': 'Image not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/test')
@login_required
def test_pagination():
    """Test page for debugging pagination"""
    return send_file('test_pagination.html')

@app.route('/api/refresh-images')
@login_required
def api_refresh_images():
    """API endpoint to refresh the image list"""
    try:
        image_viewer.get_image_list(force_refresh=True)
        return jsonify({'message': 'Image list refreshed successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
