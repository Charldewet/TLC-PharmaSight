# Update Mobile App API URL

## Current Issue

The mobile app is currently configured to connect directly to the external pharmacy API instead of your FastAPI budgeting app.

**Current (WRONG):**
```javascript
export const API_BASE_URL = 'https://pharmacy-api-webservice.onrender.com';
```

**Should be (CORRECT):**
```javascript
export const API_BASE_URL = 'https://YOUR-FASTAPI-APP-URL.onrender.com';
```

## Steps to Fix

1. **Get the production URL from the web app team**
   - See `QUESTION_FOR_WEB_TEAM.md` for the question to ask them
   - It should be the same URL they use to access the web dashboard

2. **Update the mobile app config**
   - Edit `mobile/src/config/api.js`
   - Replace `API_BASE_URL` with the correct URL

3. **Test the connection**
   - The mobile app should connect to endpoints like:
     - `https://your-app.onrender.com/api/mobile/login`
     - `https://your-app.onrender.com/api/mobile/pharmacies`
     - etc.

## Example Update

Once you have the URL (e.g., `https://pharmasight-budgeting-app.onrender.com`):

```javascript
// mobile/src/config/api.js
export const API_BASE_URL = 'https://pharmasight-budgeting-app.onrender.com';
```

## Why This Matters

- Your FastAPI app acts as a proxy and handles authentication
- The mobile app needs to connect through your FastAPI app, not directly to the external API
- Your FastAPI app provides mobile-specific endpoints like `/api/mobile/login` and `/api/mobile/pharmacies`

