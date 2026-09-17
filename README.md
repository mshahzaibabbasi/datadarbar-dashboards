# Data Darbar — Dashboards

Auto-refreshing dashboards built on official Pakistani statistics, hosted on
GitHub Pages.

**Live:** `https://<user>.github.io/<repo>/` — update this line once Pages is on.

## How it works

```
EasyData API  →  refresh.py  →  data.<name>.json  →  build.py  →  public/<name>.html  →  Pages
```

`.github/workflows/refresh.yml` runs weekly (Mondays 06:00 UTC) and on demand
via the **Run workflow** button in the Actions tab. Datasets have staggered
release calendars — inflation lands early in the month, trade at the end — so a
weekly sweep is what guarantees each one is picked up within days of release.

`.github/workflows/keycheck.yml` pings the API daily and opens a GitHub Issue if
the key has expired.

## Setup (one time)

1. **Repo Secret** — Settings → Secrets and variables → Actions → `EASYDATA_API_KEY`.
   The key lives here and nowhere else; it is never written to a file in this repo.
2. **Pages** — Settings → Pages → Source: **GitHub Actions**.
3. Run the workflow once from the Actions tab to confirm the pipeline end to end.

> Pages on a **private** repo requires a paid plan. Public is the free path, and
> everything here is published data with no secrets in it.

## Dashboards

| Dashboard | Series | Frequency | Source |
|---|---|---|---|
| `public/deposits.html` | 127 | Monthly, since Jul 2019 | SBP — Deposits by Category of Deposit Holders |

## Adding a dataset

1. Build `series_map.<name>.json` + `config.<name>.js` (see `config.example.js`).
2. Add the refresh + build pair to `refresh.yml`, output to `public/<name>.html`.
3. Add an `<li>` to `public/index.html`.

**Watch the rate limit.** EasyData allows 250 requests/hour, one per series.
Deposits alone is 127. Two datasets of that size sit on the cap; three exceed it
and the run will crawl through `refresh.py`'s 429 backoff. Past ~2 datasets,
split them into separate workflow files on different days.

## Maintenance

The API key **expires every 90 days**. When it does, the daily keycheck opens an
issue. Regenerate on EasyData (My Data Basket → My Account → Generate API Key),
update the repo Secret, re-run the workflow. ~2 minutes, four times a year.

Note that GitHub disables scheduled workflows after 60 days of repository
inactivity — if refreshes go quiet, check the schedule is still enabled.

## Files

| File | Role | Edit? |
|---|---|---|
| `engine.js`, `shell.html`, `build.py` | Frozen dashboard machinery | **Never** |
| `refresh.py` | EasyData → tidy JSON | Rarely |
| `config.<name>.js` | Per-dataset config | Yes |
| `series_map.<name>.json` | EasyData codes → dashboard paths | Yes |
| `public/` | What Pages serves | Built |

See `TEMPLATE_README.md`, `TEMPLATE_SPEC.md`, `AUTOMATION.md` and
`HOW_TO_REFRESH.md` for the full reference.
