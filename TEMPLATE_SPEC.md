# Dashboard Template — Master Specification

This is the anchor document for the dashboard Project. It defines what the
template **is**, split into three layers:

1. **Engine behaviors** — fixed, data-agnostic. The reusable asset. These do
   not change between datasets.
2. **Config schema** — the per-dataset knobs. The only thing that varies.
3. **Workflow** — how a new dataset becomes a live dashboard.

Anything not in layers 1–2 (quirks of a specific dataset — an empty parent
node, a weird unit, a broken total) is a **design-stage** matter, handled when
that dataset is wired, not baked into the engine.

---

## 1. ENGINE BEHAVIORS (fixed, data-agnostic)

These are guaranteed by the engine for **every** dataset, regardless of shape.

### 1.1 Indicator selection
- Indicators live in a **nested tree** built from each row's `path`. The picker
  renders the tree with drill-down; any node is selectable.
- **Multi-select, uncapped** (except a Headline-style cap only if a config sets one).
- **Lineage exclusion:** a node and its own ancestor/descendant cannot be selected
  together (prevents double-counting a parent with its child). Siblings and
  unrelated branches are always fine.
- **"stack children"** on a group replaces the selection with that group's direct
  children — the fast path into a stacked/share view.
- Everything is selectable by default; whether a bare group-header node *should*
  be offered as a line is a per-dataset decision (see §3), not an engine rule.

### 1.2 Frequency (the five modes)
Buttons shown are **auto-detected** from the data's native frequency; invalid
options never appear.
- **Monthly** — native monthly only.
- **Quarterly** — from monthly or quarterly data.
- **Calendar Year** — Dec year-end.
- **Fiscal Year** — fiscal year-end (config sets the FYE month).
- **Trailing 12 Months (TTM)** — rolling 12-month (or 4-quarter) sum.

Aggregation obeys **stock vs flow** (declared per series in data):
- **Stock** → period-end value (last period in the bucket).
- **Flow** → sum of periods in the bucket.
- **TTM** is **flow-only** and hidden whenever any selected series is a stock.

### 1.3 View modes
- **Absolute** — raw values on one axis (same-unit selections).
- **Stacked area** — only when the selection is a summable group (same unit,
  siblings of one parent); sums to the group total.
- **Indexed (=100)** — every series rebased to 100 at the window start.
- **% share** — each series as % of the selected siblings' actual sum.
- **Combo (automatic)** — selecting exactly **two different-unit** indicators
  auto-switches to a dual-axis combo: first pick = **bars/left axis**, second =
  **line/right axis**.

View buttons enable/disable by eligibility: stack/share need a summable group;
Absolute is blocked for mixed units (falls back to Indexed); combo is automatic.

### 1.4 Summability (auto-inferred)
- A node's direct children are stackable/shareable when they share one unit and
  aren't ratios. Inferred from the tree — no per-series declaration needed.
- **% share** is computed against the **actual sum of the selected siblings**, so
  it is internally consistent even if a published "total" differs.
- Config can `forceOn` / `forceOff` specific groups for exceptions.

### 1.5 Growth stats (per selected series)
Shown as small cards with period-over-period, YoY, and a multi-period figure:
- **Money / count series:** % change (period-over-period, YoY) and **CAGR** over
  the visible span.
- **Ratio series (unit kind = ratio):** **percentage-point change**, never CAGR,
  and they never stack.
- Increase = green, decrease = red (config-set colors).

### 1.6 Units & axes
- Axis **tick numbers are unit-free** (brand rule). The unit is stated in the
  **subtitle**, and in combo view on each **axis title**. Never duplicated.
- Axes for money/count begin at zero; no negative ticks. Cross ticks on the y-axis.

### 1.7 Export
- **PNG** — the chart rendered on white with a footer band: source note
  (`config.sourceNote`) bottom-left, logo bottom-right.
- **CSV** — current view's data (respecting frequency + view), UTF-8 BOM so
  Excel renders symbols correctly, with 3 attribution comment lines on top.

### 1.8 Email gate (optional, config-driven)
- If a Sender account+form is configured and `gateDownloads` is on: the first
  download per session opens a modal with the Sender form. The download is
  released **only when the form is actually submitted** (success detected in the
  DOM). Closing without submitting cancels silently. Later downloads that session
  flow through. If no Sender config, downloads are ungated.

### 1.9 Analytics (optional, config-driven)
- If a GA4 Measurement ID is set, every download fires a `download` event with
  `format`, `series`, `view`, `frequency`. Fires regardless of the gate.
- Requires hosting on a real origin (not `file://`).

### 1.10 Branding & responsiveness
- Colors, font, and logo come from config; a mono ramp of primary+secondary
  colors keeps any number of series on-brand and distinguishable.
- Fully responsive: collapsible picker, scrollable controls, single-column stat
  cards, adaptive chart ticks/legend, mobile-tuned modal. Re-renders on
  breakpoint change.

### 1.11 Deployment
- Built to **one self-contained HTML file**. Chart.js + fonts load from CDN
  (needs internet); everything else — data, engine, logo, config — is inlined.

---

## 2. CONFIG SCHEMA (the only per-dataset file)

See `config.example.js` for the fully-commented version. Summary of knobs:

| Field | Purpose |
|---|---|
| `title`, `subtitle`, `sourceNote` | Header + footer + export attribution |
| `nativeFrequency` | monthly/quarterly/annual (or auto) |
| `frequencyOptions` | which of the 5 to expose (or auto) |
| `fiscalYearEndMonth` | for the Fiscal Year mode |
| `windowStart`, `windowEnd` | optional range clamp (e.g. skip a data gap) |
| `UNITS` | map each unit code → label, full name, kind (money/count/ratio) |
| `summable.forceOn/forceOff/crossCutting` | stacking overrides |
| `defaultSelection`, `defaultView` | what loads on open |
| `brand` | primary/secondary/pos/neg colors, font, logo |
| `senderAccountId`, `senderFormId`, `gateDownloads` | email gate |
| `ga4MeasurementId` | download analytics |

**Per-series, declared in the DATA (not config):** `path` (tree position),
`unit`, and `flow` (stock vs flow). These are properties of the data, so they
live with it.

---

## 3. WORKFLOW (new dataset → live dashboard)

1. **Normalize to tidy.** Data must become rows of
   `{period, path[], value, unit, flow}`. If a source exports long/tidy, use it
   directly. If it's an awkward wide layout (periods in columns, one-sheet-per-
   month, dot-indented trees), Claude writes a per-dataset converter — this step
   needs judgment and is not automated.
2. **Design decisions (per dataset, with Claude).** These are the "oddities"
   deliberately kept out of the engine:
   - the **grouping / nesting** (what the tree looks like);
   - **stock vs flow** per series;
   - whether any **group-header nodes** should be hidden or left selectable;
   - unit codes and their display;
   - any summability overrides;
   - window clamp, default selection, fiscal-year end.
3. **Write config** (`config.<name>.js`).
4. **Build:** `python3 build.py --config config.<name>.js --data data.<name>.json --logo logo.png --out dashboard.html`
5. **Host** on a real `https://` origin (needed for Sender + GA4).

### Division of labor
- **You change freely / self-serve:** titles, colors, logo, Sender & GA4 IDs,
  which frequency buttons show, default selection, window.
- **Best done with Claude per dataset:** normalization, grouping/nesting, and
  stock/flow tagging — the judgment calls that drive stacking, TTM, and math.

---

## 4. NON-GOALS (explicitly out of scope for the engine)
- The engine does **not** try to parse arbitrary raw layouts — tidy in only.
- It does **not** auto-decide stock vs flow — declared in data.
- It does **not** hard-enforce the email gate server-side — the gate is a
  client-side lead-capture step, bypassable by a determined user (full
  enforcement needs a backend and is out of scope).
- Dataset-specific display quirks are handled at design time, not by special
  cases in the engine.
