# Email Template for Backend Team

---

**Subject:** Bug Report: Bank Rule Creation Endpoint - JSON Serialization Error

**Body:**

Hi Backend Team,

We're encountering a 500 error when creating bank rules via the API. The error message indicates a JSON serialization issue with `BankRuleAllocation` objects.

**Error:**
```
500 Internal Server Error
"Object of type BankRuleAllocation is not JSON serializable"
```

**Endpoint:** `POST /bank-rules/pharmacies/{pharmacy_id}/bank-rules`

**Request (verified correct):**
```json
{
  "pharmacy_id": 1,
  "name": "ARRIE",
  "type": "spend",
  "priority": 10,
  "contact_name": null,
  "conditions": [{
    "group_type": "ALL",
    "field": "description",
    "operator": "contains",
    "value": "Arrie"
  }],
  "allocate": [{
    "account_id": 11,
    "percent": 100,
    "vat_code": "NO_VAT"
  }]
}
```

**Issue:** The endpoint processes the request successfully but fails when trying to serialize the response. The `BankRuleAllocation` objects in the `allocate` array need to be converted to dictionaries/JSON before being returned.

**Request IDs for your logs:**
- rndr-id: `5d61fdee-2956-4a93`
- cf-ray: `9aba666def7473e5-JNB`
- Timestamp: `Wed, 10 Dec 2025 05:39:09 GMT`

**Quick Fix:** Serialize `BankRuleAllocation` objects before returning:
```python
"allocate": [allocation.dict() for allocation in rule.allocate]  # Pydantic v1
# OR
"allocate": [allocation.model_dump() for allocation in rule.allocate]  # Pydantic v2
```

I've attached a detailed bug report with more information and test scripts.

Please let me know when this is fixed or if you need any additional information.

Thanks!

---

**Attachments:**
- `BACKEND_FEEDBACK.md` (detailed bug report)
- `test_create_bank_rule.py` (reproducible test script)


