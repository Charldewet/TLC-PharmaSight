# API Endpoints Documentation

This document provides a comprehensive overview of all API endpoints used by the BudgetingApp web application, including how they're called, what parameters they accept, and what they return.

## Base URL

All endpoints are relative to the web app's domain. The backend API base URL is configured via `PHARMA_API_BASE` environment variable (default: `https://pharmacy-api-webservice.onrender.com`).

## Authentication

Most endpoints use session-based authentication (cookies). The app stores an `auth_token` in the session after login. Some endpoints also support Bearer token authentication via the `Authorization` header.

**Note:** The web app acts as a proxy - it forwards requests to the backend API with appropriate authentication headers.

---

## Authentication Endpoints

### POST `/login`
**Purpose:** User login (web form submission)

**Location:** `app/main.py:71-134`

**Request:**
- Method: POST (form data)
- Body: `username`, `password` (form fields)

**Response:**
- Success: Redirects to `/dashboard` (303)
- Failure: Returns login page with error message (401)

**Frontend Usage:** Called from `app/templates/login.html` form submission

---

### POST `/api/mobile/login`
**Purpose:** Mobile app login endpoint (returns JSON)

**Location:** `app/main.py:137-185`

**Request:**
- Method: POST
- Content-Type: `application/x-www-form-urlencoded`
- Body: `username`, `password`

**Response:**
```json
{
  "token": "auth_token_string",
  "username": "canonical_username",
  "user_id": 123
}
```

**Frontend Usage:** Mobile app only (`mobile/src/services/api.js`)

---

## Dashboard & Pharmacy Data

### GET `/dashboard`
**Purpose:** Main dashboard page (server-rendered)

**Location:** `app/main.py:224-279`

**Request:**
- Method: GET
- Authentication: Session cookie required

**Response:** HTML page with pharmacy list

**Frontend Usage:** Initial page load, redirects to `/login` if not authenticated

---

### GET `/api/mobile/pharmacies`
**Purpose:** Get user's pharmacies (mobile-friendly)

**Location:** `app/main.py:188-221`

**Request:**
- Method: GET
- Query Parameters:
  - `username` (required): Username to fetch pharmacies for
- Headers:
  - `Authorization: Bearer <token>` (optional, for mobile apps)

**Response:**
```json
{
  "pharmacies": [
    {
      "pharmacy_id": 1,
      "pharmacy_name": "Pharmacy Name",
      ...
    }
  ]
}
```

**Frontend Usage:** 
- Mobile app: `mobile/src/services/api.js` (dashboardAPI.getPharmacies)
- Web app: Called server-side in `/dashboard` route

---

## Daily Sales Data

### GET `/api/days`
**Purpose:** Get daily sales/turnover data for a pharmacy

**Location:** `app/main.py:282-304`

**Request:**
- Method: GET
- Query Parameters:
  - `pid` (required): Pharmacy ID
  - `month` (required): Month in `YYYY-MM` format

**Response:**
```json
[
  {
    "business_date": "2024-01-01",
    "turnover": 12345.67,
    "purchases": 5000.00,
    "closing_stock": 100000.00,
    ...
  }
]
```

**Frontend Usage:** 
- `app/templates/dashboard.html` - Multiple locations:
  - Line 3189: Daily summary loading
  - Line 3351: Targets section
  - Line 3434: Previous dates for comparison
  - Line 5987, 6023, 6029, 6034: Monthly tracking charts
  - Line 7174: Daily summary section
  - Line 7228: Previous year comparison
  - Line 5533, 8567, 8613, 8674, 8765, 8851, 9207: Various chart data loading

**Usage Pattern:**
```javascript
const resp = await fetch(`/api/days?pid=${encodeURIComponent(pid)}&month=${encodeURIComponent(month)}`);
const data = await resp.json();
```

---

## Month-to-Date (MTD) Data

### GET `/api/mtd`
**Purpose:** Get month-to-date aggregated data for a pharmacy

**Location:** `app/main.py:439-459`

**Request:**
- Method: GET
- Query Parameters:
  - `pid` (required): Pharmacy ID
  - `month` (required): Month in `YYYY-MM` format
  - `through` (required): Date to aggregate through in `YYYY-MM-DD` format

**Response:**
```json
{
  "pharmacy_id": 1,
  "month": "2024-01",
  "through": "2024-01-15",
  "total_turnover": 123456.78,
  "total_purchases": 50000.00,
  ...
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 5219: Monthly summary MTD purchases
  - Line 5475: Stock value calculations
  - Line 6044: Monthly tracking MTD aggregation
  - Line 7510: Monthly summary section
  - Line 7553: Previous year MTD comparison
  - Line 8478, 8507: Year-over-year comparisons

**Usage Pattern:**
```javascript
const mtdResp = await fetch(`/api/mtd?pid=${pid}&month=${month}&through=${throughDate}`);
const mtdData = await mtdResp.json();
```

---

## Targets

### GET `/api/targets`
**Purpose:** Get targets for a pharmacy and month

**Location:** `app/main.py:540-571`

**Request:**
- Method: GET
- Query Parameters:
  - `pid` (required): Pharmacy ID
  - `month` (required): Month in `YYYY-MM` format
- Authentication: Session cookie (uses user's auth token)

**Response:**
```json
{
  "pharmacy_id": 1,
  "month": "2024-01",
  "targets": {
    "2024-01-01": 10000.00,
    "2024-01-02": 12000.00,
    ...
  }
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 3351: Initial targets loading
  - Line 3456: Previous dates targets
  - Line 6002, 6038: Monthly tracking targets
  - Line 11161, 11211: Additional target loading

**Usage Pattern:**
```javascript
const targetsResp = await fetch(`/api/targets?pid=${pid}&month=${month}`);
const targets = await targetsResp.json();
```

---

### POST `/api/targets`
**Purpose:** Save/update targets for a pharmacy and month

**Location:** `app/main.py:573-627`

**Request:**
- Method: POST
- Query Parameters:
  - `pid` (required): Pharmacy ID
  - `month` (required): Month in `YYYY-MM` format
- Body (JSON):
```json
{
  "2024-01-01": 10000.00,
  "2024-01-02": 12000.00,
  ...
}
```

**Response:**
```json
{
  "pharmacy_id": 1,
  "month": "2024-01",
  "targets": { ... }
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 3595: Saving targets after editing

**Usage Pattern:**
```javascript
const resp = await fetch(`/api/targets?pid=${pid}&month=${month}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(targetsData)
});
```

---

## Stock Value

### GET `/api/stock-value`
**Purpose:** Get stock value (closing stock) for a pharmacy

**Location:** `app/main.py:462-537`

**Request:**
- Method: GET
- Query Parameters:
  - `pid` (required): Pharmacy ID
  - `date` (optional): Date in `YYYY-MM-DD` format (defaults to yesterday)

**Response:**
```json
{
  "pharmacy_id": 1,
  "date": "2024-01-15",
  "current_stock_value": 100000.00,
  "opening_stock_value": 95000.00,
  "stock_change": 5000.00,
  "stock_change_percent": 5.26
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 5435: Stock value card in daily summary

**Usage Pattern:**
```javascript
const stockValueResp = await fetch(`/api/stock-value?pid=${pid}&date=${date}`);
const stockValue = await stockValueResp.json();
```

---

## Best Sellers

### GET `/api/best-sellers`
**Purpose:** Get top best-selling products for a pharmacy

**Location:** `app/main.py:309-344`

**Request:**
- Method: GET
- Query Parameters:
  - `pid` (required): Pharmacy ID
  - `date` (optional): Single date in `YYYY-MM-DD` format
  - `from_date` (optional): Start date in `YYYY-MM-DD` format (requires `to_date`)
  - `to_date` (optional): End date in `YYYY-MM-DD` format (requires `from_date`)
  - `limit` (optional): Number of results (default: 20)

**Response:**
```json
{
  "pharmacy_id": 1,
  "date": "2024-01-15",
  "best_sellers": [
    {
      "product_code": "ABC123",
      "product_name": "Product Name",
      "quantity_sold": 100,
      "revenue": 5000.00,
      ...
    }
  ]
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 4565: Daily summary best sellers
  - Line 5663: Best sellers section (date range)
  - Line 5810, 5814: Best sellers with date/range selection
  - Line 10520, 10522: Additional best sellers loading

**Usage Pattern:**
```javascript
// Single date
const url = `/api/best-sellers?pid=${pid}&date=${date}&limit=20`;

// Date range
const url = `/api/best-sellers?pid=${pid}&from_date=${fromDate}&to_date=${toDate}&limit=20`;
```

---

## Worst GP Products

### GET `/api/worst-gp`
**Purpose:** Get products with worst GP% for a pharmacy

**Location:** `app/main.py:347-436`

**Request:**
- Method: GET
- Query Parameters:
  - `pid` (required): Pharmacy ID
  - `date` (optional): Single date in `YYYY-MM-DD` format
  - `from_date` (optional): Start date in `YYYY-MM-DD` format (requires `to_date`)
  - `to_date` (optional): End date in `YYYY-MM-DD` format (requires `from_date`)
  - `limit` (optional): Number of results (default: 100)
  - `threshold` (optional): GP% threshold (default: 20)
  - `exclude_pdst` (optional): Exclude PDST products (default: false)

**Response:**
```json
{
  "pharmacy_id": 1,
  "date": "2024-01-15",
  "worst_gp_products": [
    {
      "product_code": "ABC123",
      "product_name": "Product Name",
      "gp_percent": 5.5,
      "revenue": 1000.00,
      ...
    }
  ]
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 5725: Worst GP section (date range)
  - Line 5900, 5904: Worst GP with date/range selection
  - Line 10707, 10710: Additional worst GP loading

**Usage Pattern:**
```javascript
const url = `/api/worst-gp?pid=${pid}&from_date=${fromDate}&to_date=${toDate}&threshold=20&limit=50&exclude_pdst=true`;
```

---

## Product Search & Details

### GET `/api/products/search`
**Purpose:** Search for products by name or code

**Location:** `app/main.py:630-650`

**Request:**
- Method: GET
- Query Parameters:
  - `query` (optional): Search query string
  - `page` (optional): Page number (default: 1)
  - `page_size` (optional): Results per page (default: 200)

**Response:**
```json
{
  "products": [
    {
      "product_code": "ABC123",
      "product_name": "Product Name",
      ...
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 200
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 3710: Stock queries product search

**Usage Pattern:**
```javascript
const url = `/api/products/search?query=${encodeURIComponent(query)}&page=1&page_size=200`;
```

---

### GET `/api/products/{product_code}/stock`
**Purpose:** Get stock on hand for a specific product

**Location:** `app/main.py:682-712`

**Request:**
- Method: GET
- Path Parameters:
  - `product_code` (required): Product code
- Query Parameters:
  - `pharmacy_id` (required): Pharmacy ID
  - `date` (required): Date in `YYYY-MM-DD` format

**Response:**
```json
{
  "on_hand": 50
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 3880: Stock queries product details expansion

**Usage Pattern:**
```javascript
fetch(`/api/products/${encodeURIComponent(productCode)}/stock?pharmacy_id=${pid}&date=${dateStr}`)
```

---

### GET `/api/products/{product_code}/sales`
**Purpose:** Get product sales details for a date range

**Location:** `app/main.py:653-679`

**Request:**
- Method: GET
- Path Parameters:
  - `product_code` (required): Product code
- Query Parameters:
  - `pharmacy_id` (required): Pharmacy ID
  - `from_date` (required): Start date in `YYYY-MM-DD` format
  - `to_date` (required): End date in `YYYY-MM-DD` format

**Response:**
```json
{
  "product_code": "ABC123",
  "pharmacy_id": 1,
  "from_date": "2024-01-01",
  "to_date": "2024-01-31",
  "total_quantity": 100,
  "total_revenue": 5000.00,
  "daily_sales": [
    {
      "date": "2024-01-01",
      "quantity": 5,
      "revenue": 250.00
    }
  ]
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 3943: Stock queries product sales details
  - Line 4051, 4109: Product sales chart data
  - Line 4634: Best sellers product details

**Usage Pattern:**
```javascript
const url = `/api/products/${encodeURIComponent(productCode)}/sales?from_date=${startDate}&to_date=${endDate}&pharmacy_id=${pid}`;
```

---

## Usage Data

### GET `/api/pharmacies/{pharmacy_id}/usage/top-180d`
**Purpose:** Get 180-day average daily usage for top products

**Location:** `app/main.py:715-740`

**Request:**
- Method: GET
- Path Parameters:
  - `pharmacy_id` (required): Pharmacy ID
- Query Parameters:
  - `limit` (optional): Number of results (default: 200)

**Response:**
```json
[
  {
    "product_code": "ABC123",
    "product_name": "Product Name",
    "avg_daily_usage": 5.5,
    "total_usage": 990,
    ...
  }
]
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 4586: Best sellers usage data

**Usage Pattern:**
```javascript
const usageRes = await fetch(`/api/pharmacies/${pid}/usage/top-180d?limit=200`);
```

---

### GET `/api/pharmacies/{pharmacy_id}/usage/product/{product_code}`
**Purpose:** Get usage data for a specific product

**Location:** `app/main.py:775-795`

**Request:**
- Method: GET
- Path Parameters:
  - `pharmacy_id` (required): Pharmacy ID
  - `product_code` (required): Product code

**Response:**
```json
{
  "product_code": "ABC123",
  "pharmacy_id": 1,
  "avg_daily_usage": 5.5,
  "usage_history": [...]
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 4608: Best sellers product usage details

**Usage Pattern:**
```javascript
fetch(`/api/pharmacies/${pid}/usage/product/${encodeURIComponent(code)}`)
```

---

## Negative Stock

### GET `/api/negative-stock`
**Purpose:** Get products with negative stock on hand

**Location:** `app/main.py:743-772`

**Request:**
- Method: GET
- Query Parameters:
  - `pid` (required): Pharmacy ID
  - `date` (required): Date in `YYYY-MM-DD` format
  - `limit` (optional): Number of results (default: 200)

**Response:**
```json
{
  "pharmacy_id": 1,
  "date": "2024-01-15",
  "items": [
    {
      "product_code": "ABC123",
      "product_name": "Product Name",
      "on_hand": -5,
      ...
    }
  ]
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 4905: Negative stock section

**Usage Pattern:**
```javascript
const negativeStockUrl = `/api/negative-stock?pid=${pid}&date=${dateStr}&limit=200`;
```

---

## Admin Endpoints

All admin endpoints require admin access (user_id: 2 or 9, or username: "charl", "admin", "amin").

### GET `/api/admin/users`
**Purpose:** List all users

**Location:** `app/main.py:863-910`

**Request:**
- Method: GET
- Authentication: Session cookie (admin only)

**Response:**
```json
[
  {
    "user_id": 1,
    "username": "user1",
    "is_active": true,
    "pharmacy_count": 5,
    "created_at": "2024-01-01T00:00:00"
  }
]
```

**Frontend Usage:**
- `app/templates/admin.html`:
  - Line 566: AdminService.listUsers()

---

### GET `/api/admin/users/{user_id}`
**Purpose:** Get user details

**Location:** `app/main.py:913-931`

**Request:**
- Method: GET
- Path Parameters:
  - `user_id` (required): User ID

**Response:**
```json
{
  "user_id": 1,
  "username": "user1",
  "is_active": true,
  "pharmacies": [...]
}
```

**Frontend Usage:**
- `app/templates/admin.html`:
  - Line 576: AdminService.getUserDetails()

---

### POST `/api/admin/users`
**Purpose:** Create a new user

**Location:** `app/main.py:934-954`

**Request:**
- Method: POST
- Body (JSON):
```json
{
  "username": "newuser",
  "password": "password123",
  "pharmacy_ids": [1, 2, 3],
  "can_write": false
}
```

**Response:**
```json
{
  "user_id": 5,
  "username": "newuser",
  ...
}
```

**Frontend Usage:**
- `app/templates/admin.html`:
  - Line 590: AdminService.createUser()

---

### PUT `/api/admin/users/{user_id}`
**Purpose:** Update a user

**Location:** `app/main.py:957-977`

**Request:**
- Method: PUT
- Path Parameters:
  - `user_id` (required): User ID
- Body (JSON):
```json
{
  "username": "updateduser",
  "password": "newpassword",
  "is_active": true
}
```

**Frontend Usage:**
- `app/templates/admin.html`:
  - Line 616: AdminService.updateUser()

---

### DELETE `/api/admin/users/{user_id}`
**Purpose:** Delete a user

**Location:** `app/main.py:1050-1071`

**Request:**
- Method: DELETE
- Path Parameters:
  - `user_id` (required): User ID

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

**Frontend Usage:**
- `app/templates/admin.html`:
  - Line 689: AdminService.deleteUser()

---

### GET `/api/admin/pharmacies`
**Purpose:** List all pharmacies

**Location:** `app/main.py:1074-1091`

**Request:**
- Method: GET

**Response:**
```json
[
  {
    "pharmacy_id": 1,
    "pharmacy_name": "Pharmacy Name",
    "is_active": true
  }
]
```

**Frontend Usage:**
- `app/templates/admin.html`:
  - Line 701: AdminService.listPharmacies()

---

### POST `/api/admin/users/{user_id}/pharmacies`
**Purpose:** Grant pharmacy access to a user

**Location:** `app/main.py:980-1000`

**Request:**
- Method: POST
- Path Parameters:
  - `user_id` (required): User ID
- Body (JSON):
```json
{
  "pharmacy_id": 1,
  "can_read": true,
  "can_write": false
}
```

**Frontend Usage:**
- `app/templates/admin.html`:
  - Line 632: AdminService.grantPharmacyAccess()

---

### DELETE `/api/admin/users/{user_id}/pharmacies/{pharmacy_id}`
**Purpose:** Revoke pharmacy access from a user

**Location:** `app/main.py:1003-1021`

**Request:**
- Method: DELETE
- Path Parameters:
  - `user_id` (required): User ID
  - `pharmacy_id` (required): Pharmacy ID

**Frontend Usage:**
- `app/templates/admin.html`:
  - Line 652: AdminService.revokePharmacyAccess()

---

### GET `/api/admin/users/{user_id}/pharmacies`
**Purpose:** Get user's pharmacy access list

**Location:** `app/main.py:1024-1047`

**Request:**
- Method: GET
- Path Parameters:
  - `user_id` (required): User ID

**Response:**
```json
[
  {
    "pharmacy_id": 1,
    "pharmacy_name": "Pharmacy Name",
    "can_read": true,
    "can_write": false
  }
]
```

**Frontend Usage:**
- `app/templates/admin.html`:
  - Line 663: AdminService.getUserPharmacies()

---

## Debtor Management Endpoints

### GET `/api/pharmacies/{pharmacy_id}/debtors/statistics`
**Purpose:** Get debtor statistics

**Location:** `app/main.py:1301-1338`

**Request:**
- Method: GET
- Path Parameters:
  - `pharmacy_id` (required): Pharmacy ID

**Response:**
```json
{
  "total_accounts": 100,
  "total_outstanding": 50000.00,
  "current": 20000.00,
  "d30": 10000.00,
  "d60": 8000.00,
  "d90": 6000.00,
  "d120": 4000.00,
  "d150": 2000.00,
  "d180": 0.00
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 12255: Debtor statistics loading

---

### GET `/api/pharmacies/{pharmacy_id}/debtors`
**Purpose:** Get debtors list with filters

**Location:** `app/main.py:1256-1298`

**Request:**
- Method: GET
- Path Parameters:
  - `pharmacy_id` (required): Pharmacy ID
- Query Parameters:
  - `min_balance` (optional): Minimum balance filter
  - `ageing_buckets` (optional): Comma-separated list (e.g., "d30,d60")
  - `has_email` (optional): Filter by email presence ("true"/"false")
  - `has_phone` (optional): Filter by phone presence ("true"/"false")
  - `search` (optional): Search query
  - `page` (optional): Page number (default: 1)
  - `per_page` (optional): Results per page (default: 100)
  - `sort_by` (optional): Sort column
  - `sort_order` (optional): Sort direction ("asc"/"desc")

**Response:**
```json
{
  "debtors": [
    {
      "debtor_id": 1,
      "account_number": "ACC001",
      "name": "Debtor Name",
      "balance": 1000.00,
      "email": "email@example.com",
      "phone": "1234567890",
      ...
    }
  ],
  "page": 1,
  "per_page": 100,
  "total": 50,
  "pages": 1
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 12353: Debtor list loading with filters

---

### POST `/api/pharmacies/{pharmacy_id}/debtors/send-email`
**Purpose:** Send emails to selected debtors

**Location:** `app/main.py:1341-1371`

**Request:**
- Method: POST
- Path Parameters:
  - `pharmacy_id` (required): Pharmacy ID
- Body (JSON):
```json
{
  "debtor_ids": [1, 2, 3],
  "subject": "Payment Reminder",
  "message": "Please pay your outstanding balance"
}
```

**Response:**
```json
{
  "sent": 3,
  "failed": 0,
  "results": [...]
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Note: Currently calls external service `https://debtor-reminder-backend.onrender.com/send_email` (Line 12845)
  - Should be migrated to use this endpoint

---

### POST `/api/pharmacies/{pharmacy_id}/debtors/send-sms`
**Purpose:** Send SMS to selected debtors

**Location:** `app/main.py:1374-1404`

**Request:**
- Method: POST
- Path Parameters:
  - `pharmacy_id` (required): Pharmacy ID
- Body (JSON):
```json
{
  "debtor_ids": [1, 2, 3],
  "message": "Please pay your outstanding balance"
}
```

**Response:**
```json
{
  "sent": 3,
  "failed": 0,
  "results": [...]
}
```

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Note: Currently calls external service `https://debtor-reminder-backend.onrender.com/send_sms` (Line 12983)
  - Should be migrated to use this endpoint

---

### POST `/api/pharmacies/{pharmacy_id}/debtors/download-csv`
**Purpose:** Download CSV of debtors

**Location:** `app/main.py:1407-1446`

**Request:**
- Method: POST
- Path Parameters:
  - `pharmacy_id` (required): Pharmacy ID
- Body (JSON):
```json
{
  "debtor_ids": [1, 2, 3],
  "filters": {...}
}
```

**Response:** CSV file download

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 13029: CSV download functionality

---

### POST `/api/pharmacies/{pharmacy_id}/debtors/download-pdf`
**Purpose:** Download PDF of debtors

**Location:** `app/main.py:1449-1488`

**Request:**
- Method: POST
- Path Parameters:
  - `pharmacy_id` (required): Pharmacy ID
- Body (JSON):
```json
{
  "debtor_ids": [1, 2, 3],
  "filters": {...}
}
```

**Response:** PDF file download

**Frontend Usage:**
- `app/templates/dashboard.html`:
  - Line 13056: PDF download functionality

---

### GET `/api/pharmacies/{pharmacy_id}/debtors/reports`
**Purpose:** Get debtor report upload history

**Location:** `app/main.py:1226-1253`

**Request:**
- Method: GET
- Path Parameters:
  - `pharmacy_id` (required): Pharmacy ID

**Response:**
```json
[
  {
    "report_id": 1,
    "uploaded_at": "2024-01-15T10:00:00",
    "file_name": "debtors_2024-01-15.pdf",
    ...
  }
]
```

**Frontend Usage:** Not currently used in frontend

---

### GET `/api/pharmacies/{pharmacy_id}/debtors/{debtor_id}/communications`
**Purpose:** Get communication history for a debtor

**Location:** `app/main.py:1491-1513`

**Request:**
- Method: GET
- Path Parameters:
  - `pharmacy_id` (required): Pharmacy ID
  - `debtor_id` (required): Debtor ID

**Response:**
```json
[
  {
    "communication_id": 1,
    "type": "email",
    "sent_at": "2024-01-15T10:00:00",
    "subject": "Payment Reminder",
    ...
  }
]
```

**Frontend Usage:** Not currently used in frontend

---

## Setup/Utility Endpoints

### POST `/setup/reactivate-charl`
**Purpose:** Emergency endpoint to reactivate Charl's account

**Location:** `app/main.py:1094-1139`

**Request:**
- Method: POST
- Body: None (uses API_KEY from environment)

**Response:**
```json
{
  "success": true,
  "message": "Charl's account has been reactivated successfully",
  "user": {...}
}
```

**Frontend Usage:**
- `app/templates/reactivate_charl.html`:
  - Line 69: Reactivation form submission

---

### POST `/setup/create-admin-user`
**Purpose:** One-time setup endpoint to create admin user

**Location:** `app/main.py:1142-1204`

**Request:**
- Method: POST
- Body: None (uses API_KEY from environment)

**Response:**
```json
{
  "success": true,
  "message": "Admin user created successfully",
  "user": {...}
}
```

**Frontend Usage:** Not currently used in frontend

---

### GET `/health`
**Purpose:** Health check endpoint

**Location:** `app/main.py:1213-1215`

**Response:**
```json
{
  "status": "ok"
}
```

---

### GET `/db-ping`
**Purpose:** Database connectivity check

**Location:** `app/main.py:1218-1222`

**Response:**
```json
{
  "db": "up",
  "result": 1
}
```

---

## Error Handling

All endpoints follow standard HTTP status codes:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

Error responses typically include:
```json
{
  "detail": "Error message description"
}
```

---

## Authentication Flow

1. **Web App:**
   - User submits login form to `/login` (POST)
   - Server authenticates with backend API
   - Server stores `auth_token` in session cookie
   - Subsequent requests use session cookie for authentication
   - Server forwards requests to backend API with Bearer token

2. **Mobile App:**
   - App calls `/api/mobile/login` (POST)
   - Receives `token` in JSON response
   - App stores token and sends in `Authorization: Bearer <token>` header
   - App calls `/api/mobile/pharmacies` with token in header

---

## Notes for Frontend Team

1. **Session Cookies:** Web app uses session cookies (`credentials: 'include'` in fetch calls)

2. **Loading Overlay:** The app automatically shows a loading overlay for API calls (except stock query endpoints). See `app/templates/dashboard.html` lines 2767-2805.

3. **Error Handling:** Most endpoints return empty data or default values on error rather than throwing exceptions. Check response status codes.

4. **Date Formats:**
   - Single dates: `YYYY-MM-DD`
   - Months: `YYYY-MM`
   - Always URL-encode date parameters

5. **Pharmacy ID:** Referred to as `pid` in query parameters, `pharmacy_id` in path parameters

6. **External Services:** Debtor email/SMS currently calls external service directly. Should be migrated to use proxy endpoints.

7. **CORS:** Backend API has CORS enabled for mobile app support.

---

## Backend API Base URL

The web app proxies requests to:
- Base URL: `https://pharmacy-api-webservice.onrender.com` (configurable via `PHARMA_API_BASE` env var)
- Authentication: Uses Bearer tokens or X-API-Key header
- The web app handles authentication translation (session → Bearer token)

