/* ==========================================================================
   AndroHeld Web - Roster Schedule & Shift Rotation Module
   100% Identical to Jetpack Compose RosterScreen.kt & RosterEngine.kt
   Offline-First Architecture with Two-Way Supabase Cloud Synchronization
   ========================================================================== */

import { CONFIG } from '../config.js';

const STORAGE_KEYS = {
  EMPLOYEES: "androheld_roster_employees",
  OVERRIDES: "androheld_roster_overrides",
  ADMIN_PIN: "androheld_roster_admin_pin",
  LAST_SYNC: "androheld_roster_last_sync"
};

const DEFAULT_ADMIN_PIN = "1234";

const SHIFT_DEFS = {
  "D": { code: "D", name: "Day Shift", hours: "06.00 - 18.00", ot: 3, bg: "#00E676", fg: "#000000", desc: "Standby Day Shift (+3h OT)" },
  "DN": { code: "DN", name: "Day Normal", hours: "06.00 - 15.00", ot: 0, bg: "#2979FF", fg: "#FFFFFF", desc: "Day Normal Shift (Regular)" },
  "N": { code: "N", name: "Night Shift", hours: "18.00 - 06.00", ot: 4, bg: "#FF9100", fg: "#FFFFFF", desc: "Night Shift (+4h OT)" },
  "OFF": { code: "OFF", name: "Off", hours: "-", ot: 0, bg: "#EF5350", fg: "#FFFFFF", desc: "Day Off / Libur" },
  "FB": { code: "FB", name: "Field Break", hours: "-", ot: 0, bg: "#FFB300", fg: "#000000", desc: "Field Break / Roster Off" },
  "CT": { code: "CT", name: "Annual Leave", hours: "-", ot: 0, bg: "#AB47BC", fg: "#FFFFFF", desc: "Cuti / Annual Leave" }
};

const ENGLISH_MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Baseline Fallback Employees
const BASELINE_EMPLOYEES = [
  {
    id: 2,
    no: 1,
    name: "Muhammad Riski",
    sn: "10003005",
    position: "Counterman",
    location: "CK BMB - Sitarum",
    phone: "082213902917",
    patternId: "night_rotation_15",
    refDate: "2026-10-01",
    refCycleIndex: 12,
    notes: "Rotasi malam 15 hari (5 Siang - 2 OFF - 5 Malam - 3 OFF)"
  },
  {
    id: 3,
    no: 2,
    name: "Ahmad Hidayat",
    sn: "10003599",
    position: "Counterman",
    location: "CK BMB - Sitarum",
    phone: "085750973830",
    patternId: "regular_5_2",
    refDate: "2026-10-01",
    refCycleIndex: 3,
    notes: "Jadwal reguler 5:2 (Sabtu-Minggu Libur)"
  },
  {
    id: 4,
    no: 3,
    name: "Syaiful Rahman",
    sn: "7775",
    position: "Counterman",
    location: "CK BMB - Sitarum",
    phone: "08125173278",
    patternId: "regular_5_2",
    refDate: "2026-10-01",
    refCycleIndex: 3,
    notes: "Jadwal reguler 5:2 (Sabtu-Minggu Libur)"
  },
  {
    id: 5,
    no: 4,
    name: "Ahmad Juwaini",
    sn: "23464",
    position: "Counterman",
    location: "CK BMB - Sitarum",
    phone: "085246366410",
    patternId: "regular_5_2",
    refDate: "2026-10-01",
    refCycleIndex: 0,
    notes: "Jadwal reguler 5:2 (Selasa-Rabu Libur agar standby tetap cover)"
  }
];

function getSupabaseHeaders() {
  const key = CONFIG.SUPABASE_KEY;
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
}

export const RosterModule = {
  employees: [],
  overrides: {},
  currentYear: 2026,
  currentMonth: 10, // 1-indexed (10 = OCTOBER)
  isAdminMode: false,
  selectedRoleFilter: "ALL", // "ALL", "COUNTERMAN", "WAREHOUSEMAN"
  selectedCell: null, // { employeeId, employeeName, dateIso, currentShift }
  isLoading: false,

  async init() {
    this.loadState();
    this.renderMonthHeader();
    this.renderMatrixTable();
    this.bindEvents();

    // Check if we need to load offline seed first
    const hasCachedOverrides = localStorage.getItem(STORAGE_KEYS.OVERRIDES);
    if (!hasCachedOverrides) {
      await this.loadSeedData();
      this.refreshView();
    }

    // Automatically synchronize live data with Supabase Cloud (Silent Background Sync)
    this.pullFromSupabase(false);
  },

  loadState() {
    try {
      const empRaw = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
      this.employees = empRaw ? JSON.parse(empRaw) : [...BASELINE_EMPLOYEES];

      const ovRaw = localStorage.getItem(STORAGE_KEYS.OVERRIDES);
      this.overrides = ovRaw ? JSON.parse(ovRaw) : {};
    } catch (e) {
      console.warn("Roster load error", e);
      this.employees = [...BASELINE_EMPLOYEES];
      this.overrides = {};
    }
  },

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(this.employees));
      localStorage.setItem(STORAGE_KEYS.OVERRIDES, JSON.stringify(this.overrides));
    } catch (e) {
      console.error("Roster save error", e);
    }
  },

  async loadSeedData() {
    try {
      const res = await fetch('./data/roster_store.json');
      if (res.ok) {
        const data = await res.json();
        if (data.employees && Array.isArray(data.employees) && data.employees.length > 0) {
          this.employees = data.employees.map((e, idx) => ({
            id: e.id,
            no: e.no || (idx + 1),
            name: e.name,
            sn: e.sn || '',
            position: e.position || 'Counterman',
            location: e.location || 'CK BMB - Sitarum',
            phone: e.phone || '',
            patternId: e.pattern_id || 'regular_5_2',
            refDate: e.ref_date || '2026-10-01',
            refCycleIndex: e.ref_cycle_index || 0,
            notes: e.notes || ''
          }));
          localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(this.employees));
        }
        if (data.overrides && typeof data.overrides === 'object') {
          this.overrides = { ...data.overrides };
          localStorage.setItem(STORAGE_KEYS.OVERRIDES, JSON.stringify(this.overrides));
        }
      }
    } catch (err) {
      console.warn("Could not load local roster_store.json seed:", err);
    }
  },

  // -------------------------------------------------------------
  // Supabase Cloud Sync Methods (Multi-Device & Live Database)
  // -------------------------------------------------------------
  async pullFromSupabase(isManual = false) {
    if (this.isLoading) return;
    this.isLoading = true;

    const syncBtn = document.getElementById('btn-roster-sync');
    if (syncBtn) syncBtn.classList.add('rotating');

    try {
      const headers = getSupabaseHeaders();

      // 1. Fetch live employees from Supabase
      const empUrl = `${CONFIG.SUPABASE_URL}/rest/v1/roster_employees?select=*&order=no.asc`;
      const empRes = await fetch(empUrl, { method: 'GET', headers });

      if (empRes.ok) {
        const empList = await empRes.json();
        if (Array.isArray(empList) && empList.length > 0) {
          this.employees = empList.map((e, idx) => ({
            id: e.id,
            no: e.no || (idx + 1),
            name: e.name,
            sn: e.sn || '',
            position: e.position || 'Counterman',
            location: e.location || 'CK BMB - Sitarum',
            phone: e.phone || '',
            patternId: e.pattern_id || 'regular_5_2',
            refDate: e.ref_date || '2026-10-01',
            refCycleIndex: e.ref_cycle_index || 0,
            notes: e.notes || ''
          }));
          localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(this.employees));
        }
      }

      // 2. Fetch live overrides from Supabase
      const ovUrl = `${CONFIG.SUPABASE_URL}/rest/v1/roster_overrides?select=*`;
      const ovRes = await fetch(ovUrl, { method: 'GET', headers });

      if (ovRes.ok) {
        const ovList = await ovRes.json();
        if (Array.isArray(ovList)) {
          const cloudOverrides = {};
          ovList.forEach(item => {
            if (item.employee_id === 0 && item.date === 'CONFIG_PIN' && item.shift) {
              localStorage.setItem(STORAGE_KEYS.ADMIN_PIN, item.shift);
            } else if (item.employee_id && item.date) {
              cloudOverrides[`${item.employee_id}:${item.date}`] = {
                shift: item.shift,
                reason: item.reason || 'Supabase Sync'
              };
            }
          });

          this.overrides = cloudOverrides;
          localStorage.setItem(STORAGE_KEYS.OVERRIDES, JSON.stringify(this.overrides));
          localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
        }
      }

      this.refreshView();

      if (isManual) {
        const count = Object.keys(this.overrides).length;
        this.showToast(`✅ Database tersinkron! ${this.employees.length} staf & ${count} jadwal terupdate.`);
      }
    } catch (err) {
      console.warn("Supabase pull error:", err);
      if (isManual) {
        this.showToast("⚠️ Gagal terhubung ke Cloud Supabase. Menampilkan data lokal.");
      }
    } finally {
      this.isLoading = false;
      if (syncBtn) syncBtn.classList.remove('rotating');
    }
  },

  async pushOverrideToSupabase(employeeId, dateIso, shiftCode, reason = "Manual Edit") {
    try {
      const headers = {
        ...getSupabaseHeaders(),
        'Prefer': 'resolution=merge-duplicates'
      };

      const body = JSON.stringify([{
        employee_id: employeeId,
        date: dateIso,
        shift: shiftCode,
        reason: reason
      }]);

      const url = `${CONFIG.SUPABASE_URL}/rest/v1/roster_overrides?on_conflict=employee_id,date`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body
      });

      if (!res.ok) {
        console.warn("Push override to Supabase returned status:", res.status);
      }
    } catch (err) {
      console.warn("Push override to Supabase error:", err);
    }
  },

  async pushAdminPinToSupabase(newPin) {
    try {
      const headers = {
        ...getSupabaseHeaders(),
        'Prefer': 'resolution=merge-duplicates'
      };

      const body = JSON.stringify([{
        employee_id: 0,
        date: 'CONFIG_PIN',
        shift: newPin,
        reason: 'ADMIN_PIN'
      }]);

      const url = `${CONFIG.SUPABASE_URL}/rest/v1/roster_overrides?on_conflict=employee_id,date`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body
      });

      if (!res.ok) {
        throw new Error(`Gagal menyimpan PIN ke Supabase (${res.status})`);
      }
      localStorage.setItem(STORAGE_KEYS.ADMIN_PIN, newPin);
    } catch (err) {
      console.warn("Push admin PIN to Supabase error:", err);
      throw err;
    }
  },

  bindEvents() {
    // Top Bar Back Button
    const backBtn = document.getElementById('btn-roster-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (window.navigateTo) window.navigateTo('home');
      });
    }

    // Sync Button
    const syncBtn = document.getElementById('btn-roster-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.pullFromSupabase(true);
      });
    }

    // Month Navigation: Prev & Next
    const prevBtn = document.getElementById('btn-roster-prev-month');
    const nextBtn = document.getElementById('btn-roster-next-month');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentMonth === 1) {
          this.currentMonth = 12;
          this.currentYear--;
        } else {
          this.currentMonth--;
        }
        this.refreshView();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.currentMonth === 12) {
          this.currentMonth = 1;
          this.currentYear++;
        } else {
          this.currentMonth++;
        }
        this.refreshView();
      });
    }

    // Role Filter Chips
    document.querySelectorAll('.roster-role-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const role = chip.getAttribute('data-role');
        this.selectedRoleFilter = role;
        document.querySelectorAll('.roster-role-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.renderMatrixTable();
      });
    });

    // Auto-Balance Action Button
    const autoBalanceBtn = document.getElementById('btn-roster-auto-balance');
    if (autoBalanceBtn) {
      autoBalanceBtn.addEventListener('click', () => {
        this.autoBalanceShift();
      });
    }

    // Admin Toggle Button
    const adminToggleBtn = document.getElementById('btn-roster-admin-toggle');
    const pinModal = document.getElementById('roster-admin-pin-modal');
    const pinInput = document.getElementById('roster-admin-pin-input');
    const closePinBtn = document.getElementById('btn-close-roster-pin');
    const submitPinBtn = document.getElementById('btn-submit-roster-pin');

    if (adminToggleBtn) {
      adminToggleBtn.addEventListener('click', () => {
        if (this.isAdminMode) {
          this.isAdminMode = false;
          this.updateAdminButtonUI();
          this.showToast("Mode Admin dinonaktifkan (Mode Guest).");
        } else {
          if (pinModal) {
            pinModal.style.display = 'flex';
            if (pinInput) {
              pinInput.value = '';
              pinInput.focus();
            }
          }
        }
      });
    }

    if (closePinBtn && pinModal) {
      closePinBtn.addEventListener('click', () => {
        pinModal.style.display = 'none';
      });
    }

    if (submitPinBtn) {
      submitPinBtn.addEventListener('click', () => {
        const pin = pinInput ? pinInput.value.trim() : "";
        const savedPin = localStorage.getItem(STORAGE_KEYS.ADMIN_PIN) || DEFAULT_ADMIN_PIN;

        if (pin === savedPin) {
          this.isAdminMode = true;
          this.updateAdminButtonUI();
          if (pinModal) pinModal.style.display = 'none';
          this.showToast("🔓 Mode Admin Aktif! Sentuh sel shift untuk mengubah.");
        } else {
          this.showToast("❌ PIN salah!");
        }
      });
    }

    // Cell Edit Modal
    const cellModal = document.getElementById('roster-cell-edit-modal');
    const closeCellModal = document.getElementById('btn-close-cell-edit');
    if (closeCellModal && cellModal) {
      closeCellModal.addEventListener('click', () => {
        cellModal.style.display = 'none';
      });
    }

    // Shift options buttons inside Cell Edit Modal
    document.querySelectorAll('.roster-shift-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const shiftCode = btn.getAttribute('data-shift');
        if (this.selectedCell) {
          const key = `${this.selectedCell.employeeId}:${this.selectedCell.dateIso}`;
          this.overrides[key] = { shift: shiftCode, reason: "Manual Edit on Grid" };
          this.saveState();
          if (cellModal) cellModal.style.display = 'none';
          this.refreshView();
          this.showToast(`Shift ${this.selectedCell.employeeName} diubah ke ${shiftCode}`);

          // Two-Way Sync: Asynchronously push edit to Supabase
          this.pushOverrideToSupabase(this.selectedCell.employeeId, this.selectedCell.dateIso, shiftCode, "Manual Edit on Grid");
        }
      });
    });

    // Change Admin PIN Modal & Events
    const changePinBtn = document.getElementById('btn-roster-change-pin');
    const changePinModal = document.getElementById('roster-change-pin-modal');
    const cancelChangePinBtn = document.getElementById('btn-cancel-roster-change-pin');
    const submitChangePinBtn = document.getElementById('btn-submit-roster-change-pin');
    const oldPinInput = document.getElementById('roster-old-pin-input');
    const newPinInput = document.getElementById('roster-new-pin-input');
    const confirmPinInput = document.getElementById('roster-confirm-pin-input');
    const changePinError = document.getElementById('roster-change-pin-error');

    if (changePinBtn && changePinModal) {
      changePinBtn.addEventListener('click', () => {
        if (oldPinInput) oldPinInput.value = '';
        if (newPinInput) newPinInput.value = '';
        if (confirmPinInput) confirmPinInput.value = '';
        if (changePinError) {
          changePinError.innerText = '';
          changePinError.style.display = 'none';
        }
        changePinModal.style.display = 'flex';
        if (oldPinInput) oldPinInput.focus();
      });
    }

    if (cancelChangePinBtn && changePinModal) {
      cancelChangePinBtn.addEventListener('click', () => {
        changePinModal.style.display = 'none';
      });
    }

    if (submitChangePinBtn) {
      submitChangePinBtn.addEventListener('click', async () => {
        const oldPin = oldPinInput ? oldPinInput.value.trim() : '';
        const newPin = newPinInput ? newPinInput.value.trim() : '';
        const confirmPin = confirmPinInput ? confirmPinInput.value.trim() : '';
        const savedPin = localStorage.getItem(STORAGE_KEYS.ADMIN_PIN) || DEFAULT_ADMIN_PIN;

        if (oldPin !== savedPin) {
          if (changePinError) {
            changePinError.innerText = 'PIN Lama salah!';
            changePinError.style.display = 'block';
          }
          return;
        }

        if (newPin.length < 4) {
          if (changePinError) {
            changePinError.innerText = 'PIN Baru minimal 4 digit angka!';
            changePinError.style.display = 'block';
          }
          return;
        }

        if (newPin !== confirmPin) {
          if (changePinError) {
            changePinError.innerText = 'Konfirmasi PIN Baru tidak cocok!';
            changePinError.style.display = 'block';
          }
          return;
        }

        submitChangePinBtn.disabled = true;
        submitChangePinBtn.innerText = 'Menyimpan...';

        try {
          await this.pushAdminPinToSupabase(newPin);
          if (changePinModal) changePinModal.style.display = 'none';
          this.showToast('✅ PIN Admin berhasil diubah dan tersinkron ke Cloud Database!');
        } catch (err) {
          if (changePinError) {
            changePinError.innerText = 'Gagal menyimpan ke Cloud: ' + err.message;
            changePinError.style.display = 'block';
          }
        } finally {
          submitChangePinBtn.disabled = false;
          submitChangePinBtn.innerText = 'Simpan';
        }
      });
    }
  },

  updateAdminButtonUI() {
    const adminToggleBtn = document.getElementById('btn-roster-admin-toggle');
    const adminText = document.getElementById('roster-admin-status-text');

    if (adminToggleBtn) {
      adminToggleBtn.classList.toggle('mode-admin', this.isAdminMode);
    }
    if (adminText) {
      adminText.textContent = this.isAdminMode ? "ADMIN" : "GUEST";
    }

    const changePinBtn = document.getElementById('btn-roster-change-pin');
    if (changePinBtn) {
      changePinBtn.style.display = this.isAdminMode ? 'flex' : 'none';
    }
  },

  refreshView() {
    this.renderMonthHeader();
    this.renderMatrixTable();
  },

  renderMonthHeader() {
    const monthEl = document.getElementById('roster-month-label');
    if (monthEl) {
      monthEl.textContent = `${ENGLISH_MONTHS[this.currentMonth - 1]} ${this.currentYear}`;
    }
  },

  projectShift(emp, year, month, day) {
    const dt = new Date(year, month - 1, day);
    const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const overrideKey = `${emp.id}:${dateIso}`;

    // 1. Check Overrides (from Supabase or local cache)
    if (this.overrides[overrideKey]) {
      return this.overrides[overrideKey].shift;
    }

    // 2. Project from Pattern
    const refDateStr = emp.refDate || "2026-10-01";
    const refParts = refDateStr.split('-');
    const refDt = new Date(parseInt(refParts[0]), parseInt(refParts[1]) - 1, parseInt(refParts[2]));

    // Chrono diff in days
    const diffMs = dt.getTime() - refDt.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    let sequence = ["DN", "DN", "DN", "DN", "DN", "OFF", "OFF"];

    if (emp.patternId === "night_rotation_15") {
      // 5 D - 2 OFF - 5 N - 3 OFF
      sequence = [
        "D", "D", "D", "D", "D",
        "OFF", "OFF",
        "N", "N", "N", "N", "N",
        "OFF", "OFF", "OFF"
      ];
    } else if (emp.name === "Ahmad Juwaini") {
      // Selasa-Rabu Libur, Sabtu-Minggu Standby
      sequence = ["DN", "OFF", "OFF", "DN", "DN", "D", "D"];
    } else if (emp.patternId && emp.patternId.includes(",")) {
      sequence = emp.patternId.split(",").map(s => s.trim().toUpperCase());
    }

    const cycleLen = sequence.length;
    const rawIdx = ((emp.refCycleIndex || 0) + diffDays) % cycleLen;
    const normalizedIdx = (rawIdx + cycleLen) % cycleLen;

    return sequence[normalizedIdx] || "DN";
  },

  renderMatrixTable() {
    const container = document.getElementById('roster-matrix-container');
    if (!container) return;

    const numDays = new Date(this.currentYear, this.currentMonth, 0).getDate();
    const daysData = [];

    // Precalculate day info (1..numDays)
    for (let d = 1; d <= numDays; d++) {
      const dt = new Date(this.currentYear, this.currentMonth - 1, d);
      const dayOfWeek = (dt.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
      const shortName = SHORT_DAYS[dayOfWeek];
      const isWeekend = (dayOfWeek >= 5); // Saturday=5, Sunday=6
      const dateIso = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      daysData.push({ day: d, shortName, isWeekend, dateIso });
    }

    // Filter employees by Role
    let visibleEmployees = this.employees;
    if (this.selectedRoleFilter === "COUNTERMAN") {
      visibleEmployees = this.employees.filter(e => (e.position || '').toLowerCase().includes('counterman'));
    } else if (this.selectedRoleFilter === "WAREHOUSEMAN") {
      visibleEmployees = this.employees.filter(e => (e.position || '').toLowerCase().includes('warehouse'));
    }

    // Calculate shifts per employee and daily standby metrics
    let totalTeamOvertime = 0;
    const employeeRowsData = [];
    const dailyCmStandby = new Array(numDays).fill(0);
    const dailyWhStandby = new Array(numDays).fill(0);

    this.employees.forEach(emp => {
      const isCounterman = (emp.position || '').toLowerCase().includes('counterman');
      const isWarehouseman = (emp.position || '').toLowerCase().includes('warehouse');
      let empOt = 0;
      const shifts = [];

      daysData.forEach((dayObj, idx) => {
        const shiftCode = this.projectShift(emp, this.currentYear, this.currentMonth, dayObj.day);
        const shiftDef = SHIFT_DEFS[shiftCode] || SHIFT_DEFS["DN"];

        empOt += (shiftDef.ot || 0);

        // Standby CM counts shift "D" (Standby Day Shift)
        if (shiftCode === "D") {
          if (isCounterman) dailyCmStandby[idx]++;
          if (isWarehouseman) dailyWhStandby[idx]++;
        }

        shifts.push({ day: dayObj.day, dateIso: dayObj.dateIso, shiftCode, shiftDef });
      });

      totalTeamOvertime += empOt;

      if (visibleEmployees.some(v => v.id === emp.id)) {
        employeeRowsData.push({
          emp,
          isCounterman,
          empOt,
          shifts
        });
      }
    });

    // Calculate understaffed days (Counterman standby < 2)
    let understaffedDaysCount = 0;
    daysData.forEach((d, idx) => {
      if (dailyCmStandby[idx] < 2) {
        understaffedDaysCount++;
      }
    });

    // Update KPI Header Cards (Matching screen_verify.png & screen_nov3.png)
    const kpiOtEl = document.getElementById('roster-kpi-total-ot');
    const kpiUnderEl = document.getElementById('roster-kpi-understaffed');
    const kpiStaffEl = document.getElementById('roster-kpi-staff-count');

    if (kpiOtEl) kpiOtEl.textContent = `${totalTeamOvertime}h`;
    if (kpiUnderEl) kpiUnderEl.textContent = `${understaffedDaysCount} Days`;
    if (kpiStaffEl) kpiStaffEl.textContent = `${visibleEmployees.length} Staff`;

    // Build Unified Matrix Table HTML
    let tableHtml = `
      <div class="roster-table-scroll-wrap">
        <table class="roster-matrix-table">
          <thead>
            <tr>
              <th class="roster-th-personnel">PERSONNEL</th>
              ${daysData.map(d => `
                <th class="roster-th-day ${d.isWeekend ? 'th-weekend' : ''}">
                  <div class="th-day-name">${d.shortName}</div>
                  <div class="th-day-num">${d.day}</div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    // Employee Rows
    employeeRowsData.forEach(row => {
      const emp = row.emp;
      const roleBadge = row.isCounterman ? 'CM' : 'WH';

      tableHtml += `
        <tr>
          <td class="roster-td-employee">
            <div class="emp-cell-top">
              <span class="emp-role-badge ${row.isCounterman ? 'badge-cm' : 'badge-wh'}">${roleBadge}</span>
              <span class="emp-name" title="${emp.name}">${emp.name}</span>
            </div>
            <div class="emp-cell-bottom">
              <span class="emp-pos">${row.isCounterman ? 'Counterman' : 'Warehouse'}</span>
              <span class="emp-ot">• ${row.empOt}h</span>
            </div>
          </td>
          ${row.shifts.map((s, idx) => {
            const isWeekend = daysData[idx].isWeekend;
            return `
              <td class="roster-td-cell ${isWeekend ? 'cell-weekend' : ''}" 
                  data-emp-id="${emp.id}" 
                  data-emp-name="${emp.name}" 
                  data-date-iso="${s.dateIso}" 
                  data-shift="${s.shiftCode}">
                <div class="roster-shift-box shift-${s.shiftCode}" style="background: ${s.shiftDef.bg}; color: ${s.shiftDef.fg};">
                  ${s.shiftCode}
                </div>
              </td>
            `;
          }).join('')}
        </tr>
      `;
    });

    // Standby Manning Rows (Bottom Sticky / Highlighted)
    tableHtml += `
          </tbody>
          <tfoot>
            <!-- Standby Counterman Row -->
            <tr class="roster-tr-standby">
              <td class="roster-td-standby td-cm">
                <div class="standby-title">STANDBY CM (D)</div>
                <div class="standby-sub">Min 2 Personnel</div>
              </td>
              ${daysData.map((d, idx) => {
                const count = dailyCmStandby[idx];
                const isUnder = count < 2;
                return `
                  <td class="roster-td-standby-val ${isUnder ? 'val-understaffed' : 'val-cm-ok'}">
                    ${count}
                  </td>
                `;
              }).join('')}
            </tr>

            <!-- Standby Warehouseman Row -->
            <tr class="roster-tr-standby">
              <td class="roster-td-standby td-wh">
                <div class="standby-title">STANDBY WH (D)</div>
                <div class="standby-sub">Min 1 Personnel</div>
              </td>
              ${daysData.map((d, idx) => {
                const count = dailyWhStandby[idx];
                return `
                  <td class="roster-td-standby-val val-wh-ok">
                    ${count}
                  </td>
                `;
              }).join('')}
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    container.innerHTML = tableHtml;

    // Attach Cell Click listener
    container.querySelectorAll('.roster-td-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const empId = parseInt(cell.getAttribute('data-emp-id'), 10);
        const empName = cell.getAttribute('data-emp-name');
        const dateIso = cell.getAttribute('data-date-iso');
        const currentShift = cell.getAttribute('data-shift');

        if (!this.isAdminMode) {
          const shiftDef = SHIFT_DEFS[currentShift] || {};
          this.showToast(`📅 ${dateIso} • ${empName}: Shift ${currentShift} (${shiftDef.desc || shiftDef.name || ''})`);
          return;
        }

        // Admin Edit Mode
        this.selectedCell = { employeeId: empId, employeeName: empName, dateIso, currentShift };

        const modal = document.getElementById('roster-cell-edit-modal');
        const titleEl = document.getElementById('cell-edit-title');
        const subEl = document.getElementById('cell-edit-subtitle');

        if (titleEl) titleEl.textContent = `Ubah Shift: ${empName}`;
        if (subEl) subEl.textContent = `Tanggal: ${dateIso} • Shift Saat Ini: ${currentShift}`;
        if (modal) modal.style.display = 'flex';
      });
    });
  },

  async autoBalanceShift() {
    if (!this.isAdminMode) {
      this.showToast("⚠️ Buka kunci Mode Admin terlebih dahulu untuk Auto-Balance.");
      return;
    }

    const numDays = new Date(this.currentYear, this.currentMonth, 0).getDate();
    let balancedCount = 0;
    const newOverrides = [];

    for (let d = 1; d <= numDays; d++) {
      const dt = new Date(this.currentYear, this.currentMonth - 1, d);
      const isWeekend = (dt.getDay() === 0 || dt.getDay() === 6);
      const dateIso = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      if (isWeekend) {
        // Count Standby Countermen
        let cmCount = 0;
        this.employees.forEach(emp => {
          if ((emp.position || '').toLowerCase().includes('counterman')) {
            const shift = this.projectShift(emp, this.currentYear, this.currentMonth, d);
            if (shift === "D") cmCount++;
          }
        });

        // If understaffed (< 2), assign Ahmad Juwaini (id: 5) or Ahmad Hidayat (id: 3) to "D"
        if (cmCount < 2) {
          const candidate = this.employees.find(e => e.id === 5 || e.id === 3);
          if (candidate) {
            this.overrides[`${candidate.id}:${dateIso}`] = { shift: "D", reason: "Auto-Balance Weekend" };
            newOverrides.push({
              employee_id: candidate.id,
              date: dateIso,
              shift: "D",
              reason: "Auto-Balance Weekend"
            });
            balancedCount++;
          }
        }
      }
    }

    this.saveState();
    this.refreshView();
    this.showToast(`✨ Auto-Balance selesai! ${balancedCount} shift akhir pekan disesuaikan.`);

    // Two-Way Sync: Asynchronously push batch overrides to Supabase
    if (newOverrides.length > 0) {
      try {
        const headers = {
          ...getSupabaseHeaders(),
          'Prefer': 'resolution=merge-duplicates'
        };
        await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/roster_overrides?on_conflict=employee_id,date`, {
          method: 'POST',
          headers,
          body: JSON.stringify(newOverrides)
        });
      } catch (err) {
        console.warn("Auto-balance push error:", err);
      }
    }
  },

  showToast(msg) {
    const toast = document.getElementById('global-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }
};
