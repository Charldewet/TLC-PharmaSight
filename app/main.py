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
from datetime import date, datetime, timedelta
from calendar import monthrange
import csv
import io
import pytz
import hashlib
import json
import re
from openai import OpenAI
from .db import engine

# Load environment variables
load_dotenv()

app = FastAPI(title="BudgetingApp")

# CORS middleware for mobile app and web app support
# Note: allow_credentials=True requires explicit origins (not "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8080",
        "http://localhost:5500",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:5500",
        "https://pharmasight.co.za",
        "https://www.pharmasight.co.za",
        "https://pharmasight-qdv0.onrender.com",
        "https://pharmacy-api-webservice.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Config
API_BASE_URL = os.getenv("PHARMA_API_BASE", "https://pharmacy-api-webservice.onrender.com")
API_KEY = os.getenv("PHARMA_API_KEY", "")
SESSION_SECRET = os.getenv("SESSION_SECRET_KEY", "change-me")

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# South Africa timezone for insights
SA_TIMEZONE = pytz.timezone("Africa/Johannesburg")
DAILY_CUTOFF_HOUR = 18  # 18:00 SA time

# In-memory cache for insights (in production, use Redis or database)
insights_cache = {}

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


# =====================================================
# AI DASHBOARD INSIGHTS
# =====================================================

def get_cache_key(pharmacy_id: int, mode: str, date_key: str) -> str:
    """Generate a cache key for insights"""
    return f"{pharmacy_id}:{mode}:{date_key}"


async def fetch_mtd_metrics(request: Request, pharmacy_id: int, month: str, through_date: str) -> dict:
    """Fetch MTD metrics using the /pharmacies/{pharmacy_id}/mtd endpoint
    
    Args:
        request: FastAPI request object
        pharmacy_id: Pharmacy ID
        month: Month in YYYY-MM format
        through_date: Date to aggregate through in YYYY-MM-DD format
    
    Returns:
        dict with turnover, gp_value, gp_percentage, purchases, transaction_count, 
        avg_basket, days_count, dispensary_gp_pct, frontshop_gp_pct
    """
    headers = _auth_headers(request)
    metrics = {
        "turnover": 0,
        "gp_value": 0,
        "gp_percentage": 0,
        "purchases": 0,
        "transaction_count": 0,
        "avg_basket": 0,
        "days_count": 0,
        "dispensary_gp_pct": 0,
        "frontshop_gp_pct": 0,
        "dispensary_turnover": 0,
        "frontshop_turnover": 0,
        "scripts_qty": 0,
        "type_r_sales": 0,
    }
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            # Fetch MTD data using the standardized endpoint
            url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/mtd?month={month}&through={through_date}"
            print(f"[DEBUG] Fetching MTD metrics from: {url}")
            
            resp = await client.get(url, headers=headers)
            if resp.status_code == 401 and API_KEY:
                # Retry with X-API-Key if bearer rejected
                resp = await client.get(url, headers={"X-API-Key": API_KEY})
            
            if resp.status_code == 200:
                data = resp.json()
                print(f"[DEBUG] MTD API Response: {data}")
                
                # Map API response to our metrics format
                metrics["turnover"] = float(data.get("turnover", 0) or 0)
                metrics["gp_value"] = float(data.get("gp_value", 0) or 0)
                metrics["purchases"] = float(data.get("purchases", 0) or 0)
                metrics["transaction_count"] = int(data.get("transaction_count", 0) or 0)
                metrics["dispensary_turnover"] = float(data.get("dispensary_turnover", 0) or 0)
                metrics["frontshop_turnover"] = float(data.get("frontshop_turnover", 0) or 0)
                metrics["scripts_qty"] = int(data.get("scripts_qty", 0) or 0)
                metrics["type_r_sales"] = float(data.get("type_r_sales", 0) or 0)
                
                # Calculate GP percentage
                if metrics["turnover"] > 0:
                    metrics["gp_percentage"] = (metrics["gp_value"] / metrics["turnover"]) * 100
                
                # Calculate average basket
                if metrics["transaction_count"] > 0:
                    metrics["avg_basket"] = metrics["turnover"] / metrics["transaction_count"]
                
                # Calculate days count from month start to through_date
                month_start = datetime.strptime(f"{month}-01", "%Y-%m-%d")
                through_dt = datetime.strptime(through_date, "%Y-%m-%d")
                metrics["days_count"] = (through_dt - month_start).days + 1
            else:
                print(f"[ERROR] MTD API returned status {resp.status_code}: {resp.text[:200]}")
            
            # Fetch GP breakdown for dispensary/frontshop GP%
            from_date = f"{month}-01"
            gp_url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/days/gp-breakdown?from={from_date}&to={through_date}"
            gp_resp = await client.get(gp_url, headers=headers)
            if gp_resp.status_code == 200:
                gp_data = gp_resp.json()
                metrics["dispensary_gp_pct"] = float(gp_data.get("dispensary", {}).get("gp_percentage", 0) or 0)
                metrics["frontshop_gp_pct"] = float(gp_data.get("frontshop", {}).get("gp_percentage", 0) or 0)
                
        except Exception as e:
            print(f"[ERROR] Failed to fetch MTD metrics: {e}")
            import traceback
            traceback.print_exc()
    
    return metrics


async def fetch_pharmacy_metrics(request: Request, pharmacy_id: int, from_date: str, to_date: str) -> dict:
    """Fetch aggregated metrics for a date range from the pharmacy API (legacy function)"""
    headers = _auth_headers(request)
    metrics = {
        "turnover": 0,
        "gp_value": 0,
        "gp_percentage": 0,
        "purchases": 0,
        "transaction_count": 0,
        "avg_basket": 0,
        "days_count": 0,
        "dispensary_gp_pct": 0,
        "frontshop_gp_pct": 0,
    }
    
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            # Fetch daily data for the range
            url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/days?from={from_date}&to={to_date}"
            resp = await client.get(url, headers=headers)
            
            if resp.status_code == 200:
                days_data = resp.json()
                if isinstance(days_data, list) and len(days_data) > 0:
                    metrics["days_count"] = len(days_data)
                    for day in days_data:
                        metrics["turnover"] += float(day.get("turnover", 0) or 0)
                        metrics["gp_value"] += float(day.get("gp_value", 0) or day.get("gp", 0) or 0)
                        metrics["purchases"] += float(day.get("purchases", 0) or 0)
                        metrics["transaction_count"] += int(day.get("transaction_count", 0) or day.get("transactions", 0) or 0)
                    
                    # Calculate aggregated metrics
                    if metrics["turnover"] > 0:
                        metrics["gp_percentage"] = (metrics["gp_value"] / metrics["turnover"]) * 100
                    if metrics["transaction_count"] > 0:
                        metrics["avg_basket"] = metrics["turnover"] / metrics["transaction_count"]
            
            # Fetch GP breakdown
            gp_url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/days/gp-breakdown?from={from_date}&to={to_date}"
            gp_resp = await client.get(gp_url, headers=headers)
            if gp_resp.status_code == 200:
                gp_data = gp_resp.json()
                metrics["dispensary_gp_pct"] = float(gp_data.get("dispensary", {}).get("gp_percentage", 0) or 0)
                metrics["frontshop_gp_pct"] = float(gp_data.get("frontshop", {}).get("gp_percentage", 0) or 0)
                
        except Exception as e:
            print(f"[ERROR] Failed to fetch pharmacy metrics: {e}")
    
    return metrics


async def fetch_comparison_metrics(request: Request, pharmacy_id: int, from_date: str, to_date: str) -> dict:
    """Fetch previous year metrics for comparison (legacy function)"""
    # Parse dates and adjust to previous year
    from_dt = datetime.strptime(from_date, "%Y-%m-%d")
    to_dt = datetime.strptime(to_date, "%Y-%m-%d")
    
    prev_from = from_dt.replace(year=from_dt.year - 1).strftime("%Y-%m-%d")
    prev_to = to_dt.replace(year=to_dt.year - 1).strftime("%Y-%m-%d")
    
    return await fetch_pharmacy_metrics(request, pharmacy_id, prev_from, prev_to)


async def calculate_group_average_metrics(request: Request, from_date: str, to_date: str, exclude_pharmacy_id: int = None) -> dict:
    """Calculate group average metrics from all pharmacies (excluding pharmacy 100 and optionally another pharmacy)
    
    Returns a dict with average turnover growth (yoy_growth), GP%, etc.
    Uses parallel fetching for better performance.
    """
    import asyncio
    headers = _auth_headers(request)
    
    # Get list of all pharmacies
    pharmacy_ids = []
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            # Try to get pharmacies from admin endpoint
            url = f"{API_BASE_URL}/admin/pharmacies"
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                pharmacies = resp.json()
                if isinstance(pharmacies, list):
                    pharmacy_ids = [p.get("pharmacy_id") or p.get("id") for p in pharmacies 
                                   if (p.get("pharmacy_id") or p.get("id")) is not None]
        except Exception as e:
            print(f"[DEBUG] Could not fetch pharmacy list: {e}")
    
    # If we couldn't get the list, use a known set of pharmacy IDs (fallback)
    if not pharmacy_ids:
        # Fallback to known pharmacy IDs (1-10 typically, adjust as needed)
        pharmacy_ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    
    # Exclude pharmacy 100 (group aggregate) and optionally the current pharmacy
    pharmacy_ids = [pid for pid in pharmacy_ids if pid != 100 and pid != exclude_pharmacy_id]
    
    if not pharmacy_ids:
        return None
    
    # Helper function to fetch metrics for a single pharmacy
    async def fetch_pharmacy_data(pid):
        try:
            current_metrics = await fetch_pharmacy_metrics(request, pid, from_date, to_date)
            prev_metrics = await fetch_comparison_metrics(request, pid, from_date, to_date)
            return {"current": current_metrics, "prev": prev_metrics, "pid": pid}
        except Exception as e:
            print(f"[DEBUG] Error fetching metrics for pharmacy {pid}: {e}")
            return None
    
    # Fetch all pharmacy metrics in parallel
    results = await asyncio.gather(*[fetch_pharmacy_data(pid) for pid in pharmacy_ids], return_exceptions=True)
    
    # Calculate metrics from results
    total_turnover_current = 0
    total_turnover_prev = 0
    total_gp_value = 0
    total_gp_pct_sum = 0
    pharmacies_with_data = 0
    
    for result in results:
        if result is None or isinstance(result, Exception):
            continue
        
        current_metrics = result["current"]
        prev_metrics = result["prev"]
        
        if current_metrics.get("turnover", 0) > 0 and current_metrics.get("days_count", 0) > 0:
            total_turnover_current += current_metrics["turnover"]
            total_turnover_prev += prev_metrics.get("turnover", 0)
            total_gp_value += current_metrics.get("gp_value", 0)
            
            if current_metrics.get("gp_percentage", 0) > 0:
                total_gp_pct_sum += current_metrics["gp_percentage"]
                pharmacies_with_data += 1
    
    if pharmacies_with_data == 0 or total_turnover_current == 0:
        return None
    
    # Calculate group averages
    group_metrics = {
        "turnover": total_turnover_current,
        "gp_value": total_gp_value,
        "gp_percentage": total_gp_pct_sum / pharmacies_with_data if pharmacies_with_data > 0 else 0,
        "pharmacies_count": pharmacies_with_data
    }
    
    # Calculate YoY growth
    if total_turnover_prev > 0:
        group_metrics["yoy_growth"] = ((total_turnover_current - total_turnover_prev) / total_turnover_prev) * 100
    else:
        group_metrics["yoy_growth"] = None
    
    print(f"[DEBUG] Group average calculated from {pharmacies_with_data} pharmacies: YoY growth = {group_metrics.get('yoy_growth', 'N/A')}%")
    
    return group_metrics


def get_pharmasight_system_prompt() -> str:
    """Get the comprehensive PharmaSight system prompt with all threshold rules"""
    return """📌 SYSTEM INSTRUCTION — PHARMASIGHT INSIGHTS ENGINE

You are a senior retail pharmacy business consultant.

You analyse three datasets:
- Current Month-to-Date (MTD)
- Last Year MTD (same period)
- Last Month MTD (same period)

Your job is to generate short, meaningful, business-focused insights for a pharmacy owner.
You must follow the thresholds and acceptable ranges below.

📊 METRIC RULES & THRESHOLDS

🎯 Turnover YoY (Year-on-Year)
- Green (1): Growth > 0% or decline < 5%
- Orange (2): Decline 5–10%
- Red (3): Decline > 10%

🎯 Turnover MoM (Month-on-Month)
- Green (1): Growth > 0% or decline < 5%
- Orange (2): Decline 5–10%
- Red (3): Decline > 10%

💰 Gross Profit % (Overall)
- Green (1): 24%–27% (Acceptable/Healthy) or > 27% (Excellent)
- Orange (2): 23%–24% (Warning)
- Red (3): < 23% (Concerning)

Note: GP% between 24% and 25% is considered acceptable and should not trigger warnings unless other metrics are also concerning.

🛒 Basket Size
- Green (1): R180–R260 (Healthy) or > R260 (Strong)
- Orange (2): R170–R180 (Warning)
- Red (3): < R170 (Concerning)

📦 Purchases vs Cost of Sales
- Green (1): Within ±10% of CoS
- Orange (2): ±10–15% of CoS
- Red (3): > ±15% of CoS

🧾 Transactions YoY
- Green (1): Change within ±8%
- Orange (2): Decline 8–15%
- Red (3): Decline > 15%

📜 Scripts YoY
- Green (1): Change within ±8%
- Orange (2): Decline 8–15%
- Red (3): Decline > 15%

🧠 INSIGHT GENERATION RULES

✔ Generate insight cards for:
  - Positive performance (green status) when metrics are strong or showing significant improvement
  - Warning/critical issues (orange/red status) when thresholds are exceeded
✔ Always include at least 1-2 positive insights when metrics are performing well
✔ Prioritize highlighting strong turnover growth, excellent GP%, or strong basket size as positive insights
✔ Insights must feel like a consultant speaking directly to a pharmacy owner
✔ Be concise and practical
✔ Do NOT mention dispensary/frontshop GP% or mix - we do not have that data

📌 PRIORITIZATION FOR HIGHLIGHT SUMMARY:
- If turnover YoY growth is positive (> 0%), prioritize highlighting this growth in the summary
- Only mention GP% concerns if GP% is below 24% (red status) or if turnover is also declining
- If turnover is growing but GP% is 24-25%, focus on the positive turnover growth rather than GP% concerns
- Always lead with the most significant positive metric when available

📝 REQUIRED OUTPUT STRUCTURE

Produce a JSON object in the following schema:

{
  "highlight_summary": "string (2 sentences summarizing the most important insight(s))",
  "detailed_analysis": "string (1–2 paragraphs giving deeper explanation in consultant tone)",
  "metric_evaluations": [
    {
      "metric": "turnover_yoy | turnover_mom | gp_percentage | basket_size | purchases_vs_cos | transactions_yoy | scripts_yoy",
      "label": "string (human-readable metric name)",
      "status": 1 | 2 | 3,
      "value": "string (the actual value with unit, e.g. 'R1,234,567' or '24.5%' or '+6.5%')",
      "feedback": "string (ONE sentence explaining the status)"
    }
  ],
  "insights": [
    {
      "id": "string",
      "category": "turnover | gp | purchases | stock | basket | scripts | transactions | data_quality | other",
      "severity": "critical | warning | positive | info",
      "icon": "string (trend_up, trend_down, check, alert, warning, info)",
      "title": "string",
      "summary": "string (1–2 sentences for card)",
      "detail": "string (expanded modal explanation, 2–4 sentences)",
      "suggested_actions": ["string"],
      "metrics": {
        "optional": "raw metrics referenced"
      }
    }
  ]
}

IMPORTANT FOR metric_evaluations:
- ALWAYS include ALL 7 metrics listed above in the metric_evaluations array
- Each metric gets exactly ONE sentence of feedback
- Status: 1 = Green (good), 2 = Orange (warning), 3 = Red (critical)
- Include the actual value for each metric

Very important:
- ALWAYS generate EXACTLY 3 insights in the insights array
- Balance the 3 insights across severities: include at least one positive (green) insight
- If there are critical or warning issues, include those first, then fill remaining slots with positive insights
- If all metrics are healthy, generate 3 positive insights highlighting different strengths
- Positive insights should highlight: turnover growth, healthy GP%, healthy basket size, stable transactions
- Order insights by severity: critical (red) first, then warning (orange), then positive (green)
- metric_evaluations must ALWAYS have all 7 metrics
- Keep all writing concise and free of unnecessary wording.
- Return ONLY valid JSON, no markdown code blocks or additional text."""


async def generate_insights_with_openai(
    metrics: dict, 
    prev_year_metrics: dict = None, 
    prev_month_metrics: dict = None, 
    pharmacy_name: str = "",
    period_start: str = "",
    period_end: str = ""
) -> dict:
    """Generate comprehensive insights using OpenAI with the PharmaSight engine
    
    Args:
        metrics: Current MTD metrics
        prev_year_metrics: Same period last year metrics
        prev_month_metrics: Same period last month metrics
        pharmacy_name: Name of the pharmacy
        period_start: Period start date (YYYY-MM-DD)
        period_end: Period end date (YYYY-MM-DD)
    
    Returns:
        dict with highlight_summary, detailed_analysis, and insights array
    """
    if not openai_client:
        # Return fallback insights if OpenAI is not configured
        return generate_fallback_insights_structured(metrics, prev_year_metrics, prev_month_metrics)
    
    # Create cache key based on metrics hash (cache for same data)
    cache_key_data = {
        "turnover": round(metrics.get('turnover', 0), 2),
        "gp_pct": round(metrics.get('gp_percentage', 0), 1),
        "transactions": metrics.get('transaction_count', 0),
        "basket": round(metrics.get('avg_basket', 0), 2),
        "prev_year_turnover": round(prev_year_metrics.get('turnover', 0), 2) if prev_year_metrics else 0,
        "prev_month_turnover": round(prev_month_metrics.get('turnover', 0), 2) if prev_month_metrics else 0,
        "period": f"{period_start}_{period_end}"
    }
    cache_key = hashlib.md5(json.dumps(cache_key_data, sort_keys=True).encode()).hexdigest()
    
    # Check cache first
    if cache_key in insights_cache:
        cached_result = insights_cache[cache_key]
        print(f"[DEBUG] Using cached OpenAI insights for key: {cache_key[:8]}...")
        return cached_result
    
    try:
        system_prompt = get_pharmasight_system_prompt()
        
        # Build the user prompt with all 3 MTD datasets (no group, no dispensary/frontshop GP%)
        user_prompt = f"""Use the following 3 MTD datasets to generate insights according to the system instruction.

Pharmacy: {pharmacy_name or 'Unknown'}
Period: {period_start} to {period_end}

=== CURRENT MTD ===
- Turnover: R{metrics.get('turnover', 0):,.2f}
- Gross Profit: R{metrics.get('gp_value', 0):,.2f}
- GP%: {metrics.get('gp_percentage', 0):.1f}%
- Purchases: R{metrics.get('purchases', 0):,.2f}
- Cost of Sales: R{metrics.get('cost_of_sales', metrics.get('turnover', 0) - metrics.get('gp_value', 0)):,.2f}
- Transactions: {metrics.get('transaction_count', 0):,}
- Average Basket: R{metrics.get('avg_basket', 0):,.2f}
- Scripts: {metrics.get('scripts_qty', 0):,}
"""

        if prev_year_metrics and prev_year_metrics.get('turnover', 0) > 0:
            yoy_growth = ((metrics.get('turnover', 0) - prev_year_metrics.get('turnover', 0)) / prev_year_metrics.get('turnover', 1)) * 100
            user_prompt += f"""
=== LAST YEAR MTD (Same Period) ===
- Turnover: R{prev_year_metrics.get('turnover', 0):,.2f}
- YoY Growth: {yoy_growth:+.1f}%
- GP%: {prev_year_metrics.get('gp_percentage', 0):.1f}%
- Transactions: {prev_year_metrics.get('transaction_count', 0):,}
- Average Basket: R{prev_year_metrics.get('avg_basket', 0):,.2f}
- Scripts: {prev_year_metrics.get('scripts_qty', 0):,}
"""

        if prev_month_metrics and prev_month_metrics.get('turnover', 0) > 0:
            mom_growth = ((metrics.get('turnover', 0) - prev_month_metrics.get('turnover', 0)) / prev_month_metrics.get('turnover', 1)) * 100
            user_prompt += f"""
=== LAST MONTH MTD (Same Period) ===
- Turnover: R{prev_month_metrics.get('turnover', 0):,.2f}
- MoM Growth: {mom_growth:+.1f}%
- GP%: {prev_month_metrics.get('gp_percentage', 0):.1f}%
- Transactions: {prev_month_metrics.get('transaction_count', 0):,}
- Average Basket: R{prev_month_metrics.get('avg_basket', 0):,.2f}
- Scripts: {prev_month_metrics.get('scripts_qty', 0):,}
"""

        user_prompt += """
Generate the JSON response following the system instruction schema."""

        print(f"[DEBUG] Calling OpenAI with PharmaSight prompt...")

        # Use timeout and reduced tokens for faster response
        import asyncio
        try:
            # Wrap OpenAI call with timeout (12 seconds max)
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    lambda: openai_client.chat.completions.create(
                        model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
                        max_tokens=1200,  # Reduced from 2000 for faster response
                        temperature=0.7,
                        response_format={"type": "json_object"}
                    )
                ),
                timeout=12.0
            )
        except asyncio.TimeoutError:
            print(f"[WARNING] OpenAI call timed out after 12 seconds, using fallback")
            return generate_fallback_insights_structured(metrics, prev_year_metrics, prev_month_metrics)
        except Exception as timeout_error:
            print(f"[WARNING] OpenAI call failed: {timeout_error}, using fallback")
            return generate_fallback_insights_structured(metrics, prev_year_metrics, prev_month_metrics)
        
        response_text = response.choices[0].message.content
        print(f"[DEBUG] OpenAI response: {response_text[:500]}...")
        
        # Parse JSON response
        result = json.loads(response_text)
        
        # Validate required fields
        if "highlight_summary" not in result:
            result["highlight_summary"] = "Performance data is being analyzed."
        if "detailed_analysis" not in result:
            result["detailed_analysis"] = ""
        if "metric_evaluations" not in result:
            result["metric_evaluations"] = []
        if "insights" not in result:
            result["insights"] = []
        
        # Balance insights to ensure at least one of each severity type when available
        result["insights"] = balance_insights_by_severity(result["insights"])
        
        # Cache the result (limit cache size to prevent memory issues)
        if len(insights_cache) > 100:
            # Remove oldest entry (simple FIFO)
            oldest_key = next(iter(insights_cache))
            del insights_cache[oldest_key]
        insights_cache[cache_key] = result
        
        return result
        
    except Exception as e:
        print(f"[ERROR] OpenAI API error: {e}")
        import traceback
        traceback.print_exc()
        return generate_fallback_insights_structured(metrics, prev_year_metrics, prev_month_metrics)


def generate_fallback_insights_structured(
    metrics: dict, 
    prev_year_metrics: dict = None, 
    prev_month_metrics: dict = None
) -> dict:
    """Generate structured fallback insights without OpenAI
    
    Returns the same structure as the OpenAI response, including metric_evaluations
    """
    turnover = metrics.get('turnover', 0)
    gp_pct = metrics.get('gp_percentage', 0)
    avg_basket = metrics.get('avg_basket', 0)
    transactions = metrics.get('transaction_count', 0)
    scripts = metrics.get('script_count', 0)
    purchases = metrics.get('purchases', 0)
    cos = metrics.get('cost_of_sales', 0)
    
    turnover_formatted = f"R{turnover:,.0f}"
    gp_formatted = f"{gp_pct:.1f}%"
    basket_formatted = f"R{avg_basket:,.0f}"
    
    # Calculate YoY growth
    yoy_growth = None
    if prev_year_metrics and prev_year_metrics.get('turnover', 0) > 0:
        yoy_growth = ((turnover - prev_year_metrics.get('turnover', 0)) / prev_year_metrics.get('turnover', 1)) * 100
    
    # Calculate MoM growth
    mom_growth = None
    if prev_month_metrics and prev_month_metrics.get('turnover', 0) > 0:
        mom_growth = ((turnover - prev_month_metrics.get('turnover', 0)) / prev_month_metrics.get('turnover', 1)) * 100
    
    # Calculate Transactions YoY
    transactions_yoy = None
    if prev_year_metrics and prev_year_metrics.get('transaction_count', 0) > 0:
        transactions_yoy = ((transactions - prev_year_metrics.get('transaction_count', 0)) / prev_year_metrics.get('transaction_count', 1)) * 100
    
    # Calculate Scripts YoY
    scripts_yoy = None
    if prev_year_metrics and prev_year_metrics.get('script_count', 0) > 0:
        scripts_yoy = ((scripts - prev_year_metrics.get('script_count', 0)) / prev_year_metrics.get('script_count', 1)) * 100
    
    # Calculate Purchases vs CoS
    purchases_vs_cos = None
    if cos > 0:
        purchases_vs_cos = ((purchases - cos) / cos) * 100
    
    insights = []
    highlight_parts = []
    detail_parts = []
    metric_evaluations = []
    
    # === METRIC EVALUATIONS (always all 7) ===
    
    # 1. Turnover YoY
    if yoy_growth is not None:
        if yoy_growth > 0 or yoy_growth >= -5:
            status = 1
            feedback = f"Turnover is tracking well compared to last year with a {'+' if yoy_growth > 0 else ''}{yoy_growth:.1f}% change."
        elif yoy_growth >= -10:
            status = 2
            feedback = f"Turnover is down {abs(yoy_growth):.1f}% year-on-year, which warrants monitoring."
        else:
            status = 3
            feedback = f"Turnover has declined significantly by {abs(yoy_growth):.1f}% compared to last year."
        metric_evaluations.append({
            "metric": "turnover_yoy",
            "label": "Turnover YoY",
            "status": status,
            "value": f"{'+' if yoy_growth > 0 else ''}{yoy_growth:.1f}%",
            "feedback": feedback
        })
    else:
        metric_evaluations.append({
            "metric": "turnover_yoy",
            "label": "Turnover YoY",
            "status": 1,
            "value": "N/A",
            "feedback": "No prior year data available for comparison."
        })
    
    # 2. Turnover MoM
    if mom_growth is not None:
        if mom_growth > 0 or mom_growth >= -5:
            status = 1
            feedback = f"Turnover is tracking well compared to last month with a {'+' if mom_growth > 0 else ''}{mom_growth:.1f}% change."
        elif mom_growth >= -10:
            status = 2
            feedback = f"Turnover is down {abs(mom_growth):.1f}% month-on-month, which warrants monitoring."
        else:
            status = 3
            feedback = f"Turnover has declined significantly by {abs(mom_growth):.1f}% compared to last month."
        metric_evaluations.append({
            "metric": "turnover_mom",
            "label": "Turnover MoM",
            "status": status,
            "value": f"{'+' if mom_growth > 0 else ''}{mom_growth:.1f}%",
            "feedback": feedback
        })
    else:
        metric_evaluations.append({
            "metric": "turnover_mom",
            "label": "Turnover MoM",
            "status": 1,
            "value": "N/A",
            "feedback": "No prior month data available for comparison."
        })
    
    # 3. GP Percentage
    if gp_pct >= 24:
        status = 1
        if gp_pct > 27:
            feedback = f"Excellent GP margin of {gp_pct:.1f}% exceeds the 27% target."
        else:
            feedback = f"GP margin of {gp_pct:.1f}% is within the acceptable 24-27% range."
    elif gp_pct >= 23:
        status = 2
        feedback = f"GP margin of {gp_pct:.1f}% is below the 24% acceptable threshold and should be monitored."
    else:
        status = 3
        feedback = f"GP margin of {gp_pct:.1f}% is critically low and requires immediate attention."
    metric_evaluations.append({
        "metric": "gp_percentage",
        "label": "Gross Profit %",
        "status": status,
        "value": f"{gp_pct:.1f}%",
        "feedback": feedback
    })
    
    # 4. Basket Size
    if avg_basket >= 180 and avg_basket <= 260:
        status = 1
        feedback = f"Average basket of {basket_formatted} is within the healthy R180-R260 range."
    elif avg_basket > 260:
        status = 1
        feedback = f"Strong average basket of {basket_formatted} exceeds the R260 target."
    elif avg_basket >= 170:
        status = 2
        feedback = f"Average basket of {basket_formatted} is below the R180 healthy threshold."
    else:
        status = 3
        feedback = f"Average basket of {basket_formatted} is concerning and below R170."
    metric_evaluations.append({
        "metric": "basket_size",
        "label": "Average Basket Size",
        "status": status,
        "value": basket_formatted,
        "feedback": feedback
    })
    
    # 5. Purchases vs CoS
    if purchases_vs_cos is not None:
        if abs(purchases_vs_cos) <= 10:
            status = 1
            feedback = f"Purchases are within {purchases_vs_cos:+.1f}% of cost of sales, which is normal."
        elif abs(purchases_vs_cos) <= 15:
            status = 2
            feedback = f"Purchases are {purchases_vs_cos:+.1f}% {'above' if purchases_vs_cos > 0 else 'below'} cost of sales, which warrants attention."
        else:
            status = 3
            feedback = f"Purchases are {purchases_vs_cos:+.1f}% {'above' if purchases_vs_cos > 0 else 'below'} cost of sales, which is concerning."
        metric_evaluations.append({
            "metric": "purchases_vs_cos",
            "label": "Purchases vs Cost of Sales",
            "status": status,
            "value": f"{purchases_vs_cos:+.1f}%",
            "feedback": feedback
        })
    else:
        metric_evaluations.append({
            "metric": "purchases_vs_cos",
            "label": "Purchases vs Cost of Sales",
            "status": 1,
            "value": "N/A",
            "feedback": "Cost of sales data not available for comparison."
        })
    
    # 6. Transactions YoY
    if transactions_yoy is not None:
        if transactions_yoy >= -8:
            status = 1
            feedback = f"Transaction count is {'+' if transactions_yoy > 0 else ''}{transactions_yoy:.1f}% compared to last year, within normal range."
        elif transactions_yoy >= -15:
            status = 2
            feedback = f"Transaction count is down {abs(transactions_yoy):.1f}% year-on-year, which warrants investigation."
        else:
            status = 3
            feedback = f"Transaction count has dropped significantly by {abs(transactions_yoy):.1f}% compared to last year."
        metric_evaluations.append({
            "metric": "transactions_yoy",
            "label": "Transactions YoY",
            "status": status,
            "value": f"{'+' if transactions_yoy > 0 else ''}{transactions_yoy:.1f}%",
            "feedback": feedback
        })
    else:
        metric_evaluations.append({
            "metric": "transactions_yoy",
            "label": "Transactions YoY",
            "status": 1,
            "value": "N/A",
            "feedback": "No prior year transaction data available for comparison."
        })
    
    # 7. Scripts YoY
    if scripts_yoy is not None:
        if scripts_yoy >= -8:
            status = 1
            feedback = f"Script count is {'+' if scripts_yoy > 0 else ''}{scripts_yoy:.1f}% compared to last year, within normal range."
        elif scripts_yoy >= -15:
            status = 2
            feedback = f"Script count is down {abs(scripts_yoy):.1f}% year-on-year, which warrants investigation."
        else:
            status = 3
            feedback = f"Script count has dropped significantly by {abs(scripts_yoy):.1f}% compared to last year."
        metric_evaluations.append({
            "metric": "scripts_yoy",
            "label": "Scripts YoY",
            "status": status,
            "value": f"{'+' if scripts_yoy > 0 else ''}{scripts_yoy:.1f}%",
            "feedback": feedback
        })
    else:
        metric_evaluations.append({
            "metric": "scripts_yoy",
            "label": "Scripts YoY",
            "status": 1,
            "value": "N/A",
            "feedback": "No prior year script data available for comparison."
        })
    
    # === INSIGHTS (positive, warning, and critical) ===
    
    # POSITIVE INSIGHTS - Generate when metrics are performing well
    
    # Strong turnover YoY growth
    if yoy_growth is not None and yoy_growth > 5:
        insights.append({
            "id": "turnover_yoy_strong",
            "category": "turnover",
            "severity": "positive",
            "icon": "trend_up",
            "title": "Strong Year-on-Year Growth",
            "summary": f"Turnover is up {yoy_growth:.1f}% compared to last year, showing excellent growth.",
            "detail": f"Your turnover growth of {yoy_growth:.1f}% year-on-year demonstrates strong business performance and effective sales strategies. This growth indicates successful customer engagement and market expansion.",
            "suggested_actions": ["Identify key growth drivers", "Maintain current momentum", "Consider scaling successful strategies"],
            "metrics": {"yoy_growth": yoy_growth, "current": turnover, "last_year": prev_year_metrics.get('turnover', 0)}
        })
    elif yoy_growth is not None and yoy_growth > 0:
        insights.append({
            "id": "turnover_yoy_positive",
            "category": "turnover",
            "severity": "positive",
            "icon": "trend_up",
            "title": "Positive Turnover Growth",
            "summary": f"Turnover is up {yoy_growth:.1f}% compared to last year.",
            "detail": f"Your turnover is showing positive growth of {yoy_growth:.1f}% year-on-year, indicating healthy business performance and effective sales execution.",
            "suggested_actions": ["Continue monitoring growth trends", "Maintain current strategies"],
            "metrics": {"yoy_growth": yoy_growth}
        })
    
    # Excellent GP%
    if gp_pct > 27:
        insights.append({
            "id": "gp_excellent",
            "category": "gp",
            "severity": "positive",
            "icon": "check",
            "title": "Excellent Gross Profit Margin",
            "summary": f"GP margin of {gp_formatted} exceeds the 27% excellent threshold.",
            "detail": f"Your gross profit margin of {gp_formatted} is above the 27% excellent threshold, indicating strong pricing discipline, effective cost management, and healthy supplier relationships.",
            "suggested_actions": ["Maintain current pricing strategy", "Continue monitoring margin trends"],
            "metrics": {"gp_percentage": gp_pct, "threshold": 27}
        })
    
    # Strong basket size
    if avg_basket > 260:
        insights.append({
            "id": "basket_strong",
            "category": "basket",
            "severity": "positive",
            "icon": "check",
            "title": "Strong Average Basket Size",
            "summary": f"Average basket of {basket_formatted} exceeds the R260 strong threshold.",
            "detail": f"Your average basket size of {basket_formatted} is excellent, indicating effective cross-selling, upselling, and strong customer engagement. This demonstrates your team's ability to maximize transaction value.",
            "suggested_actions": ["Maintain current sales approach", "Share best practices across team"],
            "metrics": {"avg_basket": avg_basket, "threshold": 260}
        })
    
    # WARNING/CRITICAL INSIGHTS
    
    # Check GP% thresholds
    if gp_pct < 23:
        highlight_parts.append(f"GP% at {gp_formatted} is concerning and needs immediate attention")
        detail_parts.append(f"Your gross profit margin of {gp_formatted} is below the 23% threshold. This directly impacts profitability and requires urgent review of pricing strategy and supplier costs.")
        insights.append({
            "id": "gp_critical",
            "category": "gp",
            "severity": "critical",
            "icon": "alert",
            "title": "GP% Critically Low",
            "summary": f"GP margin at {gp_formatted} is below the 23% concerning threshold.",
            "detail": f"Your gross profit margin has fallen to {gp_formatted}, which is below the critical 23% threshold.",
            "suggested_actions": ["Review supplier pricing", "Audit frontshop pricing", "Check for pricing errors"],
            "metrics": {"gp_percentage": gp_pct, "threshold": 23}
        })
    elif gp_pct < 24:
        highlight_parts.append(f"GP% at {gp_formatted} is in warning range")
        insights.append({
            "id": "gp_warning",
            "category": "gp",
            "severity": "warning",
            "icon": "warning",
            "title": "GP% Below Target",
            "summary": f"GP margin at {gp_formatted} is below the 24% acceptable threshold.",
            "detail": f"Your gross profit margin of {gp_formatted} is below the acceptable 24-25% range.",
            "suggested_actions": ["Monitor pricing on fast-moving items", "Review supplier costs"],
            "metrics": {"gp_percentage": gp_pct, "threshold": 24}
        })
    
    # Check turnover YoY decline
    if yoy_growth is not None and yoy_growth < -10:
        highlight_parts.append(f"Turnover down {abs(yoy_growth):.1f}% YoY - needs attention")
        insights.append({
            "id": "turnover_yoy_decline",
            "category": "turnover",
            "severity": "warning",
            "icon": "trend_down",
            "title": "Turnover Decline",
            "summary": f"Turnover down {abs(yoy_growth):.1f}% compared to last year.",
            "detail": f"Your turnover has declined by {abs(yoy_growth):.1f}% compared to the same period last year.",
            "suggested_actions": ["Analyse customer foot traffic", "Review promotional calendar"],
            "metrics": {"yoy_growth": yoy_growth}
        })
    
    # Check basket size
    if avg_basket < 170:
        highlight_parts.append(f"Basket size of {basket_formatted} is concerning")
        insights.append({
            "id": "basket_low",
            "category": "basket",
            "severity": "warning",
            "icon": "warning",
            "title": "Low Basket Size",
            "summary": f"Average basket of {basket_formatted} is below the R170 concerning threshold.",
            "detail": f"Your average basket size of {basket_formatted} is below the R170 threshold.",
            "suggested_actions": ["Review cross-selling opportunities", "Train staff on add-on sales"],
            "metrics": {"avg_basket": avg_basket, "threshold": 170}
        })
    
    # === ENSURE AT LEAST 3 INSIGHTS ===
    # Add healthy/stable insights if we don't have enough
    
    # Healthy GP% (if not already covered by excellent or warning)
    if gp_pct >= 24 and gp_pct <= 27 and not any(i.get('category') == 'gp' for i in insights):
        insights.append({
            "id": "gp_healthy",
            "category": "gp",
            "severity": "positive",
            "icon": "check",
            "title": "Healthy Gross Profit Margin",
            "summary": f"GP margin of {gp_formatted} is within the healthy 24-27% range.",
            "detail": f"Your gross profit margin of {gp_formatted} is within acceptable parameters, indicating effective pricing and cost management.",
            "suggested_actions": ["Maintain current pricing strategy"],
            "metrics": {"gp_percentage": gp_pct}
        })
    
    # Healthy basket size (if not already covered)
    if avg_basket >= 180 and avg_basket <= 260 and not any(i.get('category') == 'basket' for i in insights):
        insights.append({
            "id": "basket_healthy",
            "category": "basket",
            "severity": "positive",
            "icon": "check",
            "title": "Healthy Basket Size",
            "summary": f"Average basket of {basket_formatted} is within the healthy R180-R260 range.",
            "detail": f"Your average basket size of {basket_formatted} demonstrates effective customer engagement and cross-selling.",
            "suggested_actions": ["Continue current sales approach"],
            "metrics": {"avg_basket": avg_basket}
        })
    
    # Stable transactions (if we still need more insights)
    if len(insights) < 3 and transactions > 0:
        transactions_insight_exists = any(i.get('category') == 'transactions' for i in insights)
        if not transactions_insight_exists:
            insights.append({
                "id": "transactions_stable",
                "category": "transactions",
                "severity": "positive",
                "icon": "check",
                "title": "Stable Transaction Volume",
                "summary": f"{transactions:,} transactions recorded this period, indicating consistent customer traffic.",
                "detail": f"Your transaction count of {transactions:,} shows healthy customer engagement and consistent store traffic.",
                "suggested_actions": ["Monitor transaction trends"],
                "metrics": {"transactions": transactions}
            })
    
    # Build highlight summary - prioritize turnover YoY growth when positive
    if not highlight_parts:
        if yoy_growth is not None and yoy_growth > 0:
            highlight_summary = f"Turnover of {turnover_formatted} is up {yoy_growth:.1f}% year-on-year, showing positive growth. GP% at {gp_formatted} is within acceptable parameters."
        elif yoy_growth is not None and abs(yoy_growth) < 5:
            highlight_summary = f"Turnover of {turnover_formatted} compares well to last year with GP% at {gp_formatted} within acceptable parameters. Performance is stable and on track."
        else:
            highlight_summary = f"Turnover of {turnover_formatted} with GP% at {gp_formatted}. All metrics are within acceptable ranges."
    else:
        # Prioritize positive turnover growth in highlight if available
        if yoy_growth is not None and yoy_growth > 0:
            turnover_highlight = f"Turnover is up {yoy_growth:.1f}% year-on-year"
            highlight_summary = f"{turnover_highlight}. {' '.join(highlight_parts[:1])}"
        else:
            highlight_summary = ". ".join(highlight_parts[:2])
        if not highlight_summary.endswith("."):
            highlight_summary += "."
    
    # Build detailed analysis - prioritize turnover growth when positive
    if detail_parts:
        # If turnover is growing, mention it first even if there are concerns
        if yoy_growth is not None and yoy_growth > 0:
            detailed_analysis = f"Your turnover is showing positive growth of {yoy_growth:.1f}% year-on-year, which is a strong indicator of business expansion. " + " ".join(detail_parts)
        else:
            detailed_analysis = " ".join(detail_parts)
    else:
        if yoy_growth is not None and yoy_growth > 0:
            detailed_analysis = f"Your pharmacy is performing well with turnover of {turnover_formatted} up {yoy_growth:.1f}% year-on-year, demonstrating positive growth. GP margin of {gp_formatted} is within acceptable parameters. Continue monitoring key metrics and maintaining current strategies."
        else:
            detailed_analysis = f"Your pharmacy is performing within expected parameters. Turnover of {turnover_formatted} with a GP margin of {gp_formatted} indicates stable operations. Continue monitoring key metrics and maintaining current strategies."
    
    # Balance insights to ensure at least one of each severity type when available
    balanced_insights = balance_insights_by_severity(insights)
    
    return {
        "highlight_summary": highlight_summary,
        "detailed_analysis": detailed_analysis,
        "metric_evaluations": metric_evaluations,
        "insights": balanced_insights
    }


def balance_insights_by_severity(insights: list, min_count: int = 3) -> list:
    """Balance insights to prioritize showing at least one of each severity type
    
    Returns insights ordered by: critical (red), warning (orange), positive (green)
    Ensures at least one of each type is included if available.
    Always returns at least min_count insights.
    """
    if not insights:
        return []
    
    # Separate insights by severity
    critical_insights = [i for i in insights if i.get('severity') == 'critical']
    warning_insights = [i for i in insights if i.get('severity') == 'warning']
    positive_insights = [i for i in insights if i.get('severity') == 'positive']
    info_insights = [i for i in insights if i.get('severity') == 'info']
    
    # Build balanced list: prioritize at least one of each type
    balanced = []
    
    # Add at least one critical if available
    if critical_insights:
        balanced.append(critical_insights[0])
    
    # Add at least one warning if available
    if warning_insights:
        balanced.append(warning_insights[0])
    
    # Add at least one positive if available
    if positive_insights:
        balanced.append(positive_insights[0])
    
    # Add remaining insights in priority order (critical, warning, positive, info)
    # Skip ones we've already added
    remaining_critical = critical_insights[1:] if len(critical_insights) > 1 else []
    remaining_warning = warning_insights[1:] if len(warning_insights) > 1 else []
    remaining_positive = positive_insights[1:] if len(positive_insights) > 1 else []
    
    balanced.extend(remaining_critical)
    balanced.extend(remaining_warning)
    balanced.extend(remaining_positive)
    balanced.extend(info_insights)
    
    return balanced


# Old functions removed - now using generate_fallback_insights_structured and OpenAI JSON response


@app.get("/api/pharmacies/{pharmacy_id}/dashboard-insights")
async def api_dashboard_insights(request: Request, pharmacy_id: int, date: str = None) -> JSONResponse:
    """Get smart MTD insights that highlight only noteworthy metrics
    
    Fetches 3 sets of data using the MTD endpoint:
    1. Current month MTD (up to selected date or yesterday)
    2. Same period last year
    3. Same period last month
    
    All data fetched via: GET /pharmacies/{pharmacy_id}/mtd?month=YYYY-MM&through=YYYY-MM-DD
    
    Args:
        pharmacy_id: Pharmacy ID
        date: Optional date parameter (YYYY-MM-DD). If provided, insights will be for the month containing this date,
              up to and including this date. If not provided, uses yesterday's date.
    """
    import calendar
    
    # Use provided date or default to yesterday
    if date:
        try:
            # Validate date format
            through_dt = datetime.strptime(date, "%Y-%m-%d")
            selected_date = date
            current_month = through_dt.strftime("%Y-%m")
        except ValueError:
            # Invalid date format, fall back to yesterday
            now_sa = datetime.now(SA_TIMEZONE)
            yesterday = (now_sa - timedelta(days=1)).strftime("%Y-%m-%d")
            through_dt = datetime.strptime(yesterday, "%Y-%m-%d")
            selected_date = yesterday
            current_month = now_sa.strftime("%Y-%m")
    else:
        # Default to yesterday
        now_sa = datetime.now(SA_TIMEZONE)
        yesterday = (now_sa - timedelta(days=1)).strftime("%Y-%m-%d")
        current_month = now_sa.strftime("%Y-%m")
        
        # On the 1st of the month, use last month's data
        if now_sa.day == 1:
            last_month_end = now_sa - timedelta(days=1)
            current_month = last_month_end.strftime("%Y-%m")
            yesterday = last_month_end.strftime("%Y-%m-%d")
        
        through_dt = datetime.strptime(yesterday, "%Y-%m-%d")
        selected_date = yesterday
    
    mtd_status = "not_ready"
    mtd_reason = None
    
    try:
        # Calculate the day of month we're comparing
        day_of_month = through_dt.day
        
        # ═══════════════════════════════════════════════════════════════
        # FETCH 3 SETS OF DATA USING MTD ENDPOINT
        # ═══════════════════════════════════════════════════════════════
        
        print(f"[DEBUG] Fetching 3 MTD data sets for pharmacy {pharmacy_id}")
        print(f"[DEBUG] Current: month={current_month}, through={selected_date}")
        
        # Calculate all date ranges first
        prev_year_dt = through_dt.replace(year=through_dt.year - 1)
        prev_year_month = prev_year_dt.strftime("%Y-%m")
        prev_year_days_in_month = calendar.monthrange(prev_year_dt.year, prev_year_dt.month)[1]
        prev_year_day = min(day_of_month, prev_year_days_in_month)
        prev_year_through = prev_year_dt.replace(day=prev_year_day).strftime("%Y-%m-%d")
        
        if through_dt.month == 1:
            prev_month_dt = through_dt.replace(year=through_dt.year - 1, month=12)
        else:
            prev_month_dt = through_dt.replace(month=through_dt.month - 1)
        prev_month_str = prev_month_dt.strftime("%Y-%m")
        prev_month_days_in_month = calendar.monthrange(prev_month_dt.year, prev_month_dt.month)[1]
        prev_month_day = min(day_of_month, prev_month_days_in_month)
        prev_month_through = prev_month_dt.replace(day=prev_month_day).strftime("%Y-%m-%d")
        
        print(f"[DEBUG] Last Year: month={prev_year_month}, through={prev_year_through}")
        print(f"[DEBUG] Last Month: month={prev_month_str}, through={prev_month_through}")
        
        # Fetch all 3 MTD datasets in parallel for faster loading
        import asyncio
        pharmacy_metrics, prev_year_metrics, prev_month_metrics = await asyncio.gather(
            fetch_mtd_metrics(request, pharmacy_id, current_month, selected_date),
            fetch_mtd_metrics(request, pharmacy_id, prev_year_month, prev_year_through),
            fetch_mtd_metrics(request, pharmacy_id, prev_month_str, prev_month_through),
            return_exceptions=True
        )
        
        # Handle exceptions
        if isinstance(pharmacy_metrics, Exception):
            print(f"[ERROR] Failed to fetch current MTD: {pharmacy_metrics}")
            pharmacy_metrics = {}
        if isinstance(prev_year_metrics, Exception):
            print(f"[ERROR] Failed to fetch last year MTD: {prev_year_metrics}")
            prev_year_metrics = {}
        if isinstance(prev_month_metrics, Exception):
            print(f"[ERROR] Failed to fetch last month MTD: {prev_month_metrics}")
            prev_month_metrics = {}
            
        if pharmacy_metrics.get("days_count", 0) > 0 and pharmacy_metrics.get("turnover", 0) > 0:
            
            # Log all 3 data sets
            print(f"[DEBUG] === MTD DATA SUMMARY ===")
            print(f"[DEBUG] Current MTD: turnover=R{pharmacy_metrics.get('turnover', 0):,.0f}, GP%={pharmacy_metrics.get('gp_percentage', 0):.1f}%, transactions={pharmacy_metrics.get('transaction_count', 0)}")
            print(f"[DEBUG] Last Year MTD: turnover=R{prev_year_metrics.get('turnover', 0):,.0f}, GP%={prev_year_metrics.get('gp_percentage', 0):.1f}%")
            print(f"[DEBUG] Last Month MTD: turnover=R{prev_month_metrics.get('turnover', 0):,.0f}, GP%={prev_month_metrics.get('gp_percentage', 0):.1f}%")
            
            mtd_start = f"{current_month}-01"
            mtd_end = selected_date
            
            # Try to get pharmacy name from session or use default
            pharmacy_name = ""
            if hasattr(request, 'session') and 'pharmacy_name' in request.session:
                pharmacy_name = request.session.get('pharmacy_name', '')
            
            # ═══════════════════════════════════════════════════════════════
            # GENERATE AI INSIGHTS USING PHARMASIGHT ENGINE
            # ═══════════════════════════════════════════════════════════════
            
            # Generate comprehensive AI insights (no group comparison)
            ai_response = await generate_insights_with_openai(
                metrics=pharmacy_metrics,
                prev_year_metrics=prev_year_metrics,
                    prev_month_metrics=prev_month_metrics,
                pharmacy_name=pharmacy_name,
                    period_start=mtd_start,
                period_end=mtd_end
            )
            
            # Build the response structure
            insights_data = {
                "mode": "mtd",
                "pharmacy_id": str(pharmacy_id),
                "period": {
                    "label": f"{datetime.strptime(mtd_start, '%Y-%m-%d').strftime('%b %Y')} MTD",
                    "start_date": mtd_start,
                    "end_date": mtd_end
                },
                "summary": {
                    "headline": ai_response.get("highlight_summary", "Performance data is being analyzed."),
                    "paragraphs": [ai_response.get("detailed_analysis", "")]
                },
                "metric_evaluations": ai_response.get("metric_evaluations", []),
                "insights": ai_response.get("insights", []),
                "metrics": {
                    "current": pharmacy_metrics,
                    "last_year": prev_year_metrics,
                    "last_month": prev_month_metrics
                }
            }
            
            mtd_status = "ready"
        else:
            mtd_status = "not_ready"
            mtd_reason = "no_data"
            insights_data = None
    except Exception as e:
        print(f"[ERROR] Failed to generate MTD insights: {e}")
        import traceback
        traceback.print_exc()
        mtd_status = "error"
        mtd_reason = str(e)
        insights_data = None
    
    # Return structured response matching the schema
    if insights_data:
        return JSONResponse(insights_data)
    else:
        # Return error/not ready response
        return JSONResponse({
            "mode": "mtd",
            "pharmacy_id": str(pharmacy_id),
            "period": {
                "label": f"{datetime.strptime(mtd_start, '%Y-%m-%d').strftime('%b %Y')} MTD" if mtd_start else "MTD",
                "start_date": mtd_start,
                "end_date": mtd_end
            },
            "summary": {
                "headline": "No insights available",
                "paragraphs": [mtd_reason or "Data not available for this period."]
            },
            "insights": []
        })


def generate_smart_insights(metrics: dict, prev_year: dict, group_metrics: dict = None, prev_month_metrics: dict = None, period_start: str = None, period_end: str = None, pharmacy_id: int = None) -> dict:
    """Generate structured insights matching the JSON schema.
    
    Returns a dict with:
    - mode: "mtd"
    - pharmacy_id: str
    - period: {label, start_date, end_date}
    - summary: {headline, paragraphs}
    - insights: array of insight cards with severity, icons, etc.
    """
    
    # Extract metrics
    turnover = metrics.get("turnover", 0)
    gp_pct = metrics.get("gp_percentage", 0)
    gp_value = metrics.get("gp_value", 0)
    purchases = metrics.get("purchases", 0)
    cos = metrics.get("cos", turnover - gp_value)  # Cost of Sales
    dispensary_gp_pct = metrics.get("dispensary_gp_pct", 0)
    frontshop_gp_pct = metrics.get("frontshop_gp_pct", 0)
    transactions = metrics.get("transaction_count", 0)
    avg_basket = metrics.get("avg_basket", 0)
    
    # Thresholds
    GP_TARGET = 25.0
    GP_CRITICAL = 22.0        # Below this = critical
    GP_WARNING = 24.0         # Below this = warning
    GP_POSITIVE = 26.0        # Above this = positive
    TURNOVER_THRESHOLD = 5.0  # ±5% vs LY
    MOM_THRESHOLD = 10.0      # ±10% vs previous month - for triggering alerts
    PURCHASE_THRESHOLD = 15.0 # ±15% vs CoS
    DISPENSARY_GP_MIN = 22.0
    FRONTSHOP_GP_MIN = 28.0
    
    # Calculate YoY growth
    yoy_growth = None
    prev_turnover = 0
    if prev_year and prev_year.get("turnover", 0) > 0:
        prev_turnover = prev_year["turnover"]
        yoy_growth = ((turnover - prev_turnover) / prev_turnover) * 100
    
    # Calculate Month-over-Month growth (vs same MTD period in previous month)
    mom_growth = None
    prev_month_turnover = 0
    if prev_month_metrics and prev_month_metrics.get("turnover", 0) > 0:
        prev_month_turnover = prev_month_metrics["turnover"]
        mom_growth = ((turnover - prev_month_turnover) / prev_month_turnover) * 100
    
    # Format period label
    if period_start and period_end:
        start_dt = datetime.strptime(period_start, "%Y-%m-%d")
        period_label = f"{start_dt.strftime('%b %Y')} MTD"
    else:
        period_label = "MTD"
        period_start = datetime.now(SA_TIMEZONE).replace(day=1).strftime("%Y-%m-%d")
        period_end = (datetime.now(SA_TIMEZONE) - timedelta(days=1)).strftime("%Y-%m-%d")
    
    # ═══════════════════════════════════════════════════════════════
    # BUILD SUMMARY
    # ═══════════════════════════════════════════════════════════════
    
    # Headline (1-2 sentences)
    headline_parts = []
    if yoy_growth is not None:
        if abs(yoy_growth) < TURNOVER_THRESHOLD:
            headline_parts.append(f"Turnover is tracking close to last year at R{turnover:,.0f}.")
        elif yoy_growth >= TURNOVER_THRESHOLD:
            headline_parts.append(f"Turnover is up {yoy_growth:.1f}% year-on-year, reaching R{turnover:,.0f}.")
        else:
            headline_parts.append(f"Turnover is down {abs(yoy_growth):.1f}% compared to last year, at R{turnover:,.0f}.")
    else:
        headline_parts.append(f"Month-to-date turnover stands at R{turnover:,.0f}.")
    
    headline = " ".join(headline_parts)
    
    # Summary paragraphs - kept minimal, the insight cards provide the detail
    summary_paragraphs = []
    
    # ═══════════════════════════════════════════════════════════════
    # BUILD INSIGHT CARDS
    # ═══════════════════════════════════════════════════════════════
    
    insights = []
    
    # --- TURNOVER INSIGHT ---
    if yoy_growth is not None:
        should_mention_turnover = abs(yoy_growth) >= TURNOVER_THRESHOLD
        
        if should_mention_turnover:
            if yoy_growth >= TURNOVER_THRESHOLD:
                # Good growth
                insights.append({
                    "id": "turnover_yoy",
                    "category": "turnover",
                    "severity": "positive",
                    "icon": "trend_up",
                    "title": "Turnover Growth",
                    "summary": f"Turnover is up {yoy_growth:.1f}% compared to the same period last year.",
                    "detail": f"Growth of {yoy_growth:.1f}% year on year is encouraging. Continue focusing on what's driving this — whether it's foot traffic, basket size, or new customers. Monitor which days of the week and product categories are performing strongest.",
                    "suggested_actions": [
                        "Identify the key drivers of growth to replicate success.",
                        "Maintain momentum with consistent promotional activity."
                    ],
                    "metrics": {
                        "turnover_current": turnover,
                        "turnover_last_year": prev_turnover,
                        "turnover_pharmacy_growth_pct": yoy_growth
                    }
                })
            elif yoy_growth <= -TURNOVER_THRESHOLD:
                # Declining turnover
                insights.append({
                    "id": "turnover_yoy",
                    "category": "turnover",
                    "severity": "warning",
                    "icon": "trend_down",
                    "title": "YoY Turnover Down",
                    "summary": f"Turnover is {abs(yoy_growth):.1f}% lower than the same period last year.",
                    "detail": f"With turnover down {abs(yoy_growth):.1f}%, it's worth investigating local factors — competition, foot traffic, or promotional activity in your area. Consider reviewing your promotional calendar, frontshop displays, and whether customers are finding what they need.",
                    "suggested_actions": [
                        "Review current frontshop promotions versus last year.",
                        "Check whether any nearby events or competitors may be impacting traffic."
                    ],
                    "metrics": {
                        "turnover_current": turnover,
                        "turnover_last_year": prev_turnover,
                        "turnover_pharmacy_growth_pct": yoy_growth
                    }
                })
    
    # --- GP% INSIGHT ---
    # Critical: below 22%, Warning: below 24%, Positive: above 26%
    gp_deviation = gp_pct - GP_TARGET
    
    if gp_pct < GP_CRITICAL:
        # CRITICAL - GP% below 22%
        insights.append({
            "id": "gp_margin",
            "category": "gp",
            "severity": "critical",
            "icon": "alert",
            "title": "GP% Critical",
            "summary": f"GP margin at {gp_pct:.1f}% is critically low — immediate attention required.",
            "detail": f"GP% at {gp_pct:.1f}% is well below the {GP_CRITICAL:.0f}% critical threshold. This requires urgent attention. Review all pricing, check for any significant cost price increases from suppliers, and investigate whether heavy discounting or SEP non-compliance is eroding margins. This level of GP% compression directly impacts profitability.",
            "suggested_actions": [
                "Urgently review all pricing and discount approvals.",
                "Check for supplier cost price increases that haven't been passed on.",
                "Investigate SEP compliance on dispensary lines.",
                "Review frontshop markups and promotional pricing."
            ],
            "metrics": {
                "gp_percentage": gp_pct,
                "gp_target": GP_TARGET,
                "gp_critical_threshold": GP_CRITICAL,
                "gp_deviation": gp_deviation
            }
        })
    elif gp_pct < GP_WARNING:
        # WARNING - GP% below 24% but above 22%
        insights.append({
            "id": "gp_margin",
            "category": "gp",
            "severity": "warning",
            "icon": "alert",
            "title": "Low GP%",
            "summary": f"GP margin is {gp_pct:.1f}%, below the {GP_WARNING:.0f}% warning threshold.",
            "detail": f"GP% at {gp_pct:.1f}% is below the {GP_WARNING:.0f}% warning level. While not critical, this warrants monitoring. Review pricing, supplier costs, and any heavy discounting to identify the pressure point. Check whether dispensary or frontshop is driving the margin compression.",
            "suggested_actions": [
                "Review discounting patterns and cost price changes.",
                "Check if SEP pricing compliance is affecting dispensary margins.",
                "Monitor GP% trend over the coming days."
            ],
            "metrics": {
                "gp_percentage": gp_pct,
                "gp_target": GP_TARGET,
                "gp_warning_threshold": GP_WARNING,
                "gp_deviation": gp_deviation
            }
        })
    elif gp_pct >= GP_POSITIVE:
        # POSITIVE - GP% above 26%
        insights.append({
            "id": "gp_margin",
            "category": "gp",
            "severity": "positive",
            "icon": "check",
            "title": "Strong GP%",
            "summary": f"GP margin is {gp_pct:.1f}%, above the {GP_TARGET:.0f}% target.",
            "detail": f"GP margin of {gp_pct:.1f}% is running above target, which is excellent. Ensure this isn't at the expense of competitiveness — but if volumes are holding, well done on the margin management. Both dispensary and frontshop appear to be contributing positively.",
            "suggested_actions": [
                "Monitor volumes to ensure pricing remains competitive.",
                "Identify which product categories are driving the strong margins."
            ],
            "metrics": {
                "gp_percentage": gp_pct,
                "gp_target": GP_TARGET,
                "gp_deviation": gp_deviation
            }
        })
    # Note: GP% between 24% and 26% is considered on-target and handled in marginal insights
    
    # --- PURCHASES VS COS INSIGHT ---
    if cos > 0 and purchases > 0:
        purchase_vs_cos = ((purchases - cos) / cos) * 100
        if purchase_vs_cos > PURCHASE_THRESHOLD:
            insights.append({
                "id": "purchases_stock",
                "category": "purchases",
                "severity": "warning",
                "icon": "alert",
                "title": "Stock Building Up",
                "summary": f"Purchases are {purchase_vs_cos:.0f}% higher than cost of sales, suggesting stock is building up.",
                "detail": f"Purchases are running {purchase_vs_cos:.0f}% higher than cost of sales, suggesting stock is building up. Review slow-moving lines and consider whether orders can be trimmed to free up cash flow. Check for any seasonal stock that may not be moving as expected.",
                "suggested_actions": [
                    "Review slow-moving product lines and reduce orders.",
                    "Check for seasonal stock that may need clearance."
                ],
                "metrics": {
                    "purchases": purchases,
                    "cost_of_sales": cos,
                    "purchase_vs_cos_pct": purchase_vs_cos
                }
            })
        elif purchase_vs_cos < -PURCHASE_THRESHOLD:
            insights.append({
                "id": "purchases_stock",
                "category": "stock",
                "severity": "warning",
                "icon": "alert",
                "title": "Stock Running Low",
                "summary": f"Purchases are {abs(purchase_vs_cos):.0f}% below cost of sales, meaning you're drawing down stock.",
                "detail": f"Purchases are {abs(purchase_vs_cos):.0f}% below cost of sales, meaning you're drawing down stock. If this is intentional that's fine, but watch for out-of-stocks on key lines. Ensure you have adequate stock levels for upcoming promotions or seasonal demand.",
                "suggested_actions": [
                    "Monitor stock levels on high-volume lines.",
                    "Plan orders to avoid out-of-stocks during peak periods."
                ],
                "metrics": {
                    "purchases": purchases,
                    "cost_of_sales": cos,
                    "purchase_vs_cos_pct": purchase_vs_cos
                }
            })
    
    # --- DISPENSARY/FRONTSHOP INSIGHT ---
    if dispensary_gp_pct > 0 and dispensary_gp_pct < DISPENSARY_GP_MIN:
        insights.append({
            "id": "dispensary_gp",
            "category": "dispensary",
            "severity": "warning",
            "icon": "alert",
            "title": "Dispensary GP Below Benchmark",
            "summary": f"Dispensary GP at {dispensary_gp_pct:.1f}% is below the {DISPENSARY_GP_MIN:.0f}% benchmark.",
            "detail": f"Dispensary GP at {dispensary_gp_pct:.1f}% is below the {DISPENSARY_GP_MIN:.0f}% benchmark. Check for SEP pricing compliance and review your acquisition costs with suppliers. Ensure you're not discounting scripts unnecessarily.",
            "suggested_actions": [
                "Review SEP pricing compliance and supplier cost prices.",
                "Check for any unnecessary discounting on scripts."
            ],
            "metrics": {
                "dispensary_gp_pct": dispensary_gp_pct,
                "dispensary_gp_min": DISPENSARY_GP_MIN
            }
        })
    elif frontshop_gp_pct > 0 and frontshop_gp_pct < FRONTSHOP_GP_MIN:
        insights.append({
            "id": "frontshop_gp",
            "category": "frontshop",
            "severity": "warning",
            "icon": "alert",
            "title": "Frontshop GP Below Target",
            "summary": f"Frontshop GP at {frontshop_gp_pct:.1f}% is below the {FRONTSHOP_GP_MIN:.0f}% target.",
            "detail": f"Frontshop GP at {frontshop_gp_pct:.1f}% is below the {FRONTSHOP_GP_MIN:.0f}% target. Review pricing on high-volume lines and check if promotional discounting is eroding margins. Consider whether markups are appropriate for your cost structure.",
            "suggested_actions": [
                "Review pricing on high-volume frontshop lines.",
                "Assess whether promotional discounting is too aggressive."
            ],
            "metrics": {
                "frontshop_gp_pct": frontshop_gp_pct,
                "frontshop_gp_min": FRONTSHOP_GP_MIN
            }
        })
    
    # --- MONTH-OVER-MONTH INSIGHT ---
    if mom_growth is not None and abs(mom_growth) >= MOM_THRESHOLD:
        if mom_growth >= MOM_THRESHOLD:
            insights.append({
                "id": "mom_growth",
                "category": "momentum",
                "severity": "positive",
                "icon": "trend_up",
                "title": "Strong Monthly Momentum",
                "summary": f"Turnover is up {mom_growth:.1f}% compared to the same period last month.",
                "detail": f"Compared to the same MTD period last month, turnover has increased by {mom_growth:.1f}%. This indicates strong momentum building through the quarter. Monitor whether this is driven by seasonal factors, promotions, or sustained organic growth.",
                "suggested_actions": [
                    "Identify what's driving the month-on-month increase.",
                    "Ensure stock levels can sustain the higher demand."
                ],
                "metrics": {
                    "turnover_current": turnover,
                    "turnover_prev_month": prev_month_turnover,
                    "mom_growth_pct": mom_growth
                }
            })
        else:
            insights.append({
                "id": "mom_decline",
                "category": "momentum",
                "severity": "warning",
                "icon": "trend_down",
                "title": "Monthly Turnover Decline",
                "summary": f"Turnover is down {abs(mom_growth):.1f}% compared to the same period last month.",
                "detail": f"Compared to the same MTD period last month, turnover has decreased by {abs(mom_growth):.1f}%. This could be seasonal, or indicate a shift in customer traffic or spending. Investigate whether specific categories or days are underperforming.",
                "suggested_actions": [
                    "Compare daily sales patterns to identify any drop-off points.",
                    "Review if any promotions from last month have ended."
                ],
                "metrics": {
                    "turnover_current": turnover,
                    "turnover_prev_month": prev_month_turnover,
                    "mom_growth_pct": mom_growth
                }
            })
    
    # ═══════════════════════════════════════════════════════════════
    # MARGINAL INSIGHTS - Add if we have fewer than 2 insights
    # ═══════════════════════════════════════════════════════════════
    
    # Track which categories we already have insights for
    existing_categories = {i["category"] for i in insights}
    
    # If fewer than 2 insights, add marginal insights for metrics that are close to thresholds
    if len(insights) < 2:
        # GP% marginal insight (when GP is in the 24-26% "on target" range)
        if "gp" not in existing_categories and gp_pct >= GP_WARNING and gp_pct < GP_POSITIVE:
            # GP is in target range (24-26%) - positive note
            insights.append({
                "id": "gp_margin_stable",
                "category": "gp",
                "severity": "positive",
                "icon": "check",
                "title": "GP% On Target",
                "summary": f"GP margin is {gp_pct:.1f}%, tracking within the target range.",
                "detail": f"GP margin of {gp_pct:.1f}% is within the healthy {GP_WARNING:.0f}%-{GP_POSITIVE:.0f}% range. Continue monitoring pricing and supplier costs to maintain this balance.",
                "suggested_actions": [
                    "Continue monitoring supplier cost prices for any changes.",
                    "Maintain current pricing strategy across dispensary and frontshop."
                ],
                "metrics": {
                    "gp_percentage": gp_pct,
                    "gp_target": GP_TARGET,
                    "gp_warning_threshold": GP_WARNING,
                    "gp_positive_threshold": GP_POSITIVE
                }
            })
    
    if len(insights) < 2:
        # Purchases vs CoS marginal insight
        if "purchases" not in existing_categories and "stock" not in existing_categories and cos > 0 and purchases > 0:
            purchase_vs_cos = ((purchases - cos) / cos) * 100
            if abs(purchase_vs_cos) <= PURCHASE_THRESHOLD:
                insights.append({
                    "id": "purchases_balanced",
                    "category": "purchases",
                    "severity": "positive",
                    "icon": "check",
                    "title": "Purchasing Balanced",
                    "summary": f"Purchases are aligned with cost of sales ({purchase_vs_cos:+.0f}%).",
                    "detail": f"Purchasing is balanced with sales, indicating healthy stock management. Continue monitoring to avoid over- or under-stocking.",
                    "suggested_actions": [
                        "Maintain current ordering patterns.",
                        "Continue monitoring fast-moving lines for stock levels."
                    ],
                    "metrics": {
                        "purchases": purchases,
                        "cost_of_sales": cos,
                        "purchase_vs_cos_pct": purchase_vs_cos
                    }
                })
    
    if len(insights) < 2:
        # Basket value insight
        if avg_basket > 0:
            basket_benchmark = 200  # R200 target basket
            if avg_basket >= basket_benchmark:
                insights.append({
                    "id": "basket_strong",
                    "category": "basket",
                    "severity": "positive",
                    "icon": "check",
                    "title": "Strong Basket Value",
                    "summary": f"Average basket value of R{avg_basket:.0f} is above the R{basket_benchmark:.0f} benchmark.",
                    "detail": f"Average basket value of R{avg_basket:.0f} indicates good upselling and customer engagement. Continue encouraging staff to recommend complementary products.",
                    "suggested_actions": [
                        "Maintain staff focus on recommending complementary products.",
                        "Consider basket-building promotions to further increase average spend."
                    ],
                    "metrics": {
                        "avg_basket": avg_basket,
                        "basket_benchmark": basket_benchmark
                    }
                })
            else:
                insights.append({
                    "id": "basket_opportunity",
                    "category": "basket",
                    "severity": "info",
                    "icon": "info",
                    "title": "Basket Value Opportunity",
                    "summary": f"Average basket value of R{avg_basket:.0f} is below the R{basket_benchmark:.0f} benchmark.",
                    "detail": f"There may be opportunity to increase basket value through better upselling, bundle offers, or complementary product recommendations.",
                    "suggested_actions": [
                        "Train staff on upselling techniques and complementary products.",
                        "Review frontshop layout for impulse purchase opportunities."
                    ],
                    "metrics": {
                        "avg_basket": avg_basket,
                        "basket_benchmark": basket_benchmark
                    }
                })
    
    if len(insights) < 2:
        # Transaction count insight
        if transactions > 0:
            insights.append({
                "id": "transactions_info",
                "category": "transactions",
                "severity": "info",
                "icon": "info",
                "title": "Transaction Activity",
                "summary": f"MTD transactions total {transactions:,}.",
                "detail": f"Transaction count of {transactions:,} gives context to your turnover. Monitor this alongside basket value to understand whether growth is coming from more customers or higher spend per customer.",
                "suggested_actions": [
                    "Compare transaction count to prior periods.",
                    "Analyze whether growth is volume-driven or basket-driven."
                ],
                "metrics": {
                    "transaction_count": transactions
                }
            })
    
    # Build final response
    return {
        "mode": "mtd",
        "pharmacy_id": str(pharmacy_id) if pharmacy_id else "unknown",
        "period": {
            "label": period_label,
            "start_date": period_start,
            "end_date": period_end
        },
        "summary": {
            "headline": headline,
            "paragraphs": summary_paragraphs
        },
        "insights": insights
    }


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 