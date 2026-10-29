#!/usr/bin/env python3
"""Convert feet-denominated 2013–2014 elevation_gain values to metres.

The COROS gateway returned elevation in FEET for the 2013–2014 era and in
metres from 2015 onwards.  Feet-as-metres is physically impossible for road
cycling: the era's raw elevation/distance ratios cluster at 30–75 m/km
(median 37.7–44.4), while any road ride tops out around 15 m/km.  After the
0.3048 conversion every ratio lands in a plausible 3–14 m/km band.

The era is NOT uniformly feet (same day 2013-04-13 holds a feet-like 2567
for 39.8 km next to a metres-like 23 for 4.2 km, plus a few broken values
in either unit), so a blunt per-year conversion would corrupt good rows.
Instead the rule is surgical: convert only 2013–2014 rows whose raw ratio
exceeds --ratio (25 m/km default) — clearly-feet records by construction.
The 2013–2014 rows below the threshold are either metres-like already or
broken beyond rescue; the largest of them is el=141, far below the era's
PB, so they never surface in record cards.

Fixes both src/static/activities.json (what the frontend reads) and
run_page/data.db (what CI regenerates activities.json from on every sync),
so the fix survives full rebuilds: sync_from_data_dir upserts only tracks
from freshly downloaded FIT files and never wipes existing rows, and the
processed-FIT manifest + --purge-fit ensure old-era FITs are never
re-downloaded and re-upserted with raw feet values.

Usage:
    python run_page/fix_elevation_units.py                 # dry run
    python run_page/fix_elevation_units.py --execute      # write both files
"""

import argparse
import json
import sqlite3
import sys

FT_TO_M = 0.3048


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", default="src/static/activities.json")
    parser.add_argument("--db", default="run_page/data.db")
    parser.add_argument(
        "--ratio",
        type=float,
        default=25.0,
        help="convert rows whose raw elevation/distance ratio exceeds this "
        "m/km threshold (default 25)",
    )
    parser.add_argument(
        "--years",
        default="2013,2014",
        help="comma-separated years the rule applies to (default 2013,2014)",
    )
    parser.add_argument(
        "--execute", action="store_true", help="write changes (default: dry run)"
    )
    args = parser.parse_args()

    years = {y.strip() for y in args.years.split(",")}

    with open(args.json) as f:
        activities = json.load(f)

    targets = []
    for a in activities:
        el = a.get("elevation_gain")
        dist = a.get("distance")
        if not el or not dist or a.get("start_date_local", "")[:4] not in years:
            continue
        ratio = el / dist * 1000
        if ratio > args.ratio:
            targets.append((a, ratio))

    if not targets:
        print("Nothing to convert.")
        return 0

    print(
        f"{'date':<12}{'dist km':>9}{'el raw':>10}{'ratio m/km':>12}" f"{'el as m':>10}"
    )
    for a, ratio in sorted(targets, key=lambda x: x[0]["start_date_local"]):
        el = a["elevation_gain"]
        print(
            f"{a['start_date_local'][:10]:<12}{a['distance']/1000:9.1f}"
            f"{el:10.0f}{ratio:12.1f}{el*FT_TO_M:10.1f}"
        )
    print(
        f"\n{len(targets)} row(s) matched (years {sorted(years)}, "
        f"ratio > {args.ratio} m/km)"
    )

    if not args.execute:
        print("Dry run; pass --execute to write changes.")
        return 0

    # --- JSON (frontend source of truth) ---
    run_ids = set()
    for a, _ in targets:
        a["elevation_gain"] = round(a["elevation_gain"] * FT_TO_M, 1)
        run_ids.add(int(a["run_id"]))
    with open(args.json, "w") as f:
        json.dump(activities, f)
    print(f"JSON: {len(run_ids)} row(s) converted")

    # --- DB (CI regenerates the JSON from here on every sync) ---
    con = sqlite3.connect(args.db)
    cur = con.cursor()
    n = cur.execute(
        "SELECT COUNT(*) FROM activities WHERE run_id IN "
        f"({','.join('?' * len(run_ids))})",
        tuple(run_ids),
    ).fetchone()[0]
    for rid in run_ids:
        cur.execute(
            "UPDATE activities SET elevation_gain = elevation_gain * ? "
            "WHERE run_id = ?",
            (FT_TO_M, rid),
        )
    con.commit()
    con.close()
    print(f"DB: {n} matched, {len(run_ids)} row(s) converted")

    # Sanity: new era-wide PB candidate.
    mx = max(
        activities,
        key=lambda a: a.get("elevation_gain") or 0,
        default=None,
    )
    if mx:
        print(
            f"\nNew dataset-wide max elevation: {mx['elevation_gain']:.1f} m "
            f"on {mx['start_date_local'][:10]} "
            f"({mx['distance']/1000:.1f} km)"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
