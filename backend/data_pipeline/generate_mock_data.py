"""
Mock data generators for realistic flood intelligence data
Generates synthetic but realistic flood zones, rainfall, and impact metrics
"""

import random
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any
import math


class MockDataGenerator:
    """Generate realistic mock data for flood intelligence"""
    
    # Base geographical center (example: somewhere in a flood-prone region)
    BASE_LAT = 37.7749
    BASE_LON = -122.4194
    
    CITIES = [
        {"name": "Central District", "lat": 37.7749, "lon": -122.4194, "population": 875000},
        {"name": "North Zone", "lat": 37.8049, "lon": -122.4094, "population": 520000},
        {"name": "South Sector", "lat": 37.7449, "lon": -122.4294, "population": 620000},
        {"name": "East Riverside", "lat": 37.7649, "lon": -122.3894, "population": 380000},
        {"name": "West Valley", "lat": 37.7849, "lon": -122.4494, "population": 450000},
    ]
    
    @staticmethod
    def generate_flood_zones(count: int = 12) -> List[Dict[str, Any]]:
        """Generate realistic flood zone polygons with GeoJSON"""
        zones = []
        
        for i in range(count):
            zone_id = f"ZONE_{i:03d}"
            
            # Generate a reasonable flood zone polygon (roughly circular)
            center_lat = MockDataGenerator.BASE_LAT + random.uniform(-0.05, 0.05)
            center_lon = MockDataGenerator.BASE_LON + random.uniform(-0.05, 0.05)
            radius_deg = random.uniform(0.003, 0.015)
            
            # Create polygon ring (8 points)
            points = []
            for angle in range(0, 360, 45):
                rad = math.radians(angle)
                lat = center_lat + radius_deg * math.cos(rad)
                lon = center_lon + radius_deg * math.sin(rad)
                points.append([lon, lat])
            
            # Close the polygon
            points.append(points[0])
            
            # Severity varies
            severity = random.choices(
                ["LOW", "MODERATE", "HIGH", "CRITICAL"],
                weights=[20, 40, 30, 10]
            )[0]
            
            zone = {
                "id": zone_id,
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [points]
                },
                "severity": severity,
                "flood_depth_meters": {
                    "LOW": random.uniform(0.5, 1.0),
                    "MODERATE": random.uniform(1.0, 2.0),
                    "HIGH": random.uniform(2.0, 4.0),
                    "CRITICAL": random.uniform(4.0, 8.0)
                }[severity],
                "affected_area_sqkm": random.uniform(5, 150),
                "created_at": datetime.utcnow().isoformat()
            }
            zones.append(zone)
        
        return zones
    
    @staticmethod
    def generate_rainfall_data(count: int = 15) -> List[Dict[str, Any]]:
        """Generate realistic rainfall measurements"""
        rainfall_data = []
        
        for i in range(count):
            lat = MockDataGenerator.BASE_LAT + random.uniform(-0.05, 0.05)
            lon = MockDataGenerator.BASE_LON + random.uniform(-0.05, 0.05)
            
            # Rainfall tends to cluster (nearby stations have similar values)
            base_intensity = random.uniform(5, 120)
            intensity = max(0, base_intensity + random.gauss(0, 5))
            accumulated = max(0, intensity * random.uniform(1, 3))
            
            rainfall = {
                "location": {
                    "latitude": lat,
                    "longitude": lon
                },
                "intensity_mm": round(intensity, 2),
                "accumulated_mm": round(accumulated, 2),
                "timestamp": (datetime.utcnow() - timedelta(hours=random.randint(0, 6))).isoformat(),
                "forecast_horizon_hours": random.choice([0, 6, 12, 24])
            }
            rainfall_data.append(rainfall)
        
        return rainfall_data
    
    @staticmethod
    def generate_population_exposure(zone_id: str, zone_severity: str) -> Dict[str, Any]:
        """Generate deterministic population exposure metrics for a zone"""
        
        # Severity-based multiplier for affected population
        severity_multiplier = {
            "LOW": 0.3,
            "MODERATE": 0.6,
            "HIGH": 0.85,
            "CRITICAL": 0.95
        }[zone_severity]
        
        zone_factor = 1 + (sum(ord(ch) for ch in zone_id) % 100) / 100
        total_pop = int((65000 + len(zone_id) * 11000) * zone_factor)
        affected = int(total_pop * severity_multiplier)
        
        return {
            "total_population": total_pop,
            "affected_population": affected,
            "high_risk_population": int(affected * (0.22 + severity_multiplier * 0.28)),
            "evacuation_difficulty_index": round(min(0.95, 0.28 + severity_multiplier * 0.64), 2)
        }
    
    @staticmethod
    def generate_infrastructure_exposure(zone_severity: str, zone_id: str = "") -> Dict[str, Any]:
        """Generate deterministic critical infrastructure exposure"""
        
        severity_multiplier = {
            "LOW": 0.1,
            "MODERATE": 0.35,
            "HIGH": 0.7,
            "CRITICAL": 0.9
        }[zone_severity]
        
        zone_factor = 1 + (sum(ord(ch) for ch in zone_id) % 60) / 100
        hospitals_inventory = max(1, int((3 + len(zone_id)) * zone_factor))
        schools_inventory = max(2, int((8 + len(zone_id) * 2) * zone_factor))
        power_inventory = max(1, int((1 + len(zone_id) / 4) * zone_factor))
        road_inventory = max(8, (18 + len(zone_id) * 3) * zone_factor)
        bridge_inventory = max(1, int((1 + len(zone_id) / 3) * zone_factor))
        
        return {
            "hospitals_affected": int(hospitals_inventory * severity_multiplier),
            "schools_affected": int(schools_inventory * severity_multiplier),
            "power_stations_affected": int(power_inventory * severity_multiplier),
            "roads_inaccessible_km": round(road_inventory * severity_multiplier, 1),
            "bridges_affected": int(bridge_inventory * severity_multiplier)
        }
    
    @staticmethod
    def generate_emergency_impact(zone_id: str, zone_severity: str) -> Dict[str, Any]:
        """Generate emergency impact metrics"""
        pop_exp = MockDataGenerator.generate_population_exposure(zone_id, zone_severity)
        infra_exp = MockDataGenerator.generate_infrastructure_exposure(zone_severity, zone_id)
        
        critical_facilities = (
            infra_exp["hospitals_affected"] +
            infra_exp["schools_affected"] +
            infra_exp["power_stations_affected"]
        )
        
        return {
            "zone_id": zone_id,
            "timestamp": datetime.utcnow().isoformat(),
            "population_exposure": pop_exp,
            "infrastructure_exposure": infra_exp,
            "estimated_evacuees": int(pop_exp["high_risk_population"] * 0.8),
            "critical_facilities_at_risk": critical_facilities
        }
    
    @staticmethod
    def generate_risk_scores(zone_ids: List[str]) -> List[Dict[str, Any]]:
        """Generate risk scores using composite formula"""
        scores = []
        
        for zone_id in zone_ids:
            # Scores out of 100
            flood_score = random.randint(10, 95)
            pop_score = random.randint(5, 95)
            infra_score = random.randint(5, 90)
            
            # Weighted composite: 0.4 flood + 0.3 pop + 0.3 infra
            overall = (flood_score * 0.4 + pop_score * 0.3 + infra_score * 0.3)
            
            # Determine risk level
            if overall >= 80:
                risk_level = "CRITICAL"
            elif overall >= 60:
                risk_level = "HIGH"
            elif overall >= 40:
                risk_level = "MODERATE"
            else:
                risk_level = "LOW"
            
            score = {
                "zone_id": zone_id,
                "overall_score": round(overall, 1),
                "flood_severity_score": flood_score,
                "population_exposure_score": pop_score,
                "infrastructure_exposure_score": infra_score,
                "risk_level": risk_level,
                "timestamp": datetime.utcnow().isoformat()
            }
            scores.append(score)
        
        return scores
    
    @staticmethod
    def generate_alerts(zone_ids: List[str], risk_scores: List[Dict]) -> List[Dict[str, Any]]:
        """Generate emergency alerts based on risk scores"""
        alerts = []
        alert_id = 0
        
        for score in risk_scores:
            zone_id = score["zone_id"]
            risk_level = score["risk_level"]
            
            # Probability of alert increases with risk
            alert_prob = {
                "LOW": 0.1,
                "MODERATE": 0.4,
                "HIGH": 0.8,
                "CRITICAL": 0.95
            }[risk_level]
            
            if random.random() < alert_prob:
                alert_templates = {
                    "CRITICAL": {
                        "titles": [
                            "CRITICAL FLOOD WARNING",
                            "IMMEDIATE EVACUATION REQUIRED",
                            "EXTREME FLOOD THREAT"
                        ],
                        "messages": [
                            "Severe flooding imminent. Immediate evacuation ordered for residents in zone.",
                            "Critical water level breach detected. Emergency services activated.",
                            "Catastrophic flooding expected within 2 hours. All residents evacuate immediately."
                        ]
                    },
                    "HIGH": {
                        "titles": [
                            "FLOOD WARNING",
                            "PRECAUTIONARY EVACUATION",
                            "HIGH FLOOD THREAT"
                        ],
                        "messages": [
                            "Major flooding likely within 6 hours. Prepare to evacuate.",
                            "Water levels rising rapidly. Evacuation recommended for vulnerable populations.",
                            "Significant flood risk. Follow emergency instructions."
                        ]
                    },
                    "MODERATE": {
                        "titles": [
                            "FLOOD WATCH",
                            "FLOOD ADVISORY",
                            "MODERATE FLOOD THREAT"
                        ],
                        "messages": [
                            "Moderate flooding possible. Monitor weather conditions.",
                            "Elevated flood risk. Prepare for potential evacuation.",
                            "Significant rainfall expected. Stay alert for updates."
                        ]
                    },
                    "LOW": {
                        "titles": [
                            "FLOOD ADVISORY",
                            "MINOR FLOOD THREAT"
                        ],
                        "messages": [
                            "Minor flooding possible. Stay informed.",
                            "Low flood risk but conditions developing. Check updates."
                        ]
                    }
                }
                
                template = alert_templates[risk_level]
                affected_pop = int(random.randint(100, 100000) * (1 if risk_level == "CRITICAL" else 0.5))
                
                alert = {
                    "id": f"ALERT_{alert_id:04d}",
                    "zone_id": zone_id,
                    "alert_type": "warning" if risk_level == "LOW" else "danger" if risk_level in ["MODERATE", "HIGH"] else "critical",
                    "title": random.choice(template["titles"]),
                    "message": random.choice(template["messages"]),
                    "risk_level": risk_level,
                    "affected_population": affected_pop,
                    "timestamp": (datetime.utcnow() - timedelta(minutes=random.randint(0, 120))).isoformat(),
                    "active": True
                }
                alerts.append(alert)
                alert_id += 1
        
        return alerts
    
    @staticmethod
    def generate_scenario_simulation(rainfall_multiplier: float = 1.5) -> Dict[str, Any]:
        """Generate scenario simulation results"""
        base_zones = MockDataGenerator.generate_flood_zones(12)
        
        # Apply multiplier effect
        simulated_zones = []
        total_affected = 0
        critical_alerts = 0
        
        for zone in base_zones:
            severity_multiplier = rainfall_multiplier
            
            # Escalate severity based on multiplier
            if severity_multiplier > 2.0 and zone["severity"] in ["MODERATE", "LOW"]:
                zone["severity"] = "HIGH"
            elif severity_multiplier > 2.5 and zone["severity"] == "HIGH":
                zone["severity"] = "CRITICAL"
            
            # Increase affected area and depth
            zone["flood_depth_meters"] *= severity_multiplier
            zone["affected_area_sqkm"] *= severity_multiplier
            
            pop_exp = MockDataGenerator.generate_population_exposure(zone["id"], zone["severity"])
            total_affected += pop_exp["affected_population"]
            
            if zone["severity"] == "CRITICAL":
                critical_alerts += 1
            
            simulated_zones.append(zone)
        
        return {
            "scenario_id": f"SIM_{int(datetime.utcnow().timestamp())}",
            "scenario_name": f"Rainfall x{rainfall_multiplier} Scenario",
            "rainfall_multiplier": rainfall_multiplier,
            "projected_flood_zones": simulated_zones,
            "affected_population_total": total_affected,
            "critical_alerts_count": critical_alerts,
            "timestamp": datetime.utcnow().isoformat()
        }


def generate_all_mock_data():
    """Generate complete mock dataset"""
    gen = MockDataGenerator()
    
    zones = gen.generate_flood_zones(12)
    zone_ids = [z["id"] for z in zones]
    
    rainfall = gen.generate_rainfall_data(15)
    
    impacts = [gen.generate_emergency_impact(zid, next(z["severity"] for z in zones if z["id"] == zid)) for zid in zone_ids]
    
    scores = gen.generate_risk_scores(zone_ids)
    
    alerts = gen.generate_alerts(zone_ids, scores)
    
    return {
        "flood_zones": zones,
        "rainfall": rainfall,
        "emergency_impacts": impacts,
        "risk_scores": scores,
        "alerts": alerts,
        "generated_at": datetime.utcnow().isoformat()
    }


if __name__ == "__main__":
    # Generate and save mock data for testing
    data = generate_all_mock_data()
    with open("mock_data_sample.json", "w") as f:
        json.dump(data, f, indent=2)
    print("Mock data generated: mock_data_sample.json")
