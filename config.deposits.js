const DATADARBAR_BRAND = {
  primary:"#0a4c76", secondary:"#999999", posColor:"#1a7f4b", negColor:"#c0392b", font:"Poppins", logoDataUri:"",
};
const CONFIG = {
  title: "Bank Deposits by Holder & Sector",
  subtitle: "State Bank of Pakistan · end-of-month deposits with scheduled banks · since Jul-2019",
  sourceNote: "Data Darbar · SBP data",
  nativeFrequency: "monthly",
  frequencyOptions: null,          // engine offers monthly/quarterly/CY/FY (no TTM — all stock)
  fiscalYearEndMonth: 6,
  windowStart: null, windowEnd: null,
  UNITS: {
    pkr_mn:{label:"PKR mn", full:"PKR millions", kind:"money"},
    pkr_bn:{label:"PKR bn", full:"PKR billions", kind:"money"},
  },
  summable:{forceOff:[], forceOn:[], crossCutting:[]},
  defaultSelection:["Total Deposits"], defaultView:"abs",
  brand: DATADARBAR_BRAND,
  senderAccountId:"", senderFormId:"", ga4MeasurementId:"", gateDownloads:true,
};
