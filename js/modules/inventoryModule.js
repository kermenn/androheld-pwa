/* ==========================================================================
   Inventory Analysis & Posture Report Module (Mirroring Android Compose Screen)
   ========================================================================== */

import { StorageService } from '../services/storageService.js';
import { SupabaseService } from '../services/supabaseService.js';

let currentKpi = StorageService.getKpi();
let localItems = StorageService.getItems();
let selectedItem = null;
let searchDebounceTimer = null;
let isSyncing = false;

export const InventoryModule = {
  init() {
    this.renderKpi(currentKpi);
    this.renderCacheStats();
    this.bindEvents();

    // 1. Silent Background Revalidation on open (Stale-While-Revalidate)
    const lastSyncMs = StorageService.getLastSyncTimestamp();
    const fourHoursMs = 4 * 60 * 60 * 1000;
    const isStale = (Date.now() - lastSyncMs) > fourHoursMs;

    if (localItems.length === 0 || isStale) {
      this.syncFromCloud(true);
    } else {
      this.refreshKpiSilently();
    }
  },

  bindEvents() {
    const searchInput = document.getElementById('inventory-search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    const syncBtn = document.getElementById('btn-inventory-sync');
    const settingsBtn = document.getElementById('btn-inventory-settings');
    const closeModalBtn = document.getElementById('btn-close-modal');
    const clearCacheBtn = document.getElementById('btn-clear-cache');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';
        
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          this.handleSearch(query);
        }, 250);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        this.clearSearchResults();
      });
    }

    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.syncFromCloud(false);
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.openSettingsModal();
      });
    }

    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => {
        document.getElementById('inventory-settings-modal').style.display = 'none';
      });
    }

    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', () => {
        StorageService.clearCache();
        localItems = [];
        currentKpi = StorageService.getKpi();
        this.renderKpi(currentKpi);
        this.clearSearchResults();
        document.getElementById('inventory-settings-modal').style.display = 'none';
        this.showToast("Cache lokal berhasil dihapus.");
      });
    }
  },

  renderKpi(kpi) {
    if (!kpi) return;
    currentKpi = kpi;

    // 1. Posture 4 Cards
    document.getElementById('kpi-health-pct').textContent = `${kpi.healthPercent?.toFixed(1) || 0}%`;
    document.getElementById('kpi-health-val').textContent = this.formatUsd(kpi.healthValueUsd);

    document.getElementById('kpi-excess-pct').textContent = `${kpi.excessPercent?.toFixed(1) || 0}%`;
    document.getElementById('kpi-excess-val').textContent = this.formatUsd(kpi.excessValueUsd);

    document.getElementById('kpi-deadstock-pct').textContent = `${kpi.deadstockPercent?.toFixed(1) || 0}%`;
    document.getElementById('kpi-deadstock-val').textContent = this.formatUsd(kpi.deadstockValueUsd);

    document.getElementById('kpi-obsolete-pct').textContent = `${kpi.obsoletePercent?.toFixed(1) || 0}%`;
    document.getElementById('kpi-obsolete-val').textContent = this.formatUsd(kpi.obsoleteValueUsd);

    // Valuation Strip
    const totalVal = kpi.totalPostureValueUsd || 3699896.30;
    document.getElementById('kpi-total-val').textContent = `$${(totalVal / 1000000).toFixed(2)}M USD`;

    // Donut 1: WO All Reservation
    const woAllPct = Math.round(kpi.woAllReadinessPercent || 0);
    document.getElementById('donut-wo-all-pct').textContent = `${woAllPct}%`;
    document.getElementById('donut-wo-all-sub').textContent = `${kpi.woAllReadyCount || 0}/${kpi.woAllTotalCount || 0} Ready`;
    this.setDonutStroke('donut-circle-wo-all', woAllPct);

    // Donut 2: WO Monthly Plan (MP)
    const woMpPct = Math.round(kpi.woMpReadinessPercent || 0);
    document.getElementById('donut-wo-mp-pct').textContent = `${woMpPct}%`;
    document.getElementById('donut-wo-mp-sub').textContent = `${kpi.woMpReadyCount || 0}/${kpi.woMpTotalCount || 0} Ready`;
    this.setDonutStroke('donut-circle-wo-mp', woMpPct);
  },

  setDonutStroke(elementId, percent) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;
    el.style.strokeDasharray = `${circumference}`;
    el.style.strokeDashoffset = `${offset}`;
  },

  formatUsd(val) {
    if (!val) return "$0";
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  },

  async handleSearch(query) {
    if (!query) {
      this.clearSearchResults();
      return;
    }

    const clean = query.trim().toUpperCase();
    const normalized = clean.replace(/-/g, '').replace(/:/g, '');

    // Step 1: Instant Local Search
    let matches = localItems.filter(item => {
      const pn = (item.partNumber || '').toUpperCase();
      const base = (item.basePn || pn).replace(/-/g, '').replace(/:/g, '');
      const desc = (item.description || '').toUpperCase();
      return base.includes(normalized) || pn.includes(clean) || desc.includes(clean);
    }).slice(0, 30);

    // Step 2: Cloud Search if local empty
    if (matches.length === 0) {
      document.getElementById('search-spinner').style.display = 'block';
      try {
        matches = await SupabaseService.searchItems(query);
      } catch (e) {
        console.warn("Cloud search error", e);
      } finally {
        document.getElementById('search-spinner').style.display = 'none';
      }
    }

    this.renderSearchResults(matches, clean);
  },

  renderSearchResults(results, query) {
    const chipsRow = document.getElementById('search-chips-row');
    const chipsContainer = document.getElementById('search-chips-container');
    const emptyState = document.getElementById('search-empty-state');
    const notFoundState = document.getElementById('search-not-found-state');
    const detailContainer = document.getElementById('part-detail-container');

    if (results.length === 0) {
      chipsContainer.style.display = 'none';
      emptyState.style.display = 'none';
      notFoundState.style.display = 'block';
      document.getElementById('not-found-query').textContent = query;
      detailContainer.innerHTML = '';
      return;
    }

    chipsContainer.style.display = 'block';
    emptyState.style.display = 'none';
    notFoundState.style.display = 'none';

    document.getElementById('found-count-text').textContent = `DITEMUKAN ${results.length} PART NUMBER:`;
    chipsRow.innerHTML = '';

    results.forEach((item, idx) => {
      const chip = document.createElement('div');
      chip.className = `filter-chip ${idx === 0 ? 'active' : ''}`;
      chip.innerHTML = `
        <span class="chip-pn">${item.partNumber}</span>
        <span class="chip-desc">${item.description}</span>
      `;
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.renderPartDetail(item);
      });
      chipsRow.appendChild(chip);
    });

    // Auto-select first exact or closest match
    this.renderPartDetail(results[0]);
  },

  renderPartDetail(item) {
    if (!item) return;
    selectedItem = item;
    const detailContainer = document.getElementById('part-detail-container');

    // Posture colors
    let postureColor = 'var(--accent-green)';
    if (item.postureCategory === 'EXCESS STOCK') postureColor = 'var(--accent-yellow)';
    else if (item.postureCategory === 'DEADSTOCK') postureColor = 'var(--accent-deadstock)';
    else if (item.postureCategory === 'OBSOLETE') postureColor = 'var(--accent-red)';

    const isCritical = item.stockStatus === 'CRITICAL';
    const statusColor = isCritical ? 'var(--accent-red)' : 'var(--accent-green)';
    const statusText = isCritical ? '🔴 CRITICAL' : '🟢 SAFE';

    // WO List
    let woHtml = '';
    if (item.hasWoAllocation && item.woAllocations && item.woAllocations.length > 0) {
      woHtml = item.woAllocations.map(alloc => `
        <div class="wo-allocation-box">
          <div class="wo-header-row">
            <span class="wo-number">WO #${alloc.orderNumber || alloc.order_number || ''} ${alloc.isMp ? '<span class="mp-badge">MP</span>' : ''}</span>
            <span class="wo-qty">Req: ${alloc.reqQty || alloc.req_qty || 0} ${item.uom}</span>
          </div>
          ${alloc.unitOrJobDesc ? `<div class="wo-desc">${alloc.unitOrJobDesc}</div>` : ''}
          ${alloc.plannedDate ? `<div style="font-size: 9.5px; color: var(--text-muted); margin-top: 2px;">Start: ${alloc.plannedDate}</div>` : ''}
        </div>
      `).join('');
    }

    detailContainer.innerHTML = `
      <div class="part-detail-card">
        <div class="part-header">
          <div>
            <div class="part-pn">
              ${item.partNumber}
              ${item.isMonthlyPlan ? '<span class="mp-badge">MP</span>' : ''}
            </div>
            <div class="part-desc">${item.description}</div>
          </div>
          <div>
            <div class="location-chip">
              <span>📍 Plant ${item.plant} • ${item.sloc}</span>
            </div>
            <div class="val-type-text">${item.valType} • ${item.uom}</div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="badge-row">
          <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary);">STATUS STOK & POSTURE</span>
          <div style="display: flex; gap: 6px;">
            <span class="status-badge" style="color: ${postureColor}; background: rgba(255,255,255,0.06);">${item.postureCategory}</span>
            <span class="status-badge" style="color: ${statusColor}; background: rgba(255,255,255,0.06);">${statusText}</span>
          </div>
        </div>

        <div class="stock-grid">
          <div>
            <div class="stock-metric-title">STOK ATP</div>
            <div class="stock-metric-val" style="color: ${statusColor};">${item.stockAtp}</div>
          </div>
          <div>
            <div class="stock-metric-title">MIN STOK</div>
            <div class="stock-metric-val">${item.minStock}</div>
          </div>
          <div>
            <div class="stock-metric-title">MAX STOK</div>
            <div class="stock-metric-val">${item.maxStock}</div>
          </div>
        </div>

        ${item.hasWoAllocation ? `
          <div style="margin-top: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary);">ALOKASI WORK ORDER</span>
              <span class="status-badge" style="color: var(--accent-cyan); background: rgba(0,229,255,0.1); font-size: 9px;">${item.woReadinessStatus}</span>
            </div>
            ${woHtml}
            ${item.woReadinessNote ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px;">${item.woReadinessNote}</div>` : ''}
          </div>
        ` : ''}

        <div class="hs-code-row">
          <span style="color: var(--text-secondary); font-family: monospace;">📄 HS Code: ${item.hsCode || '-'}</span>
          <span style="font-weight: 700; color: ${item.kuotaImportStatus === 'Available' ? 'var(--accent-green)' : 'var(--accent-red)'};">
            ${item.kuotaImportStatus === 'Available' ? '🟢 Kuota PI: Tersedia' : '⚠️ Kuota PI: Belum Ada'}
          </span>
        </div>
      </div>
    `;
  },

  clearSearchResults() {
    document.getElementById('search-chips-container').style.display = 'none';
    document.getElementById('search-empty-state').style.display = 'block';
    document.getElementById('search-not-found-state').style.display = 'none';
    document.getElementById('part-detail-container').innerHTML = '';
  },

  async refreshKpiSilently() {
    try {
      const freshKpi = await SupabaseService.fetchKpiSummary();
      StorageService.saveKpi(freshKpi);
      this.renderKpi(freshKpi);
    } catch (e) {
      console.warn("Silent KPI refresh skipped/failed", e);
    }
  },

  async syncFromCloud(silent = false) {
    if (isSyncing) return;
    isSyncing = true;
    const syncBtn = document.getElementById('btn-inventory-sync');
    if (syncBtn) syncBtn.classList.add('rotating');
    if (!silent) this.showToast("Menghubungkan ke Supabase Cloud...");

    try {
      // 1. Fetch KPI
      const kpi = await SupabaseService.fetchKpiSummary();
      StorageService.saveKpi(kpi);
      this.renderKpi(kpi);

      // 2. Fetch Items
      const items = await SupabaseService.fetchAllItems(1000);
      if (items && items.length > 0) {
        localItems = items;
        StorageService.saveItems(items);

        const now = new Date();
        const dateStr = `${now.getDate()}-${now.toLocaleString('default', { month: 'short' })}-${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        StorageService.saveSyncTime(dateStr, Date.now());

        this.renderCacheStats();
        if (!silent) this.showToast(`Sinkronisasi sukses! ${items.length} part tersimpan di lokal.`);
      } else {
        if (!silent) this.showToast("KPI berhasil disinkronisasi!");
      }
    } catch (err) {
      console.error("Sync error", err);
      if (!silent) this.showToast(`Gagal sinkronisasi: ${err.message}`);
    } finally {
      isSyncing = false;
      if (syncBtn) syncBtn.classList.remove('rotating');
    }
  },

  openSettingsModal() {
    this.renderCacheStats();
    document.getElementById('inventory-settings-modal').style.display = 'flex';
  },

  renderCacheStats() {
    const countEl = document.getElementById('modal-cached-count');
    const syncEl = document.getElementById('modal-last-sync');
    const lastSync = StorageService.getLastSync();
    const count = localItems.length;

    if (countEl) countEl.textContent = `${count} Part Tersimpan`;
    if (syncEl) {
      syncEl.textContent = lastSync || "Belum pernah sinkronisasi";
      syncEl.style.color = lastSync ? '#60A5FA' : '#EF4444';
    }
  },

  showToast(msg) {
    const toast = document.getElementById('global-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
};
