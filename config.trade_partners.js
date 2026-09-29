const DATADARBAR_BRAND = {
  primary:"#0a4c76", secondary:"#999999", posColor:"#1a7f4b", negColor:"#c0392b", font:"Poppins", logoDataUri:"",
};
const CONFIG = {
  title: "Trade by Country",
  subtitle: "State Bank of Pakistan · export receipts & import payments by trading partner · monthly",
  sourceNote: "Data Darbar · SBP data",
  nativeFrequency: "monthly",
  frequencyOptions: null,
  fiscalYearEndMonth: 6,
  windowStart: null, windowEnd: null,
  // PLACEHOLDER: same unverified-scale caveat as config.trade_commodities.js.
  UNITS: {
    usd:{label:"USD (verify scale)", full:"US Dollars — UNVERIFIED SCALE, confirm on first refresh", kind:"money"},
  },
  summable:{forceOff:[], forceOn:[], crossCutting:[]},
  defaultSelection:[], defaultView:"abs",
  brand: DATADARBAR_BRAND,
  senderAccountId:"", senderFormId:"", ga4MeasurementId:"", gateDownloads:true,
};
