# Stock On Hand (SOH) API Implementation - Backend Team Reference

## 📋 Overview

We need to fetch Stock On Hand (SOH) data for individual products. Currently getting 0 for all products.

---

## 🔌 Our Backend Proxy Endpoint

**Endpoint:** `GET /api/products/{product_code}/stock`

**Parameters:**
- `product_code` (path parameter): Product code (e.g., "LP9037679")
- `pharmacy_id` (query parameter): Pharmacy ID (e.g., 1)
- `date` (query parameter): Date in YYYY-MM-DD format (e.g., "2025-11-12")

**Example Request:**
```
GET /api/products/LP9037679/stock?pharmacy_id=1&date=2025-11-12
```

**Expected Response:**
```json
{
  "on_hand": 116.7
}
```

---

## 🌐 External API Call We're Making

**Endpoint:** `GET /pharmacies/{pharmacyId}/stock-activity`

**Full URL Example:**
```
https://pharmacy-api-webservice.onrender.com/pharmacies/1/stock-activity?date=2025-11-12&limit=1000
```

**Headers:**
```
Authorization: Bearer {API_KEY}
Content-Type: application/json
```

**Expected Response Format:**
```json
{
  "items": [
    {
      "product_code": "LP9037679",
      "description": "ALLERGEX TABS 30",
      "on_hand": 116.7,
      "qty_sold": 3.0,
      "sales_val": 54.66,
      "cost_of_sales": 52.50,
      "gp_value": 2.16,
      "gp_pct": 3.90,
      "product_id": 12345
    },
    {
      "product_code": "LP9103984",
      "description": "MYLAN DICLOFENAC 50MG TABS 18",
      "on_hand": 747.832,
      "qty_sold": 12,
      "sales_val": 156,
      "cost_of_sales": 87.96,
      "gp_value": 68.04,
      "gp_pct": 43.62,
      "product_id": 1643
    }
  ],
  "nextCursor": null
}
```

---

## 💻 Our Backend Code (Python/FastAPI)

```python
@app.get("/api/products/{product_code}/stock")
async def api_product_stock(
    request: Request, 
    product_code: str, 
    pharmacy_id: int = Query(..., description="Pharmacy ID"),
    date: str = Query(..., description="Date in YYYY-MM-DD format")
) -> JSONResponse:
    """Get stock on hand for a specific product using /pharmacies/{id}/stock-activity endpoint"""
    headers = _auth_headers(request)
    
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            # Use the stock-activity endpoint which includes on_hand for all products
            url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/stock-activity?date={date}&limit=1000"
            print(f"[DEBUG] Calling stock-activity API: {url}")
            resp = await client.get(url, headers=headers)
            
            if resp.status_code == 401 and API_KEY:
                resp = await client.get(url, headers={"X-API-Key": API_KEY})
            
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("items", [])
                
                print(f"[DEBUG] Stock-activity API returned {len(items)} items for pharmacy {pharmacy_id}, date {date}")
                
                # Find the product by code (matching product_code field from API response)
                product_code_upper = product_code.upper()
                for item in items:
                    item_code = item.get("product_code") or item.get("stock_code") or item.get("code") or ""
                    item_code_upper = item_code.upper()
                    
                    # Try exact match first, then case-insensitive
                    if item_code == product_code or item_code_upper == product_code_upper:
                        on_hand = item.get("on_hand")
                        result = on_hand if on_hand is not None else 0
                        print(f"[DEBUG] Found SOH for {product_code} (matched {item_code}): {result}")
                        return JSONResponse({"on_hand": result})
                
                # Product not found in stock activity data
                print(f"[DEBUG] Product {product_code} not found in stock-activity response (searched {len(items)} items)")
                if items:
                    sample_codes = [item.get("product_code") or "N/A" for item in items[:5]]
                    print(f"[DEBUG] Sample product codes in response: {sample_codes}")
                return JSONResponse({"on_hand": 0})
            else:
                return JSONResponse({"error": f"Failed to fetch stock: {resp.status_code}"}, status_code=resp.status_code)
        except Exception as e:
            print(f"[ERROR] Failed to fetch product stock: {e}")
            return JSONResponse({"error": str(e)}, status_code=500)
```

---

## 🌐 Frontend Code (JavaScript)

**Frontend Call:**
```javascript
// Example: Fetching SOH for product "LP9037679" on date "2025-11-12"
var productCode = "LP9037679";
var pid = 1;
var dateStr = "2025-11-12";

fetch(`/api/products/${encodeURIComponent(productCode)}/stock?pharmacy_id=${pid}&date=${dateStr}`)
  .then(async function(r) {
    if (!r.ok) {
      console.error('[ERROR] SOH API error:', r.status, r.statusText);
      return { on_hand: 0, error: r.status };
    }
    var data = await r.json();
    console.log('[DEBUG] SOH API response:', data);
    return data;
  })
  .catch(function(e) {
    console.error('[ERROR] SOH fetch failed:', e);
    return { on_hand: 0, error: e.message };
  });
```

**Example Request URL:**
```
http://localhost:8000/api/products/LP9037679/stock?pharmacy_id=1&date=2025-11-12
```

---

## 🔍 Current Issue

**Problem:** We're getting `{"on_hand": 0}` for all products, even though:
1. The `/pharmacies/1/stock-activity?date=2025-11-12&limit=1000` endpoint returns products with `on_hand` values
2. We can see in the console that best-sellers endpoint returns `on_hand` values (e.g., `"on_hand": 747.832`)

**Error from Console:**
```
GET http://localhost:8000/api/products/LP9037679/stock?pharmacy_id=1&date=2025-11-12 422 (Unprocessable Entity)
[ERROR] SOH API error: 422 Unprocessable Entity
```

---

## ❓ Questions for Backend Team

1. **Does `/pharmacies/{pharmacyId}/stock-activity?date={date}&limit={limit}` return ALL products with stock on hand, or only products that were sold on that date?**

2. **If a product wasn't sold on a specific date, will it still appear in the `/stock-activity` response with its `on_hand` value?**

3. **What is the maximum `limit` value we can use?** (We're currently using 1000)

4. **Is there a different endpoint we should use to get SOH for a specific product by product_code?**

5. **Can you verify that the endpoint `/pharmacies/1/stock-activity?date=2025-11-12&limit=1000` returns product "LP9037679" with an `on_hand` value?**

6. **Are there any authentication or permission issues that might prevent certain products from appearing in the response?**

---

## 🧪 Test Request (cURL)

```bash
curl -X GET "https://pharmacy-api-webservice.onrender.com/pharmacies/1/stock-activity?date=2025-11-12&limit=1000" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

**Expected:** Response should include product "LP9037679" (or any product code we're searching for) with an `on_hand` field.

---

## 📊 What We're Doing

1. **Frontend** calls our proxy: `/api/products/{code}/stock?pharmacy_id={id}&date={date}`
2. **Our Backend** calls external API: `/pharmacies/{id}/stock-activity?date={date}&limit=1000`
3. **Our Backend** searches the `items` array for matching `product_code`
4. **Our Backend** returns `{"on_hand": value}` or `{"on_hand": 0}` if not found
5. **Frontend** displays the SOH value in the product details card

---

## 🔑 Key Points

- We're looking for the `on_hand` field in each item of the `items` array
- We match products by `product_code` (case-insensitive)
- We handle `null` values by returning `0`
- We're using `limit=1000` to ensure we get the product
- The date format is `YYYY-MM-DD` (e.g., "2025-11-12")

---

## 📝 Server Logs to Check

When we call the endpoint, check server logs for:
- `[DEBUG] Calling stock-activity API: {url}`
- `[DEBUG] Stock-activity API returned X items for pharmacy Y, date Z`
- `[DEBUG] Found SOH for {code} (matched {code}): {value}` OR
- `[DEBUG] Product {code} not found in stock-activity response (searched X items)`
- `[DEBUG] Sample product codes in response: [...]`

These logs will show us:
1. What URL we're calling
2. How many items were returned
3. Whether the product was found
4. What product codes are actually in the response

