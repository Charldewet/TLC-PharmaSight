# Render Deployment Checklist

Use this checklist to ensure a smooth deployment.

## Pre-Deployment

- [ ] Code is committed to Git
- [ ] Code is pushed to GitHub/GitLab/Bitbucket
- [ ] `requirements.txt` is up to date (run `pip freeze > requirements.txt`)
- [ ] `.gitignore` is configured (prevents committing secrets)
- [ ] `Procfile` exists in root directory
- [ ] All environment variables are documented
- [ ] Database credentials are NOT hardcoded (use environment variables)

## Render Setup

- [ ] Render account created
- [ ] PostgreSQL database created
- [ ] Database connection string copied
- [ ] Web service created
- [ ] Repository connected to Render

## Environment Variables

- [ ] `DATABASE_URL` - Set from PostgreSQL service (auto-linked)
- [ ] `PHARMA_API_BASE` - Set to your API URL
- [ ] `PHARMA_API_KEY` - Set to your API key (marked as secret)
- [ ] `SESSION_SECRET_KEY` - Generated secure key (marked as secret)
- [ ] `PYTHON_VERSION` - Set to `3.11.0` (optional)

## Configuration

- [ ] Build command: `pip install -r requirements.txt`
- [ ] Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- [ ] Region selected (same for database and web service)
- [ ] Auto-deploy enabled (if desired)

## Post-Deployment

- [ ] Build completed successfully
- [ ] Application accessible at provided URL
- [ ] Login functionality works
- [ ] Database connections working
- [ ] Static files loading correctly
- [ ] API endpoints responding
- [ ] No errors in logs

## Security

- [ ] No secrets in code
- [ ] Environment variables marked as secrets where appropriate
- [ ] HTTPS enabled (automatic on Render)
- [ ] Database uses SSL (`?sslmode=require`)

## Testing

- [ ] Test user login
- [ ] Test admin functions (if applicable)
- [ ] Test API endpoints
- [ ] Test database queries
- [ ] Test file uploads/downloads (if applicable)
- [ ] Test on mobile devices

## Monitoring

- [ ] Logs accessible and readable
- [ ] Alerts configured (optional)
- [ ] Performance acceptable
- [ ] No memory leaks or issues

---

## Quick Commands Reference

```bash
# Generate session secret
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Update requirements
pip freeze > requirements.txt

# Test locally
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Check Git status
git status

# Commit changes
git add .
git commit -m "Your message"
git push
```

---

**Ready to deploy?** Follow the detailed guide in `RENDER_DEPLOYMENT_GUIDE.md`

