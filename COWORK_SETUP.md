# Instructions for Cowork — set up the auto-refreshing dashboard repo

Hand this whole file to Cowork. It builds a GitHub repo that hosts the
dashboards on GitHub Pages and refreshes them automatically (scheduled + a
manual button). Cowork does the file/git work; three account-level steps are
left to the human (marked ⚠ HUMAN) because they involve secrets/settings no
tool can set.

## What already exists (in this folder)
- `engine.js`, `build.py`, `shell.html` — frozen dashboard machinery (don't edit)
- `config.example.js`, `brand.datadarbar.js`, `logo.png`
- `refresh.py` — fetches an EasyData dataset → tidy data.json
- `config.deposits.js`, `series_map.deposits.json` — the Deposits dashboard (127 series)
- `.github-workflows-refresh.yml` — the automation workflow (needs renaming/placing)
- `TEMPLATE_SPEC.md`, `AUTOMATION.md` — reference docs

## Cowork: do these steps

1. **Create/choose a repo.** Either make a new GitHub repo (suggest name
   `datadarbar-dashboards`) or use an existing one the human points you to.
   Put all the folder's files at the repo root.

2. **Create a `public/` folder** — this is what GitHub Pages will serve. The
   built dashboards go here (e.g. `public/deposits.html`). Add a simple
   `public/index.html` linking to each dashboard.

3. **Place the workflows correctly.** Move `.github-workflows-refresh.yml` to
   `.github/workflows/refresh.yml`, and `.github-workflows-keycheck.yml` to
   `.github/workflows/keycheck.yml` (GitHub only recognizes workflows in that
   exact path). The keycheck workflow is a daily API-key health alert that opens
   a GitHub Issue if the key is expired/invalid. Confirm inside refresh.yml:
   - the `schedule:` cron (change to weekly if the human wants: `0 6 * * 1`
     = Mondays 06:00 UTC; or keep quarterly);
   - `workflow_dispatch:` is present (that's the manual "Run workflow" button);
   - the build step outputs to `public/deposits.html`;
   - the Pages deploy job is present.

4. **Do a local test build** to confirm the machinery runs (uses no secrets):
   ```
   python3 build.py --config config.deposits.js --data data.deposits.json --logo logo.png --out public/deposits.html
   ```
   (If `data.deposits.json` isn't present, the human runs `refresh.py` once with
   their key first — see ⚠ HUMAN step B. For a dry run, the synthetic
   data.deposits.json in the folder is fine to prove the build.)

5. **Commit and push** everything to the repo.

6. **Tell the human to do the three ⚠ HUMAN steps below**, then trigger the
   workflow once (Actions tab → Run workflow) to confirm the live pipeline.

## ⚠ HUMAN steps (in the GitHub website — Cowork cannot do these)

**A. Regenerate the EasyData API key.** The old one was exposed. Log in to
EasyData → My Data Basket → My Account → Generate API Key. Copy the new key.

**B. Add the key as a repo Secret.** Repo → Settings → Secrets and variables →
Actions → New repository secret. Name it exactly `EASYDATA_API_KEY`, paste the
key. (This is why the key is never in any file — Actions reads it from here.)

**C. Enable Pages.** Repo → Settings → Pages → Source: **GitHub Actions**. After
the first successful workflow run, the dashboards are live at
`https://<user>.github.io/<repo>/deposits.html`.

## After setup — how refreshes happen
- **Automatic:** the workflow runs on the schedule (weekly/monthly), fetches
  fresh data, rebuilds, and redeploys. The live URL updates on its own.
- **Manual:** Actions tab → "Refresh dashboards" → **Run workflow**. Same result,
  on demand.
- Nothing else to do. The dashboard URL never changes; only its data does.

## Notes for Cowork
- Never put the API key in any committed file — only the GitHub Secret.
- `refresh.py` + `build.py` need Python 3 stdlib only (the workflow installs pandas
  just in case a future converter needs it).
- To add more datasets later: add their `series_map.<name>.json` +
  `config.<name>.js`, then add two lines (refresh + build) to the workflow.
- First live run: check `refresh.py`'s printed per-series counts and units;
  confirm the Deposits unit (PKR millions vs thousands) and adjust
  `config.deposits.js` UNITS if needed.
