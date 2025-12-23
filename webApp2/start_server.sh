#!/bin/bash

# Start Local Development Server for Web App
# This script starts a simple HTTP server to serve the web app locally

PORT=${1:-3000}

echo "🚀 Starting Web App Development Server..."
echo ""
echo "📋 Configuration:"
echo "   - Server running on: http://localhost:${PORT}"
echo "   - Web app directory: $(pwd)"
echo ""
echo "🌐 Open your browser to:"
echo "   http://localhost:${PORT}/index.html"
echo ""
echo "⚠️  Note: Make sure you're logged in or have valid auth tokens"
echo "   The app will redirect to login.html if not authenticated"
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    echo "✅ Starting Python HTTP server..."
    echo "   Press Ctrl+C to stop"
    echo ""
    python3 -m http.server ${PORT}
elif command -v python &> /dev/null; then
    echo "✅ Starting Python HTTP server..."
    echo "   Press Ctrl+C to stop"
    echo ""
    python -m SimpleHTTPServer ${PORT}
else
    echo "❌ Error: Python not found!"
    echo "   Please install Python 3 to run the development server"
    echo ""
    echo "   Alternative: Use any HTTP server like:"
    echo "   - npx http-server (Node.js)"
    echo "   - php -S localhost:${PORT} (PHP)"
    exit 1
fi


