# API Endpoints Quick Reference

## Authentication
- `POST /login` - Web login (form submission)
- `POST /api/mobile/login` - Mobile login (JSON response)

## Core Data Endpoints

### Daily Sales
- `GET /api/days?pid={id}&month={YYYY-MM}` - Daily sales data
- **Used in:** Daily summary, monthly tracking, charts, comparisons

### Month-to-Date
- `GET /api/mtd?pid={id}&month={YYYY-MM}&through={YYYY-MM-DD}` - MTD aggregated data
- **Used in:** Monthly summary, stock value calculations, year-over-year comparisons

### Targets
- `GET /api/targets?pid={id}&month={YYYY-MM}` - Get targets
- `POST /api/targets?pid={id}&month={YYYY-MM}` - Save targets (JSON body)

### Stock Value
- `GET /api/stock-value?pid={id}&date={YYYY-MM-DD}` - Stock value (current, opening, change)

## Product Data

### Best Sellers
- `GET /api/best-sellers?pid={id}&date={YYYY-MM-DD}&limit={n}` - Single date
- `GET /api/best-sellers?pid={id}&from_date={YYYY-MM-DD}&to_date={YYYY-MM-DD}&limit={n}` - Date range

### Worst GP
- `GET /api/worst-gp?pid={id}&date={YYYY-MM-DD}&threshold={n}&limit={n}&exclude_pdst={bool}` - Single date
- `GET /api/worst-gp?pid={id}&from_date={YYYY-MM-DD}&to_date={YYYY-MM-DD}&threshold={n}&limit={n}&exclude_pdst={bool}` - Date range

### Product Search & Details
- `GET /api/products/search?query={str}&page={n}&page_size={n}` - Search products
- `GET /api/products/{code}/stock?pharmacy_id={id}&date={YYYY-MM-DD}` - Stock on hand
- `GET /api/products/{code}/sales?pharmacy_id={id}&from_date={YYYY-MM-DD}&to_date={YYYY-MM-DD}` - Sales history

### Usage Data
- `GET /api/pharmacies/{id}/usage/top-180d?limit={n}` - Top products by usage
- `GET /api/pharmacies/{id}/usage/product/{code}` - Product usage details

### Negative Stock
- `GET /api/negative-stock?pid={id}&date={YYYY-MM-DD}&limit={n}` - Products with negative stock

## Admin Endpoints (Admin Only)

### Users
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/{id}` - Get user details
- `POST /api/admin/users` - Create user (JSON body)
- `PUT /api/admin/users/{id}` - Update user (JSON body)
- `DELETE /api/admin/users/{id}` - Delete user

### Pharmacies
- `GET /api/admin/pharmacies` - List all pharmacies
- `POST /api/admin/users/{id}/pharmacies` - Grant pharmacy access (JSON body)
- `DELETE /api/admin/users/{id}/pharmacies/{pharmacy_id}` - Revoke access
- `GET /api/admin/users/{id}/pharmacies` - Get user's pharmacy access

## Debtor Management

### Debtor Data
- `GET /api/pharmacies/{id}/debtors/statistics` - Debtor statistics
- `GET /api/pharmacies/{id}/debtors?{filters}` - List debtors (supports pagination, filtering, sorting)

### Debtor Actions
- `POST /api/pharmacies/{id}/debtors/send-email` - Send emails (JSON body)
- `POST /api/pharmacies/{id}/debtors/send-sms` - Send SMS (JSON body)
- `POST /api/pharmacies/{id}/debtors/download-csv` - Download CSV (JSON body)
- `POST /api/pharmacies/{id}/debtors/download-pdf` - Download PDF (JSON body)
- `GET /api/pharmacies/{id}/debtors/reports` - Report upload history
- `GET /api/pharmacies/{id}/debtors/{debtor_id}/communications` - Communication history

## Utility Endpoints
- `GET /health` - Health check
- `GET /db-ping` - Database connectivity check
- `POST /setup/reactivate-charl` - Emergency account reactivation
- `POST /setup/create-admin-user` - Create admin user

## Key Frontend Files

### Main Dashboard
- **File:** `app/templates/dashboard.html`
- **Key API Calls:**
  - `/api/days` - Lines 3189, 3351, 3434, 5533, 5987, 6023, 6029, 6034, 7174, 7228, 8567, 8613, 8674, 8765, 8851, 9207
  - `/api/mtd` - Lines 5219, 5475, 6044, 7510, 7553, 8478, 8507
  - `/api/targets` - Lines 3351, 3456, 3595, 6002, 6038, 11161, 11211
  - `/api/best-sellers` - Lines 4565, 5663, 5810, 5814, 10520, 10522
  - `/api/worst-gp` - Lines 5725, 5900, 5904, 10707, 10710
  - `/api/products/*` - Lines 3710, 3880, 3943, 4051, 4109, 4634
  - `/api/negative-stock` - Line 4905
  - `/api/stock-value` - Line 5435
  - `/api/pharmacies/{id}/debtors/*` - Lines 12255, 12353, 13029, 13056

### Admin Panel
- **File:** `app/templates/admin.html`
- **Key API Calls:**
  - `/api/admin/users` - Lines 566, 590, 689
  - `/api/admin/users/{id}` - Lines 576, 616
  - `/api/admin/pharmacies` - Line 701
  - `/api/admin/users/{id}/pharmacies` - Lines 632, 652, 663

### Mobile App
- **File:** `mobile/src/services/api.js`
- **Key API Calls:**
  - `/api/mobile/login` - Line 40
  - `/api/mobile/pharmacies` - Line 67

## Authentication Notes

- **Web App:** Uses session cookies (`credentials: 'include'` in fetch)
- **Mobile App:** Uses Bearer token in `Authorization` header
- **Backend Proxy:** Web app forwards requests with Bearer token or X-API-Key header

## Common Patterns

### Fetch with Error Handling
```javascript
const resp = await fetch(`/api/endpoint?param=${value}`, {
  credentials: 'include'  // For web app session cookies
});
if (!resp.ok) throw new Error('Failed');
const data = await resp.json();
```

### POST with JSON Body
```javascript
const resp = await fetch(`/api/endpoint`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ key: 'value' })
});
```

### Date Formatting
- Always use `YYYY-MM-DD` for dates
- Always use `YYYY-MM` for months
- Always URL-encode: `encodeURIComponent(date)`

## Important Notes

1. **Loading Overlay:** Automatically shown for API calls (except stock query endpoints)
2. **Error Handling:** Most endpoints return empty/default data on error rather than throwing
3. **External Services:** Debtor email/SMS currently calls external service directly (should migrate to proxy endpoints)
4. **CORS:** Enabled for mobile app support
5. **Pharmacy ID:** Referred to as `pid` in query params, `pharmacy_id` in path params

