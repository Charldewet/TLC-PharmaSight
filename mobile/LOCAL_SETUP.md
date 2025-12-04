# Local Development Setup

## Architecture

Your setup:
- **FastAPI App** - Runs locally on your computer (port 8000)
- **External API** - `pharmacy-api-webservice.onrender.com` (FastAPI proxies to this)
- **Mobile App** - Connects to local FastAPI, which proxies to external API

## Step 1: Start FastAPI Locally

```bash
cd /Users/charldewet/Python/BudgetingApp
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Important:** Use `--host 0.0.0.0` so it's accessible from other devices/emulators.

## Step 2: Configure Mobile App

The mobile app is already configured to connect to localhost, but you may need to adjust based on your setup:

### For iOS Simulator (Mac):
- Uses `http://localhost:8000` ✅ (already configured)

### For Android Emulator:
- Uses `http://10.0.2.2:8000` ✅ (already configured)

### For Physical Device:
1. Find your computer's IP address:
   ```bash
   # Mac/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   # Or
   ipconfig getifaddr en0
   
   # Windows
   ipconfig
   # Look for IPv4 Address under your WiFi adapter
   ```

2. Update `mobile/src/config/api.js`:
   ```javascript
   // Replace XXX with your actual IP
   return 'http://192.168.1.XXX:8000';
   ```

3. Make sure your phone and computer are on the **same WiFi network**

## Step 3: Environment Variables

Make sure your `.env` file has:
```env
PHARMA_API_BASE=https://pharmacy-api-webservice.onrender.com
PHARMA_API_KEY=your-api-key-here
SESSION_SECRET_KEY=your-session-secret
DATABASE_URL=your-database-url
```

## Step 4: Test Connection

1. Start FastAPI: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
2. Verify it's running: Visit `http://localhost:8000` in browser
3. Start mobile app: `cd mobile && npm start`
4. Test login in mobile app

## Troubleshooting

### "Network request failed" or "Connection refused"
- ✅ FastAPI is running (`uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`)
- ✅ Using correct URL for your platform (localhost for iOS, 10.0.2.2 for Android)
- ✅ For physical device: Using computer's IP address, not localhost
- ✅ Phone and computer on same WiFi network
- ✅ Firewall allows connections on port 8000

### "404 Not Found" on `/api/mobile/pharmacies`
- ✅ FastAPI is running and accessible
- ✅ Check FastAPI logs for errors
- ✅ Verify endpoint exists: Visit `http://localhost:8000/api/mobile/pharmacies?username=test` in browser

### "401 Unauthorized"
- ✅ API_KEY is set in `.env` file
- ✅ FastAPI can reach `pharmacy-api-webservice.onrender.com`
- ✅ Check FastAPI logs for authentication errors

## Quick Test

Test if FastAPI is accessible:
```bash
# From terminal (should return 422 or 401, not 404)
curl http://localhost:8000/api/mobile/pharmacies?username=test
```

If you get 404, FastAPI isn't running or the endpoint doesn't exist.
If you get 422/401, FastAPI is running correctly! ✅


