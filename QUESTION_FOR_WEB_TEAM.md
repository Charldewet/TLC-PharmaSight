# Question for Web App Team

## What is the production URL for our FastAPI budgeting app on Render?

**Context:** I need to configure the mobile app to connect to the correct backend URL.

**What I need:**
The production URL where our FastAPI budgeting app is hosted on Render. This should be the same URL you use to access the web dashboard in a browser.

**Examples of what it might look like:**
- `https://pharmasight-budgeting-app.onrender.com`
- `https://budgeting-app.onrender.com`
- Or a custom domain if you've set one up

**Important distinction:**
- ❌ **NOT** `https://pharmacy-api-webservice.onrender.com` (that's the external API our FastAPI app proxies to)
- ✅ **YES** The URL of our FastAPI app itself (the one that serves the web dashboard)

**How to find it:**
1. Go to your Render dashboard
2. Find the web service named `pharmasight-budgeting-app` (or similar)
3. Copy the URL shown in the service dashboard
4. It should be something like `https://[service-name].onrender.com`

**Once you provide the URL, I'll update:**
- `mobile/src/config/api.js` - Change `API_BASE_URL` to point to your FastAPI app
- The mobile app will then connect to endpoints like:
  - `/api/mobile/login`
  - `/api/mobile/pharmacies`
  - `/api/days`
  - `/api/mtd`
  - etc.

---

**Please provide the production URL:** `___________________________`

