#!/bin/bash

# Start FastAPI Backend for Mobile App
# This script starts the FastAPI backend locally so the mobile app can connect to it

echo "🚀 Starting FastAPI Backend..."
echo ""
echo "📋 Configuration:"
echo "   - Backend will run on: http://0.0.0.0:8000"
echo "   - API Base URL: https://pharmacy-api-webservice.onrender.com"
echo "   - Mobile endpoints: /api/mobile/login, /api/mobile/pharmacies"
echo ""
echo "📱 Mobile App Connection:"
echo "   - iOS Simulator: http://localhost:8000"
echo "   - Android Emulator: http://10.0.2.2:8000"
echo "   - Physical Device: http://192.168.68.119:8000"
echo ""
echo "⚠️  Make sure your .env file has:"
echo "   - PHARMA_API_BASE=https://pharmacy-api-webservice.onrender.com"
echo "   - PHARMA_API_KEY=your-api-key"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "   Please create a .env file with PHARMA_API_BASE and PHARMA_API_KEY"
    exit 1
fi

# Check if uvicorn is installed
if ! command -v uvicorn &> /dev/null; then
    echo "❌ Error: uvicorn not found!"
    echo "   Please install dependencies: pip install -r requirements.txt"
    exit 1
fi

# Start the server
echo "✅ Starting server..."
echo ""
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


