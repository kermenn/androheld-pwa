/* ==========================================================================
   Stock & Route Tools Module (Mirroring StockCheckScreen.kt & StockCheckViewModel.kt)
   Warehouse Bin Locator & Field Stock Opname Audit System
   ========================================================================== */

import { StorageService } from '../services/storageService.js';
import { SheetsService } from '../services/sheetsService.js';
import { GasService } from '../services/gasService.js';

let stockMap = {}; // { [PN]: [{ description, location, qty, type }] }
let auditedItems = []; // [{ partNumber, description, location, qty, qtyActual, checked, remarks }]
let activeFilter = 'all'; // 'all', 'pending', 'done'
let isSyncing = false;
let isImporting = false;
let isExporting = false;

export const StockModule = {
  async init() {
    this.bindEvents();
    await this.loadPersistedState();
    this.renderAuditedList();
    this.updateCounters();
  },

  async loadPersistedState() {
    // Restore PIC and Job Description
    const picInput = document.getElementById('stock-pic-input');
    const jobInput = document.getElementById('stock-job-desc-input');
    if (picInput) picInput.value = StorageService.getAuditPic();
    if (jobInput) jobInput.value = StorageService.getAuditJobDesc();

    // Restore Audited Items
    auditedItems = StorageService.getAuditedItems();

    // Restore Stock Catalog from IndexedDB
    stockMap = await StorageService.getStockMap();
    this.updateSyncBadge();

    // Auto sync on first launch if catalog is empty
    if (Object.keys(stockMap).length === 0) {
      this.syncStockDatabase(true);
    }
  },

  bindEvents() {
    // PIC & Job Desc auto-save
    const picInput = document.getElementById('stock-pic-input');
    if (picInput) {
      picInput.addEventListener('input', (e) => StorageService.saveAuditPic(e.target.value.trim()));
    }
    const jobInput = document.getElementById('stock-job-desc-input');
    if (jobInput) {
      jobInput.addEventListener('input', (e) => StorageService.saveAuditJobDesc(e.target.value.trim()));
    }

    // Bin Locator Search Input & Autocomplete Suggestions
    const searchInput = document.getElementById('stock-search-input');
    const suggestBox = document.getElementById('stock-suggestions-box');
    const btnAddSearch = document.getElementById('btn-stock-add-search');

    if (searchInput && suggestBox) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toUpperCase();
        this.renderSuggestions(query);
      });

      searchInput.addEventListener('focus', (e) => {
        const query = e.target.value.trim().toUpperCase();
        if (query) this.renderSuggestions(query);
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#stock-search-container')) {
          suggestBox.style.display = 'none';
        }
      });
    }

    if (btnAddSearch && searchInput) {
      btnAddSearch.addEventListener('click', () => {
        const pn = searchInput.value.trim().toUpperCase();
        if (pn) this.addPartToAudit(pn);
      });
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          btnAddSearch.click();
        }
      });
    }

    // Filter Chips: Semua, Belum Selesai, Sudah Selesai
    const filterChips = document.querySelectorAll('.stock-filter-chip');
    filterChips.forEach((chip) => {
      chip.addEventListener('click', (e) => {
        filterChips.forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        activeFilter = e.currentTarget.dataset.filter;
        this.renderAuditedList();
      });
    });

    // Top Bar & Action Buttons
    const btnSync = document.getElementById('btn-stock-sync');
    if (btnSync) btnSync.addEventListener('click', () => this.syncStockDatabase(false));

    const btnImport = document.getElementById('btn-stock-import');
    if (btnImport) btnImport.addEventListener('click', () => this.importTaskList());

    const btnExport = document.getElementById('btn-stock-export');
    if (btnExport) btnExport.addEventListener('click', () => this.exportAuditReport());

    const btnClear = document.getElementById('btn-stock-clear-audit');
    if (btnClear) btnClear.addEventListener('click', () => this.clearAllAudit());
  },

  updateSyncBadge() {
    const badge = document.getElementById('stock-sync-info-badge');
    if (!badge) return;
    const info = StorageService.getStockSyncInfo();
    const count = Object.keys(stockMap).length || info.totalItems;
    badge.textContent = `Database: ${count.toLocaleString()} Part Terdaftar (Sync: ${info.lastSync})`;
  },

  renderSuggestions(query) {
    const box = document.getElementById('stock-suggestions-box');
    if (!box) return;

    if (!query) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }

    const matches = [];
    const keys = Object.keys(stockMap);
    for (const key of keys) {
      if (key.includes(query)) {
        const infoList = stockMap[key];
        infoList.forEach(info => matches.push({ pn: key, ...info }));
        if (matches.length >= 8) break; // max 8 suggestions
      }
    }

    if (matches.length === 0) {
      box.style.display = 'block';
      box.innerHTML = `
        <div style="padding: 12px; font-size: 11.5px; color: var(--text-muted); text-align: center;">
          Part "${query}" tidak ditemukan di database rak gudang.
        </div>
      `;
      return;
    }

    box.style.display = 'block';
    box.innerHTML = matches.map((m) => `
      <div class="stock-suggest-item" data-pn="${m.pn}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-family: monospace; font-weight: 800; color: var(--accent-primary); font-size: 13.5px;">${m.pn}</span>
          <span class="stock-loc-badge">📍 ${m.location || 'NO-BIN'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 11px; color: var(--text-secondary);">
          <span>${m.description || 'No Description'}</span>
          <span>Stok: <strong>${m.qty}</strong></span>
        </div>
      </div>
    `).join('');

    box.querySelectorAll('.stock-suggest-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const pn = e.currentTarget.dataset.pn;
        document.getElementById('stock-search-input').value = pn;
        box.style.display = 'none';
        this.addPartToAudit(pn);
      });
    });
  },

  addPartToAudit(partNumber) {
    const cleanPn = partNumber.trim().toUpperCase();
    if (!cleanPn) return;

    const existing = auditedItems.filter(i => i.partNumber === cleanPn);
    const infoList = stockMap[cleanPn];

    if (infoList && infoList.length > 0) {
      infoList.forEach(info => {
        // Prevent duplicate location entry for same part
        if (!auditedItems.some(i => i.partNumber === cleanPn && i.location === info.location)) {
          auditedItems.unshift({
            partNumber: cleanPn,
            description: info.description || '',
            location: info.location || 'NO-BIN',
            qty: info.qty || '0',
            qtyActual: '',
            checked: false,
            remarks: ''
          });
        }
      });
      this.showToast(`Part ${cleanPn} ditambahkan ke daftar audit!`);
    } else {
      // Manual item if not found in stockMap
      if (!auditedItems.some(i => i.partNumber === cleanPn)) {
        auditedItems.unshift({
          partNumber: cleanPn,
          description: 'Item Manual (Tidak di Master)',
          location: 'MANUAL',
          qty: '0',
          qtyActual: '',
          checked: false,
          remarks: ''
        });
        this.showToast(`Part manual ${cleanPn} ditambahkan!`);
      } else {
        this.showToast(`Part ${cleanPn} sudah ada dalam daftar audit.`);
      }
    }

    document.getElementById('stock-search-input').value = '';
    document.getElementById('stock-suggestions-box').style.display = 'none';
    this.saveState();
    this.renderAuditedList();
    this.updateCounters();
  },

  renderAuditedList() {
    const container = document.getElementById('stock-audited-list');
    if (!container) return;

    let itemsToRender = auditedItems;
    if (activeFilter === 'pending') {
      itemsToRender = auditedItems.filter(i => !i.checked);
    } else if (activeFilter === 'done') {
      itemsToRender = auditedItems.filter(i => i.checked);
    }

    if (itemsToRender.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
          <div style="font-size: 13.5px; font-weight: 700; color: var(--text-white);">Belum Ada Item Audit</div>
          <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;">
            Cari Part Number di atas atau tekan tombol <strong>"📥 Import Task"</strong> untuk memuat daftar opname hari ini.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = itemsToRender.map((item, idx) => {
      // Find true index in master array
      const realIdx = auditedItems.indexOf(item);
      const isDone = item.checked;

      return `
        <div class="audit-card ${isDone ? 'checked-card' : ''}" data-idx="${realIdx}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <label class="audit-checkbox-wrap">
              <input type="checkbox" class="audit-item-check" data-idx="${realIdx}" ${isDone ? 'checked' : ''}>
              <span class="audit-checkmark"></span>
            </label>

            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="audit-pn">${item.partNumber}</span>
                <span class="stock-loc-badge">📍 ${item.location}</span>
              </div>
              <div class="audit-desc">${item.description || '-'}</div>
            </div>

            <button type="button" class="audit-del-btn" data-idx="${realIdx}" title="Hapus Item">×</button>
          </div>

          <div class="audit-inputs-row" style="margin-top: 10px;">
            <div class="audit-qty-box">
              <span style="font-size: 10px; color: var(--text-muted); font-weight: 700;">STOK SISTEM:</span>
              <span style="font-size: 13.5px; font-weight: 800; color: #60A5FA;">${item.qty}</span>
            </div>

            <div class="audit-qty-input-wrap">
              <span style="font-size: 10px; color: var(--accent-primary); font-weight: 700;">FISIK AKTUAL:</span>
              <input type="number" class="audit-actual-input" data-idx="${realIdx}" placeholder="0" value="${item.qtyActual}">
            </div>

            <div class="audit-remarks-wrap">
              <span style="font-size: 10px; color: var(--text-secondary); font-weight: 700;">CATATAN:</span>
              <input type="text" class="audit-remarks-input" data-idx="${realIdx}" placeholder="Kondisi part..." value="${item.remarks}">
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach Event Listeners to rendered cards
    container.querySelectorAll('.audit-item-check').forEach((chk) => {
      chk.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        auditedItems[idx].checked = e.target.checked;
        this.saveState();
        this.renderAuditedList();
        this.updateCounters();
      });
    });

    container.querySelectorAll('.audit-actual-input').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        auditedItems[idx].qtyActual = e.target.value.trim();
        this.saveState();
      });
    });

    container.querySelectorAll('.audit-remarks-input').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        auditedItems[idx].remarks = e.target.value.trim();
        this.saveState();
      });
    });

    container.querySelectorAll('.audit-del-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        auditedItems.splice(idx, 1);
        this.saveState();
        this.renderAuditedList();
        this.updateCounters();
      });
    });
  },

  updateCounters() {
    const total = auditedItems.length;
    const done = auditedItems.filter(i => i.checked).length;
    const pending = total - done;

    const lblTotal = document.getElementById('stock-count-total');
    const lblDone = document.getElementById('stock-count-done');
    const lblPending = document.getElementById('stock-count-pending');

    if (lblTotal) lblTotal.textContent = total;
    if (lblDone) lblDone.textContent = done;
    if (lblPending) lblPending.textContent = pending;
  },

  saveState() {
    StorageService.saveAuditedItems(auditedItems);
  },

  async syncStockDatabase(isSilent = false) {
    if (isSyncing) return;
    isSyncing = true;
    const btnSync = document.getElementById('btn-stock-sync');
    if (btnSync) btnSync.classList.add('rotating');

    if (!isSilent) this.showToast("Mengunduh database stok & rak gudang (10.000+ item)...");

    try {
      const { stockMap: newMap, totalItems } = await SheetsService.getStockDatabase();
      stockMap = newMap;
      
      const now = new Date();
      const timeStr = `${now.getDate()} ${now.toLocaleString('id-ID', { month: 'short' })} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      await StorageService.saveStockMap(stockMap, totalItems, timeStr);
      this.updateSyncBadge();

      if (!isSilent) alert(`🎉 Sukses! Database stok berhasil diperbarui. Total ${totalItems.toLocaleString()} part tersimpan permanen.`);
    } catch (err) {
      console.error(err);
      if (!isSilent) alert("Gagal sinkronisasi stok: " + err.message);
    } finally {
      isSyncing = false;
      if (btnSync) btnSync.classList.remove('rotating');
    }
  },

  async importTaskList() {
    if (isImporting) return;
    isImporting = true;
    const btn = document.getElementById('btn-stock-import');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<div class="spinner" style="margin: 0 auto;"></div>`;
    }

    try {
      this.showToast("Mengunduh daftar tugas audit dari Google Spreadsheet...");
      const pns = await SheetsService.getImportAuditList();
      
      let addedCount = 0;
      let ignoredCount = 0;

      pns.forEach((pn) => {
        if (!auditedItems.some(i => i.partNumber === pn)) {
          const infoList = stockMap[pn];
          if (infoList && infoList.length > 0) {
            infoList.forEach(info => {
              auditedItems.push({
                partNumber: pn,
                description: info.description || '',
                location: info.location || 'NO-BIN',
                qty: info.qty || '0',
                qtyActual: '',
                checked: false,
                remarks: ''
              });
              addedCount++;
            });
          } else {
            // Not in stockMap
            auditedItems.push({
              partNumber: pn,
              description: 'Item Baru',
              location: 'MANUAL',
              qty: '0',
              qtyActual: '',
              checked: false,
              remarks: ''
            });
            addedCount++;
          }
        } else {
          ignoredCount++;
        }
      });

      this.saveState();
      this.renderAuditedList();
      this.updateCounters();

      alert(`📥 Import Selesai!\n• Berhasil memuat: ${addedCount} part\n• Sudah ada sebelumnya: ${ignoredCount} part`);
    } catch (err) {
      console.error(err);
      alert("Gagal import daftar audit: " + err.message);
    } finally {
      isImporting = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "📥 Import Task";
      }
    }
  },

  async exportAuditReport() {
    if (isExporting) return;
    if (auditedItems.length === 0) {
      alert("Daftar audit masih kosong!");
      return;
    }

    const pic = document.getElementById('stock-pic-input')?.value.trim() || '';
    const jobDesc = document.getElementById('stock-job-desc-input')?.value.trim() || '';

    if (!pic) {
      alert("Harap isi nama PIC Audit!");
      document.getElementById('stock-pic-input')?.focus();
      return;
    }

    if (!confirm(`Kirim laporan audit (${auditedItems.length} item) oleh "${pic}" ke Google Spreadsheet & Drive?`)) {
      return;
    }

    isExporting = true;
    const btn = document.getElementById('btn-stock-export');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<div class="spinner" style="margin: 0 auto;"></div>`;
    }

    try {
      this.showToast("Mengunggah hasil audit ke Google Apps Script...");
      await GasService.exportAuditReport(pic, jobDesc, auditedItems);

      alert(`🎉 Sukses! Laporan Stock Opname (${auditedItems.length} item) berhasil tersimpan di Google Spreadsheet & Drive.`);
    } catch (err) {
      console.error(err);
      alert("Gagal kirim laporan: " + err.message);
    } finally {
      isExporting = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "📤 Export Hasil";
      }
    }
  },

  clearAllAudit() {
    if (auditedItems.length === 0) return;
    if (confirm("Apakah Anda yakin ingin mengosongkan seluruh daftar audit saat ini?")) {
      auditedItems = [];
      this.saveState();
      this.renderAuditedList();
      this.updateCounters();
      this.showToast("Daftar audit telah dibersihkan.");
    }
  },

  showToast(msg) {
    const toast = document.getElementById('global-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }
};
