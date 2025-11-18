"""
Debtor PDF Parser - Reference Implementation

This module provides the PDF parsing functionality for debtor reports.
The backend API should use this implementation when processing uploaded PDF files.

Usage:
    from debtor_pdf_parser import parse_debtor_pdf
    
    # Parse PDF file
    result = parse_debtor_pdf('debtor_report.pdf', pharmacy_id=1)
    
    # Result contains:
    # - df: DataFrame with debtor data
    # - total_accounts: int
    # - total_outstanding: float
    # - debtors: list of debtor dictionaries
"""

from PDF_PARSER_COMPLETE import extract_debtors_strictest_names
import pandas as pd
from typing import Dict, List, Any, Optional
import os


def parse_debtor_pdf(pdf_path: str, pharmacy_id: int) -> Dict[str, Any]:
    """
    Parse a debtor PDF report and return structured data.
    
    Args:
        pdf_path: Path to the PDF file
        pharmacy_id: ID of the pharmacy this report belongs to
        
    Returns:
        Dictionary containing:
        - df: pandas DataFrame with parsed debtor data
        - total_accounts: Total number of accounts
        - total_outstanding: Total outstanding balance
        - debtors: List of debtor dictionaries ready for database insertion
    """
    # Parse PDF using the strictest names extraction
    df = extract_debtors_strictest_names(pdf_path)
    
    # Calculate totals
    total_accounts = len(df)
    total_outstanding = float(df['balance'].sum()) if 'balance' in df.columns else 0.0
    
    # Convert DataFrame to list of dictionaries for API response
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
    
    return {
        'df': df,
        'total_accounts': total_accounts,
        'total_outstanding': total_outstanding,
        'debtors': debtors
    }


def parse_debtor_pdf_from_bytes(pdf_bytes: bytes, pharmacy_id: int, filename: str = 'debtor_report.pdf') -> Dict[str, Any]:
    """
    Parse a debtor PDF from bytes (useful for API uploads).
    
    Args:
        pdf_bytes: PDF file content as bytes
        pharmacy_id: ID of the pharmacy this report belongs to
        filename: Temporary filename for the PDF (optional)
        
    Returns:
        Dictionary containing parsed debtor data (same format as parse_debtor_pdf)
    """
    import tempfile
    
    # Write bytes to temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
        tmp_file.write(pdf_bytes)
        tmp_path = tmp_file.name
    
    try:
        # Parse the PDF
        result = parse_debtor_pdf(tmp_path, pharmacy_id)
        return result
    finally:
        # Clean up temporary file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


# Example usage (for testing)
if __name__ == "__main__":
    # Example: Parse a PDF file
    pdf_file = 'debtor_report.pdf'
    
    if os.path.exists(pdf_file):
        result = parse_debtor_pdf(pdf_file, pharmacy_id=1)
        
        print("=" * 80)
        print("DEBTOR PDF PARSING RESULTS")
        print("=" * 80)
        print(f"\nTotal accounts: {result['total_accounts']}")
        print(f"Total outstanding: R {result['total_outstanding']:,.2f}")
        print(f"\nFirst 5 debtors:")
        print(result['df'].head())
        print(f"\nTotal debtors in list: {len(result['debtors'])}")
        print("=" * 80)
    else:
        print(f"PDF file '{pdf_file}' not found.")
        print("\nUsage example:")
        print("  from debtor_pdf_parser import parse_debtor_pdf")
        print("  result = parse_debtor_pdf('debtor_report.pdf', pharmacy_id=1)")
        print("  print(f\"Total accounts: {result['total_accounts']}\")")
        print("  print(f\"Total outstanding: R {result['total_outstanding']:,.2f}\")")

