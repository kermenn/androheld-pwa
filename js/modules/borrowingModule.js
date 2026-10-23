/* ==========================================================================
   AndroHeld Web - Borrowing Parts Module (Mirroring BorrowingMonitoringScreen.kt)
   Offline-First loan tracking & Microsoft Lists sync via Power Automate
   ========================================================================== */

const MS_FORMS_NEW_BORROWING_URL = "https://forms.office.com/r/kKj7wB8z2P";
const MS_FORMS_RETURN_URL = "https://forms.office.com/r/8nFjT7Qx4M";
const DEFAULT_WEBHOOK_URL = "https://defaultb7cf3d786cbd4ac29956f68ab60960.bf.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/07/workflows/613c3dbfe08e4cf597a46dc83b9e7c6d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=HbkRGpuwB5sVe4ZANYGY6UzKqd9HQmSRCfxouwQbw0k";

const STORAGE_KEYS = {
  ITEMS: "androheld_cached_borrowings",
  LAST_SYNC: "androheld_last_borrowing_sync",
  WEBHOOK_URL: "androheld_borrowing_webhook_url"
};

// 40 Baseline Records directly seeded from Database_Borrowing_Parts.csv
const BASELINE_BORROWINGS = [
  { id: 8, borrowingId: "BR-8", created: "9/20/2026 12:25 PM", requestorEmail: "muamar.syarif@trakindo.co.id", plant: "1H45", partNumber: "7X2455:AA", quantity: 4, promiseDate: "10/16/2026", approvedBy: "Muhammad Riski", status: "Returned", returnDate: "10/19/2026", returnPo: "4202948796" },
  { id: 19, borrowingId: "BR-19", created: "9/22/2026 5:02 AM", requestorEmail: "XUPJ21MBT@trakindo.co.id", plant: "1H45", partNumber: "4992970:AA", quantity: 10, promiseDate: "10/7/2026", approvedBy: "Yusril Irgi Wafir", status: "Returned", returnDate: "10/12/2026", returnPo: "5001422154" },
  { id: 21, borrowingId: "BR-21", created: "9/22/2026 6:12 AM", requestorEmail: "hudha.setiawan@trakindo.co.id", plant: "1G38", partNumber: "2G6204:AA", quantity: 1, promiseDate: "10/20/2026", approvedBy: "Yusril Irgi Wafir", status: "Open", returnDate: "", returnPo: "" },
  { id: 22, borrowingId: "BR-22", created: "9/22/2026 6:24 AM", requestorEmail: "agustina.d.cahyani@trakindo.co.id", plant: "1H34", partNumber: "2G6204:AA", quantity: 1, promiseDate: "10/20/2026", approvedBy: "Yusril Irgi Wafir", status: "Returned", returnDate: "10/22/2026", returnPo: "5001428995" },
  { id: 23, borrowingId: "BR-23", created: "9/22/2026 6:25 AM", requestorEmail: "setyono.maruwi@trakindo.co.id", plant: "1456", partNumber: "3805940:AA", quantity: 1, promiseDate: "10/9/2026", approvedBy: "Yusril Irgi Wafir", status: "Returned", returnDate: "10/8/2026", returnPo: "4202936097" },
  { id: 24, borrowingId: "BR-24", created: "9/22/2026 6:25 AM", requestorEmail: "setyono.maruwi@trakindo.co.id", plant: "1456", partNumber: "3805938:AA", quantity: 1, promiseDate: "10/10/2026", approvedBy: "Yusril Irgi Wafir", status: "Returned", returnDate: "10/8/2026", returnPo: "4202936097" },
  { id: 28, borrowingId: "BR-28", created: "9/22/2026 6:30 AM", requestorEmail: "rahmad.suriansyah@trakindo.co.id", plant: "1456", partNumber: "3097679:AA", quantity: 4, promiseDate: "9/29/2026", approvedBy: "Yusril Irgi Wafir", status: "Returned", returnDate: "10/20/2026", returnPo: "4202951120" },
  { id: 31, borrowingId: "BR-31", created: "9/22/2026 7:12 AM", requestorEmail: "linda.maryani@trakindo.co.id", plant: "1H35", partNumber: "2307162:AA", quantity: 12, promiseDate: "10/7/2026", approvedBy: "Yusril Irgi Wafir", status: "Open", returnDate: "", returnPo: "" },
  { id: 32, borrowingId: "BR-32", created: "9/22/2026 9:20 AM", requestorEmail: "XUPJ21HAU@trakindo.co.id", plant: "1456", partNumber: "3111299:AA", quantity: 23, promiseDate: "10/7/2026", approvedBy: "Yusril Irgi Wafir", status: "Returned", returnDate: "10/18/2026", returnPo: "4202948537" },
  { id: 33, borrowingId: "BR-33", created: "9/23/2026 3:13 PM", requestorEmail: "ellya.nursehan@trakindo.co.id", plant: "1H34", partNumber: "5720339:AA", quantity: 1, promiseDate: "10/20/2026", approvedBy: "Yusril Irgi Wafir", status: "Returned", returnDate: "10/31/2026", returnPo: "4101890421" },
  { id: 34, borrowingId: "BR-34", created: "9/23/2026 4:34 PM", requestorEmail: "XUPJ21SNR@trakindo.co.id", plant: "1H35", partNumber: "4304192:AA", quantity: 2, promiseDate: "11/25/2026", approvedBy: "Yusril Irgi Wafir", status: "Open", returnDate: "", returnPo: "" },
  { id: 35, borrowingId: "BR-35", created: "9/24/2026 7:20 AM", requestorEmail: "letisia.ayuni@trakindo.co.id", plant: "1H45", partNumber: "4471258:AA", quantity: 1, promiseDate: "10/31/2026", approvedBy: "Yusril Irgi Wafir", status: "Open", returnDate: "", returnPo: "" },
  { id: 36, borrowingId: "BR-36", created: "9/24/2026 7:20 AM", requestorEmail: "letisia.ayuni@trakindo.co.id", plant: "1H45", partNumber: "4471261:AA", quantity: 2, promiseDate: "10/31/2026", approvedBy: "Yusril Irgi Wafir", status: "Open", returnDate: "", returnPo: "" },
  { id: 37, borrowingId: "BR-37", created: "9/24/2026 7:44 AM", requestorEmail: "XUPJ21HAU@trakindo.co.id", plant: "1456", partNumber: "8X0573:AA", quantity: 1, promiseDate: "10/7/2026", approvedBy: "Yusril Irgi Wafir", status: "Returned", returnDate: "10/8/2026", returnPo: "4202936106" },
  { id: 38, borrowingId: "BR-38", created: "9/24/2026 7:54 AM", requestorEmail: "veby.tirtayana@trakindo.co.id", plant: "1H35", partNumber: "5297106:AA", quantity: 1, promiseDate: "10/8/2026", approvedBy: "Yusril Irgi Wafir", status: "Open", returnDate: "", returnPo: "" },
  { id: 39, borrowingId: "BR-39", created: "9/24/2026 4:17 PM", requestorEmail: "fitri.rahmawati@trakindo.co.id", plant: "1691", partNumber: "11R1853:AA", quantity: 1, promiseDate: "10/16/2026", approvedBy: "Yusril Irgi Wafir", status: "Returned", returnDate: "10/20/2026", returnPo: "5001427710" },
  { id: 40, borrowingId: "BR-40", created: "9/24/2026 4:22 PM", requestorEmail: "santeri.ardani@trakindo.co.id", plant: "1H35", partNumber: "7W0443:AA", quantity: 4, promiseDate: "9/24/2026", approvedBy: "Yusril Irgi Wafir", status: "Returned", returnDate: "9/28/2026", returnPo: "4202923927" },
  { id: 41, borrowingId: "BR-41", created: "9/24/2026 9:32 PM", requestorEmail: "hendra.merdekansyah@trakindo.co.id", plant: "1456", partNumber: "6545958:AA", quantity: 1, promiseDate: "11/10/2026", approvedBy: "Yusril Irgi Wafir", status: "Open", returnDate: "", returnPo: "" },
  { id: 42, borrowingId: "BR-42", created: "9/25/2026 10:03 AM", requestorEmail: "mohammad.n.ridhani@trakindo.co.id", plant: "1H35", partNumber: "5P1948:AA", quantity: 1, promiseDate: "10/2/2026", approvedBy: "Yusril Irgi Wafir", status: "Returned", returnDate: "9/30/2026", returnPo: "5001415174" },
  { id: 43, borrowingId: "BR-43", created: "9/25/2026 3:01 PM", requestorEmail: "masreza.m.sutadisastra@trakindo.co.id", plant: "1341", partNumber: "1D4593:AA", quantity: 8, promiseDate: "10/30/2026", approvedBy: "Yusril Irgi Wafir", status: "Open", returnDate: "", returnPo: "" },
  { id: 44, borrowingId: "BR-44", created: "9/28/2026 5:27 AM", requestorEmail: "dwi.anggraini@trakindo.co.id", plant: "1H35", partNumber: "6396515:AA", quantity: 1, promiseDate: "10/4/2026", approvedBy: "Ahmad Juwaini", status: "Returned", returnDate: "10/3/2026", returnPo: "4202929945" },
  { id: 45, borrowingId: "BR-45", created: "9/29/2026 7:58 AM", requestorEmail: "XUPJ21MXK@trakindo.co.id", plant: "1329", partNumber: "2891473:AA", quantity: 1, promiseDate: "10/21/2026", approvedBy: "Muhammad Riski", status: "Returned", returnDate: "10/21/2026", returnPo: "5001428432" },
  { id: 46, borrowingId: "BR-46", created: "9/29/2026 3:49 PM", requestorEmail: "XUPJ21PHX@trakindo.co.id", plant: "1H35", partNumber: "8X0573:AA", quantity: 1, promiseDate: "10/7/2026", approvedBy: "Ahmad Hidayat", status: "Returned", returnDate: "10/5/2026", returnPo: "5001418074" },
  { id: 47, borrowingId: "BR-47", created: "9/29/2026 6:52 PM", requestorEmail: "yosafat.b.purba@trakindo.co.id", plant: "1W57", partNumber: "6426546:AA", quantity: 3, promiseDate: "10/8/2026", approvedBy: "Muhammad Andi Aziz Nur", status: "Open", returnDate: "", returnPo: "" },
  { id: 48, borrowingId: "BR-48", created: "9/30/2026 9:46 AM", requestorEmail: "XUPJ21TWH@trakindo.co.id", plant: "1454", partNumber: "2882747:AA", quantity: 1, promiseDate: "11/30/2026", approvedBy: "Muhammad Andi Aziz Nur", status: "Open", returnDate: "", returnPo: "" },
  { id: 49, borrowingId: "BR-49", created: "9/30/2026 12:38 PM", requestorEmail: "anjar.herbowo@trakindo.co.id", plant: "1G69", partNumber: "2891473:AA", quantity: 1, promiseDate: "10/30/2026", approvedBy: "Ahmad Hidayat", status: "Open", returnDate: "", returnPo: "" },
  { id: 50, borrowingId: "BR-50", created: "10/1/2026 9:56 AM", requestorEmail: "XUPJ21XMD@trakindo.co.id", plant: "1456", partNumber: "2197569:AA", quantity: 64, promiseDate: "10/20/2026", approvedBy: "Muhammad Andi Aziz Nur", status: "Open", returnDate: "", returnPo: "" },
  { id: 51, borrowingId: "BR-51", created: "10/1/2026 4:29 PM", requestorEmail: "muhammad.y.fadila@trakindo.co.id", plant: "1H04", partNumber: "1242121:AA", quantity: 2, promiseDate: "10/5/2026", approvedBy: "Ahmad Juwaini", status: "Returned", returnDate: "10/5/2026", returnPo: "4202931748" },
  { id: 52, borrowingId: "BR-52", created: "10/2/2026 1:47 PM", requestorEmail: "herri.johairi@trakindo.co.id", plant: "1G56", partNumber: "7G8282:AA", quantity: 2, promiseDate: "10/31/2026", approvedBy: "Yusril Irgi Wafir", status: "Cancelled", returnDate: "", returnPo: "" },
  { id: 53, borrowingId: "BR-53", created: "10/2/2026 2:31 PM", requestorEmail: "XUPJ21JPD@trakindo.co.id", plant: "1241", partNumber: "5705856:AA", quantity: 1, promiseDate: "10/30/2026", approvedBy: "Yusril Irgi Wafir", status: "Open", returnDate: "", returnPo: "" },
  { id: 54, borrowingId: "BR-54", created: "10/3/2026 10:03 AM", requestorEmail: "XUPJ21MBT@trakindo.co.id", plant: "1H5", partNumber: "7H3609:AA", quantity: 35, promiseDate: "10/17/2026", approvedBy: "Muhammad Riski", status: "Open", returnDate: "", returnPo: "" },
  { id: 55, borrowingId: "BR-55", created: "10/3/2026 1:05 PM", requestorEmail: "titin.d.sitoresmi@trakindo.co.id", plant: "1H35", partNumber: "4227553:AA", quantity: 1, promiseDate: "10/12/2026", approvedBy: "Ahmad Juwaini", status: "Open", returnDate: "", returnPo: "" },
  { id: 56, borrowingId: "BR-56", created: "10/7/2026 10:15 AM", requestorEmail: "rahmad.fauzan@trakindo.co.id", plant: "1H35", partNumber: "5117089:AA", quantity: 1, promiseDate: "1/22/2027", approvedBy: "Ahmad Hidayat", status: "Open", returnDate: "", returnPo: "" },
  { id: 57, borrowingId: "BR-57", created: "10/7/2026 4:16 PM", requestorEmail: "firhan.syah@trakindo.co.id", plant: "1H04", partNumber: "8T4223:AA", quantity: 4, promiseDate: "10/12/2026", approvedBy: "Yusril Irgi Wafir", status: "Returned", returnDate: "10/11/2026", returnPo: "5001421616" },
  { id: 58, borrowingId: "BR-58", created: "10/8/2026 8:07 AM", requestorEmail: "XUPJ21XET@trakindo.co.id", plant: "1456", partNumber: "3S2708:AA", quantity: 20, promiseDate: "10/11/2026", approvedBy: "Yusril Irgi Wafir", status: "Open", returnDate: "", returnPo: "" },
  { id: 59, borrowingId: "BR-59", created: "10/12/2026 10:39 AM", requestorEmail: "setiadi.nugroho@trakindo.co.id", plant: "1456", partNumber: "5337117:AA", quantity: 1, promiseDate: "10/14/2026", approvedBy: "Yusril Irgi Wafir", status: "Returned", returnDate: "10/15/2026", returnPo: "4202945470" },
  { id: 60, borrowingId: "BR-60", created: "10/14/2026 5:25 PM", requestorEmail: "XUPJ21XMU@trakindo.co.id", plant: "1G38", partNumber: "1362422:AA", quantity: 1, promiseDate: "10/29/2026", approvedBy: "Yusril Irgi Wafir", status: "Open", returnDate: "", returnPo: "" },
  { id: 61, borrowingId: "BR-61", created: "10/15/2026 12:15 PM", requestorEmail: "a.junaidi@trakindo.co.id", plant: "1G06", partNumber: "2153634-T:NM", quantity: 1, promiseDate: "10/26/2026", approvedBy: "Yusril Irgi Wafir", status: "Open", returnDate: "", returnPo: "" },
  { id: 62, borrowingId: "BR-62", created: "10/15/2026 12:35 PM", requestorEmail: "XUPJ21WBA@trakindo.co.id", plant: "1H64", partNumber: "4992970:AA", quantity: 10, promiseDate: "10/30/2026", approvedBy: "Yusril Irgi Wafir", status: "Open", returnDate: "", returnPo: "" }
];

export const BorrowingModule = {
  items: [],
  selectedTab: 0, // 0 = MONITORING (Open), 1 = HISTORY (Returned/Cancelled)
  selectedPlant: "ALL",
  sortOption: "OVERDUE_DESC", // OVERDUE_DESC, NEWEST
  searchQuery: "",
  isSyncing: false,

  init() {
    this.loadState();
    this.renderKpi();
    this.renderPlantFilters();
    this.renderList();
    this.bindEvents();
  },

  loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ITEMS);
      if (raw) {
        this.items = JSON.parse(raw);
      } else {
        this.items = [...BASELINE_BORROWINGS];
        this.saveState();
      }
    } catch (e) {
      console.warn("Borrowing items read error", e);
      this.items = [...BASELINE_BORROWINGS];
    }
  },

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(this.items));
    } catch (e) {
      console.error("Borrowing items write error", e);
    }
  },

  bindEvents() {
    // Top Bar Back
    const backBtn = document.getElementById('btn-borrowing-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.navigateTo('home');
      });
    }

    // Sync button
    const syncBtn = document.getElementById('btn-borrowing-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.syncFromCloud(false);
      });
    }

    // Settings button & Modal
    const settingsBtn = document.getElementById('btn-borrowing-settings');
    const settingsModal = document.getElementById('borrowing-settings-modal');
    const closeSettingsBtn = document.getElementById('btn-close-borrowing-settings');
    const saveWebhookBtn = document.getElementById('btn-save-borrowing-webhook');
    const resetDataBtn = document.getElementById('btn-reset-borrowing-data');

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.openSettingsModal();
      });
    }

    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener('click', () => {
        if (settingsModal) settingsModal.style.display = 'none';
      });
    }

    if (settingsModal) {
      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.style.display = 'none';
      });
    }

    if (saveWebhookBtn) {
      saveWebhookBtn.addEventListener('click', () => {
        const input = document.getElementById('borrowing-webhook-input');
        if (input) {
          const url = input.value.trim();
          localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, url);
          this.showToast("Webhook URL tersimpan!");
          if (settingsModal) settingsModal.style.display = 'none';
        }
      });
    }

    if (resetDataBtn) {
      resetDataBtn.addEventListener('click', () => {
        if (confirm("Reset seluruh data peminjaman ke baseline awal (40 data)?")) {
          this.items = [...BASELINE_BORROWINGS];
          this.saveState();
          this.renderKpi();
          this.renderPlantFilters();
          this.renderList();
          if (settingsModal) settingsModal.style.display = 'none';
          this.showToast("Data peminjaman di-reset ke baseline.");
        }
      });
    }

    // Banner Actions
    const copyFormBtn = document.getElementById('btn-borrowing-copy-form');
    if (copyFormBtn) {
      copyFormBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(MS_FORMS_NEW_BORROWING_URL).then(() => {
          this.showToast("Link form MS Forms disalin ke clipboard!");
        }).catch(() => {
          this.showToast("Link: " + MS_FORMS_NEW_BORROWING_URL);
        });
      });
    }

    const openFormBtn = document.getElementById('btn-borrowing-open-form');
    if (openFormBtn) {
      openFormBtn.addEventListener('click', () => {
        window.open(MS_FORMS_NEW_BORROWING_URL, '_blank');
      });
    }

    // Tabs Switcher
    const tabMonitoring = document.getElementById('tab-borrowing-monitoring');
    const tabHistory = document.getElementById('tab-borrowing-history');

    if (tabMonitoring) {
      tabMonitoring.addEventListener('click', () => {
        this.selectedTab = 0;
        tabMonitoring.classList.add('active');
        if (tabHistory) tabHistory.classList.remove('active');
        this.renderList();
      });
    }

    if (tabHistory) {
      tabHistory.addEventListener('click', () => {
        this.selectedTab = 1;
        tabHistory.classList.add('active');
        if (tabMonitoring) tabMonitoring.classList.remove('active');
        this.renderList();
      });
    }

    // Search Input
    const searchInput = document.getElementById('borrowing-search-input');
    const clearSearchBtn = document.getElementById('borrowing-search-clear');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        if (clearSearchBtn) clearSearchBtn.style.display = this.searchQuery ? 'block' : 'none';
        this.renderList();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        clearSearchBtn.style.display = 'none';
        this.renderList();
      });
    }

    // Sort Dropdown
    const sortSelect = document.getElementById('borrowing-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortOption = e.target.value;
        this.renderList();
      });
    }
  },

  getOverdueDays(promiseDateStr) {
    if (!promiseDateStr) return 0;
    try {
      const parts = promiseDateStr.split('/');
      if (parts.length === 3) {
        // format M/D/YYYY
        const promiseDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffMs = today.getTime() - promiseDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
      }
    } catch (e) {}
    return 0;
  },

  renderKpi() {
    const openItems = this.items.filter(i => (i.status || '').toLowerCase() === 'open');
    const overdueItems = openItems.filter(i => this.getOverdueDays(i.promiseDate) > 0);
    const returnedItems = this.items.filter(i => (i.status || '').toLowerCase() === 'returned');

    const openEl = document.getElementById('borrowing-kpi-open');
    const overdueEl = document.getElementById('borrowing-kpi-overdue');
    const returnedEl = document.getElementById('borrowing-kpi-returned');

    if (openEl) openEl.textContent = openItems.length;
    if (overdueEl) overdueEl.textContent = overdueItems.length;
    if (returnedEl) returnedEl.textContent = returnedItems.length;

    // Tab badges
    const tabOpenPill = document.getElementById('borrowing-tab-open-pill');
    const tabHistoryPill = document.getElementById('borrowing-tab-history-pill');
    const historyCount = this.items.length - openItems.length;

    if (tabOpenPill) tabOpenPill.textContent = openItems.length;
    if (tabHistoryPill) tabHistoryPill.textContent = historyCount;
  },

  renderPlantFilters() {
    const chipsContainer = document.getElementById('borrowing-plant-chips');
    if (!chipsContainer) return;

    // Distinct plants
    const plantSet = new Set();
    this.items.forEach(i => {
      const p = (i.plant || '').trim();
      if (p) plantSet.add(p);
    });

    const plants = ["ALL", ...Array.from(plantSet).sort()];

    chipsContainer.innerHTML = plants.map(plant => `
      <button class="borrowing-chip ${this.selectedPlant === plant ? 'active' : ''}" data-plant="${plant}">
        ${plant === 'ALL' ? 'Semua Plant' : `Plant ${plant}`}
      </button>
    `).join('');

    chipsContainer.querySelectorAll('.borrowing-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedPlant = btn.getAttribute('data-plant');
        chipsContainer.querySelectorAll('.borrowing-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderList();
      });
    });
  },

  renderList() {
    const listContainer = document.getElementById('borrowing-cards-list');
    if (!listContainer) return;

    // Filter by Tab (0 = Open/Monitoring, 1 = History/Returned)
    let filtered = this.items.filter(item => {
      const isStatusOpen = (item.status || '').toLowerCase() === 'open';
      return this.selectedTab === 0 ? isStatusOpen : !isStatusOpen;
    });

    // Filter by Plant
    if (this.selectedPlant !== "ALL") {
      filtered = filtered.filter(item => (item.plant || '').trim() === this.selectedPlant);
    }

    // Filter by Search Query
    if (this.searchQuery) {
      filtered = filtered.filter(item => {
        const id = (item.borrowingId || '').toLowerCase();
        const pn = (item.partNumber || '').toLowerCase().replace(/[-:]/g, '');
        const email = (item.requestorEmail || '').toLowerCase();
        const cleanQuery = this.searchQuery.replace(/[-:]/g, '');
        return id.includes(this.searchQuery) || pn.includes(cleanQuery) || email.includes(this.searchQuery);
      });
    }

    // Sort
    filtered.sort((a, b) => {
      if (this.sortOption === 'OVERDUE_DESC') {
        const aOverdue = this.getOverdueDays(a.promiseDate);
        const bOverdue = this.getOverdueDays(b.promiseDate);
        if (aOverdue !== bOverdue) return bOverdue - aOverdue;
        return (b.id || 0) - (a.id || 0);
      } else {
        // NEWEST
        return (b.id || 0) - (a.id || 0);
      }
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="borrowing-empty-state">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" stroke-width="1.8" style="margin-bottom: 8px;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div style="font-size: 14px; font-weight: 700; color: #FFFFFF;">Tidak Ada Data Pinjaman</div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
            ${this.searchQuery ? `Tidak ada data yang cocok dengan '${this.searchQuery}'` : (this.selectedTab === 0 ? 'Semua part yang dipinjam telah dikembalikan!' : 'Belum ada riwayat pengembalian.')}
          </div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(item => {
      const isReturned = (item.status || '').toLowerCase() === 'returned';
      const isCancelled = (item.status || '').toLowerCase() === 'cancelled';
      const overdueDays = this.getOverdueDays(item.promiseDate);
      const isOverdue = !isReturned && !isCancelled && overdueDays > 0;

      let badgeHtml = '';
      if (isReturned) {
        badgeHtml = `<span class="borrowing-status-pill pill-returned">✓ RETURNED</span>`;
      } else if (isCancelled) {
        badgeHtml = `<span class="borrowing-status-pill pill-cancelled">CANCELLED</span>`;
      } else if (isOverdue) {
        badgeHtml = `<span class="borrowing-status-pill pill-overdue">🔴 ${overdueDays} HARI TERLAMBAT</span>`;
      } else {
        badgeHtml = `<span class="borrowing-status-pill pill-open">OPEN (AKTIF)</span>`;
      }

      return `
        <div class="borrowing-card ${isOverdue ? 'card-overdue' : ''}">
          <div class="borrowing-card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="borrowing-card-id">${item.borrowingId || `BR-${item.id}`}</span>
              <span class="borrowing-plant-badge">Plant ${item.plant}</span>
            </div>
            ${badgeHtml}
          </div>

          <div class="borrowing-pn-row">
            <span class="borrowing-pn-code">${item.partNumber}</span>
            <span class="borrowing-qty-badge">Qty: ${item.quantity} PC</span>
          </div>

          <div class="borrowing-meta-grid">
            <div class="borrowing-meta-item">
              <span class="borrowing-meta-label">REQUESTOR</span>
              <span class="borrowing-meta-val" title="${item.requestorEmail}">${item.requestorEmail.split('@')[0]}</span>
            </div>
            <div class="borrowing-meta-item">
              <span class="borrowing-meta-label">JANJI KEMBALI</span>
              <span class="borrowing-meta-val" style="color: ${isOverdue ? 'var(--accent-red)' : '#FFFFFF'};">
                ${item.promiseDate || '-'}
              </span>
            </div>
            ${isReturned ? `
              <div class="borrowing-meta-item">
                <span class="borrowing-meta-label">TGL KEMBALI</span>
                <span class="borrowing-meta-val" style="color: var(--accent-green);">${item.returnDate || '-'}</span>
              </div>
              <div class="borrowing-meta-item">
                <span class="borrowing-meta-label">NO. STO / PO</span>
                <span class="borrowing-meta-val" style="font-family: monospace;">${item.returnPo || '-'}</span>
              </div>
            ` : ''}
          </div>

          ${!isReturned && !isCancelled ? `
            <div class="borrowing-actions-row">
              <button class="borrowing-return-btn" data-id="${item.borrowingId}" data-pn="${item.partNumber}">
                <span>🔄 Kembalikan Part (MS Forms)</span>
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Attach return buttons
    listContainer.querySelectorAll('.borrowing-return-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.open(MS_FORMS_RETURN_URL, '_blank');
      });
    });
  },

  async syncFromCloud(silent = false) {
    if (this.isSyncing) return;
    this.isSyncing = true;

    const syncBtn = document.getElementById('btn-borrowing-sync');
    const progressBar = document.getElementById('borrowing-sync-progress');
    if (syncBtn) syncBtn.classList.add('rotating');
    if (progressBar) progressBar.style.display = 'block';

    if (!silent) this.showToast("Menghubungi Microsoft Lists via Power Automate...");

    const webhookUrl = localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || DEFAULT_WEBHOOK_URL;

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "get_borrowings", timestamp: Date.now() })
      });

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Map fields
        this.items = data.map((d, idx) => ({
          id: d.ID || d.id || idx + 1,
          borrowingId: d.Borrowing_ID || d.borrowing_id || `BR-${d.ID || idx + 1}`,
          created: d.Created || d.created || "",
          requestorEmail: d.Requestor_Email || d.requestor_email || "",
          plant: d.Borrowing_Plant || d.plant || "1346",
          partNumber: d.Part_Number || d.part_number || "",
          quantity: parseFloat(d.Quantity || d.quantity || 1),
          promiseDate: d.Promise_Return_Date || d.promise_return_date || "",
          approvedBy: d.Approved_By || d.approved_by || "",
          status: d.Status || d.status || "Open",
          returnDate: d.Return_Date || d.return_date || "",
          returnPo: d["STO / PO Return"] || d.sto_po_return || ""
        }));

        this.saveState();
        const now = new Date();
        const dateStr = `${now.getDate()}-${now.toLocaleString('default', { month: 'short' })}-${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, dateStr);

        this.renderKpi();
        this.renderPlantFilters();
        this.renderList();
        if (!silent) this.showToast(`Sinkronisasi sukses! ${this.items.length} pinjaman diperbarui.`);
      } else {
        if (!silent) this.showToast("Data Microsoft Lists sudah paling mutakhir.");
      }
    } catch (e) {
      console.warn("Power Automate webhook sync warning", e);
      if (!silent) this.showToast("Menggunakan cache lokal Microsoft Lists.");
    } finally {
      this.isSyncing = false;
      if (syncBtn) syncBtn.classList.remove('rotating');
      if (progressBar) progressBar.style.display = 'none';
    }
  },

  openSettingsModal() {
    const modal = document.getElementById('borrowing-settings-modal');
    if (!modal) return;

    const countEl = document.getElementById('modal-borrowing-cached-count');
    const syncEl = document.getElementById('modal-borrowing-last-sync');
    const input = document.getElementById('borrowing-webhook-input');

    if (countEl) countEl.textContent = `${this.items.length} Data Tersimpan`;
    if (syncEl) syncEl.textContent = localStorage.getItem(STORAGE_KEYS.LAST_SYNC) || "Baseline Seeding (40 Data)";
    if (input) input.value = localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || DEFAULT_WEBHOOK_URL;

    modal.style.display = 'flex';
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
