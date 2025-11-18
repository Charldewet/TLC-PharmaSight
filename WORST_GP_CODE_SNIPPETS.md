# Worst GP API - Code Snippets

## 1. Frontend JavaScript Call

```javascript
// From: app/templates/dashboard.html (line ~1954)

async function loadWorstGP() {
  const activeTab = document.querySelector('.sidebar-btn.active')?.getAttribute('data-tab');
  const isMonthlyView = activeTab === 'monthly-summary';
  
  // Get date and pharmacy ID
  const selectedDate = document.getElementById('datePicker')?.value || getTodayDate();
  const pid = selectedPharmacyId;
  
  let url;
  if (isMonthlyView) {
    // MONTHLY: Date range from 1st of month to selected date
    const fromDate = selectedDate.slice(0, 8) + '01'; // e.g., "2025-10-01"
    const toDate = selectedDate;                      // e.g., "2025-10-29"
    
    url = `/api/worst-gp?pid=${encodeURIComponent(pid)}&from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}&threshold=20&limit=50&exclude_pdst=true`;
  } else {
    // DAILY: Single date
    url = `/api/worst-gp?pid=${encodeURIComponent(pid)}&date=${encodeURIComponent(selectedDate)}&limit=50&exclude_pdst=true`;
  }
  
  const resp = await fetch(url);
  const data = await resp.json();
  
  // Process response
  let worstGPProducts = [];
  if (data.worst_gp_products) {
    worstGPProducts = data.worst_gp_products;
  } else if (data.items) {
    worstGPProducts = data.items;
  }
  
  // Render top 5 products...
}
```

---

## 2. Backend Proxy Code

```python
# From: app/main.py (line ~182)

@app.get("/api/worst-gp")
async def api_worst_gp(
    request: Request, 
    pid: int, 
    date: str = None,
    from_date: str = None,
    to_date: str = None,
    limit: int = 100,
    threshold: int = 20,
    exclude_pdst: bool = False
) -> JSONResponse:
    """Get products with worst GP% for a pharmacy"""
    
    headers = _auth_headers(request)  # Gets Authorization header from request
    API_BASE_URL = "https://pharmacy-api-webservice.onrender.com"
    
    async with httpx.AsyncClient(timeout=30) as client:
        # MONTHLY VIEW: Use range endpoint
        if from_date and to_date:
            url = f"{API_BASE_URL}/pharmacies/{pid}/stock-activity/low-gp/range?from={from_date}&to={to_date}&threshold={threshold}&limit={limit}"
            if exclude_pdst:
                url += "&exclude_pdst=true"
            resp = await client.get(url, headers=headers)
        
        # DAILY VIEW: Use single date endpoint
        elif date:
            url = f"{API_BASE_URL}/pharmacies/{pid}/stock-activity/worst-gp?date={date}&limit={limit}"
            resp = await client.get(url, headers=headers)
        else:
            raise HTTPException(status_code=400, detail="Either 'date' or both 'from_date' and 'to_date' must be provided")
        
        # Retry with API key if 401
        if resp.status_code == 401 and API_KEY:
            resp = await client.get(url, headers={"X-API-Key": API_KEY})
    
    # Handle errors
    if resp.status_code != 200:
        return JSONResponse({
            "pharmacy_id": pid,
            "date": date or f"{from_date} to {to_date}",
            "worst_gp_products": []
        })
    
    # Transform response to consistent format
    data = resp.json()
    
    if isinstance(data, dict) and "items" in data:
        # Range endpoint returns {"items": [...]}
        return JSONResponse({
            "pharmacy_id": pid,
            "date": f"{from_date} to {to_date}",
            "worst_gp_products": data["items"][:limit]
        })
    elif isinstance(data, list):
        # Single date endpoint returns [...]
        return JSONResponse({
            "pharmacy_id": pid,
            "date": date,
            "worst_gp_products": data[:limit]
        })
    
    return JSONResponse(data)
```

---

## 3. Exact URL Being Called (Monthly View)

**Example Request:**
```
GET https://pharmacy-api-webservice.onrender.com/pharmacies/1/stock-activity/low-gp/range?from=2025-10-01&to=2025-10-29&threshold=20&limit=50&exclude_pdst=true

Headers:
  Authorization: Bearer <token>
  OR
  X-API-Key: <api_key>
```

**Parsed Query Parameters:**
- `from`: `2025-10-01`
- `to`: `2025-10-29`
- `threshold`: `20`
- `limit`: `50`
- `exclude_pdst`: `true`

---

## 4. Expected vs Actual Response

### Expected:
```json
{
  "items": [
    {
      "product_name": "ALLERGEX TABS 30",
      "nappi_code": "LP9037679",
      "quantity_sold": 99,
      "total_sales": 1818.95,
      "gp_percent": 4.7
    },
    ...
  ]
}
```

### Actual (Current Issue):
```json
{
  "items": []
}
```

---

## 5. What We Know Works

The **best sellers** endpoint works correctly:
```
GET /pharmacies/1/stock-activity/by-quantity/range?from=2025-10-01&to=2025-10-29&limit=20
```

Returns:
```json
{
  "items": [
    {
      "product_name": "MYLAN DICLOFENAC 50MG TABS 18",
      "nappi_code": "LP9103984",
      "quantity_sold": 379,
      "total_sales": 4924.45,
      "gp_percent": 43.59
    },
    ...
  ]
}
```

So the date range format and authentication are working correctly. The issue is specific to the `low-gp/range` endpoint.

