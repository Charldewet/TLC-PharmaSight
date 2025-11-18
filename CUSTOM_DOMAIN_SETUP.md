# Custom Domain Setup: pharmasight.co.za

This guide will help you configure your Render web service to use your custom domain `pharmasight.co.za`.

## Prerequisites

- Your Render web service is deployed and running
- You have access to your domain registrar (where you purchased pharmasight.co.za)
- DNS management access for pharmasight.co.za

---

## Step 1: Add Custom Domain in Render

1. **Go to your Render Dashboard**
   - Navigate to your web service
   - Click on your service name

2. **Open Settings**
   - Click the **"Settings"** tab
   - Scroll down to **"Custom Domains"** section

3. **Add Domain**
   - Click **"Add Custom Domain"** or **"Add"** button
   - Enter your domain: `pharmasight.co.za`
   - Click **"Save"** or **"Add Domain"**

4. **Render will provide DNS records**
   - After adding, Render will show you DNS records to configure
   - You'll see something like:
     ```
     Type: CNAME
     Name: @ (or pharmasight.co.za)
     Value: your-app-name.onrender.com
     ```
   - **Copy these values** - you'll need them in the next step

---

## Step 2: Configure DNS Records

You need to add DNS records at your domain registrar. The exact steps depend on your registrar, but here's what you need to do:

### Option A: Using CNAME (Recommended)

**If Render provides a CNAME record:**

1. **Log into your domain registrar**
   - Go to where you purchased pharmasight.co.za
   - Common registrars: GoDaddy, Namecheap, Domain.com, etc.

2. **Find DNS Management**
   - Look for: **"DNS Management"**, **"DNS Settings"**, **"Manage DNS"**, or **"Nameservers"**
   - This is usually in your domain settings

3. **Add CNAME Record**
   - Click **"Add Record"** or **"Add DNS Record"**
   - Select record type: **CNAME**
   - **Name/Host**: `@` or `pharmasight.co.za` (or leave blank for root domain)
   - **Value/Target**: `your-app-name.onrender.com` (the value Render provided)
   - **TTL**: `3600` (or default)
   - Click **"Save"** or **"Add Record"**

4. **For www subdomain (Optional but recommended)**
   - Add another CNAME record:
     - **Name/Host**: `www`
     - **Value/Target**: `your-app-name.onrender.com`
     - This allows `www.pharmasight.co.za` to work

### Option B: Using A Record (If CNAME not supported)

**If your registrar doesn't support CNAME for root domain:**

1. **Get Render's IP addresses**
   - Contact Render support or check their documentation
   - Render may provide static IPs for A records

2. **Add A Records**
   - Add multiple A records pointing to Render's IPs
   - This is less flexible than CNAME

**Note**: Most modern registrars support CNAME for root domains (CNAME flattening), so Option A should work.

---

## Step 3: SSL Certificate (Automatic)

Render automatically provisions SSL certificates via Let's Encrypt:

1. **Wait for DNS propagation**
   - DNS changes can take 5 minutes to 48 hours
   - Usually takes 15-60 minutes

2. **Render will detect DNS**
   - Once DNS is configured correctly, Render will automatically:
     - Detect the domain
     - Issue SSL certificate
     - Enable HTTPS

3. **Check status**
   - In Render dashboard → Settings → Custom Domains
   - You'll see status: **"Valid"** with a green checkmark when ready
   - Status: **"Pending"** means waiting for DNS/SSL

---

## Step 4: Verify Configuration

### Check DNS Propagation

Use these tools to verify DNS is configured:

1. **Online DNS Checker**
   - Visit: https://dnschecker.org
   - Enter: `pharmasight.co.za`
   - Select record type: `CNAME`
   - Check if it resolves to your Render URL

2. **Command Line**
   ```bash
   # Check CNAME record
   dig pharmasight.co.za CNAME
   
   # Or use nslookup
   nslookup pharmasight.co.za
   ```

### Test Your Domain

Once DNS propagates and SSL is issued:

1. **Visit your domain**
   - Go to: `https://pharmasight.co.za`
   - Should load your application

2. **Check HTTPS**
   - Ensure the padlock icon appears
   - Certificate should be valid

---

## Step 5: Update Application Configuration (If Needed)

### Update Session Middleware for HTTPS

If you're using HTTPS (which you should), update your session middleware:

In `app/main.py`, you may want to ensure HTTPS is enforced:

```python
app.add_middleware(
    SessionMiddleware, 
    secret_key=SESSION_SECRET, 
    max_age=60 * 60 * 12, 
    https_only=True,  # Set to True for production with custom domain
    same_site="lax"
)
```

**Note**: Render automatically handles HTTPS, so this is optional but recommended for security.

---

## Common Issues and Solutions

### Issue: Domain shows "Pending" status

**Solutions:**
1. Wait longer - DNS can take up to 48 hours (usually 15-60 min)
2. Verify DNS records are correct
3. Check DNS propagation with dnschecker.org
4. Ensure CNAME value matches exactly what Render provided

### Issue: SSL certificate not issued

**Solutions:**
1. Ensure DNS is properly configured
2. Wait for DNS propagation to complete
3. Check that port 80 and 443 are accessible
4. Contact Render support if it takes more than 24 hours

### Issue: Domain resolves but shows Render error page

**Solutions:**
1. Verify your web service is running
2. Check that the domain is correctly linked to your service
3. Ensure your app is listening on the correct port (`$PORT`)

### Issue: www subdomain not working

**Solutions:**
1. Add a CNAME record for `www` pointing to your Render URL
2. Or configure redirect in Render (if available)
3. Or handle in your application code

---

## DNS Configuration Examples by Registrar

### GoDaddy

1. Log in → My Products → DNS
2. Click "Add" under Records
3. Type: `CNAME`
4. Name: `@`
5. Value: `your-app.onrender.com`
6. TTL: `600 seconds`
7. Save

### Namecheap

1. Log in → Domain List → Manage → Advanced DNS
2. Add New Record
3. Type: `CNAME Record`
4. Host: `@`
5. Value: `your-app.onrender.com`
6. TTL: Automatic
7. Save

### Cloudflare

1. Log in → Select domain → DNS
2. Add record
3. Type: `CNAME`
4. Name: `@` (or `pharmasight.co.za`)
5. Target: `your-app.onrender.com`
6. Proxy status: Can be "Proxied" (orange cloud) or "DNS only" (grey cloud)
7. Save

**Note**: If using Cloudflare proxy, ensure Render allows Cloudflare IPs.

---

## Redirect www to Non-www (Optional)

If you want `www.pharmasight.co.za` to redirect to `pharmasight.co.za`:

### Option 1: Render Configuration
- Some Render plans support redirects in dashboard
- Check Settings → Custom Domains → Redirects

### Option 2: Application Code
Add redirect middleware in your FastAPI app:

```python
from fastapi import Request
from fastapi.responses import RedirectResponse

@app.middleware("http")
async def redirect_www(request: Request, call_next):
    if request.url.hostname and request.url.hostname.startswith("www."):
        non_www = str(request.url).replace("www.", "", 1)
        return RedirectResponse(url=non_www, status_code=301)
    return await call_next(request)
```

---

## Security Best Practices

1. ✅ **Always use HTTPS** - Render provides this automatically
2. ✅ **Set `https_only=True`** in session middleware for production
3. ✅ **Use strong `SESSION_SECRET_KEY`** - Already configured
4. ✅ **Keep DNS records secure** - Don't expose in public repos
5. ✅ **Monitor SSL certificate expiration** - Render auto-renews, but good to monitor

---

## Testing Checklist

- [ ] Domain added in Render dashboard
- [ ] DNS records configured at registrar
- [ ] DNS propagated (checked with dnschecker.org)
- [ ] SSL certificate issued (green checkmark in Render)
- [ ] `https://pharmasight.co.za` loads correctly
- [ ] HTTPS padlock shows in browser
- [ ] Application functionality works
- [ ] Session/cookies work correctly
- [ ] API endpoints accessible

---

## Support

If you encounter issues:

1. **Render Support**
   - Check Render docs: https://render.com/docs/custom-domains
   - Contact Render support through dashboard

2. **DNS Issues**
   - Contact your domain registrar support
   - Verify DNS records are correct

3. **SSL Issues**
   - Wait for DNS propagation
   - Check Render dashboard for SSL status
   - Contact Render support if stuck

---

## Quick Reference

**Domain**: `pharmasight.co.za`

**DNS Record Type**: CNAME

**DNS Value**: `your-app-name.onrender.com` (get exact value from Render dashboard)

**SSL**: Automatic via Let's Encrypt

**HTTPS**: Enabled automatically

---

**Once configured, your app will be accessible at:**
- `https://pharmasight.co.za`
- `https://www.pharmasight.co.za` (if configured)

🎉 **Congratulations!** Your custom domain will be live once DNS propagates!

