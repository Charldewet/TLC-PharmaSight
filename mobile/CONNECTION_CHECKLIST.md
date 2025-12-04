# Mobile App Connection Checklist

## ✅ Fixed Issues

1. **API Endpoint**: Changed to use `/api/mobile/pharmacies` endpoint (same as web app)
2. **API Service**: Now using `dashboardAPI.getPharmacies()` which has proper axios interceptors
3. **CORS Support**: Added CORS middleware to backend for mobile app support
4. **Error Handling**: Improved error logging and user feedback

## 🔧 Configuration Required

### 1. API Base URL Configuration

**File**: `mobile/src/config/api.js`

Update `API_BASE_URL` based on your setup:

```javascript
// For iOS Simulator (Mac):
export const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000'

// For Android Emulator:
export const API_BASE_URL = __DEV__ 
  ? 'http://10.0.2.2:8000'

// For Physical Device (replace with your computer's IP):
export const API_BASE_URL = __DEV__ 
  ? 'http://192.168.1.XXX:8000'  // Replace XXX with your IP

// For Production (deployed backend):
export const API_BASE_URL = 'https://your-backend.onrender.com'
```

**To find your computer's IP address:**
- Mac/Linux: Run `ifconfig` or `ipconfig getifaddr en0`
- Windows: Run `ipconfig` and look for IPv4 Address

### 2. Backend Server

Make sure your backend is running:
```bash
cd /Users/charldewet/Python/BudgetingApp
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The `--host 0.0.0.0` is important to allow connections from other devices.

### 3. Network Requirements

- **iOS Simulator**: Can use `localhost:8000` (same machine)
- **Android Emulator**: Must use `10.0.2.2:8000` (special IP for host machine)
- **Physical Device**: Must use your computer's IP address (e.g., `192.168.1.100:8000`)
- **Both device and computer must be on the same WiFi network**

### 4. Firewall

Make sure your firewall allows connections on port 8000:
- Mac: System Preferences → Security & Privacy → Firewall
- Windows: Windows Defender Firewall

## 🐛 Debugging Steps

1. **Check Console Logs**: Look for `[loadPharmacies]` logs in your React Native debugger
2. **Verify Auth Token**: Check if token is being stored after login
3. **Test API Directly**: Try accessing `http://YOUR_IP:8000/api/mobile/pharmacies?username=YOUR_USERNAME` in a browser (with auth header)
4. **Check Network**: Ensure device/emulator can reach the backend server

## 📱 Testing

1. Start backend server: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
2. Update `API_BASE_URL` in `mobile/src/config/api.js`
3. Start mobile app: `cd mobile && npm start`
4. Check console logs for connection status


