# Step-by-Step Guide: Deploying PharmaSight Budgeting App to Render

This guide will walk you through deploying your FastAPI application to Render.com.

## Prerequisites

- A GitHub account (or GitLab/Bitbucket)
- Your code pushed to a Git repository
- A Render.com account (free tier available)

---

## Step 1: Prepare Your Repository

### 1.1 Ensure All Files Are Committed

Make sure your code is committed to Git:

```bash
cd /Users/charldewet/Python/BudgetingApp
git status
git add .
git commit -m "Prepare for Render deployment"
```

### 1.2 Push to GitHub

If you haven't already, push your code to GitHub:

```bash
# If you don't have a remote repository yet:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main

# Or if you already have a remote:
git push origin main
```

---

## Step 2: Create a Render Account

1. Go to [https://render.com](https://render.com)
2. Click **"Get Started for Free"** or **"Sign Up"**
3. Sign up using GitHub (recommended) or email
4. Verify your email if required

---

## Step 3: Create a PostgreSQL Database

### 3.1 Create Database Service

1. In the Render dashboard, click **"New +"** button
2. Select **"PostgreSQL"**
3. Configure the database:
   - **Name**: `pharmasight-db` (or your preferred name)
   - **Database**: `pharmacy_reports`
   - **User**: `pharmacy_user` (or your preferred username)
   - **Region**: Choose closest to your users (e.g., `Oregon (US West)`)
   - **PostgreSQL Version**: `16` (or latest stable)
   - **Plan**: Start with **Free** (upgrade later if needed)
4. Click **"Create Database"**

### 3.2 Save Database Connection String

1. Once created, click on your database service
2. Find the **"Internal Database URL"** or **"External Database URL"**
3. Copy this URL - you'll need it in the next step
   - Format: `postgresql://user:password@host:port/database`
   - Example: `postgresql://pharmacy_user:password@dpg-xxxxx-a.oregon-postgres.render.com/pharmacy_reports`

---

## Step 4: Create Web Service

### 4.1 Create New Web Service

1. In Render dashboard, click **"New +"** button
2. Select **"Web Service"**
3. Connect your repository:
   - If using GitHub: Click **"Connect GitHub"** and authorize Render
   - Select your repository from the list
   - Or paste your repository URL

### 4.2 Configure Web Service

Fill in the following details:

**Basic Settings:**
- **Name**: `pharmasight-budgeting-app` (or your preferred name)
- **Region**: Same as your database (e.g., `Oregon (US West)`)
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave empty (or `.` if needed)
- **Runtime**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Plan**: Start with **Free** (upgrade later if needed)

**Environment Variables:**
Click **"Advanced"** → **"Add Environment Variable"** and add:

1. **DATABASE_URL**
   - Value: Paste the database connection string from Step 3.2
   - Important: Add `?sslmode=require` at the end if not present
   - Example: `postgresql://pharmacy_user:password@host/database?sslmode=require`

2. **PHARMA_API_BASE**
   - Value: `https://pharmacy-api-webservice.onrender.com`
   - (Or your actual API base URL)

3. **PHARMA_API_KEY**
   - Value: Your actual API key (keep this secret!)
   - Mark as **"Secret"** if option available

4. **SESSION_SECRET_KEY**
   - Value: Generate a secure random string
   - You can use: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
   - Or use Render's **"Generate"** button if available
   - Mark as **"Secret"**

5. **PYTHON_VERSION** (optional)
   - Value: `3.11.0` (or your preferred Python version)

### 4.3 Create Service

Click **"Create Web Service"**

---

## Step 5: Link Database to Web Service

### 5.1 Connect Database

1. In your web service dashboard, go to **"Environment"** tab
2. Click **"Link Database"** or **"Add Database"**
3. Select your PostgreSQL database from Step 3
4. Render will automatically add the `DATABASE_URL` environment variable

### 5.2 Verify Environment Variables

Make sure all environment variables are set:
- ✅ `DATABASE_URL` (automatically set when linking database)
- ✅ `PHARMA_API_BASE`
- ✅ `PHARMA_API_KEY`
- ✅ `SESSION_SECRET_KEY`

---

## Step 6: Deploy and Monitor

### 6.1 Initial Deployment

Render will automatically start building and deploying your app. You can:

1. Watch the build logs in real-time
2. Check for any errors
3. Wait for deployment to complete (usually 2-5 minutes)

### 6.2 Check Build Logs

If deployment fails, check the logs for:
- Missing dependencies in `requirements.txt`
- Import errors
- Database connection issues
- Port binding issues (should use `$PORT`)

### 6.3 Access Your App

Once deployed:
- Your app will be available at: `https://your-app-name.onrender.com`
- Render provides a free HTTPS certificate automatically
- The URL is shown in your service dashboard

---

## Step 7: Post-Deployment Setup

### 7.1 Initialize Database (if needed)

If you need to run database migrations or setup scripts:

1. Go to your web service dashboard
2. Click **"Shell"** tab (or use **"Manual Deploy"** → **"Run Command"**)
3. Run your setup commands:
   ```bash
   python scripts/create_admin_user.py
   # Or other initialization scripts
   ```

### 7.2 Test Your Application

1. Visit your app URL
2. Test login functionality
3. Test API endpoints
4. Verify database connections

### 7.3 Set Up Custom Domain (Optional)

1. In your web service dashboard, go to **"Settings"**
2. Scroll to **"Custom Domains"**
3. Add your domain
4. Follow DNS configuration instructions

---

## Step 8: Configure Auto-Deploy (Recommended)

### 8.1 Enable Auto-Deploy

1. In your web service dashboard, go to **"Settings"**
2. Under **"Auto-Deploy"**, ensure it's enabled
3. Choose when to deploy:
   - **"On every push"** (recommended for development)
   - **"Manual"** (for production)

---

## Troubleshooting Common Issues

### Issue: Build Fails - "Module not found"

**Solution**: Ensure all dependencies are in `requirements.txt`

```bash
pip freeze > requirements.txt
git add requirements.txt
git commit -m "Update requirements"
git push
```

### Issue: Database Connection Error

**Solution**: 
1. Verify `DATABASE_URL` is set correctly
2. Ensure `?sslmode=require` is in the connection string
3. Check database is running and accessible
4. Verify database credentials

### Issue: Port Already in Use

**Solution**: Make sure your start command uses `$PORT`:
```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Issue: Static Files Not Loading

**Solution**: 
1. Verify static files are in `app/static/`
2. Check FastAPI static mount configuration in `main.py`
3. Ensure file paths are correct

### Issue: Session Not Working

**Solution**:
1. Verify `SESSION_SECRET_KEY` is set
2. Check HTTPS settings (Render uses HTTPS by default)
3. Update `https_only` in SessionMiddleware if needed

---

## Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://user:pass@host/db?sslmode=require` |
| `PHARMA_API_BASE` | External API base URL | Yes | `https://pharmacy-api-webservice.onrender.com` |
| `PHARMA_API_KEY` | API authentication key | Yes | `your-secret-api-key` |
| `SESSION_SECRET_KEY` | Session encryption key | Yes | `generated-secret-key` |
| `PYTHON_VERSION` | Python version | Optional | `3.11.0` |

---

## Upgrading from Free Tier

When ready for production:

1. **Database Plan**:
   - Free: 90 days retention, shared resources
   - Starter: $7/month, 7 days retention, dedicated resources
   - Standard: $20/month, 30 days retention, better performance

2. **Web Service Plan**:
   - Free: Spins down after 15 min inactivity
   - Starter: $7/month, always on
   - Standard: $25/month, better performance

3. **To Upgrade**:
   - Go to service dashboard → **"Settings"** → **"Change Plan"**
   - Select new plan
   - Confirm upgrade

---

## Security Best Practices

1. ✅ Never commit secrets to Git
2. ✅ Use Render's environment variables for all secrets
3. ✅ Enable HTTPS (automatic on Render)
4. ✅ Use strong `SESSION_SECRET_KEY`
5. ✅ Regularly update dependencies
6. ✅ Monitor logs for suspicious activity
7. ✅ Use database connection pooling (already configured)

### ⚠️ Important Security Note

**Before deploying**, check `app/db.py` - it contains a hardcoded database password in `DEFAULT_DATABASE_URL`. 

**Recommended**: Remove the hardcoded credentials and rely solely on the `DATABASE_URL` environment variable. The code already checks for `DATABASE_URL` first, so the default is only a fallback.

To secure it:
1. Set `DATABASE_URL` in Render environment variables (which you'll do anyway)
2. Optionally remove or comment out the hardcoded `DEFAULT_DATABASE_URL` in `app/db.py`
3. Ensure `.gitignore` includes `.env` files (already added)

---

## Monitoring and Logs

### View Logs

1. Go to your service dashboard
2. Click **"Logs"** tab
3. View real-time or historical logs
4. Download logs if needed

### Set Up Alerts

1. Go to **"Settings"** → **"Alerts"**
2. Configure email notifications for:
   - Deployment failures
   - Service downtime
   - High error rates

---

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [FastAPI Deployment Guide](https://fastapi.tiangolo.com/deployment/)
- [PostgreSQL on Render](https://render.com/docs/databases)

---

## Quick Reference Commands

```bash
# Check if app runs locally
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Generate session secret
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Test database connection
python -c "from app.db import engine; print(engine.connect())"

# Update requirements
pip freeze > requirements.txt
```

---

## Support

If you encounter issues:
1. Check Render's status page: https://status.render.com
2. Review Render documentation
3. Check application logs
4. Verify environment variables are set correctly

---

**Congratulations!** Your app should now be live on Render! 🎉

