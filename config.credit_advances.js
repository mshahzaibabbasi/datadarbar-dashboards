const DATADARBAR_BRAND = {
  primary:"#0a4c76", secondary:"#999999", posColor:"#1a7f4b", negColor:"#c0392b", font:"Poppins", logoDataUri:"",
};
const CONFIG = {
  title: "Outstanding Advances by Borrower",
  subtitle: "State Bank of Pakistan · advances of all banks by borrower & collateral type · monthly",
  sourceNote: "Data Darbar · SBP data",
  nativeFrequency: "monthly",
  frequencyOptions: null,
  fiscalYearEndMonth: 6,
  windowStart: null, windowEnd: null,
  // PLACEHOLDER: catalog's Unit column just says "PKR" with no scale.
  // VERIFY against refresh.py's first real run before trusting axis labels.
  UNITS: {
    pkr:{label:"PKR (verify scale)", full:"PKR — UNVERIFIED SCALE, confirm on first refresh", kind:"money"},
  },
  // The ~110 "Private Sector (Business) — detail" series are left FLAT
  // (see series_map.credit_advances.json's _comment) because several of
  // them are SBP's own published subtotals of others in that same flat
  // list (e.g. "Against Food Items" sums the Wheat/Rice/Sugar/etc rows).
  // Since none of that is expressed as real parent/child nesting, the
  // engine's same-unit auto-stack heuristic would double-count if left on
  // — forceOff disables stacking/share for that branch until someone does
  // the careful per-row subtotal verification and re-nests it properly.
  summable:{forceOff:["Private Sector (Business) — detail"], forceOn:[], crossCutting:[]},
  defaultSelection:["Grand Total"], defaultView:"abs",
  brand: DATADARBAR_BRAND,
  senderAccountId:"", senderFormId:"", ga4MeasurementId:"", gateDownloads:true,
};
