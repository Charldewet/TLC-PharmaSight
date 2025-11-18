# Targets API Implementation - Backend Team Reference

## 📋 Overview

We need to implement persistent storage for **daily turnover targets** that pharmacy managers set for each day of the month. Currently, targets are stored in-memory and are lost when the server restarts. We need a database-backed solution.

---

## 🎯 What Are Targets?

**Targets** are daily turnover goals (in Rands) that pharmacy managers set for each day of a specific month. These targets are used to:

1. **Display in the Targets table** - Managers can set and view targets for each day
2. **Calculate purchase budgets** - Purchase budgets are calculated as 75% of the turnover target
3. **Show in daily summary** - Daily targets are displayed alongside actual turnover
4. **Track performance** - Compare actual vs. target turnover

### Example Use Case:
- Manager sets a target of R10,000 for November 15th, 2025
- The system calculates a purchase budget of R7,500 (75% of R10,000)
- On November 15th, the dashboard shows actual turnover vs. the R10,000 target

---

## 🗄️ Database Schema

### Recommended Table Structure

```sql
CREATE TABLE pharmacy_targets (
    id SERIAL PRIMARY KEY,
    pharmacy_id INTEGER NOT NULL,
    date DATE NOT NULL,
    target_value DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INTEGER,
    UNIQUE(pharmacy_id, date)
);

CREATE INDEX idx_pharmacy_targets_pharmacy_date ON pharmacy_targets(pharmacy_id, date);
CREATE INDEX idx_pharmacy_targets_date ON pharmacy_targets(date);
```

### Field Descriptions:

- **`id`**: Primary key (auto-increment)
- **`pharmacy_id`**: Foreign key to pharmacies table
- **`date`**: The specific date for this target (YYYY-MM-DD format)
- **`target_value`**: The turnover target amount in Rands (decimal with 2 decimal places)
- **`created_at`**: Timestamp when the target was first created
- **`updated_at`**: Timestamp when the target was last updated
- **`created_by_user_id`**: (Optional) ID of the user who created/updated this target

### Notes:
- The `UNIQUE(pharmacy_id, date)` constraint ensures only one target per pharmacy per day
- Use `ON CONFLICT` handling for upsert operations (update if exists, insert if not)

---

## 🔌 API Endpoints Required

### 1. GET `/admin/pharmacies/{pharmacy_id}/targets`

**Purpose**: Retrieve all targets for a pharmacy within a specific month

**Query Parameters**:
- `month` (required): Month in `YYYY-MM` format (e.g., `2025-11`)

**Example Request**:
```
GET /admin/pharmacies/1/targets?month=2025-11
```

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Expected Response** (200 OK):
```json
{
  "pharmacy_id": 1,
  "month": "2025-11",
  "targets": [
    {
      "date": "2025-11-01",
      "value": 8500.00
    },
    {
      "date": "2025-11-02",
      "value": 9200.00
    },
    {
      "date": "2025-11-15",
      "value": 10000.00
    }
  ]
}
```

**Response Format**:
- `pharmacy_id`: The pharmacy ID
- `month`: The requested month (YYYY-MM format)
- `targets`: Array of target objects, each containing:
  - `date`: Date in YYYY-MM-DD format
  - `value`: Target turnover amount (decimal number)

**Edge Cases**:
- If no targets exist for the month, return empty array: `{"pharmacy_id": 1, "month": "2025-11", "targets": []}`
- If pharmacy doesn't exist, return 404 Not Found
- If month format is invalid, return 400 Bad Request

---

### 2. POST `/admin/pharmacies/{pharmacy_id}/targets`

**Purpose**: Save or update targets for a pharmacy and month

**Query Parameters**:
- `month` (required): Month in `YYYY-MM` format (e.g., `2025-11`)

**Request Body**:
```json
{
  "2025-11-01": 8500.00,
  "2025-11-02": 9200.00,
  "2025-11-15": 10000.00,
  "2025-11-20": 11000.00
}
```

**Example Request**:
```
POST /admin/pharmacies/1/targets?month=2025-11
Content-Type: application/json
Authorization: Bearer {JWT_TOKEN}

{
  "2025-11-01": 8500.00,
  "2025-11-02": 9200.00,
  "2025-11-15": 10000.00
}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Targets saved successfully",
  "saved_count": 3,
  "pharmacy_id": 1,
  "month": "2025-11"
}
```

**Response Format**:
- `success`: Boolean indicating success
- `message`: Human-readable success message
- `saved_count`: Number of targets saved/updated
- `pharmacy_id`: The pharmacy ID
- `month`: The month these targets belong to

**Request Body Format**:
- The request body is a JSON object where:
  - **Keys** are date strings in `YYYY-MM-DD` format
  - **Values** are decimal numbers representing the target turnover amount
- Only dates within the specified month should be processed
- Dates outside the month should be ignored or return 400 Bad Request

**Edge Cases**:
- If request body is empty `{}`, return 400 Bad Request with message "No targets provided"
- If date format is invalid (not YYYY-MM-DD), return 400 Bad Request
- If date is outside the specified month, return 400 Bad Request
- If target value is negative or invalid, return 400 Bad Request
- Use **UPSERT** logic: if a target exists for a date, update it; if not, create it

---

### 3. DELETE `/admin/pharmacies/{pharmacy_id}/targets/{date}` (Optional)

**Purpose**: Delete a specific target for a pharmacy and date

**Path Parameters**:
- `pharmacy_id`: Pharmacy ID
- `date`: Date in `YYYY-MM-DD` format

**Example Request**:
```
DELETE /admin/pharmacies/1/targets/2025-11-15
Authorization: Bearer {JWT_TOKEN}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Target deleted successfully"
}
```

**Or** (204 No Content) - also acceptable

**Edge Cases**:
- If target doesn't exist, return 404 Not Found
- If date format is invalid, return 400 Bad Request

---

## 🔐 Authentication & Authorization

All endpoints should:
1. **Require authentication** via JWT Bearer token in `Authorization` header
2. **Check user permissions** - Only users with access to the pharmacy should be able to view/modify its targets
3. **Return 401 Unauthorized** if token is missing or invalid
4. **Return 403 Forbidden** if user doesn't have access to the pharmacy

---

## 💻 Our Frontend Proxy Endpoints

We currently have these proxy endpoints in our FastAPI application:

### GET `/api/targets`
- **Query Parameters**: `pid` (pharmacy_id), `month` (YYYY-MM)
- **Proxy To**: `GET /admin/pharmacies/{pharmacy_id}/targets?month={month}`

### POST `/api/targets`
- **Query Parameters**: `pid` (pharmacy_id), `month` (YYYY-MM)
- **Request Body**: `{ "YYYY-MM-DD": value, ... }`
- **Proxy To**: `POST /admin/pharmacies/{pharmacy_id}/targets?month={month}`

**Current Implementation** (Temporary):
```python
# Temporary in-memory storage
targets_storage = {}

@app.get("/api/targets")
async def api_get_targets(request: Request, pid: int, month: str) -> JSONResponse:
    storage_key = f"{pid}_{month}"
    targets_data = targets_storage.get(storage_key, {})
    
    targets_list = [
        {"date": date_str, "value": value}
        for date_str, value in targets_data.items()
    ]
    
    return JSONResponse({
        "pharmacy_id": pid,
        "month": month,
        "targets": targets_list
    })

@app.post("/api/targets")
async def api_save_targets(request: Request, pid: int, month: str) -> JSONResponse:
    targets_data = await request.json()
    storage_key = f"{pid}_{month}"
    targets_storage[storage_key] = targets_data
    
    return JSONResponse({
        "success": True,
        "message": "Targets saved successfully",
        "saved_count": len(targets_data)
    })
```

**After Backend Implementation**, we'll update these to proxy to your endpoints:
```python
@app.get("/api/targets")
async def api_get_targets(request: Request, pid: int, month: str) -> JSONResponse:
    headers = _auth_headers(request)
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/pharmacies/{pid}/targets?month={month}"
        resp = await client.get(url, headers=headers)
    
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch targets")
    
    return JSONResponse(resp.json())

@app.post("/api/targets")
async def api_save_targets(request: Request, pid: int, month: str) -> JSONResponse:
    headers = _auth_headers(request)
    targets_data = await request.json()
    
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{API_BASE_URL}/admin/pharmacies/{pid}/targets?month={month}"
        resp = await client.post(url, json=targets_data, headers=headers)
    
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to save targets")
    
    return JSONResponse(resp.json())
```

---

## 📊 Frontend Usage Examples

### Loading Targets
```javascript
// Fetch targets for pharmacy 1, November 2025
const response = await fetch('/api/targets?pid=1&month=2025-11');
const data = await response.json();

// data.targets is an array: [{date: "2025-11-01", value: 8500.00}, ...]
data.targets.forEach(target => {
  console.log(`Target for ${target.date}: R${target.value}`);
});
```

### Saving Targets
```javascript
// Save targets for pharmacy 1, November 2025
const targets = {
  "2025-11-01": 8500.00,
  "2025-11-02": 9200.00,
  "2025-11-15": 10000.00
};

const response = await fetch('/api/targets?pid=1&month=2025-11', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(targets)
});

const result = await response.json();
// result.saved_count = 3
```

---

## 🧪 Test Cases

### Test Case 1: Get Targets (Empty)
```
GET /admin/pharmacies/1/targets?month=2025-11
Expected: {"pharmacy_id": 1, "month": "2025-11", "targets": []}
```

### Test Case 2: Save Targets
```
POST /admin/pharmacies/1/targets?month=2025-11
Body: {"2025-11-01": 8500.00, "2025-11-02": 9200.00}
Expected: {"success": true, "saved_count": 2, ...}
```

### Test Case 3: Get Targets (After Save)
```
GET /admin/pharmacies/1/targets?month=2025-11
Expected: {"pharmacy_id": 1, "month": "2025-11", "targets": [
  {"date": "2025-11-01", "value": 8500.00},
  {"date": "2025-11-02", "value": 9200.00}
]}
```

### Test Case 4: Update Existing Target
```
POST /admin/pharmacies/1/targets?month=2025-11
Body: {"2025-11-01": 9000.00}  // Update existing
Expected: {"success": true, "saved_count": 1, ...}

GET /admin/pharmacies/1/targets?month=2025-11
Expected: {"date": "2025-11-01", "value": 9000.00}  // Updated value
```

### Test Case 5: Invalid Month Format
```
GET /admin/pharmacies/1/targets?month=invalid
Expected: 400 Bad Request
```

### Test Case 6: Date Outside Month
```
POST /admin/pharmacies/1/targets?month=2025-11
Body: {"2025-12-01": 8500.00}  // December date in November request
Expected: 400 Bad Request
```

### Test Case 7: Negative Target Value
```
POST /admin/pharmacies/1/targets?month=2025-11
Body: {"2025-11-01": -1000.00}
Expected: 400 Bad Request
```

---

## ❓ Questions for Backend Team

1. **Should we support partial month updates?** (e.g., only updating some dates in a month)
   - **Answer**: Yes, the frontend sends only the dates that have been modified

2. **What happens if a user tries to set a target for a past date?**
   - **Recommendation**: Allow it (managers may want to retroactively set targets)

3. **Should we track who created/updated each target?**
   - **Recommendation**: Yes, store `created_by_user_id` for audit purposes

4. **Should targets be soft-deleted or hard-deleted?**
   - **Recommendation**: Hard-delete is fine (targets can be re-entered)

5. **Do we need to support bulk operations?** (e.g., delete all targets for a month)
   - **Answer**: Not required initially, but nice to have

6. **Should we validate that dates are valid calendar dates?** (e.g., reject 2025-02-30)
   - **Answer**: Yes, validate date format and validity

7. **What's the maximum target value?** (to prevent data entry errors)
   - **Recommendation**: Set a reasonable limit (e.g., R10,000,000) or use database constraints

---

## 📝 Implementation Checklist

- [ ] Create `pharmacy_targets` table with proper schema
- [ ] Add indexes for performance (`pharmacy_id`, `date`)
- [ ] Implement `GET /admin/pharmacies/{pharmacy_id}/targets` endpoint
- [ ] Implement `POST /admin/pharmacies/{pharmacy_id}/targets` endpoint (with UPSERT logic)
- [ ] Add authentication/authorization checks
- [ ] Add input validation (date format, month format, value validation)
- [ ] Add error handling (404 for not found, 400 for bad requests)
- [ ] Test with frontend to ensure compatibility
- [ ] Update our proxy endpoints to call your new API
- [ ] Remove temporary in-memory storage

---

## 🔗 Related Endpoints

These endpoints are already implemented and working:
- `GET /pharmacies/{pharmacy_id}/days` - Returns daily turnover data
- `GET /pharmacies/{pharmacy_id}/mtd` - Returns month-to-date aggregated data

The targets API should integrate seamlessly with these existing endpoints.

---

## 📞 Contact

If you have questions about the frontend implementation or need clarification on any requirements, please reach out to the frontend team.

**Last Updated**: November 15, 2025

