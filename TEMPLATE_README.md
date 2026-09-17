# Dashboard Template

A reusable, data-agnostic dashboard engine. Drop in a tidy dataset + a small
config, run the build, and get one self-contained `dashboard.html` with:
frequency switching (Monthly / Quarterly / Calendar Yr / Fiscal Yr / TTM),
Absolute / Stacked / Indexed / % share views, automatic dual-axis **combo**
when two different-unit indicators are picked, nested indicator picker,
branded PNG + CSV export, optional email gate (Sender) and download
analytics (GA4), and full mobile layout.

## Files

| File | Role | Edit? |
|---|---|---|
| `engine.js` | The frozen dashboard brain. All interactions live here. | **Never** |
| `shell.html` | HTML/CSS scaffold. | Rarely |
| `build.py` | Stitches config + data + engine + logo → `dashboard.html`. | Never |
| `config.example.js` | Documented config schema — copy per dataset. | — |
| `config.<name>.js` | Your per-dataset config. | **Yes** |
| `data.<name>.json` | Your tidy dataset. | **Yes (or Claude generates)** |
| `logo.png` | Brand logo (optional). | — |

## The tidy data format

`data.json` is an array of rows, one per series per period:

```json
{ "period": "2026-06", "path": ["Transactions","Cards"], "value": 50.2, "unit": "pkr_bn", "flow": true }
```

- **period**: `YYYY-MM` (monthly), `YYYY-Qn` (quarterly), or `YYYY` (annual).
- **path**: hierarchy root→leaf. `["Total"]` is top-level; `["A","B","C"]` nests
  C under B under A. The picker tree is built from these paths.
- **value**: number.
- **unit**: a key defined in `config.UNITS` (e.g. `pkr_bn`, `usd_th`, `pct`, `count`).
- **flow**: `true` = flow (sums across a period; TTM-eligible);
  `false` = stock (takes the period-end value; no TTM).

If a source is already exportable as long/tidy, produce this directly. If it's an
awkward wide layout (periods in columns, one-sheet-per-month, dot-indented trees),
ask Claude to convert raw → tidy — that step needs judgment and isn't automated.

## Making a new dashboard

1. **Prepare data** → `data.<name>.json` in the tidy format above.
2. **Copy config** → `cp config.example.js config.<name>.js`, then set:
   title/subtitle/sourceNote, `UNITS`, `fiscalYearEndMonth`, `frequencyOptions`
   (or leave null), any `summable` overrides, `defaultSelection`, brand, and the
   Sender/GA4 IDs.
3. **Build**:
   ```
   python3 build.py --config config.<name>.js --data data.<name>.json --logo logo.png --out dashboard.html
   ```
4. **Host it** (GitHub Pages / Netlify / Cloudflare Pages / your site). The Sender
   form and GA4 only work from a real `https://` origin, not a local `file://`.

## What Claude confirms vs what you change yourself

- **You (or config) can change freely:** titles, colors, logo, Sender form ID,
  GA4 ID, which frequency buttons show, default selection.
- **Best confirmed with Claude per dataset:** the indicator grouping/nesting, and
  stock-vs-flow tagging — these need judgment about the data and drive stacking,
  TTM, and the aggregation math.

## Stacking & % share (auto)

The engine auto-infers: a node's direct children are stackable/shareable when they
share one unit and aren't ratios. `%` share is computed against the actual sum of
the selected siblings (internally consistent even if a published total differs).
Selecting a parent together with one of its own descendants disables stack/share
(prevents double-counting). Override in `config.summable` only for exceptions.

## Frequency & stock/flow rules

- Valid buttons are auto-detected from the data's native frequency (you never get
  "Monthly" on quarterly data).
- **Quarterly / Calendar Yr / Fiscal Yr:** stock → period-end; flow → sum.
- **TTM:** flow only (sum of last 12 months, or last 4 quarters for quarterly
  data). Hidden whenever the current selection includes any stock series.

## Notes

- Chart.js and Google Fonts load from CDN, so the built file needs internet but is
  otherwise a single portable HTML.
- Ratio indicators (unit kind `ratio`) show percentage-point change, never CAGR,
  and never stack.
- Axis tick numbers stay unit-free (brand rule); the unit is stated in the subtitle
  and, in combo view, on each axis title.
