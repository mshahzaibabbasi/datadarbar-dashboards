const DATADARBAR_BRAND = {
  primary:"#0a4c76", secondary:"#999999", posColor:"#1a7f4b", negColor:"#c0392b", font:"Poppins", logoDataUri:"",
};
const CONFIG = {
  title: "SBP & Scheduled Banks Credit by Borrower",
  subtitle: "State Bank of Pakistan · credit outstanding to government, private sector & others · monthly",
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
  summable:{forceOff:[], forceOn:[], crossCutting:[]},
  defaultSelection:["Total Credit"], defaultView:"abs",
  brand: DATADARBAR_BRAND,
  senderAccountId:"", senderFormId:"", ga4MeasurementId:"", gateDownloads:true,
};
