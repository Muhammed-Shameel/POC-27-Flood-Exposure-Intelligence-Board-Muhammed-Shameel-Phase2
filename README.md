# 🌊 Flood Intelligence Board

**Enterprise-Grade Geospatial Intelligence Platform for Real-Time Flood Risk Assessment**

A production-style, AI-powered flood exposure intelligence system with cinematic fintech-terminal aesthetics. Visualize flood risk heatmaps, live rainfall overlays, population exposure, critical infrastructure threats, and emergency impact metrics in a unified command center.

---

## 🎯 Project Overview

The **Flood Exposure Intelligence Board** (FLUVIO) is a comprehensive disaster intelligence platform designed for emergency management agencies, insurance companies, and critical infrastructure operators. It combines live meteorological telemetry with advanced machine learning to provide actionable risk insights.

### Key Features

✅ **Optimized Map Intelligence Surface**
- **Dynamic Inundation Layer**: Procedurally generated flood extent polygons.
- **Toggleable Asset Overlays**: Live markers for Hospitals, Schools, Roads, Power, and Critical facilities.
- **Refined Legends**: Compact, collapsible severity and infrastructure controls positioned to maximize map visibility.
- **Geospatial Context**: Intelligent city markers with 1.2s smooth-fly transitions.

✅ **Machine Learning Engine (GBM)**
- **GradientBoostingRegressor** pipeline for high-precision risk prediction.
- **Feature Vector Analysis**: Processes Rainfall, Population Density, Elevation, Infrastructure Density, and Historical Scores.
- **Dynamic Calibration**: Risk scores are calibrated every 15 minutes against live weather telemetry.

✅ **Analytics Intelligence Layer**
- **14+ Real-Time KPIs**: Including Global Risk Index, Exposed Population, and Response Readiness.
- **9 Interactive Dashboards**: Visualizing forecasts, infrastructure stress, and weather correlations.
- **Analysis Mode**: A dedicated modal workspace for deep-dive regional comparisons.

✅ **Operational Readiness**
- **Dynamic Response Checklist**: Tailored operational protocols based on current risk severity.
- **Alert Intelligence**: Multi-tier alert feed (Critical, High, Moderate) with timestamped audit logs.
- **Project Transparency**: Dedicated "Project" tab explaining rationale and the "Who Controls The Rails" technical pipeline.

✅ **Multi-Tier Cache & Resiliency**
- **Triple-Level Caching**: memory (L1), file-system (L2), and localStorage (L3) fallback systems.
- **Offline Mode**: Automatic switch to cached telemetry if weather APIs or ML services become unavailable.

✅ **Streamlined Export System**
- One-click **CSV Dataset Export** from the navbar.
- Targets: **Global Cache Snapshot** or **Selected City Intelligence**.

---

## 🏗️ System Architecture

### Technology Stack

**Frontend:** Next.js 14+ (App Router), TypeScript, React Leaflet, Recharts, Tailwind CSS, Framer Motion.
**Backend:** FastAPI (Python), Pydantic, Scikit-learn, joblib.
**Data Source:** Open-Meteo API (Live), regions.json (Regional Intel), Kaggle Flood Dataset (ML Training).

### Data Flow Pipeline

1. **Static Ingestion**: `regions.json` provides baseline infrastructure and population profiles.
2. **Telemetry Hook**: Backend fetches live rainfall/humidity from Open-Meteo.
3. **ML Inference**: `GradientBoostingRegressor` predicts risk using 5 feature vectors.
4. **Calibration**: Service layer blends ML predictions (60%) with baseline vulnerability (25%) and rainfall (15%).
5. **Caching**: Results stored in persistent JSON/CSV and synchronized to frontend `LocalStorage`.
6. **Visualization**: Frontend renders dynamic map layers and analytics KPIs.

---

## 🤖 Machine Learning Pipeline

### Model Specification
- **Algorithm**: Gradient Boosting Regressor (GBM)
- **Estimators**: 200 trees
- **Learning Rate**: 0.1
- **Optimization**: Squared error with subsampling for robustness.

### Input Features
1. **Rainfall (mm)**: Live meteorological input.
2. **Population Density**: Regional concentration.
3. **Elevation**: Geographical vulnerability factor.
4. **Infrastructure Density**: Critical asset density per km².
5. **Historical Score**: Long-term risk baseline.

---

## 🎨 Operational Interface

### Optimized Navbar
- **Essential KPIs**: Only critical metrics shown (Regions, Critical, Population, Selection).
- **Integrated Controls**: Seamless switching between Live/Historical modes and City filtering.
- **Status Indicators**: Real-time clock and API/Cache health badges.

### Intelligence Panels (Map)
- **Top-Right**: Intelligence Layers (Asset Toggles & Inundation).
- **Bottom-Right**: Severity Profile (Risk Distribution bars).

---

## 🔧 Setup & Deployment

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🛡️ Security & Privacy
- **Environment Management**: `.env` and `.env.local` files are ignored by Git to prevent secret leaks.
- **Cache Security**: Sensitive cache files (`*.json`, `*.csv`) in the backend are excluded from version control.
- **Secret Hygiene**: No API keys or credentials are hardcoded; all services use Application Default Credentials or env vars.

---

## 📄 Dataset Documentation

### 1. Training Data (Kaggle)
Used for the core GBM model development. Provides historical relationships between rainfall, infrastructure, and flood outcomes.

### 2. Regional Intelligence (regions.json)
The "Heart" of the platform. Contains deterministic infrastructure inventory (hospitals, schools, road_km) and baseline vulnerability indicators for 86 global cities.

---

**Last Updated**: June 2026  
**Status**: Production Ready ✅  
**Version**: 2.5.0
