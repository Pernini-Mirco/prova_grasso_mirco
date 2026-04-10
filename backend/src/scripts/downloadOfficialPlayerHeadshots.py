from __future__ import annotations

import concurrent.futures
import json
import re
from datetime import UTC, datetime
from pathlib import Path

import requests
from nba_api.stats.static import players as nba_players


ROOT = Path(__file__).resolve().parents[3]
ASSETS_DIR = ROOT / "frontend" / "src" / "assets" / "players"
VERIFIED_FILE = ROOT / "backend" / "src" / "data" / "verifiedActivePlayers.json"
HEADSHOT_SIZES = ("1040x760", "260x190")
MIN_VALID_BYTES = 10_000
MAX_WORKERS = 6
TIMEOUT_SECONDS = 45


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def build_headshot_url(player_id: int, size: str) -> str:
    return f"https://cdn.nba.com/headshots/nba/latest/{size}/{player_id}.png"


def fetch_headshot(session: requests.Session, player: dict) -> tuple[dict | None, dict | None]:
    slug = slugify(player["full_name"])
    target = ASSETS_DIR / f"{slug}.png"

    if target.exists() and target.stat().st_size >= MIN_VALID_BYTES:
        return {
            "id": player["id"],
            "fullName": player["full_name"],
            "firstName": player["first_name"],
            "lastName": player["last_name"],
            "slug": slug,
            "imageFile": target.name,
            "imageSource": "official-nba-cdn",
            "imageBytes": target.stat().st_size,
        }, None

    for size in HEADSHOT_SIZES:
        url = build_headshot_url(player["id"], size)
        try:
            response = session.get(url, timeout=TIMEOUT_SECONDS)
        except requests.RequestException as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            continue

        content_type = str(response.headers.get("content-type", ""))
        if response.status_code != 200 or not content_type.startswith("image/"):
            last_error = f"status={response.status_code} content_type={content_type}"
            continue

        if len(response.content) < MIN_VALID_BYTES:
            last_error = f"content_too_small={len(response.content)}"
            continue

        target.write_bytes(response.content)
        return {
            "id": player["id"],
            "fullName": player["full_name"],
            "firstName": player["first_name"],
            "lastName": player["last_name"],
            "slug": slug,
            "imageFile": target.name,
            "imageSource": "official-nba-cdn",
            "imageBytes": len(response.content),
        }, None

    return None, {
        "id": player["id"],
        "fullName": player["full_name"],
        "slug": slug,
        "error": last_error,
    }


def main() -> None:
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    active_players = sorted(
        nba_players.get_active_players(),
        key=lambda item: (item["last_name"].lower(), item["first_name"].lower()),
    )

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "analisi-nba-google/1.0 official-headshots",
            "Accept": "image/png,image/*;q=0.8,*/*;q=0.5",
        }
    )

    verified_players: list[dict] = []
    failures: list[dict] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(fetch_headshot, session, player) for player in active_players]
        for future in concurrent.futures.as_completed(futures):
            record, error = future.result()
            if record:
                verified_players.append(record)
            elif error:
                failures.append(error)

    verified_players.sort(key=lambda item: item["fullName"].lower())
    failures.sort(key=lambda item: item["fullName"].lower())

    VERIFIED_FILE.write_text(
        json.dumps(
            {
                "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                "source": "official-nba-cdn",
                "players": verified_players,
                "failures": failures,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(
        f"Downloaded {len(verified_players)} official headshots out of {len(active_players)} active players."
    )
    if failures:
        print(f"Missing official headshots: {len(failures)}")
        for item in failures[:25]:
            print(f"- {item['fullName']}: {item['error']}")


if __name__ == "__main__":
    main()
