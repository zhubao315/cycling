#!/usr/bin/env python3
"""Remove GPS-drift clusters from specific activities (allowlist-based).

Some imported (e.g. codoon) activities contain a cluster of track points
many kilometres away from the real route — a GPS glitch that renders as a
long teleport line on the map.

This script is deliberately TARGETED: it only touches activities whose
run_id is listed via --run-id (repeatable / comma separated).  For each
listed activity the track is split into clusters chained by hops of at most
--threshold metres; the largest cluster is kept and smaller detached
clusters are dropped.  Activities not on the allowlist are never modified,
and an allowlisted track that is fully connected is left untouched, so the
script is safe to run on every sync.

Fixes both src/static/activities.json and run_page/data.db so the frontend
map and the DB-derived charts/parquet stay consistent.

Usage:
    python run_page/fix_gps_drift.py --json src/static/activities.json \
        --db run_page/data.db \
        --run-id 9223370427974524707 [--threshold 3000] [--dry-run]
"""

import argparse
import json
import math
import sqlite3
import sys

import polyline


def _dist_km(a, b):
    """Haversine distance in km."""
    lat1, lon1 = a
    lat2, lon2 = b
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return 6371.0088 * 2 * math.asin(min(1.0, math.sqrt(h)))


def drop_drift_clusters(points, threshold_km):
    """Return (filtered_points, n_dropped).

    Points are chained in track order: consecutive points within
    threshold_km belong to the same cluster.  A GPS glitch manifests as a
    contiguous run of points whose entry/exit hops exceed the threshold, so
    it forms its own component which is dropped.  Only components strictly
    smaller than the largest one are dropped.
    """
    n = len(points)
    if n < 3:
        return points, 0

    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for i in range(n - 1):
        if _dist_km(points[i], points[i + 1]) <= threshold_km:
            union(i, i + 1)

    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    if len(groups) <= 1:
        return points, 0

    largest = max(groups.values(), key=len)
    keep = sorted(largest)
    dropped = n - len(keep)
    if dropped >= len(keep):
        # Refuse to mangle a track that splits into comparable halves.
        print("    !! multiple large clusters, refusing to drop (keep as-is)")
        return points, 0
    return [points[i] for i in keep], dropped


def fix_polyline(poly_str, threshold_km):
    if not poly_str:
        return poly_str, 0
    try:
        pts = polyline.decode(poly_str)
    except Exception:
        return poly_str, 0
    filtered, dropped = drop_drift_clusters(pts, threshold_km)
    if not dropped:
        return poly_str, 0
    if not filtered:
        return poly_str, dropped
    return polyline.encode(filtered, 5), dropped


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", default="src/static/activities.json")
    parser.add_argument("--db", default="run_page/data.db")
    parser.add_argument(
        "--run-id",
        action="append",
        default=[],
        help="run_id(s) to clean; repeat flag or pass a comma-separated list",
    )
    parser.add_argument("--threshold", type=int, default=3000, help="metres")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    run_ids = set()
    for item in args.run_id:
        for part in item.split(","):
            part = part.strip()
            if part:
                run_ids.add(int(part))
    if not run_ids:
        print("No --run-id given; nothing to do.")
        return 0
    threshold_km = args.threshold / 1000.0

    # --- JSON ---
    with open(args.json) as f:
        activities = json.load(f)
    json_changed = 0
    for a in activities:
        rid = int(a.get("run_id"))
        if rid not in run_ids:
            continue
        old = a.get("summary_polyline")
        new, dropped = fix_polyline(old, threshold_km)
        if dropped:
            print(
                f"  drift: run_id={rid} {a.get('start_date_local','')} "
                f"{a.get('name','')!r}: drop {dropped} point(s)"
            )
            if not args.dry_run:
                a["summary_polyline"] = new
            json_changed += 1
    if not args.dry_run and json_changed:
        with open(args.json, "w") as f:
            json.dump(activities, f)
    print(f"JSON: {json_changed} activity(ies) cleaned")

    # --- DB ---
    try:
        con = sqlite3.connect(args.db)
        cur = con.cursor()
        db_changed = 0
        for rid in run_ids:
            row = cur.execute(
                "SELECT summary_polyline FROM activities WHERE run_id = ?",
                (rid,),
            ).fetchone()
            if not row:
                print(f"  drift: db run_id={rid}: not found")
                continue
            new, dropped = fix_polyline(row[0], threshold_km)
            if dropped:
                print(f"  drift: db run_id={rid}: drop {dropped} point(s)")
                if not args.dry_run:
                    cur.execute(
                        "UPDATE activities SET summary_polyline = ? WHERE run_id = ?",
                        (new, rid),
                    )
                db_changed += 1
        if not args.dry_run:
            con.commit()
        con.close()
        print(f"DB: {db_changed} row(s) cleaned")
    except Exception as exc:
        print(f"DB update skipped/failed: {exc}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
