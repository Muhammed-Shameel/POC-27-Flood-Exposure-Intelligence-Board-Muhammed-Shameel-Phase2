# Use official Python 3.10 slim image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code into a 'backend' directory to preserve package structure
COPY . ./backend/

# Set environment variables
# 1. /app allows 'import backend.ml'
# 2. /app/backend allows 'from app.api' (used in main.py)
ENV PYTHONPATH=/app:/app/backend
ENV PYTHONUNBUFFERED=1

# Expose port 8000
EXPOSE 8000

# Run the application
CMD ["sh", "-c", "python -m uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]