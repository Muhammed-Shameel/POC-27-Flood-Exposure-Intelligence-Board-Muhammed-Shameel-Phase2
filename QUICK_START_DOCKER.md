# 🐳 Docker Quick Start Guide

Follow these steps to run the Flood Intelligence Board in a containerized environment.

## 1. Prerequisites
- Docker Desktop installed and running.
- At least 2GB of RAM allocated to Docker.

## 2. Environment Setup
Create a `.env` file in the root directory by copying the example:
```bash
cp .env.docker.example .env
```
*(On Windows: `copy .env.docker.example .env`)*

Edit `.env` and add your API keys if you plan to use `live` mode.

## 3. Launch the Platform
Run the following command in the root directory:
```bash
docker-compose up --build
```

## 4. Access the Application
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

## 5. Verification Checklist
- [ ] **The Handshake**: Open `localhost:3000`. Does the dashboard show "Regions: 86"?
- [ ] **ML Engine**: Check logs for "ML model loaded successfully".
- [ ] **Map Canvas**: Verify the dark-themed map loads with city markers.

## Troubleshooting
- **Connection Refused**: Ensure the backend container is running (`docker ps`).
- **Module Not Found**: This usually happens if the package structure is not respected. The Dockerfiles are configured to handle the project's specific import style.
- **Out of Memory**: Increase RAM in Docker Desktop settings if the ML model loading fails.
