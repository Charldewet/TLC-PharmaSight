# Backend Admin Access Update Required

## Issue
Currently, only Charl (user_id: 2) can access the admin endpoints. Amin (user_id: 9) needs admin access as well.

## Current Backend Behavior
When Amin (user_id: 9) tries to access admin endpoints, the backend returns:
```
HTTP 403 Forbidden
{"detail":"Admin access restricted to Charl only"}
```

## Required Changes

### Update Admin Access Control
The backend API needs to update its admin access check to allow **both** Charl and Amin.

**Current logic (needs updating):**
```python
# Only allows user_id: 2 (Charl)
if user_id != 2:
    raise HTTPException(status_code=403, detail="Admin access restricted to Charl only")
```

**Required logic:**
```python
# Allow both Charl (user_id: 2) and Amin (user_id: 9)
ADMIN_USER_IDS = [2, 9]

if user_id not in ADMIN_USER_IDS:
    raise HTTPException(status_code=403, detail="Admin access restricted")
```

**Alternative implementation (using usernames):**
```python
# Allow by username
ADMIN_USERNAMES = ["Charl", "Amin"]

if username not in ADMIN_USERNAMES:
    raise HTTPException(status_code=403, detail="Admin access restricted")
```

## Affected Endpoints
All admin endpoints need this update:
- `GET /admin/users` - List all users
- `GET /admin/users/{user_id}` - Get user details
- `POST /admin/users` - Create user
- `PUT /admin/users/{user_id}` - Update user
- `DELETE /admin/users/{user_id}` - Delete user
- `GET /admin/pharmacies` - List pharmacies
- `POST /admin/users/{user_id}/pharmacies` - Grant pharmacy access
- `DELETE /admin/users/{user_id}/pharmacies/{pharmacy_id}` - Revoke pharmacy access
- `GET /admin/users/{user_id}/pharmacies` - Get user's pharmacy assignments

## Testing
After the update, test by:
1. Logging in as Amin (user_id: 9)
2. Accessing any admin endpoint
3. Should receive HTTP 200 (not 403)

## Notes
- The frontend application is already configured to allow Amin
- The FastAPI proxy is already configured to allow Amin
- Only the backend API needs updating

## Urgency
**HIGH** - Amin cannot perform admin tasks until this is fixed

