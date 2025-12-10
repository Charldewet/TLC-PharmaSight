from fastapi import FastAPI, Request, Form, HTTPException, Query
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy import text
import httpx
import os
from dotenv import load_dotenv
from urllib.parse import quote
from datetime import date, datetime
from calendar import monthrange
import csv
import io
from .db import engine

# Load environment variables
load_dotenv()

app = FastAPI(title="BudgetingApp")

# CORS middleware for mobile app support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your mobile app's origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Config
API_BASE_URL = os.getenv("PHARMA_API_BASE", "https://pharmacy-api-webservice.onrender.com")
API_KEY = os.getenv("PHARMA_API_KEY", "")
SESSION_SECRET = os.getenv("SESSION_SECRET_KEY", "change-me")

# Session middleware
# https_only should be True in production with custom domain for security
# Set to False for local development or if Render doesn't handle HTTPS properly
HTTPS_ONLY = os.getenv("HTTPS_ONLY", "true").lower() == "true"
app.add_middleware(
    SessionMiddleware, 
    secret_key=SESSION_SECRET, 
    max_age=60 * 60 * 12, 
    https_only=HTTPS_ONLY,
    same_site="lax"
)

# Static files and templates
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")


def _auth_headers(request: Request) -> dict:
    """
    Default auth headers for standard (non-admin) proxy calls.
    These endpoints were originally implemented against the shared API key,
    so we continue to prefer that key for compatibility. If the key is not
    configured, we fall back to the signed-in user's auth token.
    """
    if API_KEY:
        return {"Authorization": f"Bearer {API_KEY}"}
    bearer = request.session.get("auth_token")
    return {"Authorization": f"Bearer {bearer}"} if bearer else {}


@app.get("/", response_class=HTMLResponse)
@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request, "title": "Sign in", "error": None})


@app.post("/login")
async def do_login(request: Request, username: str = Form(...), password: str = Form(...)):
    auth_url = f"{API_BASE_URL}/auth/login"
    headers = {"Authorization": f"Bearer {API_KEY}"} if API_KEY else {}
    payload = {"username": username, "password": password}

    print(f"[DEBUG] Login attempt - Username: {username}")
    
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(auth_url, json=payload, headers=headers)

    print(f"[DEBUG] Login response status: {resp.status_code}")
    if resp.status_code != 200:
        error_detail = ""
        try:
            error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            error_detail = error_data.get("detail", error_data.get("message", ""))
            print(f"[DEBUG] Login error detail: {error_detail}")
            print(f"[DEBUG] Full error response: {resp.text[:500]}")
        except:
            print(f"[DEBUG] Could not parse error response: {resp.text[:500]}")
        
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "title": "Sign in", "error": error_detail or "Invalid username or password"},
            status_code=401,
        )

    data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
    token = data.get("token") or data.get("access_token") or data.get("api_key")
    canonical_username = data.get("username") or data.get("user", {}).get("username") or username
    user_id = data.get("user_id") or data.get("user", {}).get("user_id") or data.get("id")

    if token:
        request.session["auth_token"] = token
    # Store canonical username as-is
    request.session["username"] = str(canonical_username or username).strip()
    
    # If user_id not in login response, try to fetch it from the users endpoint
    if not user_id and token:
        try:
            path_username = quote(str(canonical_username or username).strip(), safe="")
            user_info_url = f"{API_BASE_URL}/users/{path_username}/pharmacies"
            auth_headers = {"Authorization": f"Bearer {token}"}
            async with httpx.AsyncClient(timeout=15) as client:
                user_resp = await client.get(user_info_url, headers=auth_headers)
                if user_resp.status_code == 200:
                    user_data = user_resp.json() or {}
                    # Try to get user_id from user data
                    user_id = user_data.get("user_id") or user_data.get("id")
        except Exception as e:
            print(f"[WARNING] Failed to fetch user_id after login: {e}")
    
    # Store user_id if available
    if user_id:
        try:
            request.session["user_id"] = int(user_id)
        except (ValueError, TypeError):
            print(f"[WARNING] Invalid user_id format: {user_id}")
    
    # Debug: Print session info
    print(f"[DEBUG] Login - Username: {request.session.get('username')}, User ID: {request.session.get('user_id')}")

    return RedirectResponse(url="/dashboard", status_code=303)


@app.post("/api/mobile/login")
async def mobile_login(username: str = Form(...), password: str = Form(...)):
    """Mobile-friendly login endpoint that returns a token in JSON format"""
    auth_url = f"{API_BASE_URL}/auth/login"
    headers = {"Authorization": f"Bearer {API_KEY}"} if API_KEY else {}
    payload = {"username": username, "password": password}

    print(f"[DEBUG] Mobile login attempt - Username: {username}")
    
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(auth_url, json=payload, headers=headers)

    print(f"[DEBUG] Mobile login response status: {resp.status_code}")
    if resp.status_code != 200:
        error_detail = ""
        try:
            error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            error_detail = error_data.get("detail", error_data.get("message", ""))
        except:
            error_detail = "Invalid username or password"
        
        raise HTTPException(status_code=401, detail=error_detail or "Invalid username or password")

    data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
    token = data.get("token") or data.get("access_token") or data.get("api_key")
    canonical_username = data.get("username") or data.get("user", {}).get("username") or username
    user_id = data.get("user_id") or data.get("user", {}).get("user_id") or data.get("id")
    
    # If user_id not in login response, try to fetch it from the users endpoint
    if not user_id and token:
        try:
            path_username = quote(str(canonical_username or username).strip(), safe="")
            user_info_url = f"{API_BASE_URL}/users/{path_username}/pharmacies"
            auth_headers = {"Authorization": f"Bearer {token}"}
            async with httpx.AsyncClient(timeout=15) as client:
                user_resp = await client.get(user_info_url, headers=auth_headers)
                if user_resp.status_code == 200:
                    user_data = user_resp.json() or {}
                    # Try to get user_id from user data
                    user_id = user_data.get("user_id") or user_data.get("id")
        except Exception as e:
            print(f"[WARNING] Failed to fetch user_id after mobile login: {e}")
    
    # Return token for mobile app
    return JSONResponse({
        "token": token,
        "username": str(canonical_username or username).strip(),
        "user_id": int(user_id) if user_id else None
    })


@app.get("/api/mobile/pharmacies")
async def mobile_get_pharmacies(request: Request, username: str = Query(...)) -> JSONResponse:
    """Mobile-friendly endpoint to get user's pharmacies"""
    # Get token from Authorization header (mobile apps send this)
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    
    # Use canonical username exactly as stored; URL-encode for safety
    path_username = quote(str(username).strip(), safe="")
    url = f"{API_BASE_URL}/users/{path_username}/pharmacies"

    pharmacies = []
    error_message = None
    async with httpx.AsyncClient(timeout=30.0) as client:
        candidate_headers = []
        if token:
            candidate_headers.append({"Authorization": f"Bearer {token}"})
        if API_KEY:
            candidate_headers.append({"Authorization": f"Bearer {API_KEY}"})
            candidate_headers.append({"X-API-Key": API_KEY})

        for headers in candidate_headers:
            try:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    payload = resp.json() or {}
                    pharmacies = payload.get("pharmacies", [])
                    # Sort pharmacies so "TLC GROUP" always appears last
                    pharmacies.sort(key=lambda p: (
                        p.get("pharmacy_name") or p.get("name") or ""
                    ).upper() == "TLC GROUP")
                    break
            except httpx.TimeoutException:
                error_message = "Request to pharmacy API timed out"
                break
            except httpx.RequestError as e:
                error_message = f"Request error: {str(e)}"
                break
            except Exception as e:
                error_message = f"Unexpected error: {str(e)}"
                continue

    if error_message and not pharmacies:
        raise HTTPException(status_code=503, detail=error_message)
    
    return JSONResponse({"pharmacies": pharmacies})


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    username = request.session.get("username")
    if not username:
        return RedirectResponse(url="/login", status_code=303)

    # Use canonical username exactly as stored; URL-encode for safety
    path_username = quote(str(username).strip(), safe="")

    user_token = request.session.get("auth_token")
    api_key = API_KEY or ""
    preferred_token = user_token or api_key
    url = f"{API_BASE_URL}/users/{path_username}/pharmacies"

    pharmacies = []
    fetch_error = None
    async with httpx.AsyncClient(timeout=15) as client:
        candidate_headers = []
        if preferred_token:
            candidate_headers.append({"Authorization": f"Bearer {preferred_token}"})
        # If the first attempt used the user token and we also have an API key, queue it next
        if user_token and api_key:
            candidate_headers.append({"Authorization": f"Bearer {api_key}"})
        # Final fallback to X-API-Key for backward compatibility
        if api_key:
            candidate_headers.append({"X-API-Key": api_key})

        for headers in candidate_headers:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                payload = resp.json() or {}
                pharmacies = payload.get("pharmacies", [])
                # Sort pharmacies so "TLC GROUP" always appears last
                pharmacies.sort(key=lambda p: (
                    p.get("pharmacy_name") or p.get("name") or ""
                ).upper() == "TLC GROUP")
                fetch_error = None
                break
            fetch_error = f"Failed to load pharmacies (status {resp.status_code})"

    user_id = request.session.get("user_id")
    # Check if user is admin (Charl user_id: 2, Amin user_id: 9, or username is "admin"/"charl"/"amin")
    is_admin = user_id in [2, 9] or (username and username.lower() in ["charl", "admin", "amin"])

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "title": "Dashboard",
            "username": username,
            "user_id": user_id,
            "is_charl": is_admin,  # Keep variable name for backwards compatibility
            "pharmacies": pharmacies,
            "error": fetch_error,
        },
    )


@app.get("/api/days")
async def api_days(request: Request, pid: int, month: str) -> JSONResponse:
    # month expected YYYY-MM
    try:
        year, mon = [int(x) for x in month.split("-")]
        last_day = monthrange(year, mon)[1]
        from_date = date(year, mon, 1).isoformat()
        to_date = date(year, mon, last_day).isoformat()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid month format; expected YYYY-MM")

    headers = _auth_headers(request)
    async with httpx.AsyncClient(timeout=20) as client:
        url = f"{API_BASE_URL}/pharmacies/{pid}/days?from={from_date}&to={to_date}"
        resp = await client.get(url, headers=headers)
        if resp.status_code == 401 and API_KEY:
            # Retry with X-API-Key if bearer rejected
            resp = await client.get(url, headers={"X-API-Key": API_KEY})

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch daily turnovers")

    return JSONResponse(resp.json())


# Targets storage removed - now using backend API

@app.get("/api/best-sellers")
async def api_best_sellers(request: Request, pid: int, date: str = None, from_date: str = None, to_date: str = None, limit: int = 20) -> JSONResponse:
    """Get top best selling products for a pharmacy - supports both single date and date range"""
    headers = _auth_headers(request)
    async with httpx.AsyncClient(timeout=20) as client:
        # Use range endpoint if from_date and to_date are provided, otherwise use single date
        if from_date and to_date:
            url = f"{API_BASE_URL}/pharmacies/{pid}/stock-activity/by-quantity/range?from={from_date}&to={to_date}&limit={limit}"
        elif date:
            url = f"{API_BASE_URL}/pharmacies/{pid}/stock-activity/by-quantity?date={date}&limit={limit}"
        else:
            raise HTTPException(status_code=400, detail="Either 'date' or both 'from_date' and 'to_date' must be provided")
        
        resp = await client.get(url, headers=headers)
        if resp.status_code == 401 and API_KEY:
            # Retry with X-API-Key if bearer rejected
            resp = await client.get(url, headers={"X-API-Key": API_KEY})
    
    if resp.status_code != 200:
        # Return empty data if endpoint fails
        return JSONResponse({
            "pharmacy_id": pid,
            "date": date or f"{from_date} to {to_date}",
            "best_sellers": []
        })
    
    # Wrap the response in our expected format
    data = resp.json()
    if isinstance(data, list):
        return JSONResponse({
            "pharmacy_id": pid,
            "date": date or f"{from_date} to {to_date}",
            "best_sellers": data
        })
    
    return JSONResponse(data)


@app.get("/api/worst-gp")
async def api_worst_gp(request: Request, pid: int, date: str = None, from_date: str = None, to_date: str = None, limit: int = 100, threshold: int = 20, exclude_pdst: bool = False) -> JSONResponse:
    """Get products with worst GP% for a pharmacy - supports both single date and date range
    
    Note: Frontend filters out PDST and KSAA products and applies GP% threshold filtering.
    Default limit set to 100 to support threshold-based filtering while maintaining API performance.
    """
    headers = _auth_headers(request)
    async with httpx.AsyncClient(timeout=30) as client:
        # Use range endpoint if from_date and to_date are provided, otherwise use single date
        if from_date and to_date:
            url = f"{API_BASE_URL}/pharmacies/{pid}/stock-activity/low-gp/range?from={from_date}&to={to_date}&threshold={threshold}&limit={limit}"
            if exclude_pdst:
                url += "&exclude_pdst=true"
            resp = await client.get(url, headers=headers)
        elif date:
            # Try primary endpoint first
            url = f"{API_BASE_URL}/pharmacies/{pid}/stock-activity/worst-gp?date={date}&limit={limit}"
            resp = await client.get(url, headers=headers)
            
            # If primary endpoint fails, try alternative endpoint
            if resp.status_code != 200:
                url = f"{API_BASE_URL}/pharmacies/{pid}/stock-activity/low_gp_products?date={date}&threshold={threshold}"
                if exclude_pdst:
                    url += "&exclude_pdst=true"
                resp = await client.get(url, headers=headers)
        else:
            raise HTTPException(status_code=400, detail="Either 'date' or both 'from_date' and 'to_date' must be provided")
            
        if resp.status_code == 401 and API_KEY:
            # Retry with X-API-Key if bearer rejected
            resp = await client.get(url, headers={"X-API-Key": API_KEY})
    
    if resp.status_code != 200:
        # Log error details
        print(f"[ERROR] Worst GP API failed with status {resp.status_code}")
        print(f"[ERROR] Response: {resp.text}")
        
        # Return empty data if endpoint fails
        return JSONResponse({
            "pharmacy_id": pid,
            "date": date or f"{from_date} to {to_date}",
            "worst_gp_products": [],
            "error": f"API returned status {resp.status_code}"
        })
    
    # Wrap the response in our expected format
    data = resp.json()
    
    # Enhanced debug logging
    print(f"\n{'='*80}")
    print(f"[DEBUG] Worst GP API Call")
    print(f"[DEBUG] URL: {url}")
    print(f"[DEBUG] Status Code: {resp.status_code}")
    print(f"[DEBUG] Headers Sent: {headers}")
    print(f"[DEBUG] Response Type: {type(data)}")
    if isinstance(data, dict):
        print(f"[DEBUG] Response Keys: {list(data.keys())}")
        if "items" in data:
            print(f"[DEBUG] Items Count: {len(data['items'])}")
            if len(data['items']) > 0:
                print(f"[DEBUG] First Item: {data['items'][0]}")
        else:
            print(f"[DEBUG] Full Response: {data}")
    else:
        print(f"[DEBUG] Response is list with {len(data)} items")
    print(f"{'='*80}\n")
    
    # Handle different response formats:
    # 1. Range endpoint returns: {"items": [...]}
    # 2. Single date endpoint returns: [...] (array)
    # 3. Some endpoints return: {"worst_gp_products": [...]} or {"low_gp_products": [...]}
    
    if isinstance(data, dict) and "items" in data:
        # Range endpoint format - transform to our standard format
        return JSONResponse({
            "pharmacy_id": pid,
            "date": date or f"{from_date} to {to_date}",
            "worst_gp_products": data["items"][:limit]
        })
    elif isinstance(data, list):
        # Array format from single date endpoint
        return JSONResponse({
            "pharmacy_id": pid,
            "date": date or f"{from_date} to {to_date}",
            "worst_gp_products": data[:limit]
        })
    
    # Return as-is if already in expected format
    return JSONResponse(data)


@app.get("/api/mtd")
async def api_mtd(request: Request, pid: int, month: str, through: str) -> JSONResponse:
    """Get month-to-date aggregated data for a pharmacy
    
    Args:
        pid: Pharmacy ID
        month: Month in YYYY-MM format
        through: Date to aggregate through in YYYY-MM-DD format
    """
    headers = _auth_headers(request)
    async with httpx.AsyncClient(timeout=20) as client:
        url = f"{API_BASE_URL}/pharmacies/{pid}/mtd?month={month}&through={through}"
        resp = await client.get(url, headers=headers)
        if resp.status_code == 401 and API_KEY:
            # Retry with X-API-Key if bearer rejected
            resp = await client.get(url, headers={"X-API-Key": API_KEY})
    
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch MTD data")
    
    return JSONResponse(resp.json())


@app.get("/api/pharmacies/{pharmacy_id}/days/{date}/gp-breakdown")
async def api_gp_breakdown(request: Request, pharmacy_id: int, date: str) -> JSONResponse:
    """Get GP breakdown (dispensary and frontshop) for a pharmacy on a specific date
    
    Args:
        pharmacy_id: Pharmacy ID
        date: Date in YYYY-MM-DD format
    """
    headers = _auth_headers(request)
    async with httpx.AsyncClient(timeout=20) as client:
        url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/days/{date}/gp-breakdown"
        print(f"[DEBUG] GP Breakdown API Call (Single Date) - URL: {url}")
        resp = await client.get(url, headers=headers)
        if resp.status_code == 401 and API_KEY:
            # Retry with X-API-Key if bearer rejected
            resp = await client.get(url, headers={"X-API-Key": API_KEY})
        
        print(f"[DEBUG] GP Breakdown API Response - Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"[DEBUG] GP Breakdown API Error - Status: {resp.status_code}, Response: {resp.text[:200]}")
            # Return empty breakdown instead of raising exception
            return JSONResponse({
                "dispensary": {"gp_percentage": 0},
                "frontshop": {"gp_percentage": 0},
                "error": f"API returned status {resp.status_code}"
            })
        
        data = resp.json()
        print(f"[DEBUG] GP Breakdown API Data: {data}")
        return JSONResponse(data)


@app.get("/api/pharmacies/{pharmacy_id}/days/gp-breakdown")
async def api_gp_breakdown_range(request: Request, pharmacy_id: int, from_date: str = Query(..., alias="from"), to_date: str = Query(..., alias="to")) -> JSONResponse:
    """Get GP breakdown (dispensary and frontshop) for a pharmacy across a date range
    
    Args:
        pharmacy_id: Pharmacy ID
        from_date: Start date in YYYY-MM-DD format (query param: from)
        to_date: End date in YYYY-MM-DD format (query param: to)
    """
    headers = _auth_headers(request)
    async with httpx.AsyncClient(timeout=20) as client:
        url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/days/gp-breakdown?from={from_date}&to={to_date}"
        print(f"[DEBUG] GP Breakdown API Call (Date Range) - URL: {url}")
        resp = await client.get(url, headers=headers)
        if resp.status_code == 401 and API_KEY:
            # Retry with X-API-Key if bearer rejected
            resp = await client.get(url, headers={"X-API-Key": API_KEY})
        
        print(f"[DEBUG] GP Breakdown API Response - Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"[DEBUG] GP Breakdown API Error - Status: {resp.status_code}, Response: {resp.text[:200]}")
            # Return empty breakdown instead of raising exception
            return JSONResponse({
                "dispensary": {"gp_percentage": 0},
                "frontshop": {"gp_percentage": 0},
                "error": f"API returned status {resp.status_code}"
            })
        
        data = resp.json()
        print(f"[DEBUG] GP Breakdown API Data: {data}")
        return JSONResponse(data)


@app.get("/api/stock-value")
async def api_stock_value(request: Request, pid: int, date: str = None) -> JSONResponse:
    """Get stock value (closing_stock) for a pharmacy from /days endpoint
    
    Args:
        pid: Pharmacy ID
        date: Date in YYYY-MM-DD format (defaults to yesterday)
    
    Returns:
        JSON with current_stock_value, opening_stock_value, and stock_change
    """
    headers = _auth_headers(request)
    
    # Use provided date or default to yesterday
    if not date:
        from datetime import datetime, timedelta
        yesterday = datetime.now() - timedelta(days=1)
        date = yesterday.strftime('%Y-%m-%d')
    
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            # Get current day's closing stock
            url = f"{API_BASE_URL}/pharmacies/{pid}/days?from={date}&to={date}"
            resp = await client.get(url, headers=headers)
            
            if resp.status_code == 401 and API_KEY:
                resp = await client.get(url, headers={"X-API-Key": API_KEY})
            
            current_stock_value = 0
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and len(data) > 0:
                    sales_record = data[0]
                    current_stock_value = float(sales_record.get("closing_stock", 0) or 0)
            
            # Get previous day's closing stock (becomes opening stock)
            from datetime import datetime, timedelta
            date_obj = datetime.strptime(date, '%Y-%m-%d')
            prev_day = date_obj - timedelta(days=1)
            prev_date = prev_day.strftime('%Y-%m-%d')
            
            prev_url = f"{API_BASE_URL}/pharmacies/{pid}/days?from={prev_date}&to={prev_date}"
            prev_resp = await client.get(prev_url, headers=headers)
            
            if prev_resp.status_code == 401 and API_KEY:
                prev_resp = await client.get(prev_url, headers={"X-API-Key": API_KEY})
            
            opening_stock_value = 0
            if prev_resp.status_code == 200:
                prev_data = prev_resp.json()
                if isinstance(prev_data, list) and len(prev_data) > 0:
                    prev_record = prev_data[0]
                    opening_stock_value = float(prev_record.get("closing_stock", 0) or 0)
            
            # Calculate change
            stock_change = current_stock_value - opening_stock_value
            
            return JSONResponse({
                "pharmacy_id": pid,
                "date": date,
                "current_stock_value": current_stock_value,
                "opening_stock_value": opening_stock_value,
                "stock_change": stock_change,
                "stock_change_percent": (stock_change / opening_stock_value * 100) if opening_stock_value > 0 else 0
            })
            
        except Exception as e:
            print(f"[ERROR] Failed to fetch stock value: {e}")
            return JSONResponse({
                "pharmacy_id": pid,
                "date": date,
                "current_stock_value": 0,
                "opening_stock_value": 0,
                "stock_change": 0,
                "stock_change_percent": 0
            })


@app.get("/api/targets")
async def api_get_targets(request: Request, pid: int, month: str) -> JSONResponse:
    """Proxy endpoint to get targets for a pharmacy and month from backend API"""
    # Use user's auth token (same as admin endpoints)
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    print(f"[DEBUG] GET /api/targets - pharmacy_id: {pid}, month: {month}")
    print(f"[DEBUG] Using bearer token: {bearer[:20] if bearer else 'None'}...")
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/pharmacies/{pid}/targets?month={month}"
        resp = await client.get(url, headers=headers)
        
        print(f"[DEBUG] Backend response status: {resp.status_code}")
        if resp.status_code == 401:
            print(f"[DEBUG] Bearer token failed, trying X-API-Key...")
            # Retry with X-API-Key if bearer rejected
            alt_headers = {"X-API-Key": API_KEY} if API_KEY else {}
            resp = await client.get(url, headers=alt_headers)
            print(f"[DEBUG] X-API-Key response status: {resp.status_code}")
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch targets")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        print(f"[DEBUG] Error detail: {error_detail}")
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())

@app.post("/api/targets")
async def api_save_targets(request: Request, pid: int, month: str) -> JSONResponse:
    """Proxy endpoint to save/update targets for a pharmacy and month via backend API"""
    # Use user's auth token (same as admin endpoints)
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"} if bearer else {"Content-Type": "application/json"}
    
    print(f"[DEBUG] POST /api/targets - pharmacy_id: {pid}, month: {month}")
    print(f"[DEBUG] Using bearer token: {bearer[:20] if bearer else 'None'}...")
    
    try:
        targets_data = await request.json()
        print(f"[DEBUG] Targets data: {list(targets_data.keys())[:5]}... ({len(targets_data)} dates)")
        
        if not targets_data or len(targets_data) == 0:
            raise HTTPException(status_code=400, detail="No targets provided")
        
        async with httpx.AsyncClient(timeout=15) as client:
            url = f"{API_BASE_URL}/admin/pharmacies/{pid}/targets?month={month}"
            resp = await client.post(url, json=targets_data, headers=headers)
            
            print(f"[DEBUG] Backend response status: {resp.status_code}")
            if resp.status_code == 401:
                print(f"[DEBUG] Bearer token failed, trying X-API-Key...")
                # Retry with X-API-Key if bearer rejected
                alt_headers = {"X-API-Key": API_KEY, "Content-Type": "application/json"} if API_KEY else {"Content-Type": "application/json"}
                resp = await client.post(url, json=targets_data, headers=alt_headers)
                print(f"[DEBUG] X-API-Key response status: {resp.status_code}")
        
        if resp.status_code != 200:
            error_detail = (
                resp.json().get("detail", "Failed to save targets")
                if resp.headers.get("content-type", "").startswith("application/json")
                else f"Backend returned {resp.status_code}"
            )
            print(f"[DEBUG] Error detail: {error_detail}")
            print(f"[DEBUG] Full error response: {resp.text[:500]}")
            
            # Provide user-friendly error messages
            if resp.status_code == 403:
                if "write access" in error_detail.lower() or "Write access" in error_detail:
                    error_detail = f"You do not have write access to pharmacy {pid}. Please contact an administrator to grant write access."
                else:
                    error_detail = f"Access denied: {error_detail}"
            elif resp.status_code == 401:
                error_detail = "Authentication failed. Please log in again."
            
            raise HTTPException(status_code=resp.status_code, detail=error_detail)
        
        return JSONResponse(resp.json())
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DEBUG] Exception in save_targets: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid request data: {str(e)}")


@app.get("/api/products/search")
async def api_products_search(request: Request, query: str = "", page: int = 1, page_size: int = 200) -> JSONResponse:
    """Search for products by name or code"""
    headers = _auth_headers(request)
    
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            url = f"{API_BASE_URL}/products/search?query={quote(query)}&page={page}&page_size={page_size}"
            resp = await client.get(url, headers=headers)
            
            if resp.status_code == 401 and API_KEY:
                resp = await client.get(url, headers={"X-API-Key": API_KEY})
            
            if resp.status_code == 200:
                data = resp.json()
                return JSONResponse(data)
            else:
                return JSONResponse({"error": f"Failed to fetch products: {resp.status_code}"}, status_code=resp.status_code)
        except Exception as e:
            print(f"[ERROR] Failed to search products: {e}")
            return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/products/{product_code}/sales")
async def api_product_sales(request: Request, product_code: str, from_date: str = None, to_date: str = None, pharmacy_id: int = None) -> JSONResponse:
    """Get product sales details for a date range"""
    headers = _auth_headers(request)
    
    if not pharmacy_id:
        return JSONResponse({"error": "pharmacy_id is required"}, status_code=400)
    
    if not from_date or not to_date:
        return JSONResponse({"error": "from_date and to_date are required"}, status_code=400)
    
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            url = f"{API_BASE_URL}/products/{quote(product_code)}/sales?from_date={from_date}&to_date={to_date}&pharmacy_id={pharmacy_id}"
            resp = await client.get(url, headers=headers)
            
            if resp.status_code == 401 and API_KEY:
                resp = await client.get(url, headers={"X-API-Key": API_KEY})
            
            if resp.status_code == 200:
                data = resp.json()
                return JSONResponse(data)
            else:
                return JSONResponse({"error": f"Failed to fetch product sales: {resp.status_code}"}, status_code=resp.status_code)
        except Exception as e:
            print(f"[ERROR] Failed to fetch product sales: {e}")
            return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/products/{product_code}/stock")
async def api_product_stock(
    request: Request, 
    product_code: str, 
    pharmacy_id: int = Query(..., description="Pharmacy ID"),
    date: str = Query(..., description="Date in YYYY-MM-DD format")
) -> JSONResponse:
    """Get stock on hand for a specific product using the dedicated /products/{code}/stock endpoint"""
    headers = _auth_headers(request)
    
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            # Use the new dedicated endpoint that queries directly by product code
            url = f"{API_BASE_URL}/products/{quote(product_code)}/stock?date={date}&pharmacy_id={pharmacy_id}"
            print(f"[DEBUG] Calling product stock API: {url}")
            resp = await client.get(url, headers=headers)
            
            if resp.status_code == 401 and API_KEY:
                resp = await client.get(url, headers={"X-API-Key": API_KEY})
            
            if resp.status_code == 200:
                data = resp.json()
                on_hand = data.get("on_hand", 0)
                print(f"[DEBUG] Found SOH for {product_code}: {on_hand}")
                return JSONResponse({"on_hand": on_hand})
            else:
                print(f"[ERROR] API returned {resp.status_code}: {resp.text}")
                return JSONResponse({"on_hand": 0}, status_code=resp.status_code)
        except Exception as e:
            print(f"[ERROR] Failed to fetch product stock: {e}")
            return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/pharmacies/{pharmacy_id}/usage/top-180d")
async def api_usage_top_180d(request: Request, pharmacy_id: int, limit: int = 200) -> JSONResponse:
    """Get 180-day average daily usage for top products"""
    headers = _auth_headers(request)
    
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/usage/top-180d?limit={limit}"
            resp = await client.get(url, headers=headers)
            
            if resp.status_code == 401 and API_KEY:
                resp = await client.get(url, headers={"X-API-Key": API_KEY})
            
            if resp.status_code == 200:
                data = resp.json()
                # Handle both array and object formats
                if isinstance(data, list):
                    return JSONResponse(data)
                elif isinstance(data, dict) and "items" in data:
                    return JSONResponse(data["items"])
                return JSONResponse(data)
            else:
                return JSONResponse({"error": f"Failed to fetch usage data: {resp.status_code}"}, status_code=resp.status_code)
        except Exception as e:
            print(f"[ERROR] Failed to fetch usage data: {e}")
            return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/negative-stock")
async def api_negative_stock(request: Request, pid: int, date: str, limit: int = 200) -> JSONResponse:
    """Get products with negative stock on hand for a pharmacy"""
    headers = _auth_headers(request)
    async with httpx.AsyncClient(timeout=20) as client:
        url = f"{API_BASE_URL}/pharmacies/{pid}/stock-activity/negative-soh?date={date}&limit={limit}"
        resp = await client.get(url, headers=headers)
        
        if resp.status_code == 401 and API_KEY:
            # Retry with X-API-Key if bearer rejected
            resp = await client.get(url, headers={"X-API-Key": API_KEY})
    
    if resp.status_code != 200:
        # Return empty data if endpoint fails
        return JSONResponse({
            "pharmacy_id": pid,
            "date": date,
            "items": []
        })
    
    # Return the response as-is (API already filters and sorts)
    data = resp.json()
    if isinstance(data, list):
        return JSONResponse({
            "pharmacy_id": pid,
            "date": date,
            "items": data
        })
    
    return JSONResponse(data)


@app.get("/api/pharmacies/{pharmacy_id}/usage/product/{product_code}")
async def api_usage_product(request: Request, pharmacy_id: int, product_code: str) -> JSONResponse:
    """Get usage data for a specific product"""
    headers = _auth_headers(request)
    
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/usage/product/{quote(product_code)}"
            resp = await client.get(url, headers=headers)
            
            if resp.status_code == 401 and API_KEY:
                resp = await client.get(url, headers={"X-API-Key": API_KEY})
            
            if resp.status_code == 200:
                data = resp.json()
                return JSONResponse(data)
            else:
                return JSONResponse({"error": f"Failed to fetch product usage: {resp.status_code}"}, status_code=resp.status_code)
        except Exception as e:
            print(f"[ERROR] Failed to fetch product usage: {e}")
            return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request):
    """Admin page for user management - only accessible by Charl (user_id: 2)"""
    username = request.session.get("username")
    user_id = request.session.get("user_id")
    auth_token = request.session.get("auth_token")
    
    # Debug: Print session info
    print(f"[DEBUG] Admin page access - Username: {username}, User ID: {user_id}, Token: {auth_token[:20] if auth_token else 'None'}...")
    
    if not username:
        print(f"[DEBUG] No username in session - redirecting to login")
        return RedirectResponse(url="/login", status_code=303)
    
    # If user_id is not set, try to fetch it from admin/users endpoint
    if not user_id:
        # Admin endpoints should use the user's auth_token, not the global API_KEY
        bearer = request.session.get("auth_token") or API_KEY or ""
        if bearer:
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
                    # Try to get user info from admin/users endpoint
                    url = f"{API_BASE_URL}/admin/users"
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200:
                        users = resp.json()
                        # Find current user by username
                        for user in users:
                            if user.get("username") == username:
                                user_id = user.get("user_id")
                                request.session["user_id"] = int(user_id) if user_id else None
                                print(f"[DEBUG] Found user_id from admin/users: {user_id}")
                                break
            except Exception as e:
                print(f"[WARNING] Failed to fetch user_id from admin/users: {e}")
    
    # Check if user is admin (Charl user_id: 2, Amin user_id: 9, or username is "admin"/"charl"/"amin")
    is_admin = user_id in [2, 9] or (username and username.lower() in ["charl", "admin", "amin"])
    
    if not is_admin:
        print(f"[DEBUG] Access denied - User ID: {user_id}, Username: {username}")
        return RedirectResponse(url="/dashboard", status_code=303)
    
    print(f"[DEBUG] Admin access granted - User ID: {user_id}, Username: {username}")
    
    return templates.TemplateResponse(
        "admin.html",
        {
            "request": request,
            "title": "Admin - User Management",
            "username": username,
            "user_id": user_id,
            "is_charl": True,
        },
    )


# Admin API Proxy Endpoints
def _check_admin_access(request: Request) -> bool:
    """Check if current user is admin (user_id: 2 or 9, or username: 'Charl', 'admin', or 'Amin')"""
    user_id = request.session.get("user_id")
    username = request.session.get("username")
    return user_id in [2, 9] or (username and username.lower() in ["charl", "admin", "amin"])

@app.get("/api/admin/users")
async def api_admin_list_users(request: Request) -> JSONResponse:
    """Proxy endpoint to list all users - only accessible by admin users"""
    user_id = request.session.get("user_id")
    username = request.session.get("username")
    print(f"[DEBUG] /api/admin/users - user_id: {user_id}, username: {username}")
    
    if not _check_admin_access(request):
        print(f"[DEBUG] Access denied - user_id: {user_id}, username: {username}")
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    # Admin endpoints should use the user's auth_token, not the global API_KEY
    # The user must be authenticated to access admin endpoints
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    print(f"[DEBUG] Calling backend /admin/users with bearer: {bearer[:20] if bearer else 'None'}...")
    print(f"[DEBUG] API_KEY present: {bool(API_KEY)}, auth_token in session: {bool(request.session.get('auth_token'))}")
    print(f"[DEBUG] Using token from: {'session' if request.session.get('auth_token') else 'API_KEY' if API_KEY else 'none'}")
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/users"
        resp = await client.get(url, headers=headers)
    
    print(f"[DEBUG] Backend response status: {resp.status_code}")
    print(f"[DEBUG] Backend response headers: {dict(resp.headers)}")
    
    # If Bearer token fails with 401, try X-API-Key header (like dashboard does)
    if resp.status_code == 401 and bearer:
        print(f"[DEBUG] Bearer token failed, trying X-API-Key header...")
        alt_headers = {"X-API-Key": bearer}
        resp = await client.get(url, headers=alt_headers)
        print(f"[DEBUG] X-API-Key response status: {resp.status_code}")
    
    if resp.status_code != 200:
        error_text = resp.text[:500] if resp.text else "No error message"
        print(f"[DEBUG] Backend error: {error_text}")
        raise HTTPException(status_code=resp.status_code, detail=f"Backend returned {resp.status_code}: {error_text}")
    
    data = resp.json()
    print(f"[DEBUG] Users list response type: {type(data)}, length: {len(data) if isinstance(data, list) else 'N/A'}")
    if isinstance(data, list) and len(data) > 0:
        print(f"[DEBUG] First user keys: {list(data[0].keys()) if isinstance(data[0], dict) else 'Not a dict'}")
        print(f"[DEBUG] First user: {data[0]}")
        if 'pharmacies' in data[0]:
            print(f"[DEBUG] First user has 'pharmacies' field: {data[0]['pharmacies']}")
    
    return JSONResponse(data)


@app.get("/api/admin/users/{user_id}")
async def api_admin_get_user(request: Request, user_id: int) -> JSONResponse:
    """Proxy endpoint to get user details - only accessible by Charl"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    # Admin endpoints should use the user's auth_token, not the global API_KEY
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/users/{user_id}"
        resp = await client.get(url, headers=headers)
    
    if resp.status_code != 200:
        error_detail = resp.json().get("detail", "Failed to fetch user details") if resp.headers.get("content-type", "").startswith("application/json") else "Failed to fetch user details"
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.post("/api/admin/users")
async def api_admin_create_user(request: Request) -> JSONResponse:
    """Proxy endpoint to create a new user - only accessible by Charl"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    # Admin endpoints should use the user's auth_token, not the global API_KEY
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"} if bearer else {"Content-Type": "application/json"}
    
    user_data = await request.json()
    
    # Debug: Log what we're sending
    print(f"[DEBUG] Creating user - Request data: {user_data}")
    print(f"[DEBUG] Using bearer token: {bearer[:20] if bearer else 'None'}...")
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/users"
        print(f"[DEBUG] POST to: {url}")
        resp = await client.post(url, json=user_data, headers=headers)
        
        print(f"[DEBUG] Response status: {resp.status_code}")
        print(f"[DEBUG] Response body: {resp.text[:500]}")
    
    if resp.status_code != 200:
        error_detail = "Failed to create user"
        try:
            error_json = resp.json()
            error_detail = error_json.get("detail", str(error_json))
            print(f"[DEBUG] Error detail: {error_detail}")
        except:
            error_detail = resp.text[:200]
            print(f"[DEBUG] Raw error: {error_detail}")
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.put("/api/admin/users/{user_id}")
async def api_admin_update_user(request: Request, user_id: int) -> JSONResponse:
    """Proxy endpoint to update a user - only accessible by Charl"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    # Admin endpoints should use the user's auth_token, not the global API_KEY
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"} if bearer else {"Content-Type": "application/json"}
    
    user_data = await request.json()
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/users/{user_id}"
        resp = await client.put(url, json=user_data, headers=headers)
    
    if resp.status_code != 200:
        error_detail = resp.json().get("detail", "Failed to update user") if resp.headers.get("content-type", "").startswith("application/json") else "Failed to update user"
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.post("/api/admin/users/{user_id}/pharmacies")
async def api_admin_grant_pharmacy_access(request: Request, user_id: int) -> JSONResponse:
    """Proxy endpoint to grant pharmacy access - only accessible by Charl"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    # Admin endpoints should use the user's auth_token, not the global API_KEY
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"} if bearer else {"Content-Type": "application/json"}
    
    access_data = await request.json()
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/users/{user_id}/pharmacies"
        resp = await client.post(url, json=access_data, headers=headers)
    
    if resp.status_code != 200:
        error_detail = resp.json().get("detail", "Failed to grant pharmacy access") if resp.headers.get("content-type", "").startswith("application/json") else "Failed to grant pharmacy access"
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.delete("/api/admin/users/{user_id}/pharmacies/{pharmacy_id}")
async def api_admin_revoke_pharmacy_access(request: Request, user_id: int, pharmacy_id: int) -> JSONResponse:
    """Proxy endpoint to revoke pharmacy access - only accessible by Charl"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    # Admin endpoints should use the user's auth_token, not the global API_KEY
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/users/{user_id}/pharmacies/{pharmacy_id}"
        resp = await client.delete(url, headers=headers)
    
    if resp.status_code != 200:
        error_detail = resp.json().get("detail", "Failed to revoke pharmacy access") if resp.headers.get("content-type", "").startswith("application/json") else "Failed to revoke pharmacy access"
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.get("/api/admin/users/{user_id}/pharmacies")
async def api_admin_get_user_pharmacies(request: Request, user_id: int) -> JSONResponse:
    """Proxy endpoint to fetch a user's pharmacy access - only accessible by Charl"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/users/{user_id}/pharmacies"
        resp = await client.get(url, headers=headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch user pharmacies")
            if resp.headers.get("content-type", "").startswith("application/json")
            else "Failed to fetch user pharmacies"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    data = resp.json()
    print(f"[DEBUG] User {user_id} pharmacy assignments: {data}")
    return JSONResponse(data)


@app.delete("/api/admin/users/{user_id}")
async def api_admin_delete_user(request: Request, user_id: int) -> JSONResponse:
    """Proxy endpoint to delete a user - only accessible by Charl"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    # Admin endpoints should use the user's auth_token, not the global API_KEY
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/users/{user_id}"
        resp = await client.delete(url, headers=headers)
    
    if resp.status_code not in [200, 204]:
        error_detail = resp.json().get("detail", "Failed to delete user") if resp.headers.get("content-type", "").startswith("application/json") else "Failed to delete user"
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    if resp.status_code == 204:
        return JSONResponse({"message": "User deleted successfully"})
    
    return JSONResponse(resp.json())


@app.get("/api/admin/pharmacies")
async def api_admin_list_pharmacies(request: Request) -> JSONResponse:
    """Proxy endpoint to list all pharmacies - only accessible by Charl"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    # Admin endpoints should use the user's auth_token, not the global API_KEY
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/pharmacies"
        resp = await client.get(url, headers=headers)
    
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch pharmacies")
    
    return JSONResponse(resp.json())


# Chart of Accounts API Endpoints
@app.get("/api/admin/chart-of-accounts")
async def api_admin_list_chart_of_accounts(request: Request) -> JSONResponse:
    """Proxy endpoint to list all chart of accounts - only accessible by admin users"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/chart-of-accounts"
        resp = await client.get(url, headers=headers)
        
        if resp.status_code == 401 and API_KEY:
            alt_headers = {"X-API-Key": API_KEY}
            resp = await client.get(url, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch chart of accounts")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.post("/api/admin/chart-of-accounts")
async def api_admin_create_chart_of_account(request: Request) -> JSONResponse:
    """Proxy endpoint to create a new chart of account - only accessible by admin users"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    # Use X-API-Key as primary auth method (as per backend API spec)
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    else:
        bearer = request.session.get("auth_token") or ""
        if bearer:
            headers["Authorization"] = f"Bearer {bearer}"
    
    account_data = await request.json()
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/chart-of-accounts"
        resp = await client.post(url, json=account_data, headers=headers)
        
        # If X-API-Key fails, try Bearer token as fallback
        if resp.status_code == 401 and headers.get("X-API-Key"):
            bearer = request.session.get("auth_token") or ""
            if bearer:
                alt_headers = {"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"}
                resp = await client.post(url, json=account_data, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to create account")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.put("/api/admin/chart-of-accounts/{account_id}")
async def api_admin_update_chart_of_account(request: Request, account_id: int) -> JSONResponse:
    """Proxy endpoint to update a chart of account - only accessible by admin users"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    # Use X-API-Key as primary auth method (as per backend API spec)
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    else:
        bearer = request.session.get("auth_token") or ""
        if bearer:
            headers["Authorization"] = f"Bearer {bearer}"
    
    account_data = await request.json()
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/chart-of-accounts/{account_id}"
        resp = await client.put(url, json=account_data, headers=headers)
        
        # If X-API-Key fails, try Bearer token as fallback
        if resp.status_code == 401 and headers.get("X-API-Key"):
            bearer = request.session.get("auth_token") or ""
            if bearer:
                alt_headers = {"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"}
                resp = await client.put(url, json=account_data, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to update account")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


# Chart of Accounts API Endpoints (Public/Read-only endpoints)
@app.get("/api/accounts")
async def api_list_accounts(
    request: Request,
    type: str = Query(None, alias="type"),
    category: str = Query(None, alias="category"),
    is_active: bool = Query(None, alias="is_active"),
    include_inactive: bool = Query(None, alias="include_inactive")
) -> JSONResponse:
    """Proxy endpoint to list all accounts with optional filters"""
    # Use X-API-Key as primary auth method for accounts endpoint (as per backend API)
    headers = {}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    else:
        bearer = request.session.get("auth_token") or ""
        if bearer:
            headers["Authorization"] = f"Bearer {bearer}"
    
    params = {}
    if type:
        params["type"] = type
    if category:
        params["category"] = category
    if is_active is not None:
        params["is_active"] = str(is_active).lower()
    if include_inactive is not None:
        params["include_inactive"] = str(include_inactive).lower()
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/accounts"
        resp = await client.get(url, params=params, headers=headers)
        
        # If X-API-Key fails, try Bearer token as fallback
        if resp.status_code == 401 and headers.get("X-API-Key"):
            bearer = request.session.get("auth_token") or ""
            if bearer:
                alt_headers = {"Authorization": f"Bearer {bearer}"}
                resp = await client.get(url, params=params, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch accounts")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.get("/api/accounts/{account_id}")
async def api_get_account(request: Request, account_id: int) -> JSONResponse:
    """Proxy endpoint to get account by ID"""
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/accounts/{account_id}"
        resp = await client.get(url, headers=headers)
        
        if resp.status_code == 401 and API_KEY:
            alt_headers = {"X-API-Key": API_KEY}
            resp = await client.get(url, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch account")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.get("/api/accounts/code/{account_code}")
async def api_get_account_by_code(request: Request, account_code: str) -> JSONResponse:
    """Proxy endpoint to get account by code"""
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/accounts/code/{account_code}"
        resp = await client.get(url, headers=headers)
        
        if resp.status_code == 401 and API_KEY:
            alt_headers = {"X-API-Key": API_KEY}
            resp = await client.get(url, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch account")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.get("/api/accounts/types/list")
async def api_list_account_types(request: Request) -> JSONResponse:
    """Proxy endpoint to list all account types"""
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/accounts/types/list"
        resp = await client.get(url, headers=headers)
        
        if resp.status_code == 401 and API_KEY:
            alt_headers = {"X-API-Key": API_KEY}
            resp = await client.get(url, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch account types")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.get("/api/accounts/categories/list")
async def api_list_account_categories(request: Request) -> JSONResponse:
    """Proxy endpoint to list all account categories"""
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/accounts/categories/list"
        resp = await client.get(url, headers=headers)
        
        if resp.status_code == 401 and API_KEY:
            alt_headers = {"X-API-Key": API_KEY}
            resp = await client.get(url, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch account categories")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.get("/api/accounts/summary/stats")
async def api_get_account_summary_stats(request: Request) -> JSONResponse:
    """Proxy endpoint to get summary statistics for accounts"""
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/accounts/summary/stats"
        resp = await client.get(url, headers=headers)
        
        if resp.status_code == 401 and API_KEY:
            alt_headers = {"X-API-Key": API_KEY}
            resp = await client.get(url, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch account statistics")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


# Bank Accounts API Endpoints
@app.get("/api/bank-accounts/pharmacies/{pharmacy_id}")
async def api_get_bank_accounts(request: Request, pharmacy_id: int) -> JSONResponse:
    """Proxy endpoint to get bank accounts for a pharmacy - only accessible by admin users"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/bank-accounts/pharmacies/{pharmacy_id}"
        resp = await client.get(url, headers=headers)
        
        if resp.status_code == 401 and API_KEY:
            alt_headers = {"X-API-Key": API_KEY}
            resp = await client.get(url, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch bank accounts")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.get("/api/bank-accounts/{bank_account_id}")
async def api_get_bank_account(request: Request, bank_account_id: int) -> JSONResponse:
    """Proxy endpoint to get a specific bank account - only accessible by admin users"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/bank-accounts/{bank_account_id}"
        resp = await client.get(url, headers=headers)
        
        if resp.status_code == 401 and API_KEY:
            alt_headers = {"X-API-Key": API_KEY}
            resp = await client.get(url, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch bank account")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.post("/api/bank-accounts")
async def api_create_bank_account(request: Request) -> JSONResponse:
    """Proxy endpoint to create a new bank account - only accessible by admin users"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    # Use X-API-Key as primary auth method (as per backend API spec)
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    else:
        bearer = request.session.get("auth_token") or ""
        if bearer:
            headers["Authorization"] = f"Bearer {bearer}"
    
    account_data = await request.json()
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/bank-accounts"
        resp = await client.post(url, json=account_data, headers=headers)
        
        # If X-API-Key fails, try Bearer token as fallback
        if resp.status_code == 401 and headers.get("X-API-Key"):
            bearer = request.session.get("auth_token") or ""
            if bearer:
                alt_headers = {"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"}
                resp = await client.post(url, json=account_data, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to create bank account")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.put("/api/bank-accounts/{bank_account_id}")
async def api_update_bank_account(request: Request, bank_account_id: int) -> JSONResponse:
    """Proxy endpoint to update a bank account - only accessible by admin users"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    # Use X-API-Key as primary auth method (as per backend API spec)
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    else:
        bearer = request.session.get("auth_token") or ""
        if bearer:
            headers["Authorization"] = f"Bearer {bearer}"
    
    account_data = await request.json()
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/bank-accounts/{bank_account_id}"
        resp = await client.put(url, json=account_data, headers=headers)
        
        # If X-API-Key fails, try Bearer token as fallback
        if resp.status_code == 401 and headers.get("X-API-Key"):
            bearer = request.session.get("auth_token") or ""
            if bearer:
                alt_headers = {"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"}
                resp = await client.put(url, json=account_data, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to update bank account")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.delete("/api/bank-accounts/{bank_account_id}")
async def api_delete_bank_account(request: Request, bank_account_id: int) -> JSONResponse:
    """Proxy endpoint to soft delete (deactivate) a bank account - only accessible by admin users"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/bank-accounts/{bank_account_id}"
        resp = await client.delete(url, headers=headers)
        
        if resp.status_code == 401 and API_KEY:
            alt_headers = {"X-API-Key": API_KEY}
            resp = await client.delete(url, headers=alt_headers)
    
    if resp.status_code not in [200, 204]:
        error_detail = (
            resp.json().get("detail", "Failed to delete bank account")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    if resp.status_code == 204:
        return JSONResponse({"message": "Bank account deleted successfully"})
    
    return JSONResponse(resp.json())


def preprocess_csv_file(file_content: bytes, filename: str) -> bytes:
    """
    Preprocess CSV to strip BOM and whitespace from headers only.
    
    IMPORTANT: DO NOT transform amounts! The CSV already has the correct sign convention:
    - Positive amounts = INFLOWS (money coming in)
    - Negative amounts = OUTFLOWS (money going out)
    
    The "DR" and "CR" in EFTPOS descriptions are just reference codes, NOT transaction direction indicators.
    """
    try:
        # Decode and strip BOM if present
        content_str = file_content.decode('utf-8-sig')
        input_file = io.StringIO(content_str)
        reader = csv.DictReader(input_file)

        # Normalize header names: trim whitespace and BOM, but keep original casing
        normalized_fieldnames = {}
        date_column_key = None
        for field in reader.fieldnames:
            normalized = field.strip().lstrip('\ufeff')
            normalized_fieldnames[field] = normalized
            if normalized.lower() == 'date':
                date_column_key = field

        # If no date column, return original content
        if not date_column_key:
            print(f"[WARNING] No 'Date' column found in CSV. Columns: {reader.fieldnames}")
            return file_content

        # Use normalized fieldnames in the output, preserving original values
        output_fieldnames = [normalized_fieldnames.get(f, f) for f in reader.fieldnames]
        output_file = io.StringIO()
        writer = csv.DictWriter(output_file, fieldnames=output_fieldnames, lineterminator='\n')
        writer.writeheader()

        row_count = 0
        positive_amounts = 0
        negative_amounts = 0
        amount_column = None
        
        # Find the amount column (case-insensitive)
        for field in output_fieldnames:
            if field.lower() == 'amount':
                amount_column = field
                break
        
        for row in reader:
            # Build output row with normalized headers but ORIGINAL values (no transformation!)
            output_row = {normalized_fieldnames.get(k, k): v for k, v in row.items()}
            
            # Track amounts for logging (but don't transform them!)
            if amount_column and amount_column in output_row:
                try:
                    amount_str = output_row[amount_column].strip()
                    if amount_str:
                        amount_val = float(amount_str)
                        if amount_val >= 0:
                            positive_amounts += 1
                        else:
                            negative_amounts += 1
                except (ValueError, TypeError):
                    pass
            
            writer.writerow(output_row)
            row_count += 1

        print(f"[INFO] Preprocessed CSV rows (no date conversion): {row_count}")
        print(f"[INFO] Output columns: {output_fieldnames}")
        if amount_column:
            print(f"[INFO] Amount column analysis: {positive_amounts} positive, {negative_amounts} negative")

        return output_file.getvalue().encode('utf-8')

    except Exception as e:
        print(f"[WARNING] CSV preprocessing failed: {e}")
        import traceback
        traceback.print_exc()
        return file_content


# Bank Imports API Endpoints
@app.post("/api/bank-imports/preview")
async def api_preview_bank_import(request: Request) -> JSONResponse:
    """Proxy endpoint to preview a bank import - only accessible by admin users"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    form_data = await request.form()
    file = form_data.get("file")
    pharmacy_id = form_data.get("pharmacy_id")
    bank_account_id = form_data.get("bank_account_id")
    
    if not file or not pharmacy_id or not bank_account_id:
        raise HTTPException(status_code=400, detail="Missing file, pharmacy_id, or bank_account_id")
    
    # Read file content
    file_content = await file.read()
    
    # Preprocess CSV: strip BOM and normalize headers (backend handles DD/MM/YYYY dates directly)
    processed_content = preprocess_csv_file(file_content, file.filename)
    
    # Debug: Log first few lines of processed content and sample amounts
    try:
        preview_lines = processed_content.decode('utf-8').split('\n')[:10]
        print(f"[DEBUG] Processed CSV preview (first 10 lines): {preview_lines}")
        
        # Parse and show sample amounts
        import csv as csv_module
        import io
        reader = csv_module.DictReader(io.StringIO(processed_content.decode('utf-8')))
        sample_amounts = []
        for i, row in enumerate(reader):
            if i >= 10:
                break
            amount_str = row.get('Amount', '').strip()
            desc = row.get('Description', '')[:50]
            sample_amounts.append((amount_str, desc))
        print(f"[DEBUG] Sample amounts from CSV: {sample_amounts[:5]}")
    except Exception as e:
        print(f"[DEBUG] Error logging CSV preview: {e}")
        import traceback
        traceback.print_exc()
    
    # Use text/csv content type for the processed file
    files = {"file": (file.filename, processed_content, "text/csv")}
    data = {
        "pharmacy_id": pharmacy_id,
        "bank_account_id": bank_account_id
    }
    
    # Use X-API-Key header as per API specification
    headers = {"X-API-Key": API_KEY} if API_KEY else {}
    
    print(f"[DEBUG] Sending preview request to {API_BASE_URL}/bank-imports/preview")
    print(f"[DEBUG] Data: pharmacy_id={pharmacy_id}, bank_account_id={bank_account_id}")
    
    async with httpx.AsyncClient(timeout=60) as client:
        url = f"{API_BASE_URL}/bank-imports/preview"
        resp = await client.post(url, files=files, data=data, headers=headers)
        
    print(f"[DEBUG] Response status: {resp.status_code}")
    print(f"[DEBUG] Response body preview: {resp.text[:500] if resp.text else 'empty'}")
    
    # Debug: Check sample transactions from API response
    try:
        resp_data = resp.json()
        if 'sample_transactions' in resp_data:
            sample = resp_data['sample_transactions'][:5]
            print(f"[DEBUG] API returned sample transactions with amounts:")
            for txn in sample:
                print(f"  Row {txn.get('row_number')}: {txn.get('description', '')[:40]} | Amount: {txn.get('amount')}")
        if 'summary' in resp_data:
            summary = resp_data['summary']
            print(f"[DEBUG] API summary: total_in={summary.get('total_in')}, total_out={summary.get('total_out')}, count={summary.get('transaction_count')}")
    except Exception as e:
        print(f"[DEBUG] Error checking API response: {e}")
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to preview import")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.post("/api/bank-imports/confirm")
async def api_confirm_bank_import(request: Request) -> JSONResponse:
    """Proxy endpoint to confirm and import bank transactions - only accessible by admin users"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    form_data = await request.form()
    file = form_data.get("file")
    pharmacy_id = form_data.get("pharmacy_id")
    bank_account_id = form_data.get("bank_account_id")
    file_name = form_data.get("file_name")
    skip_duplicates = form_data.get("skip_duplicates", "true")  # Default to true
    notes = form_data.get("notes")
    
    if not file or not pharmacy_id or not bank_account_id or not file_name:
        raise HTTPException(status_code=400, detail="Missing file, pharmacy_id, bank_account_id, or file_name")
    
    # Read file content
    file_content = await file.read()
    
    # Preprocess CSV: strip BOM and normalize headers (backend handles DD/MM/YYYY dates directly)
    processed_content = preprocess_csv_file(file_content, file.filename)
    
    files = {"file": (file.filename, processed_content, file.content_type)}
    data = {
        "pharmacy_id": pharmacy_id,
        "bank_account_id": bank_account_id,
        "file_name": file_name,
        "skip_duplicates": skip_duplicates
    }
    
    # Add optional notes if provided
    if notes:
        data["notes"] = notes
    
    # Use X-API-Key header as per API specification
    headers = {"X-API-Key": API_KEY} if API_KEY else {}
    
    async with httpx.AsyncClient(timeout=120) as client:
        url = f"{API_BASE_URL}/bank-imports/confirm"
        resp = await client.post(url, files=files, data=data, headers=headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to confirm import")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.get("/api/bank-imports/pharmacies/{pharmacy_id}")
async def api_get_bank_imports(request: Request, pharmacy_id: int, limit: int = 50, offset: int = 0) -> JSONResponse:
    """Proxy endpoint to get bank import batches for a pharmacy - only accessible by admin users"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    # Use X-API-Key header for the new batches endpoint
    headers = {"X-API-Key": API_KEY} if API_KEY else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/bank-imports/pharmacies/{pharmacy_id}/batches"
        params = {"limit": limit, "offset": offset}
        resp = await client.get(url, headers=headers, params=params)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch bank import batches")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


# Bank Rules API Endpoints
@app.get("/api/bank-rules/pharmacies/{pharmacy_id}/bank-rules")
async def api_get_bank_rules(request: Request, pharmacy_id: int) -> JSONResponse:
    """Proxy endpoint to get bank rules for a pharmacy"""
    headers = {"X-API-Key": API_KEY} if API_KEY else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/bank-rules/pharmacies/{pharmacy_id}/bank-rules"
        print(f"[DEBUG] Bank Rules API Call")
        print(f"[DEBUG] URL: {url}")
        print(f"[DEBUG] Headers: {headers}")
        resp = await client.get(url, headers=headers)
        print(f"[DEBUG] Response Status: {resp.status_code}")
        print(f"[DEBUG] Response Headers: {dict(resp.headers)}")
    
    if resp.status_code != 200:
        try:
            error_json = resp.json()
            error_detail = error_json.get("detail", f"Failed to fetch bank rules: {resp.status_code}")
            print(f"[DEBUG] Error Response JSON: {error_json}")
        except:
            error_text = resp.text[:500] if resp.text else "No error message"
            error_detail = f"Backend returned {resp.status_code}: {error_text}"
            print(f"[DEBUG] Error Response Text: {error_text}")
        
        # For 500 errors, provide more helpful message
        if resp.status_code == 500:
            error_detail = f"Remote API server error (500). The bank rules endpoint may not be deployed yet or there's a server issue. Error: {error_detail}"
        
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.post("/api/bank-rules/pharmacies/{pharmacy_id}/bank-rules")
async def api_create_bank_rule(request: Request, pharmacy_id: int) -> JSONResponse:
    """Proxy endpoint to create a bank rule"""
    body = await request.json()
    headers = {"X-API-Key": API_KEY, "Content-Type": "application/json"} if API_KEY else {"Content-Type": "application/json"}
    
    print(f"[DEBUG] Create Bank Rule - pharmacy_id: {pharmacy_id}")
    print(f"[DEBUG] Request body keys: {list(body.keys()) if isinstance(body, dict) else 'Not a dict'}")
    print(f"[DEBUG] Request body: {body}")
    
    # Validate required fields
    if not body.get("name"):
        raise HTTPException(status_code=422, detail="Rule name is required")
    if not body.get("type"):
        raise HTTPException(status_code=422, detail="Rule type is required")
    if not body.get("conditions") or len(body.get("conditions", [])) == 0:
        raise HTTPException(status_code=422, detail="At least one condition is required")
    if not body.get("allocate") or len(body.get("allocate", [])) == 0:
        raise HTTPException(status_code=422, detail="At least one allocation is required")
    
    # Prepare body - ensure pharmacy_id is included (API validation requires it despite being in path)
    body_to_send = body.copy() if isinstance(body, dict) else body
    if isinstance(body_to_send, dict):
        # Ensure pharmacy_id is in body (API validation requires it)
        body_to_send["pharmacy_id"] = int(pharmacy_id)
        
        # Ensure contact_name is None (not empty string) for proper JSON serialization
        if body_to_send.get("contact_name") == "" or body_to_send.get("contact_name") is None:
            body_to_send["contact_name"] = None
        
        # Ensure name is a non-empty string
        if not body_to_send.get("name") or not isinstance(body_to_send.get("name"), str):
            raise HTTPException(status_code=422, detail="Rule name must be a non-empty string")
        
        # Ensure type is valid
        if body_to_send.get("type") not in ["receive", "spend", "transfer"]:
            raise HTTPException(status_code=422, detail="Rule type must be 'receive', 'spend', or 'transfer'")
        
        print(f"[DEBUG] Prepared body with pharmacy_id: {body_to_send.get('pharmacy_id')}")
    
    # Validate data types before sending
    if isinstance(body_to_send, dict):
        # Ensure pharmacy_id is an integer
        if "pharmacy_id" in body_to_send:
            try:
                body_to_send["pharmacy_id"] = int(body_to_send["pharmacy_id"])
            except (ValueError, TypeError):
                raise HTTPException(status_code=422, detail="pharmacy_id must be an integer")
        
        # Ensure priority is an integer
        if "priority" in body_to_send:
            try:
                body_to_send["priority"] = int(body_to_send["priority"])
            except (ValueError, TypeError):
                body_to_send["priority"] = 100  # Default
        
        # Validate allocate array
        if "allocate" in body_to_send and isinstance(body_to_send["allocate"], list):
            for alloc in body_to_send["allocate"]:
                if isinstance(alloc, dict):
                    if "account_id" in alloc:
                        alloc["account_id"] = int(alloc["account_id"])
                    if "percent" in alloc:
                        alloc["percent"] = float(alloc["percent"])
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/bank-rules/pharmacies/{pharmacy_id}/bank-rules"
        print(f"[DEBUG] Calling: {url}")
        print(f"[DEBUG] Headers: {headers}")
        print(f"[DEBUG] Body to send (keys): {list(body_to_send.keys()) if isinstance(body_to_send, dict) else 'Not a dict'}")
        print(f"[DEBUG] Body pharmacy_id: {body_to_send.get('pharmacy_id') if isinstance(body_to_send, dict) else 'N/A'}")
        print(f"[DEBUG] Body structure: {body_to_send}")
        
        try:
            resp = await client.post(url, headers=headers, json=body_to_send)
        except Exception as e:
            print(f"[DEBUG] Exception making request: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to connect to remote API: {str(e)}")
    
    print(f"[DEBUG] Response status: {resp.status_code}")
    print(f"[DEBUG] Response headers: {dict(resp.headers)}")
    
    if resp.status_code not in [200, 201]:
        # Try to get full response text for debugging
        response_text = ""
        try:
            response_text = resp.text
            print(f"[DEBUG] Full response text (first 2000 chars): {response_text[:2000]}")
            print(f"[DEBUG] Full response text length: {len(response_text)}")
        except Exception as text_error:
            print(f"[DEBUG] Could not get response text: {text_error}")
            
        error_detail = "Failed to create bank rule"
        try:
            # Try to parse as JSON first
            if resp.headers.get("content-type", "").startswith("application/json"):
                error_json = resp.json()
                print(f"[DEBUG] Error JSON: {error_json}")
                print(f"[DEBUG] Error JSON type: {type(error_json)}")
                
                # Handle different error formats
                if isinstance(error_json, dict):
                    # FastAPI validation errors might be in 'detail' as a list
                    if "detail" in error_json:
                        detail = error_json["detail"]
                        if isinstance(detail, list):
                            # Validation error list - extract messages
                            error_messages = []
                            for item in detail:
                                if isinstance(item, dict):
                                    loc = item.get("loc", [])
                                    msg = item.get("msg", "")
                                    error_messages.append(f"{'.'.join(str(x) for x in loc)}: {msg}")
                                else:
                                    error_messages.append(str(item))
                            error_detail = "; ".join(error_messages) if error_messages else str(detail)
                        elif isinstance(detail, str):
                            error_detail = detail
                        else:
                            error_detail = str(detail)
                    else:
                        error_detail = error_json.get("message") or error_json.get("error") or str(error_json)
                elif isinstance(error_json, list):
                    # Array of errors
                    error_detail = "; ".join(str(item) for item in error_json)
                else:
                    error_detail = str(error_json)
            else:
                error_text = resp.text[:500]  # Limit error text length
                error_detail = f"Backend returned {resp.status_code}: {error_text}"
        except Exception as e:
            error_detail = f"Backend returned {resp.status_code}. Could not parse error: {str(e)}"
            print(f"[DEBUG] Exception parsing error: {e}")
        
        print(f"[DEBUG] Error detail: {error_detail}")
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.put("/api/bank-rules/bank-rules/{rule_id}")
async def api_update_bank_rule(request: Request, rule_id: int) -> JSONResponse:
    """Proxy endpoint to update a bank rule"""
    body = await request.json()
    headers = {"X-API-Key": API_KEY, "Content-Type": "application/json"} if API_KEY else {"Content-Type": "application/json"}
    
    print(f"[DEBUG] Update Bank Rule - rule_id: {rule_id}")
    print(f"[DEBUG] Request body: {body}")
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/bank-rules/bank-rules/{rule_id}"
        print(f"[DEBUG] Calling: {url}")
        resp = await client.put(url, headers=headers, json=body)
    
    print(f"[DEBUG] Response status: {resp.status_code}")
    
    if resp.status_code != 200:
        error_detail = "Failed to update bank rule"
        try:
            if resp.headers.get("content-type", "").startswith("application/json"):
                error_json = resp.json()
                error_detail = error_json.get("detail") or error_json.get("message") or error_json.get("error") or str(error_json)
            else:
                error_text = resp.text[:500]  # Limit error text length
                error_detail = f"Backend returned {resp.status_code}: {error_text}"
        except Exception as e:
            error_detail = f"Backend returned {resp.status_code}. Could not parse error: {str(e)}"
        
        print(f"[DEBUG] Error detail: {error_detail}")
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


# Unmatched Transactions API Endpoints
@app.get("/api/bank-rules/pharmacies/{pharmacy_id}/reconciliation-summary")
async def api_get_reconciliation_summary(request: Request, pharmacy_id: int) -> JSONResponse:
    """Proxy endpoint to get reconciliation summary (reconciled count, unmatched count, difference)"""
    headers = {"X-API-Key": API_KEY} if API_KEY else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/bank-rules/pharmacies/{pharmacy_id}/reconciliation-summary"
        
        print(f"[DEBUG] Fetching reconciliation summary - pharmacy_id: {pharmacy_id}")
        print(f"[DEBUG] URL: {url}")
        
        resp = await client.get(url, headers=headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch reconciliation summary")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.get("/api/bank-rules/pharmacies/{pharmacy_id}/bank-transactions/unmatched")
async def api_get_unmatched_transactions(request: Request, pharmacy_id: int) -> JSONResponse:
    """Proxy endpoint to get unmatched transactions"""
    headers = {"X-API-Key": API_KEY} if API_KEY else {}
    
    # Forward any query parameters from the request to the backend API
    query_params = dict(request.query_params)
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/bank-rules/pharmacies/{pharmacy_id}/bank-transactions/unmatched"
        # Add query parameters if any
        if query_params:
            url += "?" + "&".join([f"{k}={v}" for k, v in query_params.items()])
        
        print(f"[DEBUG] Fetching unmatched transactions - pharmacy_id: {pharmacy_id}")
        print(f"[DEBUG] URL: {url}")
        print(f"[DEBUG] Query params: {query_params}")
        
        resp = await client.get(url, headers=headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch unmatched transactions")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    data = resp.json()
    
    # Log statistics about the response
    if isinstance(data, list):
        total_count = len(data)
        positive_count = sum(1 for tx in data if isinstance(tx, dict) and tx.get("amount", 0) > 0)
        negative_count = sum(1 for tx in data if isinstance(tx, dict) and tx.get("amount", 0) < 0)
        zero_count = sum(1 for tx in data if isinstance(tx, dict) and tx.get("amount", 0) == 0)
        print(f"[DEBUG] Unmatched transactions response: total={total_count}, positive={positive_count}, negative={negative_count}, zero={zero_count}")
    elif isinstance(data, dict) and "items" in data:
        items = data.get("items", [])
        total_count = len(items)
        positive_count = sum(1 for tx in items if isinstance(tx, dict) and tx.get("amount", 0) > 0)
        negative_count = sum(1 for tx in items if isinstance(tx, dict) and tx.get("amount", 0) < 0)
        zero_count = sum(1 for tx in items if isinstance(tx, dict) and tx.get("amount", 0) == 0)
        print(f"[DEBUG] Unmatched transactions response: total={total_count}, positive={positive_count}, negative={negative_count}, zero={zero_count}")
    
    return JSONResponse(data)


@app.post("/api/bank-rules/bank-import-batches/{batch_id}/apply-rules")
async def api_apply_rules(request: Request, batch_id: int) -> JSONResponse:
    """Proxy endpoint to apply rules to a batch"""
    headers = {"X-API-Key": API_KEY} if API_KEY else {}
    
    print(f"[DEBUG] Apply Rules - batch_id: {batch_id}")
    
    try:
        # Increased timeout to 120 seconds (2 minutes) as applying rules to a batch can be a long-running operation
        async with httpx.AsyncClient(timeout=120) as client:
            url = f"{API_BASE_URL}/bank-rules/bank-import-batches/{batch_id}/apply-rules"
            print(f"[DEBUG] Calling: {url}")
            print(f"[DEBUG] Headers: {headers}")
            resp = await client.post(url, headers=headers)
    except httpx.TimeoutException:
        print(f"[DEBUG] Timeout calling apply-rules endpoint (exceeded 120 seconds)")
        raise HTTPException(
            status_code=504, 
            detail="Request to backend API timed out after 2 minutes. The batch may have too many transactions, or the backend API may be experiencing performance issues. Please try again or contact support if the issue persists."
        )
    except httpx.ConnectError as e:
        print(f"[DEBUG] Connection error: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to connect to backend API: {str(e)}")
    except Exception as e:
        print(f"[DEBUG] Exception making request: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to connect to remote API: {str(e)}")
    
    print(f"[DEBUG] Response status: {resp.status_code}")
    print(f"[DEBUG] Response headers: {dict(resp.headers)}")
    
    if resp.status_code != 200:
        error_detail = "Failed to apply rules"
        try:
            if resp.headers.get("content-type", "").startswith("application/json"):
                error_json = resp.json()
                error_detail = error_json.get("detail") or error_json.get("message") or error_json.get("error") or str(error_json)
                print(f"[DEBUG] Error Response JSON: {error_json}")
            else:
                error_text = resp.text[:500] if resp.text else "No error message"
                error_detail = f"Backend returned {resp.status_code}: {error_text}"
                print(f"[DEBUG] Error Response Text: {error_text}")
        except Exception as e:
            print(f"[DEBUG] Exception parsing error response: {e}")
            error_text = resp.text[:500] if resp.text else "No error message"
            error_detail = f"Backend returned {resp.status_code}: {error_text}"
        
        # For 500 errors, provide more helpful message
        if resp.status_code == 500:
            error_detail = f"Remote API server error (500). This may indicate a bug in the backend API. Error details: {error_detail}"
        
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    try:
        return JSONResponse(resp.json())
    except Exception as e:
        print(f"[DEBUG] Exception parsing success response: {e}")
        raise HTTPException(status_code=500, detail=f"Backend returned invalid JSON response: {str(e)}")


@app.post("/api/bank-rules/bank-import-batches/{batch_id}/generate-ai-suggestions")
async def api_generate_ai_suggestions(request: Request, batch_id: int) -> JSONResponse:
    """Proxy endpoint to generate AI suggestions"""
    headers = {"X-API-Key": API_KEY} if API_KEY else {}
    
    async with httpx.AsyncClient(timeout=60) as client:
        url = f"{API_BASE_URL}/bank-rules/bank-import-batches/{batch_id}/generate-ai-suggestions"
        resp = await client.post(url, headers=headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to generate AI suggestions")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.post("/api/bank-rules/ai-suggestions/{suggestion_id}/accept")
async def api_accept_ai_suggestion(request: Request, suggestion_id: int) -> JSONResponse:
    """Proxy endpoint to accept an AI suggestion"""
    body = await request.json() if request.headers.get("content-type") == "application/json" else {}
    headers = {"X-API-Key": API_KEY, "Content-Type": "application/json"} if API_KEY else {"Content-Type": "application/json"}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/bank-rules/ai-suggestions/{suggestion_id}/accept"
        resp = await client.post(url, headers=headers, json=body)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to accept AI suggestion")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.post("/api/bank-rules/ai-suggestions/{suggestion_id}/reject")
async def api_reject_ai_suggestion(request: Request, suggestion_id: int) -> JSONResponse:
    """Proxy endpoint to reject an AI suggestion"""
    headers = {"X-API-Key": API_KEY} if API_KEY else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/bank-rules/ai-suggestions/{suggestion_id}/reject"
        resp = await client.post(url, headers=headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to reject AI suggestion")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.post("/api/bank-rules/bank-transactions/{transaction_id}/apply-rules")
async def api_apply_rules_to_transaction(request: Request, transaction_id: int) -> JSONResponse:
    """Proxy endpoint to apply rules to an individual transaction"""
    headers = {"X-API-Key": API_KEY} if API_KEY else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/bank-rules/bank-transactions/{transaction_id}/apply-rules"
        resp = await client.post(url, headers=headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to apply rules to transaction")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.post("/api/bank-statement-lines/{line_id}/manual-classify")
async def api_manual_classify(request: Request, line_id: int) -> JSONResponse:
    """Proxy endpoint to manually classify a statement line"""
    body = await request.json()
    headers = {"X-API-Key": API_KEY, "Content-Type": "application/json"} if API_KEY else {"Content-Type": "application/json"}
    
    import json
    print("=" * 80)
    print("[DEBUG] MANUAL CLASSIFY REQUEST")
    print("=" * 80)
    print(f"Line ID: {line_id}")
    print(f"Request Body:")
    print(json.dumps(body, indent=2))
    print(f"Headers (excluding API key): {dict((k, v) for k, v in headers.items() if k != 'X-API-Key')}")
    print("=" * 80)
    
    async with httpx.AsyncClient(timeout=15) as client:
        # Try the bank-transactions endpoint first (matches apply-rules pattern)
        url1 = f"{API_BASE_URL}/bank-rules/bank-transactions/{line_id}/manual-classify"
        print(f"[DEBUG] Trying endpoint 1: {url1}")
        resp1 = await client.post(url1, headers=headers, json=body)
        print(f"[DEBUG] Endpoint 1 response status: {resp1.status_code}")
        
        if resp1.status_code == 200:
            print(f"[DEBUG] Success with bank-transactions endpoint")
            try:
                response_json = resp1.json()
                print(f"[DEBUG] Response:")
                print(json.dumps(response_json, indent=2))
            except:
                print(f"[DEBUG] Response (non-JSON): {resp1.text[:500]}")
            return JSONResponse(resp1.json())
        
        # If that fails, try the bank-statement-lines endpoint
        if resp1.status_code == 404:
            print(f"[DEBUG] Endpoint 1 returned 404, trying bank-statement-lines endpoint")
            url2 = f"{API_BASE_URL}/bank-statement-lines/{line_id}/manual-classify"
            print(f"[DEBUG] Trying endpoint 2: {url2}")
            resp2 = await client.post(url2, headers=headers, json=body)
            print(f"[DEBUG] Endpoint 2 response status: {resp2.status_code}")
            
            if resp2.status_code == 200:
                print(f"[DEBUG] Success with bank-statement-lines endpoint")
                try:
                    response_json = resp2.json()
                    print(f"[DEBUG] Response:")
                    print(json.dumps(response_json, indent=2))
                except:
                    print(f"[DEBUG] Response (non-JSON): {resp2.text[:500]}")
                return JSONResponse(resp2.json())
            
            # Use the second response for error handling
            resp = resp2
        else:
            resp = resp1
    
    print(f"[DEBUG] Remote API response status: {resp.status_code}")
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to classify line")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        print(f"[DEBUG] Error detail: {error_detail}")
        print(f"[DEBUG] Full response: {resp.text[:500]}")
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


# Accounts API Endpoint (if not exists)
@app.get("/api/pharmacies/{pharmacy_id}/accounts")
async def api_get_pharmacy_accounts(request: Request, pharmacy_id: int) -> JSONResponse:
    """Proxy endpoint to get chart of accounts for a pharmacy - only accessible by admin users"""
    if not _check_admin_access(request):
        raise HTTPException(status_code=403, detail="Admin access restricted to admin users only")
    
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/accounts"
        resp = await client.get(url, headers=headers)
        
        if resp.status_code == 401 and API_KEY:
            alt_headers = {"X-API-Key": API_KEY}
            resp = await client.get(url, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch accounts")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.post("/setup/reactivate-charl")
async def setup_reactivate_charl(request: Request) -> JSONResponse:
    """Emergency endpoint to reactivate Charl's account (user_id: 2).
    This bypasses normal admin checks since we're in a catch-22 situation.
    Uses API_KEY to directly update the backend.
    """
    if not API_KEY:
        raise HTTPException(status_code=500, detail="API_KEY not configured")
    
    user_id = 2
    url = f"{API_BASE_URL}/admin/users/{user_id}"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    user_data = {
        "is_active": True
    }
    
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.put(url, json=user_data, headers=headers)
            
            # Try X-API-Key if Bearer fails
            if resp.status_code == 401:
                headers = {
                    "X-API-Key": API_KEY,
                    "Content-Type": "application/json"
                }
                resp = await client.put(url, json=user_data, headers=headers)
            
            if resp.status_code == 200:
                result = resp.json()
                return JSONResponse({
                    "success": True,
                    "message": "Charl's account has been reactivated successfully",
                    "user": result
                })
            else:
                error_detail = resp.json().get("detail", "Failed to reactivate account") if resp.headers.get("content-type", "").startswith("application/json") else "Failed to reactivate account"
                raise HTTPException(status_code=resp.status_code, detail=error_detail)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reactivating account: {str(e)}")


@app.post("/setup/create-admin-user")
async def setup_create_admin_user(request: Request) -> JSONResponse:
    """One-time setup endpoint to create the admin user.
    This endpoint uses the API_KEY to create the admin user directly.
    Only works if the admin user doesn't already exist.
    """
    if not API_KEY:
        raise HTTPException(status_code=500, detail="API_KEY not configured")
    
    url = f"{API_BASE_URL}/admin/users"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    user_data = {
        "username": "admin",
        "password": "Koeberg7#"
    }
    
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json=user_data, headers=headers)
            
            # Try X-API-Key if Bearer fails
            if resp.status_code == 401:
                headers = {
                    "X-API-Key": API_KEY,
                    "Content-Type": "application/json"
                }
                resp = await client.post(url, json=user_data, headers=headers)
            
            if resp.status_code == 200:
                result = resp.json()
                return JSONResponse({
                    "success": True,
                    "message": "Admin user created successfully",
                    "user": result
                })
            elif resp.status_code == 409 or resp.status_code == 400:
                # User might already exist
                error_detail = ""
                try:
                    error_data = resp.json()
                    error_detail = error_data.get("detail", error_data.get("message", ""))
                except:
                    error_detail = resp.text[:200]
                
                if "already exists" in error_detail.lower() or "duplicate" in error_detail.lower():
                    return JSONResponse({
                        "success": False,
                        "message": "Admin user already exists",
                        "error": error_detail
                    }, status_code=409)
                
                raise HTTPException(status_code=resp.status_code, detail=error_detail)
            else:
                error_detail = resp.json().get("detail", "Failed to create admin user") if resp.headers.get("content-type", "").startswith("application/json") else "Failed to create admin user"
                raise HTTPException(status_code=resp.status_code, detail=error_detail)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating admin user: {str(e)}")


@app.get("/reactivate-charl", response_class=HTMLResponse)
def reactivate_charl_page(request: Request):
    """Page to reactivate Charl's account"""
    return templates.TemplateResponse("reactivate_charl.html", {"request": request})


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/db-ping")
def db_ping() -> dict:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1")).scalar()
    return {"db": "up", "result": int(result)}


# Debtor Reminder API Proxy Endpoints
@app.get("/api/pharmacies/{pharmacy_id}/debtors/reports")
async def api_get_debtor_reports(request: Request, pharmacy_id: int) -> JSONResponse:
    """Proxy endpoint to get debtor report upload history"""
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=30) as client:
        url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/debtors/reports"
        resp = await client.get(url, headers=headers)
        
        if resp.status_code == 401:
            alt_headers = {"X-API-Key": API_KEY} if API_KEY else {}
            resp = await client.get(url, headers=alt_headers)
    
    if resp.status_code == 404:
        # Backend endpoint not implemented yet - return empty list
        print(f"[WARNING] Debtor reports endpoint not found at {url}")
        return JSONResponse([])
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch reports")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.get("/api/pharmacies/{pharmacy_id}/debtors")
async def api_get_debtors(request: Request, pharmacy_id: int, min_balance: float = None, ageing_buckets: str = None, has_email: bool = None, has_phone: bool = None, search: str = None, page: int = 1, per_page: int = 100, sort_by: str = None, sort_order: str = None) -> JSONResponse:
    """Proxy endpoint to get debtors list with filters"""
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    params = {}
    if min_balance is not None:
        params["min_balance"] = min_balance
    if ageing_buckets:
        params["ageing_buckets"] = ageing_buckets
    if has_email is not None:
        params["has_email"] = "true" if has_email else "false"
    if has_phone is not None:
        params["has_phone"] = "true" if has_phone else "false"
    if search:
        params["search"] = search
    if page:
        params["page"] = page
    if per_page:
        params["per_page"] = per_page
    if sort_by:
        params["sort_by"] = sort_by
    if sort_order:
        params["sort_order"] = sort_order
    
    async with httpx.AsyncClient(timeout=30) as client:
        url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/debtors"
        resp = await client.get(url, params=params, headers=headers)
        
        if resp.status_code == 401:
            alt_headers = {"X-API-Key": API_KEY} if API_KEY else {}
            resp = await client.get(url, params=params, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch debtors")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.get("/api/pharmacies/{pharmacy_id}/debtors/statistics")
async def api_get_debtor_statistics(request: Request, pharmacy_id: int) -> JSONResponse:
    """Proxy endpoint to get debtor statistics"""
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=30) as client:
        url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/debtors/statistics"
        resp = await client.get(url, headers=headers)
        
        if resp.status_code == 401:
            alt_headers = {"X-API-Key": API_KEY} if API_KEY else {}
            resp = await client.get(url, headers=alt_headers)
    
    if resp.status_code == 404:
        # Backend endpoint not implemented yet - return empty statistics
        print(f"[WARNING] Debtor statistics endpoint not found at {url}")
        return JSONResponse({
            "total_accounts": 0,
            "total_outstanding": 0,
            "current": 0,
            "d30": 0,
            "d60": 0,
            "d90": 0,
            "d120": 0,
            "d150": 0,
            "d180": 0
        })
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch statistics")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


@app.post("/api/pharmacies/{pharmacy_id}/debtors/send-email")
async def api_send_debtor_email(request: Request, pharmacy_id: int) -> JSONResponse:
    """Proxy endpoint to send emails to selected debtors"""
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"} if bearer else {"Content-Type": "application/json"}
    
    try:
        data = await request.json()
        
        async with httpx.AsyncClient(timeout=60) as client:
            url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/debtors/send-email"
            resp = await client.post(url, json=data, headers=headers)
            
            if resp.status_code == 401:
                alt_headers = {"X-API-Key": API_KEY, "Content-Type": "application/json"} if API_KEY else {"Content-Type": "application/json"}
                resp = await client.post(url, json=data, headers=alt_headers)
        
        if resp.status_code != 200:
            error_detail = (
                resp.json().get("detail", "Failed to send emails")
                if resp.headers.get("content-type", "").startswith("application/json")
                else f"Backend returned {resp.status_code}"
            )
            raise HTTPException(status_code=resp.status_code, detail=error_detail)
        
        return JSONResponse(resp.json())
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to send emails: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send emails: {str(e)}")


@app.post("/api/pharmacies/{pharmacy_id}/debtors/send-sms")
async def api_send_debtor_sms(request: Request, pharmacy_id: int) -> JSONResponse:
    """Proxy endpoint to send SMS to selected debtors"""
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"} if bearer else {"Content-Type": "application/json"}
    
    try:
        data = await request.json()
        
        async with httpx.AsyncClient(timeout=60) as client:
            url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/debtors/send-sms"
            resp = await client.post(url, json=data, headers=headers)
            
            if resp.status_code == 401:
                alt_headers = {"X-API-Key": API_KEY, "Content-Type": "application/json"} if API_KEY else {"Content-Type": "application/json"}
                resp = await client.post(url, json=data, headers=alt_headers)
        
        if resp.status_code != 200:
            error_detail = (
                resp.json().get("detail", "Failed to send SMS")
                if resp.headers.get("content-type", "").startswith("application/json")
                else f"Backend returned {resp.status_code}"
            )
            raise HTTPException(status_code=resp.status_code, detail=error_detail)
        
        return JSONResponse(resp.json())
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to send SMS: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send SMS: {str(e)}")


@app.post("/api/pharmacies/{pharmacy_id}/debtors/download-csv")
async def api_download_debtor_csv(request: Request, pharmacy_id: int) -> JSONResponse:
    """Proxy endpoint to download CSV of debtors"""
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"} if bearer else {"Content-Type": "application/json"}
    
    try:
        data = await request.json()
        
        async with httpx.AsyncClient(timeout=60) as client:
            url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/debtors/download-csv"
            resp = await client.post(url, json=data, headers=headers)
            
            if resp.status_code == 401:
                alt_headers = {"X-API-Key": API_KEY, "Content-Type": "application/json"} if API_KEY else {"Content-Type": "application/json"}
                resp = await client.post(url, json=data, headers=alt_headers)
        
        if resp.status_code != 200:
            error_detail = (
                resp.json().get("detail", "Failed to download CSV")
                if resp.headers.get("content-type", "").startswith("application/json")
                else f"Backend returned {resp.status_code}"
            )
            raise HTTPException(status_code=resp.status_code, detail=error_detail)
        
        # Return CSV file
        from fastapi.responses import Response
        import time
        return Response(
            content=resp.content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="debtors_{pharmacy_id}_{int(time.time())}.csv"'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to download CSV: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download CSV: {str(e)}")


@app.post("/api/pharmacies/{pharmacy_id}/debtors/download-pdf")
async def api_download_debtor_pdf(request: Request, pharmacy_id: int) -> JSONResponse:
    """Proxy endpoint to download PDF of debtors"""
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"} if bearer else {"Content-Type": "application/json"}
    
    try:
        data = await request.json()
        
        async with httpx.AsyncClient(timeout=60) as client:
            url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/debtors/download-pdf"
            resp = await client.post(url, json=data, headers=headers)
            
            if resp.status_code == 401:
                alt_headers = {"X-API-Key": API_KEY, "Content-Type": "application/json"} if API_KEY else {"Content-Type": "application/json"}
                resp = await client.post(url, json=data, headers=alt_headers)
        
        if resp.status_code != 200:
            error_detail = (
                resp.json().get("detail", "Failed to download PDF")
                if resp.headers.get("content-type", "").startswith("application/json")
                else f"Backend returned {resp.status_code}"
            )
            raise HTTPException(status_code=resp.status_code, detail=error_detail)
        
        # Return PDF file
        from fastapi.responses import Response
        import time
        return Response(
            content=resp.content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="debtors_{pharmacy_id}_{int(time.time())}.pdf"'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to download PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download PDF: {str(e)}")


@app.get("/api/pharmacies/{pharmacy_id}/debtors/{debtor_id}/communications")
async def api_get_debtor_communications(request: Request, pharmacy_id: int, debtor_id: int) -> JSONResponse:
    """Proxy endpoint to get communication history for a debtor"""
    bearer = request.session.get("auth_token") or API_KEY or ""
    headers = {"Authorization": f"Bearer {bearer}"} if bearer else {}
    
    async with httpx.AsyncClient(timeout=30) as client:
        url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/debtors/{debtor_id}/communications"
        resp = await client.get(url, headers=headers)
        
        if resp.status_code == 401:
            alt_headers = {"X-API-Key": API_KEY} if API_KEY else {}
            resp = await client.get(url, headers=alt_headers)
    
    if resp.status_code != 200:
        error_detail = (
            resp.json().get("detail", "Failed to fetch communications")
            if resp.headers.get("content-type", "").startswith("application/json")
            else f"Backend returned {resp.status_code}"
        )
        raise HTTPException(status_code=resp.status_code, detail=error_detail)
    
    return JSONResponse(resp.json())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 