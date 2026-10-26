#!/usr/bin/env python3
"""One-off bulk FIT backfill through the legacy COROS web API.

The official MCP gateway caps FIT downloads at 50 per day, which is fine for
daily updates but too slow to seed years of history. This helper logs into the
legacy teamcnapi endpoint, downloads FIT files in batches, parses each batch
into data.db / activities.json and then deletes the FITs, so a 2,600-ride
history stays small in git.

Daily syncing still uses `coros_mcp_sync.py`; this script is only for the
initial backfill (or a later repair).

Usage:
    SKIP_GEOCODE=1 python run_page/coros_legacy_backfill.py \
        --records /tmp/coros_all_records.json \
        --sport cycling --min-distance-km 3 --workers 6 --batch-size 100
"""

import argparse
import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import FIT_FOLDER, JSON_FILE, SQL_FILE
from coros_mcp_sync import SPORT_TYPES, tidy_generated_json
from utils import make_activities_file

LOGIN_URL = "https://teamcnapi.coros.com/account/login"
DOWNLOAD_URL = "https://teamcnapi.coros.com/activity/detail/download"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


def log(msg):
    print(f"[backfill] {msg}", flush=True)


def login(account, password):
    payload = {
        "account": account,
        "accountType": 2,
        "pwd": hashlib.md5(password.encode()).hexdigest(),
    }
    req = urllib.request.Request(
        LOGIN_URL,
        data=json.dumps(payload).encode(),
        headers={
            "content-type": "application/json;charset=UTF-8",
            "accept": "application/json",
            "origin": "https://t.coros.com",
            "referer": "https://t.coros.com/",
            "user-agent": UA,
        },
    )
    body = json.load(urllib.request.urlopen(req, timeout=30))
    token = body.get("data", {}).get("accessToken")
    if not token:
        raise RuntimeError(f"legacy COROS login failed: {body.get('message')}")
    return {
        "accesstoken": token,
        "cookie": f"CPL-coros-region=2; CPL-coros-token={token}",
        "user-agent": UA,
    }


def download_one(headers, label, sport, retries=3):
    target = os.path.join(FIT_FOLDER, f"{label}.fit")
    if os.path.exists(target) and os.path.getsize(target) > 1024:
        return label, True
    url = f"{DOWNLOAD_URL}?labelId={label}&sportType={sport}&fileType=4"
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, data=b"", headers=headers, method="POST")
            body = json.load(urllib.request.urlopen(req, timeout=60))
            file_url = body.get("data", {}).get("fileUrl")
            if body.get("result") != "0000" or not file_url:
                raise RuntimeError(body.get("message") or "no fileUrl")
            with urllib.request.urlopen(file_url, timeout=180) as resp:
                data = resp.read()
            if len(data) < 1024 or data[:4] in (b"<htm", b"<!DO", b"<?xm"):
                raise RuntimeError("downloaded file is not a FIT")
            with open(target, "wb") as f:
                f.write(data)
            return label, True
        except Exception as exc:  # noqa: BLE001 - retry any transport error
            if attempt == retries:
                return label, f"{type(exc).__name__}: {exc}"
            time.sleep(attempt * 1.5)
    return label, False


def load_done(path):
    try:
        with open(path) as f:
            return set(json.load(f))
    except Exception:
        return set()


def save_done(path, done):
    with open(path, "w") as f:
        json.dump(sorted(done), f)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--records", required=True, help="label -> [sport, km, date]")
    parser.add_argument("--sport", default="cycling", choices=list(SPORT_TYPES))
    parser.add_argument("--min-distance-km", type=float, default=0)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--done-file", default="/tmp/coros_backfill_done.json")
    parser.add_argument("--limit", type=int, default=0, help="debug: cap activities")
    args = parser.parse_args()

    os.environ["SKIP_GEOCODE"] = "1"
    os.environ["SKIP_MERGE"] = "1"
    os.makedirs(FIT_FOLDER, exist_ok=True)

    account = os.getenv("COROS_ACCOUNT")
    password = os.getenv("COROS_PASSWORD")
    if not account or not password:
        parser.error("COROS_ACCOUNT / COROS_PASSWORD env required")

    with open(args.records) as f:
        records = json.load(f)
    codes = set(SPORT_TYPES[args.sport])
    items = [
        (label, int(v[0]), float(v[1]), v[2])
        for label, v in records.items()
        if int(v[0]) in codes and float(v[1]) >= args.min_distance_km
    ]
    items.sort(key=lambda x: x[3])
    if args.limit:
        items = items[: args.limit]
    done = load_done(args.done_file)
    todo = [item for item in items if item[0] not in done]
    log(f"{len(items)} {args.sport} activities, {len(done)} done, {len(todo)} to fetch")

    headers = login(account, password)
    fetched = failed = 0
    total = len(todo)

    for start in range(0, total, args.batch_size):
        batch = todo[start : start + args.batch_size]
        results = []
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {
                pool.submit(download_one, headers, label, sport): (label, sport)
                for label, sport, _, _ in batch
            }
            for future in as_completed(futures):
                label, ok = future.result()
                results.append((label, ok))
                if ok is True:
                    fetched += 1
                else:
                    failed += 1
                    log(f"failed {label}: {ok}")

        ok_labels = [label for label, ok in results if ok is True]
        if ok_labels:
            log(f"parsing batch {start // args.batch_size + 1}: {len(ok_labels)} FITs")
            make_activities_file(SQL_FILE, FIT_FOLDER, JSON_FILE, "fit")
            tidy_generated_json(args.sport)
            for label in ok_labels:
                done.add(label)
            save_done(args.done_file, done)
            for name in os.listdir(FIT_FOLDER):
                if name.endswith(".fit"):
                    os.remove(os.path.join(FIT_FOLDER, name))
        log(
            f"progress {min(start + args.batch_size, total)}/{total} "
            f"(ok {fetched}, failed {failed})"
        )

    log(f"done: {fetched} fetched, {failed} failed, {len(done)} recorded")


if __name__ == "__main__":
    main()
