#!/usr/bin/env python3
"""
Test script for unmatched transactions API endpoint.
Tests the API call and displays the returned transaction data with all values.
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

def test_unmatched_transactions_api(pharmacy_id: int):
    """Test the unmatched transactions API endpoint"""
    
    url = f"{API_BASE_URL}/bank-rules/pharmacies/{pharmacy_id}/bank-transactions/unmatched"
    
    headers = {}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
        print(f"Using API Key: {API_KEY[:10]}...")
    else:
        print("Warning: No API_KEY found in environment variables")
    
    print(f"\n{'='*80}")
    print(f"Testing Unmatched Transactions API")
    print(f"{'='*80}")
    print(f"URL: {url}")
    print(f"Pharmacy ID: {pharmacy_id}")
    print(f"{'='*80}\n")
    
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(url, headers=headers)
            
            print(f"Status Code: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}\n")
            
            if response.status_code != 200:
                print(f"❌ Error: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"Error Details: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"Error Response: {response.text[:500]}")
                return
            
            # Parse response
            data = response.json()
            
            # Check if it's a list or dict
            if isinstance(data, list):
                transactions = data
            elif isinstance(data, dict):
                transactions = data.get("transactions", data.get("data", []))
            else:
                transactions = []
            
            print(f"✅ Success! Found {len(transactions)} unmatched transactions\n")
            
            if len(transactions) == 0:
                print("No unmatched transactions found.")
                return
            
            # Display each transaction with all its values
            for idx, tx in enumerate(transactions, 1):
                print(f"{'─'*80}")
                print(f"Transaction #{idx}")
                print(f"{'─'*80}")
                
                # Display all fields
                print(f"ID: {tx.get('id', 'N/A')}")
                print(f"Date: {tx.get('date', 'N/A')}")
                print(f"Description: {tx.get('description', 'N/A')}")
                print(f"Reference: {tx.get('reference', 'N/A')}")
                print(f"Amount In: {tx.get('amount_in', 'N/A')}")
                print(f"Amount Out: {tx.get('amount_out', 'N/A')}")
                print(f"Source: {tx.get('source', 'N/A')}")
                print(f"Classification Status: {tx.get('classification_status', 'N/A')}")
                
                # Check for AI suggestion
                ai_suggestion = tx.get('ai_suggestion')
                if ai_suggestion:
                    print(f"\n🤖 AI Suggestion:")
                    if isinstance(ai_suggestion, dict):
                        print(f"   Suggestion ID: {ai_suggestion.get('id', 'N/A')}")
                        print(f"   Suggested Account Code: {ai_suggestion.get('suggested_account_code', 'N/A')}")
                        print(f"   Suggested Account Name: {ai_suggestion.get('suggested_account_name', 'N/A')}")
                        print(f"   Suggested Description: {ai_suggestion.get('suggested_description', 'N/A')}")
                        print(f"   Confidence: {ai_suggestion.get('confidence', 'N/A')}")
                    else:
                        print(f"   {ai_suggestion}")
                else:
                    print(f"\n🤖 AI Suggestion: None")
                
                # Display any other fields
                other_fields = {k: v for k, v in tx.items() 
                               if k not in ['id', 'date', 'description', 'reference', 
                                           'amount_in', 'amount_out', 'source', 
                                           'classification_status', 'ai_suggestion']}
                if other_fields:
                    print(f"\nOther Fields:")
                    for key, value in other_fields.items():
                        print(f"   {key}: {value}")
                
                print()
            
            print(f"{'='*80}")
            print(f"Summary: {len(transactions)} transactions returned")
            print(f"{'='*80}\n")
            
            # Also save full response to file for inspection
            output_file = "unmatched_transactions_response.json"
            with open(output_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)
            print(f"Full response saved to: {output_file}")
            
    except httpx.TimeoutException:
        print("❌ Error: Request timed out")
    except httpx.RequestError as e:
        print(f"❌ Error: Request failed - {e}")
    except Exception as e:
        print(f"❌ Error: {type(e).__name__} - {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        try:
            pharmacy_id = int(sys.argv[1])
        except ValueError:
            print(f"Error: Invalid pharmacy_id '{sys.argv[1]}'. Must be an integer.")
            sys.exit(1)
    else:
        # Default pharmacy_id - you can change this
        pharmacy_id = 1
        print(f"No pharmacy_id provided, using default: {pharmacy_id}")
        print(f"Usage: python {sys.argv[0]} <pharmacy_id>\n")
    
    test_unmatched_transactions_api(pharmacy_id)



