# User Acceptance Test Checklist

**Flood Exposure Intelligence Board**  
**UAT Date:** May 29, 2026  
**Version:** 2.2.0  
**Status:** Ready for User Testing

---

## Pre-UAT Setup

**System Requirements:**
- [ ] Backend running on http://localhost:8000
- [ ] Frontend running on http://localhost:3000
- [ ] Both services started without errors
- [ ] Health check passing: http://localhost:8000/health
- [ ] API docs accessible: http://localhost:8000/docs

**Test Users:**
- [ ] Admin user created (if authentication enabled)
- [ ] Test data loaded (86 regions)
- [ ] Historical archive present
- [ ] ML model loaded and validated

---

## 1. Dashboard Layout & Navigation

### 1.1 Initial Load
- [ ] Dashboard loads without errors
- [ ] Header displays "FLUVIO" with subtitle
- [ ] Map displays globally (Asia/Middle East/Europe centered)
- [ ] 86 city markers visible on map
- [ ] Sidebar displays on right side
- [ ] KPI bar visible at top with metrics
- [ ] No console errors

### 1.2 Header & KPI Display
- [ ] "FLUVIO" title clearly visible
- [ ] Title size appropriate (not too small, not oversized)
- [ ] Letter spacing looks professional (not excessive)
- [ ] KPI pills display: Avg Risk, Regions, Critical, Rainfall, Water, Selected
- [ ] KPI values formatted correctly (max 2 decimals)
- [ ] Analytics button present and clickable

### 1.4 Main Dashboard KPI Grid
- [ ] 14 intelligence KPI cards visible below navbar/filter row
- [ ] Responsive grid layout (2 cols mobile, 3 md, 4 xl, 7 on 2xl)
- [ ] No text clipping or overlapping in cards
- [ ] Sparklines render correctly in each card
- [ ] Hover effects active on all cards

### 1.5 Interactive Map Overlays
- [ ] Map occupies majority of viewport
- [ ] Infrastructure Intelligence panel is collapsible
- [ ] Flood Severity Distribution panel is collapsible
- [ ] Panels start collapsed or remember state
- [ ] Toggle buttons clearly visible and functional
- [ ] Full panel content displays correctly when expanded

---

## 2. Sidebar Panel Management

### 2.1 Sidebar Opening/Closing
- [ ] Sidebar visible by default on page load
- [ ] Clicking × button closes sidebar
- [ ] Map expands to full width when closed
- [ ] Reopen button appears on map (right side)
- [ ] Clicking reopen button brings sidebar back
- [ ] Animations smooth (no stuttering)

### 2.2 Panel Switching
- [ ] 5 tabs visible: AI, Alerts, Zones, Reports, Timeline
- [ ] Clicking tab switches panel content
- [ ] Panel content updates without closing
- [ ] Active tab highlighted with emerald color
- [ ] All tabs have content (no blank pages)

### 2.3 Analytics Drawer
- [ ] "ANALYTICS" button visible at bottom
- [ ] Clicking opens expandable drawer
- [ ] Drawer height about 60% of viewport
- [ ] Contains tabs: Analysis, Forecast, Simulation, AI Insights
- [ ] Charts render without errors
- [ ] Drawer closes with × button
- [ ] Can be closed with Escape key

---

## 3. Data Selection & Filtering

### 3.1 City Selection
- [ ] Clicking map marker selects city
- [ ] Selected marker becomes highlighted (brighter glow)
- [ ] Sidebar updates with selected city data
- [ ] KPI "Selected" shows city name
- [ ] Clicking another marker switches selection
- [ ] "All Cities" selection clears individual selection
- [ ] Sidebar remains open when selecting (unless already closed)

### 3.2 Region Dropdown (Control Panel)
- [ ] Region filter dropdown available
- [ ] "All Regions" option present
- [ ] Can select individual regions
- [ ] Selection filters map to show only selected region
- [ ] Works with both Live and Historical modes

---

## 4. Live vs Historical Data Toggle

### 4.1 Mode Switching
- [ ] "LIVE" badge visible in header or sidebar
- [ ] Badge is clickable/toggleable
- [ ] Clicking switches to "HISTORICAL" mode
- [ ] Clicking again switches back to "LIVE"
- [ ] Switch is instantaneous (no loading delay after cache)
- [ ] Data updates appropriately for selected mode

### 4.2 Live Mode Behavior
- [ ] Live mode fetches fresh weather data
- [ ] Risk scores are dynamic and ML-based
- [ ] Values change if you wait 30+ seconds
- [ ] Timestamp shows current time
- [ ] "LIVE" badge is clearly visible
- [ ] If API fails, falls back to cached data gracefully

### 4.3 Historical Mode Behavior
- [ ] Historical mode shows archived data
- [ ] All regions have historical data points
- [ ] Timestamps show past times
- [ ] "HISTORICAL" badge visible
- [ ] Trend data available for charts
- [ ] Data remains stable (doesn't refresh)

---

## 5. Machine Learning & Predictions

### 5.1 Risk Score Accuracy
- [ ] Risk scores are numerical (not hardcoded or identical)
- [ ] High-risk regions show high scores (Kochi, Jakarta, etc.)
- [ ] Low-risk regions show lower scores (Prague, Rotterdam, etc.)
- [ ] Scores vary between regions (not all same value)
- [ ] Scores update when switching between cities
- [ ] Risk levels (LOW/MODERATE/HIGH/CRITICAL) match scores

### 5.2 Risk Score Formatting
- [ ] Risk values display with max 2 decimals (e.g., 72.35)
- [ ] No excessive decimal places (not 72.35329804)
- [ ] Values in 0-100 range
- [ ] Formatted consistently across all panels
- [ ] KPI card shows formatted value
- [ ] Chart tooltips show formatted value

### 5.3 Model Integration
- [ ] Backend logs show "ML service initialized"
- [ ] /api/ml/status endpoint returns model info
- [ ] Model type shown: "GradientBoostingRegressor"
- [ ] Predictions complete within 50ms (fast)
- [ ] Model handles all 20 ML features
- [ ] Error handling graceful if model fails

---

## 6. Numeric Formatting (Global)

### 6.1 Risk Scores
- [ ] Display format: "72.35" (max 2 decimals)
- [ ] Consistent across KPI, panels, charts
- [ ] Integer scores shown without decimals: "75"

### 6.2 Rainfall Values
- [ ] Display format: "145.2 mm" (max 1 decimal + unit)
- [ ] Units displayed consistently
- [ ] Example: "145.2 mm", not "145.234 mm"

### 6.3 Water Level Index
- [ ] Display format: Integer or 1 decimal
- [ ] Example: "65" or "65.4"
- [ ] Consistent formatting across panels

### 6.4 Population Exposure
- [ ] Large numbers formatted with commas
- [ ] Example: "1,234,567" not "1234567"
- [ ] Decimals max 2: "15.32%"

### 6.5 Percentages & Ratios
- [ ] Formatted with max 2 decimals
- [ ] Example: "73.45%", "42.78%"
- [ ] Consistent symbol placement

### 6.6 All Values in Charts
- [ ] Tooltip numbers formatted correctly
- [ ] Axis labels formatted appropriately
- [ ] No scientific notation (1e+07)
- [ ] Readable for all users

---

## 7. Analytics & Visualization

### 7.1 Chart Rendering
- [ ] Risk Distribution Chart displays (bar chart)
- [ ] Rainfall Trend Chart displays (line chart)
- [ ] Exposure Analytics Chart displays (area chart)
- [ ] Charts update when changing selected city
- [ ] Charts use actual data (not placeholder)
- [ ] Legends visible and clear

### 7.2 Chart Interactivity
- [ ] Hover over chart shows tooltip
- [ ] Tooltip displays formatted values
- [ ] Tooltip contains relevant information
- [ ] Chart background appropriate (matches theme)
- [ ] Colors match emerald/cyan theme

### 7.3 Analytics Drawer Content
- [ ] Analysis tab shows meaningful data
- [ ] Forecast tab contains weather predictions
- [ ] Simulation tab shows scenario results
- [ ] AI Insights tab displays insights
- [ ] All tabs have actual data (not Lorem Ipsum)

### 7.4 KPI Cards & Metrics
- [ ] KPI cards have hover effects
- [ ] Cards show tooltip on hover
- [ ] Tooltip provides additional context
- [ ] Cards formatted consistently
- [ ] All values numeric and accurate

---

## 8. Map Interactions

### 8.1 Map Zooming
- [ ] Scroll wheel zooms in/out smoothly
- [ ] + and - controls work (if present)
- [ ] Zoom level 3 shows full world
- [ ] Zoom level 10 shows city detail
- [ ] Zoom limits prevent over-zoom

### 8.2 Map Panning
- [ ] Can drag map to pan around
- [ ] Panning smooth (no jumpy behavior)
- [ ] All regions remain accessible
- [ ] Map doesn't pan outside valid bounds

### 8.3 Fly-To Animation
- [ ] Clicking city marker centers on that city
- [ ] Animation smooth (1.2s duration)
- [ ] Zoom level appropriate for selected city
- [ ] Map doesn't overfly selected marker

### 8.4 City Marker Interaction
- [ ] Clicking marker selects city
- [ ] Double-clicking doesn't cause issues
- [ ] Right-clicking doesn't break map
- [ ] Selected marker glows/changes color
- [ ] Tooltip shows city name and risk

---

## 9. Panel Content & Features

### 9.1 Risk Panel
- [ ] Shows risk score for selected city
- [ ] Shows risk level (LOW/MODERATE/HIGH/CRITICAL)
- [ ] Shows risk category
- [ ] Color matches risk level
- [ ] Contains additional risk metrics
- [ ] Updates when switching cities

### 9.2 Rainfall Panel
- [ ] Shows rainfall amount (mm)
- [ ] Shows humidity percentage
- [ ] Shows water level index
- [ ] Formatted correctly (1-2 decimals)
- [ ] Shows current and forecasted values

### 9.3 AI Insights Panel
- [ ] Shows AI-generated insights
- [ ] Text is readable and meaningful
- [ ] Insights relevant to selected city
- [ ] Multiple insights displayed
- [ ] Updates with city selection

### 9.4 Alerts Panel
- [ ] Shows active alerts for selected city
- [ ] Lists critical alerts prominently
- [ ] Alerts have timestamps
- [ ] Severity levels color-coded
- [ ] No duplicate alerts

### 9.5 Analysis Panel
- [ ] Wider than normal panels (should expand map)
- [ ] Contains additional analysis
- [ ] Charts update dynamically
- [ ] Takes advantage of extra space
- [ ] No horizontal scroll needed

---

## 10. Alerts & Notifications

### 10.1 Alert Generation
- [ ] High-risk regions show alerts
- [ ] Alerts generated based on risk thresholds
- [ ] Critical Alerts badge shows count
- [ ] New alerts appear in real-time

### 10.2 Alert Display
- [ ] Alert feed shows timestamp
- [ ] Alert shows affected city/region
- [ ] Severity level indicated (warning/danger/critical)
- [ ] Affected population shown (if available)
- [ ] Relevant metadata included

### 10.3 Alert Filtering
- [ ] Can filter by severity
- [ ] Can filter by city
- [ ] Can dismiss alerts
- [ ] Dismissed alerts don't reappear immediately

---

## 11. Scenario Simulation

### 11.1 Control Panel
- [ ] Rainfall multiplier slider available
- [ ] Preset scenario buttons visible (0.7x, 1.5x, 2.0x)
- [ ] Slider ranges from 0.5 to 3.0x
- [ ] Slider updates display value
- [ ] Current multiplier shown as text

### 11.2 Scenario Execution
- [ ] Clicking preset updates multiplier
- [ ] Risk scores recalculate immediately
- [ ] All metrics update (rainfall, exposure, etc.)
- [ ] Charts update dynamically
- [ ] No loading spinner (instant or <1s)

### 11.3 Scenario Comparison
- [ ] Can view baseline vs scenario
- [ ] Comparison shows changes in impact
- [ ] Population exposure recalculated
- [ ] Infrastructure exposure recalculated
- [ ] Results displayable/exportable

---

## 12. Performance & Stability

### 12.1 Load Performance
- [ ] Dashboard loads in <3 seconds
- [ ] Map renders immediately
- [ ] Data fetches within 5 seconds
- [ ] No timeout errors
- [ ] Smooth scrolling in sidebar

### 12.2 Runtime Performance
- [ ] No lag when switching cities
- [ ] No lag when toggling data mode
- [ ] No lag when running scenarios
- [ ] Animations smooth (60fps)
- [ ] No memory leaks (browser doesn't bloat)

### 12.3 Network Performance
- [ ] API calls complete quickly (<300ms)
- [ ] No unnecessary API calls
- [ ] Cache reduces repeat requests
- [ ] Graceful handling of slow network
- [ ] Offline fallback uses cached data

### 12.4 Error Handling
- [ ] Network errors show friendly message
- [ ] API errors don't crash dashboard
- [ ] Fallback data used when API fails
- [ ] Error messages are helpful
- [ ] Recovery automatic when service returns

---

## 13. Responsive & Accessibility

### 13.1 Responsive Design
- [ ] Layouts work on 1024px width
- [ ] Layouts work on 1440px width
- [ ] Layouts work on 4K (2560px)
- [ ] No horizontal scroll on intended sizes
- [ ] Touch-friendly on tablets (if tested)

### 13.2 Accessibility
- [ ] Sufficient color contrast for text
- [ ] Buttons have hover states
- [ ] Form inputs labeled
- [ ] Keyboard navigation works (Tab key)
- [ ] Screen reader compatible (if tested)

### 13.3 Theme Consistency
- [ ] Emerald/cyan colors used throughout
- [ ] Dark theme consistent
- [ ] No bright white text on dark (readable)
- [ ] Glassmorphism effects visible
- [ ] Glows render cleanly

---

## 14. UI/UX Quality

### 14.1 Visual Design
- [ ] No emojis in any content
- [ ] Professional enterprise appearance
- [ ] Cinematic aesthetic maintained
- [ ] Premium feel (not amateur)
- [ ] Consistent font sizes
- [ ] Icon usage appropriate

### 14.2 User Experience
- [ ] UI feels responsive to actions
- [ ] Animations don't distract
- [ ] Information hierarchy clear
- [ ] Important data prominent
- [ ] Navigation intuitive

### 14.3 Edge Cases
- [ ] Handles empty data gracefully
- [ ] Handles missing regions
- [ ] Handles API timeout
- [ ] Handles conflicting actions (double-clicks)
- [ ] Error messages non-technical for users

---

## 15. Data Validation Tests

### 15.1 Region Data
- [ ] All 86 regions display on map
- [ ] No duplicate regions
- [ ] All coordinates within valid ranges
- [ ] Region names spelled correctly
- [ ] Country names correct
- [ ] Continent classification accurate

### 15.2 Historical Archive
- [ ] Archive contains historical data
- [ ] Timestamps in proper order
- [ ] Can access data from 7 days ago
- [ ] Archive doesn't have gaps
- [ ] CSV file properly formatted

### 15.3 ML Features
- [ ] All 20 features present for each region
- [ ] Features in 0-100 scale
- [ ] Features make sense for region type
- [ ] No negative or invalid values
- [ ] Feature values consistent across calls

---

## 16. Documentation & Help

### 16.1 README.md
- [ ] File exists and is readable
- [ ] Contains project overview
- [ ] Lists key features
- [ ] Describes technology stack
- [ ] Includes setup instructions
- [ ] Environment variables documented
- [ ] Deployment section present

### 16.2 Quick Start
- [ ] QUICK_START.md exists
- [ ] Instructions are clear
- [ ] Windows and macOS/Linux paths included
- [ ] Can follow steps to get running
- [ ] Troubleshooting section helpful

### 16.3 VAR Report
- [ ] VAR_REPORT.md exists and detailed
- [ ] Covers functional validation
- [ ] Includes performance metrics
- [ ] ML validation present
- [ ] Known limitations documented

### 16.4 UAT Checklist
- [ ] UAT_CHECKLIST.md exists
- [ ] Organized by feature area
- [ ] Clear pass/fail criteria
- [ ] All important scenarios covered

---

## 17. Production Readiness

### 17.1 Deployment Checklist
- [ ] Environment variables configured
- [ ] ML model file present and valid
- [ ] Database/cache paths writable
- [ ] CORS properly configured
- [ ] Error logging configured
- [ ] Monitoring/alerting ready

### 17.2 Security
- [ ] No credentials in code
- [ ] API authentication ready
- [ ] HTTPS ready for production
- [ ] Input validation present
- [ ] SQL injection protected (N/A for this app)
- [ ] XSS protections enabled

### 17.3 Data Integrity
- [ ] Backup procedures documented
- [ ] Cache recovery tested
- [ ] Archive integrity verified
- [ ] Data export format clear
- [ ] Recovery procedures documented

---

## 18. Optional Advanced Features

### 18.1 If Enabled: Real-Time WebSocket Updates
- [ ] WebSocket connection established
- [ ] Real-time updates received
- [ ] Data updates without refresh
- [ ] No stale data displayed

### 18.2 If Enabled: Mobile Responsiveness
- [ ] Mobile layout functional
- [ ] Touch interactions work
- [ ] Sidebar works on mobile
- [ ] Charts readable on small screens

### 18.3 If Enabled: Multi-Scenario Comparison
- [ ] Can save scenarios
- [ ] Can compare multiple scenarios
- [ ] Comparison view clear
- [ ] Export comparison results

---

## Test Results Summary

### Functional Testing
- [ ] All features working as expected
- [ ] No critical bugs discovered
- [ ] No data integrity issues
- [ ] Acceptable UI/UX

### Technical Testing
- [ ] Performance acceptable
- [ ] Stability verified
- [ ] Error handling appropriate
- [ ] Security baseline met

### User Testing
- [ ] Intuitive navigation
- [ ] Clear information architecture
- [ ] Professional appearance
- [ ] No user confusion points identified

---

## Sign-Off

### Tester Information
- **Tester Name:** _______________________
- **Date:** _______________________
- **Organization:** _______________________
- **Email:** _______________________

### Test Results
- [ ] All tests passed
- [ ] Minor issues (documented below)
- [ ] Major issues (recommend not releasing)
- [ ] Blockers (critical issues found)

### Issues Found
```
Issue #1: ___________________________
Severity: [ ] Critical [ ] High [ ] Medium [ ] Low
Description: _________________________
Steps to reproduce: _____________________

Issue #2: ___________________________
...
```

### Recommendations

```
Feature enhancement: _______________________
Performance improvement: _______________________
Bug fix needed: _______________________
```

### Final UAT Decision

- [ ] **APPROVED - Ready for Production**
- [ ] **APPROVED WITH CONDITIONS** (see issues above)
- [ ] **REJECTED - Blockers must be resolved**

**UAT Sign-Off:** _________________________ (Signature)

**Date:** _______________________

---

## Post-UAT Actions

- [ ] Document all issues in tracking system
- [ ] Assign issues to development team
- [ ] Schedule fixes/improvements
- [ ] Schedule re-test for critical issues
- [ ] Update production deployment plan
- [ ] Schedule user training (if applicable)
- [ ] Set go-live date
- [ ] Notify stakeholders of status

---

## Contact & Support

For UAT support or questions:
- **Technical Support:** tech-support@example.com
- **Product Owner:** product@example.com
- **Issue Escalation:** issues@example.com

---

**UAT Checklist Version:** 1.0  
**Last Updated:** May 29, 2026  
**Validity:** Valid for version 2.2.0 of Flood Exposure Intelligence Board
