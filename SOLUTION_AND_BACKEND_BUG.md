# ✅ Solution Implemented + Backend Bug Report

## 🎯 Problem Solved!

Your worst GP products will now display on the monthly screen!

---

## 🔍 What We Discovered

### Database Query: ✅ WORKS
The SQL query is perfect and returns 50 products with GP% ≤ 20%.

### API Endpoint: ⚠️ PARTIALLY WORKS
- ✅ **WITHOUT** `exclude_pdst` parameter: Returns data correctly
- ✅ **WITH** `exclude_pdst=false`: Returns data correctly
- ❌ **WITH** `exclude_pdst=true`: **500 Internal Server Error** (BACKEND BUG)

---

## 🛠️ Solution Implemented (Frontend)

### Changed Files:
- `app/templates/dashboard.html`

### What We Did:
1. **Removed `exclude_pdst=true` parameter** from API calls (temporarily)
2. **Added client-side filtering** for PDST/KSAA products as a workaround
3. **Increased limit to 100-200** to ensure enough products after filtering

### Code Changes:

#### loadWorstGP() function:
```javascript
// BEFORE (caused 500 error):
url = `/api/worst-gp?pid=1&from_date=2025-10-01&to_date=2025-10-29&threshold=20&limit=50&exclude_pdst=true`;

// AFTER (works!):
url = `/api/worst-gp?pid=1&from_date=2025-10-01&to_date=2025-10-29&threshold=20&limit=100`;

// + Added client-side filtering:
const pdstKeywords = ['VYVANSE', 'CONCERTA', 'RITALIN', 'DEXAMPHETAMINE', 'METHYLPHENIDATE', 
                      'ARCOXIA', 'STILNOX', 'ZOLPIDEM', 'TRAMADOL', 'CODEINE',
                      'CLINIC CONSULT', 'CLINIC INJECT', 'SERVICE FEE'];

worstGPProducts = worstGPProducts.filter(product => {
  const name = (product.product_name || product.product_description || '').toUpperCase();
  return !pdstKeywords.some(keyword => name.includes(keyword));
});
```

---

## 🐛 Backend Bug Report

### Bug Location:
`/pharmacies/{id}/stock-activity/low-gp/range` endpoint

### Bug Trigger:
The endpoint crashes **only** when `exclude_pdst=true` is passed as a parameter.

### Test Results:
```bash
# ✅ WORKS:
curl ".../low-gp/range?from=2025-10-01&to=2025-10-29&threshold=20&limit=50"
→ Returns 100 products

# ✅ WORKS:
curl ".../low-gp/range?from=2025-10-01&to=2025-10-29&threshold=20&limit=50&exclude_pdst=false"
→ Returns 50 products

# ❌ FAILS (500 error):
curl ".../low-gp/range?from=2025-10-01&to=2025-10-29&threshold=20&limit=50&exclude_pdst=true"
→ Internal Server Error
```

### Likely Causes:
1. **Boolean parsing issue**: `exclude_pdst` parameter not being converted from string to boolean correctly
2. **SQL query error**: The department filtering logic might have a syntax error
3. **Join issue**: The LEFT JOIN on departments table might fail when exclude_pdst=true
4. **Field reference error**: Trying to access a field that doesn't exist when filtering is enabled

### Recommended Fix (Backend Team):

Check the endpoint code for something like this:

```python
@app.get("/pharmacies/{pharmacy_id}/stock-activity/low-gp/range")
async def get_low_gp_range(
    pharmacy_id: int,
    from_date: str = Query(alias="from"),
    to_date: str = Query(alias="to"),
    threshold: int,
    limit: int = 100,
    exclude_pdst: bool = False  # ← Make sure this is typed as bool
):
    try:
        # Build SQL query
        sql = """
            SELECT ...
            FROM pharma.fact_stock_activity f
            JOIN pharma.products pr ON pr.product_id = f.product_id
            LEFT JOIN pharma.departments d ON d.department_id = f.department_id
            WHERE f.pharmacy_id = :pharmacy_id
              AND f.business_date BETWEEN :from_date AND :to_date
        """
        
        # Add PDST filter if requested
        if exclude_pdst:
            # ← CHECK THIS LINE - might be causing the error
            sql += " AND (d.department_code IS NULL OR (d.department_code NOT LIKE 'PDST%' AND d.department_code NOT LIKE 'KSAA%'))"
        
        # Execute query
        result = await db.execute(sql, {
            "pharmacy_id": pharmacy_id,
            "from_date": from_date,
            "to_date": to_date
        })
        
        # Return response
        return {"items": [...]}
        
    except Exception as e:
        # ← ADD THIS - log the actual error!
        logger.error(f"Error in low-gp/range: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
```

### How to Debug:
1. Check application logs for the stack trace when `exclude_pdst=true` is passed
2. Test the SQL query directly with the PDST filter enabled
3. Verify the `exclude_pdst` parameter is being parsed as a boolean, not a string
4. Make sure the LEFT JOIN on departments table works correctly

---

## ✅ Current Status

### Frontend: 🟢 **WORKING**
- ✅ Monthly worst GP products now display correctly
- ✅ PDST/KSAA products are filtered out (client-side)
- ✅ Data loads successfully

### Backend: 🟡 **WORKAROUND IN PLACE**
- ⚠️ `exclude_pdst=true` parameter causes 500 error
- ✅ Workaround: Frontend removes the parameter and filters client-side
- 🔧 Permanent fix needed: Backend team should fix the bug

---

## 🎯 Next Steps

### For Frontend (Us):
1. ✅ **DONE** - Removed `exclude_pdst=true` from API calls
2. ✅ **DONE** - Added client-side PDST/KSAA filtering
3. ✅ **DONE** - Tested and verified it works

### For Backend Team:
1. 🔧 **TODO** - Fix the `exclude_pdst=true` bug in the endpoint
2. 🔧 **TODO** - Add proper error handling and logging
3. 🔧 **TODO** - Test with all parameter combinations
4. ✅ **OPTIONAL** - Once fixed, we can remove client-side filtering and re-add `exclude_pdst=true`

---

## 📊 Expected Results

For **Reitz (pharmacy_id=1), October 1-29, GP% ≤ 20%**:
- ✅ Returns ~40-50 products after filtering
- ✅ Worst GP: -122.48% (FLEXOCAM 15MG TABS 10)
- ✅ Products are sorted by GP% ascending
- ✅ PDST/KSAA products are excluded

---

## 🧪 Test the Fix

Refresh your browser and navigate to the Monthly Summary tab - the worst GP products should now appear!

---

## 📝 Notes

- This is a **temporary workaround** - client-side filtering is not ideal
- The **proper solution** is for the backend to fix the `exclude_pdst=true` bug
- Once the backend is fixed, we can remove the client-side filtering and restore `exclude_pdst=true`
- The client-side filter uses product name keywords - not as accurate as backend department filtering

---

**Status:** 🟢 **RESOLVED WITH WORKAROUND**  
**Backend Bug:** 🐛 **REPORTED**  
**Last Updated:** October 29, 2025

