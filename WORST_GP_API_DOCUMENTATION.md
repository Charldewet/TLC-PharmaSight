# Worst GP API Call Flow Documentation

This document explains how we're calling the Worst GP API endpoint from the frontend through our backend proxy to your external API.

## Overview

**Flow:** Frontend (Browser) → Backend Proxy (`/api/worst-gp`) → External API (`/pharmacies/{pid}/stock-activity/low-gp/range`)

---

## 1. Frontend Call (JavaScript)

**Location:** `app/templates/dashboard.html`

### Monthly Summary View (Date Range)
When the Monthly Summary tab is active, we call:

```javascript
// Example: Selected date is 2025-10-29
const fromDate = '2025-10-01'; // First day of month
const toDate = '2025-10-29';   // Selected date

const url = `/api/worst-gp?pid=1&from_date=2025-10-01&to_date=2025-10-29&threshold=20&limit=50&exclude_pdst=true`;

const resp = await fetch(url);
const data = await resp.json();
```

### Parameters:
- `pid` (required): Pharmacy ID (integer)
- `from_date` (required for monthly): Start date in format `YYYY-MM-DD`
- `to_date` (required for monthly): End date in format `YYYY-MM-DD`
- `threshold` (optional, default: 20): GP% threshold (returns products with GP% ≤ threshold)
- `limit` (optional, default: 100): Maximum number of products to return
- `exclude_pdst` (optional, default: false): If `true`, excludes PDST/KSAA products

---

## 2. Backend Proxy (FastAPI)

**Location:** `app/main.py`

### Endpoint Definition:
```python
@app.get("/api/worst-gp")
async def api_worst_gp(
    request: Request, 
    pid: int, 
    date: str = None,           # For single date
    from_date: str = None,       # For date range
    to_date: str = None,         # For date range
    limit: int = 100, 
    threshold: int = 20, 
    exclude_pdst: bool = False
) -> JSONResponse:
```

### External API Call (Range Endpoint):
For monthly view (when `from_date` and `to_date` are provided):

```python
if from_date and to_date:
    url = f"{API_BASE_URL}/pharmacies/{pid}/stock-activity/low-gp/range?from={from_date}&to={to_date}&threshold={threshold}&limit={limit}"
    if exclude_pdst:
        url += "&exclude_pdst=true"
    resp = await client.get(url, headers=headers)
```

**Full URL Example:**
```
https://pharmacy-api-webservice.onrender.com/pharmacies/1/stock-activity/low-gp/range?from=2025-10-01&to=2025-10-29&threshold=20&limit=50&exclude_pdst=true
```

### Expected Response Format:
The range endpoint should return:
```json
{
  "items": [
    {
      "product_name": "Product Name",
      "nappi_code": "LP1234567",
      "quantity_sold": 100,
      "total_sales": 5000.00,
      "cost": 4000.00,
      "gp_value": 1000.00,
      "gp_percent": 20.0
    },
    ...
  ]
}
```

### Backend Processing:
Our backend transforms the response to a consistent format:

```python
data = resp.json()

# Handle response format
if isinstance(data, dict) and "items" in data:
    # Range endpoint format - transform to our standard format
    return JSONResponse({
        "pharmacy_id": pid,
        "date": f"{from_date} to {to_date}",
        "worst_gp_products": data["items"][:limit]
    })
```

**Final Response to Frontend:**
```json
{
  "pharmacy_id": 1,
  "date": "2025-10-01 to 2025-10-29",
  "worst_gp_products": [
    {
      "product_name": "Product Name",
      "nappi_code": "LP1234567",
      "quantity_sold": 100,
      "gp_percent": 20.0,
      ...
    },
    ...
  ]
}
```

---

## 3. Current Issue

**Problem:** The external API endpoint is returning an empty array.

**What We're Receiving:**
```json
{
  "pharmacy_id": 1,
  "date": "2025-10-01 to 2025-10-29",
  "worst_gp_products": []
}
```

**What We're Sending:**
```
GET /pharmacies/1/stock-activity/low-gp/range?from=2025-10-01&to=2025-10-29&threshold=20&limit=50&exclude_pdst=true
```

---

## 4. Debug Information

We've added debug logging in the backend to see what's being returned:

```python
print(f"[DEBUG] Worst GP API Response - URL: {url}")
print(f"[DEBUG] Response keys: {data.keys() if isinstance(data, dict) else 'list'}")
if isinstance(data, dict) and "items" in data:
    print(f"[DEBUG] Items count: {len(data['items'])}")
```

Check the server logs (`server.log`) for these debug messages.

---

## 5. Expected Behavior

1. **Filter by GP%**: Returns products where `gp_percent ≤ threshold` (20%)
2. **Exclude Zero/Negative Turnover**: Should exclude products with zero or negative turnover
3. **Exclude PDST/KSAA**: When `exclude_pdst=true`, should filter out PDST and KSAA products
4. **Sorting**: Should be sorted by GP% ascending (lowest first)
5. **Aggregation**: Should aggregate sales across the date range (from_date to to_date)

---

## 6. Sample Request (cURL)

For your backend team to test directly:

```bash
curl -X GET "https://pharmacy-api-webservice.onrender.com/pharmacies/1/stock-activity/low-gp/range?from=2025-10-01&to=2025-10-29&threshold=20&limit=50&exclude_pdst=true" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-API-Key: YOUR_API_KEY"
```

Or without exclude_pdst to see all products:

```bash
curl -X GET "https://pharmacy-api-webservice.onrender.com/pharmacies/1/stock-activity/low-gp/range?from=2025-10-01&to=2025-10-29&threshold=20&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-API-Key: YOUR_API_KEY"
```

---

## 7. Field Mapping

We expect the following fields in the response:
- `product_name` (or `product_description` as fallback)
- `nappi_code` (or `product_code` as fallback)
- `quantity_sold` (or `qty_sold` as fallback)
- `gp_percent` (or `gp_pct` as fallback)
- `total_sales` (optional)
- `cost` (optional)
- `gp_value` (optional)

---

## Summary for Backend Team

**Endpoint:** `GET /pharmacies/{pharmacyId}/stock-activity/low-gp/range`

**Parameters:**
- `from` (required): Start date `YYYY-MM-DD`
- `to` (required): End date `YYYY-MM-DD`
- `threshold` (required): GP% threshold (integer, e.g., 20)
- `limit` (optional): Max items to return (default: 100)
- `exclude_pdst` (optional): Boolean flag to exclude PDST/KSAA products

**Expected Response:**
```json
{
  "items": [
    {
      "product_name": "...",
      "nappi_code": "...",
      "quantity_sold": 100,
      "gp_percent": 15.5,
      "total_sales": 5000.00,
      "cost": 4225.00,
      "gp_value": 775.00
    }
  ]
}
```

**Current Issue:** Empty `items` array is being returned even when there should be products with GP% ≤ 20% in the date range.

