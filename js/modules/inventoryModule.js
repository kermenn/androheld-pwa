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

// Not Ready Bottom Sheet States (Mirroring Jetpack Compose InventoryAnalysisScreen.kt)
let notReadySelectedTab = 0; // 0 = All Reservasi, 1 = Monthly Plan
let notReadyStatusFilter = 'ALL'; // 'ALL', 'NEED REFILL', 'FOLLOW UP STO'
let notReadyQuery = '';
let notReadySearchDebounceTimer = null;

export const InventoryModule = {
  init() {
    this.renderKpi(currentKpi);
    this.renderCacheStats();
    this.updateNotReadyBanner();
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
        this.updateNotReadyBanner();
        this.clearSearchResults();
        document.getElementById('inventory-settings-modal').style.display = 'none';
        this.showToast("Cache lokal berhasil dihapus.");
      });
    }

    // --- Not Ready Feature Event Bindings ---
    const notReadyBanner = document.getElementById('btn-open-notready');
    if (notReadyBanner) {
      notReadyBanner.addEventListener('click', () => {
        this.openNotReadyModal(0);
      });
    }

    // Quick open from Readiness Donut Cards
    const donutWoAllCard = document.getElementById('donut-circle-wo-all')?.closest('.donut-card');
    if (donutWoAllCard) {
      donutWoAllCard.style.cursor = 'pointer';
      donutWoAllCard.title = "Ketuk untuk melihat part Not Ready All Reservasi";
      donutWoAllCard.addEventListener('click', () => {
        this.openNotReadyModal(0);
      });
    }

    const donutWoMpCard = document.getElementById('donut-circle-wo-mp')?.closest('.donut-card');
    if (donutWoMpCard) {
      donutWoMpCard.style.cursor = 'pointer';
      donutWoMpCard.title = "Ketuk untuk melihat part Not Ready Monthly Plan";
      donutWoMpCard.addEventListener('click', () => {
        this.openNotReadyModal(1);
      });
    }

    // Close Not Ready Modal
    const closeNotReadyBtn = document.getElementById('btn-close-notready-modal');
    if (closeNotReadyBtn) {
      closeNotReadyBtn.addEventListener('click', () => {
        this.closeNotReadyModal();
      });
    }

    const notReadyModal = document.getElementById('not-ready-modal');
    if (notReadyModal) {
      notReadyModal.addEventListener('click', (e) => {
        if (e.target === notReadyModal) {
          this.closeNotReadyModal();
        }
      });
    }

    // Tabs Switcher inside Not Ready Modal
    const tabNotReadyAll = document.getElementById('tab-notready-all');
    const tabNotReadyMp = document.getElementById('tab-notready-mp');

    if (tabNotReadyAll) {
      tabNotReadyAll.addEventListener('click', () => {
        notReadySelectedTab = 0;
        tabNotReadyAll.classList.add('active');
        if (tabNotReadyMp) tabNotReadyMp.classList.remove('active');
        this.renderNotReadyModalContent();
      });
    }

    if (tabNotReadyMp) {
      tabNotReadyMp.addEventListener('click', () => {
        notReadySelectedTab = 1;
        tabNotReadyMp.classList.add('active');
        if (tabNotReadyAll) tabNotReadyAll.classList.remove('active');
        this.renderNotReadyModalContent();
      });
    }

    // Filter Chips inside Not Ready Modal
    const chipFilterAll = document.getElementById('chip-filter-all');
    const chipFilterRefill = document.getElementById('chip-filter-refill');
    const chipFilterSto = document.getElementById('chip-filter-sto');

    const updateChipActiveStyles = () => {
      if (chipFilterAll) chipFilterAll.classList.toggle('active', notReadyStatusFilter === 'ALL');
      if (chipFilterRefill) chipFilterRefill.classList.toggle('active', notReadyStatusFilter === 'NEED REFILL');
      if (chipFilterSto) chipFilterSto.classList.toggle('active', notReadyStatusFilter === 'FOLLOW UP STO');
    };

    if (chipFilterAll) {
      chipFilterAll.addEventListener('click', () => {
        notReadyStatusFilter = 'ALL';
        updateChipActiveStyles();
        this.renderNotReadyModalContent();
      });
    }

    if (chipFilterRefill) {
      chipFilterRefill.addEventListener('click', () => {
        notReadyStatusFilter = notReadyStatusFilter === 'NEED REFILL' ? 'ALL' : 'NEED REFILL';
        updateChipActiveStyles();
        this.renderNotReadyModalContent();
      });
    }

    if (chipFilterSto) {
      chipFilterSto.addEventListener('click', () => {
        notReadyStatusFilter = notReadyStatusFilter === 'FOLLOW UP STO' ? 'ALL' : 'FOLLOW UP STO';
        updateChipActiveStyles();
        this.renderNotReadyModalContent();
      });
    }

    // Search Input inside Not Ready Modal
    const notReadySearchInput = document.getElementById('notready-search-input');
    const notReadyClearBtn = document.getElementById('notready-search-clear');

    if (notReadySearchInput) {
      notReadySearchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (notReadyClearBtn) notReadyClearBtn.style.display = val ? 'block' : 'none';

        clearTimeout(notReadySearchDebounceTimer);
        notReadySearchDebounceTimer = setTimeout(() => {
          notReadyQuery = val.trim();
          this.renderNotReadyModalContent();
        }, 150);
      });
    }

    if (notReadyClearBtn) {
      notReadyClearBtn.addEventListener('click', () => {
        if (notReadySearchInput) notReadySearchInput.value = '';
        notReadyClearBtn.style.display = 'none';
        notReadyQuery = '';
        this.renderNotReadyModalContent();
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
    const progressBar = document.getElementById('inventory-sync-progress');

    if (syncBtn) syncBtn.classList.add('rotating');
    if (progressBar) progressBar.style.display = 'block';
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
        this.updateNotReadyBanner();
        if (!silent) this.showToast(`Sinkronisasi sukses! ${items.length} part tersimpan di lokal.`);
      } else {
        this.updateNotReadyBanner();
        if (!silent) this.showToast("KPI berhasil disinkronisasi!");
      }
    } catch (err) {
      console.error("Sync error", err);
      if (!silent) this.showToast(`Gagal sinkronisasi: ${err.message}`);
    } finally {
      isSyncing = false;
      if (syncBtn) syncBtn.classList.remove('rotating');
      if (progressBar) progressBar.style.display = 'none';
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
  },

  // =========================================================================
  // NOT READY PARTS LOGIC (Mirroring Compose NotReadyPartsBottomSheet)
  // =========================================================================
  getNotReadyLists() {
    const allReservasiList = localItems.filter(item => {
      const status = (item.woReadinessStatus || '').trim().toUpperCase();
      const hasAlloc = item.hasWoAllocation || (item.woReqQty > 0) || (status !== 'NO ALLOCATION' && status !== 'READY STOCK');
      return hasAlloc && (status === 'FOLLOW UP STO' || status === 'NEED REFILL');
    });

    const mpList = localItems.filter(item => {
      const status = (item.woReadinessStatusMp || '').trim().toUpperCase();
      const hasAlloc = item.isMonthlyPlan || (item.woReqQtyMp > 0) || (status !== 'NO MP ALLOCATION' && status !== 'READY STOCK');
      return hasAlloc && (status === 'FOLLOW UP STO' || status === 'NEED REFILL');
    });

    return { allReservasiList, mpList };
  },

  updateNotReadyBanner() {
    const { allReservasiList } = this.getNotReadyLists();
    const bannerCountEl = document.getElementById('notready-banner-count');
    if (bannerCountEl) {
      bannerCountEl.textContent = `${allReservasiList.length} PART`;
    }
  },

  openNotReadyModal(tabIndex = 0) {
    notReadySelectedTab = tabIndex;
    notReadyStatusFilter = 'ALL';
    notReadyQuery = '';

    const searchInput = document.getElementById('notready-search-input');
    const clearBtn = document.getElementById('notready-search-clear');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';

    // Update tab buttons
    const tabAll = document.getElementById('tab-notready-all');
    const tabMp = document.getElementById('tab-notready-mp');
    if (tabAll) tabAll.classList.toggle('active', notReadySelectedTab === 0);
    if (tabMp) tabMp.classList.toggle('active', notReadySelectedTab === 1);

    // Update filter chips
    const chipAll = document.getElementById('chip-filter-all');
    const chipRefill = document.getElementById('chip-filter-refill');
    const chipSto = document.getElementById('chip-filter-sto');
    if (chipAll) chipAll.classList.add('active');
    if (chipRefill) chipRefill.classList.remove('active');
    if (chipSto) chipSto.classList.remove('active');

    this.renderNotReadyModalContent();
    document.getElementById('not-ready-modal').style.display = 'flex';
  },

  closeNotReadyModal() {
    const modal = document.getElementById('not-ready-modal');
    if (modal) modal.style.display = 'none';
  },

  renderNotReadyModalContent() {
    const { allReservasiList, mpList } = this.getNotReadyLists();

    // Update tab counters
    const tabAllCountEl = document.getElementById('notready-tab-all-count');
    const tabMpCountEl = document.getElementById('notready-tab-mp-count');
    if (tabAllCountEl) tabAllCountEl.textContent = allReservasiList.length;
    if (tabMpCountEl) tabMpCountEl.textContent = mpList.length;

    // Determine current active list
    const currentBaseList = notReadySelectedTab === 1 ? mpList : allReservasiList;

    // Calculate counts for chips
    const countNeedRefill = currentBaseList.filter(item => {
      const status = (notReadySelectedTab === 1 ? item.woReadinessStatusMp : item.woReadinessStatus || '').trim().toUpperCase();
      return status === 'NEED REFILL';
    }).length;

    const countFollowUpSto = currentBaseList.filter(item => {
      const status = (notReadySelectedTab === 1 ? item.woReadinessStatusMp : item.woReadinessStatus || '').trim().toUpperCase();
      return status === 'FOLLOW UP STO';
    }).length;

    // Update chip counter pills
    const chipAllCountEl = document.getElementById('notready-chip-all-count');
    const chipRefillCountEl = document.getElementById('notready-chip-refill-count');
    const chipStoCountEl = document.getElementById('notready-chip-sto-count');

    if (chipAllCountEl) chipAllCountEl.textContent = currentBaseList.length;
    if (chipRefillCountEl) chipRefillCountEl.textContent = countNeedRefill;
    if (chipStoCountEl) chipStoCountEl.textContent = countFollowUpSto;

    // Apply Filter & Search
    const filteredList = currentBaseList.filter(item => {
      const status = (notReadySelectedTab === 1 ? item.woReadinessStatusMp : item.woReadinessStatus || '').trim().toUpperCase();

      if (notReadyStatusFilter === 'NEED REFILL' && status !== 'NEED REFILL') return false;
      if (notReadyStatusFilter === 'FOLLOW UP STO' && status !== 'FOLLOW UP STO') return false;

      if (notReadyQuery) {
        const cleanQuery = notReadyQuery.toUpperCase().replace(/-/g, '').replace(/:/g, '');
        const pn = (item.partNumber || '').toUpperCase().replace(/-/g, '').replace(/:/g, '');
        const desc = (item.description || '').toUpperCase();
        const basePn = (item.basePn || '').toUpperCase().replace(/-/g, '').replace(/:/g, '');

        let woMatches = false;
        if (item.woAllocations && Array.isArray(item.woAllocations)) {
          woMatches = item.woAllocations.some(a => String(a.orderNumber || a.order_number || '').includes(notReadyQuery));
        }

        return pn.includes(cleanQuery) || basePn.includes(cleanQuery) || desc.includes(notReadyQuery.toUpperCase()) || woMatches;
      }

      return true;
    });

    const cardsContainer = document.getElementById('notready-cards-container');
    if (!cardsContainer) return;

    if (filteredList.length === 0) {
      cardsContainer.innerHTML = `
        <div class="notready-empty-card">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2" style="margin-bottom: 10px;">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <div style="font-size: 14px; font-weight: 700; color: #FFFFFF;">
            ${notReadyQuery ? `Tidak ada part cocok dengan '${notReadyQuery}'` : 'Seluruh Part Number Ready!'}
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
            ${notReadyQuery ? 'Coba ubah kata kunci pencarian atau filter status.' : 'Tidak ada part dengan defisit stok atau status Not Ready.'}
          </div>
        </div>
      `;
      return;
    }

    cardsContainer.innerHTML = filteredList.map(item => {
      const status = (notReadySelectedTab === 1 ? item.woReadinessStatusMp : item.woReadinessStatus || '').trim().toUpperCase();
      const isRefill = status === 'NEED REFILL';
      const statusClass = isRefill ? 'status-need-refill' : 'status-follow-up-sto';
      const badgeClass = isRefill ? 'need-refill' : 'follow-up-sto';
      const badgeText = isRefill ? '🔴 NEED REFILL' : '🟠 FOLLOW UP STO';

      const reqQty = notReadySelectedTab === 1 ? (item.woReqQtyMp || item.woReqQty || 0) : (item.woReqQty || 0);
      const stockAtp = item.stockAtp || 0;
      const defisit = Math.max(0, reqQty - stockAtp);
      const inTransitSto = item.inTransitStoQty || 0;

      // Extract WO list
      let woHtml = '';
      if (item.woAllocations && Array.isArray(item.woAllocations) && item.woAllocations.length > 0) {
        const woNumbers = item.woAllocations.map(a => a.orderNumber || a.order_number).filter(Boolean);
        if (woNumbers.length > 0) {
          woHtml = `
            <div class="notready-wo-row">
              <span class="notready-wo-label">WO:</span>
              ${woNumbers.map(wo => `<span class="notready-wo-tag">#${wo}</span>`).join('')}
            </div>
          `;
        }
      }

      return `
        <div class="notready-card ${statusClass}" data-pn="${item.partNumber}">
          <div class="notready-card-header">
            <div class="notready-pn-wrap">
              <span class="notready-card-pn">${item.partNumber}</span>
              ${item.isMonthlyPlan ? '<span class="mp-badge">MP</span>' : ''}
            </div>
            <span class="notready-status-badge ${badgeClass}">${badgeText}</span>
          </div>

          <div class="notready-card-desc">${item.description || 'Tanpa deskripsi part'}</div>

          <div class="notready-metric-strip">
            <div class="notready-metric-item">
              <span class="notready-metric-label">Req WO</span>
              <span class="notready-metric-val">${Math.round(reqQty)} ${item.uom || ''}</span>
            </div>
            <div class="notready-metric-item">
              <span class="notready-metric-label">Stok ATP</span>
              <span class="notready-metric-val" style="color: ${stockAtp > 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">
                ${Math.round(stockAtp)} ${item.uom || ''}
              </span>
            </div>
            <div class="notready-metric-item">
              <span class="notready-metric-label">Defisit</span>
              <span class="notready-metric-val" style="color: var(--accent-red); font-weight: 800;">
                -${Math.round(defisit)} ${item.uom || ''}
              </span>
            </div>
            <div class="notready-metric-item">
              <span class="notready-metric-label">In-Transit STO</span>
              <span class="notready-metric-val" style="color: ${inTransitSto > 0 ? 'var(--accent-yellow)' : 'var(--text-muted)'};">
                ${Math.round(inTransitSto)} ${item.uom || ''}
              </span>
            </div>
          </div>

          ${woHtml}

          <div class="notready-action-prompt">
            <span>Sentuh untuk detail lengkap</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      `;
    }).join('');

    // Attach click handlers to open detailed view
    cardsContainer.querySelectorAll('.notready-card').forEach(card => {
      card.addEventListener('click', () => {
        const pn = card.getAttribute('data-pn');
        const item = localItems.find(i => i.partNumber === pn);
        if (item) {
          this.closeNotReadyModal();
          this.renderPartDetail(item);

          // Populate main search input for quick reference
          const mainSearchInput = document.getElementById('inventory-search-input');
          const clearBtn = document.getElementById('search-clear-btn');
          if (mainSearchInput) mainSearchInput.value = item.partNumber;
          if (clearBtn) clearBtn.style.display = 'block';

          // Ensure search states display
          document.getElementById('search-chips-container').style.display = 'none';
          document.getElementById('search-empty-state').style.display = 'none';
          document.getElementById('search-not-found-state').style.display = 'none';

          // Smooth scroll to detail container
          const detailContainer = document.getElementById('part-detail-container');
          if (detailContainer) {
            detailContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });
  }
};

