# Web App API Service Usage Analysis

## Overview
This document explains how the web application uses the API service and how it retrieves information from the backend API.

## Architecture

The web app follows a **proxy pattern** where:
1. **Frontend (HTML/JavaScript)** → Makes requests to `/api/*` endpoints
2. **FastAPI Backend (main.py)** → Proxies requests to external API (`PHARMA_API_BASE`)
3. **External API** → Returns data back through the proxy chain

## Authentication Flow

### 1. Login Process
- User submits login form to `/login` endpoint (POST)
- Backend (`main.py`) authenticates with external API:
  ```python
  auth_url = f"{API_BASE_URL}/auth/login"
  payload = {"username": username, "password": password}
  ```
- Backend stores authentication token in session:
  ```python
  request.session["auth_token"] = token
  request.session["username"] = username
  request.session["user_id"] = user_id
  ```
- User is redirected to `/dashboard`

### 2. Subsequent API Calls
- Frontend makes `fetch()` calls to `/api/*` endpoints
- Session cookies are automatically included (`credentials: 'include'`)
- Backend extracts token from session and includes in Authorization header:
  ```python
  def _auth_headers(request: Request) -> dict:
      bearer = request.session.get("auth_token")
      return {"Authorization": f"Bearer {bearer}"} if bearer else {}
  ```

## Frontend API Usage Patterns

### Pattern 1: Direct Fetch Calls (Dashboard)
The dashboard (`dashboard.html`) uses **direct fetch calls** throughout the code:

```javascript
// Example: Fetching daily sales data
const resp = await fetch(`/api/days?pid=${pid}&month=${month}`);
const data = await resp.json();

// Example: Fetching targets
const targetsResp = await fetch(`/api/targets?pid=${pid}&month=${month}`);

// Example: Fetching best sellers
const resp = await fetch(`/api/best-sellers?pid=${pid}&date=${dateStr}&limit=100`);

// Example: Fetching worst GP products
const resp = await fetch(`/api/worst-gp?pid=${pid}&from_date=${fromDate}&to_date=${toDate}`);
```

**Key Characteristics:**
- No centralized API service
- Fetch calls scattered throughout functions
- Uses `await fetch()` with async/await
- No explicit headers (relies on session cookies)
- Direct URL construction with query parameters

### Pattern 2: Service Object (Admin Page)
The admin page (`admin.html`) uses a **service object pattern**:

```javascript
const AdminService = {
  async listUsers() {
    const response = await fetch('/api/admin/users', {
      credentials: 'include'
    });
    if (!response.ok) {
      this.checkResponse(response);
    }
    return await response.json();
  },

  async getUserDetails(userId) {
    const response = await fetch(`/api/admin/users/${userId}`, {
      credentials: 'include'
    });
    // ... error handling
    return await response.json();
  },

  async createUser(userData) {
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(userData)
    });
    // ... error handling
    return await response.json();
  }
  // ... more methods
};
```

**Key Characteristics:**
- Centralized service object (`AdminService`)
- Consistent error handling via `checkResponse()`
- Explicit `credentials: 'include'` for session cookies
- Methods for each API endpoint

## Backend Proxy Endpoints

The backend (`main.py`) provides proxy endpoints that forward requests to the external API:

### Standard Endpoints
```python
@app.get("/api/days")
async def api_days(request: Request, pid: int, month: str):
    headers = _auth_headers(request)  # Gets token from session
    url = f"{API_BASE_URL}/pharmacies/{pid}/days?from={from_date}&to={to_date}"
    resp = await client.get(url, headers=headers)
    return JSONResponse(resp.json())
```

### Admin Endpoints
```python
@app.get("/api/admin/users")
async def api_admin_list_users(request: Request):
    bearer = request.session.get("auth_token") or API_KEY
    headers = {"Authorization": f"Bearer {bearer}"}
    url = f"{API_BASE_URL}/admin/users"
    resp = await client.get(url, headers=headers)
    return JSONResponse(resp.json())
```

## API Endpoints Used by Web App

### Dashboard Endpoints
- `/api/days` - Daily sales/turnover data
- `/api/mtd` - Month-to-date aggregated data
- `/api/targets` - Budget/target data (GET/POST)
- `/api/best-sellers` - Top selling products
- `/api/worst-gp` - Products with worst GP%
- `/api/stock-value` - Stock value information
- `/api/products/search` - Product search
- `/api/products/{code}/stock` - Product stock on hand
- `/api/products/{code}/sales` - Product sales history
- `/api/pharmacies/{id}/usage/top-180d` - Usage data
- `/api/pharmacies/{id}/usage/product/{code}` - Product usage
- `/api/negative-stock` - Products with negative stock

### Admin Endpoints
- `/api/admin/users` - List/create/update/delete users
- `/api/admin/users/{id}` - Get/update user details
- `/api/admin/users/{id}/pharmacies` - Manage pharmacy access
- `/api/admin/pharmacies` - List all pharmacies

### Debtor Endpoints
- `/api/pharmacies/{id}/debtors` - Get debtors list
- `/api/pharmacies/{id}/debtors/statistics` - Debtor statistics
- `/api/pharmacies/{id}/debtors/reports` - Report history
- `/api/pharmacies/{id}/debtors/send-email` - Send emails
- `/api/pharmacies/{id}/debtors/send-sms` - Send SMS
- `/api/pharmacies/{id}/debtors/download-csv` - Download CSV
- `/api/pharmacies/{id}/debtors/download-pdf` - Download PDF

## Data Flow Example

### Example: Loading Dashboard Data

1. **Frontend** (`dashboard.html`):
   ```javascript
   async function loadDashboard() {
     const resp = await fetch(`/api/days?pid=${pid}&month=${month}`);
     const data = await resp.json();
     // Process and display data
   }
   ```

2. **Backend** (`main.py`):
   ```python
   @app.get("/api/days")
   async def api_days(request: Request, pid: int, month: str):
       # Get auth token from session
       headers = _auth_headers(request)
       
       # Forward to external API
       url = f"{API_BASE_URL}/pharmacies/{pid}/days?from={from_date}&to={to_date}"
       async with httpx.AsyncClient(timeout=20) as client:
           resp = await client.get(url, headers=headers)
       
       # Return response to frontend
       return JSONResponse(resp.json())
   ```

3. **External API** (`PHARMA_API_BASE`):
   - Processes request with Authorization header
   - Returns JSON data
   - Data flows back through proxy to frontend

## Authentication Headers Strategy

The backend uses a **fallback strategy** for authentication:

```python
def _auth_headers(request: Request) -> dict:
    # Priority 1: Use API_KEY if configured
    if API_KEY:
        return {"Authorization": f"Bearer {API_KEY}"}
    
    # Priority 2: Use user's session token
    bearer = request.session.get("auth_token")
    return {"Authorization": f"Bearer {bearer}"} if bearer else {}
```

For admin endpoints, it also tries `X-API-Key` header as fallback:
```python
if resp.status_code == 401 and API_KEY:
    resp = await client.get(url, headers={"X-API-Key": API_KEY})
```

## Error Handling

### Frontend Error Handling
- **Dashboard**: Basic try/catch blocks, logs errors to console
- **Admin**: Centralized `checkResponse()` method:
  ```javascript
  checkResponse(response) {
    if (response.status === 401) {
      throw new Error('Unauthorized. Please log in again.');
    }
    if (response.status === 403) {
      throw new Error('Access denied.');
    }
  }
  ```

### Backend Error Handling
- Returns appropriate HTTP status codes
- Provides error details in response
- Logs errors for debugging
- Falls back to alternative auth methods on 401

## Loading Indicators

The dashboard implements a **global loading overlay** system:

```javascript
// Intercepts all fetch calls
var originalFetch = window.fetch;
window.fetch = function() {
  var url = /* extract URL */;
  var isApiCall = url && url.startsWith('/api/');
  
  if (isApiCall) {
    showLoadingOverlay();
  }
  
  return originalFetch.apply(this, arguments)
    .finally(() => {
      if (isApiCall) {
        hideLoadingOverlay();
      }
    });
};
```

## Key Differences: Dashboard vs Admin

| Aspect | Dashboard | Admin |
|--------|-----------|-------|
| **Pattern** | Direct fetch calls | Service object pattern |
| **Organization** | Scattered throughout code | Centralized in `AdminService` |
| **Error Handling** | Basic try/catch | Centralized `checkResponse()` |
| **Headers** | Implicit (session cookies) | Explicit `credentials: 'include'` |
| **Maintainability** | Lower (duplicated code) | Higher (reusable methods) |

## Recommendations

1. **Consider creating a centralized API service** for the dashboard similar to `AdminService`
2. **Standardize error handling** across all API calls
3. **Add request/response interceptors** for consistent behavior
4. **Consider using a library** like Axios for better error handling and interceptors

## Summary

The web app uses a **proxy architecture** where:
- Frontend makes requests to `/api/*` endpoints
- Backend proxies these to external API with authentication
- Session-based auth stores token server-side
- Frontend relies on cookies for authentication
- Dashboard uses direct fetch calls, Admin uses service pattern
- All API calls go through the FastAPI backend proxy layer

