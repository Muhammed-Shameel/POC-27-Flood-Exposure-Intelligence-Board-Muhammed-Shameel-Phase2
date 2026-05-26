#!/bin/bash

echo "Starting Flood Intelligence Board Backend..."
echo "=============================================="

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Run FastAPI server
echo ""
echo "Starting FastAPI server on http://localhost:8000"
echo "API Documentation: http://localhost:8000/docs"
echo ""

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
