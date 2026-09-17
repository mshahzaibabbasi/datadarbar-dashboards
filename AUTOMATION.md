# Automation — refreshing dashboards from SBP EasyData

This adds an automated data pipeline in front of the template:

```
EasyData API  →  refresh.py  →  data.<name>.json  →  build.py  →  dashboard.html  →  (host)
```

Only datasets available as clean EasyData **series** are automatable this way.
Payment Systems (PDF) is NOT — keep it a manual/assisted rebuild each quarter.

## One-time setup

1. **Get an EasyData API key.** Log in on the EasyData portal → *My Data Basket*
   → *My Account* → **Generate API Key**. Note: **the key expires every 90 days**
   and must be regenerated — set a calendar reminder, or the scheduled refresh
   will start failing with auth errors.
2. **Store the key as an environment variable / GitHub Secret** named
   `EASYDATA_API_KEY`. The scripts read it from there — it is never written to
   any file. (The API takes the key as an `?api_key=` query param; `refresh.py`
   adds it from the env var, so it never appears in the series map or config.)
3. **Find the series codes.** Each indicator is a *series key* like
   `TS_GP_BOP_WR_M.WR0010`. Find them on the portal, or via the dataset-metadata
   API (`/api/v1/dataset/{code}/meta`) which lists a dataset's series. Put them in
   `series_map.<name>.json`. This is the only real per-dataset effort.

## API reference (confirmed)

- **Series data:** `GET https://easydata.sbp.org.pk/api/v1/series/{series_key}/data?api_key=..&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&format=json`
  - Omitting both dates returns **only the latest observation** — `refresh.py`
    always sends a start_date so you get history.
  - Response JSON: `{"columns":[...], "rows":[[...]]}` with columns including
    *Observation Date*, *Observation Value*, *Unit*, *Observation Status*.
- **Series metadata:** `/api/v1/series/{series_key}/meta`
- **Dataset metadata:** `/api/v1/dataset/{dataset_code}/meta` (use to discover a
  dataset's series keys).
- **Rate limits:** 2,000 requests/day, 250/hour across all calls. A single
  dashboard = one call per series (e.g. ~18 for SME), so you're far under — but a
  full refresh of many datasets should stay well within the hourly cap.

`refresh.py` prints each series' observation count **and the unit the API
reported**, so a wrong code (0 rows) or a unit mismatch with your config is
obvious immediately.

## Running a refresh (locally)

```
export EASYDATA_API_KEY="your-key"
python3 refresh.py --map series_map.sme.json --start 2016-06 --out data.sme.json
python3 build.py  --config config.sme.js --data data.sme.json --logo logo.png --out sme.html
```

`refresh.py` prints how many observations each series returned, so a code that
returns 0 rows (wrong code, renamed series) is obvious immediately.

## Automating it (recommended: GitHub Actions + Pages)

This is the simplest robust home — free, runs on a schedule, and can host the
output too. Use the provided workflow:

1. Put the template files in a GitHub repo.
2. Rename `.github-workflows-refresh.yml` to `.github/workflows/refresh.yml`.
3. Repo **Settings → Secrets and variables → Actions** → add `EASYDATA_API_KEY`.
4. (To host) Repo **Settings → Pages** → Source: **GitHub Actions**. The
   workflow deploys the `public/` folder; your dashboards live at
   `https://<user>.github.io/<repo>/sme.html`.
5. The workflow runs **on a schedule** (quarterly cron) **and** has a manual
   **"Run workflow"** button (workflow_dispatch) for on-demand refreshes when you
   know new data is out — the "both" behavior you wanted.

Add more datasets by copying the two refresh+build lines in the workflow with
that dataset's map and config.

## What's automatable vs not

| Dataset source | Automatable? | How |
|---|---|---|
| EasyData API (series) | Yes | `refresh.py` + series map |
| Stable-URL CSV/Excel | Partly | a per-dataset converter fetches the URL; may break on layout changes |
| Payment Systems (PDF) | No | manual/assisted rebuild each quarter |

## Security note
If a key is ever exposed (e.g. pasted somewhere), **regenerate it** in EasyData.
The scripts are written so the key only ever lives in an environment variable or
a GitHub Secret, never in code, config, or the series map.

## Renewing the API key (every 90 days) — this part is unavoidably manual
EasyData keys expire every 90 days *by design* — there is no programmatic way to
regenerate one (that's the point of the expiry). So renewal is a ~2-minute manual
task, four times a year. Two layers keep it painless and un-missable:

**Level 1 — exact-date calendar reminder (you set once).** When you generate the
key, EasyData shows its **End Date**. Set a calendar reminder for **2 days before
that exact date** ("Regenerate EasyData key → update GitHub secret"). This is the
proactive nudge so you rotate the key before it ever lapses.

**Level 2 — automated daily health check (built in).** The workflow
`.github/workflows/keycheck.yml` pings the API once a day with a single cheap
call (`refresh.py --healthcheck <code>`). If the key is invalid/expired it fails
and **opens a GitHub Issue**, which emails you — so you're alerted on day one,
before the weekly refresh serves stale data. It also has a manual "check now"
button in the Actions tab.

Together: the calendar reminder prevents the lapse; the daily check catches it
automatically if you miss the reminder.

Renewal steps: EasyData → My Data Basket → My Account → Generate API Key → copy →
GitHub repo → Settings → Secrets and variables → Actions → update `EASYDATA_API_KEY`
→ re-run the workflow (or wait for the next scheduled run).

## Rate limits — handled automatically
EasyData allows 2,000 requests/day and 250/hour. Each dashboard costs one request
per series (e.g. Deposits = 127). `refresh.py` protects against the limits on its own:
- **Throttle:** a short pause between calls (default 0.5s) paces a run well under
  the hourly cap. Tune with the `EASYDATA_THROTTLE` env var if needed.
- **429 backoff:** if the API returns "too many requests", it waits (honoring any
  `Retry-After` header) and retries with exponential backoff instead of failing.
- **Transient retries:** 5xx and network blips are retried with backoff too.
So even a heavy multi-dataset run self-paces and self-heals; you don't need to
stagger schedules manually.
