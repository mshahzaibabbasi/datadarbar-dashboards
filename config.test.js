const CONFIG = {
  title: "Payments Explorer (TEST)",
  subtitle: "Synthetic data · monthly · 2023–2024",
  sourceNote: "Data Darbar · synthetic test",
  nativeFrequency: "monthly",
  frequencyOptions: null,
  fiscalYearEndMonth: 6,
  windowStart: null, windowEnd: null,
  UNITS: {
    pkr_bn:{label:"PKR bn",full:"PKR billions",kind:"money"},
    count:{label:"",full:"number",kind:"count"},
    pct:{label:"%",full:"percent",kind:"ratio"},
  },
  summable:{forceOff:[],forceOn:[],crossCutting:[]},
  defaultSelection:[], defaultView:"abs",
  brand:{primary:"#0a4c76",secondary:"#999999",posColor:"#1a7f4b",negColor:"#c0392b",font:"Poppins",logoDataUri:""},
  senderAccountId:"", senderFormId:"", ga4MeasurementId:"", gateDownloads:true,
};
