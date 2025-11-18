#!/bin/bash

# Script to set up GitHub remote and push code
# Usage: ./setup_github.sh YOUR_GITHUB_USERNAME YOUR_REPO_NAME

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: ./setup_github.sh YOUR_GITHUB_USERNAME YOUR_REPO_NAME"
    echo "Example: ./setup_github.sh johndoe pharmasight-budgeting-app"
    exit 1
fi

GITHUB_USER=$1
REPO_NAME=$2

echo "Setting up GitHub remote..."
git remote add origin https://github.com/${GITHUB_USER}/${REPO_NAME}.git

echo "Pushing to GitHub..."
git push -u origin main

echo "Done! Your code is now on GitHub."
echo "Repository URL: https://github.com/${GITHUB_USER}/${REPO_NAME}"

