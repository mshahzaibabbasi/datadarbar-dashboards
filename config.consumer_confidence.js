const DATADARBAR_BRAND = {
  primary:"#0a4c76", secondary:"#999999", posColor:"#1a7f4b", negColor:"#c0392b", font:"Poppins", logoDataUri:"",
};
const CONFIG = {
  title: "Consumer Confidence Survey",
  subtitle: "State Bank of Pakistan · Positive/Negative response share by question & city/district · monthly",
  sourceNote: "Data Darbar · SBP data",
  nativeFrequency: "monthly",
  frequencyOptions: null,
  fiscalYearEndMonth: 6,
  windowStart: null, windowEnd: null,
  // Rate/share measure — unambiguous, no scale to verify.
  UNITS: {
    pct:{label:"%", full:"percent of respondents", kind:"ratio"},
  },
  summable:{forceOff:[], forceOn:[], crossCutting:[]},
  // No default picked: SBP's catalog gives question NUMBERS (Q1..Q20) but
  // not question TEXT, so there's no verified "headline" question to
  // default to — see series_map.consumer_confidence.json's _comment.
  defaultSelection:[], defaultView:"abs",
  brand: DATADARBAR_BRAND,
  senderAccountId:"", senderFormId:"", ga4MeasurementId:"", gateDownloads:true,
};
