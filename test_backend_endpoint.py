#!/usr/bin/env python3
"""
Test to help backend team debug their endpoint
This shows what error the API is throwing
"""

import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()

API_BASE_URL = os.getenv("PHARMA_API_BASE", "https://pharmacy-api-webservice.onrender.com")
API_KEY = os.getenv("PHARMA_API_KEY", "")

print("="*80)
print("DEBUGGING WORST GP API ENDPOINT")
print("="*80)
print()
print("📊 Database Query: ✅ WORKS - Returns 50 products")
print("🌐 API Endpoint:   ❌ FAILS - Returns 500 error")
print()
print("="*80)
print("Testing Different Parameter Combinations")
print("="*80)

test_cases = [
    {
        "name": "Test 1: Full parameters (as documented)",
        "params": {
            "from": "2025-10-01",
            "to": "2025-10-29",
            "threshold": 20,
            "limit": 50,
            "exclude_pdst": "true"
        }
    },
    {
        "name": "Test 2: Without exclude_pdst",
        "params": {
            "from": "2025-10-01",
            "to": "2025-10-29",
            "threshold": 20,
            "limit": 50
        }
    },
    {
        "name": "Test 3: With exclude_pdst=false",
        "params": {
            "from": "2025-10-01",
            "to": "2025-10-29",
            "threshold": 20,
            "limit": 50,
            "exclude_pdst": "false"
        }
    },
    {
        "name": "Test 4: Minimal parameters",
        "params": {
            "from": "2025-10-01",
            "to": "2025-10-29",
            "threshold": 20
        }
    },
    {
        "name": "Test 5: Single day range",
        "params": {
            "from": "2025-10-29",
            "to": "2025-10-29",
            "threshold": 20,
            "limit": 10
        }
    }
]

headers = {"Authorization": f"Bearer {API_KEY}"} if API_KEY else {}
url = f"{API_BASE_URL}/pharmacies/1/stock-activity/low-gp/range"

for test in test_cases:
    print(f"\n{test['name']}")
    print("-" * 80)
    
    # Build query string
    query_parts = [f"{k}={v}" for k, v in test['params'].items()]
    full_url = f"{url}?{'&'.join(query_parts)}"
    print(f"URL: {full_url}")
    
    try:
        with httpx.Client(timeout=30) as client:
            response = client.get(url, params=test['params'], headers=headers)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, dict) and "items" in data:
                    print(f"✅ SUCCESS! Items count: {len(data['items'])}")
                    if len(data['items']) > 0:
                        print(f"   First item: {data['items'][0].get('product_name', 'N/A')}")
                        print(f"   GP%: {data['items'][0].get('gp_percent', 'N/A')}")
                else:
                    print(f"❌ Unexpected format: {list(data.keys()) if isinstance(data, dict) else type(data)}")
            except json.JSONDecodeError:
                print(f"❌ Invalid JSON: {response.text[:200]}")
        else:
            print(f"❌ Error Response:")
            print(f"   Content-Type: {response.headers.get('content-type', 'unknown')}")
            print(f"   Body: {response.text[:500]}")
            
            # Try to get more details
            if response.headers.get('content-type', '').startswith('application/json'):
                try:
                    error_data = response.json()
                    print(f"   Error Details: {json.dumps(error_data, indent=2)}")
                except:
                    pass
    
    except Exception as e:
        print(f"❌ Exception: {type(e).__name__}: {str(e)}")

print()
print("="*80)
print("RECOMMENDATION FOR BACKEND TEAM")
print("="*80)
print()
print("The database query works fine, but the API endpoint returns 500.")
print("This means the issue is in the FastAPI endpoint code, likely:")
print()
print("1. ❌ Response serialization error")
print("   - Check if you're properly converting Decimal to float")
print("   - Check if you're handling None values")
print()
print("2. ❌ Parameter parsing error")
print("   - Check how 'exclude_pdst' boolean is being parsed")
print("   - Check date string parsing")
print()
print("3. ❌ Missing error handling")
print("   - Wrap the endpoint code in try/except")
print("   - Log the actual exception")
print()
print("🔍 Next Step: Check your FastAPI application logs for the stack trace")
print("   when this endpoint is called. The error message will show the issue.")
print()

