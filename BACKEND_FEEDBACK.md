# Backend Team - Bank Rule Creation Bug Report

## 🐛 Bug Summary

**Endpoint:** `POST /bank-rules/pharmacies/{pharmacy_id}/bank-rules`  
**Error:** `500 Internal Server Error`  
**Root Cause:** `"Object of type BankRuleAllocation is not JSON serializable"`

## Problem

The endpoint successfully processes the request and creates the bank rule, but fails when serializing the response because `BankRuleAllocation` objects cannot be converted to JSON.

## Evidence

### Request Being Sent (Verified Correct)

```json
{
  "pharmacy_id": 1,
  "name": "ARRIE",
  "type": "spend",
  "priority": 10,
  "contact_name": null,
  "conditions": [
    {
      "group_type": "ALL",
      "field": "description",
      "operator": "contains",
      "value": "Arrie"
    }
  ],
  "allocate": [
    {
      "account_id": 11,
      "percent": 100,
      "vat_code": "NO_VAT"
    }
  ]
}
```

### Error Response

```json
{
  "detail": "Internal server error: Object of type BankRuleAllocation is not JSON serializable"
}
```

### Request IDs (for your logs)

- **rndr-id:** `5d61fdee-2956-4a93`
- **cf-ray:** `9aba666def7473e5-JNB`
- **Timestamp:** `Wed, 10 Dec 2025 05:39:09 GMT`

## What's Working

✅ Request validation passes  
✅ Authentication works  
✅ Account ID 11 exists and is valid  
✅ Request structure matches API specification  
✅ GET `/bank-rules/pharmacies/1/bank-rules` returns existing rules correctly  

## What's Broken

❌ POST endpoint fails during response serialization  
❌ `BankRuleAllocation` objects are not being converted to JSON-serializable format  

## Fix Required

The endpoint handler needs to serialize `BankRuleAllocation` objects before returning them.

### Quick Fix Options

**Option 1: Use Pydantic serialization**
```python
# In your endpoint handler
return {
    "id": rule.id,
    "pharmacy_id": rule.pharmacy_id,
    "name": rule.name,
    "allocate": [allocation.dict() for allocation in rule.allocate]  # Pydantic v1
    # OR
    "allocate": [allocation.model_dump() for allocation in rule.allocate]  # Pydantic v2
}
```

**Option 2: Manual dict conversion**
```python
"allocate": [
    {
        "id": alloc.id,
        "account_id": alloc.account_id,
        "percent": alloc.percent,
        "vat_code": alloc.vat_code
    }
    for alloc in rule.allocate
]
```

**Option 3: Use response_model (Best Practice)**
```python
from pydantic import BaseModel
from typing import List

class BankRuleAllocationResponse(BaseModel):
    id: int
    account_id: int
    percent: float
    vat_code: str

class BankRuleResponse(BaseModel):
    id: int
    pharmacy_id: int
    name: str
    type: str
    priority: int
    allocate: List[BankRuleAllocationResponse]
    # ... other fields

@router.post("/bank-rules/pharmacies/{pharmacy_id}/bank-rules", response_model=BankRuleResponse)
async def create_bank_rule(...):
    # ... create rule ...
    return BankRuleResponse.model_validate(rule)  # Handles serialization automatically
```

## Expected Behavior After Fix

**Status:** `200 OK` or `201 Created`  
**Response:** JSON object with properly serialized `allocate` array

## Test Script

A reproducible test script is available at `test_create_bank_rule.py` in the frontend repository.

## Priority

**HIGH** - This blocks bank rule creation functionality completely.

---

**Contact:** [Your contact info]  
**Date:** December 10, 2025


