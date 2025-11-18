#!/usr/bin/env python3
"""
Direct API Test for Worst GP Endpoint
This script tests the external API directly to verify it's returning data.
"""

import httpx
import json
import os
from dotenv import load_dotenv

# Load environment
load_dotenv()

API_BASE_URL = os.getenv("PHARMA_API_BASE", "https://pharmacy-api-webservice.onrender.com")
API_KEY = os.getenv("PHARMA_API_KEY", "")

def test_worst_gp_api():
    """Test the worst GP API endpoint directly"""
    
    # Test parameters (from documentation)
    pharmacy_id = 1  # Reitz
    from_date = "2025-10-01"
    to_date = "2025-10-29"
    threshold = 20
    limit = 50
    exclude_pdst = True
    
    # Build URL
    url = f"{API_BASE_URL}/pharmacies/{pharmacy_id}/stock-activity/low-gp/range"
    params = {
        "from": from_date,
        "to": to_date,
        "threshold": threshold,
        "limit": limit,
        "exclude_pdst": str(exclude_pdst).lower()
    }
    
    print("="*80)
    print("WORST GP API DIRECT TEST")
    print("="*80)
    print(f"\n📍 URL: {url}")
    print(f"📦 Parameters:")
    for key, value in params.items():
        print(f"   - {key}: {value}")
    
    # Test with Bearer token
    print(f"\n🔐 Using API Key: {API_KEY[:10]}..." if API_KEY else "❌ No API key found!")
    
    headers = {"Authorization": f"Bearer {API_KEY}"} if API_KEY else {}
    
    try:
        print("\n⏳ Making request...")
        with httpx.Client(timeout=30) as client:
            response = client.get(url, params=params, headers=headers)
        
        print(f"✅ Status Code: {response.status_code}")
        print(f"📄 Content-Type: {response.headers.get('content-type', 'unknown')}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n📊 Response Structure:")
            print(f"   - Type: {type(data)}")
            
            if isinstance(data, dict):
                print(f"   - Keys: {list(data.keys())}")
                
                if "items" in data:
                    items = data["items"]
                    print(f"\n✅ SUCCESS! Found {len(items)} products")
                    
                    if len(items) > 0:
                        print(f"\n📦 Top 5 Worst GP Products:")
                        for i, item in enumerate(items[:5], 1):
                            print(f"\n   {i}. {item.get('product_name', 'Unknown')}")
                            print(f"      NAPPI: {item.get('nappi_code', 'N/A')}")
                            print(f"      GP%: {item.get('gp_percent', 0):.2f}%")
                            print(f"      Qty: {item.get('quantity_sold', 0)}")
                            print(f"      Sales: R{item.get('total_sales', 0):.2f}")
                    else:
                        print("\n⚠️  WARNING: 'items' array is EMPTY!")
                        print("   According to the documentation, this should return ~50 products.")
                        print("   Possible reasons:")
                        print("   - Backend endpoint not deployed yet")
                        print("   - No data in database for this date range")
                        print("   - Filters too restrictive")
                else:
                    print(f"\n❌ ERROR: Response doesn't have 'items' key!")
                    print(f"   Full response: {json.dumps(data, indent=2)}")
            else:
                print(f"\n❌ ERROR: Expected dict, got {type(data)}")
                print(f"   Full response: {json.dumps(data, indent=2)}")
        
        elif response.status_code == 401:
            print("\n❌ AUTHENTICATION ERROR!")
            print("   The API key is invalid or expired.")
            print("   Please check your .env file and verify PHARMA_API_KEY is correct.")
        
        elif response.status_code == 404:
            print("\n❌ ENDPOINT NOT FOUND!")
            print("   The endpoint /stock-activity/low-gp/range doesn't exist.")
            print("   The backend team may not have deployed it yet.")
        
        else:
            print(f"\n❌ ERROR Response:")
            print(f"   Status: {response.status_code}")
            print(f"   Body: {response.text}")
    
    except Exception as e:
        print(f"\n❌ EXCEPTION: {type(e).__name__}")
        print(f"   Message: {str(e)}")
    
    print("\n" + "="*80)

if __name__ == "__main__":
    test_worst_gp_api()

