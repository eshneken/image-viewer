# OCI Image Viewer

A modern, efficient Flask web application for viewing images stored in Oracle Cloud Infrastructure (OCI) Object Storage using Pre-Authenticated Requests (PAR) or OCI SDK for automatic object discovery.

## Features

- **Automatic Image Discovery**: Uses OCI SDK to automatically list and discover images in your bucket
- **Efficient Pagination**: Loads images in batches of 20 to handle large collections (~500 images)
- **Modal Full-Size Viewing**: Click any image to view it in full size with navigation
- **Keyboard Navigation**: Use arrow keys and Escape in the modal
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Lazy Loading**: Images load only when needed for optimal performance
- **Thumbnail Generation**: Automatically creates thumbnails for gallery display
- **Modern UI**: Beautiful gradient design with smooth animations
- **Multiple Authentication Methods**: Supports OCI config files, resource principals, and PAR URLs

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Copy the example environment file and update it with your OCI settings:

```bash
cp env.example .env
```

Edit `.env` and configure your OCI access:

```bash
# Option 1: Using PAR URL (simplest)
OCI_PAR_URL=https://your-bucket-namespace.objectstorage.your-region.oraclecloud.com/your-bucket-name/your-par-path

# Option 2: Using OCI SDK (recommended for automatic discovery)
OCI_CONFIG_FILE=~/.oci/config
OCI_PROFILE=DEFAULT
OCI_NAMESPACE=your-namespace
OCI_BUCKET_NAME=your-bucket-name
OCI_REGION=us-ashburn-1
```

### 3. Run the Application

```bash
python app.py
```

The application will be available at `http://localhost:8000`

## Configuration Options

### Method 1: OCI SDK (Recommended)

This method automatically discovers all images in your bucket:

1. **Install OCI CLI and configure authentication**:
   ```bash
   pip install oci-cli
   oci setup config
   ```

2. **Set environment variables**:
   ```bash
   OCI_CONFIG_FILE=~/.oci/config
   OCI_PROFILE=DEFAULT
   OCI_NAMESPACE=your-namespace
   OCI_BUCKET_NAME=your-bucket-name
   OCI_REGION=us-ashburn-1
   ```

3. **The app will automatically**:
   - List all objects in your bucket
   - Filter for image files (jpg, png, gif, etc.)
   - Display them in the gallery

### Method 2: PAR URL (Simple)

This method uses a Pre-Authenticated Request URL:

1. **Create a PAR in OCI Console**:
   - Navigate to Object Storage → Buckets → Your Bucket
   - Click "Create Pre-Authenticated Request"
   - Set appropriate permissions (Read access)
   - Set expiration time as needed
   - Copy the generated URL

2. **Set the PAR URL**:
   ```bash
   OCI_PAR_URL=https://your-bucket-namespace.objectstorage.your-region.oraclecloud.com/your-bucket-name/your-par-path
   ```

3. **Note**: PAR URLs don't support object listing, so you'll need to provide image names manually (see fallback methods below)

### Method 3: Fallback Options

If automatic discovery fails, you can provide image names manually:

1. **Environment Variable**:
   ```bash
   IMAGE_LIST=image1.jpg,image2.png,photo1.jpeg
   ```

2. **Local File**: Create `image_list.txt` with one image name per line:
   ```
   image1.jpg
   image2.png
   photo1.jpeg
   ```

## Image Discovery Logic

The application uses a multi-tier approach to find images:

1. **OCI SDK**: Lists all objects in the bucket and filters for image files
2. **PAR URL**: Tries to access a `manifest.json` file if it exists
3. **Local File**: Reads from `image_list.txt` if available
4. **Environment**: Uses `IMAGE_LIST` environment variable
5. **Fallback**: Generates a sample list for testing

### Supported Image Formats

The application automatically detects these image formats:
- `.jpg`, `.jpeg`
- `.png`
- `.gif`
- `.bmp`
- `.webp`
- `.tiff`, `.tif`

## Customization

- **Images per page**: Modify `IMAGES_PER_PAGE` in `app.py`
- **Thumbnail size**: Adjust width/height in `get_image_thumbnail()` method
- **Image extensions**: Modify `IMAGE_EXTENSIONS` set in `app.py`
- **Styling**: Customize `static/css/style.css`
- **Behavior**: Modify `static/js/app.js` for frontend functionality

## Architecture

### Backend (Flask)
- **`app.py`**: Main Flask application with routes and image processing
- **`ImageViewer` class**: Handles OCI object storage interactions
- **OCI SDK Integration**: Automatic object listing and discovery
- **Thumbnail generation**: Uses Pillow for efficient image resizing
- **Pagination**: Efficient server-side pagination to handle large image collections

### Frontend
- **Responsive grid layout**: CSS Grid for optimal image display
- **Modal system**: Full-screen image viewing with navigation
- **AJAX pagination**: Smooth page transitions without full reloads
- **Keyboard shortcuts**: Arrow keys for navigation, Escape to close

### Performance Optimizations

1. **Lazy Loading**: Images load only when scrolled into view
2. **Thumbnail Caching**: Generated thumbnails are cached in memory
3. **Efficient Pagination**: Only loads necessary images per page
4. **Image Compression**: Thumbnails are optimized for web display
5. **Background Preloading**: Adjacent images are preloaded for smooth navigation

## API Endpoints

- `GET /`: Main gallery page
- `GET /api/images?page=N`: Get paginated images (JSON)
- `GET /api/image/<image_name>`: Get specific image
- `GET /api/image-info/<image_name>`: Get image metadata
- `GET /api/refresh-images`: Refresh the image list (force reload from bucket)

## Deployment

### Production Setup

1. **Environment Variables**:
   ```bash
   export FLASK_ENV=production
   export SECRET_KEY=your-secure-secret-key
   ```

2. **Using Gunicorn**:
   ```bash
   gunicorn -w 4 -b 0.0.0.0:8000 app:app
   ```

3. **Reverse Proxy** (Nginx example):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## Troubleshooting

### Common Issues

1. **Images not loading**: Check your PAR URL or OCI configuration
2. **No images found**: Verify bucket permissions and namespace/bucket names
3. **OCI SDK errors**: Ensure OCI CLI is configured correctly
4. **Slow loading**: Verify your OCI region and network connectivity
5. **Thumbnail errors**: Ensure Pillow is properly installed and images are valid

### Authentication Methods

The app tries authentication methods in this order:
1. **OCI Config File**: `~/.oci/config`
2. **Resource Principal**: For running in OCI compute instances
3. **PAR URL**: Direct access (limited functionality)

### Performance Tips

- Use a CDN for static assets in production
- Consider implementing Redis caching for thumbnails
- Optimize image sizes before uploading to OCI
- Use appropriate OCI regions for your users
- Use OCI SDK for automatic discovery instead of PAR URLs

## Security Considerations

- Keep your PAR URL secure and rotate it regularly
- Use HTTPS in production
- Implement rate limiting for API endpoints
- Validate image file types and sizes
- Set appropriate CORS headers if needed
- Use least-privilege IAM policies for OCI access

## License

This project is open source and available under the MIT License.
