# Backend Team - Bank Rule Creation Error Report

## 🚨 Critical Issue

**Error:** `500 Internal Server Error`  
**Root Cause:** `"Object of type BankRuleAllocation is not JSON serializable"`

## Summary

The bank rule creation endpoint is successfully processing requests and creating rules in the database, but fails when trying to serialize the response because `BankRuleAllocation` objects are not JSON serializable.

## Request Details

**Endpoint:** `POST /bank-rules/pharmacies/1/bank-rules`

**Request Body:**
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

**Response:**
```json
{
  "detail": "Internal server error: Object of type BankRuleAllocation is not JSON serializable"
}
```

## Error Location

The error occurs in the response serialization, specifically when trying to serialize the `allocate` array which contains `BankRuleAllocation` objects.

## Fix Required

The endpoint handler needs to properly serialize `BankRuleAllocation` objects before returning them. Common solutions:

### Option 1: Use Pydantic `.dict()` or `.model_dump()`
```python
# Instead of returning the model directly
return {
    "id": rule.id,
    "pharmacy_id": rule.pharmacy_id,
    "name": rule.name,
    "allocate": [allocation.dict() for allocation in rule.allocate]  # Pydantic v1
    # OR
    "allocate": [allocation.model_dump() for allocation in rule.allocate]  # Pydantic v2
}
```

### Option 2: Convert SQLAlchemy models to dicts
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

### Option 3: Use response_model with Pydantic
```python
from pydantic import BaseModel

class BankRuleAllocationResponse(BaseModel):
    id: int
    account_id: int
    percent: float
    vat_code: str

class BankRuleResponse(BaseModel):
    id: int
    pharmacy_id: int
    name: str
    allocate: List[BankRuleAllocationResponse]
    # ... other fields

# In endpoint:
@router.post("/bank-rules/pharmacies/{pharmacy_id}/bank-rules", response_model=BankRuleResponse)
async def create_bank_rule(...):
    # ... create rule ...
    return BankRuleResponse.from_orm(rule)  # or model_validate(rule)
```

## Request IDs for Logs

- **rndr-id:** `5d61fdee-2956-4a93`
- **cf-ray:** `9aba666def7473e5-JNB`
- **Timestamp:** `Wed, 10 Dec 2025 05:39:09 GMT`

## Verification

✅ Request structure matches API specification  
✅ Account ID 11 exists and is valid  
✅ Request format matches existing rules (from GET endpoint)  
✅ Authentication is working  
✅ Other endpoints work correctly  

## Test Script

A test script is available at `test_create_bank_rule.py` that reproduces this exact error.

## Expected Behavior

After the fix, the endpoint should return:
- **Status:** `200 OK` or `201 Created`
- **Body:** JSON object with the created bank rule, including properly serialized `allocate` array


