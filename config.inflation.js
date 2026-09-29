const DATADARBAR_BRAND = {
  primary:"#0a4c76", secondary:"#999999", posColor:"#1a7f4b", negColor:"#c0392b", font:"Poppins", logoDataUri:"",
};
const CONFIG = {
  title: "Inflation — CPI, Core, WPI & SPI",
  subtitle: "State Bank of Pakistan · National/Urban/Rural CPI, core measures, WPI & SPI · monthly",
  sourceNote: "Data Darbar · SBP data",
  nativeFrequency: "monthly",
  frequencyOptions: null,
  fiscalYearEndMonth: 6,
  windowStart: null, windowEnd: null,
  // All series are already rate measures (%) — unambiguous, no scale to verify.
  UNITS: {
    pct:{label:"%", full:"percent", kind:"ratio"},
  },
  summable:{forceOff:[], forceOn:[], crossCutting:[]},
  defaultSelection:["Year-on-Year/National CPI"], defaultView:"abs",
  brand: DATADARBAR_BRAND,
  senderAccountId:"", senderFormId:"", ga4MeasurementId:"", gateDownloads:true,
};
