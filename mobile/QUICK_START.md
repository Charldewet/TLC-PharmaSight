# Quick Start Guide

Get your mobile app running in 3 steps!

## Step 1: Start Backend

```bash
cd /Users/charldewet/Python/BudgetingApp
./start_backend.sh
```

The backend will start on `http://localhost:8000`

## Step 2: Start Mobile App

In a **new terminal**:

```bash
cd mobile
npm start
```

Then press:
- `i` for iOS Simulator
- `a` for Android Emulator  
- Scan QR code for physical device

## Step 3: Test Login

1. Open the app
2. Enter your credentials
3. Dashboard should load with pharmacies

## Troubleshooting

**Backend won't start?**
- Check `.env` file exists with `PHARMA_API_BASE` and `PHARMA_API_KEY`
- Make sure port 8000 is free: `lsof -ti:8000 | xargs kill`

**App can't connect?**
- iOS Simulator: Should work automatically
- Android Emulator: Uses `10.0.2.2:8000` automatically
- Physical Device: Update `LOCAL_IP` in `mobile/src/config/api.js` with your computer's IP

**Find your IP:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}'
```

See `MOBILE_SETUP.md` for detailed documentation.
