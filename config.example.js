/* =====================================================================
   DASHBOARD CONFIG  —  the ONLY file you edit per dataset
   =====================================================================
   The engine (engine.js) is frozen and data-agnostic. Everything that
   differs between datasets lives here. Pair this with a tidy data file
   (data.json / data.csv) in the standard schema (see TIDY SCHEMA below),
   then run build.py to produce one self-contained dashboard.html.

   ---------------------------------------------------------------------
   TIDY DATA SCHEMA (what data.json must contain)
   ---------------------------------------------------------------------
   An array of rows, one row per series per period:
     {
       "period": "2026-06",        // monthly "YYYY-MM", quarterly "YYYY-Qn", annual "YYYY"
       "path":   ["Transport","Sea transport","Freight"],  // hierarchy, root->leaf
       "value":  1234.5,
       "unit":   "usd_th",         // must exist in UNITS below
       "flow":   true              // true = flow (sums), false = stock (period-end)
     }
   - "path" is the nesting. Length 1 = top-level series. Deeper = nested.
     The last element is the series' own name; earlier elements are its
     ancestor groups. The engine builds the picker tree from these paths.
   - Every row for the same series across periods must use the same path.
   ===================================================================== */

const CONFIG = {

  /* ---- Identity ---- */
  title: "Dataset Explorer",
  subtitle: "Source · description · period range",         // engine appends nothing; write it fully
  sourceNote: "Data Darbar · SOURCE data",                 // used in footer, PNG footnote, CSV header

  /* ---- Periods & frequency ----------------------------------------
     nativeFrequency: the granularity of the raw data ("monthly" |
       "quarterly" | "annual"). If null, the engine infers it from the
       period strings.
     frequencyOptions: which buttons to expose. Subset of:
       "monthly","quarterly","calendar_year","fiscal_year","ttm"
       The engine additionally hides any option invalid for the native
       frequency, and hides "ttm" unless the current selection is all
       flow series. Leave null to let the engine offer all valid ones.
     fiscalYearEndMonth: 1-12 (e.g. 6 = June) — required only if
       "fiscal_year" is offered.
     windowStart / windowEnd: optional clamp (e.g. "2016-06") to trim a
       leading data gap or focus a range. null = full extent.        */
  nativeFrequency: null,
  frequencyOptions: null,
  fiscalYearEndMonth: 6,
  windowStart: null,
  windowEnd: null,

  /* ---- Units -------------------------------------------------------
     Map each unit code used in the data to how it displays.
       label:  short axis/stat suffix (kept OFF the tick numbers per
               brand; shown in subtitle / stat cards / tooltip)
       full:   long form for the subtitle ("PKR billions")
       kind:   "money" | "count" | "ratio"
               - money/count -> magnitude axis, begins at zero
               - ratio       -> percentage; shown as pp-change not CAGR,
                                 never stacked                          */
  UNITS: {
    pkr_bn:   { label:"PKR bn",       full:"PKR billions",        kind:"money" },
    pkr_mn:   { label:"PKR mn",       full:"PKR millions",        kind:"money" },
    pkr_tn:   { label:"PKR tn",       full:"PKR trillions",       kind:"money" },
    usd_th:   { label:"USD ’000",     full:"thousand USD",        kind:"money" },
    count:    { label:"",             full:"number",              kind:"count" },
    count_th: { label:"’000",         full:"thousands",           kind:"count" },
    count_mn: { label:"mn",           full:"millions",            kind:"count" },
    pct:      { label:"%",            full:"percent",             kind:"ratio" },
  },

  /* ---- Summability (stacking & % share) ---------------------------
     By default the engine AUTO-INFERS summable groups from the tree:
     a node's direct children are treated as summable to that node when
     they validate (children sum ≈ parent across most periods, when a
     parent value exists) OR when they share one unit and one kind.
     Use overrides ONLY for exceptions:
       forceOff: [ "path/as/slash/string", ... ]  // never stack these
       forceOn:  [ "path/as/slash/string", ... ]  // force-allow
       crossCutting: [ ... ]  // groups that must NEVER merge into a
                              // parent total (e.g. an alt breakdown)   */
  summable: {
    forceOff: [],
    forceOn: [],
    crossCutting: [],
  },

  /* ---- Default view on load --------------------------------------- */
  defaultSelection: [],          // array of "path/as/slash/string"; [] = engine picks first top-level
  defaultView: "abs",            // "abs" | "stack" | "index" | "share"  (combo is automatic)

  /* ---- Brand ------------------------------------------------------- */
  brand: {
    primary:   "#0a4c76",
    secondary: "#999999",
    posColor:  "#1a7f4b",        // increase (green)
    negColor:  "#c0392b",        // decrease (red)
    font:      "Poppins",
    logoDataUri: "",             // build.py injects the logo; leave ""
  },

  /* ---- Integrations (optional) ------------------------------------
     Leave blank to disable that feature entirely.                    */
  senderAccountId: "",           // e.g. "4d153d0f321632"  (email-gate)
  senderFormId:    "",           // e.g. "en5pR5"          (email-gate)
  ga4MeasurementId:"",           // e.g. "G-FXJVQC82GM"    (download tracking)
  gateDownloads:   true,         // require email before first download (if sender set)
};
