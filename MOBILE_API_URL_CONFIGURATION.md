# Mobile App API URL Configuration

## Current Issue

The mobile app is configured with the **wrong** `API_BASE_URL`. It's pointing to the external pharmacy API instead of your FastAPI budgeting app.

## Current Configuration (WRONG)

**File:** `mobile/src/config/api.js`

```javascript
export const API_BASE_URL = 'https://pharmacy-api-webservice.onrender.com';
```

**Problem:** This is the external API that your FastAPI app proxies to, NOT your FastAPI app itself.

## What It Should Be

The mobile app needs to connect to **your FastAPI budgeting app** on Render, which should be something like:

```javascript
export const API_BASE_URL = 'https://pharmasight-budgeting-app.onrender.com';
```

(Replace with the actual URL from your Render dashboard)

## How to Find the Correct URL

1. **Ask the Web App Team** (see `QUESTION_FOR_WEB_TEAM.md`)
   - They should provide the production URL where the web dashboard is hosted
   - It's the same URL they use to access the app in a browser

2. **Or check Render Dashboard:**
   - Go to https://dashboard.render.com
   - Find the web service (likely named `pharmasight-budgeting-app` or similar)
   - Copy the URL shown (e.g., `https://pharmasight-budgeting-app.onrender.com`)

## Endpoints the Mobile App Uses

The mobile app correctly calls these FastAPI endpoints (these are already correct):

✅ `/api/mobile/login` - Mobile login
✅ `/api/mobile/pharmacies` - Get user's pharmacies  
✅ `/api/days` - Daily sales data
✅ `/api/mtd` - Month-to-date data
✅ `/api/best-sellers` - Best selling products
✅ `/api/worst-gp` - Worst GP products
✅ `/api/stock-value` - Stock value

All of these endpoints exist in your FastAPI app (`app/main.py`).

## Fix Steps

Once you have the correct URL:

1. **Update `mobile/src/config/api.js`:**
   ```javascript
   export const API_BASE_URL = 'https://YOUR-ACTUAL-FASTAPI-URL.onrender.com';
   ```

2. **Also fix the login endpoint** in `mobile/src/services/api.js`:
   - Line 48: Change `/login` to `/api/mobile/login`
   - The mobile app should use the mobile-specific login endpoint

3. **Test the connection:**
   ```bash
   # Test if the endpoint is accessible
   curl https://YOUR-URL.onrender.com/api/mobile/pharmacies?username=test
   ```

## Important Notes

- **Your FastAPI app** acts as a proxy - it forwards requests to `pharmacy-api-webservice.onrender.com`
- **The mobile app** should connect to **your FastAPI app**, not directly to the external API
- Your FastAPI app provides mobile-specific endpoints like `/api/mobile/login` and `/api/mobile/pharmacies`
- The web app uses session cookies, but the mobile app uses Bearer tokens (handled automatically)

## Architecture Flow

```
Mobile App
    ↓
FastAPI Budgeting App (your-app.onrender.com)
    ↓
External Pharmacy API (pharmacy-api-webservice.onrender.com)
```

The mobile app should connect to the **first** layer (your FastAPI app), not skip directly to the external API.

## Files to Update

1. ✅ `mobile/src/config/api.js` - Update `API_BASE_URL`
2. ✅ `mobile/src/services/api.js` - Fix login endpoint (line 48: `/login` → `/api/mobile/login`)

## Quick Reference

**Wrong:** `https://pharmacy-api-webservice.onrender.com`  
**Right:** `https://your-fastapi-app-name.onrender.com` (get from web team)

---

**Status:** ⏳ Waiting for production URL from web app team

