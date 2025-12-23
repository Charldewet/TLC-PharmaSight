# Bank Rule Creation Request - Backend Team Discussion

## Issue Summary
Getting a 500 Internal Server Error when trying to create a bank rule via the API.

## API Endpoint Being Called

```
POST https://pharmacy-api-webservice.onrender.com/bank-rules/pharmacies/1/bank-rules
```

## Request Headers

```json
{
  "X-API-Key": "super-secret-long-random-string",
  "Content-Type": "application/json"
}
```

## Request Body (Exact JSON being sent)

```json
{
  "pharmacy_id": 1,
  "name": "Arrie Nel",
  "type": "spend",
  "priority": 1,
  "contact_name": null,
  "conditions": [
    {
      "group_type": "ALL",
      "field": "description",
      "operator": "contains",
      "value": "Arrie Nel"
    }
  ],
  "allocate": [
    {
      "account_id": 11,
      "percent": 100.0,
      "vat_code": "NO_VAT"
    }
  ]
}
```

## Response Received

**Status Code:** 500 Internal Server Error

**Response Headers:**
```json
{
  "date": "Wed, 10 Dec 2025 05:39:09 GMT",
  "content-type": "application/json",
  "transfer-encoding": "chunked",
  "connection": "keep-alive",
  "cf-ray": "9aba666def7473e5-JNB",
  "rndr-id": "5d61fdee-2956-4a93",
  "vary": "Accept-Encoding",
  "x-render-origin-server": "uvicorn",
  "cf-cache-status": "DYNAMIC",
  "server": "cloudflare"
}
```

**Response Body (JSON):**
```json
{
  "detail": "Internal server error: Object of type BankRuleAllocation is not JSON serializable"
}
```

## 🔴 CRITICAL ERROR IDENTIFIED

**Error Message:** `"Object of type BankRuleAllocation is not JSON serializable"`

**Root Cause:** The remote API is successfully processing the request and creating the bank rule, but when it tries to serialize the response (specifically the `BankRuleAllocation` object) to JSON, it fails because the `BankRuleAllocation` model/class doesn't have proper JSON serialization methods implemented.

**What This Means:**
- ✅ The request is being accepted and processed correctly
- ✅ The bank rule is likely being created in the database
- ❌ The API fails when trying to return the created rule in the response
- ❌ This is a **backend serialization bug** in the remote API

**Fix Required:** The backend team needs to ensure that the `BankRuleAllocation` model has proper serialization (e.g., using Pydantic's `.dict()` or `.model_dump()`, or implementing a custom JSON encoder).

## Questions for Backend Team

1. **Is the request body structure correct?** According to the API spec, `pharmacy_id` is a path parameter, but validation errors indicated it's also required in the body. Is this correct?

2. **Is there a server-side error?** ✅ **YES - IDENTIFIED:** The error is:
   - **Error:** `"Object of type BankRuleAllocation is not JSON serializable"`
   - **Request ID:** `rndr-id: 5d61fdee-2956-4a93`
   - **CloudFlare Ray ID:** `cf-ray: 9aba666def7473e5-JNB`
   - **Timestamp:** `Wed, 10 Dec 2025 05:39:09 GMT`
   - **Issue:** The `BankRuleAllocation` model needs proper JSON serialization (likely missing `.dict()` or `.model_dump()` call, or needs a custom JSON encoder)

3. **Are there any missing fields or validation issues?** The request includes:
   - ✅ `pharmacy_id`: 1 (integer)
   - ✅ `name`: "Arrie Nel" (string)
   - ✅ `type`: "spend" (valid enum value)
   - ✅ `priority`: 1 (integer)
   - ✅ `contact_name`: null
   - ✅ `conditions`: Array with 1 condition (group_type, field, operator, value)
   - ✅ `allocate`: Array with 1 allocation (account_id, percent, vat_code)

4. **Is account_id 11 valid?** ✅ VERIFIED - Account 11 exists and is active:
   - ID: 11
   - Code: 2000
   - Name: "Trade Creditors"
   - Type: LIABILITY
   - Category: CURRENT_LIABILITY

5. **Is there a database constraint issue?** Could there be:
   - A foreign key constraint on `account_id`?
   - A unique constraint on rule names?
   - A missing pharmacy record?

6. **Should we retry with different values?** Would a different account_id or priority value work?

## What Works

✅ **GET** `/bank-rules/pharmacies/1/bank-rules` - Returns 200 OK with list of existing rules
✅ **GET** `/accounts?is_active=true` - Returns 200 OK with list of accounts

## What Doesn't Work

❌ **POST** `/bank-rules/pharmacies/1/bank-rules` - Returns 500 Internal Server Error

## Additional Information

- The same request structure has been validated against the API specification
- All required fields are present and correctly typed
- The error is not a validation error (422) or authentication error (401/403)
- The server returns plain text instead of JSON error details
- Other API endpoints work correctly with the same authentication

## Request Validation Performed

Our code validates:
1. Rule name is non-empty string
2. Type is one of: "receive", "spend", or "transfer"
3. At least one condition exists
4. At least one allocation exists
5. Allocations total 100%
6. All account_ids are integers
7. All percents are floats
8. VAT codes are strings (defaulting to "NO_VAT" if invalid)

All validations pass before sending the request.

## Verification Done

✅ **Account ID 11 exists** - Verified it's a valid, active account (Trade Creditors)
✅ **Request structure matches existing rules** - GET endpoint returns rules with the same structure
✅ **Tried different account IDs** - Account 29 (from API spec example) also returns 500
✅ **Authentication works** - GET endpoints work with same API key
✅ **Other API endpoints work** - GET bank-rules, GET accounts, etc. all return 200

## Comparison with Existing Rules

An existing rule retrieved from the API:
```json
{
  "name": "Card settlements (EFTPOS CR) → Takings Clearing",
  "type": "receive",
  "priority": 1,
  "allocate": [
    {
      "account_id": 7,
      "percent": 100.0,
      "vat_code": "NO_VAT"
    }
  ],
  "contact_name": "Card Settlement",
  "id": 1,
  "pharmacy_id": 1,
  "is_active": true,
  "created_at": "2025-12-09T14:25:03.641830Z",
  "updated_at": "2025-12-09T14:25:03.641830Z",
  "conditions": [
    {
      "group_type": "ALL",
      "field": "description",
      "operator": "contains",
      "value": "EFTPOS SETTLEMENT CR",
      "id": 1,
      "bank_rule_id": 1,
      "created_at": "2025-12-09T14:25:03.641830Z",
      "updated_at": "2025-12-09T14:25:03.641830Z"
    }
  ]
}
```

Our request matches this structure (minus the auto-generated fields like id, created_at, etc.).

## Conclusion

The 500 Internal Server Error is a **JSON serialization bug** in the remote API. The request is correctly formatted, all data is valid, and the rule is likely being created successfully. However, when the API tries to return the created rule in the response, it fails because the `BankRuleAllocation` objects in the `allocate` array are not JSON serializable.

**This is a backend serialization issue** that requires fixing the response serialization logic in the endpoint handler.

## Next Steps for Backend Team

**URGENT:** The error is now clearly identified. Please fix the JSON serialization issue:

### Specific Error
```
"Object of type BankRuleAllocation is not JSON serializable"
```

### Request Details for Logs
- **Request ID:** `rndr-id: 5d61fdee-2956-4a93`
- **CloudFlare Ray ID:** `cf-ray: 9aba666def7473e5-JNB`
- **Timestamp:** `Wed, 10 Dec 2025 05:39:09 GMT`

### Fix Required

The `BankRuleAllocation` model needs proper JSON serialization. Common fixes:

1. **If using Pydantic v1:**
   ```python
   return rule.dict()  # Instead of returning the model directly
   ```

2. **If using Pydantic v2:**
   ```python
   return rule.model_dump()  # Instead of returning the model directly
   ```

3. **If using SQLAlchemy models:**
   ```python
   # Convert to dict before returning
   return {
       "id": allocation.id,
       "account_id": allocation.account_id,
       "percent": allocation.percent,
       "vat_code": allocation.vat_code,
       # ... other fields
   }
   ```

4. **Or implement a custom JSON encoder:**
   ```python
   class BankRuleAllocationEncoder(json.JSONEncoder):
       def default(self, obj):
           if isinstance(obj, BankRuleAllocation):
               return {
                   "id": obj.id,
                   "account_id": obj.account_id,
                   "percent": obj.percent,
                   "vat_code": obj.vat_code,
               }
           return super().default(obj)
   ```

### Location to Check

Look for the endpoint handler at:
- `POST /bank-rules/pharmacies/{pharmacy_id}/bank-rules`
- Specifically where it returns the created rule with allocations
- The `allocate` field in the response contains `BankRuleAllocation` objects that aren't being serialized

## Test Files Included

1. `test_create_bank_rule.py` - Reproduces the exact issue
2. `bank_rule_create_test_result.json` - Full request/response dump
3. `BANK_RULE_CREATE_REQUEST_DETAILS.md` - This document

## Quick Test with cURL

You can test the endpoint directly with:

```bash
curl -X POST "https://pharmacy-api-webservice.onrender.com/bank-rules/pharmacies/1/bank-rules" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "pharmacy_id": 1,
    "name": "Test Rule",
    "type": "spend",
    "priority": 1,
    "contact_name": null,
    "conditions": [
      {
        "group_type": "ALL",
        "field": "description",
        "operator": "contains",
        "value": "TEST"
      }
    ],
    "allocate": [
      {
        "account_id": 11,
        "percent": 100.0,
        "vat_code": "NO_VAT"
      }
    ]
  }'
```

Expected: 200 OK with created rule JSON  
Actual: 500 Internal Server Error


