/* ==========================================================================
   Google Sheets Service (Fetch & Parse Published CSVs with Proxy fallback)
   ========================================================================== */

import { CONFIG } from '../config.js';

export const SheetsService = {
  async fetchCsv(url) {
    // 1. Google Sheets published CSV natively returns Access-Control-Allow-Origin: *
    // Try direct fetch first for maximum speed
    let res;
    try {
      res = await fetch(url);
    } catch (directErr) {
      // 2. Fallback to Cloudflare Proxy if local firewall/CORS blocks direct
      if (CONFIG.CLOUDFLARE_PROXY_URL) {
        try {
          const proxyUrl = `${CONFIG.CLOUDFLARE_PROXY_URL}?url=${encodeURIComponent(url)}`;
          res = await fetch(proxyUrl);
        } catch (proxyErr) {
          throw new Error("Gagal terhubung ke Google Sheets & Cloudflare Proxy.");
        }
      } else {
        throw directErr;
      }
    }

    if (!res || !res.ok) {
      throw new Error(`Gagal memuat data spreadsheet (${res ? res.status : 'Offline'})`);
    }

    const text = await res.text();
    return this.parseCsv(text);
  },

  parseCsv(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = this.parseCsvLine(lines[0]);
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const row = this.parseCsvLine(lines[i]);
      if (row.length === 0 || !row[0]) continue;

      const record = {};
      headers.forEach((h, index) => {
        record[h.trim()] = row[index] ? row[index].trim() : "";
      });
      records.push(record);
    }
    return records;
  },

  parseCsvLine(text) {
    const result = [];
    let insideQuote = false;
    let entry = "";

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        result.push(entry);
        entry = "";
      } else {
        entry += char;
      }
    }
    result.push(entry);
    return result;
  },

  async getWipOutRecords() {
    const raw = await this.fetchCsv(CONFIG.SHEETS.WIP);
    return raw.map(r => ({
      timestamp: r["Timestamp"] || r["Tanggal"] || "",
      picWarehouse: r["PIC Warehouse"] || r["Warehouse"] || "",
      picService: r["PIC Service"] || r["Service"] || "",
      odNumber: r["OD Number"] || r["Nomor OD"] || r["OD"] || "",
      photoUrl: r["Photo Link"] || r["Link Foto"] || r["Photo"] || r["Foto"] || "",
      photoUrls: (r["Photo Link"] || r["Link Foto"] || "").split(",").map(u => u.trim()).filter(Boolean)
    }));
  },

  async getWipInRecords() {
    const raw = await this.fetchCsv(CONFIG.SHEETS.WIP_IN);
    return raw.map(r => ({
      timestamp: r["Timestamp"] || r["Tanggal"] || "",
      odNumber: r["OD Number"] || r["Nomor OD"] || r["OD"] || "",
      unit: r["Unit"] || r["Unit Model"] || "",
      lokasi: r["Lokasi"] || r["Location"] || "",
      photoUrl: r["Photo Link"] || r["Link Foto"] || r["Photo"] || r["Foto"] || "",
      photoUrls: (r["Photo Link"] || r["Link Foto"] || "").split(",").map(u => u.trim()).filter(Boolean)
    }));
  },

  async getQcHoseRecords() {
    const raw = await this.fetchCsv(CONFIG.SHEETS.QC_HOSE);
    return raw.map(r => ({
      timestamp: r["Timestamp"] || r["Tanggal"] || "",
      picHose: r["PIC Hose"] || r["PIC"] || "",
      poSubconRef: r["PO Subcon Reference"] || r["PO Subcon Ref"] || r["PO"] || "",
      pnHose: r["PN Hose"] || r["Part Number"] || "",
      angle: r["Angle"] || r["Sudut"] || "",
      fotoPanjangUrl: r["Foto Panjang"] || r["Panjang"] || "",
      fotoCrimpUrl: r["Foto Crimp"] || r["Crimp"] || "",
      fotoCoupling1Url: r["Foto Coupling 1"] || r["Coupling 1"] || "",
      fotoCoupling2Url: r["Foto Coupling 2"] || r["Coupling 2"] || "",
      fotoActualUrl: r["Foto Actual"] || r["Actual"] || "",
      remarks: r["Remarks"] || r["Catatan"] || ""
    }));
  },

  async getStockDatabase() {
    let res;
    try {
      res = await fetch(CONFIG.SHEETS.STOCK);
    } catch (e) {
      if (CONFIG.CLOUDFLARE_PROXY_URL) {
        const proxyUrl = `${CONFIG.CLOUDFLARE_PROXY_URL}?url=${encodeURIComponent(CONFIG.SHEETS.STOCK)}`;
        res = await fetch(proxyUrl);
      } else throw e;
    }

    if (!res || !res.ok) {
      throw new Error(`Gagal memuat database stok (${res ? res.status : 'Offline'})`);
    }

    const csvText = await res.text();
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    const stockMap = {};
    let totalItems = 0;

    for (let i = 0; i < lines.length; i++) {
      const parts = this.parseCsvLine(lines[i]);
      if (parts.length >= 3) {
        const pn = (parts[0] || "").replace(/"/g, "").trim().toUpperCase();
        if (!pn || pn === "PART NUMBER" || pn === "PARTNUMBER" || pn === "PN") continue;

        let description = "";
        let type = "";
        let location = "";
        let qty = "0";

        if (parts.length >= 5) {
          description = (parts[1] || "").replace(/"/g, "").trim();
          type = (parts[2] || "").replace(/"/g, "").trim().toUpperCase();
          location = (parts[3] || "").replace(/"/g, "").trim().toUpperCase();
          qty = (parts[4] || "").replace(/"/g, "").trim();
        } else if (parts.length >= 4) {
          description = (parts[1] || "").replace(/"/g, "").trim();
          location = (parts[2] || "").replace(/"/g, "").trim().toUpperCase();
          qty = (parts[3] || "").replace(/"/g, "").trim();
        } else {
          location = (parts[1] || "").replace(/"/g, "").trim().toUpperCase();
          qty = (parts[2] || "").replace(/"/g, "").trim();
        }

        if (!stockMap[pn]) stockMap[pn] = [];
        stockMap[pn].push({ description, location, qty, type });
        totalItems++;
      }
    }

    return { stockMap, totalItems };
  },

  async getImportAuditList() {
    let res;
    try {
      res = await fetch(CONFIG.SHEETS.STOCK_IMPORT);
    } catch (e) {
      if (CONFIG.CLOUDFLARE_PROXY_URL) {
        const proxyUrl = `${CONFIG.CLOUDFLARE_PROXY_URL}?url=${encodeURIComponent(CONFIG.SHEETS.STOCK_IMPORT)}`;
        res = await fetch(proxyUrl);
      } else throw e;
    }

    if (!res || !res.ok) {
      throw new Error(`Gagal memuat daftar audit import (${res ? res.status : 'Offline'})`);
    }

    const csvText = await res.text();
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    const pns = [];

    for (const line of lines) {
      const parts = this.parseCsvLine(line);
      const pn = (parts[0] || "").replace(/"/g, "").trim().toUpperCase();
      if (!pn || pn === "PART NUMBER" || pn === "PARTNUMBER" || pn === "PN") continue;
      if (!pns.includes(pn)) pns.push(pn);
    }

    return pns;
  }
};
