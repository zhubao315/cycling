"""Sync elevation_gain from activities.json into run_page/data.db.

The sync job rebuilds activities.json from this DB, so elevation backfilled
from terrain must live in both places.
"""

import json, sqlite3, sys
from pathlib import Path

root = Path(sys.argv[1])
acts = json.loads((root / "src/static/activities.json").read_text())
db = sqlite3.connect(root / "run_page/data.db")
cols = [r[1] for r in db.execute("PRAGMA table_info(activities)")]
if "elevation_gain" not in cols:
    db.execute("ALTER TABLE activities ADD COLUMN elevation_gain FLOAT")
    print("added elevation_gain column")
rows = [
    (float(a["elevation_gain"]), int(a["run_id"]))
    for a in acts
    if a.get("elevation_gain") not in (None, 0) and a.get("run_id") is not None
]
db.executemany("UPDATE activities SET elevation_gain=? WHERE run_id=?", rows)
db.commit()
updated = db.execute(
    "SELECT COUNT(*) FROM activities WHERE elevation_gain > 0"
).fetchone()[0]
total = db.execute("SELECT COUNT(*) FROM activities").fetchone()[0]
print(f"{root.name}: elevation_gain set on {updated}/{total} rows")
