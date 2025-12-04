# Finding Your Backend URL

## The Issue

Your mobile app needs to connect to your **FastAPI backend** (the budgeting app), NOT to `pharmacy-api-webservice.onrender.com`.

## Two Different Services

1. **`pharmacy-api-webservice.onrender.com`** - External API (what your backend talks to)
2. **Your FastAPI Backend** - The budgeting app itself (what web app and mobile app should connect to)

## How to Find Your FastAPI Backend URL

### Option 1: Check Render Dashboard
1. Go to https://dashboard.render.com
2. Look for your **web service** (not the database)
3. The service name is probably something like:
   - `pharmasight-budgeting-app`
   - `budgeting-app`
   - `tlc-pharmasight`
   - Or similar
4. Copy the **Service URL** shown in the dashboard
5. It will be: `https://your-service-name.onrender.com`

### Option 2: Check Your Web App
1. Open your web app in a browser
2. Open browser DevTools (F12)
3. Go to **Network** tab
4. Refresh the page or make any request
5. Look at any API request - the domain will be your backend URL
6. Example: If you see `https://something.onrender.com/api/...`, that's your backend URL

### Option 3: Check Your Browser Address Bar
- If your web app is at `https://something.onrender.com`, that's your backend URL!

## Once You Have the URL

Update `mobile/src/config/api.js`:

```javascript
export const API_BASE_URL = 'https://YOUR-ACTUAL-BACKEND-URL.onrender.com';
```

## Test It

After updating, test if the endpoint exists:
```
https://YOUR-BACKEND-URL.onrender.com/api/mobile/pharmacies?username=test
```

You should get a 401 (unauthorized) or 422 (validation error), NOT a 404. A 404 means the URL is wrong.


