# Working rules — Data Darbar SBP projects

Ground rules for any Claude Code session in this repo. These are distilled from
`PROJECT_CONTEXT.md`, `README.md`, `article_style_guide.md` and
`INTERN_ONBOARDING.md` — they are here so they are in front of every session
instead of spread across four documents.

## Data integrity

1. **Never invent a number.** Every figure in an article, draft, chart or
   summary comes from pipeline output. If it isn't in the data, it doesn't go
   in. No estimating, no rounding to a nicer figure, no recalling last
   quarter's number from memory.
2. **Verify extractions against the real source file.** Before asserting a
   parser or adapter works, open the actual PDF/Excel and check real values
   against the extracted ones. This project has been bitten repeatedly by
   assuming table structure nobody looked at. Never say "fixed" without having
   checked numbers.
3. **Fail loudly. Never weaken a validation check to make a run pass.**
   Partial silent success is this project's recurring failure mode — it has
   happened three times (the two-annexure page merge, duplicate row labels in
   the warehouse, the API's latest-observation-only default). Every one was
   caught by a downstream loud check, never by the code doing the work. If a
   check fires, the data is wrong, not the check.
4. **Mark gaps, don't fill them.** Bank/merchant-level detail isn't in SBP's
   aggregate annexures. Leave `[WRITER]` placeholders; never invent a bank
   name, terminal count or merchant.

## Source hierarchy

    EasyData API  >  Excel release  >  HTML table  >  PDF (last resort)

Don't parse a PDF if an Excel of the same data exists. Exception: for the
*current* quarter's payments data the PDF is primary — the API lags it by a
quarter and carries no Raast/EMI/branchless figures at all.

## The EasyData API

- Always pass `start_date` / `end_date`. Without them the API returns **only
  the single most recent observation** — the fetcher will look like it worked
  and return one row per series.
- Empty-string date params (`start_date=&end_date=`) are a *different* request
  from omitting the keys. Omit them entirely if you want latest-only.
- Rows come back **newest-first**. Sort by date; don't take the last row.
- Look columns up **by name**, never by index — a reorder must fail loudly
  rather than silently return wrong numbers.
- Rate limits: 2,000/day, 250/hour. One request per series. Deposits alone is
  127 series.
- The key expires every 90 days. On 401/403, abort immediately with a
  regenerate message rather than grinding through every remaining series.

## SBP PDFs

- **Do not build download automation or bot-evasion** (Selenium, Playwright,
  Camoufox, proxies) to get around SBP's block on script downloads. This was a
  considered decision, not an oversight. A human saves the PDF from a browser
  four times a year; the automation is the *extraction*.
- `pdfplumber.extract_tables()` does not work on these files — the tables have
  no drawn borders. Parse `extract_text()` line by line instead.

## Secrets

- `.env`, `client_secret.json`, `token.json` and `service_account*.json` are
  gitignored. Never commit them, never paste them into a chat, never write
  their values into a generated file.
- To give an assistant or a new collaborator context, **the code files alone
  are enough** — none of those add anything actionable.
- `token.json` is a live Google refresh token, per-person. A new collaborator
  runs the consent flow on their own machine; it is never shared.
- If a credential is exposed: revoke/rotate it the same day. See
  `ROTATE_CREDENTIALS.md`.

## Dependencies and environment

- **Ask before adding any Python package.** Current stack: `requests`,
  `pandas`, `openpyxl`, `python-dotenv`, `pdfplumber`, and the Google API libs.
- Windows: Python is `py`, not `python`/`pip`. Use `py -m pip install ...`.
- Python 3.14 is installed but new; fall back to 3.12 if a wheel is missing.

## Permissions

This repo holds a live API key and ingests external PDFs and web content —
exactly the prompt-injection surface that makes blanket permission-skipping
dangerous. Use auto mode (Shift+Tab) if prompts are tedious, but **do not use
`--dangerously-skip-permissions`**, and keep `Bash(rm *)` and `git push` gated.

## Config over code

Series live in `series.csv` (payments pipeline) and `series_map.<name>.json`
(dashboard template), not hardcoded in Python. Adding a series is a config
edit, not a code change. Keep it that way.
