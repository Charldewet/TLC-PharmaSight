# Deployment Fix: Python Version Compatibility

## Issue
Deployment failed with error:
```
ImportError: undefined symbol: _PyInterpreterState_Get
```

This occurs because `psycopg2-binary` doesn't have pre-built wheels for Python 3.13.

## Solution
Use Python 3.11 instead of 3.13.

## What Was Fixed

1. **Created `runtime.txt`** - Specifies Python 3.11.0
2. **Updated `render.yaml`** - Added explicit runtime specification

## How to Fix in Render Dashboard

If you're deploying manually (not using render.yaml):

1. Go to your web service settings
2. Find **"Environment"** or **"Settings"** tab
3. Add/Update environment variable:
   - **Key**: `PYTHON_VERSION`
   - **Value**: `3.11.0`
4. Or better yet, create a `runtime.txt` file in your repo root with:
   ```
   python-3.11.0
   ```

## After Fix

1. Commit the changes:
   ```bash
   git add runtime.txt
   git commit -m "Fix Python version compatibility for psycopg2-binary"
   git push
   ```

2. Render will automatically redeploy with Python 3.11

## Alternative Solution (if you need Python 3.13)

If you must use Python 3.13, you can switch to `psycopg2` instead of `psycopg2-binary`:

1. Update `requirements.txt`:
   ```
   psycopg2==2.9.9
   ```
   (Remove `-binary`)

2. Note: This requires compilation during build, which is slower but works with Python 3.13.

**However, Python 3.11 is recommended** as it's more stable and has better package compatibility.

