"""
QUICK START GUIDE - Flood Intelligence Board

Get up and running in 5 minutes!
"""

## Windows Quick Start

### 1. BACKEND SETUP
```
cd backend
run.bat
```

This will:
- Create Python virtual environment
- Install all dependencies
- Start FastAPI server on http://localhost:8000

### 2. FRONTEND SETUP (New Terminal)
```
cd frontend
run.bat
```

This will:
- Install npm dependencies
- Start Next.js on http://localhost:3000

### 3. ACCESS THE APPLICATION
- Dashboard: http://localhost:3000
- API Docs: http://localhost:8000/docs

---

## macOS/Linux Quick Start

### 1. BACKEND SETUP
```
cd backend
bash run.sh
```

### 2. FRONTEND SETUP (New Terminal)
```
cd frontend
bash run.sh
```

### 3. ACCESS
- Dashboard: http://localhost:3000
- API: http://localhost:8000/docs

---

## WHAT YOU GET

✅ Interactive flood risk map (70% of screen)
✅ Real-time intelligence sidebar (30% of screen)
✅ Live rainfall visualization
✅ Emergency impact metrics
✅ Risk scoring engine
✅ Scenario simulation (rainfall multiplier from 0.5x to 3.0x)
✅ Alert generation system
✅ Mock data (no database needed)

---

## TROUBLESHOOTING

### Port Already in Use?
```
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :8000
kill -9 <PID>
```

### Dependencies Not Installing?
```
# Backend
cd backend
python -m pip install --upgrade pip
pip install -r requirements.txt

# Frontend
cd frontend
npm cache clean --force
npm install
```

### Backend Not Responding?
- Check http://localhost:8000/health
- Ensure uvicorn is installed: `pip install uvicorn`
- Check console for error messages

### Frontend Can't Reach API?
- Verify backend is running
- Check NEXT_PUBLIC_API_URL in frontend/.env.local
- Check browser console for CORS errors

---

## NEXT STEPS

1. **Explore the API**: Visit http://localhost:8000/docs
2. **View Dashboard**: Go to http://localhost:3000
3. **Generate Mock Data**: `python backend/data_pipeline/generate_mock_data.py`
4. **Check Console**: Monitor real-time updates
5. **Read Full Docs**: See README.md for detailed information

---

## KEY ENDPOINTS TO TRY

**Flood Zones:**
`http://localhost:8000/api/flood-zones`

**Risk Scores:**
`http://localhost:8000/api/risk-scores`

**Global Risk Index:**
`http://localhost:8000/api/risk-scores/global-index`

**Alerts:**
`http://localhost:8000/api/alerts`

**Run Scenario (2x rainfall):**
```
POST http://localhost:8000/api/scenario-simulation
{
  "rainfall_multiplier": 2.0,
  "scenario_name": "Heavy Rain Event"
}
```

---

## ARCHITECTURE

```
User Browser (localhost:3000)
    ↓
Next.js Frontend (React + Leaflet)
    ↓
HTTP Requests
    ↓
FastAPI Backend (localhost:8000)
    ↓
Mock Data Generators
    ↓
Response (GeoJSON + Metrics)
    ↓
Dashboard Visualization
```

---

**Questions? Check the full README.md file!**
