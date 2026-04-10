"""Script semplice per rigenerare lo snapshot locale.

In questa versione demo riscrive un file già coerente partendo dal JSON incluso.
Può essere esteso per leggere una API pubblica NBA e salvare un nuovo snapshot.
"""

from __future__ import annotations

import json
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "backend" / "src" / "data" / "nbaData.json"
OUTPUT = ROOT / "docs" / "snapshot_summary.json"


def main() -> None:
    data = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    summary = {
        "project": data["meta"]["project"],
        "teams": len(data["teams"]),
        "players": len(data["players"]),
        "games": len(data["games"]),
        "average_points_per_game": round(mean(item["pointsPerGame"] for item in data["teamStats"]), 1),
        "average_recent_form": round(mean(item["recentForm"] for item in data["teamStats"]), 2),
    }
    OUTPUT.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print("Riepilogo snapshot aggiornato in", OUTPUT)


if __name__ == "__main__":
    main()
