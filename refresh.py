#!/usr/bin/env python3
"""
refresh.py — pull SBP EasyData series and emit tidy data.json for the template.

Pipeline:  refresh.py  ->  data.<name>.json  ->  build.py  ->  dashboard.html

WHAT THIS DOES
  1. Reads a per-dataset "series map" (which EasyData codes map to which
     dashboard path / unit / stock-or-flow).
  2. Calls the EasyData API for each code over a date range.
  3. Normalizes every observation into the tidy row schema:
        {period, path[], value, unit, flow}
  4. Writes data.<name>.json, ready for build.py.

SECURITY
  The API key is NEVER stored in this file or the series map. It is read from
  the EASYDATA_API_KEY environment variable:
        export EASYDATA_API_KEY="your-key"        (mac/linux)
        setx  EASYDATA_API_KEY "your-key"         (windows, new shell after)
  In GitHub Actions, store it as a repository Secret named EASYDATA_API_KEY.

USAGE
  export EASYDATA_API_KEY="..."
  python3 refresh.py --map series_map.sme.json --start 2016-06 --out data.sme.json

NOTE ON THE API SHAPE
  The exact EasyData request URL + response columns are confirmed against your
  live account on first run. This script isolates that in fetch_series() and
  parse_response() — the two functions you verify/tweak once. Everything else
  (mapping -> tidy) is stable and dataset-agnostic.
"""
import argparse, json, os, sys, io, datetime, time, urllib.request, urllib.parse, urllib.error

API_BASE = os.environ.get("EASYDATA_API_URL", "https://easydata.sbp.org.pk/api/v1")
API_KEY  = os.environ.get("EASYDATA_API_KEY", "")

# --- rate-limit / resilience settings (EasyData: 2,000/day, 250/hour) ---
THROTTLE_SEC   = float(os.environ.get("EASYDATA_THROTTLE", "0.5"))  # pause between calls -> ~120/min max, safely under 250/hr over a run
MAX_RETRIES    = int(os.environ.get("EASYDATA_RETRIES", "5"))       # retries on 429 / transient errors
BACKOFF_BASE   = float(os.environ.get("EASYDATA_BACKOFF", "5"))     # seconds; grows 5,10,20,40,80 (capped)
BACKOFF_CAP    = 120.0

# ---------------------------------------------------------------------------
# LAYER 1 — talk to EasyData.  Matches the official API contract:
#   GET https://easydata.sbp.org.pk/api/v1/series/{series_key}/data?api_key=..&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&format=json
#   Response JSON: {"columns":[...], "rows":[[...], ...]}
#   with columns incl. "Observation Date", "Observation Value", "Unit".
#   Auth is the ?api_key= query param (NOT a header). Default format is json.
#   Rate limits: 2,000/day, 250/hour. Key expires every 90 days.
# ---------------------------------------------------------------------------
def fetch_series(code, start, end):
    """Fetch one series as JSON; return (columns, rows).
    Handles rate limits and transient failures:
      - 401/403  -> auth failure: exit loudly (key likely expired — regenerate it)
      - 429      -> rate limited: wait (honoring Retry-After if given) and retry with backoff
      - 5xx/network -> transient: retry with backoff
    A small throttle between calls keeps a full run under the hourly cap."""
    if not API_KEY:
        sys.exit("EASYDATA_API_KEY not set. Set it as an env var / GitHub Secret first.")
    # Only send date params that actually have a value. Sending start_date= and
    # end_date= as EMPTY strings is not the same as omitting them, and the API
    # may reject the empty form with a 400.
    q = {"api_key": API_KEY, "format": "json"}
    if start: q["start_date"] = start
    if end:   q["end_date"] = end
    params = urllib.parse.urlencode(q)
    url = f"{API_BASE}/series/{urllib.parse.quote(code, safe='._-')}/data?{params}"

    attempt = 0
    while True:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                payload = json.loads(r.read().decode("utf-8", errors="replace"))
            if THROTTLE_SEC: time.sleep(THROTTLE_SEC)     # pace the next call
            return payload.get("columns", []), payload.get("rows", [])
        except urllib.error.HTTPError as e:
            # Auth failure: no point retrying — the key is bad/expired.
            if e.code in (401, 403):
                sys.exit(f"AUTH FAILED (HTTP {e.code}) for {code}. Your EASYDATA_API_KEY is "
                         f"invalid or expired (keys expire every 90 days). Regenerate it on "
                         f"EasyData and update the env var / GitHub Secret, then re-run.")
            # Rate limited: honor Retry-After header if present, else backoff.
            if e.code == 429:
                attempt += 1
                if attempt > MAX_RETRIES:
                    sys.exit(f"Rate limited (429) on {code} after {MAX_RETRIES} retries. "
                             f"Try again later or raise EASYDATA_THROTTLE.")
                ra = e.headers.get("Retry-After")
                wait = float(ra) if (ra and ra.isdigit()) else min(BACKOFF_CAP, BACKOFF_BASE*(2**(attempt-1)))
                print(f"  … 429 rate-limited on {code}; waiting {wait:.0f}s (retry {attempt}/{MAX_RETRIES})")
                time.sleep(wait); continue
            # Other server errors: retry a few times.
            if 500 <= e.code < 600:
                attempt += 1
                if attempt > MAX_RETRIES:
                    sys.exit(f"HTTP {e.code} on {code} after {MAX_RETRIES} retries: {e.read().decode('utf-8','replace')[:200]}")
                wait = min(BACKOFF_CAP, BACKOFF_BASE*(2**(attempt-1)))
                print(f"  … HTTP {e.code} on {code}; retrying in {wait:.0f}s ({attempt}/{MAX_RETRIES})")
                time.sleep(wait); continue
            # Anything else (e.g. 400 bad code): fail with detail.
            sys.exit(f"HTTP {e.code} for {code}: {e.read().decode('utf-8','replace')[:300]}")
        except urllib.error.URLError as e:
            attempt += 1
            if attempt > MAX_RETRIES:
                sys.exit(f"Network error on {code} after {MAX_RETRIES} retries: {e}")
            wait = min(BACKOFF_CAP, BACKOFF_BASE*(2**(attempt-1)))
            print(f"  … network error on {code}; retrying in {wait:.0f}s ({attempt}/{MAX_RETRIES})")
            time.sleep(wait); continue

def parse_response(columns, rows):
    """
    Map EasyData JSON rows -> [(period, value, unit_from_api), ...].
    Columns are named; we locate them by the documented labels.
    """
    def idx(*names):
        for i, c in enumerate(columns):
            cl = str(c).strip().lower()
            if any(n in cl for n in names): return i
        return None
    di = idx("observation date", "date")
    vi = idx("observation value", "value")
    ui = idx("unit")
    out = []
    for r in rows:
        if di is None or vi is None or len(r) <= max(di, vi): continue
        praw = str(r[di]).strip()
        vraw = str(r[vi]).strip().replace(",", "")
        if not praw or vraw in ("", "-", "NA", "N/A", "None"): continue
        try: v = float(vraw)
        except ValueError: continue
        unit = str(r[ui]).strip() if (ui is not None and len(r) > ui) else ""
        out.append((normalize_period(praw), v, unit))
    return [(p, v, u) for p, v, u in out if p]

def normalize_period(praw):
    """
    Normalize EasyData date strings to the tidy period format:
      monthly  -> YYYY-MM      quarterly -> YYYY-Qn      annual -> YYYY
    Handles a few common inputs; extend if your series use another format.
    """
    praw = praw.strip()
    # ISO date 2026-06-30 or 2026-06-01
    for fmt in ("%Y-%m-%d", "%d-%b-%Y", "%d/%m/%Y", "%b-%Y", "%Y-%m"):
        try:
            d = datetime.datetime.strptime(praw, fmt)
            return f"{d.year}-{d.month:02d}"
        except ValueError:
            pass
    # quarterly "2026Q2" / "2026-Q2"
    import re
    m = re.match(r"(\d{4})[-\s]?Q([1-4])", praw, re.I)
    if m: return f"{m.group(1)}-Q{m.group(2)}"
    # bare year
    if re.fullmatch(r"\d{4}", praw): return praw
    return ""   # unknown -> dropped (and reported)

# ---------------------------------------------------------------------------
# LAYER 2 — mapping -> tidy.  Stable; no need to touch per dataset.
# ---------------------------------------------------------------------------
def build_tidy(series_map, start, end):
    """
    series_map: {
      "dataset": "...",
      "series": [
        {"code":"TS_...","path":["Group","Series"],"unit":"pkr_bn","flow":false},
        ...
      ]
    }
    Unit comes from the config mapping (drives axis/format); the API's own Unit
    string is captured too and reported if it looks inconsistent.
    """
    rows, report = [], []
    for s in series_map["series"]:
        cols, raw = fetch_series(s["code"], start, end)
        obs = parse_response(cols, raw)
        api_units = {u for _,_,u in obs if u}
        report.append((s["code"], len(obs), api_units))
        for period, value, _unit in obs:
            rows.append({"period":period, "path":s["path"], "value":value,
                         "unit":s["unit"], "flow":bool(s.get("flow", False))})
    return rows, report

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--map", help="series_map.<name>.json")
    ap.add_argument("--start", default="2000-01", help="YYYY-MM or YYYY-MM-DD")
    ap.add_argument("--end", default=datetime.date.today().strftime("%Y-%m"), help="YYYY-MM or YYYY-MM-DD")
    ap.add_argument("--out", default="data.json")
    ap.add_argument("--healthcheck", metavar="SERIES_CODE",
                    help="Verify the API key with a single cheap call to this series code, then exit. "
                         "Exit 0 if OK; non-zero (with a clear message) if the key is invalid/expired. "
                         "Used by the daily key-health workflow.")
    a = ap.parse_args()

    # --- key health check: one call, recent obs only, report and exit ---
    if a.healthcheck:
        # Use an EXPLICIT recent window rather than relying on the API's
        # "omit both dates -> return only the latest observation" behaviour.
        # That behaviour is documented but was never verified against the live
        # API; if it turns out the API requires dates, an unqualified call
        # would 400 and this check would open a false "your key is expired"
        # GitHub Issue every single day. A dated call is the form we know works.
        # 150 days comfortably spans one monthly release plus publication lag.
        _today = datetime.date.today()
        _hc_start = (_today - datetime.timedelta(days=150)).strftime("%Y-%m-%d")
        _hc_end   = _today.strftime("%Y-%m-%d")
        cols, raw = fetch_series(a.healthcheck, _hc_start, _hc_end)  # exits loudly on 401/403
        obs = parse_response(cols, raw)
        if obs:
            # The API returns rows newest-first, so obs[-1] is the OLDEST row,
            # not the latest — pick by period instead of by position.
            latest = max(obs, key=lambda o: o[0])
            print(f"OK: key valid. {a.healthcheck} returned latest {latest[0]} = {latest[1]} {latest[2]}".strip())
            sys.exit(0)
        # 200 but empty is odd but not an auth failure — warn, don't hard-fail the check
        print(f"WARNING: key accepted but {a.healthcheck} returned no observations.")
        sys.exit(0)

    if not a.map:
        sys.exit("Provide --map for a refresh, or --healthcheck <code> for a key check.")

    # API wants ISO YYYY-MM-DD; accept YYYY-MM and pad
    def iso(d, is_end):
        d = d.strip()
        if len(d) == 7:  # YYYY-MM
            if is_end:
                import calendar
                y, m = int(d[:4]), int(d[5:7])
                return f"{d}-{calendar.monthrange(y, m)[1]:02d}"
            return d + "-01"
        return d
    start_iso, end_iso = iso(a.start, False), iso(a.end, True)

    smap = json.load(open(a.map, encoding="utf-8"))
    rows, report = build_tidy(smap, start_iso, end_iso)

    print(f"Series pulled ({start_iso} → {end_iso}):")
    for code, n, api_units in report:
        flag = "  ⚠ 0 rows" if n == 0 else ""
        u = (" [unit: " + ", ".join(sorted(api_units)) + "]") if api_units else ""
        print(f"  {code}: {n} obs{flag}{u}")
    if not rows:
        sys.exit("No data returned — check series codes, api_key, and date range.")

    json.dump(rows, open(a.out, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"\nWrote {a.out}: {len(rows)} rows across {len({tuple(r['path']) for r in rows})} series, "
          f"{len({r['period'] for r in rows})} periods.")
    print(f"Next: python3 build.py --config config.<name>.js --data {a.out} --logo logo.png --out dashboard.html")

if __name__ == "__main__":
    main()
