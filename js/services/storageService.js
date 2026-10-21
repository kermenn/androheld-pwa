/* ==========================================================================
   Offline-First Storage Service (Single Source of Truth)
   LocalStorage for state + IndexedDB for large Stock Catalog (10k+ items)
   ========================================================================== */

import { CONFIG } from '../config.js';

const STORAGE_KEYS = {
  KPI: 'androheld_cached_kpi',
  LAST_SYNC: 'androheld_last_sync',
  LAST_SYNC_TS: 'androheld_last_sync_timestamp',
  ITEMS: 'androheld_cached_items',
  AUDITED_ITEMS: 'androheld_audited_items',
  AUDIT_PIC: 'androheld_audit_pic',
  AUDIT_JOB_DESC: 'androheld_audit_job_desc',
  STOCK_LAST_SYNC: 'androheld_stock_last_sync',
  STOCK_TOTAL_ITEMS: 'androheld_stock_total_items'
};

const DB_NAME = 'androheld_stock_db';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('catalog')) {
        db.createObjectStore('catalog');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const StorageService = {
  getKpi() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.KPI);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("Storage read error", e);
    }
    return CONFIG.SAMPLE_SUMMARY;
  },

  saveKpi(kpi) {
    try {
      localStorage.setItem(STORAGE_KEYS.KPI, JSON.stringify(kpi));
    } catch (e) {
      console.error("Storage write error", e);
    }
  },

  getLastSync() {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC) || "";
  },

  getLastSyncTimestamp() {
    return parseInt(localStorage.getItem(STORAGE_KEYS.LAST_SYNC_TS) || "0", 10);
  },

  saveSyncTime(formattedStr, millis) {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, formattedStr);
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TS, millis.toString());
    } catch (e) {
      console.error("Storage write error", e);
    }
  },

  getItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ITEMS);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("Items read error", e);
    }
    return [];
  },

  saveItems(items) {
    try {
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error("Items write error (quota limit?)", e);
    }
  },

  // --- Audit State (Stock Opname) ---
  getAuditedItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUDITED_ITEMS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  },

  saveAuditedItems(items) {
    try {
      localStorage.setItem(STORAGE_KEYS.AUDITED_ITEMS, JSON.stringify(items));
    } catch (e) {}
  },

  getAuditPic() {
    return localStorage.getItem(STORAGE_KEYS.AUDIT_PIC) || "";
  },

  saveAuditPic(pic) {
    localStorage.setItem(STORAGE_KEYS.AUDIT_PIC, pic);
  },

  getAuditJobDesc() {
    return localStorage.getItem(STORAGE_KEYS.AUDIT_JOB_DESC) || "";
  },

  saveAuditJobDesc(jobDesc) {
    localStorage.setItem(STORAGE_KEYS.AUDIT_JOB_DESC, jobDesc);
  },

  // --- Large Stock Catalog (IndexedDB) ---
  async getStockMap() {
    try {
      const db = await openDb();
      return new Promise((resolve) => {
        const tx = db.transaction('catalog', 'readonly');
        const store = tx.objectStore('catalog');
        const req = store.get('stock_map');
        req.onsuccess = () => resolve(req.result || {});
        req.onerror = () => resolve({});
      });
    } catch (e) {
      console.warn("IndexedDB read error", e);
      return {};
    }
  },

  async saveStockMap(map, count, formattedTime) {
    try {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('catalog', 'readwrite');
        const store = tx.objectStore('catalog');
        store.put(map, 'stock_map');
        tx.oncomplete = () => {
          localStorage.setItem(STORAGE_KEYS.STOCK_TOTAL_ITEMS, count.toString());
          localStorage.setItem(STORAGE_KEYS.STOCK_LAST_SYNC, formattedTime);
          resolve(true);
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error("IndexedDB write error", e);
    }
  },

  getStockSyncInfo() {
    return {
      lastSync: localStorage.getItem(STORAGE_KEYS.STOCK_LAST_SYNC) || "Belum Pernah",
      totalItems: parseInt(localStorage.getItem(STORAGE_KEYS.STOCK_TOTAL_ITEMS) || "0", 10)
    };
  },

  clearCache() {
    localStorage.removeItem(STORAGE_KEYS.KPI);
    localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
    localStorage.removeItem(STORAGE_KEYS.LAST_SYNC_TS);
    localStorage.removeItem(STORAGE_KEYS.ITEMS);
  }
};
