from fastapi import FastAPI, Request, Form, HTTPException, Query
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy import text
import httpx
import os
from dotenv import load_dotenv
from urllib.parse import quote
from datetime import date
from calendar import monthrange
from .db import engine

# Load environment variables
load_dotenv()

app = FastAPI(title="BudgetingApp")

# Config
API_BASE_URL = os.getenv("PHARMA_API_BASE", "https://pharmacy-api-webservice.onrender.com")
API_KEY = os.getenv("PHARMA_API_KEY", "")
SESSION_SECRET = os.getenv("SESSION_SECRET_KEY", "change-me")

# Session middleware
app.add_middleware(
    SessionMiddleware, 
    secret_key=SESSION_SECRET, 
    max_age=60 * 60 * 12, 
    https_only=False,
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
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/users"
        resp = await client.post(url, json=user_data, headers=headers)
    
    if resp.status_code != 200:
        error_detail = resp.json().get("detail", "Failed to create user") if resp.headers.get("content-type", "").startswith("application/json") else "Failed to create user"
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