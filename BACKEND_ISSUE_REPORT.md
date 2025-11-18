# Backend Issue Report - Worst GP API

## 🚨 Issue Summary

The `/pharmacies/{id}/stock-activity/low-gp/range` endpoint is returning **500 Internal Server Error** instead of product data.

---

## 🧪 Test Results

### Direct API Test
```
URL: https://pharmacy-api-webservice.onrender.com/pharmacies/1/stock-activity/low-gp/range

Parameters:
  - from: 2025-10-01
  - to: 2025-10-29
  - threshold: 20
  - limit: 50
  - exclude_pdst: true

Result: ❌ 500 Internal Server Error
Body: "Internal Server Error"
```

### Comparison with Working Endpoint

✅ **WORKING:** Best Sellers Endpoint
```
URL: /pharmacies/1/stock-activity/by-quantity/range
Parameters: from=2025-10-01&to=2025-10-29&limit=20
Result: ✅ 200 OK - Returns 20 products with correct format {"items": [...]}
```

❌ **BROKEN:** Worst GP Endpoint
```
URL: /pharmacies/1/stock-activity/low-gp/range
Parameters: from=2025-10-01&to=2025-10-29&threshold=20&limit=50&exclude_pdst=true
Result: ❌ 500 Internal Server Error
```

---

## 🔍 What This Means

1. **Endpoint Exists** ✅ (We didn't get 404 Not Found)
2. **Authentication Works** ✅ (We didn't get 401 Unauthorized)
3. **Backend Code Has a Bug** ❌ (Crashes when processing the request)

---

## 🎯 Expected Behavior (From Your Documentation)

For Reitz (pharmacy_id=1), October 1-29, GP% ≤ 20%, exclude PDST:
- **Expected:** ~50 products
- **Actual:** 500 Internal Server Error

Your documentation states this should return products like:
```json
{
  "items": [
    {
      "product_name": "ULTIMAG ADVANCED EFF TABS 10",
      "nappi_code": "LP9120710",
      "quantity_sold": 2.0,
      "total_sales": 121.66,
      "total_cost": 127.06,
      "gp_value": -5.4,
      "gp_percent": -4.44
    },
    ...
  ]
}
```

---

## 🛠️ Possible Causes

The backend code for `/stock-activity/low-gp/range` might be:

1. **SQL Query Error**: 
   - Syntax error in the aggregation query
   - Missing column or table
   - Date parsing issue

2. **Filter Logic Error**:
   - `exclude_pdst` parameter causing a crash
   - `threshold` parameter not being handled correctly

3. **Data Type Issue**:
   - Type conversion error (string to date, etc.)
   - Division by zero when calculating GP%

4. **Missing Data**:
   - Trying to access a field that doesn't exist
   - Null pointer exception

---

## 🧰 Recommended Backend Team Actions

### 1. Check Backend Logs
Look for the actual error/stack trace when this endpoint is called:
```bash
# Check application logs for the error
tail -f /var/log/app.log
# or wherever your FastAPI logs are
```

### 2. Test with Minimal Parameters
Try without `exclude_pdst` to see if that's causing the issue:
```bash
curl "https://pharmacy-api-webservice.onrender.com/pharmacies/1/stock-activity/low-gp/range?from=2025-10-01&to=2025-10-29&threshold=20&limit=50" \
  -H "Authorization: Bearer YOUR_KEY"
```

### 3. Compare with Working Endpoint
Review the code for `/stock-activity/by-quantity/range` (which works) and see what's different in `/stock-activity/low-gp/range`.

### 4. Test SQL Query Directly
If using SQL, test the query directly in the database:
```sql
-- Example query that might be failing
SELECT 
  product_name,
  nappi_code,
  SUM(quantity) as quantity_sold,
  SUM(sales) as total_sales,
  SUM(cost) as total_cost,
  (SUM(sales) - SUM(cost)) / NULLIF(SUM(sales), 0) * 100 as gp_percent
FROM stock_activity
WHERE pharmacy_id = 1
  AND date BETWEEN '2025-10-01' AND '2025-10-29'
  AND department NOT IN ('PDST', 'KSAA')  -- if exclude_pdst=true
GROUP BY product_name, nappi_code
HAVING (SUM(sales) - SUM(cost)) / NULLIF(SUM(sales), 0) * 100 <= 20
ORDER BY gp_percent ASC
LIMIT 50;
```

### 5. Add Error Handling
Make sure the endpoint has proper try-catch blocks and returns useful error messages:
```python
@app.get("/pharmacies/{pharmacy_id}/stock-activity/low-gp/range")
async def get_low_gp_range(pharmacy_id: int, ...):
    try:
        # Your logic here
        return {"items": products}
    except Exception as e:
        # Log the actual error
        logger.error(f"Error in low-gp/range: {str(e)}", exc_info=True)
        # Return a helpful error message
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 📊 Our Frontend Implementation

**Our frontend code is correct** and matches your documentation exactly:

```javascript
// Frontend calls
const url = `/api/worst-gp?pid=1&from_date=2025-10-01&to_date=2025-10-29&threshold=20&limit=50&exclude_pdst=true`;

// Backend proxy forwards to
https://pharmacy-api-webservice.onrender.com/pharmacies/1/stock-activity/low-gp/range?from=2025-10-01&to=2025-10-29&threshold=20&limit=50&exclude_pdst=true
```

We're correctly:
- ✅ Using the right endpoint URL
- ✅ Passing all required parameters
- ✅ Using correct date format (YYYY-MM-DD)
- ✅ Expecting `{"items": [...]}` response format
- ✅ Handling authentication properly

---

## 🔄 Workaround (Temporary)

Until the range endpoint is fixed, we could fall back to:
1. Fetch daily data for each day in the range
2. Aggregate it on the frontend
3. Filter by GP% threshold

**But this is inefficient and not recommended** - the backend should aggregate this data.

---

## ✅ What Works

These endpoints work correctly with the same authentication and date range:
- ✅ `/pharmacies/1/stock-activity/by-quantity/range` - Best sellers by range
- ✅ `/pharmacies/1/mtd` - Month-to-date aggregated data
- ✅ `/pharmacies/1/days` - Daily trading data

---

## 🎯 Next Steps

**For Backend Team:**
1. Check backend application logs for the 500 error stack trace
2. Fix the bug in `/stock-activity/low-gp/range` endpoint
3. Test with the exact parameters we're using (see test script below)
4. Deploy the fix
5. Let us know when it's ready to test again

**For Frontend Team (us):**
- ✅ Our implementation is correct
- ⏳ Waiting for backend fix
- 📝 All code is ready to work once backend is fixed

---

## 🧪 Test Script for Backend Team

We've created a test script you can run:

```bash
cd /Users/charldewet/Python/BudgetingApp
python test_worst_gp_api.py
```

This will show exactly what the API is returning.

---

## 📞 Contact

If you need any clarification or additional test cases, please let us know!

**Status:** 🔴 Blocked - Waiting for backend fix  
**Priority:** 🔥 High - Feature is complete but can't display data  
**Last Tested:** October 29, 2025

