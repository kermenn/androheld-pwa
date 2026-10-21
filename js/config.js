/* ==========================================================================
   AndroHeld Web Configuration (Mirroring Constants.kt)
   ========================================================================== */

export const CONFIG = {
  APP_NAME: "AndroHeld Enterprise",
  VERSION: "5.0.0 Web/PWA",

  // Supabase Cloud (Inventory Report)
  SUPABASE_URL: "https://culgtxrkcdkkcsemocym.supabase.co",
  SUPABASE_KEY: atob("c2Jfc2VjcmV0X2lPbWs0THdyOWg3TXlES19sMVpQSXdfTXRHX2djRnQ="),

  // SAP WebGUI URL
  SAP_URL: "https://erp.trakindo.co.id/SAP/BC/GUI/SAP/ITS/zimm_lmob?sap-client=300&sap-language=EN",

  // Cloudflare Proxy & Google Apps Script
  CLOUDFLARE_PROXY_URL: "https://androheld-proxy.uchiuchul31.workers.dev",
  UPLOAD_URL: "https://script.google.com/macros/s/AKfycbzWSBeDkRdZrnyiHnqEr7aIyQzcE6b9dergCWHXqQPcZCaSlmEpdL8HUYP6TWnQ9nCYrA/exec",

  // Published CSV Sheets (Direct CORS supported + Proxy Fallback)
  SHEETS: {
    STOCK: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFBLyNUra_J2RR-Y8yagbKqHg85QsimOU4veCOFmtLF4-57AgLouw-9MW06GMfbFIUUcLnqsupIvU2/pub?gid=0&single=true&output=csv",
    STOCK_IMPORT: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-WvxB0Rsby5XRdi4ZErVlzIEWgjq6q2FFp3kd9UZq0oVsOQOdBo0KnuZSDG5YP13FewutQ8BPK8Yg/pub?gid=0&single=true&output=csv",
    WIP: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQG-jFIm9_1URcm1uOZkIC1Wzch0-K7yopV4pcyW5dXUCK6lj-eiVR8KLPtFnVZxqaGmy50AQFlY2d7/pub?gid=1325688518&single=true&output=csv",
    WIP_IN: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQG-jFIm9_1URcm1uOZkIC1Wzch0-K7yopV4pcyW5dXUCK6lj-eiVR8KLPtFnVZxqaGmy50AQFlY2d7/pub?gid=499203772&single=true&output=csv",
    QC_HOSE: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRqggf4LgOWjeLELoaVkEvDcWnJ7vBocrtVTaUq6OEJnZl7xBvGLu-36X7tbq1Q6CT9gN7D29cF9Itz/pub?gid=1482956216&single=true&output=csv",
    ROUTE: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFBLyNUra_J2RR-Y8yagbKqHg85QsimOU4veCOFmtLF4-57AgLouw-9MW06GMfbFIUUcLnqsupIvU2/pub?gid=865622419&single=true&output=csv",
    SAP_EVIDENCE: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT7KtUvwl3R6JpLfVdWC67uhkfHFi6PNW4Ym-gqLV8SV0lSJ6Br1fcurywscFvA3Iyz4oinV1z7UzOV/pub?gid=0&single=true&output=csv"
  },

  // Fallback demo summary (used only on first install before sync)
  SAMPLE_SUMMARY: {
    healthPercent: 37.1,
    healthValueUsd: 1371550.33,
    excessPercent: 46.8,
    excessValueUsd: 1731177.68,
    deadstockPercent: 8.8,
    deadstockValueUsd: 326816.13,
    obsoletePercent: 7.3,
    obsoleteValueUsd: 270352.17,
    totalPostureValueUsd: 3699896.30,
    woAllReadinessPercent: 72.0,
    woAllReadyCount: 1329,
    woAllTotalCount: 1847,
    woMpReadinessPercent: 86.7,
    woMpReadyCount: 806,
    woMpTotalCount: 930,
    lastSyncTime: ""
  }
};
