const DATADARBAR_BRAND = {
  primary:"#0a4c76", secondary:"#999999", posColor:"#1a7f4b", negColor:"#c0392b", font:"Poppins", logoDataUri:"",
};
const CONFIG = {
  title: "Balance of Payments — Standard Presentation",
  subtitle: "State Bank of Pakistan · BPM6 standard presentation, current & financial account detail · monthly",
  sourceNote: "Data Darbar · SBP data",
  nativeFrequency: "monthly",
  frequencyOptions: null,
  fiscalYearEndMonth: 6,
  windowStart: null, windowEnd: null,
  // PLACEHOLDER: verify USD scale on first refresh.py run.
  UNITS: {
    usd:{label:"USD (verify scale)", full:"US Dollars — UNVERIFIED SCALE, confirm on first refresh", kind:"money"},
  },
  summable:{forceOff:[], forceOn:[], crossCutting:[]},
  defaultSelection:["Current account/Credit"], defaultView:"abs",
  brand: DATADARBAR_BRAND,
  senderAccountId:"", senderFormId:"", ga4MeasurementId:"", gateDownloads:true,
};
