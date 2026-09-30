const DATADARBAR_BRAND = {
  primary:"#0a4c76", secondary:"#999999", posColor:"#1a7f4b", negColor:"#c0392b", font:"Poppins", logoDataUri:"",
};
const CONFIG = {
  title: "Private Sector Business Loans by Type of Finance",
  subtitle: "State Bank of Pakistan · scheduled banks' financing to private business by purpose & industry · monthly",
  sourceNote: "Data Darbar · SBP data",
  nativeFrequency: "monthly",
  frequencyOptions: null,
  fiscalYearEndMonth: 6,
  windowStart: null, windowEnd: null,
  // PLACEHOLDER: verify PKR scale on first refresh.py run.
  UNITS: {
    pkr:{label:"PKR (verify scale)", full:"PKR — UNVERIFIED SCALE, confirm on first refresh", kind:"money"},
  },
  summable:{forceOff:[], forceOn:[], crossCutting:[]},
  defaultSelection:["All Sectors"], defaultView:"abs",
  brand: DATADARBAR_BRAND,
  senderAccountId:"", senderFormId:"", ga4MeasurementId:"", gateDownloads:true,
};
