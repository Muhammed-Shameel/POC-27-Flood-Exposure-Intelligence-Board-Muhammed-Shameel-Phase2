# User Acceptance Test Checklist

**Flood Exposure Intelligence Board**  
**UAT Date:** June 2, 2026  
**Version:** 2.5.0  
**Status:** Ready for User Testing

---

## 1. Dashboard Layout & Navigation

### 1.1 Navbar Optimization
- [ ] Brand "FLUVIO" visible with "Flood Intel Command" subtitle
- [ ] Essential KPIs only: Regions, Critical, Exposed Pop, Selected
- [ ] No horizontal scrolling in navbar
- [ ] Time and Status badge pinned to far right
- [ ] Analytics and Export buttons have consistent 36px height

### 1.2 Interactive Map Controls
- [ ] **Intelligence Layers** panel visible in **top-right**
- [ ] **Severity Profile** panel visible in **bottom-right**
- [ ] Panels are collapsible and don't obstruct map center
- [ ] Inundation toggle works within the Layers panel
- [ ] Asset toggles (Hospitals, etc.) work correctly

---

## 2. Intelligence & Analytics

### 2.1 Project Transparency
- [ ] **Project Tab** visible in right panel
- [ ] "Why This Matters" section contains operational rationale
- [ ] "Who Controls The Rails" section displays the 4-step pipeline
- [ ] Technical details match GBM implementation

### 2.2 Response Protocols
- [ ] **View Protocol** button present in AI tab
- [ ] Clicking "View Protocol" switches to Response tab
- [ ] Response checklist updates dynamically based on city risk

---

## 3. Data Export & Management

### 3.1 Streamlined Export
- [ ] Export menu contains exactly two options: "Global Cache" and "Selected City"
- [ ] Exporting produces a valid CSV file
- [ ] Selected City export is disabled if no city is selected

---

## 4. Machine Learning (GBM)

### 4.1 Prediction & Calibration
- [ ] Risk scores update every 15 minutes (or on manual refresh)
- [ ] Scores are formatted to max 2 decimals
- [ ] Calibration reflects both live weather and regional baseline

---

## 5. Security & Readiness

### 5.1 Environment Integrity
- [ ] Dashboard loads using variables from `.env` / `.env.local`
- [ ] No sensitive keys visible in network logs or source code
- [ ] LocalStorage cache fallback works when API is simulated offline
