# FastAPI Base URL Explanation

## Understanding the Two Different URLs

Your FastAPI app uses **two different base URLs** for different purposes:

### 1. **FastAPI App's Own URL** (Where it's hosted)
- **What it is:** The URL where your FastAPI app is deployed on Render
- **Where it's used:** Mobile app needs this to connect to your FastAPI endpoints
- **How to find it:** Based on your Render service name

### 2. **External API Base URL** (What FastAPI proxies to)
- **What it is:** The external pharmacy API that your FastAPI app forwards requests to
- **Where it's configured:** `app/main.py` line 31
- **Current value:** `https://pharmacy-api-webservice.onrender.com`

---

## Finding Your FastAPI App's Base URL

### Method 1: Check Render Dashboard (Recommended)

1. Go to https://dashboard.render.com
2. Find your **web service** (not the database)
3. Look for service name: **`pharmasight-budgeting-app`** (from `render.yaml`)
4. The URL will be displayed in the dashboard
5. Format: `https://pharmasight-budgeting-app.onrender.com`

**Note:** Render automatically creates URLs based on service names:
- Service name: `pharmasight-budgeting-app`
- URL: `https://pharmasight-budgeting-app.onrender.com`

### Method 2: Check Your Browser

1. Open your web app in a browser
2. Look at the address bar - that's your FastAPI app URL!
3. Example: If you see `https://pharmasight-budgeting-app.onrender.com`, that's it

### Method 3: Check Network Tab

1. Open your web app in browser
2. Open DevTools (F12) → Network tab
3. Make any request (refresh page, login, etc.)
4. Look at the domain in the requests - that's your FastAPI app URL

---

## Code Reference

### In `app/main.py` (Line 31):

```python
API_BASE_URL = os.getenv("PHARMA_API_BASE", "https://pharmacy-api-webservice.onrender.com")
```

**This is NOT your FastAPI app's URL!**

This is the **external API** that your FastAPI app proxies requests to. Your FastAPI app uses this to make backend API calls.

### Your FastAPI App's URL

Your FastAPI app's URL is **not hardcoded** in the code. It's determined by:
- Where Render deploys it
- The service name in `render.yaml`: `pharmasight-budgeting-app`
- Render's URL pattern: `https://{service-name}.onrender.com`

**Expected URL:** `https://pharmasight-budgeting-app.onrender.com`

---

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│  Mobile App / Web Browser               │
│  Connects to:                           │
│  https://pharmasight-budgeting-app      │
│  .onrender.com                          │
└──────────────┬──────────────────────────┘
               │
               │ HTTP Requests
               │ /api/mobile/login
               │ /api/days
               │ /api/mtd
               │ etc.
               ▼
┌─────────────────────────────────────────┐
│  FastAPI Budgeting App                  │
│  Hosted at:                             │
│  https://pharmasight-budgeting-app      │
│  .onrender.com                          │
│                                         │
│  Uses API_BASE_URL to proxy to:        │
└──────────────┬──────────────────────────┘
               │
               │ HTTP Requests
               │ /auth/login
               │ /pharmacies/{id}/days
               │ etc.
               ▼
┌─────────────────────────────────────────┐
│  External Pharmacy API                  │
│  https://pharmacy-api-webservice        │
│  .onrender.com                          │
└─────────────────────────────────────────┘
```

---

## For Mobile App Configuration

The mobile app needs to connect to **your FastAPI app**, not the external API.

**Update:** `mobile/src/config/api.js`

```javascript
// WRONG (current):
export const API_BASE_URL = 'https://pharmacy-api-webservice.onrender.com';

// CORRECT (should be):
export const API_BASE_URL = 'https://pharmasight-budgeting-app.onrender.com';
```

---

## Quick Check

To verify your FastAPI app URL, try accessing:

```
https://pharmasight-budgeting-app.onrender.com/health
```

You should get:
```json
{"status": "ok"}
```

If you get a 404 or connection error, the URL might be different. Check your Render dashboard for the exact service name and URL.

---

## Summary

- **FastAPI App URL:** `https://pharmasight-budgeting-app.onrender.com` (or check Render dashboard)
- **External API URL:** `https://pharmacy-api-webservice.onrender.com` (configured in `main.py`)
- **Mobile app should use:** FastAPI App URL (first one)
- **FastAPI app uses:** External API URL (second one) to proxy requests

