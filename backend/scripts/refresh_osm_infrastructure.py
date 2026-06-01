"""
Refresh region infrastructure counts from OpenStreetMap Overpass.

Features:
- Resumable: Tracks progress across runs and resumes from last successful city
- Local cache: Caches OSM responses to avoid redundant queries
- Rate-limit aware: Respects Overpass API rate limits (429 errors)
- Adaptive backoff: Increases wait time if rate limited (exponential backoff)
- Skip populated: Skips already processed regions unless --force-refresh
- Progress tracking: Saves progress to file after each city
- Production-ready: Safe for long-running collection jobs

Usage:
    python refresh_osm_infrastructure.py                    # Resume from last progress
    python refresh_osm_infrastructure.py --force-refresh    # Refresh all cities
    python refresh_osm_infrastructure.py --max-requests 10  # Limit requests per run
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[2]

REGIONS_FILE = ROOT / "backend" / "data" / "regions.json"
CACHE_FILE = ROOT / "backend" / "data" / "osm_infrastructure_cache.json"
PROGRESS_FILE = ROOT / "backend" / "data" / ".osm_refresh_progress.json"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

RADIUS_METERS = 25000
INITIAL_DELAY_SECONDS = 1.5
MAX_RETRIES = 3
RATE_LIMIT_BACKOFF_MULTIPLIER = 2.0  # Exponential backoff on rate limits
MAX_BACKOFF_SECONDS = 120  # Cap on backoff time


def load_progress() -> dict[str, Any]:
    """Load progress tracking file."""
    if PROGRESS_FILE.exists():
        try:
            return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_progress(progress: dict[str, Any]) -> None:
    """Save progress tracking file."""
    PROGRESS_FILE.write_text(
        json.dumps(progress, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_cache(cache: dict) -> None:
    CACHE_FILE.write_text(
        json.dumps(cache, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def count_total(tags: dict[str, str]) -> int:
    return sum(
        int(tags.get(key, 0))
        for key in ("nodes", "ways", "relations")
    )


def overpass(query: str, delay_seconds: float = INITIAL_DELAY_SECONDS) -> dict[str, Any]:
    """Query Overpass API with rate-limit handling and adaptive backoff."""

    last_error = None
    current_delay = delay_seconds

    for attempt in range(MAX_RETRIES):

        try:
            response = requests.get(
                OVERPASS_URL,
                params={"data": query},
                headers={
                    "User-Agent": "FloodExposureIntelligenceBoard/1.0"
                },
                timeout=180,
            )

            # Handle rate limiting
            if response.status_code == 429:
                retry_after = int(response.headers.get("Retry-After", current_delay))
                print(
                    f"  rate limited, waiting {retry_after}s before retry {attempt + 1}/{MAX_RETRIES}",
                    flush=True,
                )
                time.sleep(retry_after)
                # Exponential backoff for next attempt
                current_delay = min(
                    current_delay * RATE_LIMIT_BACKOFF_MULTIPLIER,
                    MAX_BACKOFF_SECONDS
                )
                continue

            response.raise_for_status()
            return response.json()

        except Exception as exc:
            last_error = exc
            print(
                f"  retry {attempt + 1}/{MAX_RETRIES}: {exc}",
                flush=True,
            )
            time.sleep(5)

    raise last_error


def infrastructure_for(region: dict[str, Any]) -> dict[str, Any]:

    lat = float(region["latitude"])
    lon = float(region["longitude"])

    query = f"""
    [out:json][timeout:180];

    (
      node(around:{RADIUS_METERS},{lat},{lon})[amenity~"^(hospital|clinic)$"];
      way(around:{RADIUS_METERS},{lat},{lon})[amenity~"^(hospital|clinic)$"];
      relation(around:{RADIUS_METERS},{lat},{lon})[amenity~"^(hospital|clinic)$"];
    );
    out count;

    (
      node(around:{RADIUS_METERS},{lat},{lon})[amenity~"^(school|college|university)$"];
      way(around:{RADIUS_METERS},{lat},{lon})[amenity~"^(school|college|university)$"];
      relation(around:{RADIUS_METERS},{lat},{lon})[amenity~"^(school|college|university)$"];
    );
    out count;

    (
      node(around:{RADIUS_METERS},{lat},{lon})[power~"^(substation|plant|generator)$"];
      way(around:{RADIUS_METERS},{lat},{lon})[power~"^(substation|plant|generator)$"];
      relation(around:{RADIUS_METERS},{lat},{lon})[power~"^(substation|plant|generator)$"];
    );
    out count;

    (
      node(around:{RADIUS_METERS},{lat},{lon})[amenity~"^(fire_station|police|rescue_station|shelter|townhall)$"];
      way(around:{RADIUS_METERS},{lat},{lon})[amenity~"^(fire_station|police|rescue_station|shelter|townhall)$"];
      relation(around:{RADIUS_METERS},{lat},{lon})[amenity~"^(fire_station|police|rescue_station|shelter|townhall)$"];
    );
    out count;

    way(around:{RADIUS_METERS},{lat},{lon})
      [highway]
      [highway!~"^(footway|path|cycleway|steps|pedestrian|track|service|corridor|elevator|escalator)$"];

    make stat road_m=sum(length());

    out;
    """

    payload = overpass(query)

    elements = payload.get("elements", [])

    counts = [
        count_total(item.get("tags", {}))
        for item in elements[:4]
    ]

    road_m = 0

    if len(elements) > 4:
        road_m = float(
            elements[4]
            .get("tags", {})
            .get("road_m", 0)
            or 0
        )

    return {
        "schools": counts[1] if len(counts) > 1 else 0,
        "hospitals": counts[0] if len(counts) > 0 else 0,
        "road_km": round(road_m / 1000, 1),
        "power_assets": counts[2] if len(counts) > 2 else 0,
        "critical_facilities": counts[3] if len(counts) > 3 else 0,
    }


def valid(region: dict) -> bool:

    infrastructure = region.get("infrastructure")

    if not infrastructure:
        return False

    required = [
        "schools",
        "hospitals",
        "road_km",
        "power_assets",
        "critical_facilities",
    ]

    return all(
        key in infrastructure
        for key in required
    )


def main() -> None:

    # Parse command-line arguments
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Refresh all cities (ignore existing data)",
    )
    parser.add_argument(
        "--max-requests",
        type=int,
        default=None,
        help="Maximum number of new requests to make in this run",
    )
    parser.add_argument(
        "--radius",
        type=int,
        default=RADIUS_METERS,
        help=f"Search radius in meters (default: {RADIUS_METERS})",
    )
    args = parser.parse_args()

    data = json.loads(
        REGIONS_FILE.read_text(encoding="utf-8")
    )

    cache = load_cache()
    progress = load_progress()

    data["_metadata"]["infrastructure_source"] = (
        "OpenStreetMap Overpass API"
    )

    data["_metadata"]["infrastructure_radius_m"] = (
        args.radius
    )

    data["_metadata"]["infrastructure_method"] = (
        f"OpenStreetMap Overpass counts within "
        f"{args.radius // 1000} km."
    )

    regions = data.get("regions", [])
    total = len(regions)

    # Determine starting index
    last_processed = progress.get("last_processed_index", -1)
    start_index = last_processed + 1 if not args.force_refresh else 0

    requests_made = 0

    print(f"\nProcessing {total} regions")
    print(f"Starting from index {start_index}")
    if args.max_requests:
        print(f"Max requests per run: {args.max_requests}")
    print(f"Radius: {args.radius}m\n")

    for index, region in enumerate(regions):

        # Skip already processed regions
        if index < start_index and not args.force_refresh:
            continue

        city = region.get("city", "Unknown")
        cache_key = (
            f"{city}|"
            f"{region.get('country','')}"
        )

        print(
            f"[{index + 1}/{total}] {city}",
            flush=True,
        )

        # Check if region is already valid
        if (
            not args.force_refresh
            and valid(region)
        ):
            print("  already processed")
            # Update progress
            progress["last_processed_index"] = index
            progress["last_processed_city"] = city
            progress["last_update"] = datetime.now().isoformat()
            save_progress(progress)
            continue

        # Check if we've hit max requests limit
        if args.max_requests and requests_made >= args.max_requests:
            print(f"\nReached max requests ({args.max_requests}). Stopping.")
            break

        try:

            # Try to load from cache first
            if (
                not args.force_refresh
                and cache_key in cache
            ):

                infrastructure = cache[cache_key]
                print("  loaded from cache")

            else:

                # Make new request
                infrastructure = infrastructure_for(
                    region
                )
                cache[cache_key] = infrastructure
                save_cache(cache)
                requests_made += 1

                print("  downloaded from OSM")

            region["infrastructure"] = infrastructure
            region["infrastructure_source"] = {
                "provider": "OpenStreetMap Overpass API",
                "radius_m": args.radius,
                "last_updated": datetime.now().isoformat(),
            }

            # Save regions file after each city
            REGIONS_FILE.write_text(
                json.dumps(
                    data,
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )

            # Save progress
            progress["last_processed_index"] = index
            progress["last_processed_city"] = city
            progress["last_update"] = datetime.now().isoformat()
            progress["total_requests_made"] = requests_made
            save_progress(progress)

            print(
                f"  hospitals={infrastructure['hospitals']} "
                f"schools={infrastructure['schools']} "
                f"roads={infrastructure['road_km']}km "
                f"power={infrastructure['power_assets']} "
                f"critical={infrastructure['critical_facilities']}"
            )

        except Exception as exc:

            print(
                f"  failed: {exc}",
                flush=True,
            )

            # Log error but continue
            progress["last_error"] = str(exc)
            save_progress(progress)

        # Rate limiting delay
        time.sleep(
            INITIAL_DELAY_SECONDS
        )

    # Final save
    REGIONS_FILE.write_text(
        json.dumps(
            data,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print("\nFinished.\n")


if __name__ == "__main__":
    main()