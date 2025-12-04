# Mobile App Setup Guide

This guide will help you set up and run the mobile app with the local FastAPI backend.

## Architecture

```
Mobile App → Local FastAPI (localhost:8000) → External API (pharmacy-api-webservice.onrender.com)
```

The FastAPI backend acts as a proxy, handling authentication and forwarding requests to the external API using your API key.

## Prerequisites

1. **Python 3.8+** with FastAPI dependencies installed
2. **Node.js 18+** and npm
3. **Expo CLI** (`npm install -g expo-cli`)
4. **.env file** configured with API credentials

## Step 1: Configure Environment Variables

Make sure your `.env` file in the project root contains:

```env
PHARMA_API_BASE=https://pharmacy-api-webservice.onrender.com
PHARMA_API_KEY=super-secret-long-random-string
SESSION_SECRET_KEY=your-session-secret-here
```

## Step 2: Install Python Dependencies

```bash
cd /Users/charldewet/Python/BudgetingApp
pip install -r requirements.txt
```

## Step 3: Install Mobile App Dependencies

```bash
cd mobile
npm install
```

## Step 4: Start the FastAPI Backend

### Option A: Using the startup script (Recommended)

```bash
cd /Users/charldewet/Python/BudgetingApp
chmod +x start_backend.sh
./start_backend.sh
```

### Option B: Manual start

```bash
cd /Users/charldewet/Python/BudgetingApp
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Important:** Use `--host 0.0.0.0` so the server is accessible from emulators and physical devices.

The backend will start on `http://localhost:8000`. You can verify it's running by visiting:
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/

## Step 5: Configure Mobile App API URL

The mobile app is already configured to connect to your local backend. The configuration in `mobile/src/config/api.js` automatically detects:

- **iOS Simulator**: `http://localhost:8000`
- **Android Emulator**: `http://10.0.2.2:8000`
- **Physical Device**: `http://192.168.68.119:8000` (your current local IP)

### For Physical Device Testing

If your local IP changes, update `LOCAL_IP` in `mobile/src/config/api.js`:

```javascript
const LOCAL_IP = '192.168.68.119'; // Update this if your IP changes
```

To find your current IP:
```bash
# Mac/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}'

# Or
ipconfig getifaddr en0
```

## Step 6: Start the Mobile App

In a new terminal:

```bash
cd mobile
npm start
```

Then:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app on physical device

## Step 7: Test the Connection

1. Open the mobile app
2. Try logging in with your credentials
3. Check the backend terminal for API requests
4. Verify the dashboard loads pharmacies and data

## Troubleshooting

### Backend won't start

- **Port 8000 already in use**: Change the port in `start_backend.sh` or kill the process using port 8000
- **Module not found**: Run `pip install -r requirements.txt`
- **.env file missing**: Create `.env` file with required variables

### Mobile app can't connect to backend

- **iOS Simulator**: Make sure backend is running on `localhost:8000`
- **Android Emulator**: Backend should be accessible via `10.0.2.2:8000`
- **Physical Device**: 
  - Ensure phone and computer are on the same WiFi network
  - Update `LOCAL_IP` in `mobile/src/config/api.js` with your computer's IP
  - Make sure firewall allows connections on port 8000

### 404 errors when fetching pharmacies

- Verify backend is running: `curl http://localhost:8000/docs`
- Check API_BASE_URL in mobile app matches your setup
- Verify `.env` has correct `PHARMA_API_BASE` and `PHARMA_API_KEY`

### Authentication errors

- Check that `PHARMA_API_KEY` in `.env` is correct
- Verify the external API is accessible: `curl https://pharmacy-api-webservice.onrender.com`
- Check backend logs for detailed error messages

## API Endpoints

The mobile app uses these endpoints:

- `POST /api/mobile/login` - Mobile login (returns JSON token)
- `GET /api/mobile/pharmacies?username=<username>` - Get user's pharmacies
- `GET /api/days?pid=<pid>&month=<YYYY-MM>` - Get daily data
- `GET /api/mtd?pid=<pid>&month=<YYYY-MM>&through=<YYYY-MM-DD>` - Get MTD data
- `GET /api/best-sellers?pid=<pid>&date=<YYYY-MM-DD>&limit=<limit>` - Get best sellers
- `GET /api/worst-gp?pid=<pid>&date=<YYYY-MM-DD>&limit=<limit>&threshold=<threshold>` - Get worst GP

All endpoints require authentication via Bearer token in the Authorization header.

## Development Workflow

1. **Terminal 1**: Run `./start_backend.sh` (keep running)
2. **Terminal 2**: Run `cd mobile && npm start` (keep running)
3. **Terminal 3**: Make code changes, they'll hot-reload automatically

## Next Steps

- [ ] Add charts and visualizations
- [ ] Implement Group view (multi-pharmacy comparison)
- [ ] Add date picker for daily view
- [ ] Implement Best sellers/Worst GP product lists

## Support

If you encounter issues:
1. Check backend logs in Terminal 1
2. Check mobile app logs in Terminal 2 (or Expo DevTools)
3. Verify `.env` configuration
4. Test API endpoints directly with `curl` or Postman


