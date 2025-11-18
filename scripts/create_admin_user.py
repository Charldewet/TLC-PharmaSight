#!/usr/bin/env python3
"""
Script to create the admin user with admin panel access.
This script uses the API_KEY to create the user directly via the backend API.
"""
import os
import sys
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

API_BASE_URL = os.getenv("PHARMA_API_BASE", "https://pharmacy-api-webservice.onrender.com")
API_KEY = os.getenv("PHARMA_API_KEY", "")

if not API_KEY:
    print("ERROR: PHARMA_API_KEY not found in environment variables")
    sys.exit(1)

def create_admin_user():
    """Create the admin user"""
    url = f"{API_BASE_URL}/admin/users"
    
    user_data = {
        "username": "admin",
        "password": "Koeberg7#"
    }
    
    print(f"Creating admin user...")
    print(f"Username: {user_data['username']}")
    print(f"API URL: {url}")
    
    try:
        async def create():
            async with httpx.AsyncClient(timeout=15) as client:
                # Try Bearer token first
                headers = {
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json"
                }
                resp = await client.post(url, json=user_data, headers=headers)
                
                # If Bearer fails, try X-API-Key
                if resp.status_code == 401:
                    print("Bearer token failed, trying X-API-Key...")
                    headers = {
                        "X-API-Key": API_KEY,
                        "Content-Type": "application/json"
                    }
                    resp = await client.post(url, json=user_data, headers=headers)
                
                if resp.status_code == 200:
                    result = resp.json()
                    print(f"\n✓ Success! Admin user created.")
                    print(f"User ID: {result.get('user_id', 'N/A')}")
                    print(f"Username: {result.get('username', 'N/A')}")
                    return True
                else:
                    error_detail = ""
                    try:
                        error_data = resp.json()
                        error_detail = error_data.get("detail", error_data.get("message", ""))
                    except:
                        error_detail = resp.text[:200]
                    
                    print(f"\n✗ Failed to create admin user")
                    print(f"Status Code: {resp.status_code}")
                    print(f"Error: {error_detail}")
                    return False
        
        import asyncio
        success = asyncio.run(create())
        return success
        
    except Exception as e:
        print(f"\n✗ Error creating admin user: {e}")
        return False

if __name__ == "__main__":
    success = create_admin_user()
    sys.exit(0 if success else 1)

