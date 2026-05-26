#!/bin/bash

echo "Starting Flood Intelligence Board Frontend..."
echo "=============================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo ""
echo "Starting Next.js development server on http://localhost:3000"
echo ""

npm run dev
