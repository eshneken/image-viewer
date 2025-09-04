#!/bin/bash

# OCI Image Viewer Startup Script

echo "🚀 Starting OCI Image Viewer..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp env.example .env
    echo "📝 Please edit .env file with your OCI configuration before running again."
    echo "   You can use either:"
    echo "   - OCI_PAR_URL for simple PAR-based access"
    echo "   - OCI_CONFIG_FILE + OCI_NAMESPACE + OCI_BUCKET_NAME for automatic discovery"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📚 Installing dependencies..."
pip install -r requirements.txt

# Check if OCI configuration is set
if ! grep -q "OCI_PAR_URL=https://" .env && ! grep -q "OCI_NAMESPACE=" .env; then
    echo "❌ OCI configuration not found in .env file"
    echo "   Please edit .env and set either:"
    echo "   - OCI_PAR_URL for PAR-based access"
    echo "   - OCI_NAMESPACE and OCI_BUCKET_NAME for SDK-based access"
    exit 1
fi

# Start the application
echo "🌐 Starting Flask application..."
echo "   Application will be available at: http://localhost:8000"
echo "   Press Ctrl+C to stop"
echo ""

python app.py
