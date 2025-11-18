#!/usr/bin/env python3
"""
Script to reactivate Charl's account directly in the database.
This script updates the is_active field for user_id 2 in the users table.
"""
import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import engine
from sqlalchemy import text

def reactivate_charl():
    """Reactivate Charl's account (user_id: 2) directly in the database"""
    user_id = 2
    
    print(f"Reactivating Charl's account (user_id: {user_id}) in database...")
    
    try:
        with engine.connect() as connection:
            # First, check if users table exists and get current status
            try:
                result = connection.execute(
                    text("SELECT user_id, username, is_active FROM users WHERE user_id = :user_id"),
                    {"user_id": user_id}
                )
                user = result.fetchone()
                
                if not user:
                    print(f"✗ User with user_id {user_id} not found in database")
                    return False
                
                print(f"Current status - User ID: {user[0]}, Username: {user[1]}, Active: {user[2]}")
                
                if user[2]:
                    print("✓ User is already active!")
                    return True
                
                # Update is_active to True
                connection.execute(
                    text("UPDATE users SET is_active = TRUE WHERE user_id = :user_id"),
                    {"user_id": user_id}
                )
                connection.commit()
                
                print(f"✓ Success! Charl's account has been reactivated.")
                return True
                
            except Exception as e:
                # Table might not exist or have different structure
                print(f"✗ Error accessing users table: {e}")
                print("\nNote: The users table might be in the backend API database, not this local database.")
                print("You may need to contact the backend team to reactivate the account.")
                return False
                
    except Exception as e:
        print(f"\n✗ Error connecting to database: {e}")
        return False

if __name__ == "__main__":
    success = reactivate_charl()
    sys.exit(0 if success else 1)

