# How to refresh the dashboards

Your dashboards are hosted on GitHub Pages. The repo IS the dashboard's home —
whenever the built HTML in the repo changes, the live URL updates automatically.
There is no separate "publish" step.

## The three ways a refresh happens

### 1. Automatic (default — you do nothing)
GitHub Actions runs on a schedule (weekly/monthly, as configured). It fetches
fresh data from SBP, rebuilds each dashboard, and redeploys. The live URL shows
new numbers within a minute of the run finishing.

### 2. Manual button (on demand, no computer needed)
When new data drops and you don't want to wait:
1. Go to the repo on github.com → **Actions** tab.
2. Click **"Refresh dashboards"** in the left list.
3. Click **Run workflow** → Run.
Two minutes later the live dashboards are updated.

### 3. Manual, local (if you ever want to run it yourself)
From the repo folder, with your key set (`export EASYDATA_API_KEY="..."`):
```
python3 refresh.py --map series_map.deposits.json --start 2019-07 --out data.deposits.json
python3 build.py  --config config.deposits.js --data data.deposits.json --logo logo.png --out public/deposits.html
git add -A && git commit -m "refresh deposits" && git push
```
The push is what makes it live (Pages redeploys automatically).

## Two things that will eventually break it (and the fix)
- **API key expires every 90 days.** When the scheduled run starts failing with
  an auth error, regenerate the key on EasyData and update the repo Secret
  `EASYDATA_API_KEY` (Settings → Secrets → Actions). ~2 minutes, once a quarter.
- **SBP renames/moves a series code.** `refresh.py` will show that series
  returning 0 rows. Fix the code in the relevant `series_map.<name>.json`.

## Adding a new dataset later
1. Get its metadata, build `series_map.<name>.json` + `config.<name>.js`
   (ask Claude — paste the dataset's `/meta` response).
2. Add two lines to `.github/workflows/refresh.yml` (a refresh + a build for it,
   outputting to `public/<name>.html`).
3. Add a link on `public/index.html`.
Done — it joins the same schedule.
