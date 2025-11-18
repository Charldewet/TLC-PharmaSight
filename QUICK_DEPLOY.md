# Quick Deploy Guide - Web Service Only

Since you already have your databases set up, follow these steps to create just the web service.

## Step 1: Create Web Service on Render

1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** button (top right)
3. Select **"Web Service"**

## Step 2: Connect Your Repository

1. Click **"Connect GitHub"** (or GitLab/Bitbucket if you prefer)
2. Authorize Render to access your repositories
3. Find and select: **`Charldewet/TLC-PharmaSight`**
4. Click **"Connect"**

## Step 3: Configure Web Service

Fill in these settings:

### Basic Settings:
- **Name**: `pharmasight-budgeting-app` (or your preferred name)
- **Region**: Same region as your existing database
- **Branch**: `main`
- **Root Directory**: Leave empty
- **Runtime**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Plan**: Choose your plan (Free, Starter, or Standard)

### Environment Variables:
Click **"Advanced"** → **"Add Environment Variable"** and add:

1. **DATABASE_URL**
   - Click **"Link Database"** or **"Add Database"**
   - Select your existing PostgreSQL database
   - Render will automatically set this variable
   - ✅ Verify it includes `?sslmode=require` at the end

2. **PHARMA_API_BASE**
   - Value: `https://pharmacy-api-webservice.onrender.com`
   - (Or your actual API base URL)

3. **PHARMA_API_KEY**
   - Value: Your actual API key
   - Mark as **"Secret"** if option available

4. **SESSION_SECRET_KEY**
   - Generate a secure key:
     ```bash
     python -c "import secrets; print(secrets.token_urlsafe(32))"
     ```
   - Or use Render's **"Generate"** button if available
   - Mark as **"Secret"**

5. **PYTHON_VERSION** (optional)
   - Value: `3.11.0` (or your preferred version)

## Step 4: Create and Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Clone your repository
   - Install dependencies from `requirements.txt`
   - Build your application
   - Start the service
3. Watch the build logs for any errors
4. Wait for deployment to complete (usually 2-5 minutes)

## Step 5: Verify Deployment

Once deployed:
- Your app will be available at: `https://your-app-name.onrender.com`
- Check the **"Logs"** tab to ensure no errors
- Test your application:
  - Visit the URL
  - Test login functionality
  - Verify database connections work
  - Test API endpoints

## Troubleshooting

### Build Fails
- Check build logs for missing dependencies
- Verify `requirements.txt` is up to date
- Ensure Python version is compatible

### Database Connection Error
- Verify `DATABASE_URL` is set correctly
- Check database is running and accessible
- Ensure `?sslmode=require` is in connection string
- Verify database credentials

### Port Error
- Ensure start command uses `$PORT` variable
- Command should be: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Static Files Not Loading
- Verify static files are in `app/static/`
- Check FastAPI static mount in `main.py`

## Quick Reference

**Repository**: https://github.com/Charldewet/TLC-PharmaSight

**Required Environment Variables**:
- `DATABASE_URL` (linked from existing database)
- `PHARMA_API_BASE`
- `PHARMA_API_KEY`
- `SESSION_SECRET_KEY`

**Build Command**: `pip install -r requirements.txt`

**Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

---

That's it! Your web service should be live in a few minutes. 🚀

