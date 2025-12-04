# API URL Configuration Fix

## Issue
Getting 404 errors when trying to access `/api/mobile/pharmacies`

## Solution
The Render service URL might be different. Please check your Render dashboard and update the URL in `mobile/src/config/api.js`.

## Steps to Find Your Render URL

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Find your web service (likely named `pharmasight-budgeting-app` or similar)
3. Copy the **Service URL** (it will be something like `https://your-service-name.onrender.com`)
4. Update `mobile/src/config/api.js`:

```javascript
export const API_BASE_URL = 'https://YOUR-ACTUAL-RENDER-URL.onrender.com';
```

## Test the URL

Once you have the correct URL, test it:

```bash
# Test if the endpoint exists (should return 404 without auth, but confirms URL is correct)
curl -I https://YOUR-URL.onrender.com/api/mobile/pharmacies?username=test

# Or test in browser (will show error but confirms endpoint exists)
# https://YOUR-URL.onrender.com/api/mobile/pharmacies?username=test
```

## Alternative: Check Web App

If your web app is working, check what URL it uses:
- Open your web app in browser
- Open browser DevTools → Network tab
- Look at any API request to see the base URL
- Use that same URL in the mobile app config


