# Debtor PDF Parser - Backend Implementation Reference

## Overview

This document provides the reference implementation for parsing debtor PDF reports in the backend API. The backend should use the `extract_debtors_strictest_names` function from `PDF_PARSER_COMPLETE` module.

## Required Implementation

The backend API endpoint `POST /pharmacies/{pharmacy_id}/debtors/upload` should use the following code pattern:

```python
from PDF_PARSER_COMPLETE import extract_debtors_strictest_names
import pandas as pd
import tempfile
import os

# In your upload endpoint handler:
async def upload_debtor_report(pharmacy_id: int, file: UploadFile):
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_path = tmp_file.name
    
    try:
        # Parse PDF using the strictest names extraction
        df = extract_debtors_strictest_names(tmp_path)
        
        # Calculate totals
        total_accounts = len(df)
        total_outstanding = float(df['balance'].sum())
        
        # Convert to database records
        debtors = []
        for _, row in df.iterrows():
            debtor = {
                'pharmacy_id': pharmacy_id,
                'acc_no': str(row.get('acc_no', '')),
                'name': str(row.get('name', '')),
                'current': float(row.get('current', 0.0)),
                'd30': float(row.get('d30', 0.0)),
                'd60': float(row.get('d60', 0.0)),
                'd90': float(row.get('d90', 0.0)),
                'd120': float(row.get('d120', 0.0)),
                'd150': float(row.get('d150', 0.0)),
                'd180': float(row.get('d180', 0.0)),
                'balance': float(row.get('balance', 0.0)),
                'email': str(row.get('email', '')) if pd.notna(row.get('email')) else None,
                'phone': str(row.get('phone', '')) if pd.notna(row.get('phone')) else None,
                'is_medical_aid_control': bool(row.get('is_medical_aid_control', False)) if pd.notna(row.get('is_medical_aid_control')) else False,
            }
            debtors.append(debtor)
        
        # Save to database (your implementation)
        # ... save debtors to database ...
        
        # Return response matching API spec
        return {
            "report_id": report_id,  # ID of saved report
            "total_accounts": total_accounts,
            "total_outstanding": total_outstanding,
            "debtors": debtors[:10]  # Return first 10 as preview
        }
        
    finally:
        # Clean up temporary file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
```

## Code Reference

The exact code pattern to use:

```python
from PDF_PARSER_COMPLETE import extract_debtors_strictest_names

# Parse PDF
df = extract_debtors_strictest_names('debtor_report.pdf')

# View results
print(df.head())
print(f"Total accounts: {len(df)}")
print(f"Total outstanding: R {df['balance'].sum():,.2f}")
```

## Expected DataFrame Columns

The `extract_debtors_strictest_names` function should return a pandas DataFrame with the following columns:

- `acc_no`: Account number (string)
- `name`: Debtor name (string)
- `current`: Current balance (float)
- `d30`: 30 days overdue (float)
- `d60`: 60 days overdue (float)
- `d90`: 90 days overdue (float)
- `d120`: 120 days overdue (float)
- `d150`: 150 days overdue (float)
- `d180`: 180+ days overdue (float)
- `balance`: Total outstanding balance (float)
- `email`: Email address (string or None)
- `phone`: Phone number (string or None)
- `is_medical_aid_control`: Boolean flag for medical aid accounts

## Response Format

The upload endpoint should return:

```json
{
  "report_id": 123,
  "total_accounts": 150,
  "total_outstanding": 125000.50,
  "debtors": [
    {
      "id": 1,
      "pharmacy_id": 1,
      "report_id": 123,
      "acc_no": "123456",
      "name": "John Doe",
      "current": 100.50,
      "d30": 200.00,
      "d60": 150.00,
      "d90": 75.00,
      "d120": 50.00,
      "d150": 25.00,
      "d180": 10.00,
      "balance": 610.50,
      "email": "john@example.com",
      "phone": "0821234567",
      "is_medical_aid_control": false,
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

## Notes

1. **File Handling**: Always use temporary files and clean them up after processing
2. **Error Handling**: Handle cases where PDF parsing fails or returns empty results
3. **Data Validation**: Validate that required columns exist in the DataFrame
4. **Database Transaction**: Wrap database operations in a transaction for atomicity
5. **Medical Aid Filtering**: The `is_medical_aid_control` flag should be set based on the PDF parsing logic

## Testing

To test the parser locally:

```python
from debtor_pdf_parser import parse_debtor_pdf

result = parse_debtor_pdf('debtor_report.pdf', pharmacy_id=1)
print(f"Total accounts: {result['total_accounts']}")
print(f"Total outstanding: R {result['total_outstanding']:,.2f}")
print(result['df'].head())
```

