#!/usr/bin/env python3
"""
Test script to create a bank rule via the API.
This reproduces the exact request that's failing with 500 error.
"""

import os
import sys
import httpx
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

API_BASE_URL = os.getenv("PHARMA_API_BASE", "https://pharmacy-api-webservice.onrender.com")
API_KEY = os.getenv("PHARMA_API_KEY", "")

def test_create_bank_rule(pharmacy_id: int = 1):
    """Test creating a bank rule"""
    
    url = f"{API_BASE_URL}/bank-rules/pharmacies/{pharmacy_id}/bank-rules"
    
    headers = {
        "Content-Type": "application/json"
    }
    
    if API_KEY:
        headers["X-API-Key"] = API_KEY
        print(f"Using API Key: {API_KEY[:10]}...")
    else:
        print("Warning: No API_KEY found in environment variables")
    
    # Request body matching the exact structure being sent
    request_body = {
        "pharmacy_id": pharmacy_id,
        "name": "Test Rule - Arrie Nel",
        "type": "spend",
        "priority": 1,
        "contact_name": None,
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
    
    print(f"\n{'='*80}")
    print(f"Testing Bank Rule Creation API")
    print(f"{'='*80}")
    print(f"URL: {url}")
    print(f"Pharmacy ID: {pharmacy_id}")
    print(f"\nRequest Headers:")
    print(json.dumps(headers, indent=2))
    print(f"\nRequest Body:")
    print(json.dumps(request_body, indent=2))
    print(f"{'='*80}\n")
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, headers=headers, json=request_body)
            
            print(f"Response Status Code: {response.status_code}")
            print(f"\nResponse Headers:")
            print(json.dumps(dict(response.headers), indent=2))
            
            print(f"\nResponse Content-Type: {response.headers.get('content-type')}")
            
            if response.status_code in [200, 201]:
                print(f"\n✅ SUCCESS! Bank rule created")
                try:
                    result = response.json()
                    print(f"\nResponse Body:")
                    print(json.dumps(result, indent=2, default=str))
                except:
                    print(f"\nResponse Text:")
                    print(response.text)
            else:
                print(f"\n❌ ERROR: {response.status_code}")
                
                # Try to parse error as JSON
                try:
                    error_data = response.json()
                    print(f"\nError Response (JSON):")
                    print(json.dumps(error_data, indent=2, default=str))
                except:
                    # Plain text error
                    print(f"\nError Response (Plain Text):")
                    print(response.text)
            
            print(f"\n{'='*80}")
            
            # Save full request/response for analysis
            output_file = "bank_rule_create_test_result.json"
            result_data = {
                "request": {
                    "url": url,
                    "method": "POST",
                    "headers": headers,
                    "body": request_body
                },
                "response": {
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "body": response.text
                }
            }
            
            with open(output_file, 'w') as f:
                json.dump(result_data, f, indent=2, default=str)
            
            print(f"Full request/response saved to: {output_file}")
            
    except httpx.TimeoutException:
        print("❌ Error: Request timed out")
    except httpx.RequestError as e:
        print(f"❌ Error: Request failed - {e}")
    except Exception as e:
        print(f"❌ Error: {type(e).__name__} - {e}")
        import traceback
        traceback.print_exc()


def test_with_different_account():
    """Test with a different account ID in case account 11 doesn't exist"""
    
    url = f"{API_BASE_URL}/bank-rules/pharmacies/1/bank-rules"
    
    headers = {
        "Content-Type": "application/json"
    }
    
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    
    # Try with account_id 29 (from the API spec example)
    request_body = {
        "pharmacy_id": 1,
        "name": "Test Rule - Supplier",
        "type": "spend",
        "priority": 20,
        "contact_name": "Supplier",
        "conditions": [
            {
                "group_type": "ALL",
                "field": "description",
                "operator": "contains",
                "value": "SUPPLIER PAYMENT"
            }
        ],
        "allocate": [
            {
                "account_id": 29,
                "percent": 100,
                "vat_code": "NO_VAT"
            }
        ]
    }
    
    print(f"\n\n{'='*80}")
    print(f"Testing with Different Account (29 from API spec example)")
    print(f"{'='*80}")
    print(f"Request Body:")
    print(json.dumps(request_body, indent=2))
    print(f"{'='*80}\n")
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, headers=headers, json=request_body)
            
            print(f"Response Status Code: {response.status_code}")
            
            if response.status_code in [200, 201]:
                print(f"✅ SUCCESS with account_id 29!")
                try:
                    result = response.json()
                    print(json.dumps(result, indent=2, default=str))
                except:
                    print(response.text)
            else:
                print(f"❌ ERROR: {response.status_code}")
                print(response.text)
                
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    pharmacy_id = 1
    if len(sys.argv) > 1:
        try:
            pharmacy_id = int(sys.argv[1])
        except ValueError:
            print(f"Error: Invalid pharmacy_id '{sys.argv[1]}'. Must be an integer.")
            sys.exit(1)
    
    # Test with the original request
    test_create_bank_rule(pharmacy_id)
    
    # Also test with the example from the API spec
    print("\n\n")
    test_with_different_account()


