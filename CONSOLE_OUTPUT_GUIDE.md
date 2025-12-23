# How to Get JSON for Backend Team from Console

## Steps

1. **Open your browser's Developer Console** (F12 or Right-click → Inspect → Console tab)

2. **Try to save a bank rule** (fill out the form and click "Save Rule")

3. **Look for these console messages:**

### 📋 Copy This JSON Section
You'll see a clearly marked section that looks like this:

```
═══════════════════════════════════════════════════════════
📋 COPY THIS JSON FOR BACKEND TEAM:
═══════════════════════════════════════════════════════════
{
  "pharmacy_id": 1,
  "name": "Arrie Nel",
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
═══════════════════════════════════════════════════════════
Endpoint: POST /bank-rules/pharmacies/1/bank-rules
Error: "Object of type BankRuleAllocation is not JSON serializable"
```

### 🔵 Exact Request Section
You'll also see:

```
🔵 EXACT REQUEST BEING SENT TO BACKEND:
URL: /api/bank-rules/pharmacies/1/bank-rules
Method: POST
Headers: { Content-Type: 'application/json' }
Body (JSON): {"pharmacy_id":1,"name":"Arrie Nel",...}
```

## What to Copy

**Copy the JSON object** from the "📋 COPY THIS JSON FOR BACKEND TEAM" section - it's formatted nicely and ready to paste.

## What to Tell Backend Team

1. **The JSON payload** (from the console)
2. **The endpoint:** `POST /bank-rules/pharmacies/{pharmacy_id}/bank-rules`
3. **The error:** `"Object of type BankRuleAllocation is not JSON serializable"`
4. **The request ID** (if available in network tab): Look for `rndr-id` or `cf-ray` in response headers

## Quick Copy Method

1. Right-click on the JSON in the console
2. Select "Copy object" or manually select and copy the JSON text
3. Paste it into your message to the backend team


